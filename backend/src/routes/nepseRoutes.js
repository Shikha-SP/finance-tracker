const express = require('express');
const router = express.Router();
const { execFile } = require('child_process');
const path = require('path');
const fs = require('fs');

// Windows ships `python`, Linux/macOS hosts (Render, etc.) ship `python3`.
function getPythonCmd() {
  return process.platform === 'win32' ? 'python' : 'python3';
}

// --- Persistent LTP disk cache -----------------------------------------------
// Saves real LTP data whenever the market is open, so we can show it later
// instead of fake simulated prices when the market is closed.
const LTP_CACHE_FILE = path.join(__dirname, '../../data/ltp_cache.json');
// Full real snapshot (indices, sub-indices, summary + live market) written by
// nepse_fetcher.py whenever it gets a fresh response from the NEPSE API.
const SNAPSHOT_CACHE_FILE = path.join(__dirname, '../../data/nepse_snapshot.json');

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

function loadSnapshotCache() {
  try {
    if (fs.existsSync(SNAPSHOT_CACHE_FILE)) {
      const raw = fs.readFileSync(SNAPSHOT_CACHE_FILE, 'utf8');
      const snap = JSON.parse(raw);
      if (snap && snap.liveMarket) return snap;
    }
  } catch (e) {
    console.warn('[Snapshot Cache] Failed to load snapshot:', e.message);
  }
  return null;
}

// Builds the frontend data structure from a real NEPSE snapshot (from disk).
function buildFromSnapshot(snap, statusText) {
  const st = snap.status || {};
  const sm = snap.summary || [];
  const idxList = snap.indices || [];
  const nepseIndex = idxList.find(i => i.index === 'NEPSE Index') || idxList[0] || {};
  const sensitiveIndex = idxList.find(i => i.index === 'Sensitive Index') || {};
  const floatIndex = idxList.find(i => i.index === 'Float Index') || {};

  return {
    summary: {
      isOpen: false,
      statusText: statusText || (st.isOpen || 'CLOSED'),
      simulatedData: false,
      cachedData: true,
      cachedAt: snap.savedAt || null,
      asOf: snap.asOf || snap.savedAt || null,
      dataSource: 'snapshot',
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
    })) : [],
    gainers: snap.gainers || [],
    losers: snap.losers || [],
    turnover: snap.turnover || [],
    liveMarket: snap.liveMarket || [],
    subIndices: snap.subIndices || [],
  };
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
      asOf: null,
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
    // Allow time for the NEPSE API gather plus the MeroLagani live-market scrape.
    execFile(getPythonCmd(), [script], { maxBuffer: 1024 * 1024 * 5, timeout: 45000 }, (err, stdout, stderr) => {
      fetchPromise = null;
      if (err) {
        console.warn('[NEPSE Fetcher] Python process error or timeout:', err.message);
        // On exec error: try in-memory cache, then real snapshot, then LTP disk cache
        if (cache) { resolve(cache); return; }
        const snapshot = loadSnapshotCache();
        if (snapshot) {
          const fallback = buildFromSnapshot(snapshot, `CLOSED (Cached data from ${snapshot.savedAt})`);
          resolve(fallback);
          return;
        }
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
        const fromCache = raw.cachedData === true;

        // If market gave us fresh real LTP data → save it to disk for future use.
        // Never overwrite the cache with already-cached data.
        if (hasRealLtp && !fromCache) {
          saveLtpCache(raw.liveMarket);
        }

        // Fallback chain: real data → disk cache → historic latest (last resort)
        let liveMarket;
        let diskCachedData = fromCache;
        let diskCachedAt = fromCache ? (raw.cachedAt || null) : null;
        if (hasRealLtp) {
          liveMarket = raw.liveMarket;
        } else {
          const diskCache = loadLtpCache();
          if (diskCache && diskCache.liveMarket && diskCache.liveMarket.length > 0) {
            liveMarket = diskCache.liveMarket;
            diskCachedData = true;
            diskCachedAt = diskCache.savedAt;
            console.log('[NEPSE] Live market empty — using disk cache from', diskCachedAt);
          } else {
            liveMarket = getEmptyData().liveMarket;
            diskCachedData = true;
            diskCachedAt = new Date().toISOString();
          }
        }

        const data = {
          summary: {
            isOpen: st.isOpen === 'OPEN',
            statusText: fromCache
              ? `Cached data from ${raw.cachedAt ? String(raw.cachedAt).slice(0, 10) : 'last session'} (${st.isOpen || 'CLOSED'})`
              : (st.isOpen || 'CLOSED'),
            simulatedData: false,
            cachedData: diskCachedData,
            cachedAt: diskCachedAt,
            asOf: raw.asOf || null,
            dataSource: raw.dataSource || 'live',
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
        const snapshot = loadSnapshotCache();
        if (snapshot) {
          const fallback = buildFromSnapshot(snapshot, `CLOSED (Cached data from ${snapshot.savedAt})`);
          resolve(fallback);
          return;
        }
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
  execFile(getPythonCmd(), [script, indexName], (err, stdout, stderr) => {
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
