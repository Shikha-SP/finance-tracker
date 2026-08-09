import { useState, useEffect, useCallback, useRef } from 'react';
import { ShieldCheck, RefreshCw, WifiOff, TrendingUp, TrendingDown, Loader2, Radio, Clock } from 'lucide-react';

const URL = '/api/ai/validation';
const FWD_URL = '/api/ai/forwardtest';
const ORDER = ['STRONG BUY', 'BUY', 'HOLD', 'SELL', 'STRONG SELL'];
const ORDER_COLORS = ['var(--green)', 'var(--green)', '#f59e0b', '#f97316', '#ef4444'];

const verdictColor = v => ORDER_COLORS[ORDER.indexOf(v)] || 'var(--text-muted)';

export default function TrustCheck() {
  const [data, setData] = useState(null);
  const [fwd, setFwd] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);
  const statusRef = useRef('idle');
  const mounted = useRef(true);

  useEffect(() => { statusRef.current = data?.status || 'idle'; }, [data]);

  const load = useCallback(async (refresh = false) => {
    if (!refresh) setLoading(true);
    try {
      const res = await fetch(`${URL}${refresh ? '?refresh=1' : ''}`, { signal: AbortSignal.timeout(60000) });
      const json = await res.json().catch(() => null);
      if (mounted.current) {
        if (res.ok && json) {
          setData(json);
          setError(false);
        } else {
          setData({ status: 'error', message: json?.message || `Trust check unavailable (HTTP ${res.status})`, horizons: [], conclusion: '' });
        }
      }
    } catch {
      if (mounted.current) setData({ status: 'error', message: 'Trust check unavailable — is the backend running?', horizons: [], conclusion: '' });
    } finally {
      if (mounted.current) setLoading(false);
    }
  }, []);

  const loadFwd = useCallback(async () => {
    try {
      const res = await fetch(FWD_URL, { signal: AbortSignal.timeout(30000) });
      const json = await res.json().catch(() => null);
      if (mounted.current && res.ok && json) setFwd(json);
    } catch { /* forward test is best-effort; hide on failure */ }
  }, []);

  useEffect(() => {
    mounted.current = true;
    load();
    loadFwd();
    const iv = setInterval(() => {
      if (statusRef.current === 'running' && mounted.current) load();
    }, 4000);
    return () => { mounted.current = false; clearInterval(iv); };
  }, [load, loadFwd]);

  if (loading && !data) {
    return (
      <div className="card" style={{ padding: '1.25rem' }}>
        <div className="skeleton" style={{ width: '100%', height: '8rem' }} />
      </div>
    );
  }

  if (error && !data) {
    return (
      <div className="card" style={{ padding: '1.25rem' }}>
        <div className="trust-empty">
          <WifiOff size={20} style={{ opacity: 0.4 }} />
          <span>Trust check unavailable</span>
          <button className="btn-outline" onClick={() => load()}>Retry</button>
        </div>
      </div>
    );
  }

  if (data?.status === 'running' || data?.status === 'idle') {
    return (
      <div className="card" style={{ padding: '1.25rem' }}>
        <div className="trust-empty">
          <Loader2 size={20} className="spin" style={{ color: 'var(--accent)' }} />
          <span>Computing honest scorecard — rating past dates with only then-available data…</span>
        </div>
      </div>
    );
  }

  if (data?.status === 'error') {
    return (
      <div className="card" style={{ padding: '1.25rem' }}>
        <div className="trust-empty">
          <WifiOff size={20} style={{ opacity: 0.4 }} />
          <span>{data.message || 'Trust check failed'}</span>
          <button className="btn-outline" onClick={() => load(true)}>Retry</button>
        </div>
      </div>
    );
  }

  const horizons = data?.horizons || [];
  const best = horizons.find(h => h.days === 10);

  return (
    <div className="card" style={{ padding: '1.25rem 1.4rem' }}>
      <div className="trust-head">
        <div className="trust-title-row">
          <ShieldCheck size={17} style={{ color: '#0ea5e9' }} />
          <h2 style={{ fontSize: '0.95rem', fontWeight: 800, color: 'var(--text-primary)' }}>
            How trustworthy are these ratings?
          </h2>
          <span className="trust-live-badge">REAL HISTORY · NO LOOK-AHEAD</span>
        </div>
        <div className="trust-head-right">
          <span className="ms-updated">as of {data?.asOf} · {data?.samples} rated samples · {data?.universe} stocks</span>
          <button className="news-refresh-btn" onClick={() => load(true)} disabled={loading} title="Re-run the scorecard">
            <RefreshCw size={12} className={loading ? 'spin' : ''} />
          </button>
        </div>
      </div>

      <p className="trust-note">
        We rated past dates using only the data available at that date (indicators are trailing — no
        future information leaks in), then checked what actually happened over the next 5, 10 and 20
        sessions. This is the honest test of whether a rating means anything.
      </p>

      {best?.monotonicity != null && (
        <div className="trust-mono">
          Direction-correctness (monotonicity): <strong>{best.monotonicity}</strong> on the 10-day
          horizon · <strong>{Math.abs(best.monotonicity).toFixed(2)}</strong> from perfect ordering —
          a high magnitude in <em>either</em> direction means the ratings rank stocks correctly
          (here the sign is inverted because NEPSE mean-reverts: STRONG BUY beats STRONG SELL).
        </div>
      )}

      <div className="trust-table-wrap">
        <table className="trust-table">
          <thead>
            <tr>
              <th>Horizon</th>
              {horizons.map(h => (
                <th key={h.days}>{h.days}-day</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {ORDER.map(verdict => (
              <tr key={verdict}>
                <td className="trust-verdict" style={{ color: verdictColor(verdict) }}>
                  {verdict}
                </td>
                {horizons.map(h => {
                  const v = (h.verdicts || []).find(x => x.verdict === verdict);
                  return (
                    <td key={h.days} className="trust-cell">
                      {v ? (
                        <>
                          <span style={{ color: v.avgReturn >= 0 ? 'var(--green)' : '#ef4444', fontWeight: 700 }}>
                            {v.avgReturn > 0 ? '+' : ''}{v.avgReturn}%
                          </span>
                          <span className="trust-sub">{v.hitRate}% win · n={v.count}</span>
                        </>
                      ) : (
                        <span className="trust-sub">—</span>
                      )}
                    </td>
                  );
                })}
              </tr>
            ))}
            <tr>
              <td className="trust-verdict" style={{ color: 'var(--text-muted)' }}>All stocks (baseline)</td>
              {horizons.map(h => (
                <td key={h.days} className="trust-cell">
                  <span style={{ color: h.baselineAvgReturn >= 0 ? 'var(--green)' : '#ef4444', fontWeight: 700 }}>
                    {h.baselineAvgReturn > 0 ? '+' : ''}{h.baselineAvgReturn}%
                  </span>
                  <span className="trust-sub">{h.baselineHitRate}% win</span>
                </td>
              ))}
            </tr>
          </tbody>
        </table>
      </div>

      <div className="trust-conclusion">
        {best?.verdicts?.[0]?.avgReturn > best?.baselineAvgReturn ? (
          <TrendingUp size={15} style={{ color: 'var(--green)', flexShrink: 0, marginTop: '2px' }} />
        ) : (
          <TrendingDown size={15} style={{ color: '#ef4444', flexShrink: 0, marginTop: '2px' }} />
        )}
        <span>{data?.conclusion}</span>
      </div>

      {/* ── Live forward test: real-time proof, not a history replay ── */}
      {fwd && (
        <div className="trust-fwd">
          <div className="trust-fwd-head">
            <Radio size={14} style={{ color: '#10b981' }} />
            <span className="trust-fwd-title">Live forward test</span>
            <span className="trust-fwd-badge">FROM TODAY ONWARD</span>
          </div>
          <p className="trust-fwd-note">
            {fwd.note}
          </p>
          {fwd.status === 'ready' && fwd.horizons?.length > 0 && (
            <table className="trust-table">
              <thead>
                <tr>
                  <th>Verdict</th>
                  {fwd.horizons.map(h => (
                    <th key={h.days}>{h.days}-day</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {ORDER.map(verdict => {
                  const cells = fwd.horizons.map(h => (h.verdicts || []).find(x => x.verdict === verdict));
                  if (cells.every(c => !c)) return null;
                  return (
                    <tr key={verdict}>
                      <td className="trust-verdict" style={{ color: verdictColor(verdict) }}>{verdict}</td>
                      {cells.map((v, i) => (
                        <td key={i} className="trust-cell">
                          {v ? (
                            <>
                              <span style={{ color: v.avgReturn >= 0 ? 'var(--green)' : '#ef4444', fontWeight: 700 }}>
                                {v.avgReturn > 0 ? '+' : ''}{v.avgReturn}%
                              </span>
                              <span className="trust-sub">n={v.count}</span>
                            </>
                          ) : <span className="trust-sub">—</span>}
                        </td>
                      ))}
                    </tr>
                  );
                })}
                <tr>
                  <td className="trust-verdict" style={{ color: 'var(--text-muted)' }}>All stocks</td>
                  {fwd.horizons.map(h => (
                    <td key={h.days} className="trust-cell">
                      <span style={{ color: h.baselineAvgReturn >= 0 ? 'var(--green)' : '#ef4444', fontWeight: 700 }}>
                        {h.baselineAvgReturn > 0 ? '+' : ''}{h.baselineAvgReturn}%
                      </span>
                    </td>
                  ))}
                </tr>
              </tbody>
            </table>
          )}
          {fwd.status === 'ready' && (
            <p className="trust-fwd-summary">
              <Clock size={11} /> {fwd.matured} matured signals · {fwd.pending} still measuring · {fwd.total} logged
            </p>
          )}
          {fwd.status !== 'ready' && fwd.total > 0 && (
            <p className="trust-fwd-summary">
              <Clock size={11} /> {fwd.total} signals logged · {fwd.matured} matured · {fwd.pending} pending
            </p>
          )}
        </div>
      )}

      <div className="trust-footnote">
        Computed in {data?.computedSeconds}s · ratings are a consistent filter and risk guard, not a
        guarantee — always pair them with your own reading of the chart and news.
      </div>
    </div>
  );
}
