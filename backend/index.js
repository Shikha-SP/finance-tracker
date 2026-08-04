const dns = require('node:dns');
dns.setServers(['1.1.1.1', '1.0.0.1']);

const express = require('express');
const mongoose = require('mongoose');
const cors = require('cors');
const path = require('path');
const fs = require('fs');
const cookieParser = require('cookie-parser');
require('dotenv').config();

const app = express();
const frontendDist = path.resolve(__dirname, '../frontend/dist');

app.use(cors());
app.use(cookieParser());
app.use(express.json());

if (fs.existsSync(frontendDist)) {
  app.use(express.static(frontendDist));
}

const transactionRoutes = require('./src/routes/transactionRoutes');
const budgetRoutes      = require('./src/routes/budgetRoutes');
const authRoutes        = require('./src/routes/authRoutes');
const userRoutes        = require('./src/routes/userRoutes');
const nepseRoutes       = require('./src/routes/nepseRoutes');
const portfolioRoutes   = require('./src/routes/portfolioRoutes');
const aiRoutes          = require('./src/routes/aiRoutes');

app.use('/api/transactions', transactionRoutes);
app.use('/api/budgets',      budgetRoutes);
app.use('/api/auth',         authRoutes);
app.use('/api/users',        userRoutes);
app.use('/api/nepse',        nepseRoutes);
app.use('/api/portfolio',    portfolioRoutes);
app.use('/api/ai',           aiRoutes);

app.get('/', (req, res) => {
  res.send('FinanceTracker API is running!');
});

if (fs.existsSync(frontendDist)) {
  app.get(/^(?!\/api).+/, (req, res) => {
    res.sendFile(path.join(frontendDist, 'index.html'));
  });
}

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
const PRIMARY_MONGO_URI = process.env.MONGO_URI || process.env.MONGO_URI_ATLAS;
const LOCAL_MONGO_URI = 'mongodb://127.0.0.1:27017/summerproject';
const ALLOW_MEMORY_FALLBACK = process.env.ALLOW_MEMORY_FALLBACK === 'true';

async function connectDatabase() {
  const candidates = [PRIMARY_MONGO_URI, LOCAL_MONGO_URI].filter(Boolean);
  let lastError = null;

  for (const candidate of candidates) {
    try {
      await mongoose.connect(candidate, { serverSelectionTimeoutMS: 4000 });
      console.log(`MongoDB connected (${candidate})`);
      return;
    } catch (err) {
      console.error(`MongoDB connection failed for ${candidate}: ${err.message}`);
      lastError = err;
    }
  }

  if (!ALLOW_MEMORY_FALLBACK || process.env.NODE_ENV === 'production') {
    const message = lastError
      ? `Persistent MongoDB is not reachable. ${lastError.message}. No in-memory fallback will be used.`
      : 'No MongoDB URI is configured. Set MONGO_URI or MONGO_URI_ATLAS to a reachable Atlas/hosted instance.';

    console.error(message);
    throw new Error(message);
  }

  console.warn('ALLOW_MEMORY_FALLBACK=true. Using in-memory database for development only.');
  const { MongoMemoryServer } = require('mongodb-memory-server');
  const memoryServer = await MongoMemoryServer.create();
  const memoryUri = memoryServer.getUri('summerproject');

  await mongoose.connect(memoryUri);
  global.__MONGO_MEMORY_SERVER__ = memoryServer;
  console.log('In-memory MongoDB ready (data resets when server stops).');
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
