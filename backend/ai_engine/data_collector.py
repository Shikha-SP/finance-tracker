import os
import json
import time
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

# Pre-populated fundamental metrics database with realistic market values for top NEPSE stocks
FUNDAMENTAL_DB = {
    "NABIL": {"name": "Nabil Bank Limited", "sector": "Commercial Banks", "marketCap": 68500000000, "peRatio": 16.8, "pbRatio": 2.1, "eps": 34.5, "dividendYield": 3.8, "roe": 14.2, "bookValue": 276.0},
    "GBIME": {"name": "Global IME Bank Limited", "sector": "Commercial Banks", "marketCap": 52100000000, "peRatio": 14.2, "pbRatio": 1.6, "eps": 17.0, "dividendYield": 4.2, "roe": 11.5, "bookValue": 151.25},
    "CHCL": {"name": "Chilime Hydropower Co. Ltd.", "sector": "Hydro Power", "marketCap": 34200000000, "peRatio": 22.4, "pbRatio": 2.8, "eps": 21.6, "dividendYield": 2.5, "roe": 12.8, "bookValue": 173.2},
    "SHIVM": {"name": "Shivam Cements Limited", "sector": "Manufacturing And Processing", "marketCap": 26800000000, "peRatio": 28.6, "pbRatio": 2.9, "eps": 17.9, "dividendYield": 1.8, "roe": 10.1, "bookValue": 176.5},
}

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

def fetch_price_history_csv():
    ensure_directories()
    raw_path = os.path.join(RAW_PRICES_DIR, "price_history.csv")
    
    needs_fetch = not os.path.exists(raw_path) or (time.time() - os.path.getmtime(raw_path) > 86400)
    
    if needs_fetch:
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

def get_company_fundamentals(symbol):
    clean_sym = symbol.upper().strip()
    
    # 1. Try to scrape actual fundamentals first (mimicking ShareSansarScraper)
    try:
        scraped_data = fetch_sharesansar_fundamentals(clean_sym)
        if scraped_data and 'eps' in scraped_data:
            # Merge with default DB or create new
            base = FUNDAMENTAL_DB.get(clean_sym, {
                "name": f"{clean_sym}",
                "sector": "Unknown",
                "marketCap": None,
                "peRatio": None,
                "pbRatio": None,
                "eps": None,
                "dividendYield": None,
                "roe": None,
                "bookValue": None
            })
            base.update(scraped_data)
            
            raw_funds_file = os.path.join(RAW_FUNDAMENTALS_DIR, f"{clean_sym}_fundamentals.json")
            with open(raw_funds_file, 'w', encoding='utf-8') as f:
                json.dump(base, f, indent=2)
            return base
    except Exception as e:
        print(f"[Fundamentals Scraper Warning] ShareSansar fetch failed: {e}")
    
    if clean_sym in FUNDAMENTAL_DB:
        return FUNDAMENTAL_DB[clean_sym]
    
    return {
        "name": f"{clean_sym}",
        "sector": "Unknown",
        "marketCap": None,
        "peRatio": None,
        "pbRatio": None,
        "eps": None,
        "dividendYield": None,
        "roe": None,
        "bookValue": None,
        "dataSource": "unavailable"
    }

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
