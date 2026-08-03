const express = require('express');
const router = express.Router();
const { execFile } = require('child_process');
const path = require('path');
const fs = require('fs');

// --- Persistent LTP disk cache -----------------------------------------------
// Saves real LTP data whenever the market is open, so we can show it later
// instead of fake simulated prices when the market is closed.
const LTP_CACHE_FILE = path.join(__dirname, '../../data/ltp_cache.json');

function loadLtpCache() {
  try {
    if (fs.existsSync(LTP_CACHE_FILE)) {
      const raw = fs.readFileSync(LTP_CACHE_FILE, 'utf8');
      return JSON.parse(raw); // { liveMarket: [...], savedAt: ISO-string }
    }
  } catch (e) {
    console.warn('[LTP Cache] Failed to load disk cache:', e.message);
  }
  return null;
}

function saveLtpCache(liveMarket) {
  try {
    const dir = path.dirname(LTP_CACHE_FILE);
    if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
    fs.writeFileSync(
      LTP_CACHE_FILE,
      JSON.stringify({ liveMarket, savedAt: new Date().toISOString() }),
      'utf8'
    );
    console.log(`[LTP Cache] Saved ${liveMarket.length} symbols to disk.`);
  } catch (e) {
    console.warn('[LTP Cache] Failed to save disk cache:', e.message);
  }
}

// --- honest empty-state when no data is available -----------------------------------
function getEmptyData() { 
  return { 
    summary: { 
      isOpen: false, 
      dataUnavailable: true,
      simulatedData: false,
      cachedData: false,
      cachedAt: null,
      nepseIndex: null, 
      nepseChange: null, 
      nepseChangePct: null, 
      sensitiveIndex: null, 
      sensitiveChange: null, 
      floatIndex: null, 
      floatChange: null, 
      totalTurnover: null, 
      totalVolume: null, 
      totalTrades: null 
    }, 
    indices: [], 
    gainers: [], 
    losers: [], 
    turnover: [], 
    liveMarket: [], 
    subIndices: [] 
  }; 
}

let cache = null;
let lastFetch = 0;
let fetchPromise = null;

async function getLiveNepseData() {
  const now = Date.now();
  // Cache for 60 seconds
  if (cache && (now - lastFetch < 60000)) return cache;

  if (fetchPromise) return fetchPromise;

  fetchPromise = new Promise((resolve) => {
    const script = path.join(__dirname, '../../nepse_fetcher.py');
    // Fast 8.0 second timeout for Python process execution
    execFile('python', [script], { maxBuffer: 1024 * 1024 * 5, timeout: 15000 }, (err, stdout, stderr) => {
      fetchPromise = null;
      if (err) {
        console.warn('[NEPSE Fetcher] Python process error or timeout:', err.message);
        // On exec error: try in-memory cache, then disk cache, then structured historic fallback
        if (cache) { resolve(cache); return; }
        const diskCache = loadLtpCache();
        if (diskCache && diskCache.liveMarket && diskCache.liveMarket.length > 0) {
          const fallback = getEmptyData();
          fallback.liveMarket = diskCache.liveMarket;
          fallback.summary.simulatedData = false;
          fallback.summary.cachedData = true;
          fallback.summary.cachedAt = diskCache.savedAt;
          resolve(fallback);
        } else {
          resolve(getEmptyData());
        }
        return;
      }
      try {
        const raw = JSON.parse(stdout);
        if (raw.error) throw new Error(raw.error);

        // Transform Python lib's structure to our frontend's expected structure
        const st = raw.status || {};
        const sm = raw.summary || [];
        const idxList = raw.indices || [];

        let nepseIndex = idxList.find(i => i.index === 'NEPSE Index') || idxList[0] || {};
        let sensitiveIndex = idxList.find(i => i.index === 'Sensitive Index') || {};
        let floatIndex = idxList.find(i => i.index === 'Float Index') || {};

        const hasRealLtp = raw.liveMarket && raw.liveMarket.length > 0;

        // If market gave us real LTP data → save it to disk for future use
        if (hasRealLtp) {
          saveLtpCache(raw.liveMarket);
        }

        // Fallback chain: real data → disk cache → historic latest (last resort)
        let liveMarket;
        let cachedData = false;
        let cachedAt = null;
        if (hasRealLtp) {
          liveMarket = raw.liveMarket;
        } else {
          const diskCache = loadLtpCache();
          if (diskCache && diskCache.liveMarket && diskCache.liveMarket.length > 0) {
            liveMarket = diskCache.liveMarket;
            cachedData = true;
            cachedAt = diskCache.savedAt;
            console.log('[NEPSE] Live market empty — using disk cache from', cachedAt);
          } else {
            liveMarket = getEmptyData().liveMarket;
            cachedData = true;
            cachedAt = new Date().toISOString();
          }
        }

        const data = {
          summary: {
            isOpen: st.isOpen === 'OPEN',
            statusText: st.isOpen || 'CLOSED',
            simulatedData: false,
            cachedData,
            cachedAt,
            nepseIndex: nepseIndex.currentValue || null,
            nepseChange: nepseIndex.change ?? null,
            nepseChangePct: nepseIndex.perChange ?? null,
            sensitiveIndex: sensitiveIndex.currentValue || null,
            sensitiveChange: sensitiveIndex.change ?? null,
            floatIndex: floatIndex.currentValue || null,
            floatChange: floatIndex.change ?? null,
            totalTurnover: sm.find(s => s.detail === 'Total Turnover Rs:')?.value || null,
            totalVolume: sm.find(s => s.detail === 'Total Traded Shares')?.value || null,
            totalTrades: sm.find(s => s.detail === 'Total Transactions')?.value || null,
          },
          indices: idxList.length > 0 ? idxList.map(i => ({
            name: i.index,
            value: i.currentValue,
            change: i.change,
            changePct: i.perChange
          })) : getEmptyData().indices,
          gainers: (raw.gainers || []).length > 0 ? raw.gainers.map(g => ({
            symbol: g.symbol,
            ltp: g.ltp,
            pointChange: g.pointChange,
            pctChange: g.percentageChange,
            volume: 0
          })) : getEmptyData().gainers,
          losers: (raw.losers || []).length > 0 ? raw.losers.map(l => ({
            symbol: l.symbol,
            ltp: l.ltp,
            pointChange: l.pointChange,
            pctChange: l.percentageChange,
            volume: 0
          })) : getEmptyData().losers,
          turnover: (raw.turnover || []).length > 0 ? raw.turnover.map(t => ({
            symbol: t.symbol,
            ltp: t.closingPrice,
            volume: 0,
            turnover: t.turnover
          })) : getEmptyData().turnover,
          liveMarket,
          subIndices: (raw.subIndices || []).length > 0 ? raw.subIndices : getEmptyData().subIndices
        };

        cache = data;
        lastFetch = now;
        resolve(data);
      } catch (parseErr) {
        console.error('[NEPSE Fetcher] Parse Error:', parseErr.message);
        if (cache) { resolve(cache); return; }
        const diskCache = loadLtpCache();
        if (diskCache && diskCache.liveMarket && diskCache.liveMarket.length > 0) {
          const fallback = getEmptyData();
          fallback.liveMarket = diskCache.liveMarket;
          fallback.summary.simulatedData = false;
          fallback.summary.cachedData = true;
          fallback.summary.cachedAt = diskCache.savedAt;
          resolve(fallback);
        } else {
          resolve(getEmptyData());
        }
      }
    });
  });
  return fetchPromise;
}

// --- routes --------------------------------------------------------------------

router.get('/summary', async (req, res) => {
  const data = await getLiveNepseData();
  res.json(data.summary);
});

router.get('/indices', async (req, res) => {
  const data = await getLiveNepseData();
  res.json({ simulatedData: data.summary.simulatedData, indices: data.indices });
});

router.get('/top-gainers', async (req, res) => {
  const data = await getLiveNepseData();
  res.json({ simulatedData: data.summary.simulatedData, gainers: data.gainers });
});

router.get('/top-losers', async (req, res) => {
  const data = await getLiveNepseData();
  res.json({ simulatedData: data.summary.simulatedData, losers: data.losers });
});

router.get('/top-turnover', async (req, res) => {
  const data = await getLiveNepseData();
  res.json({ simulatedData: data.summary.simulatedData, turnover: data.turnover });
});

router.get('/live-market', async (req, res) => {
  const data = await getLiveNepseData();
  res.json({
    simulatedData: data.summary.simulatedData,
    cachedData: data.summary.cachedData || false,
    cachedAt: data.summary.cachedAt || null,
    liveMarket: data.liveMarket
  });
});

router.get('/sub-indices', async (req, res) => {
  const data = await getLiveNepseData();
  res.json({ simulatedData: data.summary.simulatedData, subIndices: data.subIndices });
});

router.get('/graph/:indexName', (req, res) => {
  const indexName = req.params.indexName || 'nepse';
  const script = path.join(__dirname, '../../fetch_graph.py');
  execFile('python', [script, indexName], (err, stdout, stderr) => {
    if (err) {
      console.error('[NEPSE Graph Fetcher] Error:', err.message);
      return res.status(500).json({ error: 'Failed to fetch graph data' });
    }
    try {
      const parsed = JSON.parse(stdout);
      res.json(parsed);
    } catch (parseErr) {
      console.error('[NEPSE Graph Fetcher] Parse Error:', parseErr.message);
      res.status(500).json({ error: 'Failed to parse graph data' });
    }
  });
});

const { fetchCompanyHistory } = require('../utils/historyFetcher');

router.get('/history/:symbol', async (req, res) => {
  try {
    let symbol = req.params.symbol.toUpperCase().trim();
    // We do not have historical multi-year data for Indices in the CSV repo.
    // Do NOT fallback to NABIL. Return an empty array so the frontend knows there's no data.
    if (symbol.includes('INDEX') || symbol === 'NEPSE') {
      return res.json([]);
    }

    const { from, to } = req.query;
    
    const fromSec = from ? parseInt(from, 10) : null;
    const toSec = to ? parseInt(to, 10) : null;

    // Index to major representative stock mapping for sector charts fallback
    const indexStockMap = {
      'NEPSE INDEX': 'NABIL',
      'NEPSE': 'NABIL',
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
      'SENSITIVE INDEX': 'NABIL',
      'FLOAT INDEX': 'NABIL'
    };

    let targetSymbol = symbol;
    let records = await fetchCompanyHistory(targetSymbol, fromSec, toSec);

    // If requested symbol was an index or had no direct CSV, try representative stock mapping
    if ((!records || records.length === 0) && indexStockMap[symbol]) {
      targetSymbol = indexStockMap[symbol];
      console.log(`[NEPSE History] Mapping index "${symbol}" to stock "${targetSymbol}"`);
      records = await fetchCompanyHistory(targetSymbol, fromSec, toSec);
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
