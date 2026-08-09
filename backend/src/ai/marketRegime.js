// Port of the AI engine's market_regime.py to JS.
// Frame entries: {date, open?, high?, low?, close, volume} sorted ascending.

const { smaSeries } = require('./indicators');

function _f(v, def) {
  if (v == null) return def != null ? def : 0;
  const x = parseFloat(v);
  return isFinite(x) ? x : (def != null ? def : 0);
}

function _std(values) {
  if (values.length < 2) return 0;
  const m = values.reduce((a, b) => a + b, 0) / values.length;
  let s = 0;
  for (const v of values) s += (v - m) * (v - m);
  return Math.sqrt(s / (values.length - 1));
}

function analyzeMarketRegime(frame) {
  const empty = {
    regime: 'NEUTRAL',
    score: 0,
    signals: [],
    metrics: {},
    dataQuality: 'insufficient',
    momentumScore: 0,
    regimeChange: 'STABLE',
  };
  if (!frame || frame.length < 60) return empty;

  const n = frame.length;
  const closes = frame.map(r => _f(r.close));
  const volumes = frame.map(r => _f(r.volume));
  const lastClose = closes[n - 1];
  const firstClose = closes[0];

  const sma20 = smaSeries(closes, 20);
  const sma50 = smaSeries(closes, 50);
  const sma20Now = sma20[n - 1];
  const sma20Prev = sma20[n - 21];
  const sma50Now = sma50[n - 1];

  // EMA-based MACD for regime
  const ema12 = [closes[0]], ema26 = [closes[0]];
  const a12 = 2 / 13, a26 = 2 / 27;
  for (let i = 1; i < n; i++) {
    ema12.push(closes[i] * a12 + ema12[i - 1] * (1 - a12));
    ema26.push(closes[i] * a26 + ema26[i - 1] * (1 - a26));
  }
  const macdLine = ema12.map((v, i) => v - ema26[i]);
  const macdSig = [macdLine[0]];
  const aSig = 2 / 10;
  for (let i = 1; i < n; i++) macdSig.push(macdLine[i] * aSig + macdSig[i - 1] * (1 - aSig));

  const returns = [];
  for (let i = 1; i < n; i++) returns.push(Math.log(closes[i] / closes[i - 1]));
  const volDaily = _std(returns) * 100;

  const sma20Vols = smaSeries(volumes, 20);
  const recentVol = sma20Vols[n - 1];
  const prevVol = sma20Vols[n - 26];
  const volRising = prevVol > 0 && recentVol > prevVol * 1.05;

  const ret5 = closes[n - 1] / closes[n - 6] - 1;
  const ret20 = closes[n - 1] / closes[n - 21] - 1;
  const priceVsSma20 = lastClose / sma20Now - 1;

  const nearHigh = lastClose >= Math.max(...closes.slice(-60)) * 0.985;
  const nearLow = lastClose <= Math.min(...closes.slice(-60)) * 1.015;

  const signals = [
    { name: 'Price above 20d SMA', weight: 1.5, active: priceVsSma20 > 0.005, weightActive: priceVsSma20 > 0.005 ? Math.abs(priceVsSma20 * 100) : 0 },
    { name: '20d SMA rising', weight: 1.5, active: sma20Now > sma20Prev, weightActive: sma20Prev > 0 ? ((sma20Now / sma20Prev - 1) * 100) : 0 },
    { name: 'Golden cross (20>50)', weight: 1.2, active: sma20Now > sma50Now, weightActive: 1 },
    { name: 'MACD above signal', weight: 1.0, active: macdLine[n - 1] > macdSig[n - 1], weightActive: 1 },
    { name: '5-day positive', weight: 0.7, active: ret5 > 0, weightActive: ret5 * 100 },
    { name: '20-day positive', weight: 0.7, active: ret20 > 0, weightActive: ret20 * 100 },
    { name: 'Volume expanding', weight: 0.6, active: volRising, weightActive: 1 },
    { name: 'Near 60d high', weight: 0.8, active: nearHigh, weightActive: 1 },
    { name: 'Near 60d low', weight: -0.8, active: nearLow, weightActive: 1 },
  ];

  let score = 0;
  for (const s of signals) score += s.active ? s.weight : 0;
  score = Math.round(score * 10) / 10;

  let regime;
  if (score >= 6.5) regime = 'BULL_MOMENTUM';
  else if (score >= 4.5) regime = 'BULL';
  else if (score >= 2.5) regime = 'ACCUMULATION';
  else if (score >= 0) regime = 'CONSOLIDATION';
  else if (score >= -1.5) regime = 'DISTRIBUTION';
  else if (score >= -3.5) regime = 'BEAR';
  else regime = 'BEAR_MOMENTUM';

  if (volDaily > 4.5 && regime === 'CONSOLIDATION') regime = 'HIGH_VOL';
  if (volDaily > 6) regime = regime + '_VOL';

  const regimeChange = (() => {
    const mid = Math.max(20, Math.floor(n / 2));
    const prevCloses = closes.slice(0, mid);
    const nowCloses = closes.slice(mid);
    const avgNow = nowCloses.reduce((a, b) => a + b, 0) / nowCloses.length;
    const avgPrev = prevCloses.reduce((a, b) => a + b, 0) / prevCloses.length;
    const change = avgPrev > 0 ? (avgNow / avgPrev - 1) * 100 : 0;
    if (change > 5) return 'IMPROVING';
    if (change < -5) return 'DETERIORATING';
    return 'STABLE';
  })();

  const momentumScore = Math.round(Math.max(0, Math.min(100, 50 + score * 6)) * 10) / 10;

  return {
    regime,
    score,
    signals,
    regimeChange,
    momentumScore,
    dataQuality: 'complete',
    metrics: {
      lastClose: Math.round(lastClose * 100) / 100,
      ret5Pct: Math.round(ret5 * 1000) / 10,
      ret20Pct: Math.round(ret20 * 1000) / 10,
      volDailyPct: Math.round(volDaily * 100) / 100,
      priceVsSma20Pct: Math.round(priceVsSma20 * 1000) / 10,
      sma20: Math.round(sma20Now * 100) / 100,
      sma50: Math.round(sma50Now * 100) / 100,
      volumeRising: volRising,
    },
  };
}

// Simple NEPSE-wide market bias for master scoring (main.py market_bias).
function computeMarketBias(indexFrame) {
  if (!indexFrame || indexFrame.length < 5) return { available: false, trend: 'SIDEWAYS', changePct: 0, bias: 0 };
  const closes = indexFrame.map(r => _f(r.close)).filter(c => c > 0);
  if (closes.length < 5) return { available: false, trend: 'SIDEWAYS', changePct: 0, bias: 0 };
  const last = closes[closes.length - 1];
  const short = last / closes[Math.max(0, closes.length - 6)] - 1;
  const med = closes.length > 21 ? last / closes[closes.length - 21] - 1 : short;
  const long = closes.length > 60 ? last / closes[closes.length - 60] - 1 : med;
  const changePct = Math.round(med * 1000) / 10;
  const trend = long > 0.02 ? 'RISING' : long < -0.02 ? 'FALLING' : 'SIDEWAYS';
  const bias = Math.max(-1, Math.min(1, Math.round((0.2 * short + 0.5 * med + 0.3 * long) * 20) / 20));
  return { available: true, trend, changePct, bias, ret5Pct: Math.round(short * 1000) / 10, ret20Pct: Math.round(med * 1000) / 10, ret60Pct: Math.round(long * 1000) / 10 };
}

module.exports = { analyzeMarketRegime, computeMarketBias };
