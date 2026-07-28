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

// --- simulated / fallback data ---------------------------------------------
function getEmptyData() { 
  return { 
    summary: { 
      isOpen: false, 
      isOffline: true, 
      simulatedData: false,
      cachedData: true,
      cachedAt: new Date().toISOString(),
      nepseIndex: 2074.56, 
      nepseChange: -8.34, 
      nepseChangePct: -0.40, 
      sensitiveIndex: 368.12, 
      sensitiveChange: -1.20, 
      floatIndex: 142.05, 
      floatChange: -0.45, 
      totalTurnover: 2854129400, 
      totalVolume: 7412090, 
      totalTrades: 48920 
    }, 
    indices: [
      { name: 'NEPSE Index', value: 2074.56, change: -8.34, changePct: -0.40 },
      { name: 'Sensitive Index', value: 368.12, change: -1.20, changePct: -0.32 },
      { name: 'Float Index', value: 142.05, change: -0.45, changePct: -0.31 },
      { name: 'Banking SubIndex', value: 1180.40, change: -4.10, changePct: -0.35 },
      { name: 'Development Bank Index', value: 3840.20, change: 12.50, changePct: 0.33 },
      { name: 'Finance Index', value: 2150.80, change: 18.20, changePct: 0.85 },
      { name: 'HydroPower Index', value: 2420.10, change: -15.40, changePct: -0.63 },
      { name: 'Life Insurance', value: 9850.00, change: -35.00, changePct: -0.35 },
      { name: 'Non Life Insurance', value: 10420.00, change: 45.00, changePct: 0.43 },
      { name: 'Manufacturing And Processing', value: 6540.00, change: -12.00, changePct: -0.18 },
      { name: 'Microfinance Index', value: 4120.00, change: 8.50, changePct: 0.21 },
      { name: 'Hotels And Tourism Index', value: 4890.00, change: 25.00, changePct: 0.51 },
      { name: 'Others Index', value: 1650.00, change: -5.00, changePct: -0.30 }
    ], 
    gainers: [
      { symbol: 'CHCL', ltp: 485.00, pointChange: 24.50, pctChange: 5.32, volume: 145000 },
      { symbol: 'NABIL', ltp: 580.00, pointChange: 15.00, pctChange: 2.65, volume: 210000 },
      { symbol: 'GBIME', ltp: 242.00, pointChange: 5.80, pctChange: 2.46, volume: 189000 },
      { symbol: 'SHIVM', ltp: 512.00, pointChange: 11.00, pctChange: 2.20, volume: 98000 },
      { symbol: 'NLIC', ltp: 685.00, pointChange: 12.00, pctChange: 1.78, volume: 64000 }
    ], 
    losers: [
      { symbol: 'STC', ltp: 4120.00, pointChange: -120.00, pctChange: -2.83, volume: 12000 },
      { symbol: 'HDL', ltp: 1840.00, pointChange: -45.00, pctChange: -2.39, volume: 34000 },
      { symbol: 'OHL', ltp: 890.00, pointChange: -18.00, pctChange: -1.98, volume: 22000 },
      { symbol: 'ICFC', ltp: 445.00, pointChange: -8.50, pctChange: -1.87, volume: 56000 },
      { symbol: 'NLG', ltp: 780.00, pointChange: -14.00, pctChange: -1.76, volume: 41000 }
    ], 
    turnover: [
      { symbol: 'NABIL', ltp: 580.00, volume: 210000, turnover: 121800000 },
      { symbol: 'NTC', ltp: 880.00, volume: 125000, turnover: 110000000 },
      { symbol: 'SHIVM', ltp: 512.00, volume: 98000, turnover: 50176000 },
      { symbol: 'CHCL', ltp: 485.00, volume: 145000, turnover: 70325000 },
      { symbol: 'GBIME', ltp: 242.00, volume: 189000, turnover: 45738000 }
    ], 
    liveMarket: [
      { symbol: 'NABIL', lastTradedPrice: 580.00, pointChange: 15.00, percentageChange: 2.65, sectorName: 'Commercial Banks' },
      { symbol: 'NTC', lastTradedPrice: 880.00, pointChange: -5.00, percentageChange: -0.56, sectorName: 'Others' },
      { symbol: 'SHIVM', lastTradedPrice: 512.00, pointChange: 11.00, percentageChange: 2.20, sectorName: 'Manufacturing And Processing' },
      { symbol: 'GBIME', lastTradedPrice: 242.00, pointChange: 5.80, percentageChange: 2.46, sectorName: 'Commercial Banks' },
      { symbol: 'CHCL', lastTradedPrice: 485.00, pointChange: 24.50, percentageChange: 5.32, sectorName: 'Hydro Power' },
      { symbol: 'HDL', lastTradedPrice: 1840.00, pointChange: -45.00, percentageChange: -2.39, sectorName: 'Manufacturing And Processing' },
      { symbol: 'NLIC', lastTradedPrice: 685.00, pointChange: 12.00, percentageChange: 1.78, sectorName: 'Life Insurance' },
      { symbol: 'NLG', lastTradedPrice: 780.00, pointChange: -14.00, percentageChange: -1.76, sectorName: 'Non Life Insurance' },
      { symbol: 'OHL', lastTradedPrice: 890.00, pointChange: -18.00, percentageChange: -1.98, sectorName: 'Hotels And Tourism' },
      { symbol: 'STC', lastTradedPrice: 4120.00, pointChange: -120.00, percentageChange: -2.83, sectorName: 'Trading' },
      { symbol: 'ICFC', lastTradedPrice: 445.00, pointChange: -8.50, percentageChange: -1.87, sectorName: 'Finance' },
      { symbol: 'CBBL', lastTradedPrice: 940.00, pointChange: 8.00, percentageChange: 0.86, sectorName: 'Microfinance' }
    ], 
    subIndices: [
      { index: 'Banking SubIndex', currentValue: 1180.40, change: -4.10, perChange: -0.35 },
      { index: 'Development Bank Index', currentValue: 3840.20, change: 12.50, perChange: 0.33 },
      { index: 'Finance Index', currentValue: 2150.80, change: 18.20, perChange: 0.85 },
      { index: 'HydroPower Index', currentValue: 2420.10, change: -15.40, perChange: -0.63 },
      { index: 'Life Insurance', currentValue: 9850.00, change: -35.00, perChange: -0.35 },
      { index: 'Non Life Insurance', currentValue: 10420.00, change: 45.00, perChange: 0.43 },
      { index: 'Manufacturing And Processing', currentValue: 6540.00, change: -12.00, perChange: -0.18 },
      { index: 'Microfinance Index', currentValue: 4120.00, change: 8.50, perChange: 0.21 },
      { index: 'Hotels And Tourism Index', currentValue: 4890.00, change: 25.00, perChange: 0.51 },
      { index: 'Trading Index', currentValue: 3120.00, change: -40.00, perChange: -1.27 },
      { index: 'Others Index', currentValue: 1650.00, change: -5.00, perChange: -0.30 }
    ] 
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
    execFile('python', [script], { maxBuffer: 1024 * 1024 * 5, timeout: 8000 }, (err, stdout, stderr) => {
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
            nepseIndex: nepseIndex.currentValue || 2074.56,
            nepseChange: nepseIndex.change || -8.34,
            nepseChangePct: nepseIndex.perChange || -0.40,
            sensitiveIndex: sensitiveIndex.currentValue || 368.12,
            sensitiveChange: sensitiveIndex.change || -1.20,
            floatIndex: floatIndex.currentValue || 142.05,
            floatChange: floatIndex.change || -0.45,
            totalTurnover: sm.find(s => s.detail === 'Total Turnover Rs:')?.value || 2854129400,
            totalVolume: sm.find(s => s.detail === 'Total Traded Shares')?.value || 7412090,
            totalTrades: sm.find(s => s.detail === 'Total Transactions')?.value || 48920,
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
