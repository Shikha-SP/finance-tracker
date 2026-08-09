const express = require('express');
const router = express.Router();

const PYTHON_AI_URL = process.env.PYTHON_AI_URL || 'http://127.0.0.1:8000';

function fetchPythonAPI(path, method = 'GET', body = null) {
  const url = new URL(path, PYTHON_AI_URL).toString();
  return fetch(url, {
    method,
    headers: { 'Content-Type': 'application/json' },
    body: body ? JSON.stringify(body) : undefined,
    signal: AbortSignal.timeout(25000)
  }).then(async (res) => {
    const data = await res.json().catch(() => ({}));
    if (!res.ok || data.detail || data.error) {
      throw new Error(data.detail || data.error || `HTTP ${res.status}`);
    }
    return data;
  });
}

// Returns honest error when Python AI engine is unavailable
function getOfflineResponse(symbol, endpoint) {
  return {
    error: true,
    offline: true,
    message: `AI engine is offline. Start the Python AI service to get real ${endpoint} for ${symbol.toUpperCase()}.`,
    symbol: symbol.toUpperCase()
  };
}

router.get('/analyze/:symbol', async (req, res) => {
  try {
    const data = await fetchPythonAPI(`/api/v1/ai/analyze/${req.params.symbol}`);
    if (!data || !data.technicalIndicators) throw new Error("Invalid structure");
    res.json(data);
  } catch (err) {
    console.log(`[Express AI Proxy] AI engine offline for ${req.params.symbol}`);
    res.status(503).json(getOfflineResponse(req.params.symbol, 'analysis'));
  }
});

router.get('/market-regime', async (req, res) => {
  try {
    const data = await fetchPythonAPI('/api/v1/market-regime');
    res.json(data);
  } catch (err) {
    res.status(503).json({
      error: true,
      offline: true,
      message: 'Market regime is offline. Start the Python AI service on port 8000.',
    });
  }
});

router.get('/screener', async (req, res) => {
  try {
    const queryStr = new URLSearchParams(req.query).toString();
    const data = await fetchPythonAPI(`/api/v1/screener?${queryStr}`);
    res.json(data);
  } catch (err) {
    res.status(503).json({
      error: true,
      offline: true,
      message: 'AI screener is offline. Start the Python AI service to get real stock screening data.',
      screenerResults: []
    });
  }
});

router.post('/backtest', async (req, res) => {
  try {
    const data = await fetchPythonAPI('/api/v1/backtest', 'POST', req.body);
    res.json(data);
  } catch (err) {
    res.status(503).json({
      error: true,
      offline: true,
      message: 'AI backtesting engine is offline. Start the Python AI service to run real backtests.',
      summary: null,
      equityCurve: []
    });
  }
});

router.post('/rag/query', async (req, res) => {
  try {
    const data = await fetchPythonAPI('/api/v1/rag/query', 'POST', req.body);
    res.json(data);
  } catch (err) {
    res.status(503).json({
      error: true,
      offline: true,
      message: 'RAG assistant is offline. Start the Python AI service and ensure Groq API key is configured.',
      answer: 'The AI assistant is currently unavailable. Please ensure the Python AI service is running on port 8000.',
      recommendations: [],
      citations: [],
      symbol: null,
      query: req.body.query
    });
  }
});

router.get('/validation', async (req, res) => {
  try {
    const queryStr = req.query.refresh ? '?refresh=1' : '';
    const data = await fetchPythonAPI(`/api/v1/ai/validation${queryStr}`);
    res.json(data);
  } catch (err) {
    res.status(503).json({
      error: true,
      offline: true,
      status: 'error',
      message: 'Trust check is offline. Start the Python AI service on port 8000 to see the honest scorecard.',
      horizons: [],
      conclusion: ''
    });
  }
});

module.exports = router;
