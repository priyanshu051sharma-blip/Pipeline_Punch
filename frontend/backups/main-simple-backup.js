class AquaSyncApp {
  constructor() {
    this.data = null;
    this.ws = null;
    this.currentTab = 'overview';
    this.init();
  }

  init() {
    this.setupNavigation();
    this.connectWebSocket();
    this.startClock();
    this.fetchInitialData();
  }

  setupNavigation() {
    document.querySelectorAll('.nav-item').forEach(btn => {
      btn.addEventListener('click', (e) => {
        const tab = e.currentTarget.dataset.tab;
        this.switchTab(tab);
      });
    });
  }

  switchTab(tab) {
    this.currentTab = tab;
    document.querySelectorAll('.nav-item').forEach(btn => {
      btn.classList.toggle('active', btn.dataset.tab === tab);
    });
    
    const titles = {
      overview: 'System Overview',
      quality: 'Water Quality Monitoring',
      leaks: 'Leak Detection & Analysis',
      network: 'Network Map & Pipeline',
      irrigation: 'Smart Irrigation Control',
      hardware: 'Hardware Status',
      analytics: 'Analytics & AI Insights',
      forecast: 'Demand Forecast',
      'ai-predictions': 'AI Predictions & ML Models',
      thresholds: 'Threshold Configuration',
      reports: 'Reports & Export'
    };
    
    document.getElementById('page-title').textContent = titles[tab] || 'Dashboard';
    this.render();
  }

  async fetchInitialData() {
    try {
      const response = await fetch('http://localhost:3000/api/dashboard');
      this.data = await response.json();
      this.render();
    } catch (error) {
      console.error('Failed to fetch data:', error);
    }
  }

  connectWebSocket() {
    this.ws = new WebSocket('ws://localhost:3000');
    
    this.ws.onopen = () => {
      console.log('WebSocket connected');
      document.getElementById('connection-status').textContent = 'LIVE';
    };
    
    this.ws.onmessage = (event) => {
      const message = JSON.parse(event.data);
      if (message.type === 'init' || message.type === 'update') {
        this.data = message.data;
        this.render();
      }
    };
    
    this.ws.onerror = () => {
      document.getElementById('connection-status').textContent = 'ERROR';
    };
    
    this.ws.onclose = () => {
      document.getElementById('connection-status').textContent = 'DISCONNECTED';
      setTimeout(() => this.connectWebSocket(), 5000);
    };
  }

  startClock() {
    const updateClock = () => {
      const now = new Date();
      const time = now.toLocaleTimeString('en-US', { hour12: false });
      document.getElementById('clock').textContent = time;
    };
    updateClock();
    setInterval(updateClock, 1000);
  }

  render() {
    if (!this.data) {
      document.getElementById('app-content').innerHTML = '<div style="padding:40px;text-align:center;color:var(--text-3)">Loading...</div>';
      return;
    }

    console.log('Rendering tab:', this.currentTab);
    console.log('Data available:', Object.keys(this.data));

    const content = document.getElementById('app-content');
    
    switch(this.currentTab) {
      case 'overview': content.innerHTML = this.renderOverview(); break;
      case 'quality': content.innerHTML = this.renderQuality(); break;
      case 'leaks': content.innerHTML = this.renderLeaks(); break;
      case 'network': content.innerHTML = this.renderNetwork(); break;
      case 'irrigation': content.innerHTML = this.renderIrrigation(); break;
      case 'hardware': content.innerHTML = this.renderHardware(); break;
      case 'analytics': content.innerHTML = this.renderAnalytics(); break;
      case 'forecast': content.innerHTML = this.renderForecast(); break;
      case 'ai-predictions': content.innerHTML = this.renderAIPredictions(); break;
      case 'thresholds': content.innerHTML = this.renderThresholds(); break;
      case 'reports': content.innerHTML = this.renderReports(); break;
    }
    
    if (this.data.leaks) {
      const badge = document.getElementById('leak-count');
      if (badge) badge.textContent = this.data.leaks.length;
    }
  }

  renderOverview() {
    const wq = this.data.waterQuality || {};
    const demand = this.data.demand || {};
    const leaks = this.data.leaks || [];
    const pumps = this.data.pumps || [];
    const stp = this.data.stp || {};
    const aiInsights = this.data.aiInsights || [];
    
    return `
      <div class="kpi-row">
        <div class="kpi">
          <div class="kpi-header">
            <div class="kpi-ico" style="background:var(--blue-light);color:var(--blue)">
              <svg viewBox="0 0 24 24"><path d="M12 2.69l5.66 5.66a8 8 0 1 1-11.31 0z"/></svg>
            </div>
            <span class="kpi-trend trend-up">+2.3%</span>
          </div>
          <div class="kpi-label">WATER QUALITY INDEX</div>
          <div class="kpi-value">${wq.wqi || 0}</div>
          <div class="kpi-sub">Excellent · All parameters normal</div>
          <div class="kpi-bar"><div class="kpi-bar-fill" style="width:${wq.wqi || 0}%;background:var(--green)"></div></div>
        </div>
        
        <div class="kpi">
          <div class="kpi-header">
            <div class="kpi-ico" style="background:var(--teal-light);color:var(--teal)">
              <svg viewBox="0 0 24 24"><polyline points="22 12 18 12 15 21 9 3 6 12 2 12"/></svg>
            </div>
            <span class="kpi-trend trend-up">+0.12</span>
          </div>
          <div class="kpi-label">CURRENT DEMAND</div>
          <div class="kpi-value">${demand.current || 0} <span style="font-size:14px;font-weight:500">MLD</span></div>
          <div class="kpi-sub">Peak: ${demand.peak || 0} MLD at ${demand.peakTime || '--'}</div>
          <div class="kpi-bar"><div class="kpi-bar-fill" style="width:${(demand.current/demand.peak)*100 || 0}%;background:var(--teal)"></div></div>
        </div>
        
        <div class="kpi">
          <div class="kpi-header">
            <div class="kpi-ico" style="background:var(--red-light);color:var(--red)">
              <svg viewBox="0 0 24 24"><circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="12"/></svg>
            </div>
            <span class="kpi-trend trend-down">-1</span>
          </div>
          <div class="kpi-label">ACTIVE LEAKS</div>
          <div class="kpi-value">${leaks.length || 0}</div>
          <div class="kpi-sub">${leaks.filter(l => l.severity === 'critical').length} critical · ${leaks.filter(l => l.buzzerActive).length} buzzer active</div>
        </div>
        
        <div class="kpi">
          <div class="kpi-header">
            <div class="kpi-ico" style="background:var(--green-light);color:var(--green)">
              <svg viewBox="0 0 24 24"><path d="M12 2v20M17 7l-5 5-5-5"/></svg>
            </div>
            <span class="kpi-trend trend-up">+8.3%</span>
          </div>
          <div class="kpi-label">WATER SAVINGS TODAY</div>
          <div class="kpi-value">${demand.savings || 0} <span style="font-size:14px;font-weight:500">%</span></div>
          <div class="kpi-sub">Total: ${demand.totalToday || 0} MLD distributed</div>
          <div class="kpi-bar"><div class="kpi-bar-fill" style="width:${(demand.savings || 0)*10}%;background:var(--green)"></div></div>
        </div>
      </div>

      ${leaks.length > 0 ? `
      <div class="alert">
        <div class="alert-content">
          <div class="alert-title">🚨 ${leaks.filter(l => l.severity === 'critical').length} Critical Leak(s) Detected</div>
          <div class="alert-sub">${leaks[0].zone} · ${leaks[0].flow} L/min loss · Buzzer ${leaks[0].buzzerActive ? 'ACTIVE' : 'inactive'}</div>
        </div>
        <button class="alert-close">×</button>
      </div>
      ` : ''}

      <div class="grid-2">
        <div class="panel">
          <div class="panel-header">
            <div class="panel-title">🔴 Active Leaks</div>
            <span class="badge badge-red">${leaks.length} DETECTED</span>
          </div>
          <div class="panel-body">
            <div class="leak-list">
              ${leaks.map(leak => `
                <div class="leak-item leak-${leak.severity}">
                  <div class="leak-top">
                    <span class="leak-zone">${leak.zone} · ${leak.node}</span>
                    <span class="leak-sev" style="background:${leak.severity === 'critical' ? 'var(--red)' : leak.severity === 'medium' ? 'var(--amber)' : 'var(--blue)'}">${leak.severity.toUpperCase()}</span>
                  </div>
                  <div class="leak-meta">
                    <span>💧 ${leak.flow} L/min</span>
                    <span>📊 ${leak.confidence}% confidence</span>
                    <span>⏱ ${leak.time}</span>
                    ${leak.buzzerActive ? '<span>🔔 BUZZER ON</span>' : ''}
                  </div>
                </div>
              `).join('')}
            </div>
          </div>
        </div>

        <div class="panel">
          <div class="panel-header">
            <div class="panel-title">⚙️ Pump Status</div>
            <span class="badge badge-green">${pumps.filter(p => p.status === 'operational').length}/${pumps.length} OPERATIONAL</span>
          </div>
          <div class="panel-body">
            ${pumps.map(pump => `
              <div style="margin-bottom:16px;padding-bottom:16px;border-bottom:1px solid var(--border)">
                <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:8px">
                  <div>
                    <div style="font-size:13px;font-weight:600">${pump.name}</div>
                    <div style="font-size:10px;color:var(--text-3);font-family:'IBM Plex Mono',monospace">${pump.id}</div>
                  </div>
                  <span class="badge ${pump.status === 'operational' ? 'badge-green' : pump.status === 'warning' ? 'badge-red' : 'badge-blue'}">${pump.status.toUpperCase()}</span>
                </div>
                <div style="display:grid;grid-template-columns:repeat(3,1fr);gap:8px;font-size:11px">
                  <div><span style="color:var(--text-4)">Efficiency:</span> <strong>${pump.efficiency}%</strong></div>
                  <div><span style="color:var(--text-4)">Flow:</span> <strong>${pump.flow} LPM</strong></div>
                  <div><span style="color:var(--text-4)">Power:</span> <strong>${pump.power} kW</strong></div>
                </div>
              </div>
            `).join('')}
          </div>
        </div>
      </div>
    `;
  }

  renderQuality() {
    const wq = this.data.waterQuality || {};
    const zones = this.data.zoneQuality?.zones || [];
    const alerts = this.data.zoneQuality?.alerts || [];
    
    return `
      <div class="kpi-row">
        <div class="kpi">
          <div class="kpi-label">pH LEVEL</div>
          <div class="kpi-value">${wq.ph || 0}</div>
          <div class="kpi-sub status-ok">Optimal Range</div>
        </div>
        <div class="kpi">
          <div class="kpi-label">TURBIDITY</div>
          <div class="kpi-value">${wq.turbidity || 0} <span style="font-size:14px">NTU</span></div>
          <div class="kpi-sub status-ok">Clear Water</div>
        </div>
        <div class="kpi">
          <div class="kpi-label">TDS</div>
          <div class="kpi-value">${wq.tds || 0} <span style="font-size:14px">ppm</span></div>
          <div class="kpi-sub status-ok">Good Quality</div>
        </div>
        <div class="kpi">
          <div class="kpi-label">CHLORINE</div>
          <div class="kpi-value">${wq.chlorine || 0} <span style="font-size:14px">mg/L</span></div>
          <div class="kpi-sub status-ok">Safe Level</div>
        </div>
        <div class="kpi">
          <div class="kpi-label">TEMPERATURE</div>
          <div class="kpi-value">${wq.temperature || 0} <span style="font-size:14px">°C</span></div>
          <div class="kpi-sub status-ok">Normal</div>
        </div>
        <div class="kpi">
          <div class="kpi-label">FLOW RATE</div>
          <div class="kpi-value">${wq.flowRate || 0} <span style="font-size:14px">L/min</span></div>
          <div class="kpi-sub status-ok">Steady Flow</div>
        </div>
      </div>

      <div class="panel">
        <div class="panel-header">
          <div class="panel-title">📍 Zone Quality Heatmap</div>
          <span class="badge badge-blue">${zones.length} ZONES MONITORED</span>
        </div>
        <div class="panel-body">
          <div class="zone-heatmap">
            ${zones.map(zone => `
              <div class="zone-cell zone-${zone.status}">
                <div class="zone-id">${zone.id}</div>
                <div class="zone-wqi">${zone.wqi}</div>
              </div>
            `).join('')}
          </div>
          <div class="heatmap-legend">
            <div class="hl-item"><div class="hl-dot" style="background:var(--green)"></div> Good (>80)</div>
            <div class="hl-item"><div class="hl-dot" style="background:var(--amber)"></div> Fair (60-80)</div>
            <div class="hl-item"><div class="hl-dot" style="background:var(--red)"></div> Poor (<60)</div>
          </div>
        </div>
      </div>

      <div class="panel">
        <div class="panel-header">
          <div class="panel-title">⚠️ Quality Alerts</div>
          <span class="badge badge-red">${alerts.filter(a => a.severity === 'critical').length} CRITICAL</span>
        </div>
        <div class="panel-body">
          <div class="alerts-log">
            ${alerts.map(alert => `
              <div class="alert-log-item alert-${alert.severity}">
                <div class="alert-dot"></div>
                <div style="flex:1">
                  <div class="alert-log-title">${alert.title}</div>
                  <div class="alert-log-meta">${alert.time} · ${alert.desc}</div>
                </div>
              </div>
            `).join('')}
          </div>
        </div>
      </div>
    `;
  }

  renderLeaks() {
    const leaks = this.data.leaks || [];
    const integrity = this.data.pipelineIntegrity?.segments || [];
    
    return `
      <div class="kpi-row">
        <div class="kpi">
          <div class="kpi-label">TOTAL LEAKS DETECTED</div>
          <div class="kpi-value">${leaks.length}</div>
          <div class="kpi-sub">${leaks.filter(l => l.severity === 'critical').length} Critical · ${leaks.filter(l => l.severity === 'medium').length} Medium · ${leaks.filter(l => l.severity === 'low').length} Low</div>
        </div>
        <div class="kpi">
          <div class="kpi-label">TOTAL WATER LOSS</div>
          <div class="kpi-value">${leaks.reduce((sum, l) => sum + l.flow, 0).toFixed(1)} <span style="font-size:14px">L/min</span></div>
          <div class="kpi-sub">Estimated daily loss: ${(leaks.reduce((sum, l) => sum + l.flow, 0) * 1440).toFixed(0)} L</div>
        </div>
        <div class="kpi">
          <div class="kpi-label">AVG CONFIDENCE</div>
          <div class="kpi-value">${(leaks.reduce((sum, l) => sum + l.confidence, 0) / leaks.length).toFixed(1)} <span style="font-size:14px">%</span></div>
          <div class="kpi-sub">AI Detection Accuracy</div>
        </div>
        <div class="kpi">
          <div class="kpi-label">BUZZER ALERTS</div>
          <div class="kpi-value">${leaks.filter(l => l.buzzerActive).length}</div>
          <div class="kpi-sub">${leaks.filter(l => l.buzzerActive).length > 0 ? '🔔 Active Alerts' : 'No Active Alerts'}</div>
        </div>
      </div>

      <div class="panel">
        <div class="panel-header">
          <div class="panel-title">📋 Leak Detection Log</div>
          <span class="badge badge-red">${leaks.length} ACTIVE</span>
        </div>
        <div class="panel-body">
          <div class="leak-table">
            <div class="leak-table-header">
              <div>LEAK ID</div>
              <div>LOCATION</div>
              <div>SEVERITY</div>
              <div>WATER LOSS</div>
              <div>CONFIDENCE</div>
            </div>
            ${leaks.map(leak => `
              <div class="leak-table-row leak-row-${leak.severity}">
                <div class="lt-col lt-node">${leak.id}</div>
                <div class="lt-col">${leak.zone} · ${leak.node}</div>
                <div class="lt-col"><span class="leak-badge badge-${leak.severity}">${leak.severity.toUpperCase()}</span></div>
                <div class="lt-col lt-loss">${leak.flow} L/min</div>
                <div class="lt-col">${leak.confidence}%</div>
              </div>
            `).join('')}
          </div>
          <div class="panel-actions">
            <button class="btn btn-primary">Export Leak Report</button>
            <button class="btn btn-ghost">Schedule Maintenance</button>
          </div>
        </div>
      </div>

      <div class="panel">
        <div class="panel-header">
          <div class="panel-title">🔧 Pipeline Integrity</div>
          <span class="badge badge-blue">${integrity.length} SEGMENTS</span>
        </div>
        <div class="panel-body">
          <div class="integrity-grid">
            ${integrity.map(seg => `
              <div class="integrity-cell integrity-${seg.status}">
                <div class="int-id">${seg.id}</div>
                <div class="int-score">${seg.score}</div>
              </div>
            `).join('')}
          </div>
          <div class="integrity-legend">
            <div class="il-item"><div class="il-dot" style="background:var(--green)"></div> Good (>80)</div>
            <div class="il-item"><div class="il-dot" style="background:var(--amber)"></div> Fair (60-80)</div>
            <div class="il-item"><div class="il-dot" style="background:var(--red)"></div> Critical (<60)</div>
          </div>
        </div>
      </div>
    `;
  }

  renderNetwork() {
    const network = this.data.network || {};
    const nodes = network.nodes || [];
    const leaks = this.data.leaks || [];
    
    return `
      <div class="kpi-row">
        <div class="kpi">
          <div class="kpi-label">NETWORK NODES</div>
          <div class="kpi-value">${nodes.length}</div>
          <div class="kpi-sub">${nodes.filter(n => n.status === 'normal').length} Normal · ${nodes.filter(n => n.status === 'leak').length} Leak Detected</div>
        </div>
        <div class="kpi">
          <div class="kpi-label">AVG PRESSURE</div>
          <div class="kpi-value">${(nodes.reduce((sum, n) => sum + n.pressure, 0) / nodes.length).toFixed(1)} <span style="font-size:14px">bar</span></div>
          <div class="kpi-sub">All nodes within range</div>
        </div>
        <div class="kpi">
          <div class="kpi-label">TOTAL FLOW</div>
          <div class="kpi-value">${nodes.reduce((sum, n) => sum + n.flow, 0)} <span style="font-size:14px">LPM</span></div>
          <div class="kpi-sub">Network throughput</div>
        </div>
      </div>

      <div class="panel">
        <div class="panel-header">
          <div class="panel-title">🗺️ Pipeline Network Map</div>
          <span class="badge badge-blue">${nodes.length} NODES · ${leaks.length} LEAKS</span>
        </div>
        <div class="panel-body">
          <div style="position:relative;height:400px;background:linear-gradient(135deg,#EFF6FF 0%,#E0F2FE 50%,#ECFDF5 100%);border-radius:var(--radius);overflow:hidden;border:1px solid var(--border)">
            <svg width="100%" height="100%" style="position:absolute;top:0;left:0">
              <!-- Pipeline connections -->
              ${nodes.map((node, i) => {
                if (i < nodes.length - 1) {
                  const next = nodes[i + 1];
                  const hasLeak = leaks.some(l => l.node === node.id || l.node === next.id);
                  return `<line x1="${node.x}%" y1="${node.y}%" x2="${next.x}%" y2="${next.y}%" 
                    stroke="${hasLeak ? 'var(--red)' : 'var(--blue)'}" 
                    stroke-width="${hasLeak ? '3' : '2'}" 
                    stroke-dasharray="${hasLeak ? '5,5' : '0'}" 
                    opacity="0.6"/>`;
                }
                return '';
              }).join('')}
              
              <!-- Nodes -->
              ${nodes.map(node => `
                <g>
                  <circle cx="${node.x}%" cy="${node.y}%" r="8" 
                    fill="${node.status === 'leak' ? 'var(--red)' : node.status === 'warning' ? 'var(--amber)' : 'var(--green)'}" 
                    stroke="white" stroke-width="2" style="cursor:pointer">
                    ${node.status === 'leak' ? '<animate attributeName="r" values="8;12;8" dur="1.5s" repeatCount="indefinite"/>' : ''}
                  </circle>
                  <text x="${node.x}%" y="${node.y - 2}%" text-anchor="middle" 
                    font-size="10" font-weight="600" fill="var(--text-primary)" 
                    font-family="IBM Plex Mono,monospace">${node.id}</text>
                </g>
              `).join('')}
              
              <!-- Leak markers -->
              ${leaks.map(leak => {
                const node = nodes.find(n => n.id === leak.node);
                if (!node) return '';
                return `
                  <g>
                    <circle cx="${node.x}%" cy="${node.y}%" r="20" fill="var(--red)" opacity="0.2">
                      <animate attributeName="r" values="20;30;20" dur="2s" repeatCount="indefinite"/>
                      <animate attributeName="opacity" values="0.2;0;0.2" dur="2s" repeatCount="indefinite"/>
                    </circle>
                    <text x="${node.x}%" y="${node.y + 5}%" text-anchor="middle" 
                      font-size="16" fill="var(--red)">💧</text>
                  </g>
                `;
              }).join('')}
            </svg>
          </div>
          
          <div style="margin-top:20px;display:grid;grid-template-columns:repeat(auto-fit,minmax(200px,1fr));gap:12px">
            ${nodes.map(node => `
              <div style="background:var(--surface-2);border:1px solid var(--border);border-radius:var(--radius-sm);padding:12px">
                <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:8px">
                  <span style="font-size:12px;font-weight:600;font-family:'IBM Plex Mono',monospace">${node.id}</span>
                  <span class="badge ${node.status === 'leak' ? 'badge-red' : node.status === 'warning' ? 'badge-red' : 'badge-green'}">${node.status.toUpperCase()}</span>
                </div>
                <div style="display:grid;grid-template-columns:1fr 1fr;gap:8px;font-size:11px">
                  <div><span style="color:var(--text-4)">Pressure:</span> <strong>${node.pressure} bar</strong></div>
                  <div><span style="color:var(--text-4)">Flow:</span> <strong>${node.flow} LPM</strong></div>
                </div>
              </div>
            `).join('')}
          </div>
        </div>
      </div>
    `;
  }

  renderIrrigation() {
    const irrigation = this.data.irrigation || {};
    const zones = irrigation.zones || [];
    const mode = irrigation.mode || 'auto';
    
    return `
      <div class="kpi-row">
        <div class="kpi">
          <div class="kpi-label">ACTIVE ZONES</div>
          <div class="kpi-value">${irrigation.activeZones || 0}</div>
          <div class="kpi-sub">Sprinklers currently running</div>
        </div>
        <div class="kpi">
          <div class="kpi-label">SCHEDULED ZONES</div>
          <div class="kpi-value">${irrigation.scheduledZones || 0}</div>
          <div class="kpi-sub">Waiting for activation</div>
        </div>
        <div class="kpi">
          <div class="kpi-label">WATER SAVED TODAY</div>
          <div class="kpi-value">${irrigation.totalWaterSaved || 0} <span style="font-size:14px">L</span></div>
          <div class="kpi-sub">Smart irrigation efficiency</div>
        </div>
        <div class="kpi">
          <div class="kpi-label">AVG SOIL MOISTURE</div>
          <div class="kpi-value">${irrigation.avgMoisture || 0}%</div>
          <div class="kpi-sub">Across ${zones.length} zones</div>
        </div>
        <div class="kpi">
          <div class="kpi-label">TOTAL AREA</div>
          <div class="kpi-value">${irrigation.totalArea || 0} <span style="font-size:14px">m²</span></div>
          <div class="kpi-sub">Under irrigation</div>
        </div>
      </div>

      <div class="panel" style="margin-bottom:20px">
        <div class="panel-header">
          <div class="panel-title">🎛️ Irrigation Control Mode</div>
          <div style="display:flex;gap:8px;align-items:center">
            <span style="font-size:11px;color:var(--text-4);font-family:'IBM Plex Mono',monospace">Current Mode:</span>
            <button onclick="app.setIrrigationMode('auto')" 
                    style="padding:6px 14px;border-radius:6px;font-size:11px;font-weight:600;cursor:pointer;border:${mode === 'auto' ? '2px solid var(--blue)' : '1px solid var(--border)'};
                           background:${mode === 'auto' ? 'var(--blue)' : 'var(--surface-2)'};color:${mode === 'auto' ? 'white' : 'var(--text-3)'};font-family:'Outfit',sans-serif;transition:all .2s">
              🤖 AUTO
            </button>
            <button onclick="app.setIrrigationMode('manual')" 
                    style="padding:6px 14px;border-radius:6px;font-size:11px;font-weight:600;cursor:pointer;border:${mode === 'manual' ? '2px solid var(--purple)' : '1px solid var(--border)'};
                           background:${mode === 'manual' ? 'var(--purple)' : 'var(--surface-2)'};color:${mode === 'manual' ? 'white' : 'var(--text-3)'};font-family:'Outfit',sans-serif;transition:all .2s">
              👤 MANUAL
            </button>
          </div>
        </div>
        <div class="panel-body">
          <div style="background:${mode === 'auto' ? 'var(--blue-light)' : 'var(--purple-light)'};border:1px solid ${mode === 'auto' ? 'var(--blue-mid)' : 'var(--purple)'};border-radius:var(--radius-sm);padding:14px">
            <div style="font-size:13px;font-weight:600;color:${mode === 'auto' ? 'var(--blue)' : 'var(--purple)'};margin-bottom:8px">
              ${mode === 'auto' ? '🤖 Auto-Control Mode Active' : '👤 Manual Control Mode Active'}
            </div>
            <div style="font-size:11px;color:var(--text-3);line-height:1.6">
              ${mode === 'auto' ? 
                'System automatically activates sprinklers when soil moisture drops below <strong>30%</strong> threshold. Sprinklers run until moisture reaches <strong>40%</strong>, then automatically shut off. Real-time monitoring from soil moisture sensors ensures optimal water usage.' :
                'Manual mode allows you to control each zone independently. Auto-control is disabled. Click the control buttons below to activate or deactivate sprinklers for each zone.'}
            </div>
          </div>
        </div>
      </div>

      <div class="panel">
        <div class="panel-header">
          <div class="panel-title">🌱 Irrigation Zones</div>
          <span class="badge badge-green">${zones.length} ZONES</span>
        </div>
        <div class="panel-body">
          <div style="display:grid;grid-template-columns:repeat(auto-fit,minmax(350px,1fr));gap:16px">
            ${zones.map(zone => {
              const moistureColor = zone.soilMoisture < zone.threshold ? 'var(--red)' : 
                                   zone.soilMoisture < zone.threshold + 10 ? 'var(--amber)' : 'var(--green)';
              const isActive = zone.sprinklerStatus === 'active';
              const isScheduled = zone.sprinklerStatus === 'scheduled';
              
              return `
                <div style="background:${isActive ? 'var(--blue-light)' : isScheduled ? 'var(--amber-light)' : 'var(--surface-2)'};
                           border:1px solid ${isActive ? 'var(--blue-mid)' : isScheduled ? 'var(--amber-mid)' : 'var(--border)'};
                           border-left:4px solid ${isActive ? 'var(--blue)' : isScheduled ? 'var(--amber)' : moistureColor};
                           border-radius:var(--radius);padding:16px;transition:all .2s">
                  
                  <!-- Zone Header -->
                  <div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:14px">
                    <div>
                      <div style="font-size:14px;font-weight:600;margin-bottom:2px">${zone.name}</div>
                      <div style="font-size:10px;color:var(--text-4);font-family:'IBM Plex Mono',monospace">${zone.id} · ${zone.area} m²</div>
                    </div>
                    <span style="font-size:10px;font-family:'IBM Plex Mono',monospace;padding:5px 12px;border-radius:20px;font-weight:600;
                                background:${zone.sprinklerStatus === 'active' ? 'var(--blue)' : zone.sprinklerStatus === 'scheduled' ? 'var(--amber)' : 'var(--green-light)'};
                                color:${zone.sprinklerStatus === 'active' ? '#fff' : zone.sprinklerStatus === 'scheduled' ? '#fff' : 'var(--green)'}">
                      ${zone.sprinklerStatus === 'active' ? '💦 ACTIVE' : zone.sprinklerStatus === 'scheduled' ? '⏰ SCHEDULED' : '✓ IDLE'}
                    </span>
                  </div>

                  <!-- Soil Moisture Sensor -->
                  <div style="margin-bottom:14px">
                    <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:8px">
                      <div style="font-size:9px;color:var(--text-4);text-transform:uppercase;letter-spacing:1px;font-family:'IBM Plex Mono',monospace">
                        📊 SOIL MOISTURE SENSOR
                      </div>
                      <div style="font-size:10px;color:var(--text-4);font-family:'IBM Plex Mono',monospace">
                        Threshold: ${zone.threshold}%
                      </div>
                    </div>
                    <div style="font-size:36px;font-weight:700;letter-spacing:-1.5px;margin-bottom:10px;color:${moistureColor}">
                      ${zone.soilMoisture}%
                    </div>
                    <div style="position:relative;height:10px;background:var(--border);border-radius:10px;margin-bottom:6px;overflow:visible">
                      <div style="height:100%;border-radius:10px;width:${zone.soilMoisture}%;background:${moistureColor};transition:width 1s ease"></div>
                      <div style="position:absolute;left:${zone.threshold}%;top:-3px;height:16px;width:3px;background:var(--red);border-radius:2px"></div>
                      <div style="position:absolute;left:${zone.threshold}%;top:-22px;font-size:8px;color:var(--red);font-family:'IBM Plex Mono',monospace;transform:translateX(-50%)">
                        ${zone.threshold}%
                      </div>
                    </div>
                    <div style="font-size:10px;color:var(--text-3);font-family:'IBM Plex Mono',monospace">
                      ${zone.soilMoisture < zone.threshold ? '⚠️ Below threshold - ' + (mode === 'auto' ? 'Auto-activating' : 'Manual control required') : '✓ Above threshold - Optimal moisture'}
                    </div>
                  </div>

                  <!-- Stats Grid -->
                  <div style="display:grid;grid-template-columns:1fr 1fr 1fr;gap:10px;margin-bottom:12px">
                    <div style="background:var(--surface);border:1px solid var(--border);border-radius:6px;padding:10px;text-align:center">
                      <div style="font-size:8px;color:var(--text-4);text-transform:uppercase;letter-spacing:.5px;margin-bottom:4px">WATER USED</div>
                      <div style="font-size:18px;font-weight:700;font-family:'IBM Plex Mono',monospace;color:var(--blue)">${zone.waterUsed} L</div>
                    </div>
                    <div style="background:var(--surface);border:1px solid var(--border);border-radius:6px;padding:10px;text-align:center">
                      <div style="font-size:8px;color:var(--text-4);text-transform:uppercase;letter-spacing:.5px;margin-bottom:4px">DURATION</div>
                      <div style="font-size:18px;font-weight:700;font-family:'IBM Plex Mono',monospace;color:var(--green)">${zone.duration} min</div>
                    </div>
                    <div style="background:var(--surface);border:1px solid var(--border);border-radius:6px;padding:10px;text-align:center">
                      <div style="font-size:8px;color:var(--text-4);text-transform:uppercase;letter-spacing:.5px;margin-bottom:4px">FLOW RATE</div>
                      <div style="font-size:18px;font-weight:700;font-family:'IBM Plex Mono',monospace;color:var(--teal)">${zone.flowRate} L/m</div>
                    </div>
                  </div>

                  <!-- Manual Controls -->
                  ${mode === 'manual' ? `
                    <div style="display:flex;gap:8px;margin-bottom:12px">
                      <button onclick="app.controlSprinkler('${zone.id}', 'on', 15)" 
                              style="flex:1;padding:8px;background:var(--green);color:white;border:none;border-radius:6px;font-size:11px;font-weight:600;cursor:pointer;font-family:'Outfit',sans-serif"
                              ${isActive ? 'disabled style="opacity:0.5;cursor:not-allowed"' : ''}>
                        💦 Start (15 min)
                      </button>
                      <button onclick="app.controlSprinkler('${zone.id}', 'off')" 
                              style="flex:1;padding:8px;background:var(--red);color:white;border:none;border-radius:6px;font-size:11px;font-weight:600;cursor:pointer;font-family:'Outfit',sans-serif"
                              ${!isActive ? 'disabled style="opacity:0.5;cursor:not-allowed"' : ''}>
                        ⏹ Stop
                      </button>
                    </div>
                  ` : ''}

                  <!-- Last Watered -->
                  <div style="font-size:10px;color:var(--text-3);font-family:'IBM Plex Mono',monospace;padding-top:12px;border-top:1px solid var(--border);display:flex;justify-content:space-between">
                    <span>⏱ Last watered: ${zone.lastWatered}</span>
                    ${zone.manualOverride ? '<span style="color:var(--purple)">👤 Manual Override</span>' : ''}
                  </div>
                </div>
              `;
            }).join('')}
          </div>
        </div>
      </div>
    `;
  }

  renderHardware() {
    const hw = this.data.hardware || {};
    const sensors = hw.sensors || {};
    const actuators = hw.actuators || {};
    
    return `
      <div class="kpi-row">
        <div class="kpi">
          <div class="kpi-label">ESP32 STATUS</div>
          <div class="kpi-value" style="font-size:20px">${hw.esp32?.status === 'connected' ? '✓ CONNECTED' : '✗ OFFLINE'}</div>
          <div class="kpi-sub">Uptime: ${hw.esp32?.uptime || '--'} · Signal: ${hw.esp32?.signalStrength || 0} dBm</div>
        </div>
        <div class="kpi">
          <div class="kpi-label">ARDUINO STATUS</div>
          <div class="kpi-value" style="font-size:20px">${hw.arduino?.status === 'connected' ? '✓ CONNECTED' : '✗ OFFLINE'}</div>
          <div class="kpi-sub">Sensors: ${hw.arduino?.sensors || 0} · Uptime: ${hw.arduino?.uptime || '--'}</div>
        </div>
        <div class="kpi">
          <div class="kpi-label">ACTIVE SENSORS</div>
          <div class="kpi-value">${Object.keys(sensors).length}</div>
          <div class="kpi-sub">All sensors operational</div>
        </div>
        <div class="kpi">
          <div class="kpi-label">ACTIVE ACTUATORS</div>
          <div class="kpi-value">${Object.keys(actuators).length}</div>
          <div class="kpi-sub">Control systems online</div>
        </div>
      </div>

      <div class="panel">
        <div class="panel-header">
          <div class="panel-title">📡 Sensor Status</div>
          <span class="badge badge-green">${Object.keys(sensors).length} ACTIVE</span>
        </div>
        <div class="panel-body">
          <div style="display:grid;grid-template-columns:repeat(auto-fit,minmax(220px,1fr));gap:12px">
            ${Object.entries(sensors).map(([name, sensor]) => `
              <div style="background:var(--surface-2);border:1px solid var(--border);border-radius:var(--radius-sm);padding:14px">
                <div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:10px">
                  <span style="font-size:10px;font-weight:600;color:var(--text-3);font-family:'IBM Plex Mono',monospace;text-transform:uppercase">${name.replace(/([A-Z])/g, ' $1').trim()}</span>
                  <span class="badge badge-green" style="font-size:8px">${sensor.status.toUpperCase()}</span>
                </div>
                <div style="font-size:28px;font-weight:700;letter-spacing:-1px;margin-bottom:4px">
                  ${sensor.reading} <span style="font-size:14px;font-weight:500;color:var(--text-3)">${sensor.unit}</span>
                </div>
                <div style="font-size:10px;color:var(--text-3);margin-bottom:8px">Accuracy: ${sensor.accuracy}%</div>
                <div style="height:3px;background:var(--border);border-radius:2px;overflow:hidden">
                  <div style="height:100%;width:${sensor.accuracy}%;background:var(--green);border-radius:2px;transition:width 1s ease"></div>
                </div>
              </div>
            `).join('')}
          </div>
        </div>
      </div>

      <div class="panel">
        <div class="panel-header">
          <div class="panel-title">⚙️ Actuator Control</div>
          <span class="badge badge-blue">${Object.keys(actuators).length} DEVICES</span>
        </div>
        <div class="panel-body">
          <div style="display:flex;flex-direction:column;gap:12px">
            ${Object.entries(actuators).map(([name, act]) => `
              <div style="display:flex;align-items:center;gap:14px;background:var(--surface-2);border:1px solid var(--border);border-radius:var(--radius-sm);padding:14px">
                <div style="width:48px;height:48px;border-radius:10px;background:var(--blue-light);color:var(--blue);display:flex;align-items:center;justify-content:center;flex-shrink:0">
                  <svg width="24" height="24" viewBox="0 0 24 24" stroke="currentColor" fill="none" stroke-width="2">
                    ${name === 'mainPump' ? '<circle cx="12" cy="12" r="3"/><path d="M12 1v6m0 6v6"/>' : 
                      name === 'sprinklers' ? '<path d="M12 2v20M17 7l-5 5-5-5"/>' :
                      name === 'buzzer' ? '<path d="M11 5L6 9H2v6h4l5 4V5z"/>' :
                      '<rect x="3" y="11" width="18" height="11" rx="2"/>'}
                  </svg>
                </div>
                <div style="flex:1">
                  <div style="font-size:13px;font-weight:600;margin-bottom:3px">${name.replace(/([A-Z])/g, ' $1').trim().toUpperCase()}</div>
                  <div style="font-size:11px;color:var(--text-3);margin-bottom:3px">
                    ${name === 'mainPump' ? `Power: ${act.power} kW · Cycles: ${act.cycles}` :
                      name === 'sprinklers' ? `Active: ${act.active}/${act.total} · Flow: ${act.waterFlow} L/min` :
                      name === 'buzzer' ? `Alerts: ${act.alerts} · Last: ${act.lastTriggered}` :
                      `Open: ${act.open} · Closed: ${act.closed} · Total: ${act.total}`}
                  </div>
                  <span class="badge ${act.status === 'on' || act.status === 'active' ? 'badge-green' : 'badge-blue'}" style="font-size:9px">
                    ${(act.status || 'IDLE').toUpperCase()}
                  </span>
                </div>
                <button class="btn ${act.status === 'on' || act.status === 'active' ? 'btn-red' : 'btn-green'}" style="padding:6px 14px;font-size:11px">
                  ${act.status === 'on' || act.status === 'active' ? 'Turn OFF' : 'Turn ON'}
                </button>
              </div>
            `).join('')}
          </div>
        </div>
      </div>

      <div class="panel">
        <div class="panel-header">
          <div class="panel-title">🔌 Hardware Architecture</div>
        </div>
        <div class="panel-body">
          <div style="display:flex;flex-direction:column;gap:16px;padding:20px;background:var(--surface-2);border-radius:var(--radius)">
            <div style="text-align:center">
              <div style="font-size:11px;font-weight:600;color:var(--text-4);text-transform:uppercase;letter-spacing:1px;font-family:'IBM Plex Mono',monospace;margin-bottom:10px">CLOUD / BACKEND</div>
              <div style="display:inline-block;background:var(--purple-light);border:1px solid var(--purple);border-radius:6px;padding:8px 16px;font-size:11px;font-weight:600;color:var(--purple)">Node.js + WebSocket Server</div>
            </div>
            <div style="text-align:center;font-size:24px;color:var(--text-4)">↕</div>
            <div style="text-align:center">
              <div style="font-size:11px;font-weight:600;color:var(--text-4);text-transform:uppercase;letter-spacing:1px;font-family:'IBM Plex Mono',monospace;margin-bottom:10px">MICROCONTROLLERS</div>
              <div style="display:flex;justify-content:center;gap:8px;flex-wrap:wrap">
                <div style="background:var(--blue-light);border:1px solid var(--blue-mid);border-radius:6px;padding:8px 14px;font-size:11px;font-weight:600;color:var(--blue)">ESP32 WiFi</div>
                <div style="background:var(--blue-light);border:1px solid var(--blue-mid);border-radius:6px;padding:8px 14px;font-size:11px;font-weight:600;color:var(--blue)">Arduino Uno</div>
              </div>
            </div>
            <div style="text-align:center;font-size:24px;color:var(--text-4)">↕</div>
            <div style="text-align:center">
              <div style="font-size:11px;font-weight:600;color:var(--text-4);text-transform:uppercase;letter-spacing:1px;font-family:'IBM Plex Mono',monospace;margin-bottom:10px">SENSORS & ACTUATORS</div>
              <div style="display:flex;justify-content:center;gap:6px;flex-wrap:wrap">
                <div style="background:var(--surface);border:1px solid var(--border);border-radius:6px;padding:6px 12px;font-size:10px;font-weight:500">Flow Sensor</div>
                <div style="background:var(--surface);border:1px solid var(--border);border-radius:6px;padding:6px 12px;font-size:10px;font-weight:500">pH Sensor</div>
                <div style="background:var(--surface);border:1px solid var(--border);border-radius:6px;padding:6px 12px;font-size:10px;font-weight:500">TDS Sensor</div>
                <div style="background:var(--surface);border:1px solid var(--border);border-radius:6px;padding:6px 12px;font-size:10px;font-weight:500">Soil Moisture</div>
                <div style="background:var(--surface);border:1px solid var(--border);border-radius:6px;padding:6px 12px;font-size:10px;font-weight:500">Water Pump</div>
                <div style="background:var(--surface);border:1px solid var(--border);border-radius:6px;padding:6px 12px;font-size:10px;font-weight:500">Sprinklers</div>
                <div style="background:var(--surface);border:1px solid var(--border);border-radius:6px;padding:6px 12px;font-size:10px;font-weight:500">Buzzer</div>
              </div>
            </div>
          </div>
        </div>
      </div>
    `;
  }

  renderAnalytics() {
    const analytics = this.data.analytics || {};
    const savings = analytics.waterSavings || {};
    const leakPrev = analytics.leakPrevention || {};
    const efficiency = analytics.efficiency || {};
    const predictions = analytics.predictions || {};
    
    return `
      <div class="kpi-row">
        <div class="kpi">
          <div class="kpi-label">WATER SAVINGS TODAY</div>
          <div class="kpi-value">${savings.today || 0}%</div>
          <div class="kpi-sub">Week: ${savings.week || 0}% · Month: ${savings.month || 0}%</div>
        </div>
        <div class="kpi">
          <div class="kpi-label">LEAKS PREVENTED</div>
          <div class="kpi-value">${leakPrev.prevented || 0}/${leakPrev.detected || 0}</div>
          <div class="kpi-sub">Saved ${leakPrev.savedLiters || 0} liters</div>
        </div>
        <div class="kpi">
          <div class="kpi-label">OVERALL EFFICIENCY</div>
          <div class="kpi-value">${efficiency.overall || 0}%</div>
          <div class="kpi-sub">Distribution: ${efficiency.distribution || 0}% · Irrigation: ${efficiency.irrigation || 0}%</div>
        </div>
      </div>

      <div class="panel">
        <div class="panel-header">
          <div class="panel-title">💰 Water Savings Analysis</div>
          <span class="badge badge-green">${savings.percentage || 0}% EFFICIENCY GAIN</span>
        </div>
        <div class="panel-body">
          <div style="display:flex;flex-direction:column;gap:18px">
            <div>
              <div style="font-size:12px;font-weight:600;margin-bottom:10px">Today: ${savings.today}%</div>
              <div style="display:flex;align-items:center;gap:10px">
                <div style="flex:1;height:10px;background:var(--border);border-radius:10px;overflow:hidden">
                  <div style="height:100%;width:${savings.today}%;background:var(--green);border-radius:10px;transition:width 1s ease"></div>
                </div>
                <div style="font-size:14px;font-weight:700;font-family:'IBM Plex Mono',monospace;min-width:50px;text-align:right">${savings.today}%</div>
              </div>
            </div>
            <div>
              <div style="font-size:12px;font-weight:600;margin-bottom:10px">This Week: ${savings.week}%</div>
              <div style="display:flex;align-items:center;gap:10px">
                <div style="flex:1;height:10px;background:var(--border);border-radius:10px;overflow:hidden">
                  <div style="height:100%;width:${savings.week}%;background:var(--blue);border-radius:10px;transition:width 1s ease"></div>
                </div>
                <div style="font-size:14px;font-weight:700;font-family:'IBM Plex Mono',monospace;min-width:50px;text-align:right">${savings.week}%</div>
              </div>
            </div>
            <div>
              <div style="font-size:12px;font-weight:600;margin-bottom:10px">This Month: ${savings.month}%</div>
              <div style="display:flex;align-items:center;gap:10px">
                <div style="flex:1;height:10px;background:var(--border);border-radius:10px;overflow:hidden">
                  <div style="height:100%;width:${(savings.month/300)*100}%;background:var(--teal);border-radius:10px;transition:width 1s ease"></div>
                </div>
                <div style="font-size:14px;font-weight:700;font-family:'IBM Plex Mono',monospace;min-width:50px;text-align:right">${savings.month}%</div>
              </div>
            </div>
          </div>
        </div>
      </div>

      <div class="grid-2">
        <div class="panel">
          <div class="panel-header">
            <div class="panel-title">🎯 System Efficiency</div>
          </div>
          <div class="panel-body">
            <div style="display:flex;flex-direction:column;gap:18px">
              <div>
                <div style="font-size:12px;font-weight:600;margin-bottom:10px">Distribution Efficiency</div>
                <div style="display:flex;align-items:center;gap:10px">
                  <div style="flex:1;height:10px;background:var(--border);border-radius:10px;overflow:hidden">
                    <div style="height:100%;width:${efficiency.distribution}%;background:var(--blue);border-radius:10px;transition:width 1s ease"></div>
                  </div>
                  <div style="font-size:14px;font-weight:700;font-family:'IBM Plex Mono',monospace;min-width:50px;text-align:right">${efficiency.distribution}%</div>
                </div>
              </div>
              <div>
                <div style="font-size:12px;font-weight:600;margin-bottom:10px">Irrigation Efficiency</div>
                <div style="display:flex;align-items:center;gap:10px">
                  <div style="flex:1;height:10px;background:var(--border);border-radius:10px;overflow:hidden">
                    <div style="height:100%;width:${efficiency.irrigation}%;background:var(--green);border-radius:10px;transition:width 1s ease"></div>
                  </div>
                  <div style="font-size:14px;font-weight:700;font-family:'IBM Plex Mono',monospace;min-width:50px;text-align:right">${efficiency.irrigation}%</div>
                </div>
              </div>
              <div>
                <div style="font-size:12px;font-weight:600;margin-bottom:10px">Overall System</div>
                <div style="display:flex;align-items:center;gap:10px">
                  <div style="flex:1;height:10px;background:var(--border);border-radius:10px;overflow:hidden">
                    <div style="height:100%;width:${efficiency.overall}%;background:var(--teal);border-radius:10px;transition:width 1s ease"></div>
                  </div>
                  <div style="font-size:14px;font-weight:700;font-family:'IBM Plex Mono',monospace;min-width:50px;text-align:right">${efficiency.overall}%</div>
                </div>
              </div>
            </div>
          </div>
        </div>

        <div class="panel">
          <div class="panel-header">
            <div class="panel-title">🤖 AI Predictions</div>
          </div>
          <div class="panel-body">
            <div style="display:flex;flex-direction:column;gap:14px">
              <div style="display:flex;align-items:center;gap:12px;background:var(--surface-2);border:1px solid var(--border);border-radius:var(--radius-sm);padding:12px">
                <div style="width:44px;height:44px;border-radius:10px;background:var(--blue-light);color:var(--blue);display:flex;align-items:center;justify-content:center;flex-shrink:0;font-size:20px">🔮</div>
                <div style="flex:1">
                  <div style="font-size:9px;color:var(--text-4);text-transform:uppercase;letter-spacing:1px;font-family:'IBM Plex Mono',monospace;margin-bottom:3px">NEXT LEAK RISK</div>
                  <div style="font-size:14px;font-weight:700">${predictions.nextLeakRisk || 'Unknown'}</div>
                </div>
              </div>
              <div style="display:flex;align-items:center;gap:12px;background:var(--surface-2);border:1px solid var(--border);border-radius:var(--radius-sm);padding:12px">
                <div style="width:44px;height:44px;border-radius:10px;background:var(--amber-light);color:var(--amber);display:flex;align-items:center;justify-content:center;flex-shrink:0;font-size:20px">🔧</div>
                <div style="flex:1">
                  <div style="font-size:9px;color:var(--text-4);text-transform:uppercase;letter-spacing:1px;font-family:'IBM Plex Mono',monospace;margin-bottom:3px">MAINTENANCE DUE</div>
                  <div style="font-size:14px;font-weight:700">${predictions.maintenanceDue || 'N/A'}</div>
                </div>
              </div>
              <div style="display:flex;align-items:center;gap:12px;background:var(--surface-2);border:1px solid var(--border);border-radius:var(--radius-sm);padding:12px">
                <div style="width:44px;height:44px;border-radius:10px;background:var(--green-light);color:var(--green);display:flex;align-items:center;justify-content:center;flex-shrink:0;font-size:20px">📊</div>
                <div style="flex:1">
                  <div style="font-size:9px;color:var(--text-4);text-transform:uppercase;letter-spacing:1px;font-family:'IBM Plex Mono',monospace;margin-bottom:3px">PEAK DEMAND TIME</div>
                  <div style="font-size:14px;font-weight:700">${predictions.peakDemandTime || 'N/A'}</div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>

      <div class="panel">
        <div class="panel-header">
          <div class="panel-title">💡 AI Recommendations</div>
        </div>
        <div class="panel-body">
          <div style="background:var(--blue-light);border:1px solid var(--blue-mid);border-radius:var(--radius-sm);padding:14px">
            <div style="font-size:13px;font-weight:600;color:var(--blue);margin-bottom:6px">🎯 Recommended Action</div>
            <div style="font-size:12px;color:var(--text-2)">${predictions.recommendedAction || 'No actions required at this time'}</div>
          </div>
        </div>
      </div>
    `;
  }

  renderForecast() {
    const forecast = this.data.demandForecast || {};
    const daily = forecast.dailyForecast || [];
    const sectors = forecast.sectorBreakdown || [];
    const recommendations = forecast.recommendations || [];
    
    return `
      <div class="kpi-row">
        <div class="kpi">
          <div class="kpi-label">TODAY'S DEMAND</div>
          <div class="kpi-value">${forecast.today?.value || 0} <span style="font-size:14px">MLD</span></div>
          <div class="kpi-sub">Peak: ${forecast.today?.peak || 0} MLD at ${forecast.today?.peakTime || '--'}</div>
        </div>
        <div class="kpi">
          <div class="kpi-label">7-DAY FORECAST</div>
          <div class="kpi-value">${forecast.forecast7Day?.value || 0} <span style="font-size:14px">MLD</span></div>
          <div class="kpi-sub">Confidence: ${forecast.forecast7Day?.confidence || 0}%</div>
        </div>
        <div class="kpi">
          <div class="kpi-label">MODEL ACCURACY</div>
          <div class="kpi-value">${forecast.modelAccuracy || 0}%</div>
          <div class="kpi-sub">AI-powered prediction</div>
        </div>
        <div class="kpi">
          <div class="kpi-label">SHORTAGE RISK</div>
          <div class="kpi-value" style="font-size:18px">${forecast.shortageRisk?.day || 'None'}</div>
          <div class="kpi-sub">${forecast.shortageRisk?.reason || 'No risk detected'}</div>
        </div>
      </div>

      <div class="panel">
        <div class="panel-header">
          <div class="panel-title">📈 7-Day Demand Forecast</div>
          <span class="badge badge-blue">ML PREDICTION</span>
        </div>
        <div class="panel-body">
          <div style="display:flex;flex-direction:column;gap:12px">
            ${daily.map(day => {
              const maxValue = 3.5;
              const percentage = (day.value / maxValue) * 100;
              return `
                <div style="display:flex;align-items:center;gap:12px">
                  <div style="min-width:90px;font-size:12px;font-weight:600">${day.day}</div>
                  <div style="flex:1;display:flex;align-items:center;gap:10px">
                    <div style="flex:1;height:10px;background:var(--border);border-radius:10px;overflow:hidden">
                      <div style="height:100%;width:${percentage}%;background:${day.status === 'High' ? 'var(--red)' : day.status === 'Elevated' ? 'var(--amber)' : 'var(--green)'};border-radius:10px;transition:width 1s ease"></div>
                    </div>
                    <div style="min-width:70px;font-size:12px;font-weight:700;font-family:'IBM Plex Mono',monospace">${day.value} MLD</div>
                  </div>
                  <span style="min-width:80px;font-size:10px;font-weight:600;padding:3px 8px;border-radius:20px;text-align:center;
                               background:${day.status === 'High' ? 'var(--red-light)' : day.status === 'Elevated' ? 'var(--amber-light)' : 'var(--green-light)'};
                               color:${day.status === 'High' ? 'var(--red)' : day.status === 'Elevated' ? 'var(--amber)' : 'var(--green)'}">
                    ${day.status}
                  </span>
                </div>
              `;
            }).join('')}
          </div>
        </div>
      </div>

      <div class="panel">
        <div class="panel-header">
          <div class="panel-title">🏭 Sector-wise Breakdown</div>
        </div>
        <div class="panel-body">
          <div style="display:flex;flex-direction:column;gap:18px">
            ${sectors.map(sector => `
              <div>
                <div style="font-size:13px;font-weight:600;margin-bottom:10px">${sector.sector}</div>
                <div style="display:flex;flex-direction:column;gap:8px">
                  <div style="display:flex;align-items:center;gap:10px">
                    <div style="min-width:70px;font-size:11px;color:var(--text-3)">Today</div>
                    <div style="flex:1;height:8px;background:var(--border);border-radius:8px;overflow:hidden">
                      <div style="height:100%;width:${(sector.today/3)*100}%;background:var(--blue);border-radius:8px;transition:width 1s ease"></div>
                    </div>
                    <div style="min-width:70px;font-size:11px;font-weight:700;font-family:'IBM Plex Mono',monospace;text-align:right">${sector.today} MLD</div>
                  </div>
                  <div style="display:flex;align-items:center;gap:10px">
                    <div style="min-width:70px;font-size:11px;color:var(--text-3)">Forecast</div>
                    <div style="flex:1;height:8px;background:var(--border);border-radius:8px;overflow:hidden">
                      <div style="height:100%;width:${(sector.forecast/3)*100}%;background:var(--teal);border-radius:8px;transition:width 1s ease"></div>
                    </div>
                    <div style="min-width:70px;font-size:11px;font-weight:700;font-family:'IBM Plex Mono',monospace;text-align:right">${sector.forecast} MLD</div>
                  </div>
                </div>
              </div>
            `).join('')}
          </div>
        </div>
      </div>

      <div class="panel">
        <div class="panel-header">
          <div class="panel-title">💡 AI Recommendations</div>
          <span class="badge badge-green">${recommendations.length} INSIGHTS</span>
        </div>
        <div class="panel-body">
          <div style="display:flex;flex-direction:column;gap:12px">
            ${recommendations.map(rec => `
              <div style="display:flex;gap:12px;padding:12px;border-radius:var(--radius-sm);border:1px solid var(--border);
                         background:${rec.type === 'warning' ? 'var(--amber-light)' : 'var(--blue-light)'};
                         border-color:${rec.type === 'warning' ? 'var(--amber-mid)' : 'var(--blue-mid)'}">
                <div style="font-size:20px;flex-shrink:0">${rec.type === 'warning' ? '⚠️' : 'ℹ️'}</div>
                <div style="flex:1">
                  <div style="font-size:12px;font-weight:600;margin-bottom:3px">${rec.title}</div>
                  <div style="font-size:11px;color:var(--text-3);line-height:1.5">${rec.desc}</div>
                </div>
              </div>
            `).join('')}
          </div>
        </div>
      </div>
    `;
  }

  renderAIPredictions() {
    return `
      <div style="background:linear-gradient(135deg,var(--purple-light) 0%,var(--blue-light) 100%);border:1px solid var(--purple);border-radius:var(--radius-sm);padding:20px;margin-bottom:20px">
        <div style="display:flex;align-items:center;gap:12px;margin-bottom:10px">
          <div style="width:48px;height:48px;background:var(--purple);border-radius:50%;display:flex;align-items:center;justify-content:center">
            <svg width="24" height="24" viewBox="0 0 24 24" stroke="white" fill="none" stroke-width="2">
              <circle cx="12" cy="12" r="3"/><path d="M12 1v6m0 6v6m5.66-13.66l-4.24 4.24m0 6.36l4.24 4.24M23 12h-6m-6 0H5m13.66 5.66l-4.24-4.24m0-6.36l4.24-4.24"/>
            </svg>
          </div>
          <div>
            <div style="font-size:16px;font-weight:700;color:var(--purple)">🤖 AI-Powered Predictions & Machine Learning</div>
            <div style="font-size:12px;color:var(--text-2)">Advanced synthetic data models for leak prediction, demand forecasting, and maintenance scheduling</div>
          </div>
        </div>
      </div>

      <div class="kpi-row">
        <div class="kpi">
          <div class="kpi-label">LEAK PREDICTION ACCURACY</div>
          <div class="kpi-value">87.3%</div>
          <div class="kpi-sub">Next leak probability: 23.5% (Low risk)</div>
        </div>
        <div class="kpi">
          <div class="kpi-label">DEMAND FORECAST ACCURACY</div>
          <div class="kpi-value">94.2%</div>
          <div class="kpi-sub">24-hour prediction model</div>
        </div>
        <div class="kpi">
          <div class="kpi-label">ANOMALY DETECTION</div>
          <div class="kpi-value">95.8%</div>
          <div class="kpi-sub">False positive rate: 4.2%</div>
        </div>
        <div class="kpi">
          <div class="kpi-label">MAINTENANCE PREDICTIONS</div>
          <div class="kpi-value">89%</div>
          <div class="kpi-sub">Predictive maintenance confidence</div>
        </div>
      </div>

      <div class="grid-2">
        <div class="panel">
          <div class="panel-header">
            <div class="panel-title">🔮 Leak Prediction Model</div>
            <span class="badge badge-blue">ML POWERED</span>
          </div>
          <div class="panel-body">
            <div style="background:var(--amber-light);border:1px solid var(--amber-mid);border-radius:var(--radius-sm);padding:14px;margin-bottom:16px">
              <div style="font-size:13px;font-weight:600;color:var(--amber);margin-bottom:6px">⚠️ Predicted Next Leak</div>
              <div style="font-size:12px;color:var(--text-2);margin-bottom:8px">Location: Sector 5-C · Timeframe: 72 hours · Confidence: 87.3%</div>
              <div style="font-size:11px;color:var(--text-3)">Risk Level: <strong>Low (23.5% probability)</strong></div>
            </div>
            
            <div style="font-size:12px;font-weight:600;margin-bottom:12px">Contributing Factors:</div>
            <div style="display:flex;flex-direction:column;gap:10px">
              <div>
                <div style="display:flex;justify-content:space-between;margin-bottom:6px">
                  <span style="font-size:11px">Pipeline Age (High Impact)</span>
                  <span style="font-size:11px;font-weight:700">78%</span>
                </div>
                <div style="height:6px;background:var(--border);border-radius:6px;overflow:hidden">
                  <div style="height:100%;width:78%;background:var(--red);border-radius:6px"></div>
                </div>
              </div>
              <div>
                <div style="display:flex;justify-content:space-between;margin-bottom:6px">
                  <span style="font-size:11px">Historical Patterns (Medium Impact)</span>
                  <span style="font-size:11px;font-weight:700">65%</span>
                </div>
                <div style="height:6px;background:var(--border);border-radius:6px;overflow:hidden">
                  <div style="height:100%;width:65%;background:var(--amber);border-radius:6px"></div>
                </div>
              </div>
              <div>
                <div style="display:flex;justify-content:space-between;margin-bottom:6px">
                  <span style="font-size:11px">Pressure Fluctuation (Low Impact)</span>
                  <span style="font-size:11px;font-weight:700">32%</span>
                </div>
                <div style="height:6px;background:var(--border);border-radius:6px;overflow:hidden">
                  <div style="height:100%;width:32%;background:var(--green);border-radius:6px"></div>
                </div>
              </div>
            </div>
          </div>
        </div>

        <div class="panel">
          <div class="panel-header">
            <div class="panel-title">📊 24-Hour Demand Prediction</div>
            <span class="badge badge-green">94.2% ACCURACY</span>
          </div>
          <div class="panel-body">
            <div style="display:flex;flex-direction:column;gap:12px">
              ${[
                { hour: '00:00', demand: 2.1, confidence: 94 },
                { hour: '06:00', demand: 2.8, confidence: 92 },
                { hour: '12:00', demand: 3.1, confidence: 95 },
                { hour: '18:00', demand: 3.4, confidence: 93 },
                { hour: '24:00', demand: 2.3, confidence: 91 }
              ].map(item => `
                <div>
                  <div style="display:flex;justify-content:space-between;margin-bottom:6px">
                    <span style="font-size:11px;font-weight:600">${item.hour}</span>
                    <span style="font-size:11px"><strong>${item.demand} MLD</strong> · ${item.confidence}% confidence</span>
                  </div>
                  <div style="height:6px;background:var(--border);border-radius:6px;overflow:hidden">
                    <div style="height:100%;width:${(item.demand/3.5)*100}%;background:var(--blue);border-radius:6px"></div>
                  </div>
                </div>
              `).join('')}
            </div>
            <div style="margin-top:16px;padding:12px;background:var(--blue-light);border:1px solid var(--blue-mid);border-radius:var(--radius-sm)">
              <div style="font-size:11px;font-weight:600;color:var(--blue);margin-bottom:4px">🎯 Peak Prediction</div>
              <div style="font-size:11px;color:var(--text-3)">Peak demand at 18:30 · 3.4 MLD · Recommend pre-filling reservoirs</div>
            </div>
          </div>
        </div>
      </div>

      <div class="panel">
        <div class="panel-header">
          <div class="panel-title">🔧 Predictive Maintenance Schedule</div>
          <span class="badge badge-red">2 HIGH PRIORITY</span>
        </div>
        <div class="panel-body">
          <div style="display:flex;flex-direction:column;gap:10px">
            <div style="background:var(--red-light);border:1px solid var(--red-mid);border-left:3px solid var(--red);border-radius:var(--radius-sm);padding:12px">
              <div style="display:flex;justify-content:between;align-items:center;margin-bottom:8px">
                <div style="flex:1">
                  <div style="font-size:13px;font-weight:600;color:var(--red);margin-bottom:4px">🚨 Pump P-003 - High Priority</div>
                  <div style="font-size:11px;color:var(--text-3)">Predicted failure in 12 days · Confidence: 89%</div>
                </div>
                <button class="btn btn-red" style="padding:6px 12px;font-size:11px">Schedule Now</button>
              </div>
              <div style="font-size:10px;color:var(--text-3)">Recommendation: Immediate inspection and bearing replacement</div>
            </div>
            
            <div style="background:var(--amber-light);border:1px solid var(--amber-mid);border-left:3px solid var(--amber);border-radius:var(--radius-sm);padding:12px">
              <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:8px">
                <div style="flex:1">
                  <div style="font-size:13px;font-weight:600;color:var(--amber);margin-bottom:4px">⚠️ Pump P-002 - Medium Priority</div>
                  <div style="font-size:11px;color:var(--text-3)">Predicted failure in 45 days · Confidence: 76%</div>
                </div>
                <button class="btn btn-amber" style="padding:6px 12px;font-size:11px">Schedule</button>
              </div>
              <div style="font-size:10px;color:var(--text-3)">Recommendation: Routine maintenance and efficiency check</div>
            </div>
            
            <div style="background:var(--blue-light);border:1px solid var(--blue-mid);border-left:3px solid var(--blue);border-radius:var(--radius-sm);padding:12px">
              <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:8px">
                <div style="flex:1">
                  <div style="font-size:13px;font-weight:600;color:var(--blue);margin-bottom:4px">ℹ️ Valve V-007 - Medium Priority</div>
                  <div style="font-size:11px;color:var(--text-3)">Predicted failure in 28 days · Confidence: 82%</div>
                </div>
                <button class="btn btn-blue" style="padding:6px 12px;font-size:11px">Schedule</button>
              </div>
              <div style="font-size:10px;color:var(--text-3)">Recommendation: Valve inspection and seal replacement</div>
            </div>
          </div>
        </div>
      </div>

      <div class="grid-2">
        <div class="panel">
          <div class="panel-header">
            <div class="panel-title">💧 Water Quality Forecast (7 Days)</div>
          </div>
          <div class="panel-body">
            <div style="display:flex;flex-direction:column;gap:10px">
              ${[
                { day: 'Day 1', wqi: 87, status: 'Good', confidence: 93 },
                { day: 'Day 2', wqi: 86, status: 'Good', confidence: 91 },
                { day: 'Day 3', wqi: 82, status: 'Fair', confidence: 88 },
                { day: 'Day 4', wqi: 79, status: 'Fair', confidence: 85 },
                { day: 'Day 5', wqi: 84, status: 'Good', confidence: 89 },
                { day: 'Day 6', wqi: 88, status: 'Good', confidence: 92 },
                { day: 'Day 7', wqi: 89, status: 'Good', confidence: 94 }
              ].map(item => `
                <div style="display:flex;align-items:center;gap:12px">
                  <div style="min-width:60px;font-size:11px;font-weight:600">${item.day}</div>
                  <div style="flex:1;height:8px;background:var(--border);border-radius:8px;overflow:hidden">
                    <div style="height:100%;width:${item.wqi}%;background:${item.status === 'Good' ? 'var(--green)' : 'var(--amber)'};border-radius:8px"></div>
                  </div>
                  <div style="min-width:80px;font-size:11px;text-align:right"><strong>${item.wqi}</strong> · ${item.confidence}%</div>
                </div>
              `).join('')}
            </div>
            <div style="margin-top:16px;padding:12px;background:var(--amber-light);border:1px solid var(--amber-mid);border-radius:var(--radius-sm)">
              <div style="font-size:11px;font-weight:600;color:var(--amber);margin-bottom:4px">⚠️ Predicted Alerts</div>
              <div style="font-size:10px;color:var(--text-3)">• Day 3: Turbidity increase (Monsoon effect)<br>• Day 4: pH fluctuation (Seasonal variation)</div>
            </div>
          </div>
        </div>

        <div class="panel">
          <div class="panel-header">
            <div class="panel-title">🌱 Irrigation Optimization AI</div>
          </div>
          <div class="panel-body">
            <div style="display:flex;flex-direction:column;gap:12px">
              <div style="background:var(--green-light);border:1px solid var(--green-mid);border-radius:var(--radius-sm);padding:12px">
                <div style="font-size:12px;font-weight:600;color:var(--green);margin-bottom:6px">💡 Zone Z-001 Recommendation</div>
                <div style="font-size:11px;color:var(--text-3);margin-bottom:8px">Reduce threshold to 28% for 12% water savings</div>
                <div style="display:flex;justify-content:space-between;align-items:center">
                  <span style="font-size:10px;color:var(--text-4)">Confidence: 91%</span>
                  <button class="btn btn-green" style="padding:4px 10px;font-size:10px">Apply</button>
                </div>
              </div>
              
              <div style="background:var(--blue-light);border:1px solid var(--blue-mid);border-radius:var(--radius-sm);padding:12px">
                <div style="font-size:12px;font-weight:600;color:var(--blue);margin-bottom:6px">💡 Zone Z-003 Recommendation</div>
                <div style="font-size:11px;color:var(--text-3);margin-bottom:8px">Shift schedule to 4 AM for 8% water savings</div>
                <div style="display:flex;justify-content:space-between;align-items:center">
                  <span style="font-size:10px;color:var(--text-4)">Confidence: 87%</span>
                  <button class="btn btn-blue" style="padding:4px 10px;font-size:10px">Apply</button>
                </div>
              </div>
              
              <div style="padding:12px;background:var(--surface-2);border:1px solid var(--border);border-radius:var(--radius-sm)">
                <div style="font-size:11px;font-weight:600;margin-bottom:6px">📊 Total Potential Savings</div>
                <div style="font-size:20px;font-weight:700;color:var(--green)">1,850 L/day</div>
                <div style="font-size:10px;color:var(--text-4)">Implementation complexity: Low</div>
              </div>
            </div>
          </div>
        </div>
      </div>

      <div class="panel">
        <div class="panel-header">
          <div class="panel-title">🎯 Anomaly Detection</div>
          <span class="badge badge-amber">2 DETECTED</span>
        </div>
        <div class="panel-body">
          <div style="display:flex;flex-direction:column;gap:10px">
            <div style="display:flex;gap:12px;padding:12px;background:var(--amber-light);border:1px solid var(--amber-mid);border-radius:var(--radius-sm)">
              <div style="font-size:24px">⚠️</div>
              <div style="flex:1">
                <div style="font-size:12px;font-weight:600;margin-bottom:4px">Flow Anomaly Detected</div>
                <div style="font-size:11px;color:var(--text-3);margin-bottom:4px">Location: N-023 · Severity: Medium</div>
                <div style="font-size:10px;color:var(--text-4)">Detected 1 hour ago · Confidence: 92%</div>
              </div>
            </div>
            
            <div style="display:flex;gap:12px;padding:12px;background:var(--blue-light);border:1px solid var(--blue-mid);border-radius:var(--radius-sm)">
              <div style="font-size:24px">ℹ️</div>
              <div style="flex:1">
                <div style="font-size:12px;font-weight:600;margin-bottom:4px">Pressure Spike Detected</div>
                <div style="font-size:11px;color:var(--text-3);margin-bottom:4px">Location: N-031 · Severity: Low</div>
                <div style="font-size:10px;color:var(--text-4)">Detected 2 hours ago · Confidence: 88%</div>
              </div>
            </div>
          </div>
          
          <div style="margin-top:16px;padding:12px;background:var(--green-light);border:1px solid var(--green-mid);border-radius:var(--radius-sm)">
            <div style="font-size:11px;font-weight:600;color:var(--green);margin-bottom:4px">✅ Model Performance</div>
            <div style="font-size:11px;color:var(--text-3)">Detection Accuracy: 95.8% · False Positive Rate: 4.2%</div>
          </div>
        </div>
      </div>
    `;
  }

  renderThresholds() {
    const thresholds = this.data.thresholds?.waterQuality || [];
    
    return `
      <div style="background:var(--blue-light);border:1px solid var(--blue-mid);border-radius:var(--radius-sm);padding:16px;margin-bottom:20px">
        <div style="font-size:14px;font-weight:600;color:var(--blue);margin-bottom:8px">⚙️ Threshold Configuration</div>
        <div style="font-size:12px;color:var(--text-2);line-height:1.6">
          Configure alert thresholds for water quality parameters. System will automatically trigger alerts when values exceed these limits.
          Changes are applied in real-time to the monitoring system.
        </div>
      </div>

      <div class="panel">
        <div class="panel-header">
          <div class="panel-title">📊 Water Quality Thresholds</div>
          <span class="badge badge-blue">${thresholds.length} PARAMETERS</span>
        </div>
        <div class="panel-body">
          <div style="display:flex;flex-direction:column;border:1px solid var(--border);border-radius:var(--radius);overflow:hidden">
            <div style="display:grid;grid-template-columns:2fr 1fr 1fr 1fr;gap:12px;padding:12px 16px;background:var(--surface-2);font-size:10px;font-weight:600;color:var(--text-4);text-transform:uppercase;letter-spacing:1px;font-family:'IBM Plex Mono',monospace">
              <div>PARAMETER</div>
              <div>MIN VALUE</div>
              <div>MAX VALUE</div>
              <div>UNIT</div>
            </div>
            ${thresholds.map((threshold, index) => `
              <div style="display:grid;grid-template-columns:2fr 1fr 1fr 1fr;gap:12px;padding:12px 16px;border-top:1px solid var(--border);align-items:center">
                <div style="font-size:13px;font-weight:600">${threshold.parameter}</div>
                <div>
                  <input type="number" value="${threshold.min}" 
                         style="width:100%;padding:6px 10px;border:1px solid var(--border);border-radius:6px;font-size:13px;font-family:'IBM Plex Mono',monospace;font-weight:600;background:var(--surface);transition:all .15s"
                         onfocus="this.style.borderColor='var(--blue)';this.style.background='var(--blue-light)'"
                         onblur="this.style.borderColor='var(--border)';this.style.background='var(--surface)'">
                </div>
                <div>
                  <input type="number" value="${threshold.max}" 
                         style="width:100%;padding:6px 10px;border:1px solid var(--border);border-radius:6px;font-size:13px;font-family:'IBM Plex Mono',monospace;font-weight:600;background:var(--surface);transition:all .15s"
                         onfocus="this.style.borderColor='var(--blue)';this.style.background='var(--blue-light)'"
                         onblur="this.style.borderColor='var(--border)';this.style.background='var(--surface)'">
                </div>
                <div style="font-size:12px;color:var(--text-3);font-family:'IBM Plex Mono',monospace">${threshold.unit}</div>
              </div>
            `).join('')}
          </div>
          <div style="display:flex;gap:12px;margin-top:20px">
            <button class="btn btn-primary">💾 Save Changes</button>
            <button class="btn btn-ghost">↺ Reset to Defaults</button>
          </div>
        </div>
      </div>

      <div class="panel">
        <div class="panel-header">
          <div class="panel-title">🔔 Alert Rules</div>
          <span class="badge badge-green">4 ACTIVE</span>
        </div>
        <div class="panel-body">
          <div style="display:flex;flex-direction:column;gap:12px">
            <div style="display:flex;align-items:center;gap:12px;padding:14px;background:var(--surface-2);border:1px solid var(--border);border-radius:var(--radius-sm)">
              <div style="width:44px;height:44px;border-radius:10px;background:var(--red-light);color:var(--red);display:flex;align-items:center;justify-content:center;font-size:20px;flex-shrink:0">🚨</div>
              <div style="flex:1">
                <div style="font-size:13px;font-weight:600;margin-bottom:3px">Critical Leak Detection</div>
                <div style="font-size:11px;color:var(--text-3);line-height:1.5">Trigger buzzer and send alert when leak confidence > 90% and flow loss > 3 L/min</div>
              </div>
              <span style="font-size:10px;font-weight:600;color:var(--green);padding:4px 10px;background:var(--green-light);border-radius:20px;font-family:'IBM Plex Mono',monospace">ACTIVE</span>
            </div>
            <div style="display:flex;align-items:center;gap:12px;padding:14px;background:var(--surface-2);border:1px solid var(--border);border-radius:var(--radius-sm)">
              <div style="width:44px;height:44px;border-radius:10px;background:var(--amber-light);color:var(--amber);display:flex;align-items:center;justify-content:center;font-size:20px;flex-shrink:0">⚠️</div>
              <div style="flex:1">
                <div style="font-size:13px;font-weight:600;margin-bottom:3px">Water Quality Alert</div>
                <div style="font-size:11px;color:var(--text-3);line-height:1.5">Alert when any parameter exceeds configured thresholds for more than 5 minutes</div>
              </div>
              <span style="font-size:10px;font-weight:600;color:var(--green);padding:4px 10px;background:var(--green-light);border-radius:20px;font-family:'IBM Plex Mono',monospace">ACTIVE</span>
            </div>
            <div style="display:flex;align-items:center;gap:12px;padding:14px;background:var(--surface-2);border:1px solid var(--border);border-radius:var(--radius-sm)">
              <div style="width:44px;height:44px;border-radius:10px;background:var(--blue-light);color:var(--blue);display:flex;align-items:center;justify-content:center;font-size:20px;flex-shrink:0">💧</div>
              <div style="flex:1">
                <div style="font-size:13px;font-weight:600;margin-bottom:3px">Low Soil Moisture</div>
                <div style="font-size:11px;color:var(--text-3);line-height:1.5">Auto-activate sprinklers when soil moisture drops below 30% threshold</div>
              </div>
              <span style="font-size:10px;font-weight:600;color:var(--green);padding:4px 10px;background:var(--green-light);border-radius:20px;font-family:'IBM Plex Mono',monospace">ACTIVE</span>
            </div>
            <div style="display:flex;align-items:center;gap:12px;padding:14px;background:var(--surface-2);border:1px solid var(--border);border-radius:var(--radius-sm)">
              <div style="width:44px;height:44px;border-radius:10px;background:var(--green-light);color:var(--green);display:flex;align-items:center;justify-content:center;font-size:20px;flex-shrink:0">⚙️</div>
              <div style="flex:1">
                <div style="font-size:13px;font-weight:600;margin-bottom:3px">Pump Efficiency Warning</div>
                <div style="font-size:11px;color:var(--text-3);line-height:1.5">Alert when pump efficiency drops below 80% - may indicate maintenance needed</div>
              </div>
              <span style="font-size:10px;font-weight:600;color:var(--green);padding:4px 10px;background:var(--green-light);border-radius:20px;font-family:'IBM Plex Mono',monospace">ACTIVE</span>
            </div>
          </div>
        </div>
      </div>
    `;
  }

  renderReports() {
    return `
      <div style="background:var(--blue-light);border:1px solid var(--blue-mid);border-radius:var(--radius-sm);padding:16px;margin-bottom:20px">
        <div style="font-size:14px;font-weight:600;color:var(--blue);margin-bottom:8px">📊 Reports & Data Export</div>
        <div style="font-size:12px;color:var(--text-2);line-height:1.6">
          Generate comprehensive reports and export data for analysis, compliance, and record-keeping.
          All reports include real-time data and historical trends.
        </div>
      </div>

      <div style="display:grid;grid-template-columns:repeat(auto-fit,minmax(280px,1fr));gap:16px">
        <div style="background:var(--surface-2);border:1px solid var(--border);border-radius:var(--radius);padding:24px;text-align:center;transition:all .2s;cursor:pointer"
             onmouseover="this.style.boxShadow='var(--shadow-md)';this.style.transform='translateY(-2px)'"
             onmouseout="this.style.boxShadow='none';this.style.transform='translateY(0)'">
          <div style="width:56px;height:56px;border-radius:12px;background:var(--blue-light);color:var(--blue);display:flex;align-items:center;justify-content:center;margin:0 auto 12px">
            <svg width="28" height="28" viewBox="0 0 24 24" stroke="currentColor" fill="none" stroke-width="2">
              <path d="M9 3H5a2 2 0 0 0-2 2v4m6-6h10a2 2 0 0 1 2 2v4M9 3v18m0 0h10a2 2 0 0 0 2-2v-4M9 21H5a2 2 0 0 1-2-2v-4"/>
            </svg>
          </div>
          <div style="font-size:14px;font-weight:600;margin-bottom:6px">Water Quality Report</div>
          <div style="font-size:11px;color:var(--text-3);margin-bottom:14px">Complete analysis of all quality parameters with trends</div>
          <button class="btn btn-primary" style="padding:6px 12px;font-size:11px" onclick="app.generatePDFReport('Water Quality')">📥 Generate PDF</button>
        </div>

        <div style="background:var(--surface-2);border:1px solid var(--border);border-radius:var(--radius);padding:24px;text-align:center;transition:all .2s;cursor:pointer"
             onmouseover="this.style.boxShadow='var(--shadow-md)';this.style.transform='translateY(-2px)'"
             onmouseout="this.style.boxShadow='none';this.style.transform='translateY(0)'">
          <div style="width:56px;height:56px;border-radius:12px;background:var(--red-light);color:var(--red);display:flex;align-items:center;justify-content:center;margin:0 auto 12px">
            <svg width="28" height="28" viewBox="0 0 24 24" stroke="currentColor" fill="none" stroke-width="2">
              <circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="12"/>
            </svg>
          </div>
          <div style="font-size:14px;font-weight:600;margin-bottom:6px">Leak Detection Log</div>
          <div style="font-size:11px;color:var(--text-3);margin-bottom:14px">Detailed leak history with locations and severity</div>
          <button class="btn btn-primary" style="padding:6px 12px;font-size:11px" onclick="app.generatePDFReport('Leak Detection')">📥 Generate PDF</button>
        </div>

        <div style="background:var(--surface-2);border:1px solid var(--border);border-radius:var(--radius);padding:24px;text-align:center;transition:all .2s;cursor:pointer"
             onmouseover="this.style.boxShadow='var(--shadow-md)';this.style.transform='translateY(-2px)'"
             onmouseout="this.style.boxShadow='none';this.style.transform='translateY(0)'">
          <div style="width:56px;height:56px;border-radius:12px;background:var(--green-light);color:var(--green);display:flex;align-items:center;justify-content:center;margin:0 auto 12px">
            <svg width="28" height="28" viewBox="0 0 24 24" stroke="currentColor" fill="none" stroke-width="2">
              <path d="M12 2v20M17 7l-5 5-5-5"/>
            </svg>
          </div>
          <div style="font-size:14px;font-weight:600;margin-bottom:6px">Irrigation Report</div>
          <div style="font-size:11px;color:var(--text-3);margin-bottom:14px">Zone-wise water usage and efficiency metrics</div>
          <button class="btn btn-primary" style="padding:6px 12px;font-size:11px" onclick="app.generatePDFReport('Irrigation')">📥 Generate PDF</button>
        </div>

        <div style="background:var(--surface-2);border:1px solid var(--border);border-radius:var(--radius);padding:24px;text-align:center;transition:all .2s;cursor:pointer"
             onmouseover="this.style.boxShadow='var(--shadow-md)';this.style.transform='translateY(-2px)'"
             onmouseout="this.style.boxShadow='none';this.style.transform='translateY(0)'">
          <div style="width:56px;height:56px;border-radius:12px;background:var(--teal-light);color:var(--teal);display:flex;align-items:center;justify-content:center;margin:0 auto 12px">
            <svg width="28" height="28" viewBox="0 0 24 24" stroke="currentColor" fill="none" stroke-width="2">
              <polyline points="22 12 18 12 15 21 9 3 6 12 2 12"/>
            </svg>
          </div>
          <div style="font-size:14px;font-weight:600;margin-bottom:6px">Demand Forecast</div>
          <div style="font-size:11px;color:var(--text-3);margin-bottom:14px">7-day prediction with sector breakdown</div>
          <button class="btn btn-primary" style="padding:6px 12px;font-size:11px" onclick="app.generatePDFReport('Demand Forecast')">📥 Generate PDF</button>
        </div>

        <div style="background:var(--surface-2);border:1px solid var(--border);border-radius:var(--radius);padding:24px;text-align:center;transition:all .2s;cursor:pointer"
             onmouseover="this.style.boxShadow='var(--shadow-md)';this.style.transform='translateY(-2px)'"
             onmouseout="this.style.boxShadow='none';this.style.transform='translateY(0)'">
          <div style="width:56px;height:56px;border-radius:12px;background:var(--amber-light);color:var(--amber);display:flex;align-items:center;justify-content:center;margin:0 auto 12px">
            <svg width="28" height="28" viewBox="0 0 24 24" stroke="currentColor" fill="none" stroke-width="2">
              <line x1="12" y1="20" x2="12" y2="10"/><line x1="18" y1="20" x2="18" y2="4"/>
            </svg>
          </div>
          <div style="font-size:14px;font-weight:600;margin-bottom:6px">Analytics Summary</div>
          <div style="font-size:11px;color:var(--text-3);margin-bottom:14px">Water savings, efficiency, and AI insights</div>
          <button class="btn btn-primary" style="padding:6px 12px;font-size:11px" onclick="app.generatePDFReport('Analytics')">📥 Generate PDF</button>
        </div>

        <div style="background:var(--surface-2);border:1px solid var(--border);border-radius:var(--radius);padding:24px;text-align:center;transition:all .2s;cursor:pointer"
             onmouseover="this.style.boxShadow='var(--shadow-md)';this.style.transform='translateY(-2px)'"
             onmouseout="this.style.boxShadow='none';this.style.transform='translateY(0)'">
          <div style="width:56px;height:56px;border-radius:12px;background:var(--purple-light);color:var(--purple);display:flex;align-items:center;justify-content:center;margin:0 auto 12px">
            <svg width="28" height="28" viewBox="0 0 24 24" stroke="currentColor" fill="none" stroke-width="2">
              <rect x="2" y="7" width="20" height="14" rx="2"/><path d="M16 21V5a2 2 0 0 0-2-2h-4a2 2 0 0 0-2 2v16"/>
            </svg>
          </div>
          <div style="font-size:14px;font-weight:600;margin-bottom:6px">Hardware Status</div>
          <div style="font-size:11px;color:var(--text-3);margin-bottom:14px">Sensor readings and actuator performance</div>
          <button class="btn btn-primary" style="padding:6px 12px;font-size:11px" onclick="app.generatePDFReport('Hardware')">📥 Generate PDF</button>
        </div>
      </div>

      <div class="panel" style="margin-top:20px">
        <div class="panel-header">
          <div class="panel-title">📤 Raw Data Export</div>
        </div>
        <div class="panel-body">
          <div style="display:flex;flex-direction:column;gap:12px">
            <div style="display:flex;align-items:center;justify-content:space-between;padding:12px;background:var(--surface-2);border:1px solid var(--border);border-radius:var(--radius-sm)">
              <div>
                <div style="font-size:13px;font-weight:600;margin-bottom:2px">Export All Sensor Data (CSV)</div>
                <div style="font-size:11px;color:var(--text-3)">Complete dataset with timestamps for external analysis</div>
              </div>
              <button class="btn btn-ghost" style="padding:6px 12px;font-size:11px" onclick="app.exportCSV()">📊 Export CSV</button>
            </div>
            <div style="display:flex;align-items:center;justify-content:space-between;padding:12px;background:var(--surface-2);border:1px solid var(--border);border-radius:var(--radius-sm)">
              <div>
                <div style="font-size:13px;font-weight:600;margin-bottom:2px">Export Historical Data (JSON)</div>
                <div style="font-size:11px;color:var(--text-3)">Structured data format for API integration</div>
              </div>
              <button class="btn btn-ghost" style="padding:6px 12px;font-size:11px" onclick="app.exportData()">📦 Export JSON</button>
            </div>
            <div style="display:flex;align-items:center;justify-content:space-between;padding:12px;background:var(--surface-2);border:1px solid var(--border);border-radius:var(--radius-sm)">
              <div>
                <div style="font-size:13px;font-weight:600;margin-bottom:2px">Export Alert Logs (TXT)</div>
                <div style="font-size:11px;color:var(--text-3)">Plain text format for compliance and auditing</div>
              </div>
              <button class="btn btn-ghost" style="padding:6px 12px;font-size:11px" onclick="app.exportData()">📝 Export TXT</button>
            </div>
          </div>
        </div>
      </div>
    `;
  }

  refreshData() {
    this.fetchInitialData();
  }

  exportData() {
    const dataStr = JSON.stringify(this.data, null, 2);
    const dataBlob = new Blob([dataStr], { type: 'application/json' });
    const url = URL.createObjectURL(dataBlob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `aquasync-data-${new Date().toISOString()}.json`;
    link.click();
  }

  // AI Chatbot Functions
  toggleAIChat() {
    const chatbot = document.getElementById('ai-chatbot');
    if (chatbot.style.display === 'none' || !chatbot.style.display) {
      chatbot.style.display = 'flex';
      if (!this.chatInitialized) {
        this.initAIChat();
        this.chatInitialized = true;
      }
    } else {
      chatbot.style.display = 'none';
    }
  }

  initAIChat() {
    const messages = document.getElementById('chat-messages');
    messages.innerHTML = `
      <div style="background:var(--purple-light);border:1px solid var(--purple);border-radius:var(--radius-sm);padding:12px">
        <div style="font-size:12px;font-weight:600;color:var(--purple);margin-bottom:4px">👋 Hello! I'm your AI Water Management Assistant</div>
        <div style="font-size:11px;color:var(--text-3);line-height:1.5">I can help you understand system status, analyze leaks, optimize irrigation, and provide recommendations. What would you like to know?</div>
      </div>
    `;
  }

  sendAIMessage() {
    const input = document.getElementById('chat-input');
    const message = input.value.trim();
    if (!message) return;

    this.addChatMessage(message, 'user');
    input.value = '';

    setTimeout(() => {
      const response = this.generateAIResponse(message);
      this.addChatMessage(response, 'ai');
    }, 500);
  }

  quickAIQuery(type) {
    const queries = {
      leak: 'Analyze current leak situation and provide recommendations',
      irrigation: 'How can I optimize irrigation efficiency?',
      forecast: 'What is the demand forecast for next week?'
    };
    document.getElementById('chat-input').value = queries[type];
    this.sendAIMessage();
  }

  addChatMessage(text, sender) {
    const messages = document.getElementById('chat-messages');
    const isUser = sender === 'user';
    
    const msgDiv = document.createElement('div');
    msgDiv.style.cssText = `
      background: ${isUser ? 'var(--blue-light)' : 'var(--surface-2)'};
      border: 1px solid ${isUser ? 'var(--blue-mid)' : 'var(--border)'};
      border-radius: var(--radius-sm);
      padding: 10px 12px;
      font-size: 12px;
      line-height: 1.5;
      ${isUser ? 'margin-left: 40px;' : 'margin-right: 40px;'}
    `;
    msgDiv.innerHTML = `
      <div style="font-weight:600;margin-bottom:4px;color:${isUser ? 'var(--blue)' : 'var(--purple)'}">${isUser ? 'You' : '🤖 AI Assistant'}</div>
      <div style="color:var(--text-2)">${text}</div>
    `;
    messages.appendChild(msgDiv);
    messages.scrollTop = messages.scrollHeight;
  }

  generateAIResponse(query) {
    const q = query.toLowerCase();
    
    if (q.includes('leak')) {
      const leaks = this.data?.leaks || [];
      const critical = leaks.filter(l => l.severity === 'critical').length;
      return `🔴 Leak Analysis:\n\n• Total active leaks: ${leaks.length}\n• Critical leaks: ${critical}\n• Total water loss: ${leaks.reduce((sum, l) => sum + l.flow, 0).toFixed(1)} L/min\n\n💡 Recommendations:\n${critical > 0 ? '• Immediate action required for critical leaks\n• Deploy maintenance team to affected zones\n• Activate backup water supply if needed' : '• Continue monitoring\n• Schedule preventive maintenance\n• Review pipeline integrity scores'}`;
    }
    
    if (q.includes('irrigation') || q.includes('water') && q.includes('save')) {
      const irrigation = this.data?.irrigation || {};
      return `🌱 Irrigation Optimization:\n\n• Active zones: ${irrigation.activeZones || 0}\n• Water saved today: ${irrigation.totalWaterSaved || 0} L\n\n💡 Tips:\n• Auto-control is working efficiently\n• Soil moisture sensors are optimal\n• Consider adjusting threshold to 28% for more savings\n• Schedule irrigation during off-peak hours`;
    }
    
    if (q.includes('forecast') || q.includes('demand') || q.includes('predict')) {
      const forecast = this.data?.demandForecast || {};
      return `📊 Demand Forecast:\n\n• Today: ${forecast.today?.value || 0} MLD\n• 7-day average: ${forecast.forecast7Day?.value || 0} MLD\n• Model accuracy: ${forecast.modelAccuracy || 0}%\n\n💡 Insights:\n• ${forecast.shortageRisk?.day || 'No'} shortage risk detected\n• Peak demand expected at ${forecast.today?.peakTime || 'N/A'}\n• Recommend pre-filling reservoirs before peak hours`;
    }
    
    if (q.includes('quality') || q.includes('ph') || q.includes('tds')) {
      const wq = this.data?.waterQuality || {};
      return `💧 Water Quality Status:\n\n• WQI: ${wq.wqi || 0} (Excellent)\n• pH: ${wq.ph || 0} (Optimal)\n• TDS: ${wq.tds || 0} ppm (Good)\n• Chlorine: ${wq.chlorine || 0} mg/L (Safe)\n\n✅ All parameters within safe limits\n💡 Continue regular monitoring`;
    }
    
    if (q.includes('efficiency') || q.includes('performance')) {
      const analytics = this.data?.analytics || {};
      return `⚡ System Performance:\n\n• Overall efficiency: ${analytics.efficiency?.overall || 0}%\n• Distribution: ${analytics.efficiency?.distribution || 0}%\n• Irrigation: ${analytics.efficiency?.irrigation || 0}%\n\n💡 Recommendations:\n• System performing well\n• Focus on leak prevention for better efficiency\n• Consider pump maintenance schedule`;
    }
    
    if (q.includes('pump')) {
      const pumps = this.data?.pumps || [];
      const operational = pumps.filter(p => p.status === 'operational').length;
      return `⚙️ Pump Status:\n\n• Operational: ${operational}/${pumps.length}\n• Average efficiency: ${(pumps.reduce((sum, p) => sum + p.efficiency, 0) / pumps.length).toFixed(1)}%\n\n💡 Recommendations:\n${pumps.some(p => p.efficiency < 80) ? '• Schedule maintenance for low-efficiency pumps\n• Check for mechanical issues' : '• All pumps performing well\n• Continue regular maintenance schedule'}`;
    }
    
    return `🤖 I can help you with:\n\n• Leak detection and analysis\n• Irrigation optimization\n• Demand forecasting\n• Water quality monitoring\n• System efficiency\n• Pump performance\n\nPlease ask a specific question about any of these topics!`;
  }

  // Report Generation Functions
  generatePDFReport(type) {
    alert(`Generating ${type} report...\n\nIn production, this would:\n1. Collect relevant data\n2. Generate PDF with charts\n3. Download automatically\n\nFor demo: Check console for data`);
    console.log(`${type} Report Data:`, this.data);
  }

  exportCSV() {
    const csv = this.convertToCSV(this.data);
    const blob = new Blob([csv], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `aquasync-data-${new Date().toISOString()}.csv`;
    link.click();
  }

  convertToCSV(data) {
    let csv = 'Timestamp,Parameter,Value,Unit\n';
    const timestamp = new Date().toISOString();
    
    if (data.waterQuality) {
      Object.entries(data.waterQuality).forEach(([key, value]) => {
        csv += `${timestamp},${key},${value},\n`;
      });
    }
    
    return csv;
  }

  // Irrigation Control Methods
  async setIrrigationMode(mode) {
    try {
      const response = await fetch('http://localhost:3000/api/control/irrigation-mode', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ mode })
      });
      const result = await response.json();
      if (result.success) {
        console.log(`Irrigation mode set to: ${mode}`);
        // Data will update via WebSocket
      }
    } catch (error) {
      console.error('Failed to set irrigation mode:', error);
    }
  }

  async controlSprinkler(zoneId, action, duration = 15) {
    try {
      const response = await fetch(`http://localhost:3000/api/control/sprinkler/${zoneId}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action, duration })
      });
      const result = await response.json();
      if (result.success) {
        console.log(`Sprinkler ${zoneId} ${action}`);
        // Data will update via WebSocket
      }
    } catch (error) {
      console.error('Failed to control sprinkler:', error);
    }
  }
}

// Initialize app
const app = new AquaSyncApp();
window.app = app;
