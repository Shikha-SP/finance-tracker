const express = require('express');
const mongoose = require('mongoose');
const cors = require('cors');
require('dotenv').config();

const app = express();

app.use(cors());
app.use(express.json());

const transactionRoutes = require('./src/routes/transactionRoutes');
const budgetRoutes      = require('./src/routes/budgetRoutes');
const authRoutes        = require('./src/routes/authRoutes');

app.use('/api/transactions', transactionRoutes);
app.use('/api/budgets',      budgetRoutes);
app.use('/api/auth',         authRoutes);

app.get('/', (req, res) => {
  res.send('FinanceTracker API is running!');
});

app.get('/api/health', (req, res) => {
  const dbState = mongoose.connection.readyState;
  const dbStatus = ['disconnected', 'connected', 'connecting', 'disconnecting'][dbState] || 'unknown';

  res.json({
    ok: dbState === 1,
    db: dbStatus,
    uptime: process.uptime(),
  });
});

const PORT = process.env.PORT || 5000;
const MONGO_URI = process.env.MONGO_URI || 'mongodb://127.0.0.1:27017/summerproject';

async function connectDatabase() {
  try {
    await mongoose.connect(MONGO_URI, { serverSelectionTimeoutMS: 4000 });
    console.log(`MongoDB connected (${MONGO_URI})`);
    return;
  } catch (err) {
    if (process.env.NODE_ENV === 'production') {
      throw err;
    }

    console.warn('Local MongoDB unavailable — using in-memory database for development.');
    const { MongoMemoryServer } = require('mongodb-memory-server');
    const memoryServer = await MongoMemoryServer.create();
    const memoryUri = memoryServer.getUri('summerproject');

    await mongoose.connect(memoryUri);
    global.__MONGO_MEMORY_SERVER__ = memoryServer;
    console.log('In-memory MongoDB ready (data resets when server stops).');
  }
}

async function startServer() {
  try {
    await connectDatabase();

    app.listen(PORT, () => {
      console.log(`Server running on http://localhost:${PORT}`);
    });
  } catch (err) {
    console.error('Failed to start server:', err.message);
    process.exit(1);
  }
}

startServer();
