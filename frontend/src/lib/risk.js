const fmtN = n => {
  if (n == null || isNaN(n)) return '—';
  return 'रू ' + Math.round(n).toLocaleString('en-IN');
};

export const RISK_PRESETS = {
  conservative: {
    key: 'conservative',
    label: 'Conservative',
    tagline: 'Protect capital — small positions, wide diversification, strict gates.',
    riskPerTrade: 0.01,
    maxPositions: 8,
    maxDailyPct: 0.03,
    maxStopPct: 5,
    minRR: 1.5,
  },
  balanced: {
    key: 'balanced',
    label: 'Balanced',
    tagline: 'Moderate sizing, decent risk/reward, room to let the edge work.',
    riskPerTrade: 0.02,
    maxPositions: 6,
    maxDailyPct: 0.05,
    maxStopPct: 6,
    minRR: 1.0,
  },
  aggressive: {
    key: 'aggressive',
    label: 'Aggressive',
    tagline: 'Bigger bets, tighter baskets. Only if you can stomach losing the risk.',
    riskPerTrade: 0.04,
    maxPositions: 5,
    maxDailyPct: 0.08,
    maxStopPct: 8,
    minRR: 0.8,
  },
};

export const defaultRiskProfile = { style: 'balanced', capital: 100000 };

const loadRiskProfile = () => {
  try {
    const raw = localStorage.getItem('nepse-risk-profile');
    if (raw) {
      const p = JSON.parse(raw);
      const preset = RISK_PRESETS[p.style] || RISK_PRESETS.balanced;
      return {
        ...defaultRiskProfile,
        ...p,
        ...preset,
        style: preset.key,
      };
    }
  } catch (e) { /* ignore */ }
  return { ...defaultRiskProfile, ...RISK_PRESETS.balanced };
};

const saveRiskProfile = p => {
  try {
    localStorage.setItem('nepse-risk-profile', JSON.stringify({ style: p.style, capital: p.capital }));
  } catch (e) { /* ignore */ }
};

const stopFor = pick => {
  const price = Number(pick.price) || 0;
  const atr = Number(pick.technicals?.atr) || (price * (Number(pick.volatilityPct) || 2)) / 100;
  let stop = null;
  let supportDistPct = null;
  if (pick.support && Number(pick.support) < price) {
    stop = Number(pick.support);
    supportDistPct = ((price - stop) / price) * 100;
  }
  if (stop == null) stop = price - 1.5 * atr;
  const stopDist = Math.max(0.01, price - stop);
  return { stop, stopDist, stopDistPct: (stopDist / price) * 100, supportDistPct, atr };
};

const targetFor = pick => {
  const price = Number(pick.price) || 0;
  let target = null;
  if (pick.resistance && Number(pick.resistance) > price) target = Number(pick.resistance);
  if (target == null) {
    const highPct = Number(pick.projection?.highPct) || 3;
    target = price * (1 + highPct / 100);
  }
  return target;
};

export function evaluatePick(pick, profile, ctx = {}) {
  const price = Number(pick.price) || 0;
  const rsi = Number(pick.rsi) ?? 50;
  const pos = Number(pick.positionPct) ?? 50;
  const reasons = [];
  const inDowntrend = !!ctx.inDowntrend;

  // Gate 1 — rating
  const ratingOk = pick.ratingVerdict === 'STRONG BUY' || pick.ratingVerdict === 'BUY';
  if (!ratingOk) {
    reasons.push({ level: 'fail', text: `${pick.ratingVerdict} ${pick.rating} — below the buy bar` });
    return { action: 'SKIP', reasons, stop: null, target: null, rr: null, shares: 0, positionValue: 0, riskAmount: 0 };
  }
  reasons.push({ level: 'pass', text: `${pick.ratingVerdict} ${pick.rating} passes the buy bar` });

  let action = 'BUY';

  // Gate 2 — overbought
  if (rsi >= 70) {
    action = 'WAIT';
    reasons.push({ level: 'warn', text: `RSI ${rsi} — overbought, expect a pullback before entry` });
  }

  // Gate 3 — chasing into resistance
  if (pick.nearResistance) {
    action = 'WAIT';
    reasons.push({ level: 'warn', text: `near resistance (${fmtN(Number(pick.resistance))}) — poor entry` });
  }

  // Gate 4 — position in range
  if (pos >= 75) {
    action = 'WAIT';
    reasons.push({ level: 'warn', text: `price in the top ${pos}% of its range — wait for a dip` });
  }

  // Gate 5 — stop width
  const { stop, stopDist, stopDistPct, atr } = stopFor(pick);
  if (stopDistPct > profile.maxStopPct) {
    action = 'WAIT';
    reasons.push({ level: 'warn', text: `support too far below (${stopDistPct.toFixed(1)}%) — stop would be wide` });
  } else {
    reasons.push({
      level: 'pass',
      text: `stop ${fmtN(stop)} (${stopDistPct.toFixed(1)}% away) — inside the ${profile.maxStopPct}% max`,
    });
  }

  // Gate 6 — reward / risk
  const target = targetFor(pick);
  const rr = (target - price) / stopDist;
  if (rr < profile.minRR) {
    action = 'WAIT';
    reasons.push({ level: 'warn', text: `reward/risk ${rr.toFixed(1)} — below the ${profile.minRR} minimum` });
  } else {
    reasons.push({ level: 'pass', text: `target ${fmtN(target)} = ${rr.toFixed(1)}R — clears the ${profile.minRR}R minimum` });
  }

  // Downtrend handling
  if (inDowntrend) {
    reasons.push({ level: 'warn', text: 'market falling — size is halved automatically' });
    if (rsi > 60) {
      action = 'WAIT';
      reasons.push({ level: 'warn', text: 'market falling and RSI not oversold — stand aside' });
    }
  }

  // Sizing
  const riskBudget = profile.capital * profile.riskPerTrade * (inDowntrend ? 0.5 : 1);
  let shares = Math.floor(riskBudget / stopDist);
  const capShares = Math.floor((profile.capital / profile.maxPositions) / price);
  if (capShares < shares) {
    shares = capShares;
    reasons.push({ level: 'pass', text: `capped to ${shares} shares (${profile.capital / profile.maxPositions} NPR max per position)` });
  }
  if (shares < 1) {
    action = 'SKIP';
    reasons.push({ level: 'fail', text: `capital too small — can't risk even 1 share at this stop` });
    return { action, reasons, stop, target, rr, shares: 0, positionValue: 0, riskAmount: 0, riskPct: 0, stopDistPct, atr };
  }

  const positionValue = shares * price;
  const riskAmount = shares * stopDist;
  const riskPct = (riskAmount / profile.capital) * 100;

  return {
    action,
    reasons,
    stop,
    target,
    rr,
    shares,
    positionValue,
    riskAmount,
    riskPct,
    stopDistPct,
    atr,
  };
}

export const risk = { loadRiskProfile, saveRiskProfile };
