const API_URL = 'http://localhost:3000/api';
let ws = null;

class AquaSyncApp {
  constructor() {
    this.data = null;
    this.currentTab = 'overview';
    this.charts = {};
    this.dismissedCriticalLeakIds = this.loadDismissedCriticalLeakIds();
    this.stpAutomation = {
      mode: 'auto',
      autoPilotEnabled: true,
      emergencyStop: false,
      autoAeration: true,
      autoDosing: true,
      autoSludgePurge: true,
      targetBod: 10,
      targetCod: 30,
      energyMode: 'balanced',
      lastOptimization: 'Not run yet',
      actionLog: []
    };
    this.init();
  }

  loadDismissedCriticalLeakIds() {
    try {
      const raw = localStorage.getItem('aquasync.dismissedCriticalLeakIds');
      if (!raw) return new Set();
      const ids = JSON.parse(raw);
      if (!Array.isArray(ids)) return new Set();
      return new Set(ids);
    } catch (error) {
      console.warn('Failed to load dismissed alerts from storage:', error);
      return new Set();
    }
  }

  saveDismissedCriticalLeakIds() {
    try {
      localStorage.setItem(
        'aquasync.dismissedCriticalLeakIds',
        JSON.stringify(Array.from(this.dismissedCriticalLeakIds))
      );
    } catch (error) {
      console.warn('Failed to save dismissed alerts to storage:', error);
    }
  }

  dismissCriticalLeak(leakId) {
    if (!leakId) return;
    this.dismissedCriticalLeakIds.add(leakId);
    this.saveDismissedCriticalLeakIds();
    this.renderAlerts();
  }

  async init() {
    this.setupEventListeners();
    this.startClock();
    this.setAIChatVisibility(false);
    this.startSTPAutoPilot();
    await this.connectWebSocket();
    await this.loadData();
    this.startPotabilityRefresh();
  }

  startPotabilityRefresh() {
    // Keep trained model outputs fresh even if websocket payload misses potability block.
    setInterval(() => {
      this.loadPotabilityData();
    }, 12000);
  }

  setAIChatVisibility(isOpen) {
    const chatbot = document.getElementById('ai-chatbot');
    const launcher = document.getElementById('ai-chat-launcher');
    if (!chatbot) return;

    chatbot.style.display = isOpen ? 'flex' : 'none';
    if (launcher) {
      launcher.style.display = isOpen ? 'none' : 'flex';
    }
  }

  setupEventListeners() {
    document.querySelectorAll('.nav-item').forEach(btn => {
      btn.addEventListener('click', (e) => {
        document.querySelectorAll('.nav-item').forEach(b => b.classList.remove('active'));
        e.currentTarget.classList.add('active');
        const tab = e.currentTarget.dataset.tab;
        this.switchTab(tab);
      });
    });
  }

  startClock() {
    const updateClock = () => {
      const now = new Date();
      document.getElementById('clock').textContent = now.toLocaleTimeString();
    };
    updateClock();
    setInterval(updateClock, 1000);
  }

  formatNumber(num, decimals = 2) {
    if (typeof num !== 'number') return num;
    return parseFloat(num.toFixed(decimals));
  }

  buildPotabilityFallbackFromWaterQuality(waterQuality = {}) {
    const ph = Number(waterQuality.ph ?? 7.0);
    const turbidity = Number(waterQuality.turbidity ?? 2.0);
    const tds = Number(waterQuality.tds ?? 150);
    const chlorine = Number(waterQuality.chlorine ?? 0.8);
    const temperature = Number(waterQuality.temperature ?? 25);
    const wqi = Number(waterQuality.wqi ?? 80);

    const ranges = [
      { key: 'ph', label: 'pH', value: ph, safeMin: 6.5, safeMax: 8.5, unit: '', status: ph >= 6.5 && ph <= 8.5 ? 'in_range' : 'out_of_range', severity: ph >= 6.5 && ph <= 8.5 ? 'low' : 'medium' },
      { key: 'turbidity', label: 'Turbidity', value: turbidity, safeMin: 0, safeMax: 4, unit: 'NTU', status: turbidity <= 4 ? 'in_range' : 'out_of_range', severity: turbidity <= 4 ? 'low' : 'high' },
      { key: 'tds', label: 'TDS', value: tds, safeMin: 50, safeMax: 500, unit: 'ppm', status: tds >= 50 && tds <= 500 ? 'in_range' : 'out_of_range', severity: tds >= 50 && tds <= 500 ? 'low' : 'medium' },
      { key: 'chlorine', label: 'Chlorine Residual', value: chlorine, safeMin: 0.2, safeMax: 2.0, unit: 'mg/L', status: chlorine >= 0.2 && chlorine <= 2.0 ? 'in_range' : 'out_of_range', severity: chlorine >= 0.2 && chlorine <= 2.0 ? 'low' : 'medium' },
      { key: 'temperature', label: 'Temperature', value: temperature, safeMin: 18, safeMax: 32, unit: 'deg C', status: temperature >= 18 && temperature <= 32 ? 'in_range' : 'out_of_range', severity: temperature >= 18 && temperature <= 32 ? 'low' : 'medium' },
      { key: 'wqi', label: 'WQI', value: wqi, safeMin: 70, safeMax: 100, unit: '', status: wqi >= 70 ? 'in_range' : 'out_of_range', severity: wqi >= 70 ? 'low' : 'high' }
    ];

    const outCount = ranges.filter((r) => r.status === 'out_of_range').length;
    const hybridScore = Math.max(0, Math.min(100, Math.round((wqi * 0.6 + Math.max(0, (100 - turbidity * 10)) * 0.2 + Math.max(0, (100 - Math.max(0, tds - 100) / 5)) * 0.2))));
    const hybridLabel = hybridScore >= 75 ? 'Safe' : (hybridScore >= 55 ? 'Caution' : 'Unsafe');
    const riskOverall = outCount >= 3 ? 'High' : (outCount >= 1 ? 'Medium' : 'Low');

    return {
      updatedAt: new Date().toISOString(),
      ranges,
      fuzzy: {
        score: hybridScore,
        confidence: Number(Math.max(0.55, 1 - outCount * 0.15).toFixed(2))
      },
      ml: {
        score: hybridScore,
        accuracy: null,
        label: hybridLabel
      },
      hybrid: {
        score: hybridScore,
        label: hybridLabel,
        binaryClass: hybridScore >= 75 ? 1 : 0,
        recommendedUse: hybridLabel === 'Safe' ? 'Direct drinking' : (hybridLabel === 'Caution' ? 'Use after treatment (boiling/UV/chlorination)' : 'Do not drink until treated')
      },
      diseaseRisk: {
        overall: riskOverall,
        conditions: [],
        recommendations: outCount > 0 ? ['Treat out-of-range parameters before potable use.'] : ['No disease trigger detected for current ranges.']
      }
    };
  }

  async connectWebSocket() {
    try {
      ws = new WebSocket('ws://localhost:3000');
      
      ws.onopen = () => {
        console.log('WebSocket connected');
        document.getElementById('connection-status').textContent = 'ALL SYSTEMS LIVE';
      };

      ws.onmessage = (event) => {
        const message = JSON.parse(event.data);
        if (message.type === 'init' || message.type === 'update') {
          // Preserve local irrigation mode and active zone states
          const currentMode = this.data?.irrigation?.mode;
          const currentZones = this.data?.irrigation?.zones;
          
          // Update data from server
          this.data = message.data;

          // Preserve latest trained potability output if websocket payload does not include it.
          if (!this.data.waterPotability && this.lastPotabilityData) {
            this.data.waterPotability = this.lastPotabilityData;
          }
          
          // Restore irrigation mode if it was manually set
          if (currentMode && this.data.irrigation) {
            this.data.irrigation.mode = currentMode;
          }
          
          // Preserve zone states that were manually changed
          if (currentZones && this.data.irrigation?.zones) {
            this.data.irrigation.zones.forEach((zone, index) => {
              if (currentZones[index]) {
                zone.sprinklerStatus = currentZones[index].sprinklerStatus;
              }
            });
          }
          
          this.render();

          if (!message.data?.waterPotability) {
            this.loadPotabilityData();
          }
        }
      };

      ws.onerror = () => {
        document.getElementById('connection-status').textContent = 'CONNECTION ERROR';
      };

      ws.onclose = () => {
        document.getElementById('connection-status').textContent = 'RECONNECTING...';
        setTimeout(() => this.connectWebSocket(), 3000);
      };
    } catch (error) {
      console.error('WebSocket error:', error);
    }
  }

  async loadData() {
    try {
      const response = await fetch(`${API_URL}/dashboard`);
      this.data = await response.json();
      await this.loadPotabilityData();
      this.render();
    } catch (error) {
      console.warn('Failed to load API data, using fallback dummy data.');
      this.data = this.getDummyData();
      this.render();
    }
  }

  async loadPotabilityData() {
    try {
      const res = await fetch(`${API_URL}/water-potability`);
      if (!res.ok) return;
      const potability = await res.json();
      if (!potability || typeof potability !== 'object') return;

      this.lastPotabilityData = potability;
      if (this.data) {
        this.data.waterPotability = potability;
      }

      if (this.currentTab === 'quality' || this.currentTab === 'thresholds') {
        this.render();
      }
    } catch (error) {
      // Ignore transient fetch issues to avoid noisy UX.
    }
  }

  getDummyData() {
    // Existing backend sensorData shape; this ensures tabs render even when backend is down
    return {
      waterQuality: {
        wqi: 87.4,
        ph: 7.2,
        turbidity: 3.8,
        tds: 145,
        chlorine: 0.18,
        temperature: 24.5,
        flowRate: 12.5
      },
      waterPotability: {
        updatedAt: new Date().toISOString(),
        inputReadings: { ph: 7.2, turbidity: 3.8, tds: 145, chlorine: 0.18, temperature: 24.5, wqi: 87.4 },
        ranges: [
          { key: 'ph', label: 'pH', value: 7.2, safeMin: 6.5, safeMax: 8.5, unit: '', status: 'in_range', severity: 'low' },
          { key: 'turbidity', label: 'Turbidity', value: 3.8, safeMin: 0, safeMax: 4, unit: 'NTU', status: 'in_range', severity: 'low' },
          { key: 'tds', label: 'TDS', value: 145, safeMin: 50, safeMax: 500, unit: 'ppm', status: 'in_range', severity: 'low' },
          { key: 'chlorine', label: 'Chlorine Residual', value: 0.18, safeMin: 0.2, safeMax: 2.0, unit: 'mg/L', status: 'out_of_range', severity: 'medium' }
        ],
        fuzzy: { method: 'Mamdani', score: 69.4, label: 'Moderate', confidence: 0.71, rulesFired: [{ id: 'R5', rule: 'Low chlorine => caution', output: 'caution', strength: 0.62 }] },
        ml: {
          trained: true,
          modelType: 'RandomForest',
          probability: 0.63,
          score: 63,
          label: 'Safe',
          accuracy: 87.5,
          trainedAt: new Date().toISOString(),
          samples: 350,
          trees: 60,
          maxDepth: 8,
          minLeaf: 4,
          sampleRate: 0.85,
          maxFeatures: 3,
          trainSource: 'csv-file',
          csvPath: 'backend/data/water_potability.csv',
          featureImportances: {
            ph: 0.12,
            turbidity: 0.24,
            tds: 0.22,
            chlorine: 0.1,
            temperature: 0.08,
            wqi: 0.24
          }
        },
        hybrid: { score: 67.2, label: 'Caution', recommendedUse: 'Use after treatment (boiling/UV/chlorination)', binaryClass: 0 },
        diseaseRisk: {
          overall: 'Medium',
          conditions: [{ name: 'Microbial Gastroenteritis', likelihood: 'medium', trigger: 'Low disinfectant residual', diseases: ['Acute gastroenteritis', 'Typhoid'] }],
          recommendations: ['Increase residual chlorine to 0.2-1.0 mg/L after contact time validation.']
        }
      },
      demand: {
        current: 2.47,
        peak: 3.2,
        peakTime: '18:00',
        totalToday: 45.2,
        savings: 8.3
      },
      leaks: [
        { id: 'L001', zone: 'Sector 7-B', node: 'N-047', severity: 'critical', flow: 4.2, confidence: 97.3, time: '2 min ago', buzzerActive: true },
        { id: 'L002', zone: 'Sector 3-A', node: 'N-023', severity: 'medium', flow: 1.8, confidence: 84.5, time: '18 min ago', buzzerActive: false },
        { id: 'L003', zone: 'Sector 11-D', node: 'N-089', severity: 'low', flow: 0.4, confidence: 71.0, time: '42 min ago', buzzerActive: false }
      ],
      pumps: [
        { id: 'P-001', name: 'Main Supply', status: 'operational', efficiency: 94.3, flow: 450, power: 2.4, runtime: '18h 24m' },
        { id: 'P-002', name: 'Backup Pump', status: 'operational', efficiency: 91.7, flow: 420, power: 2.2, runtime: '12h 15m' },
        { id: 'P-003', name: 'Booster Pump', status: 'warning', efficiency: 78.2, flow: 380, power: 2.8, runtime: '22h 45m' },
        { id: 'P-004', name: 'Reserve Pump', status: 'offline', efficiency: 0, flow: 0, power: 0, runtime: '0h 0m' }
      ],
      stp: {
        efficiency: 94.3,
        inflow: 2.1,
        outflow: 1.98,
        bod: 8.2,
        cod: 22.5,
        lastCleaning: '3 hrs ago',
        riskLevel: 'Low'
      },
      irrigation: {
        mode: 'auto',
        zones: [
          { id: 'Z-001', name: 'Park A - North', soilMoisture: 25, threshold: 30, sprinklerStatus: 'active', waterUsed: 145, duration: 15, lastWatered: '2 min ago' },
          { id: 'Z-002', name: 'Park A - South', soilMoisture: 45, threshold: 30, sprinklerStatus: 'idle', waterUsed: 0, duration: 0, lastWatered: '2 hrs ago' },
          { id: 'Z-003', name: 'Park B - East', soilMoisture: 28, threshold: 30, sprinklerStatus: 'active', waterUsed: 98, duration: 10, lastWatered: '5 min ago' }
        ],
        totalWaterSaved: 1250,
        activeZones: 2,
        scheduledZones: 1,
        totalArea: 2850,
        avgMoisture: 35
      },
      network: { nodes: [ { id: 'N-001', x: 15, y: 20, status: 'normal', pressure: 4.2, flow: 450 }, { id: 'N-023', x: 35, y: 45, status: 'warning', pressure: 2.8, flow: 380 }, { id: 'N-047', x: 75, y: 60, status: 'leak', pressure: 1.2, flow: 120 } ] },
      hardware: {
        esp32: { status: 'connected', uptime: '48h 23m', signalStrength: -45, lastPing: '2s ago' },
        arduino: { status: 'connected', uptime: '48h 23m', sensors: 8, lastPing: '1s ago' },
        sensors: {
          flowSensor: { status: 'active', reading: 12.5, unit: 'L/min', accuracy: 98.5 },
          phSensor: { status: 'active', reading: 7.2, unit: 'pH', accuracy: 99.2 },
          tdsSensor: { status: 'active', reading: 145, unit: 'ppm', accuracy: 97.8 },
          soilMoisture: { status: 'active', reading: 32, unit: '%', accuracy: 96.5 },
          pressureSensor: { status: 'active', reading: 3.8, unit: 'bar', accuracy: 99.1 }
        },
        actuators: { mainPump: { status: 'on', power: 2.4, cycles: 1247 }, sprinklers: { active: 2, total: 6, waterFlow: 243 }, buzzer: { status: 'active', alerts: 3, lastTriggered: '2 min ago' }, valves: { open: 4, closed: 2, total: 6 } }
      },
      analytics: {
        waterSavings: { today: 8.3, week: 52.4, month: 218.7, percentage: 15.2 },
        leakPrevention: { detected: 12, prevented: 9, savedLiters: 4250 },
        efficiency: { distribution: 92.4, irrigation: 88.7, overall: 90.5 },
        predictions: { nextLeakRisk: 'Low', maintenanceDue: '12 days', peakDemandTime: '18:30', recommendedAction: 'Schedule valve inspection' }
      },
      demandForecast: {
        today: { value: 2.47, peak: 3.2, peakTime: '18:00' },
        forecast7Day: { value: 2.61, confidence: 94.5 },
        shortageRisk: { day: 'Day 3', reason: 'Monsoon pre-fill' },
        modelAccuracy: 98.2,
        historicalData: [
          { date: '7 days ago', value: 2.34 },
          { date: '6 days ago', value: 2.41 },
          { date: '5 days ago', value: 2.38 },
          { date: '4 days ago', value: 2.52 },
          { date: '3 days ago', value: 2.61 },
          { date: '2 days ago', value: 2.55 },
          { date: 'Yesterday', value: 2.48 }
        ],
        dailyForecast: [ { day: 'Today', value: 2.47, status: 'Normal' }, { day: 'Tuesday', value: 2.53, status: 'Normal' }, { day: 'Wednesday', value: 2.71, status: 'Elevated' }, { day: 'Thursday', value: 2.89, status: 'High' }, { day: 'Friday', value: 2.65, status: 'Elevated' }, { day: 'Saturday', value: 2.44, status: 'Normal' }, { day: 'Sunday', value: 2.58, status: 'Normal' } ],
        sectorBreakdown: [ { sector: 'Residential', today: 1.1, forecast: 1.15 }, { sector: 'Industrial', today: 0.7, forecast: 0.72 }, { sector: 'Irrigation', today: 0.45, forecast: 0.52 }, { sector: 'Commercial', today: 0.22, forecast: 0.22 } ],
        recommendations: [ { type: 'info', title: 'Pre-fill Reservoir-B by 15:30', desc: 'ML predicts 3.2 MLD demand spike at 18:00. Need 0.73 MLD buffer.' }, { type: 'warning', title: 'Day 3 high-demand window', desc: 'Monsoon season effect. Activate secondary storage tank to prevent overflow.' }, { type: 'info', title: 'Weekend demand dip expected', desc: 'Industrial sector drops 38%. Recommended scheduled maintenance window: Sat 02:00-06:00.' }, { type: 'warning', title: 'Irrigation demand peaks Day 5-6', desc: 'Agricultural sector +22%. Ensure zone valve pressures are pre-calibrated.' } ]
      },
      zoneQuality: {
        zones: [ { id: 'Z-1A', wqi: 91, status: 'good' }, { id: 'Z-2B', wqi: 85, status: 'good' }, { id: 'Z-3A', wqi: 72, status: 'fair' }, { id: 'Z-4C', wqi: 88, status: 'good' }, { id: 'Z-5B', wqi: 63, status: 'fair' }, { id: 'Z-6A', wqi: 91, status: 'good' }, { id: 'Z-7B', wqi: 54, status: 'poor' }, { id: 'Z-8D', wqi: 87, status: 'good' }, { id: 'Z-9A', wqi: 78, status: 'fair' }, { id: 'Z-10C', wqi: 82, status: 'good' }, { id: 'Z-11D', wqi: 89, status: 'good' }, { id: 'Z-12B', wqi: 66, status: 'fair' } ],
        alerts: [ { severity: 'critical', title: 'Chlorine below minimum — Sectors 4, 5, 6', time: '09:42', desc: 'Auto-dosing triggered · Monitoring active' }, { severity: 'warning', title: 'Turbidity spike — Zone 3-A (3.8 NTU)', time: '11:17', desc: 'Approaching 4 NTU limit · Watch' }, { severity: 'warning', title: 'pH fluctuation — Zone 9-B (7.9 → 8.1)', time: '12:05', desc: 'Minimal range · Minor drift detected' }, { severity: 'info', title: 'Reservoir-A chlorination completed', time: '00:30', desc: 'Levels restored to 0.6 mg/L · Resolved' } ]
      },
      pipelineIntegrity: { segments: [ { id: 'T-1', score: 92, status: 'good' }, { id: 'T-2', score: 88, status: 'good' }, { id: 'T-3', score: 41, status: 'critical' }, { id: 'B-1', score: 96, status: 'good' }, { id: 'B-2', score: 73, status: 'fair' }, { id: 'B-3', score: 85, status: 'good' } ], monitored: 12 },
      aiInsights: [
        { icon: '📊', title: 'Demand spike predicted', desc: '3.2 MLD at 18:00. Pre-fill Reservoir-B by 15:30 for buffer capacity.' },
        { icon: '⚠️', title: 'Pump-003 degradation', desc: 'Vibration pattern suggests bearing wear. Schedule maintenance within 72hrs.' },
        { icon: '🔴', title: 'Chlorine level low', desc: 'Sectors 4-6. Auto-dosing adjustment triggered at 09:42 today.' },
        { icon: '🌧️', title: 'Monsoon prep alert', desc: 'STP overflow risk moderate in 7 days. Activate secondary tank on Day 3.' }
      ],
      thresholds: {
        waterQuality: [
          { parameter: 'pH Level', min: 6.5, max: 8.5, unit: '—' },
          { parameter: 'Turbidity', min: 0, max: 4, unit: 'NTU' },
          { parameter: 'Chlorine', min: 0.2, max: 4.0, unit: 'mg/L' },
          { parameter: 'Dissolved O₂', min: 7.0, max: 12.0, unit: 'mg/L' },
          { parameter: 'Pressure', min: 2.0, max: 8.0, unit: 'bar' },
          { parameter: 'Flow Rate', min: 100, max: 600, unit: 'LPM' }
        ]
      }
    };
  }

  async refreshData() {
    await this.loadData();
  }

  toggleAIChat() {
    const chatbot = document.getElementById('ai-chatbot');
    if (!chatbot) return;
    const isOpen = chatbot.style.display === 'flex';
    this.setAIChatVisibility(!isOpen);
  }

  sendAIMessage() {
    const input = document.getElementById('chat-input');
    const messages = document.getElementById('chat-messages');
    if (!input || !messages) return;

    const text = input.value.trim();
    if (!text) return;

    const userMessage = document.createElement('div');
    userMessage.className = 'chat-message chat-user';
    userMessage.textContent = text;
    messages.appendChild(userMessage);

    input.value = '';
    messages.scrollTop = messages.scrollHeight;

    const botAnswer = document.createElement('div');
    botAnswer.className = 'chat-message chat-bot';
    botAnswer.textContent = 'Processing...';
    messages.appendChild(botAnswer);
    messages.scrollTop = messages.scrollHeight;

    setTimeout(() => {
      botAnswer.textContent = `Thanks! I analyzed your request ("${text}") and your current irrigation mode is ${this.data?.irrigation?.mode || 'unknown'}. Try toggling it from the panel. For leak/quality updates, check the card metrics in Overview.`;
      messages.scrollTop = messages.scrollHeight;
    }, 700);
  }

  quickAIQuery(topic) {
    const tips = {
      leak: 'Critical leak workflows: prioritize immediate pressure reduction and dispatch repair crew in high-risk sectors (e.g., N-047).',
      irrigation: 'Use manual mode to override auto schedule, then return to auto when moisture is stable above 35%.',
      forecast: 'Peak demand appears at 18:00. Pre-fill reservoir, and use variable pump speed to flatten the peak.'
    };
    const input = document.getElementById('chat-input');
    if (input) input.value = tips[topic] || 'Try “Check leak status” or “Show irrigation alert”.';
    this.sendAIMessage();
  }

  setIrrigationMode(mode) {
    if (!this.data || !this.data.irrigation) return;
    this.data.irrigation.mode = mode;
    if (mode === 'manual') {
      this.data.irrigation.manualActive = true;
    } else {
      this.data.irrigation.manualActive = false;
      this.data.irrigation.zones.forEach(z => {
        if (z.soilMoisture >= z.threshold) {
          z.sprinklerStatus = 'idle';
        }
      });
    }
    this.render();
  }

  showNotification(message, type = 'info') {
    // Log to console
    console.log(`[${type.toUpperCase()}] ${message}`);
    
    // Create a temporary notification element
    const notif = document.createElement('div');
    notif.style.cssText = `
      position: fixed;
      top: 20px;
      right: 20px;
      background: ${type === 'success' ? 'var(--green)' : type === 'error' ? 'var(--red)' : 'var(--blue)'};
      color: white;
      padding: 12px 20px;
      border-radius: 6px;
      font-size: 14px;
      font-weight: 500;
      z-index: 9999;
      box-shadow: 0 2px 8px rgba(0,0,0,0.2);
      animation: slideIn 0.3s ease-out;
    `;
    notif.textContent = message;
    document.body.appendChild(notif);
    
    // Remove after 3 seconds
    setTimeout(() => {
      notif.style.animation = 'slideOut 0.3s ease-out';
      setTimeout(() => notif.remove(), 300);
    }, 3000);
  }

  async runForecastModel() {
    try {
      const res = await fetch(`${API_URL}/forecast/run?days=7`);
      if (!res.ok) {
        throw new Error(`Forecast API failed with status ${res.status}`);
      }

      const payload = await res.json();

      if (payload.forecast) {
        this.data.demandForecast = payload.forecast;
        this.render();
      }

      await this.downloadForecastCSV(payload.reportUrl);
      this.showNotification(`Forecast completed. Source: ${payload.source}. Report downloaded.`, 'success');
      console.log('Forecast model run response:', payload);
    } catch (error) {
      console.error('Forecast model run failed:', error);
      alert('Forecast model run failed; see console for details.');
    }
  }

  async trainPotabilityFromCsv() {
    const treesInput = document.getElementById('rf-trees');
    const depthInput = document.getElementById('rf-depth');
    const leafInput = document.getElementById('rf-min-leaf');
    const sampleRateInput = document.getElementById('rf-sample-rate');
    const featureInput = document.getElementById('rf-max-features');

    const trees = parseInt(treesInput?.value, 10) || 60;
    const maxDepth = parseInt(depthInput?.value, 10) || 8;
    const minLeaf = parseInt(leafInput?.value, 10) || 4;
    const sampleRate = parseFloat(sampleRateInput?.value) || 0.85;
    const maxFeatures = parseInt(featureInput?.value, 10) || 3;

    try {
      this.showNotification('Training Random Forest from CSV... please wait', 'info');

      const res = await fetch(`${API_URL}/water-potability/train`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          useCsv: true,
          csvPath: 'data/water_potability.csv',
          trees,
          maxDepth,
          minLeaf,
          sampleRate,
          maxFeatures
        })
      });

      const payload = await res.json();
      if (!res.ok || !payload.success) {
        throw new Error(payload.error || payload.message || `HTTP ${res.status}`);
      }

      if (payload.currentEvaluation) {
        this.data.waterPotability = payload.currentEvaluation;
      }

      this.render();
      this.showNotification(
        `RF trained from CSV. Accuracy: ${payload.model?.accuracy ?? 'N/A'}% | Samples: ${payload.model?.samples ?? 'N/A'}`,
        'success'
      );
    } catch (error) {
      console.error('Potability CSV training failed:', error);
      this.showNotification('Potability training failed. Check backend/logs.', 'error');
      alert(`Failed to train potability model from CSV: ${error.message}`);
    }
  }

  async downloadSensorData() {
    try {
      const res = await fetch(`${API_URL}/reports/sensors`);
      const data = await res.json();
      const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `sensor-data-${new Date().toISOString().replace(/[:\.]/g, '-')}.json`;
      a.click();
      URL.revokeObjectURL(url);
    } catch (error) {
      console.error('Download sensor data failed:', error);
      alert('Download sensor data failed; see console.');
    }
  }

  async downloadWaterQualityData() {
    try {
      const { waterQuality, zoneQuality } = this.data;
      const csv = 'Water Quality Report\n\nParameter,Value,Unit,Min Threshold,Max Threshold\n' + 
        `pH Level,${waterQuality.ph},—,6.5,8.5\n` +
        `Turbidity,${waterQuality.turbidity},NTU,0,4\n` +
        `Chlorine,${waterQuality.chlorine},mg/L,0.2,4.0\n` +
        `Dissolved O₂,8.4,mg/L,7.0,12.0\n` +
        `TDS,${waterQuality.tds},ppm,100,500\n` +
        `Temperature,${waterQuality.temperature},°C,10,30\n\n` +
        `Zone Quality Status\nZone,WQI,Status\n` +
        zoneQuality.zones.map(z => `${z.id},${z.wqi},${z.status}`).join('\n');
      const blob = new Blob([csv], { type: 'text/csv' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `water-quality-${new Date().toISOString().replace(/[:\.]/g, '-')}.csv`;
      a.click();
      URL.revokeObjectURL(url);
    } catch (error) {
      console.error('Download water quality data failed:', error);
      alert('Failed to download water quality data');
    }
  }

  async downloadLeakDetectionData() {
    try {
      const { leaks, pipelineIntegrity } = this.data;
      const csv = 'Leak Detection & Pipeline Integrity Report\n\nActive Leaks\nID,Zone,Node,Severity,Flow (L/min),Confidence (%),Time\n' +
        leaks.map(l => `${l.id},${l.zone},${l.node},${l.severity},${l.flow},${l.confidence},${l.time}`).join('\n') +
        '\n\nPipeline Integrity Scores\nSegment,Score,Status\n' +
        pipelineIntegrity.segments.map(s => `${s.id},${s.score},${s.status}`).join('\n');
      const blob = new Blob([csv], { type: 'text/csv' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `leak-detection-${new Date().toISOString().replace(/[:\.]/g, '-')}.csv`;
      a.click();
      URL.revokeObjectURL(url);
    } catch (error) {
      console.error('Download leak detection data failed:', error);
      alert('Failed to download leak data');
    }
  }

  async downloadHardwareData() {
    try {
      const { hardware } = this.data;
      const csv = 'Hardware & Sensors Status Report\n\nSensor Status\nSensor,Status,Reading,Unit,Accuracy (%)\n' +
        Object.entries(hardware.sensors).map(([name, sensor]) => 
          `${name},${sensor.status},${sensor.reading},${sensor.unit},${sensor.accuracy}`
        ).join('\n') +
        '\n\nActuators Status\nActuator,Status,Details\n' +
        `Main Pump,${hardware.actuators.mainPump.status},Power: ${hardware.actuators.mainPump.power} kW\n` +
        `Sprinklers,${hardware.actuators.sprinklers.active > 0 ? 'active' : 'idle'},${hardware.actuators.sprinklers.active}/${hardware.actuators.sprinklers.total} active\n` +
        `Valves,${hardware.actuators.valves.open > 0 ? 'active' : 'idle'},${hardware.actuators.valves.open}/${hardware.actuators.valves.total} open`;
      const blob = new Blob([csv], { type: 'text/csv' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `hardware-status-${new Date().toISOString().replace(/[:\.]/g, '-')}.csv`;
      a.click();
      URL.revokeObjectURL(url);
    } catch (error) {
      console.error('Download hardware data failed:', error);
      alert('Failed to download hardware data');
    }
  }

  async downloadIrrigationData() {
    try {
      const { irrigation } = this.data;
      const csv = 'Smart Irrigation Report\n\nMode,Active Zones,Total Water Saved (L),Average Soil Moisture (%)\n' +
        `${irrigation.mode},${irrigation.activeZones},${irrigation.totalWaterSaved},${Math.round(irrigation.zones.reduce((a,z) => a + z.soilMoisture, 0) / irrigation.zones.length)}\n\n` +
        `Zone Status\nZone ID,Zone Name,Soil Moisture (%),Status,Water Used (L),Last Watered\n` +
        irrigation.zones.map(z => `${z.id},${z.name},${this.formatNumber(z.soilMoisture, 2)},${z.sprinklerStatus},${z.waterUsed},${z.lastWatered}`).join('\n');
      const blob = new Blob([csv], { type: 'text/csv' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `irrigation-data-${new Date().toISOString().replace(/[:\.]/g, '-')}.csv`;
      a.click();
      URL.revokeObjectURL(url);
    } catch (error) {
      console.error('Download irrigation data failed:', error);
      alert('Failed to download irrigation data');
    }
  }

  async downloadForecastCSV(reportUrl) {
    try {
      const url = reportUrl || `${API_URL}/reports/forecast/csv`;
      const res = await fetch(url);
      if (!res.ok) {
        throw new Error(`Forecast report endpoint failed with status ${res.status}`);
      }

      const blob = await res.blob();
      const objectUrl = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = objectUrl;
      a.download = `forecast-report-${new Date().toISOString().replace(/[:\.]/g, '-')}.csv`;
      a.click();
      URL.revokeObjectURL(objectUrl);
    } catch (error) {
      console.error('Download forecast CSV failed:', error);
      alert('Failed to download forecast report CSV.');
    }
  }

  async dispatchLeakTeam(leak) {
    if (!leak) return;
    try {
      const res = await fetch(`${API_URL}/dispatch/leak`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          leakId: leak.id,
          zone: leak.zone,
          node: leak.node,
          flow: leak.flow,
          confidence: leak.confidence
        })
      });
      const payload = await res.json();
      alert(`✓ Dispatch Job: ${payload.job.jobId}\n\n${payload.message}\n\nAdmin notified. Plumbers assigned shortly.\n\nEstimated arrival: ${payload.job.estimatedArrivalTime}`);
      console.log('Dispatch job created:', payload.job);
    } catch (error) {
      console.error('Dispatch failed:', error);
      alert('Dispatch failed; see console.');
    }
  }

  async getDispatchJobs() {
    try {
      const res = await fetch(`${API_URL}/dispatch/jobs`);
      const jobs = await res.json();
      console.log('Current dispatch jobs:', jobs);
      return jobs;
    } catch (error) {
      console.error('Failed to fetch dispatch jobs:', error);
      return [];
    }
  }

  async dispatchAllLeaks() {
    if (!this.data || !this.data.leaks || this.data.leaks.length === 0) {
      alert('No active leaks to dispatch.');
      return;
    }

    const criticalLeaks = this.data.leaks.filter(l => l.severity === 'critical');
    if (criticalLeaks.length === 0) {
      alert('No critical leaks. Only critical leaks are dispatched.');
      return;
    }

    let dispatchedCount = 0;
    let dispatchedJobs = [];

    for (const leak of criticalLeaks) {
      try {
        const res = await fetch(`${API_URL}/dispatch/leak`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            leakId: leak.id,
            zone: leak.zone,
            node: leak.node,
            flow: leak.flow,
            confidence: leak.confidence
          })
        });
        const payload = await res.json();
        if (payload.success) {
          dispatchedCount++;
          dispatchedJobs.push(payload.job.jobId);
        }
      } catch (error) {
        console.error(`Failed to dispatch leak ${leak.id}:`, error);
      }
    }

    alert(`✓ Dispatched ${dispatchedCount}/${criticalLeaks.length} critical leaks\n\nJobs: ${dispatchedJobs.join(', ')}\n\nAdmin notified for plumber assignment. Repair teams en route.`);
    console.log('Dispatched jobs:', dispatchedJobs);
  }

  toggleIrrigationZone(zoneId, action) {
    if (!this.data || !this.data.irrigation) return;
    const zone = this.data.irrigation.zones.find(z => z.id === zoneId);
    if (!zone) return;

    if (action === 'start') {
      zone.sprinklerStatus = 'active';
      this.showNotification(`${zone.name} sprinkler STARTED`, 'success');
    } else if (action === 'stop') {
      zone.sprinklerStatus = 'idle';
      this.showNotification(`${zone.name} sprinkler STOPPED`, 'success');
    } else if (action === 'schedule') {
      zone.sprinklerStatus = 'scheduled';
      this.showNotification(`${zone.name} scheduled`, 'info');
    }

    this.data.irrigation.activeZones = this.data.irrigation.zones.filter(z => z.sprinklerStatus === 'active').length;
    this.render();
  }

  controlMainPump() {
    if (!this.data?.hardware?.actuators?.mainPump) return;
    const pump = this.data.hardware.actuators.mainPump;
    pump.status = pump.status === 'on' ? 'off' : 'on';
    this.showNotification(`Main Water Pump turned ${pump.status.toUpperCase()}`, 'success');
    this.render();
  }

  controlSprinklers() {
    if (!this.data?.hardware?.actuators?.sprinklers) return;
    const sprinklers = this.data.hardware.actuators.sprinklers;
    sprinklers.active = sprinklers.active > 0 ? 0 : sprinklers.total;
    this.showNotification(`Sprinkler System: ${sprinklers.active > 0 ? 'ACTIVATED' : 'DEACTIVATED'}`, 'success');
    this.render();
  }

  silenceBuzzer() {
    if (!this.data?.hardware?.actuators?.buzzer) return;
    const buzzer = this.data.hardware.actuators.buzzer;
    buzzer.status = 'silenced';
    this.showNotification('Alert Buzzer silenced', 'success');
    this.render();
  }

  manageValves() {
    if (!this.data?.hardware?.actuators?.valves) return;
    const valves = this.data.hardware.actuators.valves;
    const shouldOpen = valves.open < valves.closed;
    if (shouldOpen) {
      valves.open = valves.total;
      valves.closed = 0;
      this.showNotification('All valves opened', 'success');
    } else {
      valves.open = 0;
      valves.closed = valves.total;
      this.showNotification('All valves closed', 'success');
    }
    this.render();
  }

  getSTPAutomation() {
    if (!this.stpAutomation) {
      this.stpAutomation = {
        mode: 'auto',
        autoPilotEnabled: true,
        emergencyStop: false,
        autoAeration: true,
        autoDosing: true,
        autoSludgePurge: true,
        targetBod: 10,
        targetCod: 30,
        energyMode: 'balanced',
        lastOptimization: 'Not run yet',
        actionLog: []
      };
    }
    return this.stpAutomation;
  }

  setSTPMode(mode) {
    const automation = this.getSTPAutomation();
    if (automation.emergencyStop && mode === 'auto') {
      this.showNotification('Clear emergency stop before switching to AUTO', 'error');
      return;
    }
    automation.mode = mode === 'manual' ? 'manual' : 'auto';
    this.showNotification(`STP mode set to ${automation.mode.toUpperCase()}`, 'info');
    this.render();
  }

  startSTPAutoPilot() {
    if (this.stpAutoTimer) return;

    this.stpAutoTimer = setInterval(() => {
      const automation = this.getSTPAutomation();
      if (!this.data?.stp) return;
      if (!automation.autoPilotEnabled || automation.mode !== 'auto' || automation.emergencyStop) return;

      // Small drift to emulate real plant fluctuations before optimization.
      const driftBod = (Math.random() - 0.5) * 0.6;
      const driftCod = (Math.random() - 0.5) * 1.2;
      const stp = this.data.stp;
      stp.bod = Number(Math.max(6.5, stp.bod + driftBod).toFixed(1));
      stp.cod = Number(Math.max(18, stp.cod + driftCod).toFixed(1));
      stp.inflow = Number(Math.max(1.5, stp.inflow + (Math.random() - 0.5) * 0.08).toFixed(2));

      this.runSTPOptimizationCycle({ silent: true, origin: 'autopilot' });
    }, 12000);
  }

  toggleSTPAutoPilot() {
    const automation = this.getSTPAutomation();
    automation.autoPilotEnabled = !automation.autoPilotEnabled;
    this.showNotification(`STP Autopilot ${automation.autoPilotEnabled ? 'ENABLED' : 'DISABLED'}`, automation.autoPilotEnabled ? 'success' : 'warning');
    this.render();
  }

  stpEmergencyStop() {
    if (!this.data?.stp) return;
    const automation = this.getSTPAutomation();
    automation.emergencyStop = true;
    automation.mode = 'manual';

    this.data.stp.efficiency = Number(Math.max(70, this.data.stp.efficiency - 2.8).toFixed(1));
    this.data.stp.riskLevel = 'High';
    automation.actionLog = [
      `${new Date().toLocaleTimeString()} - EMERGENCY STOP activated`,
      ...automation.actionLog
    ].slice(0, 6);

    this.showNotification('Emergency stop activated for STP control loop', 'error');
    this.render();
  }

  stpResumeFromEmergency() {
    if (!this.data?.stp) return;
    const automation = this.getSTPAutomation();
    automation.emergencyStop = false;
    automation.mode = 'auto';

    this.data.stp.riskLevel = 'Medium';
    automation.actionLog = [
      `${new Date().toLocaleTimeString()} - Emergency cleared, AUTO resumed`,
      ...automation.actionLog
    ].slice(0, 6);

    this.showNotification('STP resumed from emergency to AUTO mode', 'success');
    this.runSTPOptimizationCycle({ silent: true, origin: 'resume' });
  }

  toggleSTPRule(ruleKey) {
    const automation = this.getSTPAutomation();
    if (!(ruleKey in automation)) return;
    automation[ruleKey] = !automation[ruleKey];
    this.showNotification(`${ruleKey} ${automation[ruleKey] ? 'enabled' : 'disabled'}`, 'info');
    this.render();
  }

  simulateSTPPeakLoad() {
    if (!this.data?.stp) return;
    const stp = this.data.stp;
    const automation = this.getSTPAutomation();

    stp.inflow = Number((Number(stp.inflow || 0) + 0.25).toFixed(2));
    stp.bod = Number((Number(stp.bod || 0) + 1.4).toFixed(1));
    stp.cod = Number((Number(stp.cod || 0) + 2.6).toFixed(1));
    stp.efficiency = Math.max(70, Number((Number(stp.efficiency || 0) - 1.8).toFixed(1)));
    stp.riskLevel = stp.efficiency < 86 ? 'Medium' : 'Low';

    automation.actionLog.unshift(`${new Date().toLocaleTimeString()} - Peak inflow simulated (+0.25 MLD)`);
    automation.actionLog = automation.actionLog.slice(0, 6);

    this.showNotification('STP peak-load scenario simulated', 'warning');
    this.render();
  }

  runSTPOptimizationCycle(options = {}) {
    const { silent = false, origin = 'manual' } = options;
    if (!this.data?.stp) return;

    const stp = this.data.stp;
    const automation = this.getSTPAutomation();
    const actions = [];

    if (automation.emergencyStop) {
      if (!silent) this.showNotification('STP is in emergency stop state', 'error');
      return;
    }

    if (automation.mode !== 'auto') {
      if (!silent) this.showNotification('Switch STP mode to AUTO to run optimization', 'error');
      return;
    }

    if (automation.autoAeration && stp.bod > automation.targetBod) {
      const before = stp.bod;
      stp.bod = Number(Math.max(automation.targetBod - 0.4, stp.bod - 1.1).toFixed(1));
      stp.efficiency = Number(Math.min(99.5, stp.efficiency + 1.2).toFixed(1));
      actions.push(`Aeration tuned: BOD ${before} -> ${stp.bod}`);
    }

    if (automation.autoDosing && stp.cod > automation.targetCod) {
      const before = stp.cod;
      stp.cod = Number(Math.max(automation.targetCod - 1.2, stp.cod - 2.2).toFixed(1));
      stp.efficiency = Number(Math.min(99.5, stp.efficiency + 0.9).toFixed(1));
      actions.push(`Chemical dosing tuned: COD ${before} -> ${stp.cod}`);
    }

    if (automation.autoSludgePurge) {
      stp.outflow = Number(Math.min(stp.inflow, stp.outflow + 0.06).toFixed(2));
      actions.push('Sludge purge valve cycled for 3 min');
    }

    if (actions.length === 0) {
      actions.push('No corrective action needed this cycle');
    }

    const riskScore = (stp.bod > 11 ? 1 : 0) + (stp.cod > 32 ? 1 : 0) + (stp.efficiency < 88 ? 1 : 0);
    stp.riskLevel = riskScore >= 2 ? 'High' : riskScore === 1 ? 'Medium' : 'Low';

    automation.lastOptimization = new Date().toLocaleTimeString();
    automation.actionLog = [
      `${automation.lastOptimization} - [${origin}] ${actions.join(' | ')}`,
      ...automation.actionLog
    ].slice(0, 6);

    if (!silent) {
      this.showNotification('STP auto-optimization cycle completed', 'success');
    }
    this.render();
  }

  switchTab(tab) {
    this.currentTab = tab;
    const titles = {
      overview: 'System Overview',
      quality: 'Water Quality',
      leaks: 'Leak Detection',
      network: 'Network Map',
      irrigation: 'Smart Irrigation System',
      hardware: 'Hardware & Sensors',
      analytics: 'Analytics & Predictions',
      'ai-predictions': 'AI Predictions',
      stp: 'STP Monitor',
      forecast: 'Demand Forecast',
      thresholds: 'Threshold Configuration',
      reports: 'Reports & Export'
    };
    document.getElementById('page-title').textContent = titles[tab] || 'Dashboard';
    this.render();
  }

  render() {
    if (!this.data) return;

    const content = document.getElementById('app-content');
    
    // For network tab, only update node status without recreating the iframe
    if (this.currentTab === 'network') {
      const nodeInfos = document.querySelectorAll('.node-info');
      if (nodeInfos.length > 0) {
        // Already rendered, just update node statuses
        this.updateNetworkNodeStatus();
        return;
      }
    }

    // For irrigation tab, always do full re-render to ensure buttons are functional
    // (they need to be re-attached after any state change)
    
    switch (this.currentTab) {
      case 'overview':
        content.innerHTML = this.renderOverview();
        break;
      case 'quality':
        content.innerHTML = this.renderQuality();
        break;
      case 'leaks':
        content.innerHTML = this.renderLeaks();
        break;
      case 'network':
        content.innerHTML = this.renderNetwork();
        break;
      case 'irrigation':
        content.innerHTML = this.renderIrrigation();
        break;
      case 'hardware':
        content.innerHTML = this.renderHardware();
        break;
      case 'analytics':
        content.innerHTML = this.renderAnalytics();
        break;
      case 'ai-predictions':
        content.innerHTML = this.renderAIPredictions();
        break;
      case 'stp':
        content.innerHTML = this.renderSTP();
        break;
      case 'forecast':
        content.innerHTML = this.renderForecast();
        break;
      case 'thresholds':
        content.innerHTML = this.renderThresholds();
        break;
      case 'reports':
        content.innerHTML = this.renderReports();
        break;
    }

    // Update leak count badge
    document.getElementById('leak-count').textContent = this.data.leaks.length;

    // Show critical alerts
    this.renderAlerts();

    // Render charts for selected tab
    if (this.currentTab === 'overview') {
      this.renderOverviewCharts();
    } else if (this.currentTab === 'forecast') {
      this.renderForecastCharts();
    }
  }

  renderAlerts() {
    const container = document.getElementById('alert-container');
    if (!container || !this.data || !Array.isArray(this.data.leaks)) return;

    const criticalLeaks = this.data.leaks.filter(l => l.severity === 'critical');
    const activeCriticalIds = new Set(criticalLeaks.map(l => l.id).filter(Boolean));

    // Automatically clear dismissed entries once leak is no longer critical.
    const idsToClear = [];
    this.dismissedCriticalLeakIds.forEach((id) => {
      if (!activeCriticalIds.has(id)) idsToClear.push(id);
    });
    idsToClear.forEach((id) => this.dismissedCriticalLeakIds.delete(id));
    if (idsToClear.length > 0) {
      this.saveDismissedCriticalLeakIds();
    }

    const visibleCriticalLeaks = criticalLeaks.filter(
      leak => !this.dismissedCriticalLeakIds.has(leak.id)
    );
    
    if (visibleCriticalLeaks.length > 0) {
      const leak = visibleCriticalLeaks[0];
      container.innerHTML = `
        <div class="alert">
          <div class="alert-content">
            <div class="alert-title">⚠️ Critical Leak Detected — ${leak.flow} L/min loss</div>
            <div class="alert-sub">📍 ${leak.zone} · Node ${leak.node} · ${leak.time} · Confidence ${leak.confidence}%</div>
          </div>
          <button class="alert-close" onclick="app.dismissCriticalLeak('${leak.id}')">✕</button>
        </div>
      `;
    } else {
      container.innerHTML = '';
    }
  }

  destroyChart(name) {
    if (this.charts[name]) {
      this.charts[name].destroy();
      delete this.charts[name];
    }
  }

  renderOverviewCharts() {
    const ctx = document.getElementById('overview-demand-chart');
    if (!ctx || !this.data) return;

    this.destroyChart('overviewDemand');

    const labels = ['00:00','02:00','04:00','06:00','08:00','10:00','12:00','14:00','16:00','18:00','20:00','22:00'];
    const dataPoints = [1.1,1.3,1.5,1.8,2.0,2.3,2.6,2.4,2.1,1.8,1.5,1.3];

    this.charts.overviewDemand = new Chart(ctx, {
      type: 'line',
      data: {
        labels,
        datasets: [
          {
            label: 'Actual Demand',
            data: dataPoints,
            borderColor: 'rgba(29,108,240,0.9)',
            backgroundColor: 'rgba(29,108,240,0.2)',
            fill: true,
            tension: 0.35,
            pointRadius: 2
          },
          {
            label: 'Forecast Demand',
            data: dataPoints.map((v,i)=> i>=8 ? v + 0.2 : null),
            borderColor: 'rgba(37,155,204,0.9)',
            borderDash: [4,4],
            backgroundColor: 'rgba(37,155,204,0.1)',
            fill: false,
            tension: 0.35,
            pointRadius: 0
          }
        ]
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        scales: {
          y: { beginAtZero: true, title: { display: true, text: 'MLD' } },
          x: { title: { display: true, text: 'Time' } }
        },
        plugins: { legend: { position: 'bottom' } }
      }
    });
  }

  renderForecastCharts() {
    const ctx = document.getElementById('forecast-7day-chart');
    if (!ctx || !this.data) return;

    this.destroyChart('forecast7Day');

    const forecastLabels = this.data.demandForecast.dailyForecast.map(d => d.day);
    const forecastValues = this.data.demandForecast.dailyForecast.map(d => d.value);

    this.charts.forecast7Day = new Chart(ctx, {
      type: 'bar',
      data: {
        labels: forecastLabels,
        datasets: [
          {
            label: 'Forecast (MLD)',
            data: forecastValues,
            backgroundColor: forecastValues.map(v => v > 2.7 ? 'rgba(220,38,38,0.6)' : 'rgba(37,99,235,0.6)'),
            borderColor: forecastValues.map(v => v > 2.7 ? 'rgba(220,38,38,1)' : 'rgba(37,99,235,1)'),
            borderWidth: 1
          }
        ]
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        scales: { y: { beginAtZero: true, title: { display: true, text: 'MLD' } } },
        plugins: { legend: { display: false } }
      }
    });
  }

  renderOverview() {
    const { waterQuality, demand, leaks, stp, pumps, network } = this.data;
    const thingspeak = this.data?.integrations?.thingspeak;
    const isThingSpeakLive = thingspeak?.live;
    const thingSpeakEnabled = thingspeak?.enabled;
    const sourceLabel = isThingSpeakLive ? 'THINGSPEAK LIVE' : (thingSpeakEnabled ? 'THINGSPEAK CONNECTING' : 'SIMULATED FEED');
    const sourceBadge = isThingSpeakLive ? 'badge-green' : (thingSpeakEnabled ? 'badge-amber' : 'badge-blue');
    const rawField1 = thingspeak?.rawFields?.field1 ?? '--';
    const rawField2 = thingspeak?.rawFields?.field2 ?? '--';
    const lastSyncLabel = thingspeak?.lastSync
      ? new Date(thingspeak.lastSync).toLocaleTimeString()
      : '--:--:--';
    const criticalLeak = leaks.find(l => l.severity === 'critical');
    const pumpAlerts = pumps.filter(p => p.status !== 'operational').length;

    return `
      <div style="margin-bottom: 16px;display:flex;align-items:center;justify-content:space-between;">
        <div>
          <h1 style="margin:0;font-size:24px;color:var(--text-primary)">System Overview</h1>
          <div style="font-size:12px;color:var(--text-4);">Urban Water Intelligence · Pipeline Punch</div>
        </div>
        <div style="display:flex;align-items:center;gap:10px;">
          <span class="badge badge-green">LIVE MONITORING</span>
          <span class="badge ${sourceBadge}">${sourceLabel}</span>
          <span class="badge badge-blue">Last Sync ${lastSyncLabel}</span>
          <span style="font-family: 'IBM Plex Mono', monospace; font-size:13px; color:var(--text-3);">${new Date().toLocaleTimeString()}</span>
        </div>
      </div>

      ${thingSpeakEnabled ? `
      <div class="panel" style="margin-bottom:16px;">
        <div class="panel-header">
          <div class="panel-title">ThingSpeak Real-Time Feed</div>
          <span class="badge ${sourceBadge}">${sourceLabel}</span>
        </div>
        <div class="panel-body" style="display:grid;grid-template-columns:repeat(auto-fit,minmax(180px,1fr));gap:10px;">
          <div class="param-card">
            <div class="param-name">Channel</div>
            <div class="param-val">${thingspeak?.channelId || '--'}</div>
          </div>
          <div class="param-card">
            <div class="param-name">Field1 (raw)</div>
            <div class="param-val">${rawField1}</div>
          </div>
          <div class="param-card">
            <div class="param-name">Field2 (raw)</div>
            <div class="param-val">${rawField2}</div>
          </div>
          <div class="param-card">
            <div class="param-name">Mapped pH</div>
            <div class="param-val">${waterQuality.ph}</div>
          </div>
          <div class="param-card">
            <div class="param-name">Mapped TDS</div>
            <div class="param-val">${waterQuality.tds}</div>
          </div>
          <div class="param-card">
            <div class="param-name">Feed Timestamp</div>
            <div class="param-val">${thingspeak?.lastFeedAt ? new Date(thingspeak.lastFeedAt).toLocaleString() : 'N/A'}</div>
          </div>
        </div>
      </div>
      ` : ''}

      ${criticalLeak ? `
      <div class="alert" style="border-color:var(--red);background:rgba(254,226,226,.85);margin-bottom:16px;">
        <div class="alert-content">
          <div class="alert-title">CRITICAL LEAK - ${criticalLeak.flow} L/min</div>
          <div class="alert-sub">${criticalLeak.zone} • Node ${criticalLeak.node} • ${criticalLeak.time} • Confidence ${criticalLeak.confidence}%</div>
        </div>
        <div style="display:flex;gap:8px;">
          <button class="btn btn-red" onclick="app.dispatchLeakTeam({id: '${criticalLeak.id}', zone: '${criticalLeak.zone}', node: '${criticalLeak.node}', flow: ${criticalLeak.flow}, confidence: ${criticalLeak.confidence}})">Dispatch Team</button>
          <button class="btn btn-ghost" onclick="alert('Leak details: ' + '${criticalLeak.zone}')">View Details</button>
        </div>
      </div>
      ` : ''}

      <div class="kpi-row" style="grid-template-columns:repeat(5, minmax(160px,1fr));gap:14px;margin-bottom:16px;">
        <div class="kpi">
          <div class="kpi-header"><div class="kpi-label">Water Quality Index</div><span class="kpi-trend trend-up">+2.1%</span></div>
          <div class="kpi-value">${waterQuality.wqi}</div>
          <div class="kpi-sub">GOOD · WHO Compliant</div>
          <div class="kpi-bar"><div class="kpi-bar-fill" style="width:${waterQuality.wqi}%;background:var(--teal)"></div></div>
        </div>
        <div class="kpi">
          <div class="kpi-header"><div class="kpi-label">Total Demand (Today)</div><span class="kpi-trend trend-up">+0.3 MLD</span></div>
          <div class="kpi-value">${(typeof demand.current === 'number' ? demand.current.toFixed(2) : demand.current)}<span style="font-size:12px;color:var(--text-3)"> MLD</span></div>
          <div class="kpi-sub">Peak ${demand.peakTime} → ${demand.peak} MLD</div>
          <div class="kpi-bar"><div class="kpi-bar-fill" style="width:${Math.min(100,(demand.current/demand.peak)*100)}%;background:var(--blue)"></div></div>
        </div>
        <div class="kpi">
          <div class="kpi-header"><div class="kpi-label">Water Loss Rate</div><span class="kpi-trend trend-down">NRW</span></div>
          <div class="kpi-value">18.2<span style="font-size:12px;color:var(--text-3)">%</span></div>
          <div class="kpi-sub">${leaks.length} leaks active</div>
          <div class="kpi-bar"><div class="kpi-bar-fill" style="width:18.2%;background:var(--red)"></div></div>
        </div>
        <div class="kpi">
          <div class="kpi-header"><div class="kpi-label">STP Efficiency</div><span class="kpi-trend trend-up">+1.2%</span></div>
          <div class="kpi-value">${stp.efficiency}%</div>
          <div class="kpi-sub">Above threshold</div>
          <div class="kpi-bar"><div class="kpi-bar-fill" style="width:${stp.efficiency}%;background:var(--green)"></div></div>
        </div>
        <div class="kpi">
          <div class="kpi-header"><div class="kpi-label">Pump Station</div><span class="kpi-trend trend-warn">${pumpAlerts} WARN</span></div>
          <div class="kpi-value">${pumps.filter(p=>p.status==='operational').length}/${pumps.length}</div>
          <div class="kpi-sub">${pumpAlerts} degraded</div>
          <div class="kpi-bar"><div class="kpi-bar-fill" style="width:${Math.round((pumps.filter(p=>p.status==='operational').length/pumps.length)*100)}%;background:${pumpAlerts? 'var(--amber)': 'var(--green)'}"></div></div>
        </div>
      </div>

      <div class="grid-2" style="gap:16px;margin-bottom:16px;">
        <div class="panel">
          <div class="panel-header"><div class="panel-title">Water Quality</div><span class="badge badge-blue">GOOD</span></div>
          <div class="panel-body" style="padding:16px;">
            <div style="display:flex;gap:14px;flex-wrap:wrap;">
              <div style="flex:1;min-width:180px;">
                <div style="font-size:12px;color:var(--text-4);">Indicator</div>
                <div style="font-size:24px;font-weight:700;color:var(--text-primary);">${waterQuality.ph}</div>
                <div style="font-size:11px;color:var(--text-3);">pH Level</div>
              </div>
              <div style="flex:1;min-width:180px;">
                <div style="font-size:12px;color:var(--text-4);">Indicator</div>
                <div style="font-size:24px;font-weight:700;color:var(--text-primary);">${waterQuality.turbidity} NTU</div>
                <div style="font-size:11px;color:var(--text-3);">Turbidity</div>
              </div>
              <div style="flex:1;min-width:180px;">
                <div style="font-size:12px;color:var(--text-4);">Indicator</div>
                <div style="font-size:24px;font-weight:700;color:var(--text-primary);">${waterQuality.chlorine} mg/L</div>
                <div style="font-size:11px;color:var(--text-3);">Chlorine</div>
              </div>
              <div style="flex:1;min-width:180px;">
                <div style="font-size:12px;color:var(--text-4);">Indicator</div>
                <div style="font-size:24px;font-weight:700;color:var(--text-primary);">${waterQuality.tds} ppm</div>
                <div style="font-size:11px;color:var(--text-3);">TDS</div>
              </div>
            </div>
          </div>
        </div>

        <div class="panel">
          <div class="panel-header"><div class="panel-title">Hourly Demand</div><span class="badge badge-green">Today</span></div>
          <div class="panel-body" style="min-height:240px;padding:10px;">
            <canvas id="overview-demand-chart" style="width:100%;height:100%;"></canvas>
          </div>
        </div>
      </div>

      <div class="grid-2" style="gap:16px;">
        <div class="panel">
          <div class="panel-header"><div class="panel-title">Pipeline Network Map</div><span class="badge badge-blue">REAL-TIME</span></div>
          <div class="panel-body" style="height:280px;position:relative;padding:12px;">
            <div style="width:100%;height:100%;background:linear-gradient(135deg,#F4F8FF,#E6FBF4);border-radius:12px;position:relative;">
              ${network.nodes.map(node => `<div class="node node-${node.status}" style="left:${node.x}%;top:${node.y}%;" title="${node.id}, ${node.pressure} bar"></div>`).join('')}
            </div>
          </div>
        </div>

        <div class="panel">
          <div class="panel-header"><div class="panel-title">Leak Detection</div><span class="badge badge-red">${leaks.length} ACTIVE</span></div>
          <div class="panel-body" style="padding:12px;">
            ${leaks.map(leak => `<div style="padding:10px;border:1px solid var(--border);border-radius:10px;margin-bottom:8px;background:${leak.severity==='critical'?'#FEE2E2':'#FEF3C7'};"><div style="font-weight:700">${leak.zone} (${leak.node})</div><div style="font-size:12px;color:var(--text-3)">${leak.flow} L/min • ${leak.confidence}% • ${leak.time}</div></div>`).join('')}
          </div>
        </div>
      </div>
    `;
  }

  renderQuality() {
    const { waterQuality, zoneQuality } = this.data;
    const potability = this.data.waterPotability || this.buildPotabilityFallbackFromWaterQuality(waterQuality);
    const hybrid = potability.hybrid || {};
    const fuzzy = potability.fuzzy || {};
    const ml = potability.ml || {};
    const diseaseRisk = potability.diseaseRisk || {};
    const ranges = Array.isArray(potability.ranges) ? potability.ranges : [];
    const highSeverityCount = ranges.filter((r) => r.severity === 'high').length;
    const outOfRangeCount = ranges.filter((r) => r.status === 'out_of_range').length;
    const potabilityBadge = (hybrid.label || 'Unknown').toLowerCase() === 'safe'
      ? 'badge-green'
      : (hybrid.label || 'Unknown').toLowerCase() === 'unsafe'
        ? 'badge-red'
        : 'badge-amber';
    const diseaseBadge = (diseaseRisk.overall || 'Low').toLowerCase() === 'high'
      ? 'badge-red'
      : (diseaseRisk.overall || 'Low').toLowerCase() === 'medium'
        ? 'badge-amber'
        : 'badge-green';
    
    return `
      <div class="kpi-row">
        <div class="kpi">
          <div class="kpi-header">
            <div class="kpi-ico" style="background:var(--teal-light);color:var(--teal)">
              <svg viewBox="0 0 24 24"><path d="M12 2C6 2 4 8 4 12c0 4.4 3.6 8 8 8s8-3.6 8-8c0-4-2-10-8-10z"/></svg>
            </div>
            <span class="kpi-trend trend-up">▲ 2.1%</span>
          </div>
          <div class="kpi-label">Overall WQI</div>
          <div class="kpi-value">${waterQuality.wqi}</div>
          <div class="kpi-sub" style="color:var(--green)">GOOD · WHO Compliant</div>
        </div>

        <div class="kpi">
          <div class="kpi-header">
            <div class="kpi-ico" style="background:var(--red-light);color:var(--red)">
              <svg viewBox="0 0 24 24"><path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z"/></svg>
            </div>
            <span class="kpi-trend trend-down">▼ LOW</span>
          </div>
          <div class="kpi-label">Chlorine Level</div>
          <div class="kpi-value">0.18<span style="font-size:14px;font-weight:500;color:var(--text-3)"> mg/L</span></div>
          <div class="kpi-sub" style="color:var(--red)">Below min 0.2 mg/L</div>
        </div>

        <div class="kpi">
          <div class="kpi-header">
            <div class="kpi-ico" style="background:var(--amber-light);color:var(--amber)">
              <svg viewBox="0 0 24 24"><circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="12"/></svg>
            </div>
            <span class="kpi-trend trend-warn">⚠ WATCH</span>
          </div>
          <div class="kpi-label">Turbidity</div>
          <div class="kpi-value">3.8<span style="font-size:14px;font-weight:500;color:var(--text-3)"> NTU</span></div>
          <div class="kpi-sub" style="color:var(--amber)">Near limit 4.0 NTU</div>
        </div>

        <div class="kpi">
          <div class="kpi-header">
            <div class="kpi-ico" style="background:var(--green-light);color:var(--green)">
              <svg viewBox="0 0 24 24"><polyline points="22 12 18 12 15 21 9 3 6 12 2 12"/></svg>
            </div>
            <span class="kpi-trend trend-up">▲ Normal</span>
          </div>
          <div class="kpi-label">Dissolved O₂</div>
          <div class="kpi-value">8.4<span style="font-size:14px;font-weight:500;color:var(--text-3)"> mg/L</span></div>
          <div class="kpi-sub" style="color:var(--green)">Moderate 7 mg/L</div>
        </div>
      </div>

      <div class="panel" style="margin-bottom:16px;">
        <div class="panel-header" style="display:flex;justify-content:space-between;align-items:center;gap:10px;flex-wrap:wrap;">
          <div class="panel-title">🧠 Water Potability Intelligence</div>
          <div style="display:flex;gap:8px;align-items:center;flex-wrap:wrap;">
            <span class="badge ${potabilityBadge}">${hybrid.label || 'Unknown'}</span>
            <span class="badge ${diseaseBadge}">Disease Risk: ${diseaseRisk.overall || 'Low'}</span>
          </div>
        </div>
        <div class="panel-body">
          <div class="kpi-row" style="grid-template-columns:repeat(4,minmax(140px,1fr));gap:10px;margin-bottom:12px;">
            <div class="kpi" style="padding:12px;">
              <div class="kpi-label">Hybrid Potability Score</div>
              <div class="kpi-value">${hybrid.score ?? '--'}</div>
              <div class="kpi-sub">Class: ${hybrid.binaryClass === 1 ? '1 (Potable)' : '0 (Non-potable)'}</div>
            </div>
            <div class="kpi" style="padding:12px;">
              <div class="kpi-label">Fuzzy (Mamdani)</div>
              <div class="kpi-value">${fuzzy.score ?? '--'}</div>
              <div class="kpi-sub">Confidence: ${fuzzy.confidence ?? '--'}</div>
            </div>
            <div class="kpi" style="padding:12px;">
              <div class="kpi-label">ML Potability Score</div>
              <div class="kpi-value">${ml.score ?? '--'}</div>
              <div class="kpi-sub">Accuracy: ${ml.accuracy ?? '--'}${ml.accuracy ? '%' : ''}</div>
            </div>
            <div class="kpi" style="padding:12px;">
              <div class="kpi-label">Out-of-Range Params</div>
              <div class="kpi-value">${outOfRangeCount}</div>
              <div class="kpi-sub">High severity: ${highSeverityCount}</div>
            </div>
          </div>

          <div style="display:grid;grid-template-columns:1.2fr 1fr;gap:10px;">
            <div style="background:var(--surface-2);border:1px solid var(--border);border-radius:10px;padding:10px;">
              <div style="font-size:12px;color:var(--text-3);margin-bottom:8px;">Range-Based Assessment</div>
              ${ranges.length ? ranges.map((item) => `
                <div style="display:flex;justify-content:space-between;align-items:center;padding:6px 0;border-bottom:1px solid var(--border);font-size:12px;">
                  <div>
                    <strong>${item.label}</strong>
                    <span style="color:var(--text-3);"> (${item.safeMin}-${item.safeMax} ${item.unit || ''})</span>
                  </div>
                  <div style="font-weight:700;color:${item.status === 'in_range' ? 'var(--green)' : 'var(--red)'};">
                    ${item.value} ${item.unit || ''}
                  </div>
                </div>
              `).join('') : '<div style="font-size:12px;color:var(--text-3);">No range data available.</div>'}
            </div>

            <div style="background:var(--surface-2);border:1px solid var(--border);border-radius:10px;padding:10px;">
              <div style="font-size:12px;color:var(--text-3);margin-bottom:8px;">Disease Signals & Recommendations</div>
              ${(Array.isArray(diseaseRisk.conditions) && diseaseRisk.conditions.length)
                ? diseaseRisk.conditions.map((condition) => `
                  <div style="padding:6px 0;border-bottom:1px solid var(--border);">
                    <div style="font-size:12px;font-weight:700;">${condition.name}</div>
                    <div style="font-size:11px;color:var(--text-3);">Likelihood: ${condition.likelihood} · Trigger: ${condition.trigger}</div>
                    <div style="font-size:11px;color:var(--text-3);">${(condition.diseases || []).join(', ')}</div>
                  </div>
                `).join('')
                : '<div style="font-size:12px;color:var(--green);">No disease trigger detected for current ranges.</div>'}
              <div style="margin-top:8px;font-size:11px;color:var(--text-3);line-height:1.5;">
                ${(Array.isArray(diseaseRisk.recommendations) && diseaseRisk.recommendations.length)
                  ? diseaseRisk.recommendations.slice(0, 2).map((tip) => `• ${tip}`).join('<br>')
                  : '• Continue routine monitoring and periodic treatment checks.'}
              </div>
            </div>
          </div>

          <div style="margin-top:10px;font-size:11px;color:var(--text-3);">
            Recommended Use: <strong>${hybrid.recommendedUse || 'No recommendation available'}</strong>
            ${potability.updatedAt ? ` · Updated: ${new Date(potability.updatedAt).toLocaleString()}` : ''}
          </div>
        </div>
      </div>

      <div class="grid-2">
        <div class="panel">
          <div class="panel-header">
            <div class="panel-title">📊 24-Hour Parameter Trends</div>
            <div class="chart-tabs">
              <button class="chart-tab active">pH</button>
              <button class="chart-tab">Turbidity</button>
              <button class="chart-tab">Chlorine</button>
              <button class="chart-tab">DO</button>
            </div>
          </div>
          <div class="panel-body">
            <div class="trend-chart">
              <svg viewBox="0 0 600 200" style="width:100%;height:200px">
                <defs>
                  <linearGradient id="trendGradient" x1="0%" y1="0%" x2="0%" y2="100%">
                    <stop offset="0%" style="stop-color:var(--blue);stop-opacity:0.2" />
                    <stop offset="100%" style="stop-color:var(--blue);stop-opacity:0" />
                  </linearGradient>
                </defs>
                <path d="M 0 120 L 50 115 L 100 125 L 150 118 L 200 122 L 250 120 L 300 115 L 350 125 L 400 120 L 450 118 L 500 122 L 550 125 L 600 120" 
                      fill="url(#trendGradient)" stroke="none"/>
                <path d="M 0 120 L 50 115 L 100 125 L 150 118 L 200 122 L 250 120 L 300 115 L 350 125 L 400 120 L 450 118 L 500 122 L 550 125 L 600 120" 
                      fill="none" stroke="var(--blue)" stroke-width="2"/>
                <line x1="0" y1="100" x2="600" y2="100" stroke="var(--red)" stroke-width="1" stroke-dasharray="5,5" opacity="0.5"/>
                <line x1="0" y1="140" x2="600" y2="140" stroke="var(--red)" stroke-width="1" stroke-dasharray="5,5" opacity="0.5"/>
              </svg>
              <div class="chart-legend-bottom">
                <span style="color:var(--blue)">— Sensor reading</span>
                <span style="color:var(--red)">--- Upper threshold</span>
                <span style="color:var(--red)">--- Lower threshold</span>
              </div>
            </div>
          </div>
        </div>

        <div class="panel">
          <div class="panel-header">
            <div class="panel-title">🔴 Live Sensor Status</div>
            <span class="badge badge-green">● LIVE</span>
          </div>
          <div class="panel-body">
            <div class="live-sensors">
              <div class="live-sensor">
                <div class="ls-header">
                  <span class="ls-name">pH Level</span>
                  <span class="ls-value">${waterQuality.ph}</span>
                </div>
                <div class="ls-bar">
                  <div class="ls-fill" style="width:${(waterQuality.ph / 14) * 100}%;background:var(--green)"></div>
                  <div class="ls-marker" style="left:46.4%"></div>
                  <div class="ls-marker" style="left:60.7%"></div>
                </div>
                <div class="ls-range">min 6.5 · max 8.5</div>
              </div>

              <div class="live-sensor">
                <div class="ls-header">
                  <span class="ls-name">Turbidity (NTU)</span>
                  <span class="ls-value">3.8</span>
                </div>
                <div class="ls-bar">
                  <div class="ls-fill" style="width:95%;background:var(--amber)"></div>
                  <div class="ls-marker" style="left:100%"></div>
                </div>
                <div class="ls-range">max 4 · <span style="color:var(--amber)">⚠ Near limit</span></div>
              </div>

              <div class="live-sensor">
                <div class="ls-header">
                  <span class="ls-name">Chlorine (mg/L)</span>
                  <span class="ls-value" style="color:var(--red)">0.18 ⚠</span>
                </div>
                <div class="ls-bar">
                  <div class="ls-fill" style="width:4.5%;background:var(--red)"></div>
                  <div class="ls-marker" style="left:5%"></div>
                  <div class="ls-marker" style="left:100%"></div>
                </div>
                <div class="ls-range">min 0.2 · max 4.0 · <span style="color:var(--red)">Below minimum</span></div>
              </div>

              <div class="live-sensor">
                <div class="ls-header">
                  <span class="ls-name">Dissolved O₂ (mg/L)</span>
                  <span class="ls-value">8.4</span>
                </div>
                <div class="ls-bar">
                  <div class="ls-fill" style="width:28%;background:var(--green)"></div>
                  <div class="ls-marker" style="left:58.3%"></div>
                  <div class="ls-marker" style="left:100%"></div>
                </div>
                <div class="ls-range">min 7.0 · max 12.0</div>
              </div>
            </div>
          </div>
        </div>
      </div>

      <div class="grid-2">
        <div class="panel">
          <div class="panel-header">
            <div class="panel-title">🗺️ Zone Quality Heatmap</div>
            <span class="panel-meta">${zoneQuality.zones.length} ZONES</span>
          </div>
          <div class="panel-body">
            <div class="zone-heatmap">
              ${zoneQuality.zones.map(zone => `
                <div class="zone-cell zone-${zone.status}">
                  <div class="zone-id">${zone.id}</div>
                  <div class="zone-wqi">${zone.wqi}</div>
                </div>
              `).join('')}
            </div>
            <div class="heatmap-legend">
              <div class="hl-item"><div class="hl-dot" style="background:var(--green)"></div> Good (80-100)</div>
              <div class="hl-item"><div class="hl-dot" style="background:var(--amber)"></div> Fair (60-79)</div>
              <div class="hl-item"><div class="hl-dot" style="background:var(--red)"></div> Poor (<60)</div>
            </div>
          </div>
        </div>

        <div class="panel">
          <div class="panel-header">
            <div class="panel-title">⚠️ Quality Alerts Log</div>
            <span class="badge badge-red">${zoneQuality.alerts.filter(a => a.severity === 'critical').length} ACTIVE</span>
          </div>
          <div class="panel-body">
            <div class="alerts-log">
              ${zoneQuality.alerts.map(alert => `
                <div class="alert-log-item alert-${alert.severity}">
                  <div class="alert-dot"></div>
                  <div class="alert-content">
                    <div class="alert-log-title">${alert.title}</div>
                    <div class="alert-log-meta">${alert.time} · ${alert.desc}</div>
                  </div>
                </div>
              `).join('')}
            </div>
          </div>
        </div>
      </div>
    `;
  }

  renderLeaks() {
    const { leaks, pipelineIntegrity } = this.data;
    const totalLoss = leaks.reduce((sum, l) => sum + l.flow, 0);
    const avgDetectionTime = 2.4;
    const mlAccuracy = 96.1;
    
    return `
      <div class="kpi-row">
        <div class="kpi">
          <div class="kpi-header">
            <div class="kpi-ico" style="background:var(--red-light);color:var(--red)">
              <svg viewBox="0 0 24 24"><circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="12"/></svg>
            </div>
            <span class="kpi-trend trend-down">● ${leaks.filter(l => l.severity === 'critical').length} CRITICAL</span>
          </div>
          <div class="kpi-label">Active Leaks</div>
          <div class="kpi-value">${leaks.length}</div>
          <div class="kpi-sub" style="color:var(--red)">${leaks.filter(l => l.severity === 'critical').length} critical incidents</div>
        </div>

        <div class="kpi">
          <div class="kpi-header">
            <div class="kpi-ico" style="background:var(--amber-light);color:var(--amber)">
              <svg viewBox="0 0 24 24"><path d="M4 15s1-1 4-1 5 2 8 2 4-1 4-1V3s-1 1-4 1-5-2-8-2-4 1-4 1z"/></svg>
            </div>
            <span class="kpi-trend trend-down">▼ +0.3</span>
          </div>
          <div class="kpi-label">Total Loss Rate</div>
          <div class="kpi-value">${totalLoss.toFixed(1)}<span style="font-size:14px;font-weight:500;color:var(--text-3)"> L/min</span></div>
          <div class="kpi-sub">8.1% supply capacity</div>
        </div>

        <div class="kpi">
          <div class="kpi-header">
            <div class="kpi-ico" style="background:var(--blue-light);color:var(--blue)">
              <svg viewBox="0 0 24 24"><circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/></svg>
            </div>
            <span class="kpi-trend trend-up">AVG 2m</span>
          </div>
          <div class="kpi-label">Avg Detection Time</div>
          <div class="kpi-value">${avgDetectionTime}<span style="font-size:14px;font-weight:500;color:var(--text-3)"> min</span></div>
          <div class="kpi-sub">Within SLA 4.5 min</div>
        </div>

        <div class="kpi">
          <div class="kpi-header">
            <div class="kpi-ico" style="background:var(--green-light);color:var(--green)">
              <svg viewBox="0 0 24 24"><path d="M22 11.08V12a10 10 0 1 1-5.93-9.14"/><polyline points="22 4 12 14.01 9 11.01"/></svg>
            </div>
            <span class="kpi-trend trend-up">▲ 4.2%</span>
          </div>
          <div class="kpi-label">ML Accuracy</div>
          <div class="kpi-value">${mlAccuracy}<span style="font-size:14px;font-weight:500;color:var(--text-3)">%</span></div>
          <div class="kpi-sub">Last 90 days</div>
        </div>
      </div>

      <div class="grid-2">
        <div class="panel">
          <div class="panel-header">
            <div class="panel-title">⚠️ Active Leak Events</div>
            <span class="badge badge-red">${leaks.filter(l => l.severity === 'critical').length} ACTIVE</span>
          </div>
          <div class="panel-body">
            <div class="leak-table">
              <div class="leak-table-header">
                <div class="lt-col">NODE</div>
                <div class="lt-col">SECTOR</div>
                <div class="lt-col">LOSS</div>
                <div class="lt-col">CONF.</div>
                <div class="lt-col">STATUS</div>
              </div>
              ${leaks.map(leak => `
                <div class="leak-table-row leak-row-${leak.severity}">
                  <div class="lt-col lt-node">${leak.node}</div>
                  <div class="lt-col">${leak.zone}</div>
                  <div class="lt-col lt-loss">${leak.flow} L/m</div>
                  <div class="lt-col">${leak.confidence}%</div>
                  <div class="lt-col">
                    <span class="leak-badge badge-${leak.severity}">${leak.severity.toUpperCase()}</span>
                  </div>
                </div>
              `).join('')}
            </div>
            <div class="panel-actions">
              <button class="btn btn-primary" onclick="app.dispatchAllLeaks()">Dispatch All Teams</button>
              <button class="btn btn-ghost">Export Report</button>
            </div>
          </div>
        </div>

        <div class="panel">
          <div class="panel-header">
            <div class="panel-title">📈 Pressure Wave Analysis</div>
            <span class="panel-meta">N-047</span>
          </div>
          <div class="panel-body">
            <div class="pressure-chart">
              <svg viewBox="0 0 600 180" style="width:100%;height:180px">
                <defs>
                  <linearGradient id="pressureGradient" x1="0%" y1="0%" x2="0%" y2="100%">
                    <stop offset="0%" style="stop-color:var(--blue);stop-opacity:0.3" />
                    <stop offset="100%" style="stop-color:var(--blue);stop-opacity:0" />
                  </linearGradient>
                </defs>
                <path d="M 0 80 L 100 75 L 200 78 L 300 72 L 350 45 L 400 40 L 450 38 L 500 35 L 550 32 L 600 30" 
                      fill="url(#pressureGradient)" stroke="none"/>
                <path d="M 0 80 L 100 75 L 200 78 L 300 72 L 350 45 L 400 40 L 450 38 L 500 35 L 550 32 L 600 30" 
                      fill="none" stroke="var(--blue)" stroke-width="2.5"/>
                <line x1="0" y1="90" x2="600" y2="90" stroke="var(--red)" stroke-width="1" stroke-dasharray="5,5" opacity="0.6"/>
                <circle cx="350" cy="45" r="5" fill="var(--red)"/>
                <text x="350" y="25" text-anchor="middle" font-size="10" fill="var(--red)" font-weight="600">Anomaly detected</text>
              </svg>
              <div class="chart-legend-bottom">
                <span style="color:var(--blue)">— Pressure (bar)</span>
                <span style="color:var(--red)">--- Anomaly threshold</span>
              </div>
            </div>
          </div>
        </div>
      </div>

      <div class="panel">
        <div class="panel-header">
          <div class="panel-title">🔍 ML Detection Confidence</div>
          <span class="panel-meta">${leaks.length} segments monitored</span>
        </div>
        <div class="panel-body">
          <div class="confidence-bars">
            ${leaks.map(leak => `
              <div class="conf-bar-item">
                <div class="conf-bar-header">
                  <span class="conf-bar-label">${leak.node}</span>
                  <span class="conf-bar-value">${leak.confidence}%</span>
                </div>
                <div class="conf-bar-track">
                  <div class="conf-bar-fill" style="width:${leak.confidence}%;background:${leak.confidence > 90 ? 'var(--green)' : leak.confidence > 75 ? 'var(--amber)' : 'var(--red)'}"></div>
                </div>
              </div>
            `).join('')}
          </div>
        </div>
      </div>

      <div class="panel">
        <div class="panel-header">
          <div class="panel-title">🏗️ Pipeline Integrity Scores</div>
          <span class="panel-meta">${pipelineIntegrity.monitored} segments monitored</span>
        </div>
        <div class="panel-body">
          <div class="integrity-grid">
            ${pipelineIntegrity.segments.map(seg => `
              <div class="integrity-cell integrity-${seg.status}">
                <div class="int-id">${seg.id}</div>
                <div class="int-score">${seg.score}</div>
              </div>
            `).join('')}
          </div>
          <div class="integrity-legend">
            <div class="il-item"><div class="il-dot" style="background:var(--green)"></div> Good (80+)</div>
            <div class="il-item"><div class="il-dot" style="background:var(--amber)"></div> Fair (60-79)</div>
            <div class="il-item"><div class="il-dot" style="background:var(--red)"></div> Critical (<60)</div>
          </div>
        </div>
      </div>
    `;
  }

  renderNetwork() {
    const { network } = this.data;
    
    return `
      <div class="gis-container" style="width:100%;height:100%;display:flex;flex-direction:column;gap:0;">
        <div class="panel" style="flex:1;display:flex;flex-direction:column;margin:0;">
          <div class="panel-header">
            <div class="panel-title">🗺️ Network Map (GIS Integration)</div>
            <span class="badge badge-blue">● LIVE DATA</span>
          </div>
          <div class="panel-body" style="flex:1;padding:0;overflow:hidden;">
            <iframe 
              src="/gis/index.html" 
              style="width:100%;height:600px;border:none;border-radius:8px;background:#f5f5f5;"
              title="GIS Network Map"
              id="gis-iframe">
            </iframe>
          </div>
        </div>

        <div class="panel" style="margin-top:20px;">
          <div class="panel-header">
            <div class="panel-title">Network Nodes Status</div>
            <span class="panel-meta">${network.nodes.length} NODES</span>
          </div>
          <div class="panel-body">
            <div style="display:grid;grid-template-columns:repeat(auto-fit,minmax(150px,1fr));gap:12px;" id="network-nodes-container">
              ${network.nodes.map(node => `
                <div class="node-info" data-node-id="${node.id}" style="padding:12px;background:var(--surface-2);border-radius:6px;border-left:3px solid ${node.status === 'active' ? 'var(--green)' : node.status === 'warning' ? 'var(--amber)' : 'var(--red)'};cursor:pointer;transition:0.2s;">
                  <div style="font-weight:600;color:var(--text-1);margin-bottom:6px;">${node.id}</div>
                  <div style="font-size:12px;color:var(--text-3);line-height:1.6;">
                    <div>📍 Zone: ${node.zone}</div>
                    <div>⚡ Pressure: <strong class="node-pressure">${node.pressure} bar</strong></div>
                    <div>💧 Flow: <span class="node-flow">${node.flow}</span> L/min</div>
                    <div style="margin-top:6px;padding-top:6px;border-top:1px solid var(--border);">
                      <span class="node-status-badge" style="display:inline-block;background:${node.status === 'active' ? 'var(--green-light)' : node.status === 'warning' ? 'var(--amber-light)' : 'var(--red-light)'};color:${node.status === 'active' ? 'var(--green)' : node.status === 'warning' ? 'var(--amber)' : 'var(--red)'};padding:2px 6px;border-radius:3px;font-size:11px;font-weight:600;">
                        ${node.status.toUpperCase()}
                      </span>
                    </div>
                  </div>
                </div>
              `).join('')}
            </div>
          </div>
        </div>
      </div>
    `;
  }

  updateNetworkNodeStatus() {
    const { network } = this.data;
    network.nodes.forEach(node => {
      const nodeElement = document.querySelector(`[data-node-id="${node.id}"]`);
      if (nodeElement) {
        nodeElement.querySelector('.node-pressure').textContent = `${node.pressure} bar`;
        nodeElement.querySelector('.node-flow').textContent = node.flow;
        const statusBadge = nodeElement.querySelector('.node-status-badge');
        const statusColor = node.status === 'active' ? 'var(--green)' : node.status === 'warning' ? 'var(--amber)' : 'var(--red)';
        const statusBgColor = node.status === 'active' ? 'var(--green-light)' : node.status === 'warning' ? 'var(--amber-light)' : 'var(--red-light)';
        statusBadge.style.color = statusColor;
        statusBadge.style.background = statusBgColor;
        statusBadge.textContent = node.status.toUpperCase();
        nodeElement.style.borderLeftColor = statusColor;
      }
    });
  }

  updateIrrigationMoisture() {
    const { irrigation } = this.data;
    irrigation.zones.forEach(zone => {
      const zoneElement = document.querySelector(`[data-zone-id="${zone.id}"]`);
      if (zoneElement) {
        const moistureValue = zoneElement.querySelector('.zone-moisture-value');
        const moistureFill = zoneElement.querySelector('.moisture-fill');
        if (moistureValue) moistureValue.textContent = `${this.formatNumber(zone.soilMoisture, 2)}%`;
        if (moistureFill) {
          moistureFill.style.width = `${zone.soilMoisture}%`;
          moistureFill.style.background = zone.soilMoisture < zone.threshold ? 'var(--red)' : 'var(--green)';
        }
      }
    });
  }

  exportData() {
    const dataStr = JSON.stringify(this.data, null, 2);
    const dataBlob = new Blob([dataStr], { type: 'application/json' });
    const url = URL.createObjectURL(dataBlob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `aquasync-export-${new Date().toISOString()}.json`;
    link.click();
    URL.revokeObjectURL(url);
  }

  renderIrrigation() {
    const { irrigation } = this.data;
    const activeZones = irrigation.zones.filter(z => z.sprinklerStatus === 'active');
    
    return `
      <div class="kpi-row">
        <div class="kpi">
          <div class="kpi-header">
            <div class="kpi-ico" style="background:var(--green-light);color:var(--green)">
              <svg viewBox="0 0 24 24"><path d="M12 2v20M17 7l-5 5-5-5M7 17l5-5 5 5"/></svg>
            </div>
            <span class="kpi-trend trend-up">▲ ${irrigation.totalWaterSaved}L</span>
          </div>
          <div class="kpi-label">Water Saved Today</div>
          <div class="kpi-value">${irrigation.totalWaterSaved}<span style="font-size:14px;font-weight:500;color:var(--text-3)"> L</span></div>
          <div class="kpi-sub" style="color:var(--green)">Smart irrigation active</div>
        </div>

        <div class="kpi">
          <div class="kpi-header">
            <div class="kpi-ico" style="background:var(--blue-light);color:var(--blue)">
              <svg viewBox="0 0 24 24"><circle cx="12" cy="12" r="10"/><path d="M12 6v6l4 2"/></svg>
            </div>
            <span class="kpi-trend" style="background:var(--blue-light);color:var(--blue)">● ${irrigation.activeZones} ACTIVE</span>
          </div>
          <div class="kpi-label">Active Zones</div>
          <div class="kpi-value">${irrigation.activeZones}<span style="font-size:14px;font-weight:500;color:var(--text-3)"> / ${irrigation.zones.length}</span></div>
          <div class="kpi-sub">${irrigation.scheduledZones} scheduled</div>
        </div>

        <div class="kpi">
          <div class="kpi-header">
            <div class="kpi-ico" style="background:var(--amber-light);color:var(--amber)">
              <svg viewBox="0 0 24 24"><path d="M12 2L2 7l10 5 10-5-10-5z"/><path d="M2 17l10 5 10-5M2 12l10 5 10-5"/></svg>
            </div>
            <span class="kpi-trend trend-warn">AVG ${Math.round(irrigation.zones.reduce((a,z) => a + z.soilMoisture, 0) / irrigation.zones.length)}%</span>
          </div>
          <div class="kpi-label">Soil Moisture</div>
          <div class="kpi-value">${this.formatNumber(irrigation.zones.reduce((a,z) => a + z.soilMoisture, 0) / irrigation.zones.length, 2)}<span style="font-size:14px;font-weight:500;color:var(--text-3)">%</span></div>
          <div class="kpi-sub">Threshold: 30%</div>
        </div>
      </div>

      <div class="panel">
        <div class="panel-header" style="align-items:center;gap:10px;flex-wrap:wrap;display:flex;justify-content:space-between;">
          <div>
            <div class="panel-title">🌱 Irrigation Zones - ${irrigation.mode === 'manual' ? 'Manual' : 'Auto'} Mode</div>
            <div style="font-size:12px;opacity:0.8">Soil moisture readings set: average ${this.formatNumber(irrigation.zones.reduce((a,z) => a + z.soilMoisture, 0) / irrigation.zones.length, 2)}%</div>
          </div>
          <div style="display:flex;gap:8px;margin-top:8px;">
            <button class="btn btn-ghost" onclick="app.setIrrigationMode('auto')" style="padding:6px 12px;border:1px solid var(--border);background:${irrigation.mode === 'auto' ? 'var(--surface-2)' : 'transparent'};font-weight:${irrigation.mode === 'auto' ? '600' : '400'};">Auto</button>
            <button class="btn btn-ghost" onclick="app.setIrrigationMode('manual')" style="padding:6px 12px;border:1px solid var(--border);background:${irrigation.mode === 'manual' ? 'var(--surface-2)' : 'transparent'};font-weight:${irrigation.mode === 'manual' ? '600' : '400'};">Manual</button>
          </div>
          <span class="badge ${irrigation.mode === 'manual' ? 'badge-amber' : 'badge-green'}">${irrigation.mode === 'manual' ? 'MANUAL' : 'SMART'}</span>
        </div>
        <div class="panel-body">
          <div class="grid-3">
            ${irrigation.zones.map(zone => `
              <div class="irrigation-card ${zone.sprinklerStatus === 'active' ? 'active' : ''}" data-zone-id="${zone.id}">
                <div class="irr-header">
                  <div class="irr-name">${zone.name}</div>
                  <div class="irr-status status-${zone.sprinklerStatus === 'active' ? 'active' : zone.sprinklerStatus === 'scheduled' ? 'scheduled' : 'idle'}">
                    ${zone.sprinklerStatus === 'active' ? '💧 WATERING' : zone.sprinklerStatus === 'scheduled' ? '⏰ SCHEDULED' : '✓ IDLE'}
                  </div>
                </div>
                <div class="irr-moisture">
                  <div class="irr-label">Soil Moisture</div>
                  <div class="irr-value zone-moisture-value">${this.formatNumber(zone.soilMoisture, 2)}%</div>
                  <div class="moisture-bar">
                    <div class="moisture-fill" style="width:${zone.soilMoisture}%;background:${zone.soilMoisture < zone.threshold ? 'var(--red)' : 'var(--green)'}"></div>
                    <div class="moisture-threshold" style="left:${zone.threshold}%"></div>
                  </div>
                  <div class="irr-threshold">Threshold: ${zone.threshold}%</div>
                </div>
                <div class="irr-stats">
                  <div class="irr-stat">
                    <span class="stat-label">Water Used</span>
                    <span class="stat-value">${zone.waterUsed}L</span>
                  </div>
                  <div class="irr-stat">
                    <span class="stat-label">Duration</span>
                    <span class="stat-value">${zone.duration}</span>
                  </div>
                </div>
                <div class="irr-last">Last watered: ${zone.lastWatered}</div>
                ${irrigation.mode === 'manual' ? `
                  <div class="zone-control-row" style="margin-top:12px;display:flex;gap:6px;flex-wrap:wrap;">
                    <button class="btn" style="flex:1;min-width:70px;padding:10px 12px;background:${zone.sprinklerStatus === 'active' ? 'var(--green)' : 'var(--surface-2)'};color:${zone.sprinklerStatus === 'active' ? 'white' : 'var(--text-1)'};border:2px solid var(--green);border-radius:6px;cursor:pointer;font-weight:700;font-size:12px;transition:0.2s;" onclick="app.toggleIrrigationZone('${zone.id}','start')">▶ START</button>
                    <button class="btn" style="flex:1;min-width:70px;padding:10px 12px;background:${zone.sprinklerStatus === 'idle' ? 'var(--red)' : 'var(--surface-2)'};color:${zone.sprinklerStatus === 'idle' ? 'white' : 'var(--text-1)'};border:2px solid var(--red);border-radius:6px;cursor:pointer;font-weight:700;font-size:12px;transition:0.2s;" onclick="app.toggleIrrigationZone('${zone.id}','stop')">⏹ STOP</button>
                  </div>
                ` : `
                  <div class="zone-control-row" style="margin-top:12px;padding:10px;background:var(--surface-2);border-radius:6px;text-align:center;font-size:12px;color:var(--text-3);">
                    🔒 Auto mode - Manual controls disabled
                  </div>
                `}
              </div>
            `).join('')}
          </div>
        </div>
      </div>

      <div class="panel">
        <div class="panel-header">
          <div class="panel-title">💡 Smart Irrigation Logic</div>
        </div>
        <div class="panel-body">
          <div class="logic-flow">
            <div class="logic-step">
              <div class="logic-icon" style="background:var(--blue-light);color:var(--blue)">1</div>
              <div class="logic-content">
                <div class="logic-title">Sense</div>
                <div class="logic-desc">Soil moisture sensors continuously monitor moisture levels</div>
              </div>
            </div>
            <div class="logic-arrow">→</div>
            <div class="logic-step">
              <div class="logic-icon" style="background:var(--amber-light);color:var(--amber)">2</div>
              <div class="logic-content">
                <div class="logic-title">Analyze</div>
                <div class="logic-desc">Compare readings against 30% threshold</div>
              </div>
            </div>
            <div class="logic-arrow">→</div>
            <div class="logic-step">
              <div class="logic-icon" style="background:var(--green-light);color:var(--green)">3</div>
              <div class="logic-content">
                <div class="logic-title">Act</div>
                <div class="logic-desc">Auto-activate sprinklers when moisture < threshold</div>
              </div>
            </div>
            <div class="logic-arrow">→</div>
            <div class="logic-step">
              <div class="logic-icon" style="background:var(--purple-light);color:var(--purple)">4</div>
              <div class="logic-content">
                <div class="logic-title">Optimize</div>
                <div class="logic-desc">Stop when moisture reaches optimal level (40%)</div>
              </div>
            </div>
          </div>
        </div>
      </div>
    `;
  }

  renderHardware() {
    const { hardware } = this.data;
    
    return `
      <div class="kpi-row">
        <div class="kpi">
          <div class="kpi-header">
            <div class="kpi-ico" style="background:var(--green-light);color:var(--green)">
              <svg viewBox="0 0 24 24"><rect x="2" y="7" width="20" height="14" rx="2"/></svg>
            </div>
            <span class="kpi-trend trend-up">● ONLINE</span>
          </div>
          <div class="kpi-label">ESP32 Controller</div>
          <div class="kpi-value">${hardware.esp32.signalStrength}<span style="font-size:14px;font-weight:500;color:var(--text-3)"> dBm</span></div>
          <div class="kpi-sub" style="color:var(--green)">Uptime: ${hardware.esp32.uptime}</div>
        </div>

        <div class="kpi">
          <div class="kpi-header">
            <div class="kpi-ico" style="background:var(--blue-light);color:var(--blue)">
              <svg viewBox="0 0 24 24"><path d="M16 21V5a2 2 0 0 0-2-2h-4a2 2 0 0 0-2 2v16"/></svg>
            </div>
            <span class="kpi-trend trend-up">● ACTIVE</span>
          </div>
          <div class="kpi-label">Arduino Sensors</div>
          <div class="kpi-value">${hardware.arduino.sensors}<span style="font-size:14px;font-weight:500;color:var(--text-3)"> sensors</span></div>
          <div class="kpi-sub" style="color:var(--green)">All operational</div>
        </div>

        <div class="kpi">
          <div class="kpi-header">
            <div class="kpi-ico" style="background:var(--teal-light);color:var(--teal)">
              <svg viewBox="0 0 24 24"><circle cx="12" cy="12" r="3"/><path d="M12 1v6m0 6v6M5.64 5.64l4.24 4.24m4.24 4.24l4.24 4.24M1 12h6m6 0h6M5.64 18.36l4.24-4.24m4.24-4.24l4.24-4.24"/></svg>
            </div>
            <span class="kpi-trend trend-up">98.2%</span>
          </div>
          <div class="kpi-label">Sensor Accuracy</div>
          <div class="kpi-value">98.2<span style="font-size:14px;font-weight:500;color:var(--text-3)">%</span></div>
          <div class="kpi-sub">Average across all sensors</div>
        </div>
      </div>

      <div class="grid-2">
        <div class="panel">
          <div class="panel-header">
            <div class="panel-title">📡 Sensor Status</div>
          </div>
          <div class="panel-body">
            <div class="sensor-grid">
              ${Object.entries(hardware.sensors).map(([key, sensor]) => `
                <div class="sensor-card">
                  <div class="sensor-header">
                    <div class="sensor-name">${key.replace(/([A-Z])/g, ' $1').toUpperCase()}</div>
                    <div class="sensor-status status-${sensor.status === 'active' ? 'ok' : 'bad'}">${sensor.status === 'active' ? '● ACTIVE' : '● OFFLINE'}</div>
                  </div>
                  <div class="sensor-reading">${sensor.reading} <span class="sensor-unit">${sensor.unit}</span></div>
                  <div class="sensor-accuracy">Accuracy: ${sensor.accuracy}%</div>
                  <div class="sensor-bar">
                    <div class="sensor-fill" style="width:${sensor.accuracy}%;background:var(--green)"></div>
                  </div>
                </div>
              `).join('')}
            </div>
          </div>
        </div>

        <div class="panel">
          <div class="panel-header">
            <div class="panel-title">⚙️ Actuators & Controls</div>
          </div>
          <div class="panel-body">
            <div class="actuator-list">
              <div class="actuator-item">
                <div class="act-icon" style="background:var(--green-light);color:var(--green)">
                  <svg viewBox="0 0 24 24" width="20" height="20"><circle cx="12" cy="12" r="3"/><path d="M12 1v6m0 6v6"/></svg>
                </div>
                <div class="act-info">
                  <div class="act-name">Main Water Pump</div>
                  <div class="act-status">Status: <span style="color:var(--green);font-weight:600">${hardware.actuators.mainPump.status.toUpperCase()}</span></div>
                  <div class="act-meta">Power: ${hardware.actuators.mainPump.power}kW · Cycles: ${hardware.actuators.mainPump.cycles}</div>
                </div>
                <button class="btn-control btn-green" onclick="app.controlMainPump()">Control</button>
              </div>

              <div class="actuator-item">
                <div class="act-icon" style="background:var(--blue-light);color:var(--blue)">
                  <svg viewBox="0 0 24 24" width="20" height="20"><path d="M12 2v20M17 7l-5 5-5-5"/></svg>
                </div>
                <div class="act-info">
                  <div class="act-name">Sprinkler System</div>
                  <div class="act-status">Active: <span style="color:var(--blue);font-weight:600">${hardware.actuators.sprinklers.active}/${hardware.actuators.sprinklers.total}</span></div>
                  <div class="act-meta">Flow: ${hardware.actuators.sprinklers.waterFlow}L/min</div>
                </div>
                <button class="btn-control btn-blue" onclick="app.controlSprinklers()">Control</button>
              </div>

              <div class="actuator-item">
                <div class="act-icon" style="background:var(--red-light);color:var(--red)">
                  <svg viewBox="0 0 24 24" width="20" height="20"><path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z"/></svg>
                </div>
                <div class="act-info">
                  <div class="act-name">Alert Buzzer</div>
                  <div class="act-status">Status: <span style="color:var(--red);font-weight:600">${hardware.actuators.buzzer.status.toUpperCase()}</span></div>
                  <div class="act-meta">Alerts: ${hardware.actuators.buzzer.alerts} · Last: ${hardware.actuators.buzzer.lastTriggered}</div>
                </div>
                <button class="btn-control btn-red" onclick="app.silenceBuzzer()">Silence</button>
              </div>

              <div class="actuator-item">
                <div class="act-icon" style="background:var(--amber-light);color:var(--amber)">
                  <svg viewBox="0 0 24 24" width="20" height="20"><rect x="3" y="11" width="18" height="11" rx="2"/><path d="M7 11V7a5 5 0 0 1 10 0v4"/></svg>
                </div>
                <div class="act-info">
                  <div class="act-name">Control Valves</div>
                  <div class="act-status">Open: <span style="color:var(--green);font-weight:600">${hardware.actuators.valves.open}</span> · Closed: <span style="color:var(--red);font-weight:600">${hardware.actuators.valves.closed}</span></div>
                  <div class="act-meta">Total: ${hardware.actuators.valves.total} valves</div>
                </div>
                <button class="btn-control btn-amber" onclick="app.manageValves()">Manage</button>
              </div>
            </div>
          </div>
        </div>
      </div>

      <div class="panel">
        <div class="panel-header">
          <div class="panel-title">🔌 Hardware Architecture</div>
        </div>
        <div class="panel-body">
          <div class="hw-diagram">
            <div class="hw-layer">
              <div class="hw-title">Sensing Layer</div>
              <div class="hw-components">
                <div class="hw-comp">Flow Sensor</div>
                <div class="hw-comp">pH Sensor</div>
                <div class="hw-comp">TDS Sensor</div>
                <div class="hw-comp">Soil Moisture</div>
                <div class="hw-comp">Pressure Sensor</div>
              </div>
            </div>
            <div class="hw-arrow">↓</div>
            <div class="hw-layer">
              <div class="hw-title">Processing Layer</div>
              <div class="hw-components">
                <div class="hw-comp hw-main">Arduino Uno</div>
                <div class="hw-comp hw-main">ESP32</div>
              </div>
            </div>
            <div class="hw-arrow">↓</div>
            <div class="hw-layer">
              <div class="hw-title">Control Layer</div>
              <div class="hw-components">
                <div class="hw-comp">Water Pump</div>
                <div class="hw-comp">Sprinklers</div>
                <div class="hw-comp">Buzzer</div>
                <div class="hw-comp">Valves</div>
              </div>
            </div>
            <div class="hw-arrow">↓</div>
            <div class="hw-layer">
              <div class="hw-title">Cloud Layer</div>
              <div class="hw-components">
                <div class="hw-comp hw-cloud">Backend API</div>
                <div class="hw-comp hw-cloud">WebSocket</div>
                <div class="hw-comp hw-cloud">Dashboard</div>
              </div>
            </div>
          </div>
        </div>
      </div>
    `;
  }

  renderAnalytics() {
    const { analytics } = this.data;

    return `
      <div class="kpi-row">
        <div class="kpi">
          <div class="kpi-header">
            <div class="kpi-ico" style="background:var(--green-light);color:var(--green)"><svg viewBox="0 0 24 24"><path d="M22 11.08V12a10 10 0 1 1-5.93-9.14"/><polyline points="22 4 12 14.01 9 11.01"/></svg></div>
            <span class="kpi-trend trend-up">${analytics.waterSavings.percentage}%</span>
          </div>
          <div class="kpi-label">Water Savings (Month)</div>
          <div class="kpi-value">${analytics.waterSavings.month}<span style="font-size:14px;font-weight:500;color:var(--text-3)"> kL</span></div>
          <div class="kpi-sub">Today ${analytics.waterSavings.today}% saved</div>
        </div>

        <div class="kpi">
          <div class="kpi-header">
            <div class="kpi-ico" style="background:var(--blue-light);color:var(--blue)"><svg viewBox="0 0 24 24"><path d="M12 20V10M18 20V4M6 20v-4"/></svg></div>
            <span class="kpi-trend trend-up">${analytics.leakPrevention.prevented}/${analytics.leakPrevention.detected}</span>
          </div>
          <div class="kpi-label">Leak Prevention</div>
          <div class="kpi-value">${analytics.leakPrevention.prevented}<span style="font-size:14px;font-weight:500;color:var(--text-3)"> events</span></div>
          <div class="kpi-sub">Saved ${analytics.leakPrevention.savedLiters} L</div>
        </div>

        <div class="kpi">
          <div class="kpi-header">
            <div class="kpi-ico" style="background:var(--purple-light);color:var(--purple)"><svg viewBox="0 0 24 24"><path d="M16 21V5a2 2 0 0 0-2-2h-4a2 2 0 0 0-2 2v16"/></svg></div>
            <span class="kpi-trend trend-up">${analytics.efficiency.overall}%</span>
          </div>
          <div class="kpi-label">Overall Efficiency</div>
          <div class="kpi-value">${analytics.efficiency.overall}<span style="font-size:14px;font-weight:500;color:var(--text-3)">%</span></div>
          <div class="kpi-sub">Distribution ${analytics.efficiency.distribution}%</div>
        </div>
      </div>

      <div class="panel">
        <div class="panel-header"><div class="panel-title">AI Insights</div></div>
        <div class="panel-body" style="display:flex;flex-direction:column;gap:8px;">
          <div>• Demand spike predicted at 18:00 → plan swing reservoirs.</div>
          <div>• Pump-003 vibration indicates maintenance needed in 72h.</div>
          <div>• Chlorine level low in sectors 4–6; auto-dosing triggered.</div>
          <div>• Turbidity nearing 4 NTU; adjust filtration schedule.</div>
        </div>
      </div>

      <div class="grid-2">
        <div class="panel">
          <div class="panel-header"><div class="panel-title">Performance Trends</div></div>
          <div class="panel-body">
            <div class="efficiency-list">
              <div class="eff-item"><div class="eff-label">Distribution</div><div class="eff-bar-container"><div class="eff-bar"><div class="eff-fill" style="width:${analytics.efficiency.distribution}%;background:var(--green)"></div></div><div class="eff-value">${analytics.efficiency.distribution}%</div></div></div>
              <div class="eff-item"><div class="eff-label">Irrigation</div><div class="eff-bar-container"><div class="eff-bar"><div class="eff-fill" style="width:${analytics.efficiency.irrigation}%;background:var(--blue)"></div></div><div class="eff-value">${analytics.efficiency.irrigation}%</div></div></div>
              <div class="eff-item"><div class="eff-label">Overall</div><div class="eff-bar-container"><div class="eff-bar"><div class="eff-fill" style="width:${analytics.efficiency.overall}%;background:var(--purple)"></div></div><div class="eff-value">${analytics.efficiency.overall}%</div></div></div>
            </div>
          </div>
        </div>

        <div class="panel">
          <div class="panel-header"><div class="panel-title">Actionable Plans</div></div>
          <div class="panel-body">
            <ul style="list-style:none;padding:0;margin:0;line-height:1.5;font-size:13px;color:var(--text-3)">
              <li>• Inject surge pressure relief at N-047 and N-023.</li>
              <li>• Trigger mobile maintenance team for priority pump issues.</li>
              <li>• Raise irrigation thresholds to avoid field overwatering.</li>
              <li>• Show demand ratios to operations crew at 14:00 briefing.</li>
            </ul>
          </div>
        </div>
      </div>
    `;
  }

  renderAIPredictions() {
    const insights = this.data.aiInsights || [];
    const demandForecast = this.data.demandForecast || { dailyForecast: [], modelAccuracy: 0, shortageRisk: {} };

    return `
      <div class="kpi-row">
        <div class="kpi">
          <div class="kpi-header"><div class="kpi-label">Model Accuracy</div></div>
          <div class="kpi-value">${demandForecast.modelAccuracy || 0}%</div>
          <div class="kpi-sub">Forecast confidence</div>
        </div>
        <div class="kpi">
          <div class="kpi-header"><div class="kpi-label">Shortage Risk</div></div>
          <div class="kpi-value">${demandForecast.shortageRisk?.day || 'N/A'}</div>
          <div class="kpi-sub">${demandForecast.shortageRisk?.reason || 'None'}</div>
        </div>
        <div class="kpi">
          <div class="kpi-header"><div class="kpi-label">AI Suggestions</div></div>
          <div class="kpi-value">${insights.length}</div>
          <div class="kpi-sub">Action orders</div>
        </div>
      </div>

      <div class="panel">
        <div class="panel-header"><div class="panel-title">AI Predictions & Prescriptive Actions</div></div>
        <div class="panel-body">
          ${insights.length === 0 ? '<p>No insights available yet.</p>' : insights.map(item => `
            <div class="insight-block" style="margin-bottom:10px;padding:10px;border-radius:8px;border:1px solid var(--border);">
              <div style="font-weight:700;font-size:13px;margin-bottom:4px;">${item.icon} ${item.title}</div>
              <div style="font-size:12px;color:var(--text-3);">${item.desc}</div>
            </div>
          `).join('')}
        </div>
      </div>
    `;
  }

  renderSTP() {
    const { stp } = this.data;
    const automation = this.getSTPAutomation();
    const thingspeak = this.data?.integrations?.thingspeak;
    const inflow = Number(stp.inflow || 0);
    const outflow = Number(stp.outflow || 0);
    const efficiency = Number(stp.efficiency || 0);
    const utilization = inflow > 0 ? Math.min(100, Math.round((outflow / inflow) * 100)) : 0;
    const sludgeLoad = Math.max(0, Math.round((stp.bod * inflow) / 10));
    const bodCompliant = stp.bod <= automation.targetBod;
    const codCompliant = stp.cod <= automation.targetCod;
    const riskIsHigh = (stp.riskLevel || '').toLowerCase() === 'high';
    const autoScore = [automation.autoAeration, automation.autoDosing, automation.autoSludgePurge].filter(Boolean).length;
    const nextBestAction = !bodCompliant
      ? 'Increase blower RPM by 8% for one cycle.'
      : !codCompliant
        ? 'Increase coagulant dosing by 5% and recheck in 15 min.'
        : efficiency < 92
          ? 'Tune recirculation and purge cycle for efficiency recovery.'
          : 'System is stable. Maintain current auto schedule.';

    const autoRecommendations = [
      {
        severity: riskIsHigh ? 'critical' : 'good',
        title: riskIsHigh ? 'Immediate operator intervention required' : 'Risk under control',
        desc: riskIsHigh
          ? 'Emergency override suggested: isolate influent channel and force recycle mode.'
          : 'Autopilot is maintaining stable discharge profile.'
      },
      {
        severity: bodCompliant ? 'good' : 'critical',
        title: bodCompliant ? 'BOD target compliant' : 'BOD above auto target',
        desc: bodCompliant
          ? `Current BOD ${stp.bod} mg/L is within target (${automation.targetBod}).`
          : `Increase aeration and re-sample in 15 min. Current: ${stp.bod} mg/L.`
      },
      {
        severity: codCompliant ? 'good' : 'critical',
        title: codCompliant ? 'COD target compliant' : 'COD above auto target',
        desc: codCompliant
          ? `Current COD ${stp.cod} mg/L is within target (${automation.targetCod}).`
          : `Trigger dosing step-up by 5% and monitor clarifier output.`
      },
      {
        severity: automation.autoPilotEnabled ? 'good' : 'critical',
        title: automation.autoPilotEnabled ? 'Autopilot active' : 'Autopilot disabled',
        desc: automation.autoPilotEnabled
          ? `Automation loops active: ${autoScore}/3 rules enabled.`
          : 'Enable autopilot to automate response without manual intervention.'
      }
    ];

    return `
      <div class="kpi-row">
        <div class="kpi">
          <div class="kpi-header">
            <div class="kpi-ico" style="background:var(--teal-light);color:var(--teal)">
              <svg viewBox="0 0 24 24"><path d="M12 2C6 2 4 8 4 12c0 4.4 3.6 8 8 8s8-3.6 8-8c0-4-2-10-8-10z"/></svg>
            </div>
            <span class="kpi-trend trend-up">● Stable</span>
          </div>
          <div class="kpi-label">STP Efficiency</div>
          <div class="kpi-value">${efficiency}<span style="font-size:14px;font-weight:500;color:var(--text-3)">%</span></div>
          <div class="kpi-sub">BOD ${stp.bod} mg/L · COD ${stp.cod} mg/L</div>
          <div class="kpi-bar"><div class="kpi-bar-fill" style="width:${efficiency}%;background:var(--green)"></div></div>
        </div>
        <div class="kpi">
          <div class="kpi-header">
            <div class="kpi-ico" style="background:var(--blue-light);color:var(--blue)">
              <svg viewBox="0 0 24 24"><path d="M12 2v20"/><path d="M6 8h12"/></svg>
            </div>
            <span class="kpi-trend trend-up">● ${stp.riskLevel || 'Low'}</span>
          </div>
          <div class="kpi-label">Risk Level</div>
          <div class="kpi-value">${stp.riskLevel || 'Low'}</div>
          <div class="kpi-sub">Last cleaning ${stp.lastCleaning || 'N/A'}</div>
          <div class="kpi-bar"><div class="kpi-bar-fill" style="width:${efficiency}%;background:var(--blue)"></div></div>
        </div>
        <div class="kpi">
          <div class="kpi-header">
            <div class="kpi-ico" style="background:var(--amber-light);color:var(--amber)">
              <svg viewBox="0 0 24 24"><path d="M5 13h14"/><path d="M4 17h16"/></svg>
            </div>
            <span class="kpi-trend trend-warn">● Inflow</span>
          </div>
          <div class="kpi-label">Inflow</div>
          <div class="kpi-value">${inflow}<span style="font-size:14px;font-weight:500;color:var(--text-3)"> MLD</span></div>
          <div class="kpi-sub">Outflow ${outflow} MLD</div>
          <div class="kpi-bar"><div class="kpi-bar-fill" style="width:${Math.min(100, inflow / (outflow || 1) * 100)}%;background:var(--amber)"></div></div>
        </div>
        <div class="kpi">
          <div class="kpi-header">
            <div class="kpi-ico" style="background:var(--purple-light);color:var(--purple)">
              <svg viewBox="0 0 24 24"><rect x="4" y="4" width="16" height="16" rx="2"/><path d="M9 9h6v6H9z"/></svg>
            </div>
            <span class="kpi-trend trend-up">● Auto-Ready</span>
          </div>
          <div class="kpi-label">Automation Coverage</div>
          <div class="kpi-value">${utilization}<span style="font-size:14px;font-weight:500;color:var(--text-3)">%</span></div>
          <div class="kpi-sub">Estimated sludge load ${sludgeLoad} kg/day</div>
          <div class="kpi-bar"><div class="kpi-bar-fill" style="width:${utilization}%;background:var(--purple)"></div></div>
        </div>
      </div>

      <div class="panel">
        <div class="panel-header">
          <div class="panel-title">STP Automation Console</div>
          <span class="badge ${automation.emergencyStop ? 'badge-red' : automation.mode === 'auto' ? 'badge-green' : 'badge-amber'}">${automation.emergencyStop ? 'EMERGENCY' : `${automation.mode.toUpperCase()} MODE`}</span>
        </div>
        <div class="panel-body">
          <div style="display:flex;flex-wrap:wrap;align-items:center;gap:8px;margin-bottom:12px;">
            <button class="btn-control btn-green" onclick="app.setSTPMode('auto')">AUTO MODE</button>
            <button class="btn-control btn-red" onclick="app.setSTPMode('manual')">MANUAL MODE</button>
            <button class="btn-control ${automation.autoPilotEnabled ? 'btn-green' : 'btn-red'}" onclick="app.toggleSTPAutoPilot()">${automation.autoPilotEnabled ? 'AUTOPILOT ON' : 'AUTOPILOT OFF'}</button>
            <button class="btn-control btn-green" onclick="app.runSTPOptimizationCycle()">RUN AUTO CYCLE</button>
            <button class="btn-control btn-red" onclick="app.simulateSTPPeakLoad()">SIMULATE PEAK</button>
            <button class="btn-control btn-red" onclick="app.stpEmergencyStop()">EMERGENCY STOP</button>
            <button class="btn-control btn-green" onclick="app.stpResumeFromEmergency()">RESUME SYSTEM</button>
          </div>

          <div style="display:grid;grid-template-columns:repeat(auto-fit,minmax(220px,1fr));gap:10px;">
            <div style="padding:10px;border:1px solid var(--border);border-radius:10px;background:var(--surface-2);display:flex;justify-content:space-between;align-items:center;">
              <div>
                <div style="font-size:12px;font-weight:700;">Auto Aeration</div>
                <div style="font-size:11px;color:var(--text-3);">BOD target ${automation.targetBod} mg/L</div>
              </div>
              <button class="btn-control ${automation.autoAeration ? 'btn-green' : 'btn-red'}" onclick="app.toggleSTPRule('autoAeration')" style="padding:8px 18px;font-size:12px;font-weight:800;min-width:72px;">${automation.autoAeration ? 'ON' : 'OFF'}</button>
            </div>
            <div style="padding:10px;border:1px solid var(--border);border-radius:10px;background:var(--surface-2);display:flex;justify-content:space-between;align-items:center;">
              <div>
                <div style="font-size:12px;font-weight:700;">Auto Dosing</div>
                <div style="font-size:11px;color:var(--text-3);">COD target ${automation.targetCod} mg/L</div>
              </div>
              <button class="btn-control ${automation.autoDosing ? 'btn-green' : 'btn-red'}" onclick="app.toggleSTPRule('autoDosing')" style="padding:8px 18px;font-size:12px;font-weight:800;min-width:72px;">${automation.autoDosing ? 'ON' : 'OFF'}</button>
            </div>
            <div style="padding:10px;border:1px solid var(--border);border-radius:10px;background:var(--surface-2);display:flex;justify-content:space-between;align-items:center;">
              <div>
                <div style="font-size:12px;font-weight:700;">Auto Sludge Purge</div>
                <div style="font-size:11px;color:var(--text-3);">Cycle every 30 min</div>
              </div>
              <button class="btn-control ${automation.autoSludgePurge ? 'btn-green' : 'btn-red'}" onclick="app.toggleSTPRule('autoSludgePurge')" style="padding:8px 18px;font-size:12px;font-weight:800;min-width:72px;">${automation.autoSludgePurge ? 'ON' : 'OFF'}</button>
            </div>
          </div>

          <div style="margin-top:12px;padding:10px;border-radius:10px;background:var(--blue-light);border:1px solid var(--blue-mid);">
            <div style="font-size:12px;font-weight:700;color:var(--blue);margin-bottom:4px;">How this makes STP automatic</div>
            <div style="font-size:12px;color:var(--text-2);line-height:1.6;">Live sensor values trigger control rules. The system auto-tunes aeration, dosing, and purge cycles, then updates risk/compliance in real time without waiting for manual operator rounds.</div>
            <div style="font-size:11px;color:var(--text-3);margin-top:6px;">Last optimization: ${automation.lastOptimization} · Autopilot: ${automation.autoPilotEnabled ? 'ON' : 'OFF'} · Emergency: ${automation.emergencyStop ? 'ACTIVE' : 'CLEAR'}</div>
            <div style="font-size:11px;color:var(--text-3);margin-top:4px;">Source: ${thingspeak?.live ? 'ThingSpeak Live Feed' : (thingspeak?.enabled ? 'ThingSpeak Enabled (waiting for feed)' : 'Simulated Data')} · Feed Time: ${thingspeak?.lastFeedAt ? new Date(thingspeak.lastFeedAt).toLocaleString() : 'N/A'}</div>
          </div>
        </div>
      </div>

      <div class="panel">
        <div class="panel-header">
          <div class="panel-title">STP Operational Challenges</div>
          <span class="badge badge-amber">PRIORITY WATCHLIST</span>
        </div>
        <div class="panel-body">
          <div style="display:grid;grid-template-columns:repeat(auto-fit,minmax(230px,1fr));gap:12px;">
            <div style="border:2px solid #e8d6ca;border-radius:12px;padding:14px;background:#fff8f4;">
              <div style="display:inline-block;padding:5px 10px;border-radius:20px;background:#d06d45;color:#fff;font-size:11px;font-weight:700;margin-bottom:10px;">Challenge 1</div>
              <div style="font-size:14px;font-weight:700;margin-bottom:6px;">Inflow Variability</div>
              <div style="font-size:12px;color:var(--text-3);line-height:1.6;">Rapid inflow swings during peak demand periods reduce aeration stability and increase treatment energy consumption.</div>
            </div>

            <div style="border:2px solid #e7daff;border-radius:12px;padding:14px;background:#fbf9ff;">
              <div style="display:inline-block;padding:5px 10px;border-radius:20px;background:#5d4fb3;color:#fff;font-size:11px;font-weight:700;margin-bottom:10px;">Challenge 2</div>
              <div style="font-size:14px;font-weight:700;margin-bottom:6px;">Quality Drift Delays</div>
              <div style="font-size:12px;color:var(--text-3);line-height:1.6;">BOD and COD excursions are often identified late when monitoring is manual, causing compliance and discharge risk.</div>
            </div>

            <div style="border:2px solid #d2e8ff;border-radius:12px;padding:14px;background:#f5faff;">
              <div style="display:inline-block;padding:5px 10px;border-radius:20px;background:#2f74c0;color:#fff;font-size:11px;font-weight:700;margin-bottom:10px;">Challenge 3</div>
              <div style="font-size:14px;font-weight:700;margin-bottom:6px;">Reactive Maintenance</div>
              <div style="font-size:12px;color:var(--text-3);line-height:1.6;">Equipment cleaning and blower servicing happen after performance drops, increasing downtime and operating expenses.</div>
            </div>

            <div style="border:2px solid #c8d4ff;border-radius:12px;padding:14px;background:#f8faff;">
              <div style="display:inline-block;padding:5px 10px;border-radius:20px;background:#d06d45;color:#fff;font-size:11px;font-weight:700;margin-bottom:10px;">Challenge 4: Manual Operations</div>
              <div style="font-size:12px;color:var(--text-2);line-height:1.7;">Manual sewage treatment plant monitoring drives excessive operational costs and reduces system responsiveness to critical issues.</div>
            </div>
          </div>
        </div>
      </div>

      <div class="panel">
        <div class="panel-header">
          <div class="panel-title">🧪 Treatment Process Status</div>
          <span class="badge badge-green">${efficiency > 90 ? 'OPTIMAL' : efficiency > 75 ? 'STABLE' : 'ATTENTION'}</span>
        </div>
        <div class="panel-body">
          <div style="display:grid;grid-template-columns:repeat(3,1fr);gap:12px">
            <div class="param-card">
              <div class="param-name">BOD</div>
              <div class="param-val">${stp.bod} mg/L</div>
            </div>
            <div class="param-card">
              <div class="param-name">COD</div>
              <div class="param-val">${stp.cod} mg/L</div>
            </div>
            <div class="param-card">
              <div class="param-name">Uptime</div>
              <div class="param-val">${stp.uptime || '48h 10m'}</div>
            </div>
          </div>

          <div style="margin-top:14px;display:grid;grid-template-columns:repeat(auto-fit,minmax(180px,1fr));gap:10px;">
            <div style="padding:10px;border:1px solid var(--border);border-radius:10px;background:var(--surface-2);">
              <div style="font-size:11px;color:var(--text-4);margin-bottom:4px;">Stage 1 · Screening</div>
              <div style="font-size:13px;font-weight:700;">Inlet Flow Stabilized</div>
              <div style="font-size:11px;color:var(--text-3);margin-top:4px;">Current load: ${inflow} MLD</div>
            </div>
            <div style="padding:10px;border:1px solid var(--border);border-radius:10px;background:var(--surface-2);">
              <div style="font-size:11px;color:var(--text-4);margin-bottom:4px;">Stage 2 · Primary Clarifier</div>
              <div style="font-size:13px;font-weight:700;">Settling Performance</div>
              <div style="font-size:11px;color:var(--text-3);margin-top:4px;">Utilization: ${utilization}%</div>
            </div>
            <div style="padding:10px;border:1px solid var(--border);border-radius:10px;background:var(--surface-2);">
              <div style="font-size:11px;color:var(--text-4);margin-bottom:4px;">Stage 3 · Aeration</div>
              <div style="font-size:13px;font-weight:700;">Organic Load</div>
              <div style="font-size:11px;color:var(--text-3);margin-top:4px;">BOD: ${stp.bod} mg/L</div>
            </div>
            <div style="padding:10px;border:1px solid var(--border);border-radius:10px;background:var(--surface-2);">
              <div style="font-size:11px;color:var(--text-4);margin-bottom:4px;">Stage 4 · Secondary Clarifier</div>
              <div style="font-size:13px;font-weight:700;">Oxidation Status</div>
              <div style="font-size:11px;color:var(--text-3);margin-top:4px;">COD: ${stp.cod} mg/L</div>
            </div>
            <div style="padding:10px;border:1px solid var(--border);border-radius:10px;background:var(--surface-2);">
              <div style="font-size:11px;color:var(--text-4);margin-bottom:4px;">Stage 5 · Disinfection</div>
              <div style="font-size:13px;font-weight:700;">Discharge Readiness</div>
              <div style="font-size:11px;color:var(--text-3);margin-top:4px;">Risk: ${stp.riskLevel || 'Low'}</div>
            </div>
            <div style="padding:10px;border:1px solid var(--border);border-radius:10px;background:var(--surface-2);">
              <div style="font-size:11px;color:var(--text-4);margin-bottom:4px;">Stage 6 · Sludge Handling</div>
              <div style="font-size:13px;font-weight:700;">Estimated Daily Load</div>
              <div style="font-size:11px;color:var(--text-3);margin-top:4px;">${sludgeLoad} kg/day</div>
            </div>
          </div>
        </div>
      </div>

      <div class="grid-2">
        <div class="panel">
          <div class="panel-header">
            <div class="panel-title">Automated Recommendations Engine</div>
            <span class="badge ${riskIsHigh ? 'badge-red' : 'badge-green'}">${riskIsHigh ? 'CRITICAL ACTIONS' : 'AUTO-STABLE'}</span>
          </div>
          <div class="panel-body" style="display:flex;flex-direction:column;gap:10px;">
            <div style="padding:10px;border:1px solid var(--border);border-radius:10px;background:var(--surface-2);font-size:12px;">
              <strong>Next best action</strong><br/>
              ${nextBestAction}
            </div>
            ${autoRecommendations.map((rec) => `
              <div style="padding:10px;border:1px solid ${rec.severity === 'critical' ? 'rgba(220,38,38,0.35)' : 'rgba(5,150,105,0.35)'};border-radius:10px;background:${rec.severity === 'critical' ? 'rgba(254,242,242,0.8)' : 'rgba(236,253,245,0.8)'};font-size:12px;">
                <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:4px;">
                  <strong style="color:${rec.severity === 'critical' ? 'var(--red)' : 'var(--green)'};">${rec.title}</strong>
                  <span class="badge ${rec.severity === 'critical' ? 'badge-red' : 'badge-green'}" style="font-size:10px;">${rec.severity === 'critical' ? 'RED' : 'GREEN'}</span>
                </div>
                <div style="color:var(--text-2);line-height:1.5;">${rec.desc}</div>
              </div>
            `).join('')}
            <div style="padding:10px;border:1px solid var(--border);border-radius:10px;background:var(--surface-2);font-size:12px;">
              <strong>Action execution log</strong><br/>
              ${(automation.actionLog && automation.actionLog.length > 0)
                ? automation.actionLog.slice(0, 3).map((entry) => `• ${entry}`).join('<br/>')
                : '• No automation actions executed yet.'}
            </div>
          </div>
        </div>

        <div class="panel">
          <div class="panel-header">
            <div class="panel-title">Compliance Snapshot</div>
            <span class="badge badge-green">LIVE</span>
          </div>
          <div class="panel-body" style="display:grid;grid-template-columns:1fr 1fr;gap:10px;">
            <div class="param-card">
              <div class="param-name">Effluent Target</div>
              <div class="param-val">BOD &lt; ${automation.targetBod}</div>
            </div>
            <div class="param-card">
              <div class="param-name">Current BOD</div>
              <div class="param-val" style="color:${bodCompliant ? 'var(--green)' : 'var(--red)'};">${stp.bod}</div>
            </div>
            <div class="param-card">
              <div class="param-name">COD Limit</div>
              <div class="param-val">&lt; ${automation.targetCod}</div>
            </div>
            <div class="param-card">
              <div class="param-name">Current COD</div>
              <div class="param-val" style="color:${codCompliant ? 'var(--green)' : 'var(--red)'};">${stp.cod}</div>
            </div>
            <div class="param-card" style="grid-column:1 / -1;">
              <div class="param-name">Plant Verdict</div>
              <div class="param-val" style="color:${efficiency > 90 ? 'var(--green)' : 'var(--amber)'};">${efficiency > 90 ? 'Compliant and stable' : 'Watch required'}</div>
            </div>
          </div>
        </div>
      </div>
    `;
  }

  renderForecast() {
    const { demandForecast } = this.data;
    
    return `
      <div class="kpi-row">
        <div class="kpi">
          <div class="kpi-header">
            <div class="kpi-ico" style="background:var(--blue-light);color:var(--blue)">
              <svg viewBox="0 0 24 24"><polyline points="22 12 18 12 15 21 9 3 6 12 2 12"/></svg>
            </div>
            <span class="kpi-trend trend-up">▲ TODAY</span>
          </div>
          <div class="kpi-label">Today's Demand</div>
          <div class="kpi-value">${demandForecast.today.value}<span style="font-size:14px;font-weight:500;color:var(--text-3)"> MLD</span></div>
          <div class="kpi-sub">Peak ${demandForecast.today.peak} MLD at ${demandForecast.today.peakTime}</div>
        </div>

        <div class="kpi">
          <div class="kpi-header">
            <div class="kpi-ico" style="background:var(--green-light);color:var(--green)">
              <svg viewBox="0 0 24 24"><path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0 1 18 0z"/></svg>
            </div>
            <span class="kpi-trend trend-up">7-DAY</span>
          </div>
          <div class="kpi-label">7-Day Forecast Avg</div>
          <div class="kpi-value">${demandForecast.forecast7Day.value}<span style="font-size:14px;font-weight:500;color:var(--text-3)"> MLD</span></div>
          <div class="kpi-sub">+5.7% vs last week</div>
        </div>

        <div class="kpi">
          <div class="kpi-header">
            <div class="kpi-ico" style="background:var(--amber-light);color:var(--amber)">
              <svg viewBox="0 0 24 24"><path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z"/></svg>
            </div>
            <span class="kpi-trend trend-warn">DAY 3</span>
          </div>
          <div class="kpi-label">Shortage Risk Day</div>
          <div class="kpi-value">${demandForecast.shortageRisk.day}</div>
          <div class="kpi-sub">${demandForecast.shortageRisk.reason}</div>
        </div>

        <div class="kpi">
          <div class="kpi-header">
            <div class="kpi-ico" style="background:var(--purple-light);color:var(--purple)">
              <svg viewBox="0 0 24 24"><circle cx="12" cy="12" r="10"/><path d="M12 6v6l4 2"/></svg>
            </div>
            <span class="kpi-trend trend-up">98.2%</span>
          </div>
          <div class="kpi-label">Model Accuracy</div>
          <div class="kpi-value">${demandForecast.modelAccuracy}<span style="font-size:14px;font-weight:500;color:var(--text-3)">%</span></div>
          <div class="kpi-sub">RMSE 0.07 MLD</div>
        </div>
      </div>

      <div class="grid-2">
        <div class="panel">
          <div class="panel-header">
            <div class="panel-title">📈 7-Day Demand Forecast</div>
            <button class="btn-sm btn-ghost">⚙️ ML PREDICTION</button>
          </div>
          <div class="panel-body" style="padding:12px;">
            <canvas id="forecast-7day-chart" style="width:100%;height:220px;"></canvas>
              </div>
              <div class="chart-legend-bottom">
                <span style="color:var(--blue)">— Actual (today)</span>
                <span style="color:var(--blue)">--- ML Forecast</span>
                <span style="color:var(--blue);opacity:0.5">▓ Confidence band</span>
              </div>
            </div>
          </div>
        </div>

        <div class="panel">
          <div class="panel-header">
            <div class="panel-title">📅 Daily Forecast</div>
          </div>
          <div class="panel-body">
            <div class="daily-forecast-list">
              ${demandForecast.dailyForecast.map(day => `
                <div class="df-item">
                  <div class="df-day">${day.day}</div>
                  <div class="df-bar-container">
                    <div class="df-bar">
                      <div class="df-fill" style="width:${(day.value / 3.2) * 100}%;background:${day.status === 'High' ? 'var(--red)' : day.status === 'Elevated' ? 'var(--amber)' : 'var(--green)'}"></div>
                    </div>
                    <div class="df-value">${day.value} MLD</div>
                  </div>
                  <div class="df-status status-${day.status.toLowerCase()}">${day.status}</div>
                </div>
              `).join('')}
            </div>
          </div>
        </div>
      </div>

      <div class="grid-2">
        <div class="panel">
          <div class="panel-header">
            <div class="panel-title">📊 Sector Demand Breakdown</div>
            <span class="panel-meta">Today vs Forecast</span>
          </div>
          <div class="panel-body">
            <div class="sector-chart">
              ${demandForecast.sectorBreakdown.map(sector => `
                <div class="sector-item">
                  <div class="sector-name">${sector.sector}</div>
                  <div class="sector-bars">
                    <div class="sector-bar-row">
                      <span class="sector-label">Today</span>
                      <div class="sector-bar">
                        <div class="sector-fill" style="width:${(sector.today / 1.2) * 100}%;background:var(--blue)"></div>
                      </div>
                      <span class="sector-value">${sector.today} MLD</span>
                    </div>
                    <div class="sector-bar-row">
                      <span class="sector-label">Forecast</span>
                      <div class="sector-bar">
                        <div class="sector-fill" style="width:${(sector.forecast / 1.2) * 100}%;background:var(--teal)"></div>
                      </div>
                      <span class="sector-value">${sector.forecast} MLD</span>
                    </div>
                  </div>
                </div>
              `).join('')}
            </div>
          </div>
        </div>

        <div class="panel">
          <div class="panel-header">
            <div class="panel-title">💡 Planning Recommendations</div>
            <span class="badge badge-blue">AI</span>
          </div>
          <div class="panel-body">
            <div class="recommendations-list">
              ${demandForecast.recommendations.map(rec => `
                <div class="rec-item rec-${rec.type}">
                  <div class="rec-icon">${rec.type === 'warning' ? '⚠️' : 'ℹ️'}</div>
                  <div class="rec-content">
                    <div class="rec-title">${rec.title}</div>
                    <div class="rec-desc">${rec.desc}</div>
                  </div>
                </div>
              `).join('')}
            </div>
          </div>
        </div>
      </div>

      <div class="panel">
        <div class="panel-header">
          <div class="panel-title">📊 Historical Water Usage (Last 7 Days)</div>
          <span class="panel-meta">Previous demand data</span>
        </div>
        <div class="panel-body">
          <div class="historical-data" style="display:grid;grid-template-columns:repeat(auto-fit,minmax(100px,1fr));gap:10px;">
            ${demandForecast.historicalData.map(data => `
              <div style="padding:12px;background:var(--surface-2);border-radius:6px;border-left:3px solid var(--blue);text-align:center;">
                <div style="font-size:11px;color:var(--text-3);margin-bottom:6px;">${data.date}</div>
                <div style="font-size:18px;font-weight:700;color:var(--blue);">${this.formatNumber(data.value, 2)}</div>
                <div style="font-size:10px;color:var(--text-4);">MLD</div>
              </div>
            `).join('')}
          </div>
        </div>
      </div>
    `;
  }

  renderThresholds() {
    const { thresholds } = this.data;
    const ml = this.data?.waterPotability?.ml || {};
    const featureImportances = ml.featureImportances || {};
    const topFeatures = Object.entries(featureImportances)
      .sort((a, b) => b[1] - a[1])
      .slice(0, 3);
    
    return `
      <div class="panel">
        <div class="panel-header">
          <div class="panel-title">⚙️ Threshold Configuration</div>
          <span class="panel-meta">Set alert thresholds for sensors. Backend integration will trigger alerts when values exceed these limits.</span>
        </div>
        <div class="panel-body">
          <div class="threshold-intro">
            <p style="margin-bottom:16px;color:var(--text-3);font-size:13px;">Configure alert thresholds for water quality parameters. The backend will automatically trigger alerts and activate the buzzer when sensor readings exceed these limits.</p>
          </div>
          
          <div class="threshold-section">
            <div class="threshold-section-header">
              <h3>Water Quality Thresholds</h3>
              <span class="badge badge-blue">${thresholds.waterQuality.length} PARAMS</span>
            </div>
            
            <div class="threshold-table">
              <div class="threshold-table-header">
                <div class="th-col th-param">PARAMETER</div>
                <div class="th-col th-min">MIN</div>
                <div class="th-col th-max">MAX</div>
                <div class="th-col th-unit">UNIT</div>
              </div>
              
              ${thresholds.waterQuality.map((param, idx) => `
                <div class="threshold-table-row">
                  <div class="th-col th-param">${param.parameter}</div>
                  <div class="th-col th-min">
                    <input type="number" class="threshold-input threshold-min-${idx}" value="${param.min}" step="0.1" />
                  </div>
                  <div class="th-col th-max">
                    <input type="number" class="threshold-input threshold-max-${idx}" value="${param.max}" step="0.1" />
                  </div>
                  <div class="th-col th-unit">${param.unit}</div>
                </div>
              `).join('')}
            </div>
          </div>

          <div class="threshold-actions">
            <button class="btn btn-primary" onclick="app.saveAllThresholds()">💾 Save Thresholds</button>
            <button class="btn btn-ghost" onclick="location.reload()">↺ Reset to Defaults</button>
          </div>

          <div class="panel" style="margin-top:16px;">
            <div class="panel-header" style="align-items:flex-start;">
              <div>
                <div class="panel-title">🧠 Potability Training (Mamdani + Random Forest)</div>
                <div style="font-size:12px;color:var(--text-3);margin-top:4px;line-height:1.5;">
                  Fuzzy Mamdani logic remains rule-based and always active. This action retrains the Random Forest layer from <code>backend/data/water_potability.csv</code>.
                </div>
              </div>
              <span class="badge badge-blue">CSV MODE</span>
            </div>
            <div class="panel-body" style="display:grid;grid-template-columns:repeat(auto-fit,minmax(120px,1fr));gap:10px;">
              <div>
                <div style="font-size:11px;color:var(--text-3);margin-bottom:4px;">Trees</div>
                <input id="rf-trees" type="number" min="10" max="120" value="60" class="threshold-input" />
              </div>
              <div>
                <div style="font-size:11px;color:var(--text-3);margin-bottom:4px;">Max Depth</div>
                <input id="rf-depth" type="number" min="2" max="14" value="8" class="threshold-input" />
              </div>
              <div>
                <div style="font-size:11px;color:var(--text-3);margin-bottom:4px;">Min Leaf</div>
                <input id="rf-min-leaf" type="number" min="1" max="25" value="4" class="threshold-input" />
              </div>
              <div>
                <div style="font-size:11px;color:var(--text-3);margin-bottom:4px;">Sample Rate</div>
                <input id="rf-sample-rate" type="number" min="0.4" max="1" step="0.05" value="0.85" class="threshold-input" />
              </div>
              <div>
                <div style="font-size:11px;color:var(--text-3);margin-bottom:4px;">Max Features</div>
                <input id="rf-max-features" type="number" min="1" max="6" value="3" class="threshold-input" />
              </div>
            </div>
            <div class="threshold-actions" style="margin-top:10px;">
              <button class="btn btn-primary" onclick="app.trainPotabilityFromCsv()">🚀 Train Potability Model from CSV</button>
            </div>

            <div style="margin-top:12px;padding:10px;border:1px solid var(--border);border-radius:10px;background:var(--surface-2);">
              <div style="font-size:12px;font-weight:700;margin-bottom:8px;color:var(--text-2);">Model Training Status (visible dashboard data)</div>
              <div style="display:grid;grid-template-columns:repeat(auto-fit,minmax(140px,1fr));gap:8px;">
                <div class="param-card">
                  <div class="param-name">Model</div>
                  <div class="param-val">${ml.modelType || 'RandomForest'}</div>
                </div>
                <div class="param-card">
                  <div class="param-name">Training Source</div>
                  <div class="param-val">${ml.trainSource || 'Not trained yet'}</div>
                </div>
                <div class="param-card">
                  <div class="param-name">Samples</div>
                  <div class="param-val">${ml.samples ?? '--'}</div>
                </div>
                <div class="param-card">
                  <div class="param-name">Accuracy</div>
                  <div class="param-val">${ml.accuracy ?? '--'}${ml.accuracy ? '%' : ''}</div>
                </div>
                <div class="param-card">
                  <div class="param-name">Trained At</div>
                  <div class="param-val" style="font-size:12px;">${ml.trainedAt ? new Date(ml.trainedAt).toLocaleString() : 'Not trained'}</div>
                </div>
                <div class="param-card">
                  <div class="param-name">CSV Path</div>
                  <div class="param-val" style="font-size:12px;word-break:break-word;">${ml.csvPath || 'backend/data/water_potability.csv'}</div>
                </div>
              </div>
              <div style="margin-top:8px;font-size:11px;color:var(--text-3);line-height:1.6;">
                RF Params: trees=${ml.trees ?? '--'}, depth=${ml.maxDepth ?? '--'}, minLeaf=${ml.minLeaf ?? '--'}, sampleRate=${ml.sampleRate ?? '--'}, maxFeatures=${ml.maxFeatures ?? '--'}
              </div>
              <div style="margin-top:6px;font-size:11px;color:var(--text-3);line-height:1.6;">
                Top Feature Importances:
                ${topFeatures.length
                  ? topFeatures.map(([name, value]) => `${name}=${(value * 100).toFixed(1)}%`).join(' | ')
                  : 'Not available yet'}
              </div>
            </div>
          </div>
        </div>
      </div>

      <div class="panel">
        <div class="panel-header">
          <div class="panel-title">📋 Current Alert Rules</div>
        </div>
        <div class="panel-body">
          <div class="alert-rules">
            <div class="rule-item">
              <div class="rule-icon" style="background:var(--red-light);color:var(--red)">🔴</div>
              <div class="rule-content">
                <div class="rule-title">Critical Leak Detection</div>
                <div class="rule-desc">Trigger: Pressure drop >30% in 5min · Action: Buzzer ON + Dispatch Team</div>
              </div>
              <div class="rule-status">ACTIVE</div>
            </div>

            <div class="rule-item">
              <div class="rule-icon" style="background:var(--amber-light);color:var(--amber)">⚠️</div>
              <div class="rule-content">
                <div class="rule-title">Water Quality Alert</div>
                <div class="rule-desc">Trigger: Any parameter exceeds threshold · Action: Alert + Auto-adjust</div>
              </div>
              <div class="rule-status">ACTIVE</div>
            </div>

            <div class="rule-item">
              <div class="rule-icon" style="background:var(--blue-light);color:var(--blue)">💧</div>
              <div class="rule-content">
                <div class="rule-title">Smart Irrigation Control</div>
                <div class="rule-desc">Trigger: Soil moisture <30% · Action: Auto-activate sprinklers</div>
              </div>
              <div class="rule-status">ACTIVE</div>
            </div>

            <div class="rule-item">
              <div class="rule-icon" style="background:var(--green-light);color:var(--green)">⚙️</div>
              <div class="rule-content">
                <div class="rule-title">Pump Efficiency Monitor</div>
                <div class="rule-desc">Trigger: Efficiency <80% for 1hr · Action: Maintenance alert</div>
              </div>
              <div class="rule-status">ACTIVE</div>
            </div>
          </div>
        </div>
      </div>
    `;
  }

  async saveAllThresholds() {
    if (!this.data || !this.data.thresholds) {
      alert('No threshold data loaded.');
      return;
    }

    const thresholdInputs = this.data.thresholds.waterQuality.map((param, idx) => {
      const minInput = document.querySelector(`.threshold-min-${idx}`);
      const maxInput = document.querySelector(`.threshold-max-${idx}`);

      if (!minInput || !maxInput) {
        console.warn(`Missing input fields for ${param.parameter}`);
        return null;
      }

      return {
        parameter: param.parameter,
        min: parseFloat(minInput.value),
        max: parseFloat(maxInput.value),
        unit: param.unit
      };
    }).filter(t => t !== null);

    if (thresholdInputs.length === 0) {
      alert('No threshold inputs found.');
      return;
    }

    try {
      const res = await fetch(`${API_URL}/thresholds/bulk`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ thresholds: thresholdInputs })
      });

      const payload = await res.json();

      if (payload.success) {
        // Update local data with new thresholds
        this.data.thresholds.waterQuality = payload.thresholds;
        alert(`✓ ${payload.message}\n\nUpdated parameters:\n${thresholdInputs.map(t => `${t.parameter}: ${t.min} - ${t.max}`).join('\n')}`);
        console.log('Thresholds saved:', payload);
      } else {
        alert(`✗ Failed to save thresholds: ${payload.message}`);
      }
    } catch (error) {
      console.error('Save thresholds failed:', error);
      alert('Failed to save thresholds. See console for details.');
    }
  }

  renderReports() {
    return `
      <div class="panel">
        <div class="panel-header">
          <div class="panel-title">📊 Reports & Export</div>
        </div>
        <div class="panel-body">
          <div class="reports-grid">
            <div class="report-card">
              <div class="report-icon" style="background:var(--blue-light);color:var(--blue)">
                <svg viewBox="0 0 24 24" width="24" height="24"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/></svg>
              </div>
              <div class="report-title">Daily Operations Report</div>
              <div class="report-desc">Water quality, demand, leaks summary</div>
              <button class="btn btn-primary btn-sm" onclick="app.downloadSensorData()">Download JSON</button>
            </div>

            <div class="report-card">
              <div class="report-icon" style="background:var(--green-light);color:var(--green)">
                <svg viewBox="0 0 24 24" width="24" height="24"><polyline points="22 12 18 12 15 21 9 3 6 12 2 12"/></svg>
              </div>
              <div class="report-title">Weekly Analytics</div>
              <div class="report-desc">Trends, forecasts, efficiency metrics</div>
              <button class="btn btn-primary btn-sm" onclick="app.downloadForecastCSV()">Download CSV</button>
            </div>

            <div class="report-card">
              <div class="report-icon" style="background:var(--red-light);color:var(--red)">
                <svg viewBox="0 0 24 24" width="24" height="24"><circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="12"/></svg>
              </div>
              <div class="report-title">Incident Report</div>
              <div class="report-desc">Leak detections, response times</div>
              <button class="btn btn-primary btn-sm" onclick="app.downloadSensorData()">Download JSON</button>
            </div>

            <div class="report-card">
              <div class="report-icon" style="background:var(--purple-light);color:var(--purple)">
                <svg viewBox="0 0 24 24" width="24" height="24"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="7 10 12 15 17 10"/><line x1="12" y1="15" x2="12" y2="3"/></svg>
              </div>
              <div class="report-title">ML Forecast Run</div>
              <div class="report-desc">Run the external water-forecast model and sync results</div>
              <button class="btn btn-primary btn-sm" onclick="app.runForecastModel()">Run Forecast</button>
            </div>
          </div>
        </div>
      </div>

      <div class="panel">
        <div class="panel-header">
          <div class="panel-title">📥 Sensor Data Downloads</div>
          <span class="panel-meta">Export readings from specific sensors</span>
        </div>
        <div class="panel-body">
          <div style="display:grid;grid-template-columns:repeat(auto-fit,minmax(140px,1fr));gap:10px;">
            <button class="btn btn-primary btn-sm" onclick="app.downloadWaterQualityData()" style="width:100%;">💧 Water Quality</button>
            <button class="btn btn-primary btn-sm" onclick="app.downloadLeakDetectionData()" style="width:100%;">🔴 Leak Detection</button>
            <button class="btn btn-primary btn-sm" onclick="app.downloadHardwareData()" style="width:100%;">⚙️ Hardware</button>
            <button class="btn btn-primary btn-sm" onclick="app.downloadIrrigationData()" style="width:100%;">🌱 Irrigation</button>
          </div>
        </div>
      </div>
    `;
  }
}

// Initialize app
const app = new AquaSyncApp();
window.app = app;
