const fs = require('fs');
const path = require('path');

function resolveDataDir() {
  if (process.env.DATA_DIR) return process.env.DATA_DIR;
  const candidates = [
    path.resolve(__dirname, '../../data'),
    path.resolve(process.cwd(), 'data'),
  ];
  for (const candidate of candidates) {
    try {
      if (fs.statSync(candidate).isDirectory()) return candidate;
    } catch (err) {
      // keep trying
    }
  }
  return candidates[0];
}

const DATA_DIR = resolveDataDir();
const RAW_NEWS_DIR = path.join(DATA_DIR, 'raw', 'news');
const FUND_CACHE_FILE = path.join(DATA_DIR, 'raw', 'fundamentals', 'merolagani_cache.json');
const COMPANY_META_FILE = path.join(DATA_DIR, 'raw', 'prices', 'company_meta.json');
const PRICE_HISTORY_CSV = path.join(DATA_DIR, 'raw', 'prices', 'price_history.csv');
const SNAPSHOT_FILE = path.join(DATA_DIR, 'nepse_snapshot.json');
const SECTOR_MOMENTUM_FILE = path.join(DATA_DIR, 'raw', 'sector_momentum_cache.json');
const INDEX_HISTORY_FILE = path.join(DATA_DIR, 'history_cache', 'INDEX_NEPSE.json');

const NEWS_RECENT_MAX_DAYS = 45;

function loadJson(file, fallback) {
  try {
    return JSON.parse(fs.readFileSync(file, 'utf-8'));
  } catch (err) {
    return fallback;
  }
}

let _fundCache = null;
function loadFundamentals() {
  if (_fundCache === null) _fundCache = loadJson(FUND_CACHE_FILE, {});
  return _fundCache;
}

let _snapshot = null;
function loadSnapshot() {
  if (_snapshot === null) _snapshot = loadJson(SNAPSHOT_FILE, {});
  return _snapshot;
}

let _companyMeta = null;
function loadCompanyMeta() {
  if (_companyMeta === null) _companyMeta = loadJson(COMPANY_META_FILE, {});
  return _companyMeta;
}

let _sectorMomentum = null;
function loadSectorMomentum() {
  if (_sectorMomentum === null) _sectorMomentum = loadJson(SECTOR_MOMENTUM_FILE, {});
  return _sectorMomentum;
}

const _newsCache = new Map();
function loadNewsForSymbol(symbol) {
  const clean = String(symbol || '').trim().toUpperCase();
  if (_newsCache.has(clean)) return _newsCache.get(clean);
  const items = loadJson(path.join(RAW_NEWS_DIR, `${clean}_news.json`), []);
  const list = Array.isArray(items) ? items : [];
  _newsCache.set(clean, list);
  return list;
}

// ── Price history CSV → { symbol: [ {date, open, high, low, close, volume} ] } ──

let _priceRows = null;   // { symbol: rows[] }
let _symbolList = null;

function parseSimpleCsv(text) {
  const lines = text.split(/\r?\n/);
  const header = lines[0].split(',').map(h => h.trim().toLowerCase());
  const rows = [];
  for (let i = 1; i < lines.length; i++) {
    const line = lines[i];
    if (!line.trim()) continue;
    const cells = line.split(',');
    const row = {};
    header.forEach((h, idx) => { row[h] = cells[idx]; });
    rows.push(row);
  }
  return rows;
}

function loadPriceHistory() {
  if (_priceRows) return _priceRows;
  try {
    const text = fs.readFileSync(PRICE_HISTORY_CSV, 'utf-8');
    const raw = parseSimpleCsv(text);
    const map = {};
    for (const r of raw) {
      const sym = String(r.symbol || '').trim().toUpperCase();
      if (!sym) continue;
      const close = parseFloat(r.close);
      if (!isFinite(close)) continue;
      const row = {
        date: String(r.date || '').slice(0, 10),
        open: parseFloat(r.open) || 0,
        high: parseFloat(r.high) || 0,
        low: parseFloat(r.low) || 0,
        close,
        volume: parseInt(r.volume, 10) || 0,
      };
      (map[sym] = map[sym] || []).push(row);
    }
    for (const sym of Object.keys(map)) {
      map[sym].sort((a, b) => (a.date < b.date ? -1 : a.date > b.date ? 1 : 0));
    }
    _priceRows = map;
    _symbolList = Object.keys(map).sort();
  } catch (err) {
    _priceRows = {};
    _symbolList = [];
  }
  return _priceRows;
}

function getSymbolList() {
  loadPriceHistory();
  return _symbolList || [];
}

let _indexHistory = null;
function loadIndexHistory() {
  if (_indexHistory) return _indexHistory;
  try {
    const arr = JSON.parse(fs.readFileSync(INDEX_HISTORY_FILE, 'utf-8'));
    _indexHistory = arr
      .map(r => ({
        date: String(r.time || r.date || '').slice(0, 10),
        open: parseFloat(r.open) || 0,
        high: parseFloat(r.high) || 0,
        low: parseFloat(r.low) || 0,
        close: parseFloat(r.close) || 0,
        volume: parseInt(r.volume, 10) || 0,
      }))
      .filter(r => r.date && r.close > 0)
      .sort((a, b) => (a.date < b.date ? -1 : a.date > b.date ? 1 : 0));
  } catch (err) {
    _indexHistory = [];
  }
  return _indexHistory;
}

// ── Date helpers ────────────────────────────────────────────────────────────

const DATE_FORMATS = [
  '%Y-%m-%d %H:%M:%S', '%Y-%m-%d %H:%M', '%Y-%m-%d',
  '%b %d, %Y', '%d %b %Y', '%B %d, %Y', '%d/%m/%Y',
];

const MONTHS = { Jan: 0, Feb: 1, Mar: 2, Apr: 3, May: 4, Jun: 5, Jul: 6, Aug: 7, Sep: 8, Oct: 9, Nov: 10, Dec: 11 };

function parseDate(str) {
  if (!str) return null;
  let s = String(str).trim();
  // Defensive: some cached feeds carry a duplicated timezone
  s = s.replace(/(\+\d{4})\s+\+\d{4}$/, '$1');
  const lower = s.toLowerCase();
  if (['ago', 'today', 'yesterday', 'just now'].some(w => lower.includes(w))) return null;

  // RFC 2822 like "Wed, 05 Aug 2026 03:12:34 GMT"
  let m = s.match(/^[A-Za-z]{3},\s+(\d{1,2})\s+([A-Za-z]{3})\s+(\d{4})\s+(\d{1,2}):(\d{2})(?::(\d{2}))?\s*(.*)$/);
  if (m) {
    const tz = (m[7] || '').trim();
    let tzMin = 0;
    if (tz) {
      const tzm = tz.match(/^([+-])(\d{2})(\d{2})$/);
      if (tzm) {
        tzMin = (parseInt(tzm[2], 10) * 60 + parseInt(tzm[3], 10)) * (tzm[1] === '-' ? -1 : 1);
      }
    }
    const d = new Date(Date.UTC(
      parseInt(m[3], 10), MONTHS[m[2]], parseInt(m[1], 10),
      parseInt(m[4], 10), parseInt(m[5], 10), m[6] ? parseInt(m[6], 10) : 0
    ));
    d.setUTCMinutes(d.getUTCMinutes() - tzMin);
    return d;
  }
  return null;
}

function relativeTime(pubDate) {
  if (!pubDate) return 'unknown';
  const s = String(pubDate).trim();
  const lower = s.toLowerCase();
  if (['ago', 'today', 'yesterday', 'just now'].some(w => lower.includes(w))) return s;
  const dt = parseDate(s);
  if (!dt) return s;
  const diffSec = Math.floor((Date.now() - dt.getTime()) / 1000);
  if (diffSec < 0) return s;
  if (diffSec < 60) return 'just now';
  const minutes = Math.floor(diffSec / 60);
  if (minutes < 60) return `${minutes}m ago`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.floor(hours / 24);
  if (days < 7) return `${days}d ago`;
  const weeks = Math.floor(days / 7);
  if (weeks < 5) return `${weeks}w ago`;
  const months = Math.floor(days / 30);
  if (months < 12) return `${months}mo ago`;
  return `${Math.floor(days / 365)}y ago`;
}

// ── Market bias from the NEPSE snapshot ─────────────────────────────────────

function getMarketBias() {
  try {
    const snap = loadSnapshot();
    const nepse = (snap.indices || []).find(i => i.index === 'NEPSE Index');
    if (!nepse) return { available: false, bias: 0, trend: 'FLAT' };
    const pct = parseFloat(nepse.perChange ?? nepse.changePct ?? 0) || 0;
    let trend = 'FLAT';
    if (pct >= 0.5) trend = 'RISING';
    else if (pct <= -0.5) trend = 'FALLING';
    const bias = Math.round(Math.max(-3, Math.min(3, pct * 2)) * 100) / 100;
    return {
      available: true,
      index: parseFloat(nepse.currentValue ?? nepse.close ?? 0) || 0,
      changePct: Math.round(pct * 100) / 100,
      trend,
      bias,
      asOf: snap.asOf,
    };
  } catch (err) {
    return { available: false, bias: 0, trend: 'FLAT' };
  }
}

module.exports = {
  DATA_DIR,
  loadFundamentals,
  loadSnapshot,
  loadCompanyMeta,
  loadSectorMomentum,
  loadNewsForSymbol,
  loadPriceHistory,
  getSymbolList,
  loadIndexHistory,
  relativeTime,
  parseDate,
  getMarketBias,
  NEWS_RECENT_MAX_DAYS,
};
