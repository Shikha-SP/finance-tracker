const express = require('express');
const router = express.Router();

const PYTHON_AI_URL = process.env.PYTHON_AI_URL || 'http://127.0.0.1:8000';
const PREFER_LOCAL_AI = process.env.PREFER_LOCAL_AI !== 'false';

const engineService = require('../ai/engineService');
const dataLoader = require('../ai/dataLoader');
const { runStrategyBacktest } = require('../ai/backtester');
const { computeScreenerValidation } = require('../ai/validationService');

function fetchPythonAPI(path, method = 'GET', body = null) {
  const url = new URL(path, PYTHON_AI_URL).toString();
  return fetch(url, {
    method,
    headers: { 'Content-Type': 'application/json' },
    body: body ? JSON.stringify(body) : undefined,
    signal: AbortSignal.timeout(55000)
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

// ── Local JS AI engine (migrated from Python) ─────────────────────────────

router.get('/analyze/:symbol', async (req, res) => {
  const symbol = req.params.symbol.toUpperCase();
  try {
    if (PREFER_LOCAL_AI) {
      const data = engineService.buildAnalysis(symbol);
      if (data && data.error) {
        return res.status(404).json(data);
      }
      return res.json(data);
    }
    const data = await fetchPythonAPI(`/api/v1/ai/analyze/${symbol}`);
    if (!data || !data.technicalIndicators) throw new Error("Invalid structure");
    res.json(data);
  } catch (err) {
    console.log(`[Express AI Proxy] AI engine offline for ${symbol}, falling back to local JS engine`);
    const local = engineService.buildAnalysis(symbol);
    if (local && !local.error) return res.json(local);
    res.status(503).json(getOfflineResponse(symbol, 'analysis'));
  }
});

router.get('/market-regime', async (req, res) => {
  try {
    if (PREFER_LOCAL_AI) {
      const data = engineService.buildMarketRegime();
      if (data && data.error) return res.status(500).json(data);
      return res.json(data);
    }
    const data = await fetchPythonAPI('/api/v1/market-regime');
    res.json(data);
  } catch (err) {
    const local = engineService.buildMarketRegime();
    if (local && !local.error) return res.json(local);
    res.status(503).json({
      error: true,
      offline: true,
      message: 'Market regime is offline. Start the Python AI service on port 8000.',
    });
  }
});

router.get('/screener', async (req, res) => {
  try {
    if (PREFER_LOCAL_AI) {
      const data = engineService.buildScreener(req.query);
      return res.json(data);
    }
    const queryStr = new URLSearchParams(req.query).toString();
    const data = await fetchPythonAPI(`/api/v1/screener?${queryStr}`);
    res.json(data);
  } catch (err) {
    const local = engineService.buildScreener(req.query);
    if (local && local.screenerResults) return res.json(local);
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
    const { symbol, initialCapital = 100000, minConfidence = 60 } = req.body || {};
    const clean = String(symbol || '').toUpperCase().trim();
    const hist = dataLoader.loadPriceHistory();

    let frame = clean ? hist[clean] : null;
    if (!frame || frame.length < 20) {
      const candidates = Object.keys(hist)
        .filter(s => s !== 'INDEX_NEPSE')
        .map(s => ({ sym: s, len: hist[s].length }))
        .sort((a, b) => b.len - a.len);
      frame = candidates.length ? hist[candidates[0].sym] : [];
    }

    const result = runStrategyBacktest(
      frame,
      Number(initialCapital) || 100000,
      Number(minConfidence) || 60
    );
    res.json(result);
  } catch (err) {
    res.status(500).json({
      error: true,
      message: err.message,
      summary: null,
      equityCurve: [],
    });
  }
});

router.post('/rag/query', async (req, res) => {
  try {
    if (PREFER_LOCAL_AI) {
      const data = await require('../ai/ragProcessor').queryFinancialDocument(req.body.query, req.body);
      return res.json(data);
    }
    const data = await fetchPythonAPI('/api/v1/rag/query', 'POST', req.body);
    res.json(data);
  } catch (err) {
    const local = await require('../ai/ragProcessor').queryFinancialDocument(req.body.query, req.body);
    if (local && local.answer) return res.json(local);
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
    const refresh = req.query.refresh === '1' || req.query.refresh === 'true';
    const data = computeScreenerValidation({ refresh });
    res.json(data);
  } catch (err) {
    res.status(500).json({
      error: true,
      status: 'error',
      message: err.message,
      horizons: [],
      conclusion: '',
    });
  }
});

module.exports = router;
