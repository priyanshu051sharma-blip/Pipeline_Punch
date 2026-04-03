# 🚀 Quick Start Guide

Get AquaSync running in 5 minutes!

## Prerequisites

- Node.js (v16 or higher)
- npm or yarn
- A modern web browser

## Installation

### 1. Install Backend Dependencies

```bash
cd backend
npm install
```

### 2. Install Frontend Dependencies

```bash
cd frontend
npm install
```

## Running the Application

### Option A: Run Both Servers (Recommended)

**Terminal 1 - Backend:**
```bash
cd backend
npm start
```
✅ Backend running on http://localhost:3000

**Terminal 2 - Frontend:**
```bash
cd frontend
npm run dev
```
✅ Frontend running on http://localhost:5174

### Option B: Using the Existing Running Servers

If servers are already running (as shown in your terminal), just open:
- **Dashboard**: http://localhost:5174
- **API**: http://localhost:3000/api/dashboard

## First Look

Once both servers are running, open http://localhost:5174 in your browser.

You'll see:
1. **Live Dashboard** with real-time KPIs
2. **Water Quality Index**: 87.4 (GOOD)
3. **Active Leaks**: 3 detected
4. **Smart Irrigation**: 2 zones active
5. **Real-time Updates**: Data refreshes every 5 seconds

## Exploring Features

### 1. System Overview
- Click "Overview" in sidebar
- See all KPIs at a glance
- Watch real-time updates

### 2. Water Quality
- Click "Water Quality" in sidebar
- View 12-zone quality heatmap
- See live sensor readings
- Check 24-hour parameter trends

### 3. Leak Detection
- Click "Leak Detection" in sidebar
- View active leaks with severity
- See ML confidence scores
- Check pipeline integrity heatmap

### 4. Smart Irrigation
- Click "Smart Irrigation" in sidebar
- Watch auto-control in action
- See soil moisture levels
- Track water savings

### 5. Demand Forecast
- Click "Demand Forecast" in sidebar
- View 7-day AI predictions
- See sector breakdown
- Read AI recommendations

### 6. Hardware Status
- Click "Hardware Status" in sidebar
- Check ESP32/Arduino connection
- View all sensor readings
- See actuator status

### 7. Analytics & AI
- Click "Analytics & AI" in sidebar
- View water savings metrics
- See efficiency breakdown
- Read AI insights

### 8. Threshold Config
- Click "Threshold Config" in sidebar
- Adjust alert thresholds
- Configure alert rules
- Save custom settings

## Testing Features

### Test Smart Irrigation
The system automatically controls sprinklers based on soil moisture:
- Watch the "Smart Irrigation" tab
- Zones with moisture < 30% will auto-activate
- Sprinklers stop when moisture reaches 40%
- Water savings are tracked in real-time

### Test Leak Detection
- Navigate to "Leak Detection" tab
- See 3 active leaks with different severities
- Critical leaks trigger the buzzer alert
- ML confidence scores show detection accuracy

### Test Real-time Updates
- Keep the dashboard open
- Watch KPIs update every 5 seconds
- See WebSocket connection status in footer
- Data changes smoothly without page refresh

## API Testing

### Get Dashboard Data
```bash
curl http://localhost:3000/api/dashboard
```

### Get Water Quality
```bash
curl http://localhost:3000/api/water-quality
```

### Get Irrigation Status
```bash
curl http://localhost:3000/api/irrigation
```

### Send Sensor Data (Hardware Integration)
```bash
curl -X POST http://localhost:3000/api/hardware/data \
  -H "Content-Type: application/json" \
  -d '{"sensor":"ph_sensor_01","value":7.2}'
```

### Control Sprinkler
```bash
curl -X POST http://localhost:3000/api/control/sprinkler/Z-001 \
  -H "Content-Type: application/json" \
  -d '{"action":"on","duration":15}'
```

## Troubleshooting

### Backend won't start
- Check if port 3000 is already in use
- Run: `netstat -ano | findstr :3000` (Windows)
- Kill the process or change port in backend/.env

### Frontend won't start
- Check if port 5173/5174 is already in use
- Vite will automatically try the next available port
- Check the terminal output for the actual port

### No real-time updates
- Check WebSocket connection status in footer
- Should show "ALL SYSTEMS LIVE" in green
- If red, restart the backend server

### Sensors showing old data
- This is simulated data for demo purposes
- To connect real hardware, see HARDWARE_INTEGRATION.md
- Enable hardware mode in backend/.env

## Next Steps

### For Demo/Presentation
1. ✅ Keep both servers running
2. ✅ Open dashboard in browser
3. ✅ Navigate through all tabs to show features
4. ✅ Highlight smart irrigation auto-control
5. ✅ Show leak detection with ML confidence
6. ✅ Display demand forecasting
7. ✅ Demonstrate real-time updates

### For Hardware Integration
1. Read HARDWARE_INTEGRATION.md
2. Set up ESP32 and Arduino
3. Connect sensors according to wiring diagram
4. Upload provided code to microcontrollers
5. Enable hardware mode: `HARDWARE_ENABLED=true` in backend/.env
6. Test sensor data transmission

### For Development
1. Explore backend/server.js for API endpoints
2. Check frontend/main.js for dashboard logic
3. Modify frontend/style.css for UI changes
4. Add new sensors in backend data structure
5. Create new dashboard views as needed

## Demo Checklist

Before your hackathon presentation:

- [ ] Both servers running
- [ ] Dashboard loads successfully
- [ ] Real-time updates working (check footer status)
- [ ] All 8 tabs accessible
- [ ] Smart irrigation showing active zones
- [ ] Leak detection showing 3 leaks
- [ ] Demand forecast displaying 7-day chart
- [ ] Hardware tab showing sensor status
- [ ] Browser zoom at 100% for best display
- [ ] Close unnecessary browser tabs
- [ ] Prepare to explain the Sense→Predict→Decide→Act philosophy

## Support

- **Documentation**: README.md
- **Hardware Guide**: HARDWARE_INTEGRATION.md
- **Pitch Document**: HACKATHON_PITCH.md
- **API Reference**: See backend/server.js comments

## Quick Commands Reference

```bash
# Start backend
cd backend && npm start

# Start frontend
cd frontend && npm run dev

# Install all dependencies
cd backend && npm install && cd ../frontend && npm install

# Check backend health
curl http://localhost:3000/api/health

# View live data
curl http://localhost:3000/api/dashboard | json_pp
```

---

**You're all set! 🎉**

Open http://localhost:5174 and start exploring AquaSync!
