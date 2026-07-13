const mongoose = require('mongoose');

const transactionSchema = new mongoose.Schema({
  amount: {
    type: Number,
    required: true
  },
  description: {
    type: String,
    required: true
  },
  type: {
    type: String,
    enum: ['income', 'expense'],
    required: true
  },
  category: {
    type: String,
    required: true
  },
  note: {
    type: String,
    default: ''
  },
  date: {
    type: String,
    required: true
  },
  monthKey: {
    type: String,
    required: true
  }
}, { timestamps: true });

module.exports = mongoose.model('Transaction', transactionSchema);
