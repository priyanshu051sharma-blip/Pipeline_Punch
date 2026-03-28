# 🎯 AquaSync Dashboard - Quick Guide

## 🌐 Access URLs

- **Frontend Dashboard**: http://localhost:5174
- **Backend API**: http://localhost:3000
- **API Health Check**: http://localhost:3000/api/health
- **Dashboard Data**: http://localhost:3000/api/dashboard

---

## 📱 Dashboard Tabs Overview

### 1️⃣ Overview Tab (Default)
**What you'll see:**
- Water Quality Index: 87.4 (Excellent)
- Current Demand: 2.47 MLD
- Active Leaks: 3 (with critical alerts)
- Water Savings: 8.3%
- Active leak list with buzzer status
- 4 pump status cards with efficiency metrics

**Key Features:**
- Real-time KPI updates
- Critical leak alerts at top
- Pump performance monitoring

---

### 2️⃣ Water Quality Tab
**What you'll see:**
- 6 parameter cards: pH (7.2), Turbidity (2.1 NTU), TDS (145 ppm), Chlorine (0.8 mg/L), Temperature (24.5°C), Flow Rate (12.5 L/min)
- 12-zone quality heatmap with color coding
- Quality alerts log with timestamps

**Key Features:**
- All parameters within safe ranges
- Zone-wise quality visualization
- Real-time alert monitoring

---

### 3️⃣ Leak Detection Tab
**What you'll see:**
- Total leaks: 3 (1 critical, 1 medium, 1 low)
- Total water loss: 6.6 L/min
- Detection confidence: 84.6% average
- Detailed leak table with locations
- 12-segment pipeline integrity grid

**Key Features:**
- Leak severity classification
- Confidence scores from AI
- Pipeline health monitoring

---

### 4️⃣ Network Map Tab ⭐ NEW
**What you'll see:**
- Interactive SVG pipeline map
- 5 network nodes (N-001 to N-052)
- Blue lines connecting nodes (normal pipes)
- Red dashed lines (leak-affected pipes)
- Animated 💧 markers at leak locations
- Pulsing red circles around leak nodes
- Node details grid below map

**Key Features:**
- Visual pipeline network
- Real-time leak spotting
- Pressure and flow data per node
- Interactive hover effects

**How to use:**
- Hover over nodes to see details
- Red nodes indicate leaks
- Animated water drops show leak locations
- Grid below shows all node statistics

---

### 5️⃣ Smart Irrigation Tab ⭐ COMPLETE
**What you'll see:**
- 4 KPI cards: Active zones (2), Scheduled (1), Water saved (1250 L), Total zones (6)
- Auto-control logic explanation panel
- 6 irrigation zone cards with:

**Zone Card Details:**
```
Park A - North (Z-001)
├─ Status: 💦 ACTIVE (blue badge)
├─ Soil Moisture: 25% (red, below threshold)
├─ Visual bar with 30% threshold marker
├─ Water Used: 145 L
├─ Duration: 15 min
└─ Last Watered: 2 min ago
```

**Auto-Control Logic:**
- Activates when moisture < 30%
- Runs until moisture reaches 40%
- Automatic shut-off
- Real-time sensor monitoring

**Key Features:**
- Live moisture readings from sensors
- Sprinkler duration tracking
- Water usage per zone
- Auto-control status badges
- Color-coded moisture levels

---

### 6️⃣ Hardware Status Tab
**What you'll see:**
- ESP32 status: ✓ CONNECTED (Uptime: 48h 23m)
- Arduino status: ✓ CONNECTED (8 sensors)
- 5 sensor cards with live readings:
  - Flow Sensor: 12.5 L/min (98.5% accuracy)
  - pH Sensor: 7.2 pH (99.2% accuracy)
  - TDS Sensor: 145 ppm (97.8% accuracy)
  - Soil Moisture: 32% (96.5% accuracy)
  - Pressure Sensor: 3.8 bar (99.1% accuracy)
- 4 actuator controls:
  - Main Pump: ON (2.4 kW, 1247 cycles)
  - Sprinklers: 2/6 active (243 L/min flow)
  - Buzzer: ACTIVE (3 alerts)
  - Valves: 4 open, 2 closed
- Hardware architecture diagram

**Key Features:**
- Real-time sensor accuracy
- Actuator control buttons
- System architecture visualization

---

### 7️⃣ Analytics & AI Tab
**What you'll see:**
- Water savings: Today 8.3%, Week 52.4%, Month 218.7%
- Leaks prevented: 9/12 (saved 4250 L)
- Overall efficiency: 90.5%
- System efficiency breakdown
- AI predictions:
  - Next leak risk: Low
  - Maintenance due: 12 days
  - Peak demand time: 18:30
- Recommended action

**Key Features:**
- Savings trend analysis
- Efficiency metrics
- AI-powered predictions
- Actionable recommendations

---

### 8️⃣ Demand Forecast Tab
**What you'll see:**
- Today's demand: 2.47 MLD
- 7-day forecast: 2.61 MLD (94.5% confidence)
- Model accuracy: 98.2%
- Shortage risk: Day 3 (Monsoon pre-fill)
- 7-day forecast bars with status (Normal/Elevated/High)
- Sector breakdown:
  - Residential: 1.1 → 1.15 MLD
  - Industrial: 0.7 → 0.72 MLD
  - Irrigation: 0.45 → 0.52 MLD
  - Commercial: 0.22 → 0.22 MLD
- 4 AI recommendations

**Key Features:**
- ML-powered predictions
- Sector-wise analysis
- Risk assessment
- Actionable insights

---

### 9️⃣ Threshold Configuration Tab ⭐ WORKING
**What you'll see:**
- Configuration intro panel
- Editable threshold table:
  - pH Level: 6.5 - 8.5
  - Turbidity: 0 - 4 NTU
  - Chlorine: 0.2 - 4.0 mg/L
  - Dissolved O₂: 7.0 - 12.0 mg/L
  - Pressure: 2.0 - 8.0 bar
  - Flow Rate: 100 - 600 LPM
- 4 active alert rules:
  - Critical Leak Detection
  - Water Quality Alert
  - Low Soil Moisture
  - Pump Efficiency Warning
- Save and Reset buttons

**Key Features:**
- Editable min/max values
- Real-time input styling
- Alert rule management
- Configuration persistence

**How to use:**
- Click on min/max input fields
- Enter new threshold values
- Click "Save Changes" to apply
- Click "Reset to Defaults" to restore

---

### 🔟 Reports Tab
**What you'll see:**
- 6 report generation cards:
  - Water Quality Report
  - Leak Detection Log
  - Irrigation Report
  - Demand Forecast
  - Analytics Summary
  - Hardware Status
- Raw data export options:
  - CSV export
  - JSON export
  - TXT export

**Key Features:**
- One-click PDF generation
- Multiple export formats
- Comprehensive reporting
- Compliance-ready

---

## 🔄 Real-Time Updates

**Update Frequency:** Every 5 seconds

**What updates automatically:**
- Water quality parameters
- Soil moisture levels
- Leak detection
- Pump status
- Demand metrics
- Sensor readings

**Visual Indicators:**
- Green pulse dot in sidebar: LIVE
- Connection status: "LIVE MONITORING"
- Smooth animations on data changes

---

## 🎨 Visual Features

### Color Coding
- **Green**: Normal/Good/Operational
- **Blue**: Active/Information
- **Amber**: Warning/Elevated
- **Red**: Critical/Leak/Alert

### Animations
- Pulsing leak markers
- Smooth bar transitions
- Hover effects on cards
- Real-time data updates

### Status Badges
- 🟢 OPERATIONAL
- 🔵 ACTIVE
- 🟡 WARNING
- 🔴 CRITICAL

---

## 🚀 Quick Actions

### Refresh Data
Click "Refresh" button in top bar

### Export Data
Click "Export" button in top bar → Downloads JSON file

### Generate Reports
Go to Reports tab → Click "Generate PDF" on any report card

### Control Actuators
Go to Hardware tab → Click control buttons (Turn ON/OFF)

---

## 🎯 Key Metrics to Watch

### Critical Indicators
- Water Quality Index < 70 → Alert
- Soil Moisture < 30% → Auto-activate sprinklers
- Leak confidence > 90% → Critical alert
- Pump efficiency < 80% → Maintenance needed

### Performance Metrics
- Overall system efficiency: 90.5%
- Water savings today: 8.3%
- Leak prevention rate: 75% (9/12)
- Model accuracy: 98.2%

---

## 💡 Tips for Demo

1. **Start with Overview** - Shows all key metrics at a glance
2. **Show Smart Irrigation** - Highlight auto-control and sensor readings
3. **Demo Network Map** - Visual pipeline with leak spotting
4. **Show Real-time Updates** - Watch values change every 5 seconds
5. **Demonstrate Threshold Config** - Edit values and show save functionality
6. **Generate Reports** - Show export capabilities

---

## 🏆 Hackathon Highlights

### Innovation
- AI-powered leak detection
- ML demand forecasting
- Auto-irrigation control
- Real-time monitoring

### Technology Stack
- Backend: Node.js + Express + WebSocket
- Frontend: Vanilla JS + Vite
- Hardware: ESP32 + Arduino
- Sensors: Flow, pH, TDS, Soil Moisture, Pressure

### Business Value
- 8.3% water savings
- 75% leak prevention
- 90.5% system efficiency
- Real-time alerts and control

### Scalability
- Ready for hardware integration
- API-first architecture
- WebSocket for real-time updates
- Modular component design

---

## 📞 Support

If any tab shows "Loading..." for more than 5 seconds:
1. Check backend is running (port 3000)
2. Check frontend is running (port 5174)
3. Check browser console for errors
4. Refresh the page

**All tabs should load immediately with data!**
