const mongoose = require('mongoose');

const aiPredictionSchema = new mongoose.Schema({
  symbol: { type: String, required: true, uppercase: true, index: true },
  targetDate: { type: String, required: true },
  bullishProb: { type: Number, required: true }, // e.g. 72 (%)
  neutralProb: { type: Number, required: true }, // e.g. 18 (%)
  bearishProb: { type: Number, required: true }, // e.g. 10 (%)
  signal: { type: String, enum: ['BULLISH', 'NEUTRAL', 'BEARISH'], required: true },
  confidenceScore: { type: Number, required: true },
  positiveReasons: [{ type: String }],
  negativeReasons: [{ type: String }],
  technicalSummary: {
    rsi: Number,
    macdStatus: String,
    smaTrend: String,
    volatility: String
  },
  calculatedAt: { type: Date, default: Date.now }
}, { timestamps: true });

module.exports = mongoose.model('AIPrediction', aiPredictionSchema);
