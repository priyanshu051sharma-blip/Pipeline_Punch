// AquaSync Enhanced Dashboard - Matching Reference Design
class AquaSyncApp {
  constructor() {
    this.data = null;
    this.ws = null;
    this.currentTab = 'overview';
    this.charts = {}; // Store Chart.js instances
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

    const content = document.getElementById('app-content');
    
    switch(this.currentTab) {
      case 'overview': content.innerHTML = this.renderOverview(); break;
      case 'quality': content.innerHTML = this.renderQuality(); break;
      case 'leaks': content.innerHTML = this.renderLeaks(); break;
