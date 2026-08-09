// Central AI analysis pipeline — JS port of the engine's main.py entry points.
// Everything is pure; callers supply OHLCV frames and fundamentals/news.

const { computeAllIndicators, indicatorSignals, computeSupportResistance, projectTrend, projectDuration } = require('./indicators');
const { predictMovementProbabilities, investmentRating, masterScore, positionRiskEffect } = require('./classifier');
const { SentimentAnalyzer } = require('./sentiment');
const { computeRiskMetrics } = require('./risk');
const { analyzeMarketRegime, computeMarketBias } = require('./marketRegime');
const { buildExplanation } = require('./explain');

const sentimentAnalyzer = new SentimentAnalyzer();

// Full single-symbol analysis.
// inputs: {
//   symbol, name, frame (OHLCV asc), fundamentals {peRatio,eps,roe,dividendYield,sector,bookValue},
//   news [{date,title}], indexFrame (NEPSE OHLCV asc), sectorMomentum {SECTOR: {...}}
// }
function analyzeSymbol(inputs) {
  const { symbol, name, frame, fundamentals, news, indexFrame, sectorMomentum } = inputs;
  if (!frame || frame.length < 5) {
    return { symbol, error: 'insufficient data' };
  }

  const ind = computeAllIndicators(frame);
  const lastRow = ind[ind.length - 1];
  const lastClose = lastRow.close;

  const sentiment = news && news.length
    ? sentimentAnalyzer.analyzeNews(news)
    : { score: 0, label: 'NEUTRAL', count: 0, available: false, breakdown: [] };

  const prediction = predictMovementProbabilities(ind, sentiment.score);
  const sr = computeSupportResistance(frame);
  const projection = projectTrend(frame);
  const duration = projectDuration(sr, projection, lastClose);
  const risk = computeRiskMetrics(ind, sr, projection);
  const signals = indicatorSignals(ind);
  const marketBias = computeMarketBias(indexFrame);
  const marketRegime = analyzeMarketRegime(indexFrame);

  const rating = investmentRating(prediction, fundamentals, sentiment, marketBias);
  const master = masterScore(prediction, fundamentals, sentiment, marketBias, sectorMomentum);
  const riskEffect = positionRiskEffect(sr, signals ? signals.rsi : null);

  const explanation = buildExplanation({
    symbol, name, prediction, sr, projection, duration, fundamentals,
    sentiment, marketRegime, risk, rating, master, rowCount: ind.length,
  });

  return {
    symbol,
    name: name || symbol,
    generatedAt: new Date().toISOString(),
    lastPrice: Math.round(lastClose * 100) / 100,
    prediction,
    risk,
    sr,
    projection,
    duration,
    signals,
    fundamentals: fundamentals || null,
    sentiment,
    marketRegime,
    marketBias,
    rating,
    master,
    riskEffect,
    explanation,
    latestRow: lastRow,
  };
}

// Top picks: rank all symbols by master score.
function topPicks(symbolResults, { limit = 5, minBars = 30 } = {}) {
  const ranked = symbolResults
    .filter(r => r.master && r.prediction && (r.bars >= minBars || minBars === 0))
    .sort((a, b) => b.master.score - a.master.score);
  const top = ranked.slice(0, limit);
  return top.map(r => ({
    symbol: r.symbol,
    name: r.name,
    masterScore: r.master.score,
    verdict: r.master.verdict,
    signal: r.prediction.signal,
    confidence: r.prediction.confidenceScore,
    expectedMovePct: r.projection ? r.projection.expectedMovePct : null,
    riskLevel: r.risk ? r.risk.riskLevel : null,
  }));
}

// Market regime for the whole index (used on the dashboard).
function marketRegime(frame) {
  return analyzeMarketRegime(frame);
}

module.exports = {
  analyzeSymbol,
  topPicks,
  marketRegime,
  computeAllIndicators,
  predictMovementProbabilities,
  SentimentAnalyzer,
};
