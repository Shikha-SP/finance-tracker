const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const { scoreTitleSentiment } = require('./sentiment');

const CACHE_FILE = path.join(__dirname, '../../data/news_cache.json');
const MEMORY_TTL_MS = 5 * 60 * 1000;   // don't re-hit the web within 5 min
const DISK_TTL_MS = 24 * 60 * 60 * 1000; // fall back to disk for up to a day
const FETCH_TIMEOUT_MS = 10000;
const MAX_ITEMS_PER_FEED = 15;
const MAX_TOTAL_ITEMS = 40;

// Free RSS sources (no API key) so the news feed stays alive forever.
// A feed failing never breaks the endpoint — it is skipped gracefully.
const FEEDS = [
  { id: 'googlenews',    name: 'NEPSE News',        url: 'https://news.google.com/rss/search?q=nepse%20stock%20market&hl=en-NP&gl=NP&ceid=NP:en', category: 'Market', google: true },
  { id: 'onlinekhabar',  name: 'OnlineKhabar',     url: 'https://english.onlinekhabar.com/feed',    category: 'General' },
  { id: 'bizmandu',      name: 'Bizmandu',         url: 'https://bizmandu.com/feed',                category: 'Business' },
  { id: 'khabarhub',     name: 'KhabarHub',        url: 'https://www.khabarhub.com/feed',           category: 'General' },
];

let memoryCache = null; // { news, fetchedAt }

function decodeEntities(text) {
  if (!text) return '';
  return text
    .replace(/<!\[CDATA\[([\s\S]*?)\]\]>/g, '$1')
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&#0*39;/g, "'")
    .replace(/&#x27;/gi, "'")
    .replace(/&#8217;/g, "'")
    .replace(/&#8216;/g, "'")
    .replace(/&#8220;/g, '"')
    .replace(/&#8221;/g, '"')
    .replace(/&#8211;/g, '-')
    .replace(/&#8212;/g, '-')
    .replace(/&nbsp;/g, ' ')
    .replace(/&#(\d+);/g, (_, n) => { try { return String.fromCharCode(n); } catch { return ''; } });
}

function stripHtml(html) {
  if (!html) return '';
  return decodeEntities(html)
    .replace(/<script[\s\S]*?<\/script>/gi, ' ')
    .replace(/<style[\s\S]*?<\/style>/gi, ' ')
    .replace(/<[^>]+>/g, ' ')
    .replace(/&nbsp;/gi, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

function parseDate(value) {
  if (!value) return null;
  const ts = Date.parse(value.trim());
  return Number.isNaN(ts) ? null : new Date(ts).toISOString();
}

function normalizeKey(title) {
  return String(title || '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '')
    .slice(0, 80);
}

function parseFeedXml(xml, feed) {
  const items = [];
  const seen = new Set();

  // RSS 2.0 items
  const itemRe = /<item[\s>][\s\S]*?<\/item>/gi;
  let m;
  while ((m = itemRe.exec(xml)) !== null) {
    const block = m[0];
    const get = (tag) => {
      const re = new RegExp(`<${tag}(?:\\s[^>]*)?>([\\s\\S]*?)<\\/${tag}>`, 'i');
      const mm = block.match(re);
      return mm ? mm[1] : null;
    };

    const title = decodeEntities(get('title')).trim();
    let link = decodeEntities(get('link') || '').trim();
    const description = stripHtml(get('description'));
    const pubDate = parseDate(get('pubDate'));
    if (!title) continue;

    let image = null;
    const enc = block.match(/<enclosure[^>]*url=["']([^"']+)/i);
    if (enc) image = enc[1];
    const media = block.match(/<media:content[^>]*url=["']([^"']+)/i);
    if (!image && media) image = media[1];
    const thumb = block.match(/<media:thumbnail[^>]*url=["']([^"']+)/i);
    if (!image && thumb) image = thumb[1];

    // Resolve relative links
    if (link.startsWith('/')) {
      try { link = new URL(link, feed.url).href; } catch { /* keep raw */ }
    }

    // Google News bundles the outlet into the title: "Headline - The Source".
    let sourceName = feed.name;
    let cleanTitle = title;
    if (feed.google && title.includes(' - ')) {
      const idx = title.lastIndexOf(' - ');
      const src = title.slice(idx + 3).trim();
      if (src && !src.includes('Google News')) {
        sourceName = src;
        cleanTitle = title.slice(0, idx).trim();
      }
    }

    const key = normalizeKey(cleanTitle);
    if (seen.has(key)) continue;
    seen.add(key);

    items.push({
      title: cleanTitle,
      link,
      excerpt: description ? description.slice(0, 220) : '',
      image,
      publishedAt: pubDate,
      sourceId: feed.id,
      source: sourceName,
      category: feed.category,
      sentiment: scoreTitleSentiment(cleanTitle),
    });
    if (items.length >= MAX_ITEMS_PER_FEED) break;
  }

  if (items.length === 0) {
    // Atom fallback (some WordPress feeds expose <entry> blocks)
    const entryRe = /<entry[\s>][\s\S]*?<\/entry>/gi;
    while ((m = entryRe.exec(xml)) !== null) {
      const block = m[0];
      const get = (tag) => {
        const re = new RegExp(`<${tag}(?:\\s[^>]*)?>([\\s\\S]*?)<\\/${tag}>`, 'i');
        const mm = block.match(re);
        return mm ? mm[1] : null;
      };
      const title = decodeEntities(get('title')).trim();
      let link = decodeEntities(get('link') || '').trim();
      const desc = stripHtml(get('content') || get('summary'));
      const pubDate = parseDate(get('published') || get('updated'));
      if (!title) continue;

      // Atom <link href="..."/>
      const href = block.match(/<link[^>]*href=["']([^"']+)/i);
      if (!link && href) link = href[1];
      if (!link) continue;

      if (link.startsWith('/')) {
        try { link = new URL(link, feed.url).href; } catch { /* keep raw */ }
      }

      const key = normalizeKey(title);
      if (seen.has(key)) continue;
      seen.add(key);

      items.push({
        title,
        link,
        excerpt: desc ? desc.slice(0, 220) : '',
        image: null,
        publishedAt: pubDate,
        sourceId: feed.id,
        source: feed.name,
        category: feed.category,
        sentiment: scoreTitleSentiment(title),
      });
      if (items.length >= MAX_ITEMS_PER_FEED) break;
    }
  }

  return items;
}

async function fetchFeed(feed) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), FETCH_TIMEOUT_MS);
  try {
    const response = await fetch(feed.url, {
      signal: controller.signal,
      headers: { 'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) FinanceTracker/1.0' },
    });
    if (!response.ok) throw new Error(`HTTP ${response.status}`);
    const xml = await response.text();
    if (!xml || !/<(rss|feed|rdf)/i.test(xml)) throw new Error('Not a feed');
    return parseFeedXml(xml, feed);
  } finally {
    clearTimeout(timer);
  }
}

function loadDiskCache() {
  try {
    if (!fs.existsSync(CACHE_FILE)) return null;
    const stats = fs.statSync(CACHE_FILE);
    if (Date.now() - stats.mtimeMs > DISK_TTL_MS) return null;
    const data = JSON.parse(fs.readFileSync(CACHE_FILE, 'utf8'));
    if (Array.isArray(data.news)) return data;
  } catch (e) {
    console.warn('[NewsFetcher] Disk cache read failed:', e.message);
  }
  return null;
}

function saveDiskCache(news) {
  try {
    const dir = path.dirname(CACHE_FILE);
    if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
    fs.writeFileSync(CACHE_FILE, JSON.stringify({ news, savedAt: new Date().toISOString() }), 'utf8');
  } catch (e) {
    console.warn('[NewsFetcher] Disk cache write failed:', e.message);
  }
}

async function refreshNews() {
  const results = await Promise.allSettled(FEEDS.map(feed => fetchFeed(feed)));

  const byKey = new Map();
  FEEDS.forEach((feed, i) => {
    const r = results[i];
    if (r.status !== 'fulfilled') {
      console.warn(`[NewsFetcher] Feed "${feed.id}" failed:`, r.reason?.message || 'unknown error');
      return;
    }
    for (const item of r.value) {
      const key = normalizeKey(item.title);
      if (!byKey.has(key)) byKey.set(key, item);
    }
  });

  const news = [...byKey.values()]
    .sort((a, b) => (b.publishedAt || '') > (a.publishedAt || '') ? 1 : -1)
    .slice(0, MAX_TOTAL_ITEMS)
    .map((item, i) => ({
      id: crypto.createHash('sha1').update(item.sourceId + '|' + normalizeKey(item.title)).digest('hex').slice(0, 12),
      title: item.title,
      link: item.link,
      excerpt: item.excerpt,
      image: item.image,
      publishedAt: item.publishedAt,
      sourceId: item.sourceId,
      source: item.source,
      category: item.category,
      sentiment: typeof item.sentiment === 'number' ? item.sentiment : scoreTitleSentiment(item.title),
      order: i,
    }));

  saveDiskCache(news);
  memoryCache = { news, fetchedAt: Date.now() };
  return memoryCache;
}

async function getNews({ force = false } = {}) {
  if (memoryCache && !force) {
    const age = Date.now() - memoryCache.fetchedAt;
    if (age < MEMORY_TTL_MS) return memoryCache;
  }

  if (memoryCache && force) {
    try {
      return await refreshNews();
    } catch (e) {
      console.warn('[NewsFetcher] Forced refresh failed, serving stale:', e.message);
      return memoryCache;
    }
  }

  try {
    return await refreshNews();
  } catch (e) {
    console.warn('[NewsFetcher] Live refresh failed, serving disk cache:', e.message);
  }

  const disk = loadDiskCache();
  if (disk && Array.isArray(disk.news) && disk.news.length) {
    memoryCache = { news: disk.news, fetchedAt: Date.now() };
    return memoryCache;
  }

  return { news: [], fetchedAt: Date.now() };
}

// ── Per-symbol news search (Google News RSS, cached per query) ──────────────
const SEARCH_CACHE = new Map();
const SEARCH_TTL_MS = 15 * 60 * 1000; // don't hammer Google per stock

async function searchNews(query, { max = 10 } = {}) {
  const q = String(query || '').trim().toUpperCase();
  if (!q) return [];

  const cached = SEARCH_CACHE.get(q);
  if (cached && Date.now() - cached.fetchedAt < SEARCH_TTL_MS) {
    return cached.items.slice(0, max);
  }

  const feed = {
    id: 'googlenews',
    name: 'NEPSE News',
    url: `https://news.google.com/rss/search?q=${encodeURIComponent(`${q} NEPSE`)}&hl=en-NP&gl=NP&ceid=NP:en`,
    category: 'Market',
    google: true,
  };

  try {
    const items = await fetchFeed(feed);
    SEARCH_CACHE.set(q, { items, fetchedAt: Date.now() });
    return items.slice(0, max);
  } catch (e) {
    console.warn(`[NewsFetcher] Search "${q}" failed:`, e.message);
    if (cached) return cached.items.slice(0, max);
    return [];
  }
}

module.exports = { getNews, FEEDS, searchNews };

