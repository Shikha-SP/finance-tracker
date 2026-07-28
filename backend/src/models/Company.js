const mongoose = require('mongoose');

const companySchema = new mongoose.Schema({
  symbol: { type: String, required: true, unique: true, uppercase: true, trim: true },
  name: { type: String, required: true },
  sector: { type: String, required: true },
  marketCap: { type: Number, default: 0 },
  peRatio: { type: Number, default: 0 },
  pbRatio: { type: Number, default: 0 },
  eps: { type: Number, default: 0 },
  dividendYield: { type: Number, default: 0 },
  roe: { type: Number, default: 0 },
  bookValue: { type: Number, default: 0 },
  paidUpCapital: { type: Number, default: 0 },
  lastUpdated: { type: Date, default: Date.now }
}, { timestamps: true });

module.exports = mongoose.model('Company', companySchema);
