const express = require('express');
const router = express.Router();
const http = require('http');

const PYTHON_AI_URL = 'http://127.0.0.1:8000';

function fetchPythonAPI(path, method = 'GET', body = null) {
  return new Promise((resolve, reject) => {
    const url = new URL(path, PYTHON_AI_URL);
    const options = {
      method,
      headers: {
        'Content-Type': 'application/json'
      }
    };

    const req = http.request(url, options, (res) => {
      let data = '';
      res.on('data', chunk => data += chunk);
      res.on('end', () => {
        try {
          const parsed = JSON.parse(data);
          if (res.statusCode >= 400 || parsed.detail || parsed.error) {
            reject(new Error(parsed.detail || parsed.error || `HTTP ${res.statusCode}`));
          } else {
            resolve(parsed);
          }
        } catch (e) {
          reject(e);
        }
      });
    });

    req.on('error', (err) => {
      console.warn('[Express AI Proxy Warning] Could not connect to Python AI engine:', err.message);
      reject(err);
    });

    if (body) {
      req.write(JSON.stringify(body));
    }
    req.end();
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
      symbol: (req.body.symbol || 'NABIL').toUpperCase(),
      query: req.body.query
    });
  }
});

module.exports = router;
