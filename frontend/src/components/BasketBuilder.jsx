import { useState, useMemo } from 'react';
import { ShoppingCart, ShieldCheck, AlertTriangle, Target, CheckCircle2, Clock, XCircle } from 'lucide-react';
import { RISK_PRESETS, defaultRiskProfile, evaluatePick, risk } from '../lib/risk';

const fmtNPR = n => 'रू ' + Math.round(Math.abs(n)).toLocaleString('en-IN');
const MAX_PER_SECTOR = 2;
const BASKET_SIZE = 6;

function BasketBuilder({ results, loading, asOf, inDowntrend }) {
  const [shown, setShown] = useState(false);
  const [profile, setProfile] = useState(() => risk.loadRiskProfile());

  const basket = useMemo(() => {
    if (!results || results.length === 0) return [];
    const candidates = results
      .filter(p => p.ratingVerdict === 'STRONG BUY' || p.ratingVerdict === 'BUY')
      .map(p => {
        const rsi = Number(p.rsi) || 50;
        const pos = Number(p.positionPct) ?? 50;
        const nearRes = !!p.nearResistance;
        const nearSup = !!p.nearSupport;
        const tilt = (rsi <= 40 ? 6 : 0) + (nearSup ? 4 : 0) - (nearRes ? 8 : 0) - (pos >= 75 ? 4 : 0);
        return { ...p, _tilt: (Number(p.sortScore) || 0) + tilt, rsi, pos, nearRes, nearSup };
      })
      .sort((a, b) => b._tilt - a._tilt);

    const sectorCount = {};
    const picks = [];
    for (const c of candidates) {
      if (picks.length >= BASKET_SIZE) break;
      const sec = c.sector || 'Others';
      if ((sectorCount[sec] || 0) >= MAX_PER_SECTOR) continue;
      sectorCount[sec] = (sectorCount[sec] || 0) + 1;
      picks.push(c);
    }
    return picks;
  }, [results]);

  const evals = useMemo(() => {
    if (basket.length === 0) return [];
    const list = basket.map(p => ({ pick: p, ev: evaluatePick(p, profile, { inDowntrend }) }));
    const order = { BUY: 0, WAIT: 1, SKIP: 2 };
    return list.sort((a, b) => order[a.ev.action] - order[b.ev.action] || b.pick._tilt - a.pick._tilt);
  }, [basket, profile, inDowntrend]);

  const buys = evals.filter(e => e.ev.action === 'BUY');
  const totalPosition = evals.reduce((s, e) => s + e.ev.positionValue, 0);
  const totalRisk = evals.reduce((s, e) => s + e.ev.riskAmount, 0);
  const capShare = totalPosition > 0 ? Math.min(100, (totalPosition / profile.capital) * 100) : 0;

  const updateProfile = patch => {
    const next = { ...profile, ...patch };
    if (patch.style) Object.assign(next, RISK_PRESETS[patch.style]);
    setProfile(next);
    risk.saveRiskProfile(next);
  };

  const ActionChip = ({ action }) =>
    action === 'BUY' ? (
      <span className="risk-action buy"><CheckCircle2 size={11} /> BUY</span>
    ) : action === 'WAIT' ? (
      <span className="risk-action wait"><Clock size={11} /> WAIT</span>
    ) : (
      <span className="risk-action skip"><XCircle size={11} /> SKIP</span>
    );

  return (
    <div className="card" style={{ padding: '1.25rem', marginTop: '1.25rem' }}>
      <div className="basket-head">
        <div>
          <div className="basket-title-row">
            <ShoppingCart size={15} style={{ color: '#10b981' }} />
            <h2 className="basket-title">Buy basket — what to actually act on</h2>
          </div>
          <p className="basket-sub">
            The screener's strongest candidates, then a rules engine decides{' '}
            <strong>BUY now / WAIT / SKIP</strong> for each using your risk profile.{' '}
            {inDowntrend ? 'Market is falling — size is halved automatically.' : ''}
          </p>
        </div>
        <button className="basket-toggle" onClick={() => setShown(s => !s)}>
          {shown ? 'Hide' : 'Build basket'} <ShoppingCart size={12} />
        </button>
      </div>

      {!shown && (
        <p className="basket-hint">
          Picks the top {BASKET_SIZE} STRONG BUY / BUY names, max {MAX_PER_SECTOR} per sector,
          then sizes each by risk. <strong>data as of {fmtDate(asOf)}</strong>.
        </p>
      )}

      {shown && loading && (
        <div style={{ padding: '1rem 0', color: 'var(--text-muted)', fontSize: '0.8rem' }}>Loading screener results…</div>
      )}

      {shown && !loading && basket.length === 0 && (
        <div style={{ padding: '1rem 0', color: 'var(--text-muted)', fontSize: '0.8rem' }}>
          No buy candidates passed the filters. Try widening Max P/E or switching strategy.
        </div>
      )}

      {shown && !loading && evals.length > 0 && (
        <>
          {/* Risk profile editor */}
          <div className="risk-profile">
            <div className="risk-profile-title">
              <ShieldCheck size={14} style={{ color: '#0ea5e9' }} />
              Your risk profile
            </div>
            <div className="risk-profile-row">
              {Object.values(RISK_PRESETS).map(pr => (
                <button
                  key={pr.key}
                  className={`risk-style${profile.style === pr.key ? ' active' : ''}`}
                  onClick={() => updateProfile({ style: pr.key })}
                  title={pr.tagline}
                >
                  <strong>{pr.label}</strong>
                  <span>risk {pr.riskPerTrade * 100}%/trade · max {pr.maxPositions} names</span>
                </button>
              ))}
              <div className="risk-capital">
                <label htmlFor="risk-capital">Capital</label>
                <input
                  id="risk-capital"
                  type="number"
                  className="settings-input"
                  value={profile.capital}
                  onChange={e => updateProfile({ capital: Math.max(0, Number(e.target.value) || 0) })}
                  style={{ width: '120px' }}
                />
              </div>
            </div>
            <p className="risk-profile-tagline">{RISK_PRESETS[profile.style]?.tagline}</p>
          </div>

          {/* Portfolio gates summary */}
          <div className="risk-gates">
            <div className={`risk-gate${capShare <= profile.maxDailyPct ? ' ok' : ' bad'}`}>
              <span className="risk-gate-label">Total basket size</span>
              <strong>{fmtNPR(totalPosition)}</strong>
              <small>{capShare.toFixed(1)}% of capital · {profile.maxDailyPct * 100}% daily cap</small>
              {capShare <= profile.maxDailyPct ? <span className="risk-gate-mark ok">within cap</span> : <span className="risk-gate-mark bad">over cap — cut size</span>}
            </div>
            <div className="risk-gate ok">
              <span className="risk-gate-label">Worst case if all stops hit</span>
              <strong>{fmtNPR(totalRisk)}</strong>
              <small>{((totalRisk / profile.capital) * 100).toFixed(1)}% of capital at risk · budget {profile.riskPerTrade * 100}%/trade × {buys.length} buys</small>
            </div>
          </div>

          <div className="basket-list">
            {evals.map(({ pick, ev }, i) => (
              <div className="basket-item" key={pick.symbol}>
                <div className="basket-rank" style={{
                  background: ev.action === 'BUY' ? 'rgba(16,185,129,0.12)' : ev.action === 'WAIT' ? 'rgba(245,158,11,0.12)' : 'rgba(239,68,68,0.1)',
                  borderColor: ev.action === 'BUY' ? 'rgba(16,185,129,0.3)' : ev.action === 'WAIT' ? 'rgba(245,158,11,0.3)' : 'rgba(239,68,68,0.25)',
                  color: ev.action === 'BUY' ? 'var(--green)' : ev.action === 'WAIT' ? '#f59e0b' : '#ef4444',
                }}>{i + 1}</div>
                <div className="basket-item-body">
                  <div className="basket-item-top">
                    <div>
                      <span className="basket-symbol">{pick.symbol}</span>
                      <span className="basket-name">{pick.name}</span>
                    </div>
                    <ActionChip action={ev.action} />
                  </div>
                  <div className="basket-item-meta">
                    <span>LTP {fmtNPR(pick.price)}</span>
                    <span>RSI {pick.rsi}</span>
                    <span className="basket-pos">{pick.pos}% of S/R</span>
                    <span style={{ color: 'var(--text-muted)' }}>{pick.sector}</span>
                  </div>

                  <div className="risk-rule-list">
                    {ev.reasons.map((r, j) => (
                      <div key={j} className={`risk-rule ${r.level}`}>
                        {r.level === 'pass' ? <CheckCircle2 size={10} /> : r.level === 'warn' ? <AlertTriangle size={10} /> : <XCircle size={10} />}
                        {r.text}
                      </div>
                    ))}
                  </div>

                  {ev.action === 'BUY' && ev.shares > 0 && (
                    <div className="risk-alloc">
                      <div className="risk-alloc-grid">
                        <span><em>Buy</em>{ev.shares} shares ≈ {fmtNPR(ev.positionValue)}</span>
                        <span><em>Stop</em>{fmtNPR(ev.stop)} <small>(−{ev.stopDistPct.toFixed(1)}%)</small></span>
                        <span><em>Target</em>{fmtNPR(ev.target)} <small>(+{((ev.target - pick.price) / pick.price * 100).toFixed(1)}%)</small></span>
                        <span><em>R/R</em>{ev.rr.toFixed(1)}R</span>
                        <span><em>Risk</em>{fmtNPR(ev.riskAmount)} <small>({ev.riskPct.toFixed(1)}% cap)</small></span>
                      </div>
                      {ev.riskPct > profile.riskPerTrade * 100 + 0.05 && (
                        <div className="risk-alloc-warn"><AlertTriangle size={10} /> exceeds your per-trade risk cap — reduce shares</div>
                      )}
                    </div>
                  )}

                  {ev.action !== 'BUY' && (
                    <div className="risk-alloc empty">No entry sized while the gate says {ev.action.toLowerCase()}.</div>
                  )}
                </div>
              </div>
            ))}
          </div>

          <div className="basket-note">
            <Target size={13} style={{ color: '#0ea5e9', flexShrink: 0 }} />
            <span>
              {buys.length > 0
                ? `${buys.length} actionable: risk ${fmtNPR(totalRisk)} max, roughly ${((totalRisk / profile.capital) * 100).toFixed(1)}% of capital if everything hits stop. `
                : 'Nothing passes the gate right now — that is the point of a gate. '}
              Each name still wins only ~half the time over 10 days; the basket + stops are what make the
              edge average out. Set a stop-loss order at the level shown — the math falls apart without it.
              Not advice; verify each pick in the full analysis.
            </span>
          </div>
        </>
      )}
    </div>
  );
}

const fmtDate = iso => {
  if (!iso) return '—';
  const d = new Date(iso);
  if (isNaN(d)) return iso;
  return d.toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' });
};

export default BasketBuilder;
