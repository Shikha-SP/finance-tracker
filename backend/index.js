const express = require('express');
const mongoose = require('mongoose');
const cors = require('cors');
require('dotenv').config();

const app = express();

// Middleware
app.use(cors());
app.use(express.json());

// Routes
const transactionRoutes = require('./src/routes/transactionRoutes');
const budgetRoutes      = require('./src/routes/budgetRoutes');
const authRoutes        = require('./src/routes/authRoutes');

app.use('/api/transactions', transactionRoutes);
app.use('/api/budgets',      budgetRoutes);
app.use('/api/auth',         authRoutes);

app.get('/', (req, res) => {
  res.send('FinanceTracker API is running!');
});

// Database Connection
const PORT     = process.env.PORT     || 5000;
const MONGO_URI = process.env.MONGO_URI || 'mongodb://localhost:27017/summerproject';

mongoose
  .connect(MONGO_URI)
  .then(() => {
    console.log('✅ MongoDB connected successfully');
    app.listen(PORT, () => {
      console.log(`🚀 Server is running on port ${PORT}`);
    });
  })
  .catch((err) => {
    console.error('❌ MongoDB connection error:', err);
  });
