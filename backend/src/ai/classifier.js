// Port of the AI engine's ml_model.py (MovementClassifier, ratings) to JS.
// Works on indicator rows produced by indicators.computeAllIndicators.

function _f(v, def) {
  if (v == null) return def != null ? def : 0;
  const x = parseFloat(v);
  return isFinite(x) ? x : (def != null ? def : 0);
}

function _clamp(x, lo = 0, hi = 1) {
  return Math.max(lo, Math.min(hi, x));
}

// Sentiment score normalized to [-1,1] regardless of input scale (-100..100 or -1..1).
function _sent(sentiment) {
  if (!sentiment || sentiment.score == null) return 0;
  let v = _f(sentiment.score);
  if (Math.abs(v) > 2) v = v / 100;
  return Math.max(-1, Math.min(1, v));
}

const WEIGHTS = [0.15, 0.05, 0.50, 0.15, 0.15];

// Returns [trend, momentum, rsi, bb, volume] sub-scores in [0,1].
function computeParts(rows) {
  if (rows.length < 2) return [0.5, 0.5, 0.5, 0.5, 0.5];
  const last = rows[rows.length - 1];
  const close = _f(last.close);
  if (close <= 0) return [0.5, 0.5, 0.5, 0.5, 0.5];

  const sma20 = _f(last.sma_20, 0);
  const sma50 = _f(last.sma_50, 0);
  const ema50 = _f(last.ema_50, 0);

  const aboveS20 = sma20 && close > sma20 ? 1 : 0;
  const aboveS50 = sma50 && close > sma50 ? 1 : 0;
  const aboveE50 = ema50 && close > ema50 ? 1 : 0;
  const slopeUp = sma20 && sma50 && sma20 > sma50 ? 1 : 0;
  const trend = 0.30 * aboveS20 + 0.30 * aboveS50 + 0.20 * aboveE50 + 0.20 * slopeUp;

  const mom5 = _f(last.momentum_5d);
  const momScore = 1 / (1 + Math.exp(-mom5 / 6));
  const macdHist = _f(last.macd_hist);
  let histRising = 1;
  if (rows.length >= 3) {
    const h1 = _f(rows[rows.length - 1].macd_hist);
    const h2 = _f(rows[rows.length - 2].macd_hist);
    const h3 = _f(rows[rows.length - 3].macd_hist);
    histRising = h1 >= h2 && h2 >= h3 ? 1 : 0;
  }
  const momentum = 0.40 * momScore + 0.30 * (macdHist > 0 ? 1 : 0) + 0.30 * histRising;

  const rsi = _f(last.rsi, 50);
  const rsiScore = _clamp((70 - rsi) / 45);

  const bbLow = _f(last.bb_lower, 0);
  const bbUp = _f(last.bb_upper, 0);
  let bbScore = 0.5;
  if (bbUp > bbLow) bbScore = _clamp((close - bbLow) / (bbUp - bbLow));

  const vol = _f(last.volume);
  let volAvg = 0;
  if (rows.length >= 21) {
    let sum = 0;
    for (let i = Math.max(0, rows.length - 21); i < rows.length - 1; i++) sum += _f(rows[i].volume);
    volAvg = sum / 21;
  }
  const volumeScore = volAvg <= 0 ? 0.5 : _clamp(vol / volAvg);

  return [trend, momentum, rsiScore, bbScore, volumeScore];
}

function scoreSeries(rows) {
  const parts = computeParts(rows);
  return WEIGHTS[0] * parts[0] + WEIGHTS[1] * parts[1] + WEIGHTS[2] * parts[2] + WEIGHTS[3] * parts[3] + WEIGHTS[4] * parts[4];
}

function predictMovementProbabilities(rows, sentimentScore = 0) {
  if (!rows || rows.length < 5) {
    return {
      bullishProb: 33.3, neutralProb: 33.4, bearishProb: 33.3,
      signal: 'NEUTRAL', confidenceScore: 0, dataQuality: 'insufficient',
    };
  }

  let score = scoreSeries(rows);
  score = _clamp(score + 0.03 * _f(sentimentScore));

  let bull = Math.max(0, 50 + (score - 0.5) * 100);
  let bear = Math.max(0, 50 - (score - 0.5) * 100);
  const total = bull + bear;
  if (total > 100) {
    const scale = 100 / total;
    bull *= scale;
    bear *= scale;
  }

  const bullP = Math.round(bull * 10) / 10;
  const bearP = Math.round(bear * 10) / 10;
  const neutP = Math.round((100 - bullP - bearP) * 10) / 10;

  let signal, confidence;
  if (score >= 0.55) { signal = 'BULLISH'; confidence = bullP; }
  else if (score <= 0.45) { signal = 'BEARISH'; confidence = bearP; }
  else { signal = 'NEUTRAL'; confidence = Math.round((50 - Math.abs(score - 0.5) * 100) * 10) / 10; }

  const last = rows[rows.length - 1];
  const close = _f(last.close);
  const sma20 = _f(last.sma_20, 0);
  const sma50 = _f(last.sma_50, 0);
  const vol = _f(last.volume);
  let volAvg = 0;
  if (rows.length >= 21) {
    let sum = 0;
    for (let i = Math.max(0, rows.length - 21); i < rows.length - 1; i++) sum += _f(rows[i].volume);
    volAvg = sum / 21;
  }

  const parts = computeParts(rows);
  const featureValues = {
    rsi: Math.round(_f(last.rsi, 50) * 10) / 10,
    macd_hist: Math.round(_f(last.macd_hist) * 1000) / 1000,
    sma_20_ratio: sma20 ? Math.round((close / sma20) * 1000) / 1000 : 1,
    sma_50_ratio: sma50 ? Math.round((close / sma50) * 1000) / 1000 : 1,
    volatility_pct: Math.round(_f(last.volatility_pct, 1.5) * 100) / 100,
    momentum_5d: Math.round(_f(last.momentum_5d) * 100) / 100,
    vol_change: volAvg > 0 ? Math.round((vol / volAvg - 1) * 1000) / 1000 : 0,
    trend_score: Math.round(parts[0] * 1000) / 1000,
    momentum_score: Math.round(parts[1] * 1000) / 1000,
    rsi_score: Math.round(parts[2] * 1000) / 1000,
    bb_score: Math.round(parts[3] * 1000) / 1000,
    volume_score: Math.round(parts[4] * 1000) / 1000,
    score: Math.round(score * 1000) / 1000,
  };

  return {
    bullishProb: bullP,
    neutralProb: neutP,
    bearishProb: bearP,
    signal,
    confidenceScore: confidence,
    featureValues,
    dataQuality: 'technical (real NEPSE OHLCV)',
  };
}

function verdictForScore(score) {
  if (score >= 70) return 'STRONG BUY';
  if (score >= 55) return 'BUY';
  if (score >= 45) return 'HOLD';
  if (score >= 30) return 'SELL';
  return 'STRONG SELL';
}

// Single transparent 0..100 investment score (ml_model.investment_rating).
function investmentRating(prediction, fundamentals, sentiment, marketBias) {
  const parts = [];
  let score = 50;

  if (prediction) {
    const sig = prediction.signal;
    const conf = _f(prediction.confidenceScore);
    if (sig === 'BULLISH') {
      const t = 15 * (0.5 + conf / 200);
      score += t;
      parts.push(['Technical setup', `BULLISH (oversold/pullback entry) ${conf}%`, `+${t.toFixed(1)}`]);
    } else if (sig === 'BEARISH') {
      const t = -15 * (0.5 + conf / 200);
      score += t;
      parts.push(['Technical setup', `BEARISH (overbought/stretched) ${conf}%`, `${t.toFixed(1)}`]);
    } else {
      parts.push(['Technical setup', 'NEUTRAL', '0']);
    }
  }

  if (fundamentals) {
    const pe = fundamentals.peRatio;
    const roe = fundamentals.roe;
    const dy = fundamentals.dividendYield;
    const eps = fundamentals.eps;
    if (eps != null && _f(eps) < 0) {
      score -= 12;
      parts.push(['Profitability', `Loss-making (EPS ${eps})`, '-12']);
    } else {
      if (pe != null && _f(pe) > 0) {
        if (pe < 15) { score += 8; parts.push(['Valuation', `P/E ${pe}x (cheap)`, '+8']); }
        else if (pe < 20) { score += 5; parts.push(['Valuation', `P/E ${pe}x (fair)`, '+5']); }
        else if (pe < 30) { score += 1; parts.push(['Valuation', `P/E ${pe}x`, '+1']); }
        else { score -= 6; parts.push(['Valuation', `P/E ${pe}x (expensive)`, '-6']); }
      }
      if (roe != null && _f(roe) !== 0) {
        if (roe > 18) { score += 7; parts.push(['Returns', `ROE ${roe}% (excellent)`, '+7']); }
        else if (roe > 12) { score += 5; parts.push(['Returns', `ROE ${roe}% (good)`, '+5']); }
        else if (roe > 8) { score += 2; parts.push(['Returns', `ROE ${roe}%`, '+2']); }
        else { score -= 2; parts.push(['Returns', `ROE ${roe}% (weak)`, '-2']); }
      }
      if (dy != null && _f(dy) > 0) {
        if (dy > 4) { score += 6; parts.push(['Income', `Div yield ${dy}%`, '+6']); }
        else if (dy > 2.5) { score += 4; parts.push(['Income', `Div yield ${dy}%`, '+4']); }
        else if (dy > 1.5) { score += 1; parts.push(['Income', `Div yield ${dy}%`, '+1']); }
      }
    }
  }

  if (sentiment && sentiment.available && sentiment.score != null) {
    const s = _sent(sentiment);
    const effect = Math.round(s * 8 * 10) / 10;
    score += effect;
    parts.push(['News sentiment', `${sentiment.label} (${s >= 0 ? '+' : ''}${s})`, `${effect >= 0 ? '+' : ''}${effect}`]);
  } else if (sentiment && sentiment.newsCount) {
    parts.push(['News sentiment', 'no recent news', '0']);
  }

  if (marketBias && marketBias.available) {
    const effect = Math.round(_f(marketBias.bias) * 2 * 10) / 10;
    score += effect;
    parts.push(['Market trend', `NEPSE ${marketBias.trend} (${_f(marketBias.changePct) >= 0 ? '+' : ''}${_f(marketBias.changePct)}%)`, `${effect >= 0 ? '+' : ''}${effect}`]);
  }

  score = Math.round(Math.max(0, Math.min(100, score)) * 10) / 10;
  return { score, verdict: verdictForScore(score), parts };
}

// Multi-factor Master Score (ml_model.master_score).
function masterScore(prediction, fundamentals, sentiment, marketBias, sectorMomentum) {
  const base = investmentRating(prediction, fundamentals, sentiment, marketBias);
  let score = _f(base.score);
  const parts = base.parts.map(p => p.slice());

  const sector = (fundamentals && fundamentals.sector) || 'Others';
  const sm = sectorMomentum ? (sectorMomentum[sector] || sectorMomentum['Others']) : null;
  if (sm) {
    const mom = _f(sm.momentumScore);
    const sectorEffect = Math.round(Math.max(-10, Math.min(10, mom * 0.6)) * 10) / 10;
    score += sectorEffect;
    parts.push(['Sector trend', `${sector}: ${sm.trend || 'NEUTRAL'} (20d ${_f(sm.ret20) >= 0 ? '+' : ''}${_f(sm.ret20)}%)`, `${sectorEffect >= 0 ? '+' : ''}${sectorEffect}`]);
  }

  // Safety sub-score
  let safety = 50;
  if (fundamentals) {
    const eps = fundamentals.eps;
    if (eps != null && _f(eps) < 0) safety -= 25;
    const roe = _f(fundamentals.roe);
    if (roe > 18) safety += 15; else if (roe > 12) safety += 10;
    const pe = _f(fundamentals.peRatio);
    if (pe > 0 && pe < 15) safety += 8; else if (pe >= 30) safety -= 10;
    if (_f(fundamentals.dividendYield) > 3) safety += 5;
  }
  if (prediction) {
    const sig = prediction.signal;
    const conf = _f(prediction.confidenceScore);
    if (sig === 'BEARISH') safety -= 8 + conf / 20;
    else if (sig === 'BULLISH') safety += 5;
  }
  if (sentiment && sentiment.available) safety += Math.max(-10, Math.min(10, _sent(sentiment) * 10));
  if (marketBias && marketBias.available && marketBias.trend === 'FALLING') safety -= 5;
  if (sm) { if (sm.trend === 'WEAKENING') safety -= 8; else if (sm.trend === 'STRENGTHENING') safety += 5; }
  safety = Math.round(Math.max(0, Math.min(100, safety)) * 10) / 10;

  // Upside sub-score
  let upside = 50;
  if (prediction) {
    const sig = prediction.signal;
    const conf = _f(prediction.confidenceScore);
    if (sig === 'BULLISH') upside += 15 + conf / 10;
    else if (sig === 'BEARISH') upside -= 12;
  }
  const peU = _f((fundamentals || {}).peRatio);
  if (peU > 0 && peU < 15) upside += 10; else if (peU >= 30) upside -= 8;
  if (_f((fundamentals || {}).roe) > 12) upside += 5;
  if (marketBias && marketBias.available) upside += Math.max(-6, Math.min(6, _f(marketBias.bias) * 2));
  if (sm) upside += Math.max(-10, Math.min(10, _f(sm.momentumScore) * 0.7));
  if (sentiment && sentiment.available) upside += Math.max(-8, Math.min(8, _sent(sentiment) * 8));
  upside = Math.round(Math.max(0, Math.min(100, upside)) * 10) / 10;

  score = Math.round(Math.max(0, Math.min(100, score)) * 10) / 10;
  return {
    score,
    verdict: verdictForScore(score),
    parts,
    safetyScore: safety,
    upsideScore: upside,
    sector,
  };
}

// Reward/penalty for position inside the recent range (main.py.position_risk_effect).
function positionRiskEffect(sr, rsi) {
  if (!sr) return null;
  const positionPct = sr.positionPct;
  if (positionPct == null) return null;
  const r = rsi != null ? _f(rsi) : null;

  if (sr.nearResistance) return [-8, 'Position risk', 'at resistance — wait for a breakout'];
  if (positionPct >= 75) {
    const detail = `${positionPct}% into range — resistance overhead`;
    if (r != null && r >= 68) return [-8, 'Position risk', `overextended (RSI ${Math.round(r)}) at ${positionPct}% of range`];
    return [-5, 'Position risk', detail];
  }
  if (sr.nearSupport) return [3, 'Position risk', 'near support — good risk/reward'];
  if (positionPct <= 25) return [2, 'Position risk', 'near bottom of range — room to resistance'];
  return null;
}

module.exports = {
  predictMovementProbabilities,
  investmentRating,
  masterScore,
  positionRiskEffect,
  verdictForScore,
  scoreSeries,
};
