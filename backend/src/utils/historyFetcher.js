const fs = require('fs');
const path = require('path');

const CACHE_DIR = path.join(__dirname, '../../data/history_cache');
const CSV_BACKUP_DIR = path.join(__dirname, '../../data/csv_backup');
const CACHE_TTL_MS = 2 * 60 * 60 * 1000; // 2 hours

function ensureDirs() {
  if (!fs.existsSync(CACHE_DIR)) fs.mkdirSync(CACHE_DIR, { recursive: true });
  if (!fs.existsSync(CSV_BACKUP_DIR)) fs.mkdirSync(CSV_BACKUP_DIR, { recursive: true });
}

/**
 * Parses CSV text from Nepse-All-Scraper
 * Headers: date,open,high,low,ltp,percent_change,qty,turnover
 */
function parseCsvPrices(csvText) {
  const lines = csvText.trim().split('\n');
  if (lines.length < 2) return [];

  const headers = lines[0].split(',').map(h => h.trim().toLowerCase());
  const dateIdx = headers.indexOf('date');
  const openIdx = headers.indexOf('open');
  const highIdx = headers.indexOf('high');
  const lowIdx = headers.indexOf('low');
  const ltpIdx = headers.indexOf('ltp');
  const qtyIdx = headers.indexOf('qty');
  const turnoverIdx = headers.indexOf('turnover');

  const records = [];

  for (let i = 1; i < lines.length; i++) {
    const line = lines[i].trim();
    if (!line) continue;
    const cols = line.split(',');
    if (cols.length < headers.length) continue;

    const dateStr = cols[dateIdx]?.trim();
    if (!dateStr || !/^\d{4}-\d{2}-\d{2}$/.test(dateStr)) continue;

    const open = parseFloat(cols[openIdx]);
    const high = parseFloat(cols[highIdx]);
    const low = parseFloat(cols[lowIdx]);
    const close = parseFloat(cols[ltpIdx]);
    const volume = parseFloat(cols[qtyIdx] || 0);
    const turnover = parseFloat(cols[turnoverIdx] || 0);

    if (isNaN(close)) continue;

    const epochSec = Math.floor(new Date(`${dateStr}T00:00:00Z`).getTime() / 1000);

    records.push({
      time: dateStr,
      timestamp: epochSec,
      open: isNaN(open) ? close : open,
      high: isNaN(high) ? Math.max(open || close, close) : high,
      low: isNaN(low) ? Math.min(open || close, close) : low,
      close: close,
      value: close,
      volume: isNaN(volume) ? 0 : volume,
      turnover: isNaN(turnover) ? 0 : turnover
    });
  }

  // Sort ascending by date
  records.sort((a, b) => a.timestamp - b.timestamp);
  return records;
}

/**
 * Fetches company historical records from SamirWagle/Nepse-All-Scraper GitHub repo
 * Saves both parsed JSON cache and raw CSV backup file.
 */
async function fetchCompanyHistory(symbol, fromSec = null, toSec = null) {
  const cleanSymbol = symbol.toUpperCase().trim();
  ensureDirs();

  const cacheFile = path.join(CACHE_DIR, `${cleanSymbol}.json`);
  const csvBackupFile = path.join(CSV_BACKUP_DIR, `${cleanSymbol}.csv`);
  let records = null;

  // Check JSON cache
  if (fs.existsSync(cacheFile)) {
    try {
      const stats = fs.statSync(cacheFile);
      const isFresh = (Date.now() - stats.mtimeMs) < CACHE_TTL_MS;
      if (isFresh) {
        const raw = fs.readFileSync(cacheFile, 'utf8');
        records = JSON.parse(raw);
      }
    } catch (e) {
      console.warn(`[HistoryFetcher] Cache read error for ${cleanSymbol}:`, e.message);
    }
  }

  // If not cached or stale, fetch from GitHub raw repository
  if (!records) {
    const rawUrl = `https://raw.githubusercontent.com/SamirWagle/Nepse-All-Scraper/main/data/company-wise/${cleanSymbol}/prices.csv`;
    try {
      const response = await fetch(rawUrl, {
        headers: {
          'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) FinanceTracker/1.0'
        }
      });

      if (!response.ok) {
        throw new Error(`HTTP ${response.status} when fetching ${cleanSymbol}`);
      }

      const csvText = await response.text();
      records = parseCsvPrices(csvText);

      if (records.length > 0) {
        // Save CSV backup
        fs.writeFileSync(csvBackupFile, csvText, 'utf8');
        // Save JSON cache
        fs.writeFileSync(cacheFile, JSON.stringify(records), 'utf8');
        console.log(`[HistoryFetcher] Saved CSV backup & cached ${records.length} records for ${cleanSymbol}`);
      }
    } catch (err) {
      console.warn(`[HistoryFetcher] Live fetch error for ${cleanSymbol}:`, err.message);
      
      // Fallback 1: read local CSV backup file
      if (fs.existsSync(csvBackupFile)) {
        try {
          const csvText = fs.readFileSync(csvBackupFile, 'utf8');
          records = parseCsvPrices(csvText);
          console.log(`[HistoryFetcher] Loaded ${records.length} records from CSV backup for ${cleanSymbol}`);
        } catch (e) {
          records = null;
        }
      }

      // Fallback 2: read JSON cache file even if stale
      if (!records && fs.existsSync(cacheFile)) {
        try {
          records = JSON.parse(fs.readFileSync(cacheFile, 'utf8'));
        } catch (e) {
          records = [];
        }
      }

      if (!records) records = [];
    }
  }

  // Filter by date range if provided
  let result = records;
  if (fromSec || toSec) {
    result = records.filter(r => {
      if (fromSec && r.timestamp < fromSec) return false;
      if (toSec && r.timestamp > toSec) return false;
      return true;
    });
  }

  return result;
}

/**
 * Parses real NEPSE index history CSV.
 * Headers: time,symbol,open,close,high,low,volume,category
 * Skips any leading metadata / Git-LFS pointer lines.
 */
function parseIndexCsv(csvText) {
  const lines = csvText.trim().split('\n');
  if (lines.length < 2) return [];

  // Some index files start with Git-LFS pointer lines, so locate the real header.
  let headerIdx = -1;
  let headers = null;
  for (let i = 0; i < lines.length; i++) {
    const candidate = lines[i].split(',').map(h => h.trim().toLowerCase());
    if (candidate.includes('time') && candidate.includes('close')) {
      headerIdx = i;
      headers = candidate;
      break;
    }
  }
  if (headerIdx < 0 || !headers) return [];

  const timeIdx = headers.indexOf('time');
  const openIdx = headers.indexOf('open');
  const highIdx = headers.indexOf('high');
  const lowIdx = headers.indexOf('low');
  const closeIdx = headers.indexOf('close');
  const volumeIdx = headers.indexOf('volume');

  const records = [];
  for (let i = headerIdx + 1; i < lines.length; i++) {
    const line = lines[i].trim();
    if (!line) continue;
    const cols = line.split(',');
    if (cols.length < headers.length) continue;

    const dateStr = cols[timeIdx]?.trim();
    if (!dateStr || !/^\d{4}-\d{2}-\d{2}$/.test(dateStr)) continue;

    const open = parseFloat(cols[openIdx]);
    const high = parseFloat(cols[highIdx]);
    const low = parseFloat(cols[lowIdx]);
    const close = parseFloat(cols[closeIdx]);
    if (isNaN(close)) continue;

    const epochSec = Math.floor(new Date(`${dateStr}T00:00:00Z`).getTime() / 1000);

    records.push({
      time: dateStr,
      timestamp: epochSec,
      open: isNaN(open) ? close : open,
      high: isNaN(high) ? Math.max(open || close, close) : high,
      low: isNaN(low) ? Math.min(open || close, close) : low,
      close: close,
      value: close,
      volume: isNaN(parseFloat(cols[volumeIdx])) ? 0 : parseFloat(cols[volumeIdx]),
      turnover: 0
    });
  }

  records.sort((a, b) => a.timestamp - b.timestamp);
  return records;
}

// Real NEPSE index history (1997 → Dec 2025) from Bibek773/nepse_historical_data.
const INDEX_FILE_URLS = {
  NEPSE: 'https://raw.githubusercontent.com/Bibek773/nepse_historical_data/main/data/index/NEPSE_2025_12_24_.csv',
  SENSITIVE: 'https://raw.githubusercontent.com/Bibek773/nepse_historical_data/main/data/index/SENSITIVE_2025_12_24_.csv',
  FLOAT: 'https://raw.githubusercontent.com/Bibek773/nepse_historical_data/main/data/index/FLOAT_2025_12_24_.csv',
  SENFLOAT: 'https://raw.githubusercontent.com/Bibek773/nepse_historical_data/main/data/index/SENFLOAT_2025_12_24_.csv'
};

// Current NEPSE index daily closes (2003 → today) from nepsedata.com.
// This bridges the gap after the Bibek773 dataset ends so recent chart ranges
// (1D/1W/1M) always have real index values instead of empty data.
const NEPSE_DAILY_URL = 'https://nepsedata.com/api/compare_history.php?type=index&symbol=NEPSE';
const NEPSE_DAILY_CACHE = path.join(CACHE_DIR, 'NEPSE_DAILY.json');
const NEPSE_DAILY_TTL_MS = 12 * 60 * 60 * 1000; // 12 hours

function parseNepseDailyCloses(json) {
  const data = (json && Array.isArray(json.data)) ? json.data : [];
  const records = [];
  for (const r of data) {
    const dateStr = r && r.date;
    const close = parseFloat(r && r.value);
    if (!dateStr || !/^\d{4}-\d{2}-\d{2}$/.test(dateStr) || isNaN(close)) continue;
    const epochSec = Math.floor(new Date(`${dateStr}T00:00:00Z`).getTime() / 1000);
    records.push({
      time: dateStr,
      timestamp: epochSec,
      open: close,
      high: close,
      low: close,
      close: close,
      value: close,
      volume: 0,
      turnover: 0
    });
  }
  records.sort((a, b) => a.timestamp - b.timestamp);
  return records;
}

async function fetchNepseDailyCloses() {
  ensureDirs();
  if (fs.existsSync(NEPSE_DAILY_CACHE)) {
    try {
      const stats = fs.statSync(NEPSE_DAILY_CACHE);
      if ((Date.now() - stats.mtimeMs) < NEPSE_DAILY_TTL_MS) {
        const cached = JSON.parse(fs.readFileSync(NEPSE_DAILY_CACHE, 'utf8'));
        if (Array.isArray(cached) && cached.length) return cached;
      }
    } catch (e) {
      console.warn('[IndexHistory] nepsedata cache read error:', e.message);
    }
  }
  try {
    const response = await fetch(NEPSE_DAILY_URL, {
      headers: { 'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) FinanceTracker/1.0' }
    });
    if (!response.ok) throw new Error(`HTTP ${response.status} when fetching NEPSE daily index`);
    const records = parseNepseDailyCloses(await response.json());
    if (records.length > 0) {
      fs.writeFileSync(NEPSE_DAILY_CACHE, JSON.stringify(records), 'utf8');
      console.log(`[IndexHistory] Cached ${records.length} NEPSE daily closes (${records[0].time} → ${records[records.length - 1].time})`);
    }
    return records;
  } catch (err) {
    console.warn('[IndexHistory] nepsedata live fetch error:', err.message);
    try {
      if (fs.existsSync(NEPSE_DAILY_CACHE)) {
        return JSON.parse(fs.readFileSync(NEPSE_DAILY_CACHE, 'utf8'));
      }
    } catch (e) { /* ignore */ }
    return [];
  }
}

/**
 * Fetches real daily index history for main NEPSE indices
 * (NEPSE, Sensitive, Float, Sensitive Float). Cached the same way as company data.
 * The NEPSE index is additionally merged with current daily closes from
 * nepsedata.com so recent ranges always have real data.
 */
async function fetchIndexHistory(indexKey, fromSec = null, toSec = null) {
  const cleanKey = indexKey.toUpperCase().trim();
  const url = INDEX_FILE_URLS[cleanKey];
  if (!url) return [];

  ensureDirs();
  const cacheFile = path.join(CACHE_DIR, `INDEX_${cleanKey}.json`);
  const csvBackupFile = path.join(CSV_BACKUP_DIR, `INDEX_${cleanKey}.csv`);
  let records = null;

  if (fs.existsSync(cacheFile)) {
    try {
      const stats = fs.statSync(cacheFile);
      const isFresh = (Date.now() - stats.mtimeMs) < CACHE_TTL_MS;
      if (isFresh) {
        records = JSON.parse(fs.readFileSync(cacheFile, 'utf8'));
      }
    } catch (e) {
      console.warn(`[IndexHistory] Cache read error for ${cleanKey}:`, e.message);
    }
  }

  if (!records) {
    try {
      const response = await fetch(url, {
        headers: {
          'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) FinanceTracker/1.0'
        }
      });

      if (!response.ok) {
        throw new Error(`HTTP ${response.status} when fetching index ${cleanKey}`);
      }

      const csvText = await response.text();
      records = parseIndexCsv(csvText);

      if (records.length > 0) {
        fs.writeFileSync(csvBackupFile, csvText, 'utf8');
        fs.writeFileSync(cacheFile, JSON.stringify(records), 'utf8');
        console.log(`[IndexHistory] Cached ${records.length} records for ${cleanKey} index`);
      }
    } catch (err) {
      console.warn(`[IndexHistory] Live fetch error for ${cleanKey}:`, err.message);

      if (fs.existsSync(csvBackupFile)) {
        try {
          records = parseIndexCsv(fs.readFileSync(csvBackupFile, 'utf8'));
          console.log(`[IndexHistory] Loaded ${records.length} records from CSV backup for ${cleanKey}`);
        } catch (e) {
          records = null;
        }
      }

      if (!records && fs.existsSync(cacheFile)) {
        try {
          records = JSON.parse(fs.readFileSync(cacheFile, 'utf8'));
        } catch (e) {
          records = [];
        }
      }

      if (!records) records = [];
    }
  }

  // Merge the NEPSE index with current daily closes so the series runs to today.
  if (cleanKey === 'NEPSE') {
    const daily = await fetchNepseDailyCloses();
    if (daily.length > 0) {
      const byDate = new Map(records.map(r => [r.time, r]));
      let added = 0;
      for (const r of daily) {
        if (!byDate.has(r.time)) {
          byDate.set(r.time, r);
          added++;
        }
      }
      if (added > 0) {
        records = [...byDate.values()].sort((a, b) => a.timestamp - b.timestamp);
        try {
          fs.writeFileSync(cacheFile, JSON.stringify(records), 'utf8');
        } catch (e) {
          console.warn('[IndexHistory] Failed to persist merged NEPSE index cache:', e.message);
        }
        console.log(`[IndexHistory] Merged ${added} recent NEPSE closes (now ${records.length} records)`);
      }
    }
  }

  let result = records;
  if (fromSec || toSec) {
    result = records.filter(r => {
      if (fromSec && r.timestamp < fromSec) return false;
      if (toSec && r.timestamp > toSec) return false;
      return true;
    });
  }

  return result;
}

module.exports = {
  fetchCompanyHistory,
  parseCsvPrices,
  fetchIndexHistory,
  parseIndexCsv,
  fetchNepseDailyCloses,
  parseNepseDailyCloses
};
