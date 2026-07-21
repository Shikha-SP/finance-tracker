import asyncio, json, sys
from nepse import AsyncNepse

async def main():
    try:
        nepse = AsyncNepse()
        nepse.setTLSVerification(False)
        
        st = await nepse.getMarketStatus()
        sum_data = await nepse.getSummary()
        idx = await nepse.getNepseIndex()
        gainers = await nepse.getTopGainers()
        losers = await nepse.getTopLosers()
        turnover = await nepse.getTopTenTurnoverScrips()
        
        # New additions for tracker and sectors
        live_market = await nepse.getLiveMarket()
        sub_indices = await nepse.getNepseSubIndices()

        out = {
            'status': st,
            'summary': sum_data,
            'indices': idx,
            'gainers': gainers,
            'losers': losers,
            'turnover': turnover,
            'liveMarket': live_market,
            'subIndices': sub_indices
        }
        print(json.dumps(out))
    except Exception as e:
        print(json.dumps({'error': str(e)}))
        sys.exit(1)

if __name__ == '__main__':
    asyncio.run(main())
