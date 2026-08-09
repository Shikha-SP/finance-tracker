// Bridges the JS AI engine (src/ai/*) to the REST response shapes the
// frontend already expects (kept identical to the Python engine's output).

const dataLoader = require('./dataLoader');
const {
  analyzeSymbol: runAnalysis,
  marketRegime,
} = require('./index');
const { smaSeries } = require('./indicators');
const { SentimentAnalyzer } = require('./sentiment');
const { computeMarketBias } = require('./marketRegime');

const analyzer = new SentimentAnalyzer();

const INDEX_SYMBOL = 'INDEX_NEPSE';

function _f(v, def) {
  if (v == null) return def != null ? def : 0;
  const x = parseFloat(v);
  return isFinite(x) ? x : (def != null ? def : 0);
}

function _r(v, digits = 2) {
  return Math.round(_f(v) * Math.pow(10, digits)) / Math.pow(10, digits);
}

// Map the raw JS regime label to the frontend's UPTREND/SIDEWAYS/DOWNTREND.
function mapRegimeLabel(raw) {
  const r = String(raw || '').toUpperCase();
  if (r.includes('BEAR') || r.includes('DISTRIBUTION') || r.includes('DOWNTREND') || (r.includes('VOL') && !r.includes('BULL'))) return 'DOWNTREND';
  if (r.includes('BULL') || r.includes('ACCUMULATION') || r.includes('UPTREND')) return 'UPTREND';
  return 'SIDEWAYS';
}

function getIndexFrame() {
  const hist = dataLoader.loadIndexHistory();
  return hist.slice(-250);
}

function sentimentForSymbol(symbol) {
  const items = dataLoader.loadNewsForSymbol(symbol);
  const now = Date.now();
  const cutoff = now - dataLoader.NEWS_RECENT_MAX_DAYS * 24 * 3600 * 1000;
  const recent = items.filter(it => {
    const d = dataLoader.parseDate(it.pubDate);
    return !d || d.getTime() >= cutoff;
  });

  const articles = recent.slice(0, 25).map(it => ({
    title: it.title || '',
    url: it.url || '#',
    pubDate: it.pubDate,
    publishedAgo: dataLoader.relativeTime(it.pubDate),
    sentimentLabel: it.llmLabel || it.sentimentLabel || 'NEUTRAL',
    sentimentScore: it.llmScore ?? it.sentimentScore ?? null,
  }));

  const hasLlm = articles.some(a => a.sentimentLabel !== 'NEUTRAL' || a.sentimentScore != null);
  const model = hasLlm ? 'llm-groq' : 'local-nlp';

  let score = null;
  const scored = articles.filter(a => a.sentimentScore != null);
  if (scored.length) {
    score = scored.reduce((s, a) => s + _f(a.sentimentScore, 0), 0) / scored.length;
  } else {
    const local = analyzer.analyze(articles.map(a => a.title));
    score = _f(local.score) / 100;
  }
  score = Math.max(-1, Math.min(1, _r(score, 3)));
  const label = score >= 0.1 ? 'BULLISH' : score <= -0.1 ? 'BEARISH' : 'NEUTRAL';

  const keywords = {};
  for (const it of items) {
    for (const k of (it.llmKeywords || [])) if (k) keywords[k] = (keywords[k] || 0) + 1;
  }
  const topKeywords = Object.entries(keywords).sort((a, b) => b[1] - a[1]).slice(0, 8).map(k => k[0]);

  return {
    label,
    score,
    newsCount: recent.length,
    recent: recent.length > 0,
    lastNewsAgo: recent.length ? dataLoader.relativeTime(recent[0].pubDate) : null,
    lastNewsDate: recent.length ? recent[0].pubDate : null,
    sentimentModel: model,
    topKeywords,
    articles,
  };
}

function technicalForRow(last) {
  return {
    rsi: _r(last.rsi, 1),
    sma20: _r(last.sma_20),
    sma50: _r(last.sma_50),
    ema20: _r(last.ema_20),
    ema50: _r(last.ema_50),
    macd: _r(last.macd, 4),
    macdSignal: _r(last.macd_signal, 4),
    macdHist: _r(last.macd_hist, 4),
    bollinger: { upper: _r(last.bb_upper), middle: _r(last.bb_middle), lower: _r(last.bb_lower) },
    atr: _r(last.atr),
    volatilityPct: _r(last.volatility_pct),
    momentum5dPct: _r(last.momentum_5d),
  };
}

function explainableFrom(result) {
  const positiveReasons = [];
  const negativeReasons = [];
  for (const p of (result.master && result.master.parts) || []) {
    const eff = String(p[2] || '0');
    const text = `${p[0]}: ${p[1]}`;
    if (eff.startsWith('+')) positiveReasons.push(text);
    else if (eff.startsWith('-')) negativeReasons.push(text);
  }
  for (const d of (result.risk && result.risk.riskDrivers) || []) negativeReasons.push(d);
  if (result.riskEffect && result.riskEffect[0] && result.riskEffect[0] < 0) {
    negativeReasons.push(`${result.riskEffect[2]}`);
  }
  return {
    positiveReasons: positiveReasons.slice(0, 6),
    negativeReasons: negativeReasons.slice(0, 6),
  };
}

function buildAnalysis(symbol) {
  const clean = String(symbol || '').toUpperCase().trim();
  const hist = dataLoader.loadPriceHistory();
  const frame = hist[clean];
  if (!frame || frame.length < 5) {
    return { error: true, message: `No price history for ${clean}.`, symbol: clean };
  }

  const meta = dataLoader.loadCompanyMeta()[clean] || {};
  const fundamentals = dataLoader.loadFundamentals()[clean] || {};
  const news = dataLoader.loadNewsForSymbol(clean);
  const sentiment = sentimentForSymbol(clean);
  const sectorMomentum = dataLoader.loadSectorMomentum();
  const indexFrame = getIndexFrame();

  const result = runAnalysis({
    symbol: clean,
    name: fundamentals.name || meta.name || `${clean} Enterprise Ltd.`,
    frame,
    fundamentals: {
      sector: fundamentals.sector || meta.sector || null,
      peRatio: fundamentals.peRatio,
      pbRatio: fundamentals.pbRatio,
      eps: fundamentals.eps,
      roe: fundamentals.roe,
      dividendYield: fundamentals.dividendYield,
      bookValue: fundamentals.bookValue,
      marketCap: fundamentals.marketCap,
    },
    news,
    indexFrame,
    sectorMomentum,
  });

  if (result.error) return { error: true, message: result.error, symbol: clean };

  const chartData = frame.slice(-250).map(r => ({ date: String(r.date).slice(0, 10), close: r.close }));
  const baseSentiment = result.sentiment && result.sentiment.available
    ? { label: mapSentimentLabel(result.sentiment.label), score: _r(result.sentiment.score / 100, 3) }
    : { label: sentiment.label, score: sentiment.score };

  return {
    symbol: clean,
    companyName: result.name,
    sector: fundamentals.sector || meta.sector || 'Others',
    currentPrice: result.lastPrice,
    chartData,
    technicalIndicators: technicalForRow(result.latestRow),
    prediction: {
      signal: result.prediction.signal,
      bullishProb: result.prediction.bullishProb,
      neutralProb: result.prediction.neutralProb,
      bearishProb: result.prediction.bearishProb,
      confidenceScore: result.prediction.confidenceScore,
      featureValues: result.prediction.featureValues,
    },
    explainableAI: explainableFrom(result),
    investmentRating: {
      verdict: result.rating.verdict,
      score: result.rating.score,
      parts: result.rating.parts,
    },
    masterScore: result.master,
    supportResistance: result.sr || null,
    trendProjection: result.projection || null,
    duration: result.duration || null,
    fundamentals: {
      peRatio: result.fundamentals && result.fundamentals.peRatio,
      pbRatio: result.fundamentals && result.fundamentals.pbRatio,
      eps: result.fundamentals && result.fundamentals.eps,
      dividendYield: result.fundamentals && result.fundamentals.dividendYield,
      roe: result.fundamentals && result.fundamentals.roe,
      marketCap: result.fundamentals && result.fundamentals.marketCap,
    },
    sentiment: {
      ...sentiment,
      score: baseSentiment.score,
      label: baseSentiment.label,
    },
    risk: result.risk,
    marketBias: result.marketBias,
    regime: result.marketRegime ? mapRegimeLabel(result.marketRegime.regime) : 'SIDEWAYS',
    explanation: result.explanation,
    engine: 'local-js',
  };
}

function mapSentimentLabel(label) {
  if (label === 'POSITIVE') return 'BULLISH';
  if (label === 'NEGATIVE') return 'BEARISH';
  return 'NEUTRAL';
}

function buildMarketRegime() {
  const indexFrame = getIndexFrame();
  if (!indexFrame.length) return { error: true, message: 'No NEPSE index history available.' };

  const reg = marketRegime(indexFrame);
  const frame = indexFrame.slice(-150);
  const closes = frame.map(r => _f(r.close));
  const lastIndex = closes[closes.length - 1];
  const prevIndex = closes[closes.length - 2];
  const indexDailyChangePct = prevIndex ? _r((lastIndex / prevIndex - 1) * 100, 2) : 0;

  const hist = dataLoader.loadPriceHistory();
  const rets5 = [], rets20 = [], aboveSma = [];
  let total = 0, up = 0;
  for (const sym of dataLoader.getSymbolList()) {
    const rows = hist[sym];
    if (!rows || rows.length < 30) continue;
    const c = rows.map(r => _f(r.close));
    const last = c[c.length - 1];
    if (last <= 0) continue;
    total++;
    if (c.length >= 6) rets5.push((last / c[c.length - 6] - 1) * 100);
    if (c.length >= 21) rets20.push((last / c[c.length - 21] - 1) * 100);
    const sma20 = smaSeries(c, 20);
    if (last > sma20[sma20.length - 1]) up++;
  }
  const median = arr => arr.length ? arr.slice().sort((a, b) => a - b)[Math.floor(arr.length / 2)] : null;
  const median5dReturn = median(rets5);
  const median20dReturn = median(rets20);
  const pctAboveSma20 = total ? Math.round((up / total) * 1000) / 10 : null;

  const regime = mapRegimeLabel(reg.regime);
  const maxPositionPct = regime === 'UPTREND' ? 100 : regime === 'SIDEWAYS' ? 50 : 20;
  const advice = regime === 'UPTREND'
    ? 'Breadth and trend are positive. Proceed with conviction but respect entries near support.'
    : regime === 'DOWNTREND'
      ? 'Market is falling — keep positions small, use tight stops, prefer cash.'
      : 'Mixed tape — only act on the strongest individual setups, avoid chasing.'; 

  return {
    regime,
    rawRegime: reg.regime,
    score: reg.score,
    momentumScore: reg.momentumScore,
    asOf: indexFrame[indexFrame.length - 1].date || new Date().toISOString(),
    index: _r(lastIndex),
    indexDailyChangePct,
    median5dReturn: median5dReturn != null ? _r(median5dReturn) : null,
    median20dReturn: median20dReturn != null ? _r(median20dReturn) : null,
    pctAboveSma20,
    maxPositionPct,
    advice,
    signals: reg.signals,
    engine: 'local-js',
  };
}

function buildScreener({ sector, maxPe, strategy, top }) {
  const sectorFilter = String(sector || 'ALL').toUpperCase().trim();
  const maxPeNum = maxPe != null && maxPe !== '' ? parseFloat(maxPe) : 60;
  const strategyName = strategy || 'both';
  const topN = top ? parseInt(top, 10) : 5;

  const hist = dataLoader.loadPriceHistory();
  const meta = dataLoader.loadCompanyMeta();
  const fundCache = dataLoader.loadFundamentals();
  const sectorMomentum = dataLoader.loadSectorMomentum();
  const indexFrame = getIndexFrame();
  const marketBias = computeMarketBias(indexFrame);

  const symbols = dataLoader.getSymbolList().filter(s => s !== INDEX_SYMBOL);
  const scored = [];

  for (const sym of symbols) {
    const frame = hist[sym];
    if (!frame || frame.length < 30) continue;
    const f = fundCache[sym] || {};
    const sectorName = (f.sector || meta[sym]?.sector || 'Others');
    if (sectorFilter !== 'ALL' && sectorName.toUpperCase() !== sectorFilter) continue;
    const pe = f.peRatio;
    if (pe != null && pe > 0 && pe > maxPeNum) continue;

    const news = dataLoader.loadNewsForSymbol(sym);
    const sentiment = sentimentForSymbol(sym);
    const res = runAnalysis({
      symbol: sym,
      name: f.name || meta[sym]?.name || sym,
      frame,
      fundamentals: {
        sector: sectorName,
        peRatio: pe,
        pbRatio: f.pbRatio,
        eps: f.eps,
        roe: f.roe,
        dividendYield: f.dividendYield,
        marketCap: f.marketCap,
      },
      news,
      indexFrame,
      sectorMomentum,
    });
    if (res.error || !res.master || !res.prediction) continue;

    const pass = strategyName === 'fundamental'
      ? res.rating.score >= 45
      : strategyName === 'technical'
        ? res.prediction.signal !== 'BEARISH' && res.prediction.confidenceScore >= 50
        : res.master.score >= 45 && res.prediction.signal !== 'BEARISH';
    if (!pass) continue;

    scored.push({
      symbol: sym,
      name: res.name,
      sector: sectorName,
      price: res.lastPrice,
      peRatio: pe,
      aiSignal: res.prediction.signal,
      bullishProb: res.prediction.bullishProb,
      sentimentLabel: sentiment.label,
      sentimentScore: sentiment.score,
      ratingVerdict: res.master.verdict,
      rating: res.master.score,
      ratingParts: res.rating.parts,
      rsi: res.latestRow ? _r(res.latestRow.rsi, 1) : null,
      confidenceScore: res.prediction.confidenceScore,
      support: res.sr ? res.sr.support : null,
      resistance: res.sr ? res.sr.resistance : null,
      positionPct: res.sr ? res.sr.positionPct : null,
      nearResistance: res.sr ? res.sr.nearResistance : null,
      nearSupport: res.sr ? res.sr.nearSupport : null,
      masterScore: res.master.score,
    });
  }

  scored.sort((a, b) => b.masterScore - a.masterScore);
  const topPicks = scored.slice(0, topN);
  const topSectors = Object.entries(sectorMomentum)
    .map(([name, s]) => ({ name, momentumScore: _f(s.momentumScore, 2), ret20: _r(s.ret20, 1), ret5: _r(s.ret5, 1), trend: s.trend, pctAboveSma20: _f(s.pctAboveSma20, 1), members: s.members }))
    .sort((a, b) => b.momentumScore - a.momentumScore)
    .slice(0, 8);

  const reg = buildMarketRegime();
  return {
    screenerResults: scored.slice(0, 60),
    topPicks,
    topSectors,
    marketBias: marketBias.available ? { ...marketBias, changePct: _r(marketBias.changePct, 2) } : null,
    marketRegime: reg,
    asOf: reg.asOf,
    strategy: strategyName,
    count: scored.length,
    engine: 'local-js',
  };
}

module.exports = {
  buildAnalysis,
  buildMarketRegime,
  buildScreener,
  sentimentForSymbol,
};
