import os
import json
import time
import asyncio
import re
import urllib.request
import urllib.parse
from urllib.error import URLError, HTTPError
from datetime import datetime, timezone
import xml.etree.ElementTree as ET
import pandas as pd
import numpy as np
try:
    from bs4 import BeautifulSoup
    import requests
    HAS_BS4 = True
except ImportError:
    HAS_BS4 = False
try:
    from nepse import AsyncNepse
    HAS_NEPSE_LIB = True
except ImportError:
    HAS_NEPSE_LIB = False

BASE_DIR = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
RAW_PRICES_DIR = os.path.join(BASE_DIR, "data", "raw", "prices")
RAW_FUNDAMENTALS_DIR = os.path.join(BASE_DIR, "data", "raw", "fundamentals")
RAW_NEWS_DIR = os.path.join(BASE_DIR, "data", "raw", "news")
RAW_REPORTS_DIR = os.path.join(BASE_DIR, "data", "raw", "reports")

PROCESSED_INDICATORS_DIR = os.path.join(BASE_DIR, "data", "processed", "indicators")
PROCESSED_FEATURES_DIR = os.path.join(BASE_DIR, "data", "processed", "features")
PROCESSED_SENTIMENT_DIR = os.path.join(BASE_DIR, "data", "processed", "sentiment")

def ensure_directories():
    for d in [
        RAW_PRICES_DIR, RAW_FUNDAMENTALS_DIR, RAW_NEWS_DIR, RAW_REPORTS_DIR,
        PROCESSED_INDICATORS_DIR, PROCESSED_FEATURES_DIR, PROCESSED_SENTIMENT_DIR
    ]:
        os.makedirs(d, exist_ok=True)

PRICE_HISTORY_URL = "https://cdn.jsdelivr.net/gh/PrabeshAsm/Nepse-All-Scraper@main/data/price_history.csv"
FALLBACK_PRICE_HISTORY = "https://cdn.jsdelivr.net/gh/SamirWagle/Nepse-All-Scraper@main/data/price_history.csv"

COMPANY_META_FILE = os.path.join(RAW_PRICES_DIR, "company_meta.json")

# Deprecated hardcoded table. Real fundamentals now come from MeroLagani
# (see fetch_merolagani_fundamentals) and are cached on disk. Kept only so old
# imports of FUNDAMENTAL_DB still resolve.
FUNDAMENTAL_DB = {}

def relative_time(pub_date):
    """Convert a news/pubDate string into a human 'X ago' relative time."""
    if not pub_date:
        return "unknown"
    s = str(pub_date).strip()
    lower = s.lower()
    if any(w in lower for w in ["ago", "today", "yesterday", "just now"]):
        return s

    dt = None
    try:
        from email.utils import parsedate_to_datetime
        dt = parsedate_to_datetime(s)
    except Exception:
        dt = None
    if dt is None:
        for fmt in ("%Y-%m-%d %H:%M:%S", "%Y-%m-%d %H:%M", "%Y-%m-%d",
                    "%b %d, %Y", "%d %b %Y", "%B %d, %Y", "%d/%m/%Y"):
            try:
                dt = datetime.strptime(s, fmt)
                break
            except ValueError:
                continue
    if dt is None:
        return s
    if dt.tzinfo is None:
        dt = dt.replace(tzinfo=timezone.utc)

    diff = datetime.now(timezone.utc) - dt
    seconds = int(diff.total_seconds())
    if seconds < 0:
        return s
    if seconds < 60:
        return "just now"
    minutes = seconds // 60
    if minutes < 60:
        return f"{minutes}m ago"
    hours = minutes // 60
    if hours < 24:
        return f"{hours}h ago"
    days = hours // 24
    if days < 7:
        return f"{days}d ago"
    weeks = days // 7
    if weeks < 5:
        return f"{weeks}w ago"
    months = days // 30
    if months < 12:
        return f"{months}mo ago"
    return f"{days // 365}y ago"

def refresh_company_meta_from_nepse():
    """Fetches the real company list (symbol -> name, sector) from NEPSE and caches it on disk."""
    if not HAS_NEPSE_LIB:
        return {}
    try:
        async def _fetch():
            nepse = AsyncNepse()
            nepse.setTLSVerification(False)
            companies = await nepse.getCompanyList()
            meta = {}
            for c in companies or []:
                sym = (c.get('symbol') or '').strip().upper()
                if not sym:
                    continue
                meta[sym] = {
                    "name": c.get('companyName') or c.get('securityName') or sym,
                    "sector": c.get('sectorName') or "Equity"
                }
            return meta

        meta = asyncio.run(_fetch())
        if meta:
            os.makedirs(RAW_PRICES_DIR, exist_ok=True)
            with open(COMPANY_META_FILE, 'w', encoding='utf-8') as f:
                json.dump(meta, f)
            print(f"[Data Ingestion] Cached {len(meta)} real company metadata entries.")
        return meta
    except Exception as e:
        print(f"[Data Ingestion Warning] Failed to fetch company metadata from NEPSE: {e}.")
        return {}


def get_company_meta_map():
    """Returns {symbol: {name, sector}} from a disk cache, refreshing it if stale."""
    if os.path.exists(COMPANY_META_FILE) and (time.time() - os.path.getmtime(COMPANY_META_FILE) < 7 * 86400):
        try:
            with open(COMPANY_META_FILE, 'r', encoding='utf-8') as f:
                return json.load(f)
        except Exception:
            pass
    return refresh_company_meta_from_nepse()


def refresh_price_history_from_nepse():
    """
    Builds the combined price-history CSV directly from the real NEPSE API.
    For every active equity company it pulls one year of daily OHLCV history
    concurrently via getCompanyPriceVolumeHistory and writes price_history.csv.
    Returns the DataFrame, or None if the refresh failed.
    """
    if not HAS_NEPSE_LIB:
        return None
    raw_path = os.path.join(RAW_PRICES_DIR, "price_history.csv")
    try:
        async def _build():
            nepse = AsyncNepse()
            nepse.setTLSVerification(False)
            companies = await nepse.getCompanyList()

            symbols = []
            meta = {}
            for c in companies or []:
                inst = str(c.get('instrumentType') or '').lower()
                status = str(c.get('status') or c.get('activeStatus') or '').upper()
                sym = (c.get('symbol') or '').strip().upper()
                if not sym or inst != 'equity' or status != 'A':
                    continue
                symbols.append(sym)
                meta[sym] = {
                    "name": c.get('companyName') or c.get('securityName') or sym,
                    "sector": c.get('sectorName') or "Equity"
                }

            sem = asyncio.Semaphore(10)

            async def fetch_one(sym):
                async with sem:
                    try:
                        data = await nepse.getCompanyPriceVolumeHistory(sym)
                        return sym, data
                    except Exception as e:
                        print(f"[Data Ingestion Warning] No history for {sym}: {e}")
                        return sym, []

            results = await asyncio.gather(*(fetch_one(s) for s in symbols))
            return symbols, meta, results

        symbols, meta, results = asyncio.run(_build())
        if not results:
            return None

        rows = []
        for sym, hist in results:
            if not hist:
                continue
            prev_close = None
            for rec in sorted(hist, key=lambda r: r.get('businessDate') or ''):
                close = rec.get('closePrice')
                if close is None:
                    continue
                close = float(close)
                open_p = float(prev_close) if prev_close is not None else close
                high = float(rec.get('highPrice') or open_p)
                low = float(rec.get('lowPrice') or open_p)
                high = max(high, open_p, close)
                low = min(low, open_p, close)
                rows.append({
                    "symbol": sym,
                    "date": str(rec.get('businessDate'))[:10],
                    "open": round(open_p, 2),
                    "high": round(high, 2),
                    "low": round(low, 2),
                    "close": round(close, 2),
                    "volume": int(rec.get('totalTradedQuantity') or 0),
                    "turnover": round(float(rec.get('totalTradedValue') or 0), 2)
                })
                prev_close = close

        if not rows:
            return None

        df = pd.DataFrame(rows).sort_values(['symbol', 'date']).reset_index(drop=True)
        os.makedirs(RAW_PRICES_DIR, exist_ok=True)
        tmp = raw_path + ".tmp"
        df.to_csv(tmp, index=False)
        os.replace(tmp, raw_path)

        if meta:
            tmp_meta = COMPANY_META_FILE + ".tmp"
            with open(tmp_meta, 'w', encoding='utf-8') as f:
                json.dump(meta, f)
            os.replace(tmp_meta, COMPANY_META_FILE)

        print(f"[Data Ingestion] Built real NEPSE price history: {len(df)} rows, {len(df['symbol'].unique())} symbols.")
        return df
    except Exception as e:
        print(f"[Data Ingestion Warning] NEPSE price-history refresh failed: {e}.")
        return None


def _build_symbol_rows(symbol, hist):
    """Converts raw NEPSE history records into our CSV row format."""
    rows = []
    prev_close = None
    for rec in sorted(hist, key=lambda r: r.get('businessDate') or ''):
        close = rec.get('closePrice')
        if close is None:
            continue
        close = float(close)
        open_p = float(prev_close) if prev_close is not None else close
        high = max(float(rec.get('highPrice') or open_p), open_p, close)
        low = min(float(rec.get('lowPrice') or open_p), open_p, close)
        rows.append({
            "symbol": symbol,
            "date": str(rec.get('businessDate'))[:10],
            "open": round(open_p, 2),
            "high": round(high, 2),
            "low": round(low, 2),
            "close": round(close, 2),
            "volume": int(rec.get('totalTradedQuantity') or 0),
            "turnover": round(float(rec.get('totalTradedValue') or 0), 2)
        })
        prev_close = close
    return rows


def fetch_symbol_history(symbol):
    """Fetches one symbol's full OHLCV history directly from the NEPSE API."""
    if not HAS_NEPSE_LIB:
        return None
    clean_sym = symbol.upper().strip()
    try:
        async def _fetch():
            nepse = AsyncNepse()
            nepse.setTLSVerification(False)
            return await nepse.getCompanyPriceVolumeHistory(clean_sym)
        hist = asyncio.run(_fetch())
    except Exception as e:
        print(f"[Data Ingestion Warning] History fetch failed for {clean_sym}: {e}")
        return None
    if not hist:
        return None
    rows = _build_symbol_rows(clean_sym, hist)
    if len(rows) < 5:
        return None
    return pd.DataFrame(rows)


def get_symbol_ohlcv(symbol):
    """
    Returns one symbol's OHLCV as a DataFrame.
    Tries the live NEPSE API first (freshest, through the last trading day) and
    falls back to the bundled price-history CSV when the API is unreachable.
    """
    df = fetch_symbol_history(symbol)
    if df is not None and len(df):
        return df
    raw = fetch_price_history_csv()
    if 'symbol' in raw.columns:
        sub = raw[raw['symbol'].str.upper() == symbol.upper().strip()]
        return sub.sort_values('date').reset_index(drop=True)
    return raw.head(0)


def background_refresh():
    """Refreshes the full price CSV and the MeroLagani fundamentals cache."""
    raw_path = os.path.join(RAW_PRICES_DIR, "price_history.csv")
    df = None
    if os.path.exists(raw_path) and (time.time() - os.path.getmtime(raw_path)) < 12 * 3600:
        try:
            df = pd.read_csv(raw_path)
        except Exception:
            df = None
    if df is None or len(df) == 0:
        df = refresh_price_history_from_nepse()
    symbols = []
    if df is not None and len(df) and 'symbol' in df.columns:
        symbols = list(dict.fromkeys(df['symbol'].str.upper()))
    if symbols:
        refresh_merolagani_cache_for_all(symbols)


def fetch_price_history_csv():
    ensure_directories()
    raw_path = os.path.join(RAW_PRICES_DIR, "price_history.csv")

    # A local copy exists: use it as-is. Freshness is handled by the background
    # refresh job (never block a request on a multi-minute full rebuild).
    if os.path.exists(raw_path):
        df = pd.read_csv(raw_path)
        df.columns = [c.lower().strip() for c in df.columns]
        for col in ['open', 'high', 'low', 'close', 'volume']:
            if col in df.columns:
                df[col] = pd.to_numeric(df[col], errors='coerce').fillna(0)
        return df

    # No local copy: build from the real NEPSE API, then community CDN mirrors.
    df = refresh_price_history_from_nepse()
    if df is not None and len(df) > 0:
        return df

    for url in [PRICE_HISTORY_URL, FALLBACK_PRICE_HISTORY]:
        try:
            print(f"[Data Ingestion] Fetching historical prices from {url}...")
            req = urllib.request.Request(url, headers={'User-Agent': 'Mozilla/5.0'})
            with urllib.request.urlopen(req, timeout=10) as resp, open(raw_path, 'wb') as f:
                f.write(resp.read())
            print("[Data Ingestion] Successfully saved price history CSV.")
            break
        except Exception as e:
            print(f"[Data Ingestion Warning] Failed to fetch remote CSV {url}: {e}.")

    if not os.path.exists(raw_path):
        print("[Data Ingestion] No price history CSV available. Will attempt to collect data from live sources.")
        return pd.DataFrame(columns=['symbol', 'date', 'open', 'high', 'low', 'close', 'volume', 'turnover'])

    df = pd.read_csv(raw_path)
    df.columns = [c.lower().strip() for c in df.columns]
    for col in ['open', 'high', 'low', 'close', 'volume']:
        if col in df.columns:
            df[col] = pd.to_numeric(df[col], errors='coerce').fillna(0)
    return df

def fetch_sharesansar_news(symbol):
    """Scrapes latest news using BeautifulSoup similar to nepse-news-scraper"""
    if not HAS_BS4:
        raise ImportError("BeautifulSoup is required for this scraper.")
    
    url = f"https://www.sharesansar.com/company/{symbol}"
    headers = {'User-Agent': 'Mozilla/5.0'}
    resp = requests.get(url, headers=headers, timeout=10)
    resp.raise_for_status()
    
    soup = BeautifulSoup(resp.text, 'html.parser')
    news_items = []
    
    # Try to find the news tab or related news
    news_div = soup.find('div', id='myTabContent')
    if not news_div:
        # Fallback to general latest news if company page doesn't work
        url = "https://www.sharesansar.com/category/latest"
        resp = requests.get(url, headers=headers, timeout=10)
        soup = BeautifulSoup(resp.text, 'html.parser')
        articles = soup.select('.featured-news-list .item')
    else:
        articles = news_div.select('.newslist, .item')
        
    for item in articles[:6]:
        title_tag = item.find('a')
        if not title_tag: continue
        title = title_tag.text.strip()
        link = title_tag.get('href', '')
        
        date_tag = item.find('span', class_='text-org')
        pubDate = date_tag.text.strip() if date_tag else time.strftime("%Y-%m-%d")
        
        pos_words = ['rise', 'gain', 'profit', 'growth', 'bull', 'upward', 'high', 'dividend', 'bonus']
        neg_words = ['fall', 'drop', 'loss', 'bear', 'decline', 'down', 'low', 'risk', 'crisis']
        lower_title = title.lower()
        
        score = sum(0.25 for w in pos_words if w in lower_title) - sum(0.25 for w in neg_words if w in lower_title)
        score = max(-1.0, min(1.0, score))
        sentiment_label = "BULLISH" if score > 0.1 else ("BEARISH" if score < -0.1 else "NEUTRAL")
        
        news_items.append({
            'title': title,
            'pubDate': pubDate,
            'url': link,
            'sentimentScore': round(score, 2),
            'sentimentLabel': sentiment_label,
            'symbol': symbol
        })
        
    return news_items

def fetch_news_for_symbol(symbol="NEPSE"):
    ensure_directories()
    clean_sym = symbol.upper().strip()
    
    news_items = []
    # 1. Try ShareSansar Scraper first
    try:
        news_items = fetch_sharesansar_news(clean_sym)
    except Exception as e:
        print(f"[News Scraper Warning] ShareSansar fetch failed: {e}")
        
    # 2. Fallback to Google RSS (reliable backup)
    if not news_items:
        try:
            query = f"NEPSE {clean_sym}" if clean_sym != "NEPSE" else "NEPSE Share Market"
            encoded = urllib.parse.quote(query)
            url = f"https://news.google.com/rss/search?q={encoded}&hl=en-NP&gl=NP&ceid=NP:en"
            
            req = urllib.request.Request(url, headers={'User-Agent': 'Mozilla/5.0'})
            with urllib.request.urlopen(req, timeout=5) as resp:
                content = resp.read()
                root = ET.fromstring(content)
                for item in root.findall('.//item')[:6]:
                    title = item.find('title').text if item.find('title') is not None else ""
                    pubDate = item.find('pubDate').text if item.find('pubDate') is not None else ""
                    link = item.find('link').text if item.find('link') is not None else ""
                    
                    lower_title = title.lower()
                    pos_words = ['rise', 'gain', 'profit', 'growth', 'bull', 'upward', 'high', 'dividend', 'bonus']
                    neg_words = ['fall', 'drop', 'loss', 'bear', 'decline', 'down', 'low', 'risk', 'crisis']
                    
                    score = sum(0.25 for w in pos_words if w in lower_title) - sum(0.25 for w in neg_words if w in lower_title)
                    score = max(-1.0, min(1.0, score))
                    
                    sentiment_label = "BULLISH" if score > 0.1 else ("BEARISH" if score < -0.1 else "NEUTRAL")
                    
                    news_items.append({
                        'title': title,
                        'pubDate': pubDate,
                        'url': link,
                        'sentimentScore': round(score, 2),
                        'sentimentLabel': sentiment_label,
                        'symbol': clean_sym
                    })
        except Exception as e:
            print(f"[News Scraper Warning] RSS fetch for {symbol} failed: {e}")
            
    if not news_items:
        news_items = [
            {
                'title': f"No recent news available for {clean_sym}",
                'pubDate': time.strftime("%a, %d %b %Y %H:%M:%S GMT"),
                'url': "",
                'sentimentScore': 0.0,
                'sentimentLabel': "NEUTRAL",
                'symbol': clean_sym,
                'unavailable': True
            }
        ]
        
    raw_news_file = os.path.join(RAW_NEWS_DIR, f"{clean_sym}_news.json")
    with open(raw_news_file, 'w', encoding='utf-8') as f:
        json.dump(news_items, f, indent=2)
        
    return news_items

def fetch_sharesansar_fundamentals(symbol):
    if not HAS_BS4:
        raise ImportError("BeautifulSoup is required for this scraper.")
    
    url = f"https://www.sharesansar.com/company/{symbol}"
    headers = {'User-Agent': 'Mozilla/5.0'}
    resp = requests.get(url, headers=headers, timeout=10)
    resp.raise_for_status()
    soup = BeautifulSoup(resp.text, 'html.parser')
    
    # Extract fundamentals from table
    fundamentals = {}
    tables = soup.find_all('table', class_='table')
    for table in tables:
        rows = table.find_all('tr')
        for row in rows:
            th = row.find('th')
            td = row.find('td')
            if th and td:
                key = th.text.strip().lower()
                val = td.text.strip().replace(',', '')
                if 'eps' in key:
                    try: fundamentals['eps'] = float(val)
                    except: pass
                elif 'p/e ratio' in key:
                    try: fundamentals['peRatio'] = float(val)
                    except: pass
                elif 'book value' in key:
                    try: fundamentals['bookValue'] = float(val)
                    except: pass
                elif 'dividend' in key and 'yield' in key:
                    try: fundamentals['dividendYield'] = float(val.replace('%', ''))
                    except: pass
                elif 'market cap' in key:
                    try: fundamentals['marketCap'] = float(val)
                    except: pass
    
    if fundamentals:
        return fundamentals
    return None

MEROLAGANI_CACHE_FILE = os.path.join(RAW_FUNDAMENTALS_DIR, "merolagani_cache.json")
MEROLAGANI_CACHE_TTL_SECONDS = 12 * 3600  # fundamentals move quarterly; prices daily

def _load_merolagani_cache():
    try:
        if os.path.exists(MEROLAGANI_CACHE_FILE):
            with open(MEROLAGANI_CACHE_FILE, 'r', encoding='utf-8') as f:
                return json.load(f)
    except Exception as e:
        print(f"[Fundamentals Warning] Failed to load MeroLagani cache: {e}")
    return {}

def _save_merolagani_cache(cache):
    try:
        os.makedirs(RAW_FUNDAMENTALS_DIR, exist_ok=True)
        tmp = MEROLAGANI_CACHE_FILE + ".tmp"
        with open(tmp, 'w', encoding='utf-8') as f:
            json.dump(cache, f)
        os.replace(tmp, MEROLAGANI_CACHE_FILE)
    except Exception as e:
        print(f"[Fundamentals Warning] Failed to save MeroLagani cache: {e}")

def _parse_merolagani_amount(text):
    """Parses '28.36(FY:082-083, Q:4)' -> 28.36 and handles commas/percent signs."""
    if not text:
        return None
    s = str(text).strip().replace(',', '').replace('%', '').replace('Rs.', '').strip()
    m = re.match(r'[-+]?\d+(\.\d+)?', s)
    if not m:
        return None
    try:
        return float(m.group(0))
    except ValueError:
        return None

def fetch_merolagani_fundamentals(symbol):
    """Scrapes real fundamentals from MeroLagani's company page."""
    if not HAS_BS4:
        return None
    clean_sym = symbol.upper().strip()
    url = f"https://merolagani.com/CompanyDetail.aspx?symbol={clean_sym}"
    headers = {'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) Chrome/126 Safari/537.36'}
    try:
        resp = requests.get(url, headers=headers, timeout=15)
        resp.raise_for_status()
        soup = BeautifulSoup(resp.text, 'html.parser')
    except Exception as e:
        print(f"[Fundamentals Warning] MeroLagani fetch failed for {clean_sym}: {e}")
        return None

    vals = {}
    for tr in soup.find_all('tr'):
        th = tr.find('th')
        td = tr.find('td')
        if not th or not td:
            continue
        label = th.get_text(strip=True)
        val = td.get_text(strip=True)
        if label == 'EPS':
            vals['eps'] = _parse_merolagani_amount(val)
        elif label == 'P/E Ratio':
            vals['peRatio'] = _parse_merolagani_amount(val)
        elif label == 'Book Value':
            vals['bookValue'] = _parse_merolagani_amount(val)
        elif label == 'PBV':
            vals['pbRatio'] = _parse_merolagani_amount(val)
        elif label == 'Market Price':
            vals['price'] = _parse_merolagani_amount(val)
        elif label == 'Market Capitalization':
            vals['marketCap'] = _parse_merolagani_amount(val)
        elif label == 'Shares Outstanding':
            vals['sharesOutstanding'] = _parse_merolagani_amount(val)
        elif label == '% Dividend':
            vals['dividendPct'] = _parse_merolagani_amount(val)
        elif label == 'Sector':
            vals['sector'] = val
        elif label == 'Company Name':
            vals['name'] = val

    if not vals.get('eps') and not vals.get('peRatio'):
        return None

    price = vals.get('price') or 0.0
    book_value = vals.get('bookValue') or 0.0
    if vals.get('eps') and book_value:
        vals['roe'] = round((vals['eps'] / book_value) * 100.0, 2)
    if vals.get('dividendPct') is not None and price:
        vals['dividendYield'] = round((vals['dividendPct'] / price) * 100.0, 2)
    return vals

def refresh_merolagani_cache_for_all(symbols, workers=6):
    """Scrapes real fundamentals for many symbols and persists the disk cache."""
    from concurrent.futures import ThreadPoolExecutor, as_completed
    cache = _load_merolagani_cache()
    now = time.time()
    todo = [s for s in symbols
            if not (cache.get(s) and (now - cache.get(s, {}).get('_fetchedAt', 0)) < MEROLAGANI_CACHE_TTL_SECONDS)]
    if not todo:
        return len(cache)
    done = 0
    with ThreadPoolExecutor(max_workers=workers) as ex:
        futs = {ex.submit(fetch_merolagani_fundamentals, s): s for s in todo}
        for fut in as_completed(futs):
            sym = futs[fut]
            try:
                vals = fut.result()
                if vals:
                    vals['_fetchedAt'] = time.time()
                    cache[sym] = vals
                    done += 1
            except Exception:
                pass
            if done and done % 25 == 0:
                _save_merolagani_cache(cache)
    _save_merolagani_cache(cache)
    print(f"[Fundamentals] Cached real MeroLagani data for {len(cache)} symbols ({done} new this run).")
    return len(cache)

def get_company_fundamentals(symbol, use_cache_only=False):
    clean_sym = symbol.upper().strip()
    meta = get_company_meta_map().get(clean_sym, {})

    base = {
        "name": meta.get('name') or clean_sym,
        "sector": meta.get('sector') or "Equity",
        "marketCap": None,
        "peRatio": None,
        "pbRatio": None,
        "eps": None,
        "dividendYield": None,
        "roe": None,
        "bookValue": None,
        "sharesOutstanding": None,
        "dataSource": "unknown",
        "lastUpdated": None
    }

    cache = _load_merolagani_cache()
    entry = cache.get(clean_sym) or {}
    fresh = bool(entry) and (time.time() - entry.get('_fetchedAt', 0)) < MEROLAGANI_CACHE_TTL_SECONDS

    if not use_cache_only and not fresh:
        scraped = fetch_merolagani_fundamentals(clean_sym)
        if scraped:
            entry = dict(scraped)
            entry['_fetchedAt'] = time.time()
            cache[clean_sym] = entry
            _save_merolagani_cache(cache)

    if entry:
        merged = dict(base)
        for k, v in entry.items():
            if not k.startswith('_') and v is not None:
                merged[k] = v
        merged['dataSource'] = 'merolagani'
        merged['lastUpdated'] = datetime.fromtimestamp(
            entry.get('_fetchedAt', time.time()), tz=timezone.utc).isoformat()
        return merged

    return base

if __name__ == "__main__":
    ensure_directories()
    df = fetch_price_history_csv()
    print(f"Data Collection ready. Total price history rows: {len(df)}")
    
    # Test scraping for a symbol
    print("Testing News Scraper...")
    news = fetch_news_for_symbol("NABIL")
    print(f"Got {len(news)} news items for NABIL.")
    
    print("Testing Fundamentals Scraper...")
    funds = get_company_fundamentals("NABIL")
    print(f"Fundamentals for NABIL: {funds.get('eps', 'N/A')} EPS")
