const API_URL = 'http://localhost:3000/api';
let ws = null;

class AquaSyncApp {
  constructor() {
    this.data = null;
    this.currentTab = 'overview';
    this.init();
  }

  async init() {
    this.setupEventListeners();
    this.startClock();
    await this.connectWebSocket();
    await this.loadData();
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
          this.data = message.data;
          this.render();
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
      this.render();
    } catch (error) {
      console.error('Failed to load data:', error);
    }
  }

  async refreshData() {
    await this.loadData();
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
  }

  renderAlerts() {
    const container = document.getElementById('alert-container');
    const criticalLeaks = this.data.leaks.filter(l => l.severity === 'critical');
    
    if (criticalLeaks.length > 0) {
      const leak = criticalLeaks[0];
      container.innerHTML = `
        <div class="alert">
          <div class="alert-content">
            <div class="alert-title">⚠️ Critical Leak Detected — ${leak.flow} L/min loss</div>
            <div class="alert-sub">📍 ${leak.zone} · Node ${leak.node} · ${leak.time} · Confidence ${leak.confidence}%</div>
          </div>
          <button class="alert-close" onclick="this.parentElement.remove()">✕</button>
        </div>
      `;
    } else {
      container.innerHTML = '';
    }
  }

  renderOverview() {
    const { waterQuality, demand, leaks, stp, pumps } = this.data;
    
    return `
      <div class="kpi-row">
        <div class="kpi">
          <div class="kpi-header">
            <div class="kpi-ico" style="background:var(--teal-light);color:var(--teal)">
              <svg viewBox="0 0 24 24"><path d="M12 2C6 2 4 8 4 12c0 4.4 3.6 8 8 8s8-3.6 8-8c0-4-2-10-8-10z"/></svg>
            </div>
            <span class="kpi-trend trend-up">▲ 2.1%</span>
          </div>
          <div class="kpi-label">Water Quality Index</div>
          <div class="kpi-value">${waterQuality.wqi}</div>
          <div class="kpi-sub" style="color:var(--green)">GOOD · WHO Compliant</div>
          <div class="kpi-bar"><div class="kpi-bar-fill" style="width:${waterQuality.wqi}%;background:var(--teal)"></div></div>
        </div>

        <div class="kpi">
          <div class="kpi-header">
            <div class="kpi-ico" style="background:var(--blue-light);color:var(--blue)">
              <svg viewBox="0 0 24 24"><polyline points="22 12 18 12 15 21 9 3 6 12 2 12"/></svg>
            </div>
            <span class="kpi-trend trend-up">▲ 0.3 MLD</span>
          </div>
          <div class="kpi-label">Total Demand (Today)</div>
          <div class="kpi-value">${demand.current}<span style="font-size:14px;font-weight:500;color:var(--text-3)"> MLD</span></div>
          <div class="kpi-sub">Peak at ${demand.peakTime} → ${demand.peak} MLD</div>
          <div class="kpi-bar"><div class="kpi-bar-fill" style="width:70%;background:var(--blue)"></div></div>
        </div>

        <div class="kpi">
          <div class="kpi-header">
            <div class="kpi-ico" style="background:var(--red-light);color:var(--red)">
              <svg viewBox="0 0 24 24"><path d="M4 15s1-1 4-1 5 2 8 2 4-1 4-1V3s-1 1-4 1-5-2-8-2-4 1-4 1z"/></svg>
            </div>
            <span class="kpi-trend trend-down">▼ NRW</span>
          </div>
          <div class="kpi-label">Water Loss Rate</div>
          <div class="kpi-value">18.2<span style="font-size:14px;font-weight:500;color:var(--text-3)">%</span></div>
          <div class="kpi-sub" style="color:var(--red)">${leaks.length} leaks active</div>
          <div class="kpi-bar"><div class="kpi-bar-fill" style="width:18.2%;background:var(--red)"></div></div>
        </div>

        <div class="kpi">
          <div class="kpi-header">
            <div class="kpi-ico" style="background:var(--green-light);color:var(--green)">
              <svg viewBox="0 0 24 24"><circle cx="12" cy="12" r="3"/><path d="M19.07 4.93a10 10 0 0 1 0 14.14M4.93 4.93a10 10 0 0 0 0 14.14"/></svg>
            </div>
            <span class="kpi-trend trend-up">▲ 1.2%</span>
          </div>
          <div class="kpi-label">STP Efficiency</div>
          <div class="kpi-value">${stp.efficiency}<span style="font-size:14px;font-weight:500;color:var(--text-3)">%</span></div>
          <div class="kpi-sub" style="color:var(--green)">Above threshold</div>
          <div class="kpi-bar"><div class="kpi-bar-fill" style="width:${stp.efficiency}%;background:var(--green)"></div></div>
        </div>
      </div>

      <div class="grid-2">
        <div class="panel">
          <div class="panel-header">
            <div class="panel-title">Active Leaks</div>
          </div>
          <div class="panel-body">
            <div class="leak-list">
              ${leaks.map(leak => `
                <div class="leak-item leak-${leak.severity}">
                  <div class="leak-top">
                    <div class="leak-zone">${leak.zone}</div>
                    <div class="leak-sev" style="background:${leak.severity === 'critical' ? 'var(--red)' : leak.severity === 'medium' ? 'var(--amber)' : 'var(--blue)'}">${leak.severity.toUpperCase()}</div>
                  </div>
                  <div class="leak-meta">
                    <span>Node ${leak.node}</span>
                    <span>• ${leak.flow} L/min</span>
                    <span>• ${leak.confidence}% confidence</span>
                  </div>
                </div>
              `).join('')}
            </div>
          </div>
        </div>

        <div class="panel">
          <div class="panel-header">
            <div class="panel-title">Pump Stations</div>
          </div>
          <div class="panel-body">
            <div class="grid-2">
              ${pumps.map(pump => `
                <div class="param-card">
                  <div class="param-name">${pump.id}</div>
                  <div class="param-val">${pump.efficiency}%</div>
                  <div class="param-status status-${pump.status === 'operational' ? 'ok' : pump.status === 'warning' ? 'warn' : 'bad'}">${pump.status.toUpperCase()}</div>
                </div>
              `).join('')}
            </div>
          </div>
        </div>
      </div>
    `;
  }

  renderQuality() {
    const { waterQuality, zoneQuality } = this.data;
    
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
              <button class="btn btn-primary">Dispatch All Teams</button>
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
      <div class="panel">
        <div class="panel-header">
          <div class="panel-title">Network Map</div>
        </div>
        <div class="panel-body">
          <div class="map-box">
            ${network.nodes.map(node => `
              <div class="node node-${node.status}" 
                   style="left:${node.x}%;top:${node.y}%"
                   title="${node.id} - Pressure: ${node.pressure} bar">
              </div>
            `).join('')}
          </div>
        </div>
      </div>
    `;
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
}

// Initialize app
const app = new AquaSyncApp();
window.app = app;

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
          <div class="kpi-value">${Math.round(irrigation.zones.reduce((a,z) => a + z.soilMoisture, 0) / irrigation.zones.length)}<span style="font-size:14px;font-weight:500;color:var(--text-3)">%</span></div>
          <div class="kpi-sub">Threshold: 30%</div>
        </div>
      </div>

      <div class="panel">
        <div class="panel-header">
          <div class="panel-title">🌱 Irrigation Zones - Auto Control Active</div>
          <span class="badge badge-green">SMART MODE</span>
        </div>
        <div class="panel-body">
          <div class="grid-3">
            ${irrigation.zones.map(zone => `
              <div class="irrigation-card ${zone.sprinklerStatus === 'active' ? 'active' : ''}">
                <div class="irr-header">
                  <div class="irr-name">${zone.name}</div>
                  <div class="irr-status status-${zone.sprinklerStatus === 'active' ? 'active' : zone.sprinklerStatus === 'scheduled' ? 'scheduled' : 'idle'}">
                    ${zone.sprinklerStatus === 'active' ? '💧 WATERING' : zone.sprinklerStatus === 'scheduled' ? '⏰ SCHEDULED' : '✓ IDLE'}
                  </div>
                </div>
                <div class="irr-moisture">
                  <div class="irr-label">Soil Moisture</div>
                  <div class="irr-value">${zone.soilMoisture}%</div>
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
                <button class="btn-control btn-green">Control</button>
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
                <button class="btn-control btn-blue">Control</button>
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
                <button class="btn-control btn-red">Silence</button>
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
                <button class="btn-control btn-amber">Manage</button>
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
            <div class="kpi-ico" style="background:var(--green-light);color:var(--green)">
              <svg viewBox="0 0 24 24"><path d="M22 11.08V12a10 10 0 1 1-5.93-9.14"/><polyline points="22 4 12 14.01 9 11.01"/></svg>
            </div>
            <span class="kpi-trend trend-up">▲ ${analytics.waterSavings.percentage}%</span>
          </div>
          <div class="kpi-label">Water Savings (Month)</div>
          <div class="kpi-value">${analytics.waterSavings.month}<span style="font-size:14px;font-weight:500;color:var(--text-3)"> kL</span></div>
          <div class="kpi-sub" style="color:var(--green)">Today: ${analytics.waterSavings.today}% saved</div>
        </div>

        <div class="kpi">
          <div class="kpi-header">
            <div class="kpi-ico" style="background:var(--blue-light);color:var(--blue)">
              <svg viewBox="0 0 24 24"><path d="M12 20V10M18 20V4M6 20v-4"/></svg>
            </div>
            <span class="kpi-trend trend-up">▲ ${analytics.leakPrevention.prevented}</span>
          </div>
          <div class="kpi-label">Leaks Prevented</div>
          <div class="kpi-value">${analytics.leakPrevention.prevented}<span style="font-size:14px;font-weight:500;color:var(--text-3)"> / ${analytics.leakPrevention.detected}</span></div>
          <div class="kpi-sub">${analytics.leakPrevention.savedLiters}L saved</div>
        </div>

        <div class="kpi">
          <div class="kpi-header">
            <div class="kpi-ico" style="background:var(--purple-light);color:var(--purple)">
              <svg viewBox="0 0 24 24"><circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/></svg>
            </div>
            <span class="kpi-trend trend-up">▲ 2.3%</span>
          </div>
          <div class="kpi-label">Overall Efficiency</div>
          <div class="kpi-value">${analytics.efficiency.overall}<span style="font-size:14px;font-weight:500;color:var(--text-3)">%</span></div>
          <div class="kpi-sub" style="color:var(--green)">Above target</div>
        </div>
      </div>

      <div class="grid-2">
        <div class="panel">
          <div class="panel-header">
            <div class="panel-title">🤖 AI Predictions & Insights</div>
          </div>
          <div class="panel-body">
            <div class="prediction-grid">
              <div class="pred-card">
                <div class="pred-icon" style="background:var(--green-light);color:var(--green)">
                  <svg viewBox="0 0 24 24" width="24" height="24"><path d="M22 11.08V12a10 10 0 1 1-5.93-9.14"/><polyline points="22 4 12 14.01 9 11.01"/></svg>
                </div>
                <div class="pred-content">
                  <div class="pred-label">Next Leak Risk</div>
                  <div class="pred-value">${analytics.predictions.nextLeakRisk}</div>
                  <div class="pred-desc">Based on pressure patterns</div>
                </div>
              </div>

              <div class="pred-card">
                <div class="pred-icon" style="background:var(--amber-light);color:var(--amber)">
                  <svg viewBox="0 0 24 24" width="24" height="24"><path d="M12 20V10M18 20V4M6 20v-4"/></svg>
                </div>
                <div class="pred-content">
                  <div class="pred-label">Maintenance Due</div>
                  <div class="pred-value">${analytics.predictions.maintenanceDue}</div>
                  <div class="pred-desc">Pump P-003 inspection</div>
                </div>
              </div>

              <div class="pred-card">
                <div class="pred-icon" style="background:var(--blue-light);color:var(--blue)">
                  <svg viewBox="0 0 24 24" width="24" height="24"><polyline points="22 12 18 12 15 21 9 3 6 12 2 12"/></svg>
                </div>
                <div class="pred-content">
                  <div class="pred-label">Peak Demand</div>
                  <div class="pred-value">${analytics.predictions.peakDemandTime}</div>
                  <div class="pred-desc">Predicted for today</div>
                </div>
              </div>

              <div class="pred-card">
                <div class="pred-icon" style="background:var(--purple-light);color:var(--purple)">
                  <svg viewBox="0 0 24 24" width="24" height="24"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="17 8 12 3 7 8"/><line x1="12" y1="3" x2="12" y2="15"/></svg>
                </div>
                <div class="pred-content">
                  <div class="pred-label">Recommended Action</div>
                  <div class="pred-value" style="font-size:11px">${analytics.predictions.recommendedAction}</div>
                  <div class="pred-desc">AI suggestion</div>
                </div>
              </div>
            </div>
          </div>
        </div>

        <div class="panel">
          <div class="panel-header">
            <div class="panel-title">📊 Efficiency Breakdown</div>
          </div>
          <div class="panel-body">
            <div class="efficiency-list">
              <div class="eff-item">
                <div class="eff-label">Distribution Network</div>
                <div class="eff-bar-container">
                  <div class="eff-bar">
                    <div class="eff-fill" style="width:${analytics.efficiency.distribution}%;background:var(--green)"></div>
                  </div>
                  <div class="eff-value">${analytics.efficiency.distribution}%</div>
                </div>
              </div>

              <div class="eff-item">
                <div class="eff-label">Irrigation System</div>
                <div class="eff-bar-container">
                  <div class="eff-bar">
                    <div class="eff-fill" style="width:${analytics.efficiency.irrigation}%;background:var(--blue)"></div>
                  </div>
                  <div class="eff-value">${analytics.efficiency.irrigation}%</div>
                </div>
              </div>

              <div class="eff-item">
                <div class="eff-label">Overall System</div>
                <div class="eff-bar-container">
                  <div class="eff-bar">
                    <div class="eff-fill" style="width:${analytics.efficiency.overall}%;background:var(--purple)"></div>
                  </div>
                  <div class="eff-value">${analytics.efficiency.overall}%</div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>

      <div class="panel">
        <div class="panel-header">
          <div class="panel-title">💡 Operational Philosophy: Sense → Predict → Decide → Act</div>
        </div>
        <div class="panel-body">
          <div class="philosophy-grid">
            <div class="phil-card">
              <div class="phil-num">01</div>
              <div class="phil-title">SENSE</div>
              <div class="phil-desc">Real-time monitoring with IoT sensors across the entire water infrastructure</div>
            </div>
            <div class="phil-arrow">→</div>
            <div class="phil-card">
              <div class="phil-num">02</div>
              <div class="phil-title">PREDICT</div>
              <div class="phil-desc">AI/ML algorithms predict failures, demand patterns, and optimize operations</div>
            </div>
            <div class="phil-arrow">→</div>
            <div class="phil-card">
              <div class="phil-num">03</div>
              <div class="phil-title">DECIDE</div>
              <div class="phil-desc">Intelligent decision engine determines optimal actions based on data</div>
            </div>
            <div class="phil-arrow">→</div>
            <div class="phil-card">
              <div class="phil-num">04</div>
              <div class="phil-title">ACT</div>
              <div class="phil-desc">Automated responses via actuators - pumps, valves, sprinklers, alerts</div>
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
          <div class="panel-body">
            <div class="forecast-chart">
              <svg viewBox="0 0 600 200" style="width:100%;height:200px">
                <defs>
                  <linearGradient id="forecastGradient" x1="0%" y1="0%" x2="0%" y2="100%">
                    <stop offset="0%" style="stop-color:var(--blue);stop-opacity:0.2" />
                    <stop offset="100%" style="stop-color:var(--blue);stop-opacity:0" />
                  </linearGradient>
                  <linearGradient id="confidenceGradient" x1="0%" y1="0%" x2="0%" y2="100%">
                    <stop offset="0%" style="stop-color:var(--blue);stop-opacity:0.1" />
                    <stop offset="100%" style="stop-color:var(--blue);stop-opacity:0.05" />
                  </linearGradient>
                </defs>
                <!-- Confidence band -->
                <path d="M 0 90 L 100 85 L 200 80 L 300 70 L 400 75 L 500 80 L 600 85 L 600 110 L 500 105 L 400 100 L 300 95 L 200 100 L 100 105 L 0 110 Z" 
                      fill="url(#confidenceGradient)" stroke="none"/>
                <!-- Actual line -->
                <path d="M 0 100 L 100 95 L 200 90" 
                      fill="none" stroke="var(--blue)" stroke-width="2.5"/>
                <!-- Forecast line -->
                <path d="M 200 90 L 300 82 L 400 87 L 500 92 L 600 95" 
                      fill="none" stroke="var(--blue)" stroke-width="2.5" stroke-dasharray="5,5"/>
                <circle cx="200" cy="90" r="4" fill="var(--blue)"/>
              </svg>
              <div class="forecast-labels">
                <span>Today</span>
                <span>Tue</span>
                <span>Wed</span>
                <span>Thu</span>
                <span>Fri</span>
                <span>Sat</span>
                <span>Sun</span>
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
    `;
  }

  renderThresholds() {
    const { thresholds } = this.data;
    
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
              <span class="badge badge-blue">6 PARAMS</span>
            </div>
            
            <div class="threshold-table">
              <div class="threshold-table-header">
                <div class="th-col th-param">PARAMETER</div>
                <div class="th-col th-min">MIN</div>
                <div class="th-col th-max">MAX</div>
                <div class="th-col th-unit">UNIT</div>
              </div>
              
              ${thresholds.waterQuality.map(param => `
                <div class="threshold-table-row">
                  <div class="th-col th-param">${param.parameter}</div>
                  <div class="th-col th-min">
                    <input type="number" class="threshold-input" value="${param.min}" step="0.1" />
                  </div>
                  <div class="th-col th-max">
                    <input type="number" class="threshold-input" value="${param.max}" step="0.1" />
                  </div>
                  <div class="th-col th-unit">${param.unit}</div>
                </div>
              `).join('')}
            </div>
          </div>

          <div class="threshold-actions">
            <button class="btn btn-primary">💾 Save Thresholds</button>
            <button class="btn btn-ghost">↺ Reset to Defaults</button>
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
              <button class="btn btn-primary btn-sm">Generate PDF</button>
            </div>

            <div class="report-card">
              <div class="report-icon" style="background:var(--green-light);color:var(--green)">
                <svg viewBox="0 0 24 24" width="24" height="24"><polyline points="22 12 18 12 15 21 9 3 6 12 2 12"/></svg>
              </div>
              <div class="report-title">Weekly Analytics</div>
              <div class="report-desc">Trends, forecasts, efficiency metrics</div>
              <button class="btn btn-primary btn-sm">Generate PDF</button>
            </div>

            <div class="report-card">
              <div class="report-icon" style="background:var(--red-light);color:var(--red)">
                <svg viewBox="0 0 24 24" width="24" height="24"><circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="12"/></svg>
              </div>
              <div class="report-title">Incident Report</div>
              <div class="report-desc">Leak detections, response times</div>
              <button class="btn btn-primary btn-sm">Generate PDF</button>
            </div>

            <div class="report-card">
              <div class="report-icon" style="background:var(--purple-light);color:var(--purple)">
                <svg viewBox="0 0 24 24" width="24" height="24"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="7 10 12 15 17 10"/><line x1="12" y1="15" x2="12" y2="3"/></svg>
              </div>
              <div class="report-title">Export Raw Data</div>
              <div class="report-desc">CSV/JSON export for analysis</div>
              <button class="btn btn-primary btn-sm" onclick="app.exportData()">Export JSON</button>
            </div>
          </div>
        </div>
      </div>
    `;
  }
