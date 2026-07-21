import asyncio, json, sys
from nepse import AsyncNepse

async def main():
    if len(sys.argv) < 2:
        print(json.dumps({'error': 'No index name provided'}))
        sys.exit(1)
        
    index_name = sys.argv[1].lower()
    
    try:
        nepse = AsyncNepse()
        nepse.setTLSVerification(False)
        
        data = None
        if 'nepse' in index_name:
            data = await nepse.getDailyNepseIndexGraph()
        elif 'sensitive float' in index_name:
            data = await nepse.getDailySensitiveFloatIndexGraph()
        elif 'sensitive' in index_name:
            data = await nepse.getDailySensitiveIndexGraph()
        elif 'float' in index_name:
            data = await nepse.getDailyFloatIndexGraph()
        elif 'banking' in index_name or 'bank' in index_name and 'dev' not in index_name:
            data = await nepse.getDailyBankingSubindexGraph()
        elif 'dev' in index_name:
            data = await nepse.getDailyDevelopmentBankSubindexGraph()
        elif 'finance' in index_name:
            data = await nepse.getDailyFinanceSubindexGraph()
        elif 'hotel' in index_name or 'tourism' in index_name:
            data = await nepse.getDailyHotelTourismSubindexGraph()
        elif 'hydro' in index_name:
            data = await nepse.getDailyHydroSubindexGraph()
        elif 'life' in index_name and 'non' not in index_name:
            data = await nepse.getDailyLifeInsuranceSubindexGraph()
        elif 'non' in index_name and 'life' in index_name:
            data = await nepse.getDailyNonLifeInsuranceSubindexGraph()
        elif 'manu' in index_name:
            data = await nepse.getDailyManufacturingSubindexGraph()
        elif 'micro' in index_name:
            data = await nepse.getDailyMicrofinanceSubindexGraph()
        elif 'mutual' in index_name:
            data = await nepse.getDailyMutualfundSubindexGraph()
        elif 'trade' in index_name or 'trading' in index_name:
            data = await nepse.getDailyTradingSubindexGraph()
        elif 'invest' in index_name:
            data = await nepse.getDailyInvestmentSubindexGraph()
        elif 'other' in index_name:
            data = await nepse.getDailyOthersSubindexGraph()
        else:
            data = await nepse.getDailyNepseIndexGraph() # fallback
            
        print(json.dumps({'graph': data}))
    except Exception as e:
        print(json.dumps({'error': str(e)}))
        sys.exit(1)

if __name__ == '__main__':
    asyncio.run(main())
