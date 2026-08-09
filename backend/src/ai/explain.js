// Builds the plain-text AI explanation the way main.py did, but in JS.
// Each input section is optional; missing sections are skipped.

function _pct(v, digits = 1) {
  if (v == null || !isFinite(v)) return null;
  const x = parseFloat(v);
  return `${x >= 0 ? '+' : ''}${x.toFixed(digits)}%`;
}

function buildExplanation(opts) {
  const {
    symbol, name, prediction, sr, projection, duration, fundamentals,
    sentiment, marketRegime, risk, rating, master, rowCount,
  } = opts;
  const lines = [];

  lines.push(`${symbol}${name ? ` — ${name}` : ''}`);
  lines.push('='.repeat(Math.min(64, Math.max(20, lines[0].length))));
  lines.push('');

  if (prediction) {
    lines.push('MARKET MOVEMENT PREDICTION');
    lines.push('----------------------------');
    lines.push(`Signal: ${prediction.signal}   Bullish ${prediction.bullishProb}% | Neutral ${prediction.neutralProb}% | Bearish ${prediction.bearishProb}%`);
    lines.push(`Confidence: ${prediction.confidenceScore}%   (${prediction.dataQuality})`);
    lines.push('');
  }

  const last = rowCount != null ? ` based on ${rowCount} trading sessions` : '';
  if (risk) {
    lines.push('TECHNICAL INDICATORS');
    lines.push('--------------------');
    lines.push(`Overall Risk: ${risk.riskLevel} (${risk.riskScore}/100)`);
    const t = risk.technicalStatus || {};
    lines.push(`Trend: ${t.trend} | Momentum: ${t.momentum} | Safety: ${t.safety}`);
    if (risk.riskDrivers && risk.riskDrivers.length) {
      lines.push('Key risk drivers:');
      for (const d of risk.riskDrivers.slice(0, 5)) lines.push(`  - ${d}`);
    }
    if (risk.volatilityScore != null) {
      lines.push(`Volatility: ${risk.volatilityScore}/100${last ? ` (avg${last})` : ''}`);
    }
    if (risk.performancePct != null) lines.push(`Period return: ${_pct(risk.performancePct)}`);
    lines.push('');
  }

  if (projection) {
    lines.push('TREND & PROJECTION');
    lines.push('------------------');
    lines.push(`Trend: ${projection.direction} (${projection.trendQuality}, R² ${projection.rSquared}) — ${projection.dailyRatePct}%/day`);
    lines.push(`Projected move over next ${projection.horizonDays} sessions: ${_pct(projection.expectedMovePct)} (range ${_pct(projection.lowPct)} to ${_pct(projection.highPct)})`);
    if (duration) {
      if (duration.sessionsToResistance != null) lines.push(`Target resistance in ~${duration.sessionsToResistance} sessions (${_pct(duration.resistanceDistancePct)} away)`);
      if (duration.sessionsToSupport != null) lines.push(`Downside to support in ~${duration.sessionsToSupport} sessions (${_pct(duration.supportDistancePct)} away)`);
    }
    lines.push('');
  }

  if (sr) {
    lines.push('SUPPORT & RESISTANCE');
    lines.push('--------------------');
    lines.push(`Support: ${sr.support} | Resistance: ${sr.resistance} | Pivot: ${sr.pivot}`);
    lines.push(`Price ${sr.positionPct}% into the ${sr.rangePct}% range${sr.nearResistance ? ' (AT resistance)' : sr.nearSupport ? ' (near support)' : ''}`);
    lines.push('');
  }

  if (fundamentals) {
    lines.push('FUNDAMENTALS');
    lines.push('------------');
    const f = [];
    if (fundamentals.peRatio != null) f.push(`P/E ${fundamentals.peRatio}`);
    if (fundamentals.eps != null) f.push(`EPS ${fundamentals.eps}`);
    if (fundamentals.roe != null) f.push(`ROE ${fundamentals.roe}%`);
    if (fundamentals.dividendYield != null) f.push(`Div ${fundamentals.dividendYield}%`);
    if (fundamentals.sector) f.push(`Sector: ${fundamentals.sector}`);
    if (fundamentals.bookValue != null) f.push(`Book ${fundamentals.bookValue}`);
    lines.push(f.join(' | '));
    lines.push('');
  }

  if (sentiment && sentiment.available) {
    lines.push('NEWS & SENTIMENT');
    lines.push('----------------');
    lines.push(`Sentiment: ${sentiment.label} (${sentiment.score >= 0 ? '+' : ''}${sentiment.score}) across ${sentiment.count} headline${sentiment.count === 1 ? '' : 's'}`);
    lines.push('');
  }

  if (marketRegime) {
    lines.push('MARKET REGIME');
    lines.push('-------------');
    lines.push(`NEPSE regime: ${marketRegime.regime} (${marketRegime.momentumScore}/100 momentum) — ${marketRegime.regimeChange}`);
    lines.push('');
  }

  if (rating) {
    lines.push('VERDICT');
    lines.push('-------');
    lines.push(`Investment Rating: ${rating.verdict} (${rating.score}/100)`);
    if (rating.parts && rating.parts.length) {
      lines.push('Score breakdown:');
      for (const p of rating.parts) {
        lines.push(`  ${p[0]}: ${p[1]} (${p[2]})`);
      }
    }
    if (master && master.safetyScore != null) {
      lines.push(`Master Score: ${master.score}/100 — ${master.verdict}`);
      lines.push(`Safety ${master.safetyScore}/100 | Upside ${master.upsideScore}/100`);
    }
    if (risk && risk.liquidationRisk != null) {
      lines.push(`Liquidation risk: ${risk.liquidationRisk}/100`);
    }
    lines.push('');
  }

  lines.push('DISCLAIMER');
  lines.push('----------');
  lines.push('This analysis is generated by an AI model for educational purposes only and does not constitute financial advice. Market data can be delayed or erroneous; always verify independently.');

  return lines.join('\n');
}

module.exports = { buildExplanation };
