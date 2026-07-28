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

module.exports = {
  fetchCompanyHistory,
  parseCsvPrices
};
