// JS port of ai_engine/backtester.py — AI Buy Signal Strategy vs Buy & Hold.
// Input: ascending OHLCV rows. Output: same shape the frontend expects.

const { computeAllIndicators } = require('./indicators');

const round2 = (v) => Math.round(v * 100) / 100;

function runStrategyBacktest(rows, initialCapital = 100000, minConfidence = 60) {
  const ind = computeAllIndicators(rows);
  const n = ind.length;

  if (n < 20) {
    return {
      error: true,
      message: `Insufficient price history for backtesting. Need at least 20 data points, got ${n}.`,
      summary: {
        initialCapital,
        aiFinalValue: initialCapital,
        bhFinalValue: initialCapital,
        aiReturnPct: 0.0,
        bhReturnPct: 0.0,
        aiCagr: 0.0,
        bhCagr: 0.0,
        maxAiDrawdown: 0.0,
        maxBhDrawdown: 0.0,
        sharpeRatio: 0.0,
        totalTrades: 0,
        winRate: 0.0,
      },
      equityCurve: [],
    };
  }

  const sorted = ind.slice().sort((a, b) => (a.date < b.date ? -1 : a.date > b.date ? 1 : 0));

  // 1. Buy & Hold strategy
  const startPrice = sorted[0].close;
  const bhShares = initialCapital / startPrice;
  const bhEquity = sorted.map(r => r.close * bhShares);

  // 2. AI signal simulation
  const aiEquity = [];
  let aiCash = initialCapital;
  let aiShares = 0;
  let inPosition = false;
  let trades = 0;
  let winningTrades = 0;
  let entryPrice = 0.0;

  for (let i = 0; i < n; i++) {
    const currPrice = sorted[i].close;
    const rsi = sorted[i].rsi != null ? sorted[i].rsi : 50;
    const macdH = sorted[i].macd_hist != null ? sorted[i].macd_hist : 0;

    const isAiBuy = rsi < 62.0 && rsi > 45.0 && macdH > 0.1;
    const isAiSell = rsi > 70.0 || macdH < -0.3;

    if (!inPosition && isAiBuy) {
      aiShares = aiCash / currPrice;
      aiCash = 0;
      inPosition = true;
      entryPrice = currPrice;
      trades += 1;
    } else if (inPosition && isAiSell) {
      aiCash = aiShares * currPrice;
      if (currPrice > entryPrice) winningTrades += 1;
      aiShares = 0;
      inPosition = false;
    }

    aiEquity.push(aiCash + aiShares * currPrice);
  }

  const finalAiVal = aiEquity[n - 1];
  const finalBhVal = bhEquity[n - 1];

  const aiReturn = ((finalAiVal - initialCapital) / initialCapital) * 100.0;
  const bhReturn = ((finalBhVal - initialCapital) / initialCapital) * 100.0;

  const years = Math.max(1.0, n / 252.0);
  const aiCagr = (Math.pow(finalAiVal / initialCapital, 1.0 / years) - 1.0) * 100.0;
  const bhCagr = (Math.pow(finalBhVal / initialCapital, 1.0 / years) - 1.0) * 100.0;

  // Drawdowns
  let aiPeak = -Infinity;
  let maxAiDd = 0;
  let bhPeak = -Infinity;
  let maxBhDd = 0;
  for (let i = 0; i < n; i++) {
    if (aiEquity[i] > aiPeak) aiPeak = aiEquity[i];
    if (aiPeak > 0) maxAiDd = Math.max(maxAiDd, Math.abs(((aiEquity[i] - aiPeak) / aiPeak) * 100));
    if (bhEquity[i] > bhPeak) bhPeak = bhEquity[i];
    if (bhPeak > 0) maxBhDd = Math.max(maxBhDd, Math.abs(((bhEquity[i] - bhPeak) / bhPeak) * 100));
  }

  // Sharpe ratio (assumes 5% risk-free rate; sample std like pandas ddof=1)
  const returns = [];
  for (let i = 1; i < n; i++) returns.push(aiEquity[i] / aiEquity[i - 1] - 1);
  let sharpe = 0;
  if (returns.length >= 2) {
    const mean = returns.reduce((s, v) => s + v, 0) / returns.length;
    const variance = returns.reduce((s, v) => s + (v - mean) * (v - mean), 0) / (returns.length - 1);
    const std = Math.sqrt(variance);
    if (isFinite(std)) sharpe = (mean * 252 - 0.05) / (std * Math.sqrt(252) + 1e-9);
  }
  sharpe = round2(sharpe);

  const winRate = Math.round((winningTrades / Math.max(1, trades)) * 100 * 10) / 10;

  const chartData = [];
  const step = Math.max(1, Math.floor(n / 120));
  for (let i = 0; i < n; i += step) {
    chartData.push({
      date: String(sorted[i].date).slice(0, 10),
      aiStrategy: round2(aiEquity[i]),
      buyAndHold: round2(bhEquity[i]),
      price: round2(sorted[i].close),
    });
  }

  return {
    summary: {
      initialCapital,
      aiFinalValue: round2(finalAiVal),
      bhFinalValue: round2(finalBhVal),
      aiReturnPct: round2(aiReturn),
      bhReturnPct: round2(bhReturn),
      aiCagr: round2(aiCagr),
      bhCagr: round2(bhCagr),
      maxAiDrawdown: round2(maxAiDd),
      maxBhDrawdown: round2(maxBhDd),
      sharpeRatio: sharpe,
      totalTrades: trades,
      winRate,
    },
    equityCurve: chartData,
  };
}

module.exports = { runStrategyBacktest };
