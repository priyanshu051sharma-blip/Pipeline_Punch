# Dashboard Rebuild Instructions

## Current Status
- Backend is fully functional with all data endpoints
- Frontend has basic structure but doesn't match reference design
- Reference design (`water_dashboard (1).html`) shows the exact layout needed

## Key Issues to Fix

### 1. Overview Tab
**Current**: Simple 2-column layout with basic leak list and pump status
**Needed**: 
- 5 KPI cards (WQI, Demand, Water Loss, STP Efficiency, Pump Station)
- Water Quality circular SVG chart + parameter cards
- Hourly Demand Chart.js line chart  
- Leak Detection panel with ML Confidence bars
- Pump Stations 2x2 grid
- Zone Distribution donut chart
- AI Insights panel with 4 insights

### 2. Water Quality Tab
**Current**: Basic parameter cards and zone heatmap
**Needed**:
- 4 KPI cards with trends
- 24-Hour Parameter Trends Chart.js with toggle buttons (pH, Turbidity, Chlorine, DO)
- Live Sensor Status with threshold bars
- Zone Quality Heatmap (12 zones)
- Quality Alerts Log

### 3. Leak Detection Tab  
**Current**: Basic leak table
**Needed**:
- 4 KPI cards
- Active Leak Events table
- Pressure Wave Analysis Chart.js
- Pipeline Integrity grid (12 segments)

### 4. Demand Forecast Tab
**Current**: Basic forecast display
**Needed**:
- 4 KPI cards
- 7-Day Forecast Chart.js with confidence band
- Daily Forecast list with bars
- Sector Demand Breakdown Chart.js bar chart
- Planning Recommendations (4 AI insights)

## Implementation Plan

Since the changes are extensive, I recommend:

1. **Backup current file** ✅ Done (main-simple-backup.js)
2. **Add Chart.js initialization** after render() calls
3. **Rebuild each tab's render method** to match reference
4. **Add Chart.js destroy/recreate** logic to prevent memory leaks
5. **Test each tab** individually

## Quick Fix Option

Replace `frontend/main-simple.js` with the enhanced version that includes:
- All Chart.js visualizations
- Proper grid layouts matching reference
- ML Confidence bars
- AI Insights panels
- Complete data binding

Would you like me to:
A) Create the complete replacement file in chunks
B) Provide specific fixes for each tab one at a time
C) Create a detailed code diff showing exact changes needed
