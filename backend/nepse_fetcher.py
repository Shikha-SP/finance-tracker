import asyncio, json, sys, os
import csv

def get_fallback_from_csv():
    try:
        csv_path = os.path.join(os.path.dirname(__file__), "data", "raw", "prices", "price_history.csv")
        if not os.path.exists(csv_path):
            return None
            
        with open(csv_path, 'r', encoding='utf-8') as f:
            reader = csv.DictReader(f)
            # normalize columns
            reader.fieldnames = [c.lower().strip() for c in reader.fieldnames]
            rows = list(reader)
            
        if not rows:
            return None
            
        latest_date = max(row['date'] for row in rows)
        latest_rows = [r for r in rows if r['date'] == latest_date]
        
        for r in latest_rows:
            o = float(r.get('open', 0))
            c = float(r.get('close', 0))
            r['_change'] = c - o
            r['_pct_change'] = (r['_change'] / o * 100) if o else 0
            r['_turnover'] = float(r.get('turnover', 0))
            r['_volume'] = int(float(r.get('volume', 0)))
        
        gainers = sorted(latest_rows, key=lambda x: x['_pct_change'], reverse=True)[:10]
        losers = sorted(latest_rows, key=lambda x: x['_pct_change'])[:10]
        turnover = sorted(latest_rows, key=lambda x: x['_turnover'], reverse=True)[:10]
        
        live_market = []
        for r in latest_rows:
            live_market.append({
                'symbol': str(r.get('symbol', 'UNK')),
                'lastTradedPrice': float(r.get('close', 0)),
                'pointChange': float(r.get('_change', 0)),
                'percentageChange': float(r.get('_pct_change', 0)),
                'sectorName': 'Others'
            })
            
        total_turnover = sum(r['_turnover'] for r in latest_rows)
        total_volume = sum(r['_volume'] for r in latest_rows)
        
        out = {
            'status': {'isOpen': f'CLOSED (Showing past data from {latest_date})'},
            'summary': [
                {'detail': 'Total Turnover Rs:', 'value': total_turnover},
                {'detail': 'Total Traded Shares', 'value': total_volume},
                {'detail': 'Total Transactions', 'value': 0}
            ],
            'indices': [{'index': 'NEPSE Index', 'currentValue': 2100.0, 'change': 0.0, 'perChange': 0.0}],
            'gainers': [
                {'symbol': str(r.get('symbol', 'UNK')), 'ltp': float(r.get('close', 0)), 'pointChange': float(r.get('_change', 0)), 'percentageChange': float(r.get('_pct_change', 0))}
                for r in gainers
            ],
            'losers': [
                {'symbol': str(r.get('symbol', 'UNK')), 'ltp': float(r.get('close', 0)), 'pointChange': float(r.get('_change', 0)), 'percentageChange': float(r.get('_pct_change', 0))}
                for r in losers
            ],
            'turnover': [
                {'symbol': str(r.get('symbol', 'UNK')), 'closingPrice': float(r.get('close', 0)), 'turnover': float(r.get('turnover', 0))}
                for r in turnover
            ],
            'liveMarket': live_market,
            'subIndices': []
        }
        return out
    except Exception as e:
        return None

async def fetch_all():
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

    out = {
        'status': clean(st, {'isOpen': 'CLOSED'}),
        'summary': clean(sum_data, []),
        'indices': clean(idx, []),
        'gainers': clean(gainers, []),
        'losers': clean(losers, []),
        'turnover': clean(turnover, []),
        'liveMarket': clean(live_market, []),
        'subIndices': clean(sub_indices, [])
    }
    return out

async def main():
    try:
        out = await asyncio.wait_for(fetch_all(), timeout=3.5)
        # If market closed or empty liveMarket, attempt fallback
        if not out.get('liveMarket') or out['status'].get('isOpen') != 'OPEN':
            fallback = get_fallback_from_csv()
            if fallback:
                out = fallback
        print(json.dumps(out))
    except (asyncio.TimeoutError, Exception) as e:
        fallback = get_fallback_from_csv()
        if fallback:
            print(json.dumps(fallback))
        else:
            print(json.dumps({'error': str(e)}))
        sys.exit(1 if not fallback else 0)

if __name__ == '__main__':
    asyncio.run(main())
