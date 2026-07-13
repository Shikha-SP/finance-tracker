const mongoose = require('mongoose');

const budgetSchema = new mongoose.Schema({
  category: {
    type: String,
    required: true,
    unique: true
  },
  limit: {
    type: Number,
    required: true
  }
}, { timestamps: true });

module.exports = mongoose.model('Budget', budgetSchema);
