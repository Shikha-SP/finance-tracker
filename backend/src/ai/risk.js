// Port of the AI engine's risk_metrics.py to JS.
// Input rows = indicator rows (indicators.computeAllIndicators).

function _f(v, def) {
  if (v == null) return def != null ? def : 0;
  const x = parseFloat(v);
  return isFinite(x) ? x : (def != null ? def : 0);
}

function computeRiskMetrics(rows, sr, projection) {
  if (!rows || rows.length < 20) {
    return {
      riskLevel: 'LOW',
      riskScore: 10,
      status: 'insufficient',
      riskDrivers: [],
      technicalStatus: { trend: 'UNKNOWN', momentum: 'UNKNOWN', safety: 'UNKNOWN' },
    };
  }

  const closes = rows.map(r => _f(r.close));
  const latestClose = closes[closes.length - 1];
  const current = rows[rows.length - 1];

  let technicalBuffer = -2;
  let srAdj = 0;
  let srBonus = 0;
  if (sr) {
    if (sr.nearResistance) srAdj = -2;
    if (sr.nearSupport) srBonus = 3;
  }

  const tailVol = rows.slice(-15).reduce((a, r) => a + _f(r.volatility_pct, 1.5), 0) / 15;
  const volScore = Math.round(Math.max(0, Math.min(100, tailVol * 10)) * 10) / 10;
  technicalBuffer += srAdj + srBonus;

  let score = 15 + technicalBuffer + (tailVol < 1.5 ? 8 : tailVol < 3 ? 5 : tailVol < 5 ? 0 : -5);

  const rsi = _f(current.rsi, 50);
  const macdHist = _f(current.macd_hist);
  const sma20 = _f(current.sma_20, 0);
  const sma50 = _f(current.sma_50, 0);

  if (rsi >= 75) score += 15;
  else if (rsi >= 68) score += 8;
  else if (rsi <= 25) score += 15;
  else if (rsi <= 32) score += 8;

  if (macdHist < 0) score += 8;

  const price20 = sma20 ? (latestClose - sma20) / sma20 : 0;
  if (price20 > 0.06) score += 8;
  else if (price20 > 0.03) score += 4;
  else if (price20 < -0.03) score += 6;

  if (sma20 && sma50 && sma20 < sma50) score += 5;

  if (projection) {
    const hi = _f(projection.highPct);
    const lo = _f(projection.lowPct);
    if (lo < -10) score += 10;
    else if (lo < -5) score += 6;
    else if (hi > 25) score += 4;
  }

  const performance = latestClose > 0 ? (latestClose / closes[0] - 1) * 100 : 0;
  const perf = Math.round(performance * 10) / 10;
  const weightedScore = Math.round((0.35 * Math.max(0, 100 - perf) + 0.3 * volScore + 0.35 * Math.max(0, Math.min(100, score))) * 10) / 10;

  let base = 30;
  if (rsi > 70) base -= 5;
  if (rsi > 60) base -= 2;
  if (sma20 && sma50 && sma20 > sma50) base -= 8;
  if (macdHist > 0) base -= 4;
  if (perf > 25) base += 10;
  else if (perf > 15) base += 5;
  else if (perf > 5) base += 2;
  else if (perf < -15) base += 12;
  else if (perf < -8) base += 7;
  else if (perf < 0) base += 3;
  if (tailVol > 3) base += 8;
  else if (tailVol > 5) base += 5;
  if (sr) {
    if (sr.nearResistance) base += 5;
    if (sr.nearSupport) base -= 3;
  }
  const conditionScore = Math.round(Math.max(0, Math.min(100, base)) * 10) / 10;

  const maxLoss = projection ? Math.abs(_f(projection.lowPct)) : 5;
  const liquidationRisk = latestClose > 0 ? Math.round(Math.min(100, Math.max(5, (maxLoss * 4) / latestClose * 100 * 0.4)) * 10) / 10 : 5;

  const riskDrivers = [];
  if (rsi >= 75) riskDrivers.push(`RSI ${Math.round(rsi)} — heavily overbought`);
  if (rsi <= 25) riskDrivers.push(`RSI ${Math.round(rsi)} — deeply oversold`);
  if (macdHist < 0) riskDrivers.push('MACD histogram negative — momentum fading');
  if (price20 > 0.06) riskDrivers.push(`Price ${(price20 * 100).toFixed(1)}% above 20-day SMA — stretched`);
  if (perf > 25) riskDrivers.push(`+${perf.toFixed(1)}% over period — profit-taking risk`);
  if (perf < -15) riskDrivers.push(`${perf.toFixed(1)}% drawdown — falling knife`);
  if (tailVol > 4) riskDrivers.push(`Volatility ${tailVol.toFixed(1)}%/day — elevated`);
  if (sr && sr.nearResistance) riskDrivers.push('At resistance — rejection risk');

  const labels = {
    75: 'EXTREME',
    60: 'HIGH',
    40: 'MODERATE',
    0: 'LOW',
  };
  const riskScore = Math.round(Math.max(0, Math.min(100, weightedScore)) * 10) / 10;
  let riskLevel = 'LOW';
  for (const threshold of [75, 60, 40, 0]) {
    if (riskScore >= threshold) { riskLevel = labels[threshold]; break; }
  }

  if (conditionScore >= 75 && riskLevel !== 'EXTREME') riskLevel = 'EXTREME';
  if (conditionScore <= 25 && riskLevel === 'EXTREME') riskLevel = 'HIGH';

  return {
    riskLevel,
    riskScore,
    status: 'complete',
    riskDrivers,
    technicalStatus: {
      trend: sma20 && sma50 ? (sma20 > sma50 ? 'UPTREND' : sma20 < sma50 ? 'DOWNTREND' : 'SIDEWAYS') : 'UNKNOWN',
      momentum: macdHist >= 0 ? 'POSITIVE' : 'NEGATIVE',
      safety: rsi > 65 ? 'OVERHEATED' : rsi < 35 ? 'STABLE_LOW' : 'MODERATE',
    },
    volatilityScore: volScore,
    conditionScore,
    weightedScore: weightedScore,
    performancePct: perf,
    projectedRange: projection ? { low: projection.lowPct, high: projection.highPct } : null,
    liquidationRisk,
  };
}

module.exports = { computeRiskMetrics };
