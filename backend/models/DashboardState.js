const mongoose = require('mongoose');

const DashboardStateSchema = new mongoose.Schema({
  // Keep a single upserted document for current dashboard state.
  recordType: {
    type: String,
    default: 'current',
    unique: true,
    index: true
  },
  waterQuality: {
    wqi: Number,
    ph: Number,
    turbidity: Number,
    tds: Number,
    chlorine: Number,
    temperature: Number,
    flowRate: Number
  },
  waterPotability: {
    updatedAt: String,
    inputReadings: {
      ph: Number,
      turbidity: Number,
      tds: Number,
      chlorine: Number,
      temperature: Number,
      wqi: Number
    },
    ranges: [{
      key: String,
      label: String,
      value: Number,
      safeMin: Number,
      safeMax: Number,
      unit: String,
      status: String,
      severity: String
    }],
    fuzzy: {
      method: String,
      score: Number,
      label: String,
      confidence: Number,
      outputMemberships: {
        unsafe: Number,
        caution: Number,
        safe: Number
      },
      rulesFired: [{
        id: String,
        rule: String,
        output: String,
        strength: Number
      }]
    },
    ml: {
      trained: Boolean,
      modelType: String,
      probability: Number,
      score: Number,
      label: String,
      accuracy: Number,
      trainedAt: String,
      samples: Number,
      trees: Number,
      maxDepth: Number,
      minLeaf: Number,
      sampleRate: Number,
      maxFeatures: Number,
      lastLoss: Number,
      oobEstimate: Number,
      trainSource: String,
      csvPath: String,
      featureImportances: {
        ph: Number,
        turbidity: Number,
        tds: Number,
        chlorine: Number,
        temperature: Number,
        wqi: Number
      }
    },
    hybrid: {
      score: Number,
      label: String,
      recommendedUse: String,
      binaryClass: Number
    },
    diseaseRisk: {
      overall: String,
      conditions: [{
        name: String,
        likelihood: String,
        trigger: String,
        diseases: [String]
      }],
      recommendations: [String]
    },
    modelMeta: {
      version: String,
      features: [String]
    }
  },
  demand: {
    current: Number,
    peak: Number,
    peakTime: String,
    trend: String,
    totalToday: Number,
    savings: Number
  },
  leaks: [{
    id: String,
    zone: String,
    node: String,
    severity: String,
    flow: Number,
    confidence: Number,
    time: String,
    buzzerActive: Boolean
  }],
  pumps: [{
    id: String,
    name: String,
    status: String,
    efficiency: Number,
    flow: Number,
    power: Number,
    runtime: String
  }],
  stp: {
    efficiency: Number,
    inflow: Number,
    outflow: Number,
    bod: Number,
    cod: Number
  },
  irrigation: {
    mode: String,
    zones: [{
      id: String,
      name: String,
      soilMoisture: Number,
      threshold: Number,
      sprinklerStatus: String,
      waterUsed: Number,
      duration: Number,
      lastWatered: String,
      manualOverride: Boolean,
      flowRate: Number,
      area: Number
    }],
    totalWaterSaved: Number,
    activeZones: Number,
    scheduledZones: Number,
    totalArea: Number,
    avgMoisture: Number
  },
  hardware: {
    esp32: { status: String, uptime: String, signalStrength: Number, lastPing: String },
    arduino: { status: String, uptime: String, sensors: Number, lastPing: String },
    sensors: {
      flowSensor: { status: String, reading: Number, unit: String, accuracy: Number },
      phSensor: { status: String, reading: Number, unit: String, accuracy: Number },
      tdsSensor: { status: String, reading: Number, unit: String, accuracy: Number },
      soilMoisture: { status: String, reading: Number, unit: String, accuracy: Number },
      pressureSensor: { status: String, reading: Number, unit: String, accuracy: Number }
    },
    actuators: {
      mainPump: { status: String, power: Number, cycles: Number },
      sprinklers: { active: Number, total: Number, waterFlow: Number },
      buzzer: { status: String, alerts: Number, lastTriggered: String },
      valves: { open: Number, closed: Number, total: Number }
    }
  },
  analytics: {
    waterSavings: {
      today: Number,
      week: Number,
      month: Number,
      percentage: Number
    },
    leakPrevention: {
      detected: Number,
      prevented: Number,
      savedLiters: Number
    },
    efficiency: {
      distribution: Number,
      irrigation: Number,
      overall: Number
    },
    predictions: {
      nextLeakRisk: String,
      maintenanceDue: String,
      peakDemandTime: String,
      recommendedAction: String
    }
  },
  demandForecast: {
    today: { value: Number, peak: Number, peakTime: String },
    forecast7Day: { value: Number, confidence: Number },
    shortageRisk: { day: String, reason: String },
    modelAccuracy: Number,
    historicalData: [{ date: String, value: Number }],
    dailyForecast: [{ day: String, value: Number, status: String }],
    sectorBreakdown: [{ sector: String, today: Number, forecast: Number }],
    recommendations: [{ type: { type: String }, title: String, desc: String }]
  },
  zoneQuality: {
    zones: [{ id: String, wqi: Number, status: String }],
    alerts: [{ severity: String, title: String, time: String, desc: String }]
  },
  pipelineIntegrity: {
    segments: [{ id: String, score: Number, status: String }],
    monitored: Number
  },
  aiInsights: [{ icon: String, title: String, desc: String }],
  thresholds: {
    waterQuality: [{ parameter: String, min: Number, max: Number, unit: String }]
  },
  alerts: [{ id: String, type: { type: String }, title: String, message: String, time: String, buzzer: Boolean }],
  network: {
    nodes: [{ id: String, x: Number, y: Number, status: String, pressure: Number, flow: Number }]
  },
  integrations: {
    thingspeak: {
      enabled: Boolean,
      live: Boolean,
      channelId: String,
      mappedFields: [String],
      rawFields: {
        field1: String,
        field2: String
      },
      lastSync: String,
      lastFeedAt: String,
      lastEntryId: Number,
      lastError: String,
      source: String
    }
  },
  updatedAt: { type: Date, default: Date.now }
});

module.exports = mongoose.model('DashboardState', DashboardStateSchema);
