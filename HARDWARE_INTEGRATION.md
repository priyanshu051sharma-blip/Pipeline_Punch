# 🔌 Hardware Integration Guide

## Overview
This guide explains how to integrate your Arduino, ESP32, and sensors with the AquaSync platform.

## Hardware Components

### Microcontrollers
- **ESP32**: Main controller for WiFi connectivity and data transmission
- **Arduino Uno**: Sensor data collection and actuator control

### Sensors
1. **Flow Sensor**: Measures water flow rate (L/min)
2. **pH Sensor**: Monitors water acidity/alkalinity
3. **TDS Sensor**: Total Dissolved Solids measurement
4. **Soil Moisture Sensor**: Measures soil moisture percentage
5. **Pressure Sensor**: Monitors pipeline pressure

### Actuators
1. **Water Pump**: Main water distribution pump
2. **Sprinklers**: 6 zone irrigation system
3. **Buzzer**: Alert system for critical events
4. **Solenoid Valves**: Water flow control

## Wiring Diagram

### ESP32 Connections
```
ESP32 Pin Layout:
- GPIO 34 (ADC1_CH6) → pH Sensor (Analog)
- GPIO 35 (ADC1_CH7) → TDS Sensor (Analog)
- GPIO 32 (ADC1_CH4) → Soil Moisture Sensor (Analog)
- GPIO 33 (ADC1_CH5) → Pressure Sensor (Analog)
- GPIO 25 → Flow Sensor (Digital/Interrupt)
- GPIO 26 → Buzzer (PWM)
- GPIO 27 → Pump Relay
- GPIO 14-19 → Sprinkler Relays (6 zones)
- TX/RX → Serial communication with Arduino
```

### Arduino Connections
```
Arduino Pin Layout:
- A0 → pH Sensor backup
- A1 → TDS Sensor backup
- D2 → Flow Sensor (Interrupt)
- D3-D8 → Relay Module (6 channels for sprinklers)
- D9 → Buzzer
- D10 → Main Pump Relay
- D11-D13 → Status LEDs
```

## ESP32 Code Example

```cpp
#include <WiFi.h>
#include <HTTPClient.h>
#include <ArduinoJson.h>

// WiFi credentials
const char* ssid = "YOUR_WIFI_SSID";
const char* password = "YOUR_WIFI_PASSWORD";

// API endpoint
const char* serverUrl = "http://YOUR_SERVER_IP:3000/api/hardware/data";

// Sensor pins
#define PH_PIN 34
#define TDS_PIN 35
#define SOIL_PIN 32
#define PRESSURE_PIN 33
#define FLOW_PIN 25
#define BUZZER_PIN 26
#define PUMP_PIN 27

// Sprinkler pins
int sprinklerPins[] = {14, 15, 16, 17, 18, 19};

// Flow sensor variables
volatile int flowPulseCount = 0;
float flowRate = 0.0;
unsigned long oldTime = 0;

void IRAM_ATTR flowPulseCounter() {
  flowPulseCount++;
}

void setup() {
  Serial.begin(115200);
  
  // Initialize WiFi
  WiFi.begin(ssid, password);
  while (WiFi.status() != WL_CONNECTED) {
    delay(500);
    Serial.print(".");
  }
  Serial.println("\nWiFi Connected!");
  
  // Initialize pins
  pinMode(FLOW_PIN, INPUT_PULLUP);
  pinMode(BUZZER_PIN, OUTPUT);
  pinMode(PUMP_PIN, OUTPUT);
  
  for (int i = 0; i < 6; i++) {
    pinMode(sprinklerPins[i], OUTPUT);
    digitalWrite(sprinklerPins[i], LOW);
  }
  
  // Attach flow sensor interrupt
  attachInterrupt(digitalPinToInterrupt(FLOW_PIN), flowPulseCounter, FALLING);
}

void loop() {
  // Read sensors every 5 seconds
  if (millis() - oldTime > 5000) {
    detachInterrupt(digitalPinToInterrupt(FLOW_PIN));
    
    // Calculate flow rate
    flowRate = ((1000.0 / (millis() - oldTime)) * flowPulseCount) / 7.5;
    oldTime = millis();
    flowPulseCount = 0;
    
    // Read analog sensors
    float phValue = readPH();
    float tdsValue = readTDS();
    float soilMoisture = readSoilMoisture();
    float pressure = readPressure();
    
    // Send data to server
    sendSensorData("ph_sensor_01", phValue);
    sendSensorData("tds_sensor_01", tdsValue);
    sendSensorData("soil_moisture_01", soilMoisture);
    sendSensorData("pressure_sensor_01", pressure);
    sendSensorData("flow_sensor_01", flowRate);
    
    // Check soil moisture and control sprinklers
    autoControlSprinklers(soilMoisture);
    
    attachInterrupt(digitalPinToInterrupt(FLOW_PIN), flowPulseCounter, FALLING);
  }
}

float readPH() {
  int rawValue = analogRead(PH_PIN);
  float voltage = rawValue * (3.3 / 4095.0);
  float ph = 7.0 + ((2.5 - voltage) / 0.18);
  return ph;
}

float readTDS() {
  int rawValue = analogRead(TDS_PIN);
  float voltage = rawValue * (3.3 / 4095.0);
  float tds = (133.42 * voltage * voltage * voltage - 255.86 * voltage * voltage + 857.39 * voltage) * 0.5;
  return tds;
}

float readSoilMoisture() {
  int rawValue = analogRead(SOIL_PIN);
  float moisture = map(rawValue, 0, 4095, 0, 100);
  return moisture;
}

float readPressure() {
  int rawValue = analogRead(PRESSURE_PIN);
  float voltage = rawValue * (3.3 / 4095.0);
  float pressure = (voltage - 0.5) * 2.5; // 0.5-4.5V = 0-10 bar
  return pressure;
}

void sendSensorData(String sensor, float value) {
  if (WiFi.status() == WL_CONNECTED) {
    HTTPClient http;
    http.begin(serverUrl);
    http.addHeader("Content-Type", "application/json");
    
    StaticJsonDocument<200> doc;
    doc["sensor"] = sensor;
    doc["value"] = value;
    
    String jsonString;
    serializeJson(doc, jsonString);
    
    int httpResponseCode = http.POST(jsonString);
    
    if (httpResponseCode > 0) {
      Serial.printf("✓ Sent %s: %.2f\n", sensor.c_str(), value);
    } else {
      Serial.printf("✗ Error sending %s\n", sensor.c_str());
    }
    
    http.end();
  }
}

void autoControlSprinklers(float soilMoisture) {
  const float THRESHOLD = 30.0;
  
  if (soilMoisture < THRESHOLD) {
    // Activate sprinklers
    for (int i = 0; i < 6; i++) {
      digitalWrite(sprinklerPins[i], HIGH);
    }
    Serial.println("🌱 Sprinklers activated - Low soil moisture");
  } else if (soilMoisture > THRESHOLD + 10) {
    // Deactivate sprinklers
    for (int i = 0; i < 6; i++) {
      digitalWrite(sprinklerPins[i], LOW);
    }
    Serial.println("✓ Sprinklers deactivated - Optimal moisture reached");
  }
}

void triggerBuzzer(int duration) {
  digitalWrite(BUZZER_PIN, HIGH);
  delay(duration);
  digitalWrite(BUZZER_PIN, LOW);
}
```

## Arduino Code Example

```cpp
#include <ArduinoJson.h>

// Sensor pins
#define PH_PIN A0
#define TDS_PIN A1
#define FLOW_PIN 2
#define BUZZER_PIN 9
#define PUMP_PIN 10

// Sprinkler pins
int sprinklerPins[] = {3, 4, 5, 6, 7, 8};

// Flow sensor
volatile int flowPulseCount = 0;

void flowPulseCounter() {
  flowPulseCount++;
}

void setup() {
  Serial.begin(9600);
  
  pinMode(FLOW_PIN, INPUT_PULLUP);
  pinMode(BUZZER_PIN, OUTPUT);
  pinMode(PUMP_PIN, OUTPUT);
  
  for (int i = 0; i < 6; i++) {
    pinMode(sprinklerPins[i], OUTPUT);
  }
  
  attachInterrupt(digitalPinToInterrupt(FLOW_PIN), flowPulseCounter, FALLING);
}

void loop() {
  // Read sensors
  float ph = readPH();
  float tds = readTDS();
  
  // Send to ESP32 via Serial
  StaticJsonDocument<200> doc;
  doc["ph"] = ph;
  doc["tds"] = tds;
  doc["flowPulses"] = flowPulseCount;
  
  serializeJson(doc, Serial);
  Serial.println();
  
  // Check for commands from ESP32
  if (Serial.available()) {
    String command = Serial.readStringUntil('\n');
    processCommand(command);
  }
  
  delay(5000);
}

float readPH() {
  int rawValue = analogRead(PH_PIN);
  float voltage = rawValue * (5.0 / 1023.0);
  float ph = 7.0 + ((2.5 - voltage) / 0.18);
  return ph;
}

float readTDS() {
  int rawValue = analogRead(TDS_PIN);
  float voltage = rawValue * (5.0 / 1023.0);
  float tds = (133.42 * voltage * voltage * voltage - 255.86 * voltage * voltage + 857.39 * voltage) * 0.5;
  return tds;
}

void processCommand(String command) {
  StaticJsonDocument<200> doc;
  deserializeJson(doc, command);
  
  String action = doc["action"];
  int zone = doc["zone"];
  
  if (action == "sprinkler_on") {
    digitalWrite(sprinklerPins[zone], HIGH);
  } else if (action == "sprinkler_off") {
    digitalWrite(sprinklerPins[zone], LOW);
  } else if (action == "pump_on") {
    digitalWrite(PUMP_PIN, HIGH);
  } else if (action == "pump_off") {
    digitalWrite(PUMP_PIN, LOW);
  } else if (action == "buzzer") {
    digitalWrite(BUZZER_PIN, HIGH);
    delay(1000);
    digitalWrite(BUZZER_PIN, LOW);
  }
}
```

## Smart Irrigation Logic

The system automatically controls sprinklers based on soil moisture:

1. **Continuous Monitoring**: Soil moisture sensors read every 5 seconds
2. **Threshold Check**: If moisture < 30%, activate sprinklers
3. **Auto Watering**: Sprinklers run until moisture reaches 40%
4. **Auto Stop**: System automatically stops when optimal moisture reached
5. **Water Savings**: Only waters when needed, saving significant water

## API Integration

### Enable Hardware Mode
In `backend/.env`:
```
HARDWARE_ENABLED=true
```

### Send Sensor Data
```bash
POST http://localhost:3000/api/hardware/data
Content-Type: application/json

{
  "sensor": "ph_sensor_01",
  "value": 7.2
}
```

### Control Actuators
```bash
# Control pump
POST http://localhost:3000/api/control/pump/P-001
{
  "action": "on"
}

# Control sprinkler
POST http://localhost:3000/api/control/sprinkler/Z-001
{
  "action": "on",
  "duration": 15
}

# Control buzzer
POST http://localhost:3000/api/control/buzzer
{
  "action": "on"
}
```

## Troubleshooting

### WiFi Connection Issues
- Check SSID and password
- Ensure ESP32 is in range
- Verify router allows new connections

### Sensor Reading Errors
- Check wiring connections
- Verify sensor power supply (3.3V or 5V)
- Calibrate sensors before use

### Actuator Not Responding
- Check relay module power
- Verify GPIO pin assignments
- Test relay with multimeter

## Safety Considerations

1. **Electrical Safety**: Use proper insulation and waterproofing
2. **Water Protection**: Keep electronics in waterproof enclosures
3. **Relay Ratings**: Ensure relays can handle pump/valve current
4. **Fuse Protection**: Add fuses to high-current circuits
5. **Emergency Stop**: Implement manual override switches

## Next Steps

1. Assemble hardware according to wiring diagram
2. Upload code to ESP32 and Arduino
3. Configure WiFi credentials
4. Test each sensor individually
5. Calibrate sensors with known values
6. Test actuators with manual commands
7. Enable auto-control mode
8. Monitor dashboard for real-time data

## Support

For hardware issues, check:
- Component datasheets
- ESP32/Arduino documentation
- AquaSync GitHub issues
