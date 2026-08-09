const express = require('express');
const router = express.Router();
const nepseFetcher = require('../utils/nepseFetcher');

// --- routes --------------------------------------------------------------------

router.get('/summary', async (req, res) => {
  const data = await nepseFetcher.getLiveNepseData();
  res.json(data.summary);
});

router.get('/indices', async (req, res) => {
  const data = await nepseFetcher.getLiveNepseData();
  // Only the main NEPSE index has real history kept current; the sub-indices
  // (Sensitive/Float/Sensitive Float) have no reliable live daily source, so
  // they are removed rather than shown with stale chart data.
  const mainIndex = data.indices.find(i => i.name === 'NEPSE Index');
  res.json({
    simulatedData: data.summary.simulatedData,
    indices: mainIndex ? [mainIndex] : (data.indices.length ? data.indices.slice(0, 1) : [])
  });
});

router.get('/top-gainers', async (req, res) => {
  const data = await nepseFetcher.getLiveNepseData();
  res.json({ simulatedData: data.summary.simulatedData, gainers: data.gainers });
});

router.get('/top-losers', async (req, res) => {
  const data = await nepseFetcher.getLiveNepseData();
  res.json({ simulatedData: data.summary.simulatedData, losers: data.losers });
});

router.get('/top-turnover', async (req, res) => {
  const data = await nepseFetcher.getLiveNepseData();
  res.json({ simulatedData: data.summary.simulatedData, turnover: data.turnover });
});

router.get('/live-market', async (req, res) => {
  const data = await nepseFetcher.getLiveNepseData();
  res.json({
    simulatedData: data.summary.simulatedData,
    cachedData: data.summary.cachedData || false,
    cachedAt: data.summary.cachedAt || null,
    liveMarket: data.liveMarket
  });
});

router.get('/sub-indices', async (req, res) => {
  const data = await nepseFetcher.getLiveNepseData();
  res.json({ simulatedData: data.summary.simulatedData, subIndices: data.subIndices });
});

router.get('/graph/:indexName', async (req, res) => {
  const result = await nepseFetcher.getIndexGraph(req.params.indexName);
  if (result.error) {
    return res.status(500).json({ error: result.error });
  }
  res.json(result);
});

const { fetchCompanyHistory, fetchIndexHistory } = require('../utils/historyFetcher');

// Main NEPSE indices have real daily history (from Bibek773/nepse_historical_data).
const mainIndexMap = {
  'NEPSE INDEX': 'NEPSE',
  'NEPSE': 'NEPSE',
  'SENSITIVE FLOAT INDEX': 'SENFLOAT',
  'SENSITIVE FLOAT': 'SENFLOAT',
  'SENFLOAT': 'SENFLOAT',
  'SENSITIVE INDEX': 'SENSITIVE',
  'SENSITIVE': 'SENSITIVE',
  'FLOAT INDEX': 'FLOAT',
  'FLOAT': 'FLOAT'
};

router.get('/history/:symbol', async (req, res) => {
  try {
    let symbol = req.params.symbol.toUpperCase().trim();
    const { from, to } = req.query;

    const fromSec = from ? parseInt(from, 10) : null;
    const toSec = to ? parseInt(to, 10) : null;

    // Index to major representative stock mapping for sector charts fallback
    const indexStockMap = {
      'BANKING': 'NABIL',
      'DEV. BANK': 'GBIME',
      'DEVELOPMENT BANK': 'GBIME',
      'FINANCE': 'ICFC',
      'HOTELS & TOURISM': 'OHL',
      'HOTELS': 'OHL',
      'HYDROPOWER': 'CHCL',
      'HYDRO': 'CHCL',
      'LIFE INSURANCE': 'NLIC',
      'LIFEINS': 'NLIC',
      'NON LIFE INSURANCE': 'NLG',
      'NONLIFEINS': 'NLG',
      'MANUFACTURING': 'SHIVM',
      'MANUFACTURE': 'SHIVM',
      'MICROFINANCE': 'CBBL',
      'TRADING': 'STC',
      'OTHERS': 'NTC',
      'INVESTMENT': 'NTC',
      'MUTUAL FUND': 'NTC',
      'COMMERCIAL BANKS': 'NABIL',
      'DEVELOPMENT BANKS': 'GBIME',
      'HYDRO POWER': 'CHCL',
      'HOTELS AND TOURISM': 'OHL',
      'NON LIFE INSURANCE': 'NLG'
    };

    let records = null;

    // Main indices → real NEPSE index history (never a stock proxy).
    const indexKey = mainIndexMap[symbol];
    if (indexKey) {
      records = await fetchIndexHistory(indexKey, fromSec, toSec);
      console.log(`[NEPSE History] Serving real index history for "${symbol}" (${records.length} records)`);
    } else {
      records = await fetchCompanyHistory(symbol, fromSec, toSec);
      // If requested symbol was a sub-index with no direct CSV, use representative stock
      if ((!records || records.length === 0) && indexStockMap[symbol]) {
        const targetSymbol = indexStockMap[symbol];
        console.log(`[NEPSE History] Mapping sub-index "${symbol}" to stock "${targetSymbol}"`);
        records = await fetchCompanyHistory(targetSymbol, fromSec, toSec);
      }
    }

    res.json(records || []);
  } catch (err) {
    console.error('[NEPSE History Fetcher] Error:', err.message);
    res.status(500).json({ error: 'Failed to fetch history data' });
  }
});

// Market History Performance Endpoint (1W, 1M, 3M, 1Y, 3Y, 5Y)
router.get('/market-history', async (req, res) => {
  try {
    const period = (req.query.period || '1M').toUpperCase();
    const periodDaysMap = {
      '1W': 7,
      '1M': 30,
      '3M': 90,
      '1Y': 365,
      '3Y': 1095,
      '5Y': 1825
    };
    const days = periodDaysMap[period] || 30;
    const nowSec = Math.floor(Date.now() / 1000);
    const startSec = nowSec - days * 24 * 3600;

    const MARKET_SYMBOLS = [
      'NABIL', 'NTC', 'SHIVM', 'GBIME', 'HDL', 'CHCL', 'STC', 'NLIC', 'NLG', 'OHL',
      'CIT', 'PCBL', 'SANIMA', 'EBL', 'SCB', 'UPPER', 'RADHI', 'AKPL', 'CBBL', 'ICFC',
      'KSBBL', 'NMB', 'UNL', 'BBC', 'HRL', 'CFCL', 'SHL', 'CGH', 'NRIC', 'HDHPC'
    ];

    const performances = [];
    for (const sym of MARKET_SYMBOLS) {
      const history = await fetchCompanyHistory(sym);
      if (!history || history.length < 2) continue;

      const current = history[history.length - 1];
      const pastItems = history.filter(h => h.timestamp <= startSec);
      const past = pastItems.length > 0 ? pastItems[pastItems.length - 1] : history[0];

      const startPrice = past.close;
      const currentPrice = current.close;
      const change = currentPrice - startPrice;
      const pctChange = (change / startPrice) * 100;

      const windowItems = history.filter(h => h.timestamp >= startSec);
      let high = 0;
      let low = Infinity;
      let totalVol = 0;
      let totalTurnover = 0;

      windowItems.forEach(item => {
        if (item.high > high) high = item.high;
        if (item.low < low) low = item.low;
        totalVol += item.volume;
        totalTurnover += item.turnover;
      });

      performances.push({
        symbol: sym,
        startPrice,
        currentPrice,
        change,
        pctChange,
        high: high || currentPrice,
        low: low === Infinity ? currentPrice : low,
        avgVolume: Math.round(totalVol / (windowItems.length || 1)),
        totalTurnover,
        startDate: past.time,
        currentDate: current.time
      });
    }

    performances.sort((a, b) => b.pctChange - a.pctChange);

    const gainers = performances.slice(0, 5);
    const decliners = [...performances].sort((a, b) => a.pctChange - b.pctChange).slice(0, 5);

    res.json({
      period,
      days,
      count: performances.length,
      gainers,
      decliners,
      data: performances
    });
  } catch (err) {
    console.error('[Market History API] Error:', err.message);
    res.status(500).json({ error: 'Failed to compute market performance' });
  }
});

module.exports = router;
