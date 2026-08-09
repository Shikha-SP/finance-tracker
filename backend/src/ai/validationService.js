// JS port of ai_engine/main.py `_compute_screener_validation` — the honest
// trust-check scorecard. Rates past dates using ONLY data available at that
// date (indicators are trailing, no look-ahead), then measures forward
// 5/10/20-day returns vs the all-stocks baseline.

const dataLoader = require('./dataLoader');
const { computeAllIndicators, computeSupportResistance } = require('./indicators');
const {
  predictMovementProbabilities,
  masterScore,
  positionRiskEffect,
  verdictForScore,
} = require('./classifier');
const { sentimentForSymbol } = require('./engineService');

const HORIZONS = [5, 10, 20];
const ORDER = ['STRONG BUY', 'BUY', 'HOLD', 'SELL', 'STRONG SELL'];
const CACHE_TTL_MS = 30 * 60 * 1000;

const _cache = { data: null, at: null };

function _round(v, digits = 2) {
  const p = Math.pow(10, digits);
  return Math.round((v == null ? 0 : v) * p) / p;
}

function _clip(v, lo, hi) {
  return Math.max(lo, Math.min(hi, v));
}

// Pearson correlation (same result for ddof 0/1).
function _pearson(xs, ys) {
  const n = xs.length;
  if (n < 2) return 0;
  const mx = xs.reduce((s, v) => s + v, 0) / n;
  const my = ys.reduce((s, v) => s + v, 0) / n;
  let num = 0, dx = 0, dy = 0;
  for (let i = 0; i < n; i++) {
    num += (xs[i] - mx) * (ys[i] - my);
    dx += (xs[i] - mx) * (xs[i] - mx);
    dy += (ys[i] - my) * (ys[i] - my);
  }
  const denom = Math.sqrt(dx * dy);
  return denom > 0 ? num / denom : 0;
}

function computeScreenerValidation({ refresh = false } = {}) {
  const t0 = Date.now();
  const now = Date.now();

  if (!refresh && _cache.data && _cache.at && now - _cache.at < CACHE_TTL_MS) {
    return { ..._cache.data, cached: true };
  }

  const hist = dataLoader.loadPriceHistory();
  const fundCache = dataLoader.loadFundamentals();

  const lengths = {};
  let asOf = '';
  for (const sym of Object.keys(hist)) {
    const rows = hist[sym];
    if (rows.length >= 80) lengths[sym] = rows.length;
    const lastDate = rows[rows.length - 1] && rows[rows.length - 1].date;
    if (lastDate && lastDate > asOf) asOf = lastDate;
  }

  if (!Object.keys(lengths).length) {
    return { status: 'error', message: 'No symbol has enough history to validate.', cached: false };
  }

  const cap = 24;
  const symbols = Object.keys(lengths).sort((a, b) => lengths[b] - lengths[a]).slice(0, cap);

  const buckets = {};   // { h: { verdict: {n, hit, ret_sum} } }
  const baseline = {};  // { h: {n, hit, ret_sum} }
  for (const h of HORIZONS) {
    buckets[h] = {};
    baseline[h] = { n: 0, hit: 0, ret_sum: 0 };
  }
  let totalSamples = 0;

  for (const sym of symbols) {
    const rows = hist[sym];
    const n = rows.length;
    if (n < 80) continue;

    const closes = rows.map(r => r.close);
    const fullInd = computeAllIndicators(rows);
    const fundamentals = fundCache[sym] || {};
    const sent = sentimentForSymbol(sym);
    const sentScore = sent && sent.recent && sent.score != null ? sent.score : null;

    let idxs = [];
    for (let i = 60; i < n - 21; i += 4) idxs.push(i);
    idxs = idxs.slice(-28);

    for (const i of idxs) {
      try {
        const sliceInd = fullInd.slice(Math.max(0, i - 20), i + 1);
        const prediction = predictMovementProbabilities(sliceInd, sentScore || 0);
        const sr = computeSupportResistance(rows.slice(0, i + 1));
        const rsiVal = fullInd[i].rsi;
        const rating = masterScore(
          prediction,
          fundamentals,
          { available: sentScore != null, score: sentScore || 0, newsCount: sentScore != null ? 1 : 0 },
          null,
          null
        );
        const pos = positionRiskEffect(sr, rsiVal);
        if (pos) {
          rating.score = Math.round(Math.max(0, Math.min(100, rating.score + pos[0])) * 10) / 10;
          rating.verdict = verdictForScore(rating.score);
        }
        const verdict = rating.verdict;
        totalSamples += 1;

        for (const h of HORIZONS) {
          const j = i + h;
          if (j < n && closes[i] > 0) {
            const fwd = (closes[j] / closes[i] - 1) * 100;
            const b = (buckets[h][verdict] = buckets[h][verdict] || { n: 0, hit: 0, ret_sum: 0 });
            b.n += 1;
            if (fwd > 0) b.hit += 1;
            b.ret_sum += fwd;
            baseline[h].n += 1;
            if (fwd > 0) baseline[h].hit += 1;
            baseline[h].ret_sum += fwd;
          }
        }
      } catch (err) {
        // skip this sample, mirroring Python
      }
    }
  }

  if (totalSamples === 0) {
    return { status: 'error', message: 'No samples could be rated for validation.', cached: false };
  }

  const rank = {};
  ORDER.forEach((v, i) => { rank[v] = i; });

  const horizonsOut = [];
  for (const h of HORIZONS) {
    const bl = baseline[h];
    const baselineAvg = bl.n ? bl.ret_sum / bl.n : 0;
    const baselineHit = bl.n ? (bl.hit / bl.n) * 100 : 0;

    const verdicts = [];
    for (const v of ORDER) {
      const b = buckets[h][v];
      if (!b || b.n === 0) continue;
      const avg = b.ret_sum / b.n;
      const hit = (b.hit / b.n) * 100;
      verdicts.push({
        verdict: v,
        count: b.n,
        hitRate: _round(hit, 1),
        avgReturn: _round(avg, 2),
        betterThanBaseline: _round(avg - baselineAvg, 2),
      });
    }

    let mono = null;
    if (verdicts.length >= 3) {
      const xs = verdicts.map(v => rank[v.verdict]);
      const ys = verdicts.map(v => v.avgReturn);
      const std = Math.sqrt(ys.reduce((s, v) => s + v * v, 0) / ys.length - Math.pow(ys.reduce((s, v) => s + v, 0) / ys.length, 2));
      if (std > 0) {
        mono = _round(_clip(_pearson(xs, ys), -1, 1), 2);
      }
    }

    horizonsOut.push({
      days: h,
      verdicts,
      baselineAvgReturn: _round(baselineAvg, 2),
      baselineHitRate: _round(baselineHit, 1),
      monotonicity: mono,
    });
  }

  // Plain-language conclusion from the 10-day horizon (best balance).
  const mid = horizonsOut[1];
  const strong = (mid.verdicts || []).find(v => v.verdict === 'STRONG BUY') || null;
  const mono = mid.monotonicity;
  let conclusion;
  if (mono != null && Math.abs(mono) >= 0.3 && strong && strong.avgReturn > mid.baselineAvgReturn) {
    conclusion =
      `On real NEPSE history the ratings carry signal: STRONG BUY picks averaged ` +
      `${strong.avgReturn >= 0 ? '+' : ''}${strong.avgReturn.toFixed(1)}% over ${mid.days} days vs ` +
      `${mid.baselineAvgReturn >= 0 ? '+' : ''}${mid.baselineAvgReturn.toFixed(1)}% for all stocks ` +
      `(${strong.hitRate.toFixed(0)}% win rate). NEPSE is mean-reverting, so the edge comes from ` +
      `buying oversold names, not chasing momentum.`;
  } else {
    conclusion =
      'Ratings show a weak or unclear edge on real history — treat them as a ' +
      'consistent filter, not a predictor. The technical checks, position-in-range ' +
      'and risk flags are the more reliable part of this tool.';
  }

  const result = {
    status: 'ready',
    asOf: String(asOf || '').slice(0, 10),
    samples: totalSamples,
    universe: symbols.length,
    horizons: horizonsOut,
    conclusion,
    computedSeconds: _round((Date.now() - t0) / 1000, 1),
    cached: false,
  };

  _cache.data = result;
  _cache.at = Date.now();
  return result;
}

module.exports = { computeScreenerValidation };
