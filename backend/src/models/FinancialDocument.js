const mongoose = require('mongoose');

const chunkSchema = new mongoose.Schema({
  chunkIndex: Number,
  text: String,
  pageNumber: Number,
  vector: [Number] // Embedded representation
});

const financialDocumentSchema = new mongoose.Schema({
  symbol: { type: String, required: true, uppercase: true, index: true },
  title: { type: String, required: true },
  fileName: { type: String, required: true },
  fileType: { type: String, default: 'PDF' },
  uploadDate: { type: Date, default: Date.now },
  chunks: [chunkSchema]
}, { timestamps: true });

module.exports = mongoose.model('FinancialDocument', financialDocumentSchema);
