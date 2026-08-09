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
        
        score = score_title_sentiment(title)
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
                    
                    score = score_title_sentiment(title)
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

# ── News sentiment cache layer ─────────────────────────────────────────────
# Sentiment is keyword/lexicon-based on news titles (no external ML API needed)
# and cached on disk per symbol so the screener can read it instantly for all
# 270+ scrips. A background refresh keeps caches reasonably fresh.

NEWS_CACHE_TTL_HOURS = 12          # how old a cached news file may be before refresh
NEWS_RECENT_MAX_DAYS = 45          # a stock counts as having "recent" news within this window

# ── Strong local sentiment lexicon (negation + intensity aware) ──────────────
# Not a toy word list: handles negation ("no loss", "not affected"), intensity
# modifiers ("record", "sharp"), exclamation, and Nepali finance terms. Scores
# stay in [-1, +1] and are overwritten by the LLM pass whenever a Groq key is
# configured (llm_score wins inside get_news_sentiment).

POS_WORDS = [
    'rise', 'rises', 'rising', 'gain', 'gains', 'gained', 'profit', 'profits', 'profitable',
    'growth', 'growing', 'bull', 'bullish', 'upward', 'surge', 'surges', 'soars', 'soar',
    'rally', 'rallies', 'boost', 'boosted', 'strong', 'stronger', 'beat', 'beats',
    'positive', 'rebound', 'rebounds', 'jump', 'jumps', 'soar', 'record', 'records',
    'improve', 'improves', 'improved', 'increase', 'increases', 'increased', 'upgrade',
    'upgrades', 'surpass', 'turnaround', 'recover', 'recovers', 'recovery', 'expansion',
    'outperform', 'approval', 'approved', 'approves', 'dividend', 'bonus', 'bonus share',
    'buyback', 'high', 'higher', 'highest', 'peak', 'milestone', 'strong demand',
    'gross profit', 'operating profit', 'net profit', 'profit rises', 'profit jumps',
    'earnings grow', 'earnings rise', 'exceeds', 'exceeded', 'exceed', 'solid',
    'excellent', 'breakthrough', 'nairam', 'nairamma', 'nafa', 'labh', 'daam', 'badhi'
]
NEG_WORDS = [
    'fall', 'falls', 'falling', 'drop', 'drops', 'dropped', 'loss', 'losses', 'losing',
    'bear', 'bearish', 'decline', 'declines', 'declining', 'down', 'lower', 'low',
    'risk', 'risky', 'crisis', 'plunge', 'plunges', 'slump', 'slumps', 'weaken',
    'weak', 'weaker', 'miss', 'misses', 'negative', 'debt', 'default', 'defaults',
    'sell', 'selling', 'reduce', 'reduces', 'reduced', 'cut', 'cuts', 'cutting',
    'worry', 'worries', 'crash', 'warning', 'warns', 'fraud', 'scam', 'penalty',
    'fine', 'penalized', 'decrease', 'decreases', 'decreased', 'downgrade', 'downgrades',
    'underperform', 'concern', 'concerns', 'suspension', 'suspended', 'halt', 'halts',
    'impairment', 'non-performing', 'bad debt', 'npl', 'npls', 'loss making',
    'loss-making', 'bankrupt', 'insolvency', 'liquidation', 'delisted', 'delisting',
    'probe', 'investigation', 'fired', 'resign', 'resignation', 'scandal', 'collapse',
    'collapsed', 'unrest', 'protest', 'strike', 'slowdown', 'slows', 'hike', 'hiked',
    'ghata', 'ghataa', 'risky', 'jala', 'bajaar', 'daru', 'sastaima', 'baahira'
]

INTENSIFY = {'record', 'huge', 'massive', 'sharp', 'strong', 'strongly', 'significant', 'significant', 'surge', 'soar', 'plunge', 'crash', 'plummet', 'rocket', 'stellar', 'exceptional', 'dramatic', 'heavy'}
DAMPEN = {'slight', 'slightly', 'mild', 'modest', 'minor', 'small', 'gradual'}

NEGATORS = ('no ', 'not ', 'never ', 'denies ', 'denied ', 'refuses ', 'failed to ', 'fails to ', 'unable to ', 'without ', 'less ', 'lower ')

def score_title_sentiment(title):
    """
    Strong transparent lexicon sentiment for a news headline, -1..+1.
    Handles negation (flips the sign), intensity adverbs (scales magnitude),
    exclamation marks and key phrase boosts.
    """
    if not title:
        return 0.0
    lower = (title or '').lower()
    score = 0.0
    seen = set()

    def add_hits(words, base, sign):
        nonlocal score
        for w in words:
            if w in seen:
                continue
            pattern = rf'\b{re.escape(w)}\b'
            for m in re.finditer(pattern, lower):
                seen.add(w)
                start = max(0, m.start() - 6)
                ctx = lower[start:m.end()]
                mult = 1.0
                for mod in INTENSIFY:
                    if re.search(rf'\b{mod}\b', ctx) or mod in ctx:
                        mult = 1.5
                        break
                for mod in DAMPEN:
                    if re.search(rf'\b{mod}\b', ctx):
                        mult = 0.5
                        break
                negated = any(n in ctx for n in NEGATORS)
                sign_eff = -sign if negated else sign
                score += base * mult * sign_eff
                break  # count each word once

    add_hits(POS_WORDS, 0.22, +1.0)
    add_hits(NEG_WORDS, 0.22, -1.0)

    # Phrase boosts that the word lists alone may mis-score
    pos_phrases = ['reports profit', 'reported profit', 'profit rises', 'profit jumps',
                   'profit grows', 'earnings rise', 'exceeds expectation', 'exceeds expectations',
                   'above expectation', 'dividend approved', 'bonus approved', 'record profit',
                   'positive outlook', 'outperform expectation', 'turnaround profit',
                   'approves dividend', 'approves bonus', 'strong earnings', 'naira profit',
                   'boosted by', 'surges on', 'no loss', 'no decline', 'not affected',
                   'no impact', 'no losses', 'profit making', 'in profit']
    neg_phrases = ['loss widens', 'net loss', 'profit warning', 'earnings miss',
                   'misses estimates', 'below expectation', 'below expectations',
                   'default risk', 'risk of default', 'fraud investigation',
                   'suspension of trading', 'rights issue', 'rights share',
                   'more losses', 'deeper losses', 'shares slump']
    for p in pos_phrases:
        if p in lower:
            score += 0.3
    for p in neg_phrases:
        if p in lower:
            score -= 0.35

    # Exclamation / strong tone
    if '!' in title:
        score += 0.1 if score >= 0 else -0.1

    score = round(max(-1.0, min(1.0, score)), 2)
    if score == 0.0:
        # still label pure-noise titles as neutral explicitly
        return 0.0
    return score

# ── Strong LLM sentiment classifier (Groq) ───────────────────────────────────
# A lexicon on headlines is weak. When GROQ_API_KEY is set we run a real LLM
# over each symbol's headlines to get calibrated -1..1 scores, labels and key
# words. Results are cached per article (llmScore / llmLabel / llmKeywords /
# llmProcessed) so the screener reads strong scores instantly with zero network
# or LLM cost. Lexicon scores remain the fallback when no key is configured.

LLM_SENTIMENT_MODEL = "llama-3.3-70b-versatile"

def _extract_json_array(text):
    """Tolerant extraction of a JSON array from an LLM response.

    Groq occasionally corrupts the tail of objects (e.g. closes a keywords
    array with `"}}` instead of `"]}` or leaves trailing commas). Try strict
    parses first, then cheap repairs, then fall back to regex.
    """
    if not text:
        return None
    candidates = [text.strip()]
    candidates.append(re.sub(r'```(?:json)?', '', text).strip('` \n').strip())
    candidates.append(re.sub(r'```(?:json)?', '', text).strip())
    for c in candidates:
        if not c:
            continue
        try:
            parsed = json.loads(c)
            if isinstance(parsed, list):
                return parsed
        except Exception:
            pass
    repaired = re.sub(r'"\}\}(?=\s*[,}\]])', '"]}', text)
    repaired = re.sub(r',\s*\]', ']', repaired)
    for c in (repaired.strip(),):
        m = re.search(r'\[.*\]', c, re.S)
        if m:
            try:
                parsed = json.loads(m.group(0))
                if isinstance(parsed, list):
                    return parsed
            except Exception:
                pass
    return None

def _groq_client():
    try:
        from groq import Groq
    except ImportError:
        return None
    key = os.environ.get("GROQ_API_KEY")
    if not key:
        try:
            from dotenv import load_dotenv
            load_dotenv(os.path.join(BASE_DIR, "ai_engine", ".env"))
            key = os.environ.get("GROQ_API_KEY")
        except Exception:
            pass
    if not key:
        return None
    return Groq(api_key=key)

def llm_classify_articles(articles):
    """Run the strong LLM sentiment pass over a symbol's headlines (<= 8).
    Mutates each article with llmScore/llmLabel/llmKeywords and marks
    llmProcessed so cached files are never re-classified. Falls back silently
    to the lexicon scores when there is no key or the call fails."""
    if not articles:
        return articles
    pending = [i for i, a in enumerate(articles) if not a.get('llmProcessed')]
    if not pending:
        return articles
    client = _groq_client()
    if client is None:
        return articles

    titles = "\n".join(f"{i}. {articles[i]['title']}" for i in pending)
    prompt = (
        "You are an expert NEPSE (Nepal Stock Exchange) equity analyst. For each numbered news "
        "headline judge the sentiment as it affects the share price of the company mentioned. "
        "Respond ONLY with valid JSON, a single array of objects: "
        '[{"index":0,"score":0.0,"label":"BULLISH","keywords":["growth","dividend"]}, ...]. '
        "score is a float in [-1, 1]; label is BULLISH | NEUTRAL | BEARISH; keywords lists 2-4 "
        "decisive words. Rules: profit/dividend growth, positive guidance, buybacks, upgrades = "
        "positive; losses, defaults, regulatory probes, rights-issue dilution, downgrades, "
        "slowdown = negative; neutral corporate/operational news = 0. "
        f"Return exactly {len(pending)} objects.\n\n{titles}"
    )
    try:
        resp = client.chat.completions.create(
            model=LLM_SENTIMENT_MODEL,
            temperature=0,
            max_tokens=1500,
            messages=[
                {"role": "system", "content": "You output JSON only."},
                {"role": "user", "content": prompt}
            ]
        )
        text = resp.choices[0].message.content or ""
        parsed = _extract_json_array(text)
        if isinstance(parsed, list):
            by_index = {p.get('index'): p for p in parsed if isinstance(p, dict)}
            for pos, i in enumerate(pending):
                p = by_index.get(pos)
                if p:
                    try:
                        s = max(-1.0, min(1.0, float(p.get('score', 0.0))))
                    except (TypeError, ValueError):
                        s = 0.0
                    articles[i]['llmScore'] = round(s, 2)
                    articles[i]['llmLabel'] = str(p.get('label', 'NEUTRAL')).upper()
                    articles[i]['llmKeywords'] = p.get('keywords') or []
                    articles[i]['llmProcessed'] = True
    except Exception as e:
        # Do NOT mark pending articles processed: a rate-limit / network failure
        # must be retried by the next annotate pass, not silently lost.
        print(f"[Sentiment LLM] classification failed for {len(pending)} headlines: {e}")
    return articles

def llm_annotate_cache_for_all(symbols, workers=1, sleep_s=2.1):
    """Re-read each symbol's cached news file and add LLM sentiment scores.
    Defaults to a single worker + pacing so the pass stays inside Groq's
    30 RPM free-tier limit; already-processed caches are skipped for free
    resume across multiple runs."""
    ensure_directories()
    done = 0
    from concurrent.futures import ThreadPoolExecutor
    import time as _time

    def _annotate(sym):
        nonlocal done
        clean = sym.upper().strip()
        f = os.path.join(RAW_NEWS_DIR, f"{clean}_news.json")
        if not os.path.exists(f):
            return
        try:
            with open(f, encoding='utf-8') as fh:
                items = json.load(fh)
            if not isinstance(items, list):
                return
            before = sum(1 for it in items if it.get('llmScore') is not None)
            llm_classify_articles(items)
            after = sum(1 for it in items if it.get('llmScore') is not None)
            if after > before:
                with open(f, 'w', encoding='utf-8') as fh:
                    json.dump(items, fh, indent=2, ensure_ascii=False)
                done += 1
        except Exception as e:
            print(f"[Sentiment LLM] annotate {clean} failed: {e}")
        if sleep_s > 0:
            _time.sleep(sleep_s)

    with ThreadPoolExecutor(max_workers=workers) as ex:
        list(ex.map(_annotate, symbols))
    print(f"[Sentiment LLM] LLM-classified {done} symbol caches.")
    return done

def get_market_bias():
    """NEPSE index momentum from the latest snapshot -> a small confidence bias
    (up to ~+3 confidence pts for a strongly rising index, -3 for a falling one)
    plus a trend label. Used to boost all picks in a rising market."""
    try:
        with open(os.path.join(BASE_DIR, "data", "nepse_snapshot.json"), encoding='utf-8') as f:
            snap = json.load(f)
        nepse = next((i for i in (snap.get('indices') or []) if i.get('index') == 'NEPSE Index'), None)
        if not nepse:
            return {"available": False, "bias": 0.0, "trend": "FLAT"}
        pct = float(nepse.get('perChange') or nepse.get('changePct') or 0.0)
        if pct >= 0.5:
            trend = "RISING"
        elif pct <= -0.5:
            trend = "FALLING"
        else:
            trend = "FLAT"
        bias = round(max(-3.0, min(3.0, pct * 2.0)), 2)
        return {
            "available": True,
            "index": float(nepse.get('currentValue') or nepse.get('close') or 0),
            "changePct": round(pct, 2),
            "trend": trend,
            "bias": bias,
            "asOf": snap.get('asOf')
        }
    except Exception:
        return {"available": False, "bias": 0.0, "trend": "FLAT"}

# ── Market regime (breadth-based, NOT opinion) ──────────────────────────────
# Whether NEPSE is in an UPTREND / DOWNTREND / SIDEWAYS decides *when* to buy,
# which historically matters far more than which stock. Computed from real
# breadth across every stock in the CSV (median 5d/20d returns + % trading above
# their own SMA20) combined with the NEPSE index snapshot. Cached 6h.

MARKET_REGIME_CACHE = os.path.join(BASE_DIR, "data", "raw", "market_regime_cache.json")
MARKET_REGIME_TTL_HOURS = 6


def compute_market_regime():
    try:
        df = fetch_price_history_csv()
        if df is None or 'symbol' not in df.columns or len(df) < 500:
            return None
    except Exception as e:
        print(f"[Market Regime] price load failed: {e}")
        return None

    rets5, rets20 = [], []
    above20 = 0
    n = 0
    last_dates = []
    for sym, sub in df.groupby('symbol'):
        sub = sub.dropna(subset=['close']).sort_values('date')
        closes = sub['close'].astype(float)
        if len(closes) < 25:
            continue
        c0 = float(closes.iloc[-1])
        c5 = float(closes.iloc[-6])
        c20 = float(closes.iloc[-21])
        if c5 <= 0 or c20 <= 0:
            continue
        rets5.append((c0 / c5 - 1.0) * 100.0)
        rets20.append((c0 / c20 - 1.0) * 100.0)
        if c0 > float(closes.tail(20).mean()):
            above20 += 1
        n += 1
        last_dates.append(str(sub['date'].iloc[-1]))
    if n < 20:
        return None

    med5 = round(float(np.median(rets5)), 2)
    med20 = round(float(np.median(rets20)), 2)
    breadth = round(above20 * 100.0 / n, 1)
    as_of = max(last_dates) if last_dates else None

    bias = get_market_bias()
    index = bias.get('index') if bias.get('available') else None
    daily = bias.get('changePct') if bias.get('available') else None
    daily_trend = bias.get('trend') if bias.get('available') else None

    if med20 > 2.0 and breadth >= 55:
        regime = "UPTREND"
    elif med20 < -2.0 and breadth <= 45:
        regime = "DOWNTREND"
    else:
        regime = "SIDEWAYS"

    guidance = {
        "UPTREND": "Risk-on. The market is rising — this is when new buys work. Prefer stocks already above their 20-day average and keep normal position sizes.",
        "SIDEWAYS": "Mixed. Neither buyers nor sellers own the tape. Only strong, cheap stocks are worth touching, keep sizes moderate and exit if the price breaks its recent low.",
        "DOWNTREND": "Risk-off. The market is falling — cash and patience beat stock-picking here. If you must act, use small sizes, only in stocks holding their support, and stop out below support.",
    }[regime]
    stance = {"UPTREND": "OFFENSIVE", "SIDEWAYS": "BALANCED", "DOWNTREND": "DEFENSIVE"}[regime]
    max_position = {"UPTREND": 100, "SIDEWAYS": 60, "DOWNTREND": 30}[regime]

    return {
        "regime": regime,
        "stance": stance,
        "maxPositionPct": max_position,
        "advice": guidance,
        "asOf": as_of,
        "index": index,
        "indexDailyChangePct": daily,
        "indexDailyTrend": daily_trend,
        "median5dReturn": med5,
        "median20dReturn": med20,
        "pctAboveSma20": breadth,
        "n": n,
        "computedAt": time.strftime("%Y-%m-%dT%H:%M:%S"),
    }


def get_market_regime(force=False):
    if not force:
        try:
            with open(MARKET_REGIME_CACHE, encoding='utf-8') as f:
                cached = json.load(f)
            age = (time.time() - os.path.getmtime(MARKET_REGIME_CACHE)) / 3600.0
            if isinstance(cached, dict) and cached and age <= MARKET_REGIME_TTL_HOURS:
                return cached
        except Exception:
            pass
    out = compute_market_regime()
    if out:
        try:
            ensure_directories()
            with open(MARKET_REGIME_CACHE, 'w', encoding='utf-8') as f:
                json.dump(out, f, indent=2)
        except Exception:
            pass
    return out or {}

# ── Sector momentum layer ────────────────────────────────────────────────────
# Whether a sector is rising/falling/strengthening matters a lot in NEPSE
# (sector rotation). We derive it from the price CSV: average 5d and 20d
# returns plus the % of members trading above their SMA20, cached for 6h.

SECTOR_MOMENTUM_CACHE = os.path.join(BASE_DIR, "data", "raw", "sector_momentum_cache.json")
SECTOR_MOMENTUM_TTL_HOURS = 6

def compute_sector_momentum():
    """Compute per-sector momentum from the bundled price CSV + fundamentals cache."""
    try:
        df = fetch_price_history_csv()
        if df is None or 'symbol' not in df.columns:
            return {}
    except Exception as e:
        print(f"[Sector Momentum] price load failed: {e}")
        return {}

    fund_cache = {}
    try:
        with open(os.path.join(RAW_FUNDAMENTALS_DIR, "merolagani_cache.json"), encoding='utf-8') as f:
            fund_cache = json.load(f)
    except Exception:
        fund_cache = {}

    sector_members = {}
    for sym, sub in df.groupby('symbol'):
        sub = sub.sort_values('date')
        closes = sub['close'].dropna().astype(float)
        if len(closes) < 25:
            continue
        close_now = float(closes.iloc[-1])
        close_5 = float(closes.iloc[-6])
        close_20 = float(closes.iloc[-21])
        if close_5 <= 0 or close_20 <= 0:
            continue
        ret5 = (close_now / close_5 - 1.0) * 100.0
        ret20 = (close_now / close_20 - 1.0) * 100.0
        sma20 = float(closes.tail(20).mean())
        above = 1 if close_now > sma20 else 0
        sector = (fund_cache.get(sym.upper(), {}) or {}).get('sector') or 'Others'
        m = sector_members.setdefault(sector, {"rets5": [], "rets20": [], "above": 0, "n": 0})
        m["rets5"].append(ret5)
        m["rets20"].append(ret20)
        m["above"] += above
        m["n"] += 1

    def _mean(xs):
        return round(sum(xs) / len(xs), 2) if xs else 0.0

    out = {}
    for sector, m in sector_members.items():
        if m["n"] < 3:
            continue
        ret5 = _mean(m["rets5"])
        ret20 = _mean(m["rets20"])
        pct_above = round(m["above"] * 100.0 / m["n"], 1)
        if ret20 > 0.5 and pct_above >= 50:
            trend = "STRENGTHENING"
        elif ret20 < -0.5 and pct_above <= 50:
            trend = "WEAKENING"
        else:
            trend = "NEUTRAL"
        out[sector] = {
            "ret5": ret5,
            "ret20": ret20,
            "pctAboveSma20": pct_above,
            "members": m["n"],
            "trend": trend,
            "momentumScore": round(max(-15.0, min(15.0, ret20 * 1.5 + ret5 * 0.5)), 2)
        }
    return out

def get_sector_momentum(force=False):
    """Sector momentum dict (cached 6h)."""
    if not force:
        try:
            with open(SECTOR_MOMENTUM_CACHE, encoding='utf-8') as f:
                cached = json.load(f)
            age = (time.time() - os.path.getmtime(SECTOR_MOMENTUM_CACHE)) / 3600.0
            if isinstance(cached, dict) and cached and age <= SECTOR_MOMENTUM_TTL_HOURS:
                return cached
        except Exception:
            pass
    out = compute_sector_momentum()
    try:
        ensure_directories()
        with open(SECTOR_MOMENTUM_CACHE, 'w', encoding='utf-8') as f:
            json.dump(out, f, indent=2)
    except Exception:
        pass
    return out

def _parse_news_datetime(pub_date):
    if not pub_date:
        return None
    s = str(pub_date).strip()
    # Defensive: some cached feeds carry a duplicated timezone like
    # "Tue, 05 Aug 2026 03:12:34 +0000 +0000" which breaks strptime.
    s = re.sub(r'(\+\d{4})\s+\+\d{4}$', r'\1', s)
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
        return None
    if dt.tzinfo is None:
        dt = dt.replace(tzinfo=timezone.utc)
    return dt

def _fetch_google_news(symbol):
    """Google News RSS only — fast path used for bulk cache priming."""
    try:
        clean_sym = symbol.upper().strip()
        query = f"NEPSE {clean_sym}"
        encoded = urllib.parse.quote(query)
        url = f"https://news.google.com/rss/search?q={encoded}&hl=en-NP&gl=NP&ceid=NP:en"
        req = urllib.request.Request(url, headers={'User-Agent': 'Mozilla/5.0'})
        items = []
        with urllib.request.urlopen(req, timeout=8) as resp:
            root = ET.fromstring(resp.read())
            for item in root.findall('.//item')[:6]:
                title = item.find('title').text if item.find('title') is not None else ""
                pubDate = item.find('pubDate').text if item.find('pubDate') is not None else ""
                link = item.find('link').text if item.find('link') is not None else ""
                score = score_title_sentiment(title)
                items.append({
                    'title': title,
                    'pubDate': pubDate,
                    'url': link,
                    'sentimentScore': score,
                    'sentimentLabel': "BULLISH" if score > 0.1 else ("BEARISH" if score < -0.1 else "NEUTRAL"),
                    'symbol': clean_sym
                })
        return items
    except Exception as e:
        print(f"[News Cache Warning] Google RSS fetch for {symbol} failed: {e}")
        return []

def get_news_sentiment(symbol, use_cache_only=True, max_age_days=NEWS_RECENT_MAX_DAYS,
                       max_cache_age_hours=NEWS_CACHE_TTL_HOURS):
    """
    Structured sentiment for a symbol from the on-disk news cache.
    Returns a dict the screener / analysis can display directly:
      {available, score, label, newsCount, lastNewsDate, lastNewsAgo,
       recent, staleCache, articles}
    - use_cache_only=True  -> never hits the network (fast, used by screener).
    - use_cache_only=False -> fetches live news only when there is no usable cache
                              (used by single-stock deep analysis).
    """
    ensure_directories()
    clean_sym = symbol.upper().strip()
    raw_news_file = os.path.join(RAW_NEWS_DIR, f"{clean_sym}_news.json")
    cache_found = os.path.exists(raw_news_file)

    items = []
    cache_age_hours = None
    if cache_found:
        try:
            mtime = os.path.getmtime(raw_news_file)
            cache_age_hours = (time.time() - mtime) / 3600.0
            with open(raw_news_file, encoding='utf-8') as f:
                cached = json.load(f)
            if isinstance(cached, list):
                items = cached
        except Exception:
            items = []

    # Drop placeholder "no news available" entries
    items = [i for i in items if not i.get('unavailable') and (i.get('title') or '').strip()]

    stale = cache_age_hours is not None and cache_age_hours > max_cache_age_hours

    if not use_cache_only and (not cache_found or not items or stale):
        fresh = _fetch_google_news(clean_sym)
        if fresh:
            items = fresh
            llm_classify_articles(items)
            try:
                with open(raw_news_file, 'w', encoding='utf-8') as f:
                    json.dump(items, f, indent=2)
            except Exception:
                pass

    score = None
    label = None
    last_dt = None
    llm_count = 0
    keywords = []
    for item in items:
        s = item.get('llmScore')
        if s is not None:
            llm_count += 1
        else:
            s = item.get('sentimentScore')
            if s is None:
                try:
                    s = score_title_sentiment(item.get('title'))
                except Exception:
                    s = 0.0
        score = (score or 0.0) + float(s or 0.0)
        if item.get('llmKeywords'):
            keywords.extend(item['llmKeywords'])
        dt = _parse_news_datetime(item.get('pubDate'))
        if dt and (last_dt is None or dt > last_dt):
            last_dt = dt
    news_count = len(items)
    if news_count and score is not None:
        score = round(score / news_count, 2)
        label = "BULLISH" if score > 0.1 else ("BEARISH" if score < -0.1 else "NEUTRAL")
    model_used = 'llm-groq' if llm_count else 'lexicon'
    from collections import Counter
    top_keywords = [k for k, _ in Counter(kw for kw in keywords if kw).most_common(5)] if keywords else []

    last_news_date = last_dt.strftime("%Y-%m-%d") if last_dt else None
    last_news_ago = relative_time(last_dt.strftime("%a, %d %b %Y %H:%M:%S GMT") if last_dt else None)
    recent = False
    if last_dt:
        # timezone-aware age: last_dt from parsedate_to_datetime carries tzinfo.
        ref = last_dt if last_dt.tzinfo else last_dt.replace(tzinfo=timezone.utc)
        age_days = (datetime.now(timezone.utc) - ref).total_seconds() / 86400.0
        recent = age_days <= max_age_days

    return {
        "available": news_count > 0 and recent,
        "score": score,
        "label": label,
        "newsCount": news_count,
        "lastNewsDate": last_news_date,
        "lastNewsAgo": last_news_ago,
        "recent": recent,
        "staleCache": bool(cache_found and stale),
        "sentimentModel": model_used,
        "topKeywords": top_keywords,
        "articles": items[:6]
    }

def refresh_news_cache_for_all(symbols, workers=8, force=False, annotate_llm=True):
    """Prime the news cache for many symbols in parallel (Google RSS only),
    then run the strong LLM sentiment pass over the freshly cached headlines."""
    ensure_directories()
    done = 0
    failed = 0

    def _refresh(sym):
        nonlocal done, failed
        clean = sym.upper().strip()
        raw_news_file = os.path.join(RAW_NEWS_DIR, f"{clean}_news.json")
        if not force and os.path.exists(raw_news_file):
            try:
                mtime = os.path.getmtime(raw_news_file)
                if (time.time() - mtime) / 3600.0 <= NEWS_CACHE_TTL_HOURS:
                    return
            except Exception:
                pass
        items = _fetch_google_news(clean)
        if items:
            try:
                with open(raw_news_file, 'w', encoding='utf-8') as f:
                    json.dump(items, f, indent=2)
                done += 1
            except Exception:
                failed += 1
        else:
            # write an empty cache so we don't refetch this symbol on every run
            try:
                with open(raw_news_file, 'w', encoding='utf-8') as f:
                    json.dump([], f, indent=2)
            except Exception:
                pass
            failed += 1

    from concurrent.futures import ThreadPoolExecutor
    with ThreadPoolExecutor(max_workers=workers) as ex:
        list(ex.map(_refresh, symbols))
    print(f"[News Cache] Primed news sentiment for {done} symbols ({failed} with no news).")
    if annotate_llm:
        llm_annotate_cache_for_all(symbols, workers=min(6, max(2, workers)))
    return done

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
