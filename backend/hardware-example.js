// Example hardware integration client
// This demonstrates how to send sensor data to the backend

const axios = require('axios');

const API_URL = 'http://localhost:3000/api/hardware/data';

// Simulated sensor readings
async function sendSensorData() {
  const sensors = [
    { sensor: 'ph_sensor_01', value: 7.2 + (Math.random() - 0.5) * 0.5 },
    { sensor: 'turbidity_sensor_01', value: 2.1 + (Math.random() - 0.5) * 0.3 },
    { sensor: 'tds_sensor_01', value: 145 + (Math.random() - 0.5) * 10 },
    { sensor: 'chlorine_sensor_01', value: 0.8 + (Math.random() - 0.5) * 0.1 },
    { sensor: 'temp_sensor_01', value: 24.5 + (Math.random() - 0.5) * 2 },
    { sensor: 'pressure_sensor_n047', value: 1.2 + (Math.random() - 0.5) * 0.5 }
  ];

  for (const data of sensors) {
    try {
      const response = await axios.post(API_URL, data);
      console.log(`✓ Sent ${data.sensor}: ${data.value.toFixed(2)}`);
    } catch (error) {
      console.error(`✗ Failed to send ${data.sensor}:`, error.message);
    }
  }
}

// Send data every 5 seconds
console.log('🔌 Hardware client started - sending sensor data...');
setInterval(sendSensorData, 5000);
sendSensorData(); // Send immediately on start
