// Port of the AI engine's indicators.py (pandas/numpy) to plain JS.
// Input frames are arrays of {date, open, high, low, close, volume} sorted ascending.

function rsiSeries(closes, period = 14) {
  const n = closes.length;
  const gains = new Array(n).fill(0);
  const losses = new Array(n).fill(0);
  for (let i = 1; i < n; i++) {
    const d = closes[i] - closes[i - 1];
    gains[i] = Math.max(d, 0);
    losses[i] = Math.max(-d, 0);
  }
  // rolling(period, min_periods=1).mean()
  const out = new Array(n).fill(50);
  for (let i = 0; i < n; i++) {
    const start = Math.max(0, i - period + 1);
    let sg = 0, sl = 0;
    for (let j = start; j <= i; j++) { sg += gains[j]; sl += losses[j]; }
    const cnt = i - start + 1;
    const avgGain = sg / cnt;
    const avgLoss = sl / cnt;
    const rs = avgGain / (avgLoss || 1e-9);
    out[i] = 100 - 100 / (1 + rs);
  }
  return out;
}

function emaSeries(values, span) {
  const n = values.length;
  const out = new Array(n);
  const alpha = 2 / (span + 1);
  let prev = values[0];
  out[0] = prev;
  for (let i = 1; i < n; i++) {
    prev = values[i] * alpha + prev * (1 - alpha);
    out[i] = prev;
  }
  return out;
}

function smaSeries(values, period) {
  const n = values.length;
  const out = new Array(n).fill(0);
  let run = 0;
  for (let i = 0; i < n; i++) {
    run += values[i];
    if (i >= period) run -= values[i - period];
    const start = Math.max(0, i - period + 1);
    out[i] = run / (i - start + 1);
  }
  return out;
}

function rollingStd(values, period) {
  const n = values.length;
  const out = new Array(n).fill(0);
  for (let i = 0; i < n; i++) {
    const start = Math.max(0, i - period + 1);
    const cnt = i - start + 1;
    if (cnt < 2) continue;
    let sum = 0;
    for (let j = start; j <= i; j++) sum += values[j];
    const mean = sum / cnt;
    let ss = 0;
    for (let j = start; j <= i; j++) { const d = values[j] - mean; ss += d * d; }
    out[i] = Math.sqrt(ss / (cnt - 1));
  }
  return out;
}

function atrSeries(frame, period = 14) {
  const n = frame.length;
  const tr = new Array(n).fill(0);
  for (let i = 0; i < n; i++) {
    const hl = frame[i].high - frame[i].low;
    if (i === 0) { tr[i] = hl; continue; }
    const hc = Math.abs(frame[i].high - frame[i - 1].close);
    const lc = Math.abs(frame[i].low - frame[i - 1].close);
    tr[i] = Math.max(hl, hc, lc);
  }
  return smaSeries(tr, period);
}

function computeAllIndicators(frame) {
  const n = frame.length;
  const closes = frame.map(r => r.close);
  const rsi = rsiSeries(closes, 14);
  const emaFast = emaSeries(closes, 12);
  const emaSlow = emaSeries(closes, 26);
  const macd = emaFast.map((v, i) => v - emaSlow[i]);
  const macdSignal = emaSeries(macd, 9);
  const macdHist = macd.map((v, i) => v - macdSignal[i]);
  const sma20 = smaSeries(closes, 20);
  const sma50 = smaSeries(closes, 50);
  const ema20 = emaSeries(closes, 20);
  const ema50 = emaSeries(closes, 50);
  const std20 = rollingStd(closes, 20);
  const bbUpper = sma20.map((v, i) => v + std20[i] * 2);
  const bbLower = sma20.map((v, i) => v - std20[i] * 2);
  const bbMiddle = sma20.slice();
  const bbWidth = sma20.map((v, i) => (bbUpper[i] - bbLower[i]) / (v || 1e-9));
  const atr = atrSeries(frame, 14);

  const momentum5d = new Array(n).fill(0);
  if (n > 5) {
    const firstValid = (closes[5] - closes[0]) / closes[0] * 100;
    for (let i = 0; i < n; i++) {
      if (i >= 5 && closes[i - 5] > 0) {
        momentum5d[i] = (closes[i] - closes[i - 5]) / closes[i - 5] * 100;
      } else {
        momentum5d[i] = firstValid;
      }
    }
  }

  const out = new Array(n);
  for (let i = 0; i < n; i++) {
    const r = frame[i];
    out[i] = {
      date: r.date,
      open: r.open,
      high: r.high,
      low: r.low,
      close: r.close,
      volume: r.volume,
      rsi: numOr0(rsi[i]),
      macd: numOr0(macd[i]),
      macd_signal: numOr0(macdSignal[i]),
      macd_hist: numOr0(macdHist[i]),
      sma_20: numOr0(sma20[i]),
      sma_50: numOr0(sma50[i]),
      ema_20: numOr0(ema20[i]),
      ema_50: numOr0(ema50[i]),
      bb_upper: numOr0(bbUpper[i]),
      bb_middle: numOr0(bbMiddle[i]),
      bb_lower: numOr0(bbLower[i]),
      bb_width: numOr0(bbWidth[i]),
      atr: numOr0(atr[i]),
      volatility_pct: r.close > 0 ? numOr0((atr[i] / r.close) * 100) : 0,
      momentum_5d: numOr0(momentum5d[i]),
    };
  }
  return out;
}

function numOr0(v) {
  return isFinite(v) ? v : 0;
}

function toNum(v) {
  try { return v == null ? null : parseFloat(v); } catch (err) { return null; }
}

// Interpret the latest bar in plain words (mirrors indicator_signals).
function indicatorSignals(rows) {
  if (!rows || rows.length < 3) return null;
  const latest = rows[rows.length - 1];
  const close = toNum(latest.close) || 0;

  const rsi = toNum(latest.rsi);
  let rsiState = null;
  if (rsi != null) rsiState = rsi >= 70 ? 'OVERBOUGHT' : rsi <= 30 ? 'OVERSOLD' : 'NEUTRAL';

  const macd = toNum(latest.macd);
  const macdSignal = toNum(latest.macd_signal);
  let macdCross = null;
  let macdState = null;
  if (macd != null && macdSignal != null) {
    macdState = macd >= macdSignal ? 'ABOVE' : 'BELOW';
    const histTail = rows.slice(-6).map(r => toNum(r.macd_hist) || 0);
    for (let i = histTail.length - 1; i > 0; i--) {
      if (histTail[i - 1] <= 0 && histTail[i] > 0) { macdCross = 'BULLISH'; break; }
      if (histTail[i - 1] >= 0 && histTail[i] < 0) { macdCross = 'BEARISH'; break; }
    }
  }

  const sma20 = toNum(latest.sma_20);
  const sma50 = toNum(latest.sma_50);
  const ema20 = toNum(latest.ema_20);
  const ema50 = toNum(latest.ema_50);
  let vsSma20 = null, vsSma50 = null, smaTrend = null;
  if (sma20) vsSma20 = Math.round(((close - sma20) / sma20) * 10000) / 100;
  if (sma50) vsSma50 = Math.round(((close - sma50) / sma50) * 10000) / 100;
  if (sma20 && sma50) smaTrend = sma20 > sma50 ? 'UPTREND' : sma20 < sma50 ? 'DOWNTREND' : 'SIDEWAYS';

  const bbUpper = toNum(latest.bb_upper);
  const bbLower = toNum(latest.bb_lower);
  let bbPosition = null, bbState = null;
  if (bbUpper != null && bbLower != null && bbUpper > bbLower) {
    bbPosition = Math.round(((close - bbLower) / (bbUpper - bbLower)) * 1000) / 10;
    bbState = bbPosition >= 90 ? 'AT_UPPER' : bbPosition >= 60 ? 'UPPER_HALF' : bbPosition <= 10 ? 'AT_LOWER' : 'LOWER_HALF';
  }

  return {
    rsi: rsi != null ? Math.round(rsi * 10) / 10 : null,
    rsiState,
    macd: macd != null ? Math.round(macd * 10000) / 10000 : null,
    macdSignal: macdSignal != null ? Math.round(macdSignal * 10000) / 10000 : null,
    macdHist: macd != null && macdSignal != null ? Math.round((macd - macdSignal) * 10000) / 10000 : null,
    macdCross,
    macdState,
    priceVsSma20: vsSma20,
    priceVsSma50: vsSma50,
    ema20: ema20 != null ? Math.round(ema20 * 100) / 100 : null,
    ema50: ema50 != null ? Math.round(ema50 * 100) / 100 : null,
    smaTrend,
    bbPosition,
    bbState,
    atr: Math.round((toNum(latest.atr) || 0) * 100) / 100,
    volatilityPct: Math.round((toNum(latest.volatility_pct) || 0) * 100) / 100,
    momentum5d: Math.round((toNum(latest.momentum_5d) || 0) * 100) / 100,
  };
}

// Support & resistance from the rolling high/low + classic pivots.
function computeSupportResistance(frame, lookback = 50) {
  if (!frame || frame.length < 10) return null;
  const last = frame.length - 1;
  const start = Math.max(0, last - lookback);
  let window = frame.slice(start, last);
  if (window.length < 5) window = frame.slice(0, last);
  if (!window.length) return null;

  let resistance = -Infinity, support = Infinity;
  for (const r of window) {
    if (r.high > resistance) resistance = r.high;
    if (r.low < support) support = r.low;
  }
  const prev = frame[last - 1];
  const pivot = (prev.high + prev.low + prev.close) / 3;
  const price = frame[last].close;
  const r1 = 2 * pivot - prev.low;
  const r2 = pivot + (prev.high - prev.low);
  const s1 = 2 * pivot - prev.high;
  const s2 = pivot - (prev.high - prev.low);

  const span = resistance > support ? resistance - support : 1e-9;
  const positionPct = Math.round(((price - support) / span) * 1000) / 10;
  const rangePct = support ? Math.round((span / support) * 10000) / 100 : 0;

  return {
    support: Math.round(support * 100) / 100,
    resistance: Math.round(resistance * 100) / 100,
    pivot: Math.round(pivot * 100) / 100,
    r1: Math.round(r1 * 100) / 100,
    r2: Math.round(r2 * 100) / 100,
    s1: Math.round(s1 * 100) / 100,
    s2: Math.round(s2 * 100) / 100,
    positionPct,
    rangePct,
    nearResistance: (resistance - price) <= 0.02 * price,
    nearSupport: (price - support) <= 0.02 * price,
  };
}

// Least-squares log-price regression → projected move + band.
function projectTrend(frame, horizonDays = 10, regLookback = 30) {
  if (!frame || frame.length < 20) return null;
  const closes = frame.map(r => r.close).filter(c => c > 0);
  if (closes.length < 10) return null;
  let series = closes.slice(-regLookback);
  if (series.length < 10) series = closes;

  const m = series.length;
  const logP = series.map(v => Math.log(v));
  const x = Array.from({ length: m }, (_, i) => i);
  const xMean = x.reduce((a, b) => a + b, 0) / m;
  const yMean = logP.reduce((a, b) => a + b, 0) / m;
  let num = 0, den = 0;
  for (let i = 0; i < m; i++) { num += (x[i] - xMean) * (logP[i] - yMean); den += (x[i] - xMean) * (x[i] - xMean); }
  const slope = den > 0 ? num / den : 0;
  const intercept = yMean - slope * xMean;

  let ssRes = 0, ssTot = 0;
  for (let i = 0; i < m; i++) {
    const yhat = slope * x[i] + intercept;
    ssRes += (logP[i] - yhat) * (logP[i] - yhat);
    ssTot += (logP[i] - yMean) * (logP[i] - yMean);
  }
  const r2 = Math.max(0, Math.min(1, 1 - ssRes / (ssTot || 1e-12)));

  const logReturns = [];
  for (let i = 1; i < closes.length; i++) logReturns.push(Math.log(closes[i] / closes[i - 1]));
  const volMean = logReturns.reduce((a, b) => a + b, 0) / Math.max(1, logReturns.length);
  let volSq = 0;
  for (const r of logReturns) volSq += (r - volMean) * (r - volMean);
  const volDaily = logReturns.length > 1 ? Math.sqrt(volSq / (logReturns.length - 1)) : 0;
  const z = 0.5;

  const dailyG = slope;
  const drift = Math.exp(dailyG * horizonDays) - 1;
  const band = volDaily * Math.sqrt(horizonDays) * z;

  const direction = dailyG > 0 ? 'UP' : dailyG < 0 ? 'DOWN' : 'FLAT';
  const quality = r2 >= 0.5 ? 'strong' : r2 >= 0.2 ? 'moderate' : 'weak';

  return {
    direction,
    horizonDays,
    dailyRatePct: Math.round(dailyG * 100000) / 10000,
    expectedMovePct: Math.round(drift * 10000) / 100,
    lowPct: Math.round((drift - band) * 10000) / 100,
    highPct: Math.round((drift + band) * 10000) / 100,
    rSquared: Math.round(r2 * 1000) / 1000,
    trendQuality: quality,
    volatilityDailyPct: Math.round(volDaily * 100000) / 1000,
  };
}

function projectDuration(sr, projection, price) {
  if (!sr || !projection || price == null) return null;
  const dailyRate = projection.dailyRatePct;
  if (dailyRate == null || Math.abs(parseFloat(dailyRate)) < 1e-6) return null;

  const resistance = parseFloat(sr.resistance || 0);
  const support = parseFloat(sr.support || 0);
  const p = parseFloat(price);
  const dailyLogG = parseFloat(dailyRate) / 100;

  function sessionsTo(target) {
    if (target <= 0 || p <= 0) return null;
    const s = Math.log(target / p) / dailyLogG;
    return s > 0 && isFinite(s) ? Math.round(s) : null;
  }

  return {
    sessionsToResistance: sessionsTo(resistance),
    sessionsToSupport: sessionsTo(support),
    resistanceDistancePct: Math.round(((resistance - p) / p) * 10000) / 100,
    supportDistancePct: Math.round(((p - support) / p) * 10000) / 100,
    trendQuality: projection.trendQuality,
    rSquared: projection.rSquared,
    direction: projection.direction,
  };
}

module.exports = {
  computeAllIndicators,
  indicatorSignals,
  computeSupportResistance,
  projectTrend,
  projectDuration,
  rsiSeries,
  emaSeries,
  smaSeries,
};
