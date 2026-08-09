const fs = require('fs');
const path = require('path');
const { Nepse, IndexIDEnum } = require('@rumess/nepse-api');

// --- Writable cache location --------------------------------------------------
// Vercel serverless has a read-only filesystem (except /tmp). Local dev and
// Render use the repo's data folder. All writes are best-effort so a read-only
// filesystem degrades gracefully instead of crashing a request.
const IS_SERVERLESS = !!process.env.VERCEL;
const DATA_DIR = IS_SERVERLESS ? path.join('/tmp', 'nepse_data') : path.join(__dirname, '../../data');
const SNAPSHOT_PATH = path.join(DATA_DIR, 'nepse_snapshot.json');
const LTP_CACHE_PATH = path.join(DATA_DIR, 'ltp_cache.json');
const CSV_FALLBACK_PATH = path.join(__dirname, '../../data/raw/prices/price_history.csv');

const MERO_HEADERS = {
  'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) Chrome/126 Safari/537.36'
};

let snapshotMemory = null;
let ltpCacheMemory = null;

function ensureDir(dir) {
  try {
    if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
  } catch (e) {
    // read-only filesystem — ignore
  }
}

function readJsonIfFresh(filePath, ttlMs) {
  try {
    if (!fs.existsSync(filePath)) return null;
    if (ttlMs) {
      const stats = fs.statSync(filePath);
      if (Date.now() - stats.mtimeMs > ttlMs) return null;
    }
    return JSON.parse(fs.readFileSync(filePath, 'utf8'));
  } catch (e) {
    return null;
  }
}

function writeJson(filePath, data) {
  try {
    ensureDir(path.dirname(filePath));
    fs.writeFileSync(filePath, JSON.stringify(data), 'utf8');
  } catch (e) {
    // read-only filesystem — cache just lives in memory
  }
}

// --- Snapshot / LTP disk caches ----------------------------------------------

function loadSnapshot() {
  if (snapshotMemory) return snapshotMemory;
  const snap = readJsonIfFresh(SNAPSHOT_PATH, null);
  if (snap && snap.liveMarket) snapshotMemory = snap;
  return snapshotMemory;
}

function saveSnapshot(data) {
  data.savedAt = new Date().toISOString();
  snapshotMemory = data;
  writeJson(SNAPSHOT_PATH, data);
}

function loadLtpCache() {
  if (ltpCacheMemory) return ltpCacheMemory;
  const cache = readJsonIfFresh(LTP_CACHE_PATH, null);
  if (cache && Array.isArray(cache.liveMarket)) ltpCacheMemory = cache;
  return ltpCacheMemory;
}

function saveLtpCache(liveMarket) {
  const cache = { liveMarket, savedAt: new Date().toISOString() };
  ltpCacheMemory = cache;
  writeJson(LTP_CACHE_PATH, cache);
}

// --- MeroLagani live-market scrape (fallback for NEPSE live market) ----------

function stripCellTags(html) {
  return String(html || '')
    .replace(/<[^>]+>/g, ' ')
    .replace(/&nbsp;/gi, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

function parseNum(value) {
  const n = parseFloat(String(value || '').replace(/,/g, '').replace(/%/g, '').trim());
  return Number.isNaN(n) ? 0.0 : n;
}

async function scrapeMerolaganiLiveMarket() {
  const rows = [];
  let asOf = null;
  let html = '';
  try {
    const res = await fetch('https://merolagani.com/LatestMarket.aspx', {
      headers: MERO_HEADERS,
      signal: AbortSignal.timeout(20000)
    });
    html = await res.text();
  } catch (e) {
    console.warn('[NEPSE] MeroLagani live-market fetch failed:', e.message);
    return { rows, asOf };
  }

  const asOfMatch = html.match(/As of\s*([0-9]{4}\/[0-9]{2}\/[0-9]{2}\s*[0-9:]+)/);
  if (asOfMatch) asOf = asOfMatch[1];

  const trBlocks = html.match(/<tr[\s\S]*?<\/tr>/gi) || [];
  let header = null;
  for (const tr of trBlocks) {
    const cellMatches = tr.match(/<t[dh][^>]*>([\s\S]*?)<\/t[dh]>/gi) || [];
    const texts = cellMatches.map(stripCellTags);
    if (!texts.length) continue;
    if (texts[0].toLowerCase() === 'symbol') {
      header = texts;
      continue;
    }
    if (!header || texts.length < 7) continue;
    const sym = texts[0];
    if (!sym) continue;
    const ltp = parseNum(texts[1]);
    if (ltp <= 0) continue;
    const pct = parseNum(texts[2]);
    const o = parseNum(texts[3]);
    const hi = parseNum(texts[4]);
    const lo = parseNum(texts[5]);
    const qty = parseNum(texts[6]);
    let pclose = texts.length > 7 ? parseNum(texts[7]) : 0;
    if (pclose <= 0 && pct !== 0) pclose = ltp / (1.0 + pct / 100.0);
    rows.push({
      symbol: sym,
      lastTradedPrice: ltp,
      openPrice: o,
      highPrice: hi,
      lowPrice: lo,
      totalTradeQuantity: Math.round(qty),
      pointChange: Math.round((ltp - pclose) * 100) / 100,
      percentageChange: pct,
      previousClose: Math.round(pclose * 100) / 100,
      securityName: sym,
      sectorName: 'Equity'
    });
  }

  return { rows, asOf };
}

// --- Last-resort CSV fallback (real stock prices from the repo's data dir) ----

function getCsvFallback() {
  try {
    if (!fs.existsSync(CSV_FALLBACK_PATH)) return null;
    const csvText = fs.readFileSync(CSV_FALLBACK_PATH, 'utf8');
    const lines = csvText.trim().split('\n');
    if (lines.length < 2) return null;

    const headers = lines[0].split(',').map(h => h.trim().toLowerCase());
    const col = (name) => headers.indexOf(name);

    const rows = [];
    for (let i = 1; i < lines.length; i++) {
      const cols = lines[i].split(',');
      if (cols.length < headers.length) continue;
      const row = {};
      headers.forEach((h, idx) => { row[h] = cols[idx]; });
      rows.push(row);
    }
    if (!rows.length) return null;

    const dates = rows.map(r => r.date).filter(Boolean);
    const latestDate = dates.reduce((a, b) => (a > b ? a : b), '');
    const latest = rows.filter(r => r.date === latestDate);

    const enriched = latest.map(r => {
      const o = parseFloat(r.open || 0) || 0;
      const c = parseFloat(r.close || 0) || 0;
      const change = c - o;
      return {
        ...r,
        _change: change,
        _pct: o ? (change / o) * 100 : 0,
        _turnover: parseFloat(r.turnover || 0) || 0,
        _volume: parseInt(r.volume || 0, 10) || 0
      };
    });

    const byPct = [...enriched].sort((a, b) => b._pct - a._pct);
    const byTurnover = [...enriched].sort((a, b) => b._turnover - a._turnover);

    const liveMarket = enriched.map(r => ({
      symbol: String(r.symbol || 'UNK'),
      lastTradedPrice: r._change === 0 ? (parseFloat(r.close) || 0) : (parseFloat(r.close) || 0),
      openPrice: parseFloat(r.open) || 0,
      highPrice: parseFloat(r.high) || 0,
      lowPrice: parseFloat(r.low) || 0,
      pointChange: Math.round(r._change * 100) / 100,
      percentageChange: Math.round(r._pct * 100) / 100,
      totalTradeQuantity: r._volume,
      totalTradeValue: r._turnover,
      sectorName: 'Equity'
    }));

    return {
      status: { isOpen: `CLOSED (Showing past data from ${latestDate})` },
      summary: [
        { detail: 'Total Turnover Rs:', value: enriched.reduce((s, r) => s + r._turnover, 0) },
        { detail: 'Total Traded Shares', value: enriched.reduce((s, r) => s + r._volume, 0) },
        { detail: 'Total Transactions', value: null }
      ],
      indices: [],
      gainers: byPct.slice(0, 15).map(r => ({ symbol: String(r.symbol), ltp: parseFloat(r.close) || 0, pointChange: Math.round(r._change * 100) / 100, percentageChange: Math.round(r._pct * 100) / 100, volume: r._volume })),
      losers: byPct.slice(-15).reverse().map(r => ({ symbol: String(r.symbol), ltp: parseFloat(r.close) || 0, pointChange: Math.round(r._change * 100) / 100, percentageChange: Math.round(r._pct * 100) / 100, volume: r._volume })),
      turnover: byTurnover.slice(0, 15).map(r => ({ symbol: String(r.symbol), closingPrice: parseFloat(r.close) || 0, turnover: r._turnover, volume: r._volume })),
      liveMarket,
      subIndices: []
    };
  } catch (e) {
    console.warn('[NEPSE] CSV fallback failed:', e.message);
    return null;
  }
}

function getEmptyData() {
  return {
    status: { isOpen: 'CLOSED' },
    summary: [],
    indices: [],
    gainers: [],
    losers: [],
    turnover: [],
    liveMarket: [],
    subIndices: []
  };
}

// --- Live fetch from the NEPSE API via @rumess/nepse-api ---------------------

function toSummaryArray(summary) {
  if (Array.isArray(summary)) return summary;
  if (summary && typeof summary === 'object') {
    return Object.entries(summary).map(([detail, value]) => ({ detail, value }));
  }
  return [];
}

function toLeaderList(items) {
  return (items || []).map(g => ({
    symbol: g.symbol,
    ltp: g.ltp,
    pointChange: g.pointChange,
    percentageChange: g.percentChange ?? g.percentageChange,
    volume: g.volume ?? 0
  }));
}

function toTurnoverList(items) {
  return (items || []).map(t => ({
    symbol: t.symbol,
    closingPrice: t.closingPrice,
    turnover: t.turnover,
    volume: t.volume ?? 0
  }));
}

async function fetchAllLive() {
  const nepse = new Nepse();
  nepse.setTLSVerification(false);

  const settle = (p) => p.then(v => v).catch(e => { console.warn('[NEPSE] One source failed:', e.message); return null; });

  const [st, sum, idx, gainers, losers, turnover, liveMarket, subIndices] = await Promise.all([
    settle(nepse.getMarketStatus()),
    settle(nepse.getMarketSummary()),
    settle(nepse.getNepseIndex()),
    settle(nepse.getTopTenGainers()),
    settle(nepse.getTopTenLosers()),
    settle(nepse.getTopTenTurnoverScrips()),
    settle(nepse.getLiveMarket()),
    settle(nepse.getNepseSubIndices())
  ]);

  let live = (liveMarket && liveMarket.length > 0) ? liveMarket : null;
  let asOf = (st && st.asOf) || null;

  // getLiveMarket() can return an empty list from NEPSE; fall back to MeroLagani.
  if (!live) {
    const { rows, asOf: meroAsOf } = await scrapeMerolaganiLiveMarket();
    if (rows.length > 0) {
      live = rows;
      asOf = asOf || meroAsOf;
    }
  }

  return {
    status: st || { isOpen: 'CLOSED' },
    summary: toSummaryArray(sum),
    indices: idx || [],
    gainers: toLeaderList(gainers),
    losers: toLeaderList(losers),
    turnover: toTurnoverList(turnover),
    liveMarket: live || [],
    subIndices: subIndices || [],
    asOf: asOf || (live ? new Date().toISOString() : null)
  };
}

// --- Orchestration + transform to the frontend contract ----------------------

function transform(raw) {
  const st = raw.status || {};
  const sm = raw.summary || [];
  const idxList = raw.indices || [];

  const nepseIndex = idxList.find(i => i.index === 'NEPSE Index') || idxList[0] || {};
  const sensitiveIndex = idxList.find(i => i.index === 'Sensitive Index') || {};
  const floatIndex = idxList.find(i => i.index === 'Float Index') || {};

  const hasRealLtp = raw.liveMarket && raw.liveMarket.length > 0;
  const fromCache = raw.cachedData === true;

  // If the market gave us fresh real LTP data, remember it for later.
  if (hasRealLtp && !fromCache) {
    saveLtpCache(raw.liveMarket);
  }

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
    } else {
      liveMarket = [];
      diskCachedData = true;
      diskCachedAt = new Date().toISOString();
    }
  }

  return {
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
      totalTrades: sm.find(s => s.detail === 'Total Transactions')?.value || null
    },
    indices: idxList.length > 0 ? idxList.map(i => ({
      name: i.index,
      value: i.currentValue,
      change: i.change,
      changePct: i.perChange
    })) : [],
    gainers: (raw.gainers || []).length > 0 ? raw.gainers.map(g => ({
      symbol: g.symbol,
      ltp: g.ltp,
      pointChange: g.pointChange,
      pctChange: g.percentageChange,
      volume: 0
    })) : [],
    losers: (raw.losers || []).length > 0 ? raw.losers.map(l => ({
      symbol: l.symbol,
      ltp: l.ltp,
      pointChange: l.pointChange,
      pctChange: l.percentageChange,
      volume: 0
    })) : [],
    turnover: (raw.turnover || []).length > 0 ? raw.turnover.map(t => ({
      symbol: t.symbol,
      ltp: t.closingPrice,
      volume: 0,
      turnover: t.turnover
    })) : [],
    liveMarket,
    subIndices: (raw.subIndices || []).length > 0 ? raw.subIndices : []
  };
}

let cache = null;
let lastFetch = 0;
let fetchPromise = null;

async function getLiveNepseData() {
  const now = Date.now();
  if (cache && now - lastFetch < 60000) return cache;
  if (fetchPromise) return fetchPromise;

  fetchPromise = (async () => {
    let out = null;
    try {
      out = await Promise.race([
        fetchAllLive(),
        new Promise((_, reject) => setTimeout(() => reject(new Error('live fetch timeout')), 25000))
      ]);
    } catch (e) {
      console.warn('[NEPSE Fetcher] Live fetch failed:', e.message);
    }

    // Real data is always preferred — even when the market is closed the API
    // returns true last index values, so we never swap in fabricated data.
    if (!out || !Array.isArray(out.indices)) out = null;

    let cached = false;
    let cachedAt = null;
    let dataSource = 'live';

    if (!out || !out.liveMarket || out.liveMarket.length === 0) {
      const snapshot = loadSnapshot();
      if (snapshot && snapshot.liveMarket && snapshot.liveMarket.length > 0) {
        out = {
          status: snapshot.status || { isOpen: 'CLOSED' },
          summary: snapshot.summary || [],
          indices: snapshot.indices || [],
          gainers: snapshot.gainers || [],
          losers: snapshot.losers || [],
          turnover: snapshot.turnover || [],
          liveMarket: snapshot.liveMarket || [],
          subIndices: snapshot.subIndices || [],
          asOf: snapshot.asOf || snapshot.savedAt
        };
        cached = true;
        cachedAt = snapshot.savedAt;
        dataSource = 'snapshot';
      } else {
        const csvFallback = getCsvFallback();
        if (csvFallback) {
          out = csvFallback;
          cached = true;
          dataSource = 'csv';
        } else {
          out = getEmptyData();
          dataSource = 'empty';
        }
      }
    }

    if (dataSource === 'live' && out.liveMarket && out.liveMarket.length > 0) {
      saveSnapshot({ ...out });
    }

    out.cachedData = cached;
    out.cachedAt = cachedAt;
    out.dataSource = dataSource;
    return transform(out);
  })().finally(() => { fetchPromise = null; });

  const data = await fetchPromise;
  cache = data;
  lastFetch = now;
  return data;
}

// --- Index graph (port of fetch_graph.py) ------------------------------------

const GRAPH_INDEX_MAP = [
  { key: 'nepse', id: IndexIDEnum.NEPSE },
  { key: 'sensitive float', id: IndexIDEnum.SENSITIVE_FLOAT },
  { key: 'sensitive', id: IndexIDEnum.SENSITIVE },
  { key: 'float', id: IndexIDEnum.FLOAT },
  { key: 'bank', id: IndexIDEnum.BANKING },
  { key: 'dev', id: IndexIDEnum.DEVELOPMENT_BANK },
  { key: 'finance', id: IndexIDEnum.FINANCE },
  { key: 'hotel', id: IndexIDEnum.HOTEL_TOURISM },
  { key: 'hydro', id: IndexIDEnum.HYDRO },
  { key: 'non life', id: IndexIDEnum.NON_LIFE_INSURANCE },
  { key: 'life', id: IndexIDEnum.LIFE_INSURANCE },
  { key: 'manu', id: IndexIDEnum.MANUFACTURING },
  { key: 'micro', id: IndexIDEnum.MICROFINANCE },
  { key: 'mutual', id: IndexIDEnum.MUTUAL_FUND },
  { key: 'trade', id: IndexIDEnum.TRADING },
  { key: 'invest', id: IndexIDEnum.INVESTMENT },
  { key: 'other', id: IndexIDEnum.OTHERS }
];

async function getIndexGraph(indexName) {
  const name = String(indexName || '').toLowerCase();
  const entry = GRAPH_INDEX_MAP.find(({ key }) => name.includes(key)) || { id: IndexIDEnum.NEPSE };
  try {
    const nepse = new Nepse();
    nepse.setTLSVerification(false);
    const graph = await nepse.getIndexDailyGraph(entry.id);
    return { graph };
  } catch (e) {
    console.warn('[NEPSE Graph] Failed:', e.message);
    return { error: String(e.message || e) };
  }
}

module.exports = {
  getLiveNepseData,
  getIndexGraph,
  transform,
  scrapeMerolaganiLiveMarket
};
