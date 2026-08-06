import asyncio, json, sys, os, re
import csv
import urllib.request
from datetime import datetime, timezone

SNAPSHOT_PATH = os.path.join(os.path.dirname(__file__), "data", "nepse_snapshot.json")

MERO_HEADERS = {'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) Chrome/126 Safari/537.36'}


def scrape_merolagani_live_market():
    """Fetches the full live market table from MeroLagani for the latest session.

    MeroLagani's LatestMarket page is a fallback for nepse.getLiveMarket(),
    which currently returns an empty list. Returns (rows, as_of) where rows is
    a list of real per-symbol market entries and as_of is like '2026/08/06 15:00:00'.
    """
    try:
        from bs4 import BeautifulSoup
    except ImportError:
        return [], None
    try:
        url = "https://merolagani.com/LatestMarket.aspx"
        req = urllib.request.Request(url, headers=MERO_HEADERS)
        html = urllib.request.urlopen(req, timeout=20).read().decode('utf-8', errors='ignore')
    except Exception as e:
        print(f"[NEPSE] MeroLagani live-market fetch failed: {e}", file=sys.stderr)
        return [], None

    soup = BeautifulSoup(html, 'html.parser')
    table = soup.find('table')
    if not table:
        return [], None

    as_of = None
    m = re.search(r'As of\s*([0-9]{4}/[0-9]{2}/[0-9]{2}\s*[0-9:]+)', html)
    if m:
        as_of = m.group(1)

    def num(v):
        try:
            return float(str(v).replace(',', '').replace('%', '').strip() or 0)
        except Exception:
            return 0.0

    rows = []
    header = None
    for tr in table.find_all('tr'):
        cells = tr.find_all(['th', 'td'])
        texts = [c.get_text(strip=True) for c in cells]
        if not texts:
            continue
        if texts[0].lower() == 'symbol':
            header = texts
            continue
        if header is None or len(texts) < 7:
            continue
        sym = texts[0]
        if not sym:
            continue
        ltp = num(texts[1])
        if ltp <= 0:
            continue
        pct = num(texts[2])
        o = num(texts[3])
        hi = num(texts[4])
        lo = num(texts[5])
        qty = num(texts[6])
        pclose = num(texts[7]) if len(texts) > 7 else 0
        if pclose <= 0 and pct != 0:
            pclose = ltp / (1.0 + pct / 100.0)
        rows.append({
            'symbol': sym,
            'lastTradedPrice': ltp,
            'openPrice': o,
            'highPrice': hi,
            'lowPrice': lo,
            'totalTradeQuantity': int(qty),
            'pointChange': round(ltp - pclose, 2),
            'percentageChange': pct,
            'previousClose': round(pclose, 2),
            'securityName': sym,
            'sectorName': 'Equity'
        })

    return rows, as_of

# --- Real CSV data source (stock OHLC prices scraped from NEPSE) --------------
# This is used ONLY as a last-resort for individual stock prices when both the
# live NEPSE API and the cached snapshot are unavailable. It never fabricates
# index/sub-index values.
def get_csv_fallback():
    try:
        csv_path = os.path.join(os.path.dirname(__file__), "data", "raw", "prices", "price_history.csv")
        if not os.path.exists(csv_path):
            return None

        with open(csv_path, 'r', encoding='utf-8') as f:
            reader = csv.DictReader(f)
            reader.fieldnames = [c.lower().strip() for c in reader.fieldnames]
            rows = list(reader)

        if not rows:
            return None

        latest_date = max(row['date'] for row in rows)
        latest_rows = [r for r in rows if r['date'] == latest_date]

        for r in latest_rows:
            o = float(r.get('open', 0) or 0)
            c = float(r.get('close', 0) or 0)
            r['_change'] = c - o
            r['_pct_change'] = (r['_change'] / o * 100) if o else 0
            r['_turnover'] = float(r.get('turnover', 0) or 0)
            r['_volume'] = int(float(r.get('volume', 0) or 0))

        gainers = sorted(latest_rows, key=lambda x: x['_pct_change'], reverse=True)[:15]
        losers = sorted(latest_rows, key=lambda x: x['_pct_change'])[:15]
        turnover = sorted(latest_rows, key=lambda x: x['_turnover'], reverse=True)[:15]

        live_market = []
        for r in latest_rows:
            live_market.append({
                'symbol': str(r.get('symbol', 'UNK')),
                'lastTradedPrice': float(r.get('close', 0) or 0),
                'openPrice': float(r.get('open', 0) or 0),
                'highPrice': float(r.get('high', 0) or 0),
                'lowPrice': float(r.get('low', 0) or 0),
                'pointChange': float(r.get('_change', 0)),
                'percentageChange': float(r.get('_pct_change', 0)),
                'totalTradeQuantity': int(r.get('_volume', 0)),
                'totalTradeValue': float(r.get('_turnover', 0)),
                'sectorName': 'Equity'
            })

        total_turnover = sum(r['_turnover'] for r in latest_rows)
        total_volume = sum(r['_volume'] for r in latest_rows)

        out = {
            'status': {'isOpen': f'CLOSED (Showing past data from {latest_date})'},
            'summary': [
                {'detail': 'Total Turnover Rs:', 'value': total_turnover},
                {'detail': 'Total Traded Shares', 'value': total_volume},
                {'detail': 'Total Transactions', 'value': None}
            ],
            # No fabricated index values: the caller decides what to show.
            'indices': [],
            'gainers': [
                {'symbol': str(r.get('symbol', 'UNK')), 'ltp': float(r.get('close', 0) or 0), 'pointChange': float(r.get('_change', 0)), 'percentageChange': float(r.get('_pct_change', 0)), 'volume': int(r.get('_volume', 0))}
                for r in gainers
            ],
            'losers': [
                {'symbol': str(r.get('symbol', 'UNK')), 'ltp': float(r.get('close', 0) or 0), 'pointChange': float(r.get('_change', 0)), 'percentageChange': float(r.get('_pct_change', 0)), 'volume': int(r.get('_volume', 0))}
                for r in losers
            ],
            'turnover': [
                {'symbol': str(r.get('symbol', 'UNK')), 'closingPrice': float(r.get('close', 0) or 0), 'turnover': float(r.get('_turnover', 0)), 'volume': int(r.get('_volume', 0))}
                for r in turnover
            ],
            'liveMarket': live_market,
            'subIndices': []
        }
        return out
    except Exception:
        return None


def load_snapshot():
    try:
        if os.path.exists(SNAPSHOT_PATH):
            with open(SNAPSHOT_PATH, 'r', encoding='utf-8') as f:
                return json.load(f)
    except Exception as e:
        print(f"[NEPSE] Failed to load snapshot: {e}", file=sys.stderr)
    return None


def save_snapshot(data):
    try:
        os.makedirs(os.path.dirname(SNAPSHOT_PATH), exist_ok=True)
        data['savedAt'] = datetime.now(timezone.utc).isoformat()
        with open(SNAPSHOT_PATH, 'w', encoding='utf-8') as f:
            json.dump(data, f)
        print(f"[NEPSE] Saved real snapshot with {len(data.get('liveMarket', []))} symbols.", file=sys.stderr)
    except Exception as e:
        print(f"[NEPSE] Failed to save snapshot: {e}", file=sys.stderr)


def get_empty_data():
    return {
        'status': {'isOpen': 'CLOSED'},
        'summary': [],
        'indices': [],
        'gainers': [],
        'losers': [],
        'turnover': [],
        'liveMarket': [],
        'subIndices': []
    }


async def fetch_all():
    try:
        from nepse import AsyncNepse
        nepse = AsyncNepse()
        nepse.setTLSVerification(False)

        st, sum_data, idx, gainers, losers, turnover, live_market, sub_indices = await asyncio.gather(
            nepse.getMarketStatus(),
            nepse.getSummary(),
            nepse.getNepseIndex(),
            nepse.getTopGainers(),
            nepse.getTopLosers(),
            nepse.getTopTenTurnoverScrips(),
            nepse.getLiveMarket(),
            nepse.getNepseSubIndices(),
            return_exceptions=True
        )

        def clean(val, default):
            if isinstance(val, Exception):
                return default
            return val

        # getLiveMarket() is currently returning an empty list from NEPSE, so
        # fall back to the MeroLagani live-market scrape for the per-stock table.
        live_market = clean(live_market, [])
        mero_rows, mero_as_of = ([], None)
        if not live_market or len(live_market) == 0:
            mero_rows, mero_as_of = scrape_merolagani_live_market()
            if mero_rows:
                live_market = mero_rows

        out = {
            'status': clean(st, {'isOpen': 'CLOSED'}),
            'summary': clean(sum_data, []),
            'indices': clean(idx, []),
            'gainers': clean(gainers, []),
            'losers': clean(losers, []),
            'turnover': clean(turnover, []),
            'liveMarket': live_market,
            'subIndices': clean(sub_indices, []),
        }
        # Surface the freshest 'as of' time from whichever source answered.
        as_of = None
        st_clean = clean(st, {})
        if isinstance(st_clean, dict):
            as_of = st_clean.get('asOf') or mero_as_of
        out['asOf'] = as_of or mero_as_of or (datetime.now(timezone.utc).isoformat() if mero_rows else None)
        return out
    except ImportError:
        return None


async def main():
    out = None
    cached = False
    cached_at = None
    data_source = 'live'

    try:
        out = await asyncio.wait_for(fetch_all(), timeout=25.0)
    except Exception as e:
        print(f"[NEPSE] Live fetch failed: {e}", file=sys.stderr)

    # Real library data is always preferred — even when the market is closed the
    # API returns the true last index values, so we never swap in fabricated data.
    if out is None or not isinstance(out.get('indices'), list):
        out = None

    if out is None or not out.get('liveMarket'):
        # Try the last real snapshot saved from a previous successful fetch.
        snapshot = load_snapshot()
        if snapshot and snapshot.get('liveMarket'):
            out = {
                'status': snapshot.get('status') or {'isOpen': 'CLOSED'},
                'summary': snapshot.get('summary') or [],
                'indices': snapshot.get('indices') or [],
                'gainers': snapshot.get('gainers') or [],
                'losers': snapshot.get('losers') or [],
                'turnover': snapshot.get('turnover') or [],
                'liveMarket': snapshot.get('liveMarket') or [],
                'subIndices': snapshot.get('subIndices') or [],
                'asOf': snapshot.get('asOf') or snapshot.get('savedAt'),
            }
            cached = True
            cached_at = snapshot.get('savedAt')
            data_source = 'snapshot'
            print("[NEPSE] Using cached snapshot from", cached_at, file=sys.stderr)
        else:
            # Last resort: real stock prices from local CSV. No fabricated indices.
            csv_fallback = get_csv_fallback()
            if csv_fallback:
                out = csv_fallback
                cached = True
                cached_at = None
                data_source = 'csv'
            else:
                out = get_empty_data()
                data_source = 'empty'

    # Persist real (non-cached) data so we can serve it later offline/closed.
    if data_source == 'live' and out.get('liveMarket'):
        save_snapshot(dict(out))

    out['cachedData'] = cached
    out['cachedAt'] = cached_at
    out['dataSource'] = data_source
    print(json.dumps(out))


if __name__ == '__main__':
    asyncio.run(main())
