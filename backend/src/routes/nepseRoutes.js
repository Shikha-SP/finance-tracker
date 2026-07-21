const express = require('express');
const router = express.Router();
const { execFile } = require('child_process');
const path = require('path');

// --- simulated / fallback data ---------------------------------------------
function getSimulatedData() {
  const now = new Date();
  const seed = Math.floor(now.getTime() / 60000); 
  const rng = (base, spread) => +(base + (((seed * 1103515245 + 12345) & 0x7fffffff) % spread - spread / 2)).toFixed(2);

  return {
    summary: {
      isOpen: false,
      simulatedData: true,
      nepseIndex:      rng(2074.56, 20),
      nepseChange:     rng(-8.34, 30),
      nepseChangePct:  rng(-0.40, 2),
      sensitiveIndex:  rng(418.22, 8),
      sensitiveChange: rng(-1.22, 6),
      floatIndex:      rng(157.88, 5),
      floatChange:     rng(-0.65, 3),
      totalTurnover:   rng(2341567890, 500000000),
      totalVolume:     rng(4823450, 200000),
      totalTrades:     rng(48234, 5000),
    },
    indices: [
      { name: 'NEPSE Index',     value: rng(2074.56, 20),  change: rng(-8.34, 30),  changePct: rng(-0.40, 2)  },
      { name: 'Sensitive Index', value: rng(418.22, 8),    change: rng(-1.22, 6),   changePct: rng(-0.29, 1.5) },
      { name: 'Float Index',     value: rng(157.88, 5),    change: rng(-0.65, 3),   changePct: rng(-0.41, 1.5) },
      { name: 'Banking',         value: rng(1234.45, 15),  change: rng(-5.12, 20),  changePct: rng(-0.41, 2)   },
      { name: 'Development Bk',  value: rng(2345.67, 20),  change: rng(12.34, 30),  changePct: rng(0.53, 2)    },
      { name: 'Finance',         value: rng(1567.89, 15),  change: rng(-7.45, 20),  changePct: rng(-0.47, 2)   },
      { name: 'Insurance',       value: rng(8765.43, 50),  change: rng(32.10, 80),  changePct: rng(0.37, 2)    },
      { name: 'Hydropower',      value: rng(2134.56, 20),  change: rng(-9.87, 30),  changePct: rng(-0.46, 2)   },
    ],
    gainers: [
      { symbol: 'NABIL', ltp: 920,  pointChange: 42, pctChange: 4.78, volume: 12340  },
      { symbol: 'GBIME', ltp: 345,  pointChange: 15, pctChange: 4.54, volume: 8920   },
      { symbol: 'NTC',   ltp: 780,  pointChange: 32, pctChange: 4.28, volume: 5670   },
      { symbol: 'SANIMA',ltp: 298,  pointChange: 11, pctChange: 3.83, volume: 15430  },
      { symbol: 'NICA',  ltp: 567,  pointChange: 21, pctChange: 3.84, volume: 6780   },
    ],
    losers: [
      { symbol: 'UPPER', ltp: 612,  pointChange: -38,  pctChange: -5.84, volume: 34560  },
      { symbol: 'HDHPC', ltp: 145,  pointChange: -8,   pctChange: -5.23, volume: 12340  },
      { symbol: 'BFC',   ltp: 278,  pointChange: -14,  pctChange: -4.79, volume: 8920   },
      { symbol: 'CHDC',  ltp: 398,  pointChange: -19,  pctChange: -4.56, volume: 5670   },
      { symbol: 'PRIC',  ltp: 1234, pointChange: -55,  pctChange: -4.27, volume: 3450   },
    ],
    turnover: [
      { symbol: 'NABIL', turnover: 113634000, volume: 123456, ltp: 920  },
      { symbol: 'GBIME', turnover: 98765432,  volume: 286122, ltp: 345  },
      { symbol: 'NTC',   turnover: 87654321,  volume: 112379, ltp: 780  },
      { symbol: 'NICA',  turnover: 76543210,  volume: 134992, ltp: 567  },
      { symbol: 'UPPER', turnover: 65432198,  volume: 106912, ltp: 612  },
    ],
    liveMarket: [
      { symbol: 'NABIL', ltp: rng(920, 50) },
      { symbol: 'NICA', ltp: rng(567, 40) },
      { symbol: 'NTC', ltp: rng(780, 50) },
      { symbol: 'UPPER', ltp: rng(612, 40) },
      { symbol: 'GBIME', ltp: rng(345, 30) },
      { symbol: 'SANIMA', ltp: rng(298, 20) },
      { symbol: 'HDHPC', ltp: rng(145, 10) },
      { symbol: 'BFC', ltp: rng(278, 20) },
      { symbol: 'CHDC', ltp: rng(398, 30) },
      { symbol: 'PRIC', ltp: rng(1234, 100) },
      { symbol: 'SCB', ltp: rng(450, 40) },
      { symbol: 'HBL', ltp: rng(320, 30) },
      { symbol: 'SBI', ltp: rng(380, 30) },
      { symbol: 'EBL', ltp: rng(480, 40) },
      { symbol: 'MBL', ltp: rng(250, 20) },
      { symbol: 'KBL', ltp: rng(210, 20) },
      { symbol: 'SBL', ltp: rng(290, 20) },
      { symbol: 'ADBL', ltp: rng(412, 30) },
      { symbol: 'NBL', ltp: rng(310, 30) },
      { symbol: 'NHPC', ltp: rng(180, 15) },
      { symbol: 'BPCL', ltp: rng(360, 30) },
      { symbol: 'CHCL', ltp: rng(450, 40) },
      { symbol: 'SHL', ltp: rng(230, 20) },
      { symbol: 'TRH', ltp: rng(310, 30) },
      { symbol: 'CIT', ltp: rng(2100, 150) },
      { symbol: 'HDL', ltp: rng(1800, 120) },
      { symbol: 'SHIVM', ltp: rng(540, 40) },
    ]
  };
}

let cache = null;
let lastFetch = 0;
let fetchPromise = null;

async function getLiveNepseData() {
  const now = Date.now();
  // Cache for 60 seconds
  if (cache && (now - lastFetch < 60000)) return cache;

  if (fetchPromise) return fetchPromise;

  fetchPromise = new Promise((resolve) => {
    const script = path.join(__dirname, '../../nepse_fetcher.py');
    execFile('python', [script], { maxBuffer: 1024 * 1024 * 5, timeout: 30000 }, (err, stdout, stderr) => {
      fetchPromise = null;
      if (err) {
        console.error('[NEPSE Fetcher] Error:', err.message);
        resolve(cache || getSimulatedData());
        return;
      }
      try {
        const raw = JSON.parse(stdout);
        if (raw.error) throw new Error(raw.error);
        
        // Transform Python lib's structure to our frontend's expected structure
        const st = raw.status || {};
        const sm = raw.summary || [];
        const idxList = raw.indices || [];

        let nepseIndex = idxList.find(i => i.index === 'NEPSE Index') || idxList[0] || {};
        let sensitiveIndex = idxList.find(i => i.index === 'Sensitive Index') || {};
        let floatIndex = idxList.find(i => i.index === 'Float Index') || {};

        const data = {
          summary: {
            isOpen: st.isOpen === 'OPEN',
            simulatedData: false,
            nepseIndex: nepseIndex.currentValue || 0,
            nepseChange: nepseIndex.change || 0,
            nepseChangePct: nepseIndex.perChange || 0,
            sensitiveIndex: sensitiveIndex.currentValue || 0,
            sensitiveChange: sensitiveIndex.change || 0,
            floatIndex: floatIndex.currentValue || 0,
            floatChange: floatIndex.change || 0,
            totalTurnover: sm.find(s => s.detail === 'Total Turnover Rs:')?.value || 0,
            totalVolume: sm.find(s => s.detail === 'Total Traded Shares')?.value || 0,
            totalTrades: sm.find(s => s.detail === 'Total Transactions')?.value || 0,
          },
          indices: idxList.map(i => ({
            name: i.index,
            value: i.currentValue,
            change: i.change,
            changePct: i.perChange
          })),
          gainers: (raw.gainers || []).map(g => ({
            symbol: g.symbol,
            ltp: g.ltp,
            pointChange: g.pointChange,
            pctChange: g.percentageChange,
            volume: 0
          })),
          losers: (raw.losers || []).map(l => ({
            symbol: l.symbol,
            ltp: l.ltp,
            pointChange: l.pointChange,
            pctChange: l.percentageChange,
            volume: 0
          })),
          turnover: (raw.turnover || []).map(t => ({
            symbol: t.symbol,
            ltp: t.closingPrice,
            volume: 0,
            turnover: t.turnover
          })),
          liveMarket: (raw.liveMarket && raw.liveMarket.length > 0) ? raw.liveMarket : getSimulatedData().liveMarket,
          subIndices: raw.subIndices || []
        };
        // If we used fallback liveMarket, mark data as simulated
        if (!raw.liveMarket || raw.liveMarket.length === 0) {
          data.summary.simulatedData = true;
        }

        cache = data;
        lastFetch = now;
        resolve(data);
      } catch (parseErr) {
        console.error('[NEPSE Fetcher] Parse Error:', parseErr.message);
        resolve(cache || getSimulatedData());
      }
    });
  });
  return fetchPromise;
}

// --- routes --------------------------------------------------------------------

router.get('/summary', async (req, res) => {
  const data = await getLiveNepseData();
  res.json(data.summary);
});

router.get('/indices', async (req, res) => {
  const data = await getLiveNepseData();
  res.json({ simulatedData: data.summary.simulatedData, indices: data.indices });
});

router.get('/top-gainers', async (req, res) => {
  const data = await getLiveNepseData();
  res.json({ simulatedData: data.summary.simulatedData, gainers: data.gainers });
});

router.get('/top-losers', async (req, res) => {
  const data = await getLiveNepseData();
  res.json({ simulatedData: data.summary.simulatedData, losers: data.losers });
});

router.get('/top-turnover', async (req, res) => {
  const data = await getLiveNepseData();
  res.json({ simulatedData: data.summary.simulatedData, turnover: data.turnover });
});

router.get('/live-market', async (req, res) => {
  const data = await getLiveNepseData();
  res.json({ simulatedData: data.summary.simulatedData, liveMarket: data.liveMarket });
});

router.get('/sub-indices', async (req, res) => {
  const data = await getLiveNepseData();
  res.json({ simulatedData: data.summary.simulatedData, subIndices: data.subIndices });
});

router.get('/graph/:indexName', (req, res) => {
  const indexName = req.params.indexName || 'nepse';
  const script = path.join(__dirname, '../../fetch_graph.py');
  execFile('python', [script, indexName], (err, stdout, stderr) => {
    if (err) {
      console.error('[NEPSE Graph Fetcher] Error:', err.message);
      return res.status(500).json({ error: 'Failed to fetch graph data' });
    }
    try {
      const parsed = JSON.parse(stdout);
      res.json(parsed);
    } catch (parseErr) {
      console.error('[NEPSE Graph Fetcher] Parse Error:', parseErr.message);
      res.status(500).json({ error: 'Failed to parse graph data' });
    }
  });
});

module.exports = router;
