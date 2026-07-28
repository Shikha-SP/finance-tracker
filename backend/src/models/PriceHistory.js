const mongoose = require('mongoose');

const priceHistorySchema = new mongoose.Schema({
  symbol: { type: String, required: true, uppercase: true, index: true },
  date: { type: String, required: true }, // Format YYYY-MM-DD
  timestamp: { type: Number, required: true, index: true }, // Unix timestamp in seconds
  open: { type: Number, required: true },
  high: { type: Number, required: true },
  low: { type: Number, required: true },
  close: { type: Number, required: true },
  volume: { type: Number, default: 0 },
  turnover: { type: Number, default: 0 }
}, { timestamps: true });

priceHistorySchema.index({ symbol: 1, date: 1 }, { unique: true });

module.exports = mongoose.model('PriceHistory', priceHistorySchema);
