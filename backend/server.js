const express = require('express');
const cors = require('cors');
const WebSocket = require('ws');
const { spawn } = require('child_process');
const path = require('path');
const fs = require('fs');
require('dotenv').config();

const app = express();
const PORT = process.env.PORT || 3000;

app.use(cors());
app.use(express.json());

// Simulated sensor data (will be replaced with hardware integration)
let sensorData = {
  waterQuality: {
    wqi: 87.4,
    ph: 7.2,
    turbidity: 2.1,
    tds: 145,
    chlorine: 0.8,
    temperature: 24.5,
    flowRate: 12.5 // L/min from flow sensor
  },
  demand: {
    current: 2.47,
    peak: 3.2,
    peakTime: '18:00',
    trend: 'up',
    totalToday: 45.2,
    savings: 8.3
  },
  leaks: [
    { id: 'L001', zone: 'Sector 7-B', node: 'N-047', severity: 'critical', flow: 4.2, confidence: 97.3, time: '2 min ago', buzzerActive: true },
    { id: 'L002', zone: 'Sector 3-A', node: 'N-023', severity: 'medium', flow: 1.8, confidence: 84.5, time: '15 min ago', buzzerActive: false },
    { id: 'L003', zone: 'Sector 5-C', node: 'N-031', severity: 'low', flow: 0.5, confidence: 72.1, time: '1 hr ago', buzzerActive: false }
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
    cod: 22.5
  },
  irrigation: {
    mode: 'auto', // 'auto' or 'manual'
    zones: [
      { 
        id: 'Z-001', 
        name: 'Park A - North', 
        soilMoisture: 25, 
        threshold: 30, 
        sprinklerStatus: 'active', 
        waterUsed: 145, 
        duration: 15, 
        lastWatered: '2 min ago',
        manualOverride: false,
        flowRate: 12.5, // L/min
        area: 500 // sq meters
      },
      { 
        id: 'Z-002', 
        name: 'Park A - South', 
        soilMoisture: 45, 
        threshold: 30, 
        sprinklerStatus: 'idle', 
        waterUsed: 0, 
        duration: 0, 
        lastWatered: '2 hrs ago',
        manualOverride: false,
        flowRate: 0,
        area: 450
      },
      { 
        id: 'Z-003', 
        name: 'Park B - East', 
        soilMoisture: 28, 
        threshold: 30, 
        sprinklerStatus: 'active', 
        waterUsed: 98, 
        duration: 10, 
        lastWatered: '5 min ago',
        manualOverride: false,
        flowRate: 10.2,
        area: 380
      },
      { 
        id: 'Z-004', 
        name: 'Park B - West', 
        soilMoisture: 52, 
        threshold: 30, 
        sprinklerStatus: 'idle', 
        waterUsed: 0, 
        duration: 0, 
        lastWatered: '1 hr ago',
        manualOverride: false,
        flowRate: 0,
        area: 420
      },
      { 
        id: 'Z-005', 
        name: 'Garden Center', 
        soilMoisture: 38, 
        threshold: 30, 
        sprinklerStatus: 'idle', 
        waterUsed: 0, 
        duration: 0, 
        lastWatered: '45 min ago',
        manualOverride: false,
        flowRate: 0,
        area: 300
      },
      { 
        id: 'Z-006', 
        name: 'Sports Field', 
        soilMoisture: 22, 
        threshold: 30, 
        sprinklerStatus: 'scheduled', 
        waterUsed: 0, 
        duration: 0, 
        lastWatered: '3 hrs ago',
        manualOverride: false,
        flowRate: 0,
        area: 800
      }
    ],
    totalWaterSaved: 1250, // liters saved today
    activeZones: 2,
    scheduledZones: 1,
    totalArea: 2850, // sq meters
    avgMoisture: 35
  },
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
    actuators: {
      mainPump: { status: 'on', power: 2.4, cycles: 1247 },
      sprinklers: { active: 2, total: 6, waterFlow: 243 },
      buzzer: { status: 'active', alerts: 3, lastTriggered: '2 min ago' },
      valves: { open: 4, closed: 2, total: 6 }
    }
  },
  analytics: {
    waterSavings: {
      today: 8.3,
      week: 52.4,
      month: 218.7,
      percentage: 15.2
    },
    leakPrevention: {
      detected: 12,
      prevented: 9,
      savedLiters: 4250
    },
    efficiency: {
      distribution: 92.4,
      irrigation: 88.7,
      overall: 90.5
    },
    predictions: {
      nextLeakRisk: 'Low',
      maintenanceDue: '12 days',
      peakDemandTime: '18:30',
      recommendedAction: 'Schedule valve inspection'
    }
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
    dailyForecast: [
      { day: 'Today', value: 2.47, status: 'Normal' },
      { day: 'Tuesday', value: 2.53, status: 'Normal' },
      { day: 'Wednesday', value: 2.71, status: 'Elevated' },
      { day: 'Thursday', value: 2.89, status: 'High' },
      { day: 'Friday', value: 2.65, status: 'Elevated' },
      { day: 'Saturday', value: 2.44, status: 'Normal' },
      { day: 'Sunday', value: 2.38, status: 'Normal' }
    ],
    sectorBreakdown: [
      { sector: 'Residential', today: 1.1, forecast: 1.15 },
      { sector: 'Industrial', today: 0.7, forecast: 0.72 },
      { sector: 'Irrigation', today: 0.45, forecast: 0.52 },
      { sector: 'Commercial', today: 0.22, forecast: 0.22 }
    ],
    recommendations: [
      { type: 'info', title: 'Pre-fill Reservoir-B by 15:30', desc: 'ML predicts 3.2 MLD demand spike at 18:00. Need 0.73 MLD buffer.' },
      { type: 'warning', title: 'Day 3 high-demand window', desc: 'Monsoon season effect. Activate secondary storage tank to prevent overflow.' },
      { type: 'info', title: 'Weekend demand dip expected', desc: 'Industrial sector drops 38%. Recommended scheduled maintenance window: Sat 02:00-06:00.' },
      { type: 'warning', title: 'Irrigation demand peaks Day 5-6', desc: 'Agricultural sector +22%. Ensure zone valve pressures are pre-calibrated.' }
    ]
  },
  zoneQuality: {
    zones: [
      { id: 'Z-1A', wqi: 91, status: 'good' },
      { id: 'Z-2B', wqi: 85, status: 'good' },
      { id: 'Z-3A', wqi: 72, status: 'fair' },
      { id: 'Z-4C', wqi: 88, status: 'good' },
      { id: 'Z-1C', wqi: 63, status: 'fair' },
      { id: 'Z-6A', wqi: 91, status: 'good' },
      { id: 'Z-7B', wqi: 54, status: 'poor' },
      { id: 'Z-10J', wqi: 87, status: 'good' },
      { id: 'Z-9A', wqi: 78, status: 'fair' },
      { id: 'Z-14BC', wqi: 82, status: 'good' },
      { id: 'Z-11D', wqi: 89, status: 'good' },
      { id: 'Z-12H', wqi: 66, status: 'fair' }
    ],
    alerts: [
      { severity: 'critical', title: 'Chlorine below minimum — Sectors 4, 5, 6', time: '09:42', desc: 'Auto-dosing triggered · Monitoring active' },
      { severity: 'warning', title: 'Turbidity spike — Zone 3-A (3.8 NTU)', time: '11:17', desc: 'Approaching 4 NTU limit · Watch' },
      { severity: 'warning', title: 'pH fluctuation — Zone 9-B (7.9 → 8.1)', time: '12:05', desc: 'Minimal range · Minor drift detected' },
      { severity: 'info', title: 'Reservoir-A chlorination completed', time: '00:30', desc: 'Levels restored to 0.6 mg/L · Resolved' }
    ]
  },
  pipelineIntegrity: {
    segments: [
      { id: 'T-1', score: 92, status: 'good' },
      { id: 'T-2', score: 88, status: 'good' },
      { id: 'T-3', score: 41, status: 'critical' },
      { id: 'B-1', score: 96, status: 'good' },
      { id: 'B-2', score: 73, status: 'fair' },
      { id: 'B-3', score: 85, status: 'good' },
      { id: 'D-4', score: 91, status: 'good' },
      { id: 'B-5', score: 67, status: 'fair' },
      { id: 'B-6', score: 88, status: 'good' },
      { id: 'B-7', score: 95, status: 'good' },
      { id: 'B-2', score: 79, status: 'fair' },
      { id: 'B-3', score: 56, status: 'poor' }
    ],
    monitored: 12
  },
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
  },
  alerts: [
    { id: 'A001', type: 'critical', title: 'Critical Leak Detected', message: 'Sector 7-B showing 4.2 L/min loss', time: '2 min ago', buzzer: true },
    { id: 'A002', type: 'warning', title: 'Low Soil Moisture', message: 'Park A-North moisture at 25% - Sprinkler activated', time: '5 min ago', buzzer: false },
    { id: 'A003', type: 'info', title: 'Pump Efficiency Drop', message: 'Booster Pump efficiency at 78.2%', time: '15 min ago', buzzer: false }
  ],
  network: {
    nodes: [
      { id: 'N-001', x: 15, y: 20, status: 'normal', pressure: 4.2, flow: 450 },
      { id: 'N-023', x: 35, y: 45, status: 'warning', pressure: 2.8, flow: 380 },
      { id: 'N-031', x: 55, y: 30, status: 'warning', pressure: 3.1, flow: 390 },
      { id: 'N-047', x: 75, y: 60, status: 'leak', pressure: 1.2, flow: 120 },
      { id: 'N-052', x: 85, y: 25, status: 'normal', pressure: 4.5, flow: 460 }
    ]
  }
};

// API Routes
app.get('/api/health', (req, res) => {
  res.json({ status: 'ok', timestamp: new Date().toISOString() });
});

app.get('/api/dashboard', (req, res) => {
  res.json(sensorData);
});

app.get('/api/water-quality', (req, res) => {
  res.json(sensorData.waterQuality);
});

app.get('/api/leaks', (req, res) => {
  res.json(sensorData.leaks);
});

app.get('/api/pumps', (req, res) => {
  res.json(sensorData.pumps);
});

app.get('/api/stp', (req, res) => {
  res.json(sensorData.stp);
});

app.get('/api/network', (req, res) => {
  res.json(sensorData.network);
});

app.get('/api/irrigation', (req, res) => {
  res.json(sensorData.irrigation);
});

app.get('/api/hardware', (req, res) => {
  res.json(sensorData.hardware);
});

app.get('/api/analytics', (req, res) => {
  res.json(sensorData.analytics);
});

app.get('/api/alerts', (req, res) => {
  res.json(sensorData.alerts);
});

// Control endpoints for hardware
app.post('/api/control/pump/:id', (req, res) => {
  const { id } = req.params;
  const { action } = req.body; // 'on' or 'off'
  console.log(`Pump ${id} control: ${action}`);
  res.json({ success: true, pump: id, action });
});

app.post('/api/control/sprinkler/:zoneId', (req, res) => {
  const { zoneId } = req.params;
  const { action, duration } = req.body;
  console.log(`Sprinkler ${zoneId} control: ${action} for ${duration} min`);
  
  // Find zone and update
  const zone = sensorData.irrigation.zones.find(z => z.id === zoneId);
  if (zone) {
    if (action === 'on') {
      zone.sprinklerStatus = 'active';
      zone.manualOverride = true;
      zone.duration = duration || 15;
    } else {
      zone.sprinklerStatus = 'idle';
      zone.manualOverride = false;
      zone.duration = 0;
    }
  }
  
  res.json({ success: true, zone: zoneId, action, duration });
});

app.post('/api/control/irrigation-mode', (req, res) => {
  const { mode } = req.body; // 'auto' or 'manual'
  sensorData.irrigation.mode = mode;
  console.log(`Irrigation mode changed to: ${mode}`);
  res.json({ success: true, mode });
});

app.post('/api/control/buzzer', (req, res) => {
  const { action } = req.body; // 'on' or 'off'
  console.log(`Buzzer control: ${action}`);
  res.json({ success: true, action });
});

app.get('/api/demand-forecast', (req, res) => {
  res.json(sensorData.demandForecast);
});

app.get('/api/forecast/run', (req, res) => {
  const days = parseInt(req.query.days, 10) || 7;
  const forecastRepo = path.resolve(__dirname, '..', 'tmp_forecast_repo');
  const predictScript = path.join(forecastRepo, 'src', 'predict.py');

  // Generate synthetic forecast data as fallback
  const generateSyntheticForecast = () => {
    const dailyForecast = [];
    const baseValue = 2.5;
    const statuses = ['Normal', 'Normal', 'Elevated', 'High', 'Elevated', 'Normal', 'Normal'];
    const dayNames = ['Today', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday'];
    
    for (let i = 0; i < days; i++) {
      dailyForecast.push({
        day: dayNames[i] || `Day ${i+1}`,
        value: (baseValue + (Math.random() - 0.5) * 0.8).toFixed(2),
        status: statuses[i] || 'Normal'
      });
    }
    
    return {
      today: { value: 2.47, peak: 3.2, peakTime: '18:00' },
      forecast7Day: { value: 2.61, confidence: 94.5 },
      shortageRisk: { day: 'Day 3', reason: 'Monsoon pre-fill' },
      modelAccuracy: 98.2,
      historicalData: sensorData.demandForecast.historicalData,
      dailyForecast: dailyForecast,
      sectorBreakdown: sensorData.demandForecast.sectorBreakdown,
      recommendations: sensorData.demandForecast.recommendations
    };
  };

  // Try to run Python model if available
  if (fs.existsSync(predictScript)) {
    const python = process.env.PYTHON_PATH || 'python';
    const processRun = spawn(python, ['src/predict.py'], { cwd: forecastRepo, timeout: 30000 });

    let logs = '';
    let hasError = false;
    
    processRun.stdout.on('data', data => { logs += data.toString(); });
    processRun.stderr.on('data', data => { 
      hasError = true;
      logs += 'ERROR: ' + data.toString(); 
    });

    processRun.on('close', (code) => {
      if (code === 0 && !hasError) {
        res.json({
          message: 'Forecast model executed successfully',
          exitCode: code,
          logs,
          requestedDays: days,
          forecast: sensorData.demandForecast,
          source: 'ML Model'
        });
      } else {
        const syntheticForecast = generateSyntheticForecast();
        res.json({
          message: 'ML Model unavailable; returning synthetic forecast',
          exitCode: code,
          logs,
          requestedDays: days,
          forecast: syntheticForecast,
          source: 'Synthetic Data'
        });
      }
    });

    processRun.on('error', (error) => {
      const syntheticForecast = generateSyntheticForecast();
      res.json({
        message: 'ML Model execution failed; returning synthetic forecast',
        error: error.message,
        forecast: syntheticForecast,
        source: 'Synthetic Data'
      });
    });
  } else {
    // Model not found, return synthetic forecast
    const syntheticForecast = generateSyntheticForecast();
    res.json({
      message: 'ML Model repository not found. Generating synthetic forecast.',
      hint: 'To use real ML model, clone: https://github.com/aildnont/water-forecast into tmp_forecast_repo',
      forecast: syntheticForecast,
      source: 'Synthetic Data'
    });
  }
});

app.get('/api/reports/sensors', (req, res) => {
  res.json(sensorData);
});

app.get('/api/reports/forecast', (req, res) => {
  res.json(sensorData.demandForecast);
});

app.get('/api/reports/forecast/csv', (req, res) => {
  const forecast = sensorData.demandForecast.dailyForecast || [];
  const csvHeader = 'day,value,status\n';
  const csvBody = forecast.map(f => `${f.day},${f.value},${f.status}`).join('\n');

  res.setHeader('Content-Type', 'text/csv');
  res.setHeader('Content-Disposition', 'attachment; filename="forecast_report.csv"');
  res.send(csvHeader + csvBody);
});

app.get('/api/zone-quality', (req, res) => {
  res.json(sensorData.zoneQuality);
});

app.get('/api/pipeline-integrity', (req, res) => {
  res.json(sensorData.pipelineIntegrity);
});

app.get('/api/ai-insights', (req, res) => {
  res.json(sensorData.aiInsights);
});

// Dispatch Team Endpoint
app.post('/api/dispatch/leak', (req, res) => {
  const { leakId, zone, node, flow, confidence } = req.body;
  
  const dispatchJob = {
    jobId: `JOB-${Date.now()}`,
    type: 'leak_repair',
    priority: 'high',
    status: 'assigned_to_admin',
    createdAt: new Date().toISOString(),
    leak: { id: leakId, zone, node, flow, confidence },
    adminNotification: {
      recipient: 'Water Operations Admin',
      message: `Critical leak detected in ${zone} (${node}). Loss: ${flow} L/min. Confidence: ${confidence}%. Awaiting plumber assignment.`,
      actionRequired: 'Assign available plumbers for immediate repair'
    },
    estimatedArrivalTime: '15-25 minutes',
    assignedPlumbers: []
  };
  
  console.log(`[DISPATCH] Leak repair job created: ${dispatchJob.jobId}`);
  console.log(`[ADMIN ALERT] ${dispatchJob.adminNotification.message}`);
  
  res.json({
    success: true,
    message: 'Dispatch job sent to admin. Plumbers will be assigned immediately.',
    job: dispatchJob
  });
});

// Get dispatch jobs (for admin dashboard)
app.get('/api/dispatch/jobs', (req, res) => {
  const jobs = [
    {
      jobId: 'JOB-1711610400000',
      type: 'leak_repair',
      priority: 'high',
      status: 'awaiting_plumber_assignment',
      leak: { zone: 'Sector 7-B', node: 'N-047', flow: 4.2, confidence: 97.3 },
      createdAt: new Date(Date.now() - 300000).toISOString(),
      estimatedArrivalTime: '12-20 minutes'
    }
  ];
  res.json(jobs);
});

// Admin assigns plumbers to job
app.post('/api/dispatch/assign-plumbers', (req, res) => {
  const { jobId, plumberIds } = req.body;
  
  const assignment = {
    jobId,
    assignedPlumbers: plumberIds || ['PLB-001', 'PLB-002'],
    assignmentTime: new Date().toISOString(),
    status: 'en_route',
    estimatedArrival: new Date(Date.now() + 900000).toISOString()
  };
  
  console.log(`[DISPATCH] Plumbers assigned to ${jobId}: ${assignment.assignedPlumbers.join(', ')}`);
  
  res.json({
    success: true,
    message: 'Plumbers dispatched. ETA 15 minutes.',
    assignment
  });
});

app.get('/api/thresholds', (req, res) => {
  res.json(sensorData.thresholds);
});

app.post('/api/thresholds', (req, res) => {
  const { parameter, min, max } = req.body;
  
  if (!parameter || min === undefined || max === undefined) {
    return res.status(400).json({ error: 'Missing parameter, min, or max' });
  }

  // Find and update the threshold
  const threshold = sensorData.thresholds.waterQuality.find(t => t.parameter === parameter);
  if (threshold) {
    threshold.min = parseFloat(min);
    threshold.max = parseFloat(max);
    console.log(`[THRESHOLD] Updated ${parameter}: min=${threshold.min}, max=${threshold.max}`);
    res.json({ success: true, parameter, min: threshold.min, max: threshold.max, message: 'Threshold updated successfully' });
  } else {
    res.status(404).json({ error: 'Threshold parameter not found' });
  }
});

// Bulk update thresholds
app.post('/api/thresholds/bulk', (req, res) => {
  const { thresholds } = req.body;
  
  if (!Array.isArray(thresholds)) {
    return res.status(400).json({ error: 'Expected array of thresholds' });
  }

  let updated = 0;
  thresholds.forEach(newThreshold => {
    const existing = sensorData.thresholds.waterQuality.find(t => t.parameter === newThreshold.parameter);
    if (existing) {
      existing.min = parseFloat(newThreshold.min);
      existing.max = parseFloat(newThreshold.max);
      console.log(`[THRESHOLD] Bulk updated ${newThreshold.parameter}: min=${existing.min}, max=${existing.max}`);
      updated++;
    }
  });

  res.json({
    success: true,
    updated,
    total: thresholds.length,
    message: `${updated}/${thresholds.length} thresholds updated successfully`,
    thresholds: sensorData.thresholds.waterQuality
  });
});

// Historical data endpoint (simulated)
app.get('/api/history/:metric', (req, res) => {
  const { metric } = req.params;
  const { period = '24h' } = req.query;
  
  const dataPoints = period === '24h' ? 24 : period === '7d' ? 168 : 30;
  const history = Array.from({ length: dataPoints }, (_, i) => ({
    timestamp: new Date(Date.now() - (dataPoints - i) * 3600000).toISOString(),
    value: Math.random() * 100
  }));
  
  res.json({ metric, period, data: history });
});

// AI Prediction Model Endpoint
app.get('/api/ai/predictions', (req, res) => {
  // Synthetic AI model predictions
  const predictions = {
    leakPrediction: {
      nextLeakProbability: 23.5,
      riskLevel: 'Low',
      predictedLocation: 'Sector 5-C',
      confidence: 87.3,
      timeframe: '72 hours',
      factors: [
        { factor: 'Pipeline age', impact: 'Medium', score: 65 },
        { factor: 'Pressure fluctuation', impact: 'Low', score: 32 },
        { factor: 'Historical patterns', impact: 'High', score: 78 }
      ]
    },
    demandPrediction: {
      next24h: [
        { hour: 0, demand: 2.1, confidence: 94 },
        { hour: 6, demand: 2.8, confidence: 92 },
        { hour: 12, demand: 3.1, confidence: 95 },
        { hour: 18, demand: 3.4, confidence: 93 },
        { hour: 24, demand: 2.3, confidence: 91 }
      ],
      peakTime: '18:30',
      peakDemand: 3.4,
      modelAccuracy: 94.2
    },
    maintenancePrediction: {
      pumps: [
        { id: 'P-003', priority: 'High', daysUntilFailure: 12, confidence: 89 },
        { id: 'P-002', priority: 'Medium', daysUntilFailure: 45, confidence: 76 }
      ],
      valves: [
        { id: 'V-007', priority: 'Medium', daysUntilFailure: 28, confidence: 82 }
      ],
      sensors: [
        { id: 'S-TDS-01', priority: 'Low', daysUntilFailure: 90, confidence: 71 }
      ]
    },
    waterQualityPrediction: {
      next7Days: [
        { day: 1, wqi: 87, status: 'Good', confidence: 93 },
        { day: 2, wqi: 86, status: 'Good', confidence: 91 },
        { day: 3, wqi: 82, status: 'Fair', confidence: 88 },
        { day: 4, wqi: 79, status: 'Fair', confidence: 85 },
        { day: 5, wqi: 84, status: 'Good', confidence: 89 },
        { day: 6, wqi: 88, status: 'Good', confidence: 92 },
        { day: 7, wqi: 89, status: 'Good', confidence: 94 }
      ],
      alerts: [
        { day: 3, parameter: 'Turbidity', reason: 'Monsoon effect', severity: 'Medium' },
        { day: 4, parameter: 'pH', reason: 'Seasonal variation', severity: 'Low' }
      ]
    },
    irrigationOptimization: {
      recommendations: [
        { zone: 'Z-001', action: 'Reduce threshold to 28%', savings: '12%', confidence: 91 },
        { zone: 'Z-003', action: 'Shift schedule to 4 AM', savings: '8%', confidence: 87 },
        { zone: 'Z-006', action: 'Increase duration by 5 min', savings: '-3%', confidence: 84 }
      ],
      totalPotentialSavings: 1850,
      implementationComplexity: 'Low'
    },
    anomalyDetection: {
      detected: [
        { type: 'Flow anomaly', location: 'N-023', severity: 'Medium', timestamp: new Date(Date.now() - 3600000).toISOString() },
        { type: 'Pressure spike', location: 'N-031', severity: 'Low', timestamp: new Date(Date.now() - 7200000).toISOString() }
      ],
      falsePositiveRate: 4.2,
      detectionAccuracy: 95.8
    }
  };
  
  res.json(predictions);
});

// AI Chat Endpoint
app.post('/api/ai/chat', (req, res) => {
  const { message } = req.body;
  
  // Simple AI response logic
  let response = {
    message: '',
    suggestions: [],
    data: null
  };
  
  const msg = message.toLowerCase();
  
  if (msg.includes('leak')) {
    response.message = `Based on current data, we have ${sensorData.leaks.length} active leaks. The most critical is in ${sensorData.leaks[0].zone} with ${sensorData.leaks[0].flow} L/min loss. I recommend immediate inspection and repair.`;
    response.suggestions = ['View leak details', 'Schedule maintenance', 'Check pipeline integrity'];
    response.data = sensorData.leaks;
  } else if (msg.includes('irrigation') || msg.includes('water save')) {
    response.message = `Your irrigation system has saved ${sensorData.irrigation.totalWaterSaved} liters today. ${sensorData.irrigation.activeZones} zones are currently active. The auto-control system is working efficiently.`;
    response.suggestions = ['View zone details', 'Adjust thresholds', 'Optimize schedule'];
    response.data = sensorData.irrigation;
  } else if (msg.includes('forecast') || msg.includes('demand')) {
    response.message = `Demand forecast for next 7 days averages ${sensorData.demandForecast.forecast7Day.value} MLD with ${sensorData.demandForecast.forecast7Day.confidence}% confidence. Peak demand expected at ${sensorData.demandForecast.today.peakTime}.`;
    response.suggestions = ['View detailed forecast', 'Sector breakdown', 'Risk assessment'];
    response.data = sensorData.demandForecast;
  } else {
    response.message = 'I can help you with leak detection, irrigation optimization, demand forecasting, water quality monitoring, and system efficiency. What would you like to know?';
    response.suggestions = ['Analyze leaks', 'Optimize irrigation', 'View forecast'];
  }
  
  res.json(response);
});

// Hardware integration endpoint (placeholder)
app.post('/api/hardware/data', (req, res) => {
  if (process.env.HARDWARE_ENABLED === 'true') {
    const { sensor, value } = req.body;
    // Update sensor data from hardware
    console.log(`Hardware data received: ${sensor} = ${value}`);
    res.json({ success: true, message: 'Data received' });
  } else {
    res.status(503).json({ error: 'Hardware integration not enabled' });
  }
});

const server = app.listen(PORT, () => {
  console.log(`🚀 AquaSync Backend running on http://localhost:${PORT}`);
  console.log(`📊 Dashboard API: http://localhost:${PORT}/api/dashboard`);
});

// WebSocket for real-time updates
const wss = new WebSocket.Server({ server });

wss.on('connection', (ws) => {
  console.log('📡 Client connected to WebSocket');
  
  // Send initial data
  ws.send(JSON.stringify({ type: 'init', data: sensorData }));
  
  // Simulate real-time updates every 5 seconds
  const interval = setInterval(() => {
    // Simulate sensor fluctuations
    sensorData.waterQuality.wqi = (87 + Math.random() * 3).toFixed(1);
    sensorData.waterQuality.ph = (7.1 + Math.random() * 0.3).toFixed(1);
    sensorData.waterQuality.tds = Math.floor(140 + Math.random() * 10);
    sensorData.waterQuality.flowRate = (12 + Math.random() * 2).toFixed(1);
    sensorData.demand.current = (2.4 + Math.random() * 0.3).toFixed(2);
    
    // Update soil moisture and auto-control sprinklers (only in auto mode)
    let activeCount = 0;
    let scheduledCount = 0;
    
    sensorData.irrigation.zones.forEach(zone => {
      // Only apply auto-control if mode is 'auto' and no manual override
      if (sensorData.irrigation.mode === 'auto' && !zone.manualOverride) {
        if (zone.sprinklerStatus === 'active') {
          // Increase moisture while sprinkler is active
          zone.soilMoisture = Math.min(100, zone.soilMoisture + 0.5);
          zone.waterUsed += 5;
          zone.duration += 0.083; // Add 5 seconds in minutes
          zone.flowRate = 10 + Math.random() * 5;
          
          // Stop when moisture reaches 40%
          if (zone.soilMoisture >= 40) {
            zone.sprinklerStatus = 'idle';
            zone.flowRate = 0;
            console.log(`🌱 Auto-stopped sprinkler for ${zone.name} - Moisture: ${zone.soilMoisture}%`);
          } else {
            activeCount++;
          }
        } else {
          // Decrease moisture when idle
          zone.soilMoisture = Math.max(0, zone.soilMoisture - 0.2);
          zone.flowRate = 0;
          
          // Auto-activate when below threshold
          if (zone.soilMoisture < zone.threshold) {
            zone.sprinklerStatus = 'active';
            zone.duration = 0;
            activeCount++;
            console.log(`🌱 Auto-activated sprinkler for ${zone.name} - Moisture: ${zone.soilMoisture}%`);
          } else if (zone.soilMoisture < zone.threshold + 5) {
            zone.sprinklerStatus = 'scheduled';
            scheduledCount++;
          } else {
            zone.sprinklerStatus = 'idle';
          }
        }
      } else if (zone.sprinklerStatus === 'active') {
        // Manual mode - just update stats
        zone.soilMoisture = Math.min(100, zone.soilMoisture + 0.5);
        zone.waterUsed += 5;
        zone.duration += 0.083;
        zone.flowRate = 10 + Math.random() * 5;
        activeCount++;
      }
    });
    
    sensorData.irrigation.activeZones = activeCount;
    sensorData.irrigation.scheduledZones = scheduledCount;
    sensorData.irrigation.avgMoisture = Math.round(
      sensorData.irrigation.zones.reduce((sum, z) => sum + z.soilMoisture, 0) / sensorData.irrigation.zones.length
    );
    
    ws.send(JSON.stringify({ type: 'update', data: sensorData }));
  }, 5000);
  
  ws.on('close', () => {
    console.log('📡 Client disconnected');
    clearInterval(interval);
  });
});
