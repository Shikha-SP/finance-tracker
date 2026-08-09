import { useState, useEffect, useCallback, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { TrendingUp, TrendingDown, Activity, RefreshCw, WifiOff, ChevronUp, ChevronDown, Clock, Target, Layers, ArrowRight, BarChart3, HelpCircle, ShieldCheck } from 'lucide-react';
import NewsPanel from '../components/NewsPanel';
import MarketSentiment from '../components/MarketSentiment';
import RegimeBanner from '../lib/regime';
import TrustCheck from '../components/TrustCheck';

/* ─── Formatters ─────────────────────────────────────────────────────────── */
const fmtNPR  = n => 'रू ' + Math.abs(n).toLocaleString('en-IN', { maximumFractionDigits: 2 });
const fmtNPRk = n => {
  if (n >= 1e9) return 'रू ' + (n / 1e9).toFixed(2) + 'B';
  if (n >= 1e6) return 'रू ' + (n / 1e6).toFixed(2) + 'M';
  if (n >= 1e3) return 'रू ' + (n / 1e3).toFixed(1) + 'K';
  return fmtNPR(n);
};
const fmtNum  = n => Math.abs(n).toLocaleString('en-IN', { maximumFractionDigits: 0 });
const fmtPct  = n => (n >= 0 ? '+' : '') + Number(n).toFixed(2) + '%';
const fmtPt   = n => (n >= 0 ? '+' : '') + Number(n).toFixed(2);
const fmtDate = iso => {
  if (!iso) return '—';
  const d = new Date(iso);
  if (isNaN(d)) return iso;
  return d.toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' });
};
const clampPct = (v, lo = -25, hi = 25) => Math.max(lo, Math.min(hi, Number(v) || 0));

const ratingColor = v => (v === 'STRONG BUY' || v === 'BUY') ? 'var(--green)' : v === 'HOLD' ? '#f59e0b' : v === 'SELL' ? '#f97316' : '#ef4444';
const verdictBg = v => (v === 'STRONG BUY' || v === 'BUY') ? 'rgba(16,185,129,0.14)' : v === 'HOLD' ? 'rgba(245,158,11,0.14)' : 'rgba(239,68,68,0.14)';
const rsiColor = r => r >= 70 ? '#ef4444' : r >= 60 ? '#f59e0b' : r <= 35 ? '#3b82f6' : 'var(--text-primary)';

const API = '/api/nepse';

async function tryFetch(path) {
  const res = await fetch(`${API}${path}`, { signal: AbortSignal.timeout(8000) });
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  return res.json();
}

/* ─── Sub-components ─────────────────────────────────────────────────────── */

function MarketStatusBar({ isOpen, statusText, backendOnline, lastUpdated, onRefresh, loading, countdown }) {
  const isFallback = statusText && (statusText.includes('Fallback') || statusText.includes('past data') || statusText.includes('Cached data'));
  
  let fallbackDate = '';
  if (isFallback) {
    const match = statusText.match(/(\d{4}-\d{2}-\d{2})/);
    if (match) fallbackDate = match[1];
  }

  const titleText = isOpen ? 'MARKET OPEN' : (isFallback ? 'MARKET CLOSED RN' : 'MARKET CLOSED');
  const subText = isFallback && fallbackDate 
    ? `Data fetched from ${fallbackDate}` 
    : 'Nepal Stock Exchange · Real Data Feed';

  return (
    <div className={`market-status-bar ${isOpen ? 'market-open' : 'market-closed'}`}>
      <div className="market-status-left">
        <span className="market-pulse" />
        <span className="market-status-text">
          {titleText}
        </span>
        <span className="market-status-sub">
          {subText}
        </span>
        {!backendOnline && (
          <span className="offline-badge" title="Unable to reach backend API server. Showing cached data.">
            <WifiOff size={10} /> Backend Unreachable
          </span>
        )}
      </div>
      <div className="market-status-right">
        {countdown != null && !loading && (
          <span className="market-refresh-count" title="Automatically refreshes market data">
            <RefreshCw size={10} /> {countdown}s
          </span>
        )}
        {lastUpdated && (
          <span className="market-last-updated">
            <Clock size={11} /> {lastUpdated}
          </span>
        )}
        <button
          className="market-refresh-btn"
          onClick={onRefresh}
          disabled={loading}
          title="Refresh"
        >
          <RefreshCw size={13} className={loading ? 'spin' : ''} />
          Refresh
        </button>
      </div>
    </div>
  );
}

function IndexKPICard({ name, value, change, changePct, loading }) {
  const up = change >= 0;
  return (
    <div className="index-kpi-card">
      <div className="index-kpi-header">
        <span className="index-kpi-name">{name}</span>
        {up
          ? <TrendingUp size={14} className="index-kpi-icon up" />
          : <TrendingDown size={14} className="index-kpi-icon down" />}
      </div>
      <div className={`index-kpi-value ${loading ? 'loading-shimmer' : ''}`}>
        {loading ? '\u00a0' : value.toLocaleString('en-IN', { maximumFractionDigits: 2 })}
      </div>
      <div className={`index-kpi-change ${up ? 'positive' : 'negative'}`}>
        {up ? <ChevronUp size={12} /> : <ChevronDown size={12} />}
        {loading ? '—' : `${fmtPt(change)} (${fmtPct(changePct)})`}
      </div>
    </div>
  );
}

function StatKPICard({ name, value, sub, icon: Icon, color, loading }) {
  return (
    <div className="index-kpi-card stat-variant">
      <div className="index-kpi-header">
        <span className="index-kpi-name">{name}</span>
        <Icon size={14} className="index-kpi-icon" style={{ color }} />
      </div>
      <div className={`index-kpi-value ${loading ? 'loading-shimmer' : ''}`}
        style={{ color, fontSize: '1.2rem' }}>
        {loading ? '\u00a0' : value}
      </div>
      <div className="index-kpi-sub">{sub}</div>
    </div>
  );
}

function MoversCard({ title, type, data, loading, metric = 'pct' }) {
  const color = type === 'gainers' ? 'var(--green)' : type === 'turnover' ? 'var(--accent)' : 'var(--red)';
  const rows = data.slice(0, 5);

  return (
    <div className="movers-card card">
      <div className="movers-head">
        <span className="movers-indicator" style={{ background: color }} />
        <span className="movers-title">{title}</span>
        <span className="movers-count">{rows.length} stocks</span>
      </div>
      <div className="movers-list">
        {loading ? (
          Array.from({ length: 5 }).map((_, i) => (
            <div className="movers-row" key={i}><div className="skeleton" style={{ width: '100%', height: '1.4rem' }} /></div>
          ))
        ) : rows.length === 0 ? (
          <div className="movers-empty">No data</div>
        ) : (
          rows.map(s => (
            <div className="movers-row" key={s.symbol}>
              <span className="movers-symbol">{s.symbol}</span>
              <span className="movers-ltp">{fmtNum(s.ltp)}</span>
              {metric === 'pct' ? (
                <span className={`change-badge ${type === 'gainers' ? 'up' : 'down'}`}>
                  {type === 'gainers' ? <ChevronUp size={10} /> : <ChevronDown size={10} />}
                  {Math.abs(s.pctChange).toFixed(2)}%
                </span>
              ) : (
                <span className="movers-turnover" title={`Volume ${fmtNum(s.volume)}`}>{fmtNPRk(s.turnover)}</span>
              )}
            </div>
          ))
        )}
      </div>
    </div>
  );
}

const SIX_MONTHS = 182 * 24 * 3600;

const fmtDay = iso => {
  if (!iso) return '';
  const m = String(iso).match(/^(\d{4})-(\d{2})-(\d{2})/);
  if (!m) return iso;
  return new Date(Number(m[1]), Number(m[2]) - 1, Number(m[3])).toLocaleDateString('en-GB', { day: 'numeric', month: 'short' });
};

/* ─── Index Trend Card (single-window, real-trading-day area chart) ─────── */
function IndexTrendCard({ idx }) {
  const [records, setRecords] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let active = true;
    const load = async () => {
      setLoading(true);
      try {
        const now = Math.floor(Date.now() / 1000);
        const from = now - 2 * 366 * 24 * 3600;
        const h = await tryFetch(`/history/NEPSE?from=${from}&to=${now}&resolution=1D`);
        if (active) setRecords(Array.isArray(h) ? h : []);
      } catch {
        if (active) setRecords([]);
      } finally {
        if (active) setLoading(false);
      }
    };
    load();
    return () => { active = false; };
  }, []);

  const sorted = useMemo(
    () => [...records]
      .filter(r => r && r.close != null && r.timestamp != null)
      .sort((a, b) => a.timestamp - b.timestamp),
    [records]
  );

  const last = sorted[sorted.length - 1];
  const lastVal = last ? last.close : (idx?.value ?? null);
  const prevVal = sorted.length > 1 ? sorted[sorted.length - 2].close : null;
  const dayChangePct = (lastVal != null && prevVal != null && prevVal !== 0)
    ? ((lastVal - prevVal) / prevVal) * 100
    : (idx?.changePct ?? null);

  const retFor = (days, ytd) => {
    if (!last || sorted.length < 2) return null;
    let cutoff;
    if (ytd) {
      const y = new Date(last.timestamp * 1000).getFullYear();
      cutoff = Date.UTC(y, 0, 1) / 1000;
    } else {
      cutoff = last.timestamp - days * 24 * 3600;
    }
    let prev = null;
    for (let i = sorted.length - 1; i >= 0; i--) {
      if (sorted[i].timestamp <= cutoff) { prev = sorted[i]; break; }
    }
    if (!prev || prev.close <= 0) return null;
    return ((last.close - prev.close) / prev.close) * 100;
  };

  const cutoff = last ? last.timestamp - SIX_MONTHS : 0;
  const chartPts = useMemo(
    () => sorted.filter(r => r.timestamp >= cutoff).map(r => ({ time: r.time, value: r.close })),
    [sorted, cutoff]
  );
  const winReturn = chartPts.length >= 2 && lastVal != null
    ? ((lastVal - chartPts[0].value) / chartPts[0].value) * 100
    : null;
  const winUp = winReturn != null ? winReturn >= 0 : (idx?.change ?? 0) >= 0;

  const yearStart = last ? last.timestamp - 365 * 24 * 3600 : 0;
  const yearWindow = last ? sorted.filter(r => r.timestamp >= yearStart) : [];
  const hi = yearWindow.length ? Math.max(...yearWindow.map(r => r.high ?? r.close)) : null;
  const lo = yearWindow.length ? Math.min(...yearWindow.map(r => r.low ?? r.close)) : null;
  const rangePos = hi != null && lo != null && hi > lo && lastVal != null
    ? Math.max(0, Math.min(100, ((lastVal - lo) / (hi - lo)) * 100))
    : null;
  const offHigh = hi != null && lastVal != null && hi > 0 ? ((hi - lastVal) / hi) * 100 : null;

  const r3m = retFor(90, false);
  const rYTD = retFor(null, true);
  const r1y = retFor(365, false);

  const takeaway = [];
  if (offHigh != null) {
    if (offHigh <= 3) takeaway.push({ t: 'Near its 52-week high — strong, but chasing is risky', c: 'warn' });
    else if (offHigh <= 15) takeaway.push({ t: `${offHigh.toFixed(1)}% below its 52-week high — headroom to run`, c: 'ok' });
    else takeaway.push({ t: `Well below its 52-week high (${offHigh.toFixed(1)}% off)`, c: 'neutral' });
  }
  if (r3m != null) takeaway.push({
    t: `3-month momentum ${r3m >= 0 ? 'rising' : 'cooling'} (${r3m >= 0 ? '+' : ''}${r3m.toFixed(1)}%)`,
    c: r3m >= 0 ? 'ok' : 'warn',
  });
  if (rYTD != null) takeaway.push({
    t: `${rYTD >= 0 ? '+' : ''}${rYTD.toFixed(1)}% year-to-date`,
    c: rYTD >= 0 ? 'ok' : 'warn',
  });
  if (r1y != null) takeaway.push({
    t: `${r1y >= 0 ? '+' : ''}${r1y.toFixed(1)}% over 1 year`,
    c: r1y >= 0 ? 'ok' : 'warn',
  });

  // SVG geometry for the area chart
  const W = 600, H = 220, PADY = 10;
  const vals = chartPts.map(p => p.value);
  const vmin = vals.length ? Math.min(...vals) : 0;
  const vmax = vals.length ? Math.max(...vals) : 1;
  const span = (vmax - vmin) || 1;
  const n = vals.length;
  const px = i => (n > 1 ? (i / (n - 1)) * W : W / 2);
  const py = v => H - PADY - ((v - vmin) / span) * (H - PADY * 2);
  const linePts = vals.map((v, i) => `${px(i).toFixed(1)},${py(v).toFixed(1)}`);
  const areaPath = `M0,${H} L${linePts.join(' L')} L${W},${H} Z`;
  const color = winUp ? '#10b981' : '#ef4444';

  const firstLabel = chartPts.length ? fmtDay(chartPts[0].time) : '';
  const midLabel = chartPts.length > 2 ? fmtDay(chartPts[Math.floor(chartPts.length / 2)].time) : '';
  const lastLabel = chartPts.length ? fmtDay(chartPts[chartPts.length - 1].time) : '';
  const asOfLabel = last ? `${fmtDay(last.time)} ${String(last.time).slice(0, 4)}` : '';

  return (
    <div className="snapshot-card card">
      <div className="snapshot-head">
        <div>
          <div className="snapshot-title">NEPSE Index</div>
          <div className="snapshot-value-row">
            <span className="snapshot-value">
              {lastVal != null ? lastVal.toLocaleString('en-IN', { maximumFractionDigits: 2 }) : (idx?.value ? idx.value.toLocaleString('en-IN', { maximumFractionDigits: 2 }) : '—')}
            </span>
            {dayChangePct != null && (
              <span className={`change-badge ${dayChangePct >= 0 ? 'up' : 'down'}`}>
                {dayChangePct >= 0 ? <ChevronUp size={10} /> : <ChevronDown size={10} />}
                {Math.abs(dayChangePct).toFixed(2)}%
              </span>
            )}
            {!loading && winReturn != null && (
              <span className={`snapshot-win-return ${winUp ? 'positive' : 'negative'}`}>
                6 months {winUp ? '+' : ''}{winReturn.toFixed(1)}%
              </span>
            )}
          </div>
          {asOfLabel && (
            <div className="snapshot-asof">Daily closes · last 6 months · as of <strong>{asOfLabel}</strong></div>
          )}
        </div>
      </div>

      {loading && !last ? (
        <div className="snapshot-body"><div className="skeleton" style={{ width: '100%', height: '14rem' }} /></div>
      ) : (
        <div className="snapshot-body">
          {/* Area chart with real trading-day dates */}
          <div className="snapshot-chart">
            {chartPts.length > 1 ? (
              <>
                <svg className="snapshot-chart-svg" viewBox={`0 0 ${W} ${H}`} preserveAspectRatio="none" role="img" aria-label="NEPSE index, last 6 months">
                  <defs>
                    <linearGradient id="nepseGrad" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="0%" stopColor={color} stopOpacity="0.35" />
                      <stop offset="100%" stopColor={color} stopOpacity="0" />
                    </linearGradient>
                  </defs>
                  <path d={areaPath} fill="url(#nepseGrad)" />
                  <polyline
                    points={linePts.join(' ')}
                    fill="none"
                    stroke={color}
                    strokeWidth="2.5"
                    vectorEffect="non-scaling-stroke"
                    strokeLinejoin="round"
                    strokeLinecap="round"
                  />
                  {n > 1 && <circle cx={px(n - 1)} cy={py(vals[n - 1])} r="4.5" fill={color} />}
                </svg>
                <div className="snapshot-chart-labels">
                  <span>{firstLabel}</span>
                  <span>{midLabel}</span>
                  <span>{lastLabel}</span>
                </div>
              </>
            ) : (
              <div className="snapshot-chart-empty">
                <Activity size={20} style={{ opacity: 0.35 }} />
                <span>{loading ? 'Loading chart…' : 'No chart data'}</span>
              </div>
            )}
          </div>

          {/* 52-week range */}
          <div className="snapshot-range-block">
            <div className="snapshot-range-track">
              {rangePos != null && (
                <span className="snapshot-range-marker" style={{ left: `${rangePos}%` }} title={`Current position ${rangePos.toFixed(0)}% of 52-week range`} />
              )}
            </div>
            <div className="snapshot-range-labels">
              <span className="snapshot-range-lo">52w Low {lo != null ? fmtNum(lo) : '—'}</span>
              <span className="snapshot-range-hi">52w High {hi != null ? fmtNum(hi) : '—'}</span>
            </div>
          </div>

          {/* Takeaway */}
          {takeaway.length > 0 && (
            <div className="snapshot-takeaway">
              {takeaway.map((bit, i) => (
                <span key={i} className={`snapshot-takeaway-bit ${bit.c}`}>{bit.t}</span>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
}

/* ─── Market History & Performance Section Component ────────────────────── */
/* ─── Market Breadth (advancers / decliners from live tape) ─────────────── */
function BreadthCard() {
  const [breadth, setBreadth] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let active = true;
    const load = async () => {
      try {
        const res = await fetch('/api/nepse/live-market', { signal: AbortSignal.timeout(10000) });
        const json = await res.json();
        const list = json.liveMarket || [];
        let up = 0, down = 0, flat = 0;
        list.forEach(s => {
          const c = s.percentageChange;
          if (c == null) return;
          if (c > 0) up++; else if (c < 0) down++; else flat++;
        });
        if (active) setBreadth({ up, down, flat, total: list.length });
      } catch {
        if (active) setBreadth(null);
      } finally {
        if (active) setLoading(false);
      }
    };
    load();
    return () => { active = false; };
  }, []);

  const ratio = breadth && breadth.down > 0 ? (breadth.up / breadth.down) : (breadth && breadth.up > 0 ? 99 : 0);
  const healthy = breadth && breadth.up >= breadth.down;
  const total = breadth ? Math.max(1, breadth.total) : 1;

  return (
    <div className="breadth-card card">
      <div className="ai-card-head">
        <div>
          <div className="ai-card-title"><BarChart3 size={14} /> Market Breadth</div>
          <div className="ai-card-sub">How many stocks are rising vs falling today</div>
        </div>
      </div>
      <div className="breadth-body">
        {loading || !breadth ? (
          <div className="skeleton" style={{ width: '100%', height: '5.5rem' }} />
        ) : (
          <>
            <div className="breadth-counts">
              <div className="breadth-count breadth-up">
                <span className="breadth-num positive">{breadth.up}</span>
                <span className="breadth-label">Advancing</span>
              </div>
              <div className="breadth-count breadth-flat">
                <span className="breadth-num">{breadth.flat}</span>
                <span className="breadth-label">Flat</span>
              </div>
              <div className="breadth-count breadth-down">
                <span className="breadth-num negative">{breadth.down}</span>
                <span className="breadth-label">Declining</span>
              </div>
            </div>
            <div className="breadth-bar">
              <span className="breadth-bar-up" style={{ width: `${(breadth.up / total) * 100}%` }} />
              <span className="breadth-bar-flat" style={{ width: `${(breadth.flat / total) * 100}%` }} />
              <span className="breadth-bar-down" style={{ width: `${(breadth.down / total) * 100}%` }} />
            </div>
            <div className={`breadth-verdict ${healthy ? 'positive' : 'negative'}`}>
              {healthy
                ? <>Breadth confirms buyers — advancers are {ratio >= 1.5 ? 'clearly' : ''} ahead of decliners.</>
                : <>Sellers in control today — more stocks down than up.</>}
            </div>
          </>
        )}
      </div>
    </div>
  );
}

/* ─── AI Top Picks (actionable buy candidates) ──────────────────────────── */
const PICK_LEGEND = [
  {
    term: 'Rating',
    dot: 'var(--green)',
    desc: 'Score out of 100 — higher is a stronger buy case. STRONG BUY & BUY = green, HOLD = amber, SELL = red.',
  },
  {
    term: 'RSI',
    dot: '#f59e0b',
    desc: 'Momentum gauge 0–100. Above 70 = overbought (pricey, pullback risk), below 30 = oversold. A mid-range RSI on a strong stock is the better entry.',
  },
  {
    term: 'Entry zone',
    dot: 'var(--accent)',
    desc: 'Support (S) = a price floor buyers defend, Resistance (R) = a ceiling sellers cap. Buying near support beats chasing near resistance.',
  },
];

function AIPicksCard({ data, loading }) {
  const navigate = useNavigate();
  const [showHelp, setShowHelp] = useState(false);
  const picks = (data?.topPicks || []).slice(0, 5);

  return (
    <div className="ai-picks card">
      <div className="ai-card-head">
        <div>
          <div className="ai-card-title"><Target size={14} /> What to look at right now</div>
          <div className="ai-card-sub">
            AI buy candidates (quality + timing)
            {data?.asOf ? <> · data as of <strong>{fmtDate(data.asOf)}</strong></> : null}
          </div>
        </div>
        <div className="ai-head-actions">
          <button className="ai-link-btn" onClick={() => setShowHelp(!showHelp)} aria-expanded={showHelp}>
            <HelpCircle size={12} /> {showHelp ? 'Hide guide' : 'How to read'}
          </button>
          <button className="ai-link-btn" onClick={() => navigate('/investment/screener')}>
            Full screener <ArrowRight size={12} />
          </button>
        </div>
      </div>

      {showHelp && (
        <div className="ai-legend">
          {PICK_LEGEND.map(item => (
            <div className="ai-legend-item" key={item.term}>
              <span className="ai-legend-dot" style={{ background: item.dot }} />
              <span className="ai-legend-term">{item.term}</span>
              <span className="ai-legend-desc">{item.desc}</span>
            </div>
          ))}
        </div>
      )}

      <div className="ai-picks-list">
        {loading ? (
          Array.from({ length: 5 }).map((_, i) => (
            <div className="ai-pick-row" key={i}><div className="skeleton" style={{ width: '100%', height: '1.5rem' }} /></div>
          ))
        ) : picks.length === 0 ? (
          <div className="movers-empty">No picks right now — {data?.marketRegime?.regime ? `market in ${data.marketRegime.regime}` : 'check back'}</div>
        ) : (
          picks.map(p => (
            <div className="ai-pick-row" key={p.symbol} onClick={() => navigate(`/investment/screener?symbol=${p.symbol}`)}>
              <div className="ai-pick-sym">
                <span className="ai-pick-symbol">{p.symbol}</span>
                <span className="ai-pick-sector">{p.sector}</span>
              </div>
              <div className="ai-pick-rating">
                <span className="ai-pick-verdict" style={{ color: ratingColor(p.ratingVerdict), background: verdictBg(p.ratingVerdict) }}>{p.ratingVerdict}</span>
                <span className="ai-pick-score">{Math.round(p.rating)}</span>
              </div>
              <div className="ai-pick-rsi">
                <span className="ai-pick-kv-label">RSI</span>
                <b style={{ color: rsiColor(p.rsi) }}>{p.rsi}</b>
              </div>
              <div className="ai-pick-price">
                <span className="ai-pick-ltp">{fmtNPR(p.price)}</span>
                <span className="ai-pick-zone">in S {p.support != null ? fmtNum(p.support) : '—'} · R {p.resistance != null ? fmtNum(p.resistance) : '—'}</span>
              </div>
              <ArrowRight size={14} className="ai-pick-arrow" />
            </div>
          ))
        )}
      </div>
    </div>
  );
}

/* ─── Sector Rotation (momentum leaders / laggards) ─────────────────────── */
function SectorRotationCard({ data, loading }) {
  const sectors = (data?.topSectors || []).slice(0, 6);

  return (
    <div className="sector-rot card">
      <div className="ai-card-head">
        <div>
          <div className="ai-card-title"><Layers size={14} /> Sector Rotation</div>
          <div className="ai-card-sub">Where the money is moving · 20d & 5d momentum</div>
        </div>
      </div>
      <div className="sector-rot-list">
        {loading ? (
          Array.from({ length: 5 }).map((_, i) => (
            <div className="sector-rot-row" key={i}><div className="skeleton" style={{ width: '100%', height: '1.6rem' }} /></div>
          ))
        ) : sectors.length === 0 ? (
          <div className="movers-empty">No sector data</div>
        ) : (
          sectors.map(s => {
            const width = (Math.abs(clampPct(s.ret20)) / 25) * 100;
            const up = s.ret20 >= 0;
            return (
              <div className="sector-rot-row" key={s.name}>
                <div className="sector-rot-head">
                  <span className="sector-rot-name">{s.name}</span>
                  <span className={`sector-rot-trend ${s.trend === 'STRENGTHENING' ? 'up' : s.trend === 'WEAKENING' ? 'down' : 'flat'}`}>{s.trend}</span>
                </div>
                <div className="sector-rot-bar">
                  <span className={up ? 'sector-rot-fill-up' : 'sector-rot-fill-down'} style={{ width: `${Math.max(4, width)}%` }} />
                </div>
                <div className="sector-rot-stats">
                  <span className={up ? 'positive' : 'negative'} title="Average stock return over the last 20 sessions">{up ? '+' : ''}{s.ret20}% 20d avg</span>
                  <span style={{ color: 'var(--text-muted)' }} title="Share of sector stocks trading above their 20-day average">{s.pctAboveSma20}% above avg</span>
                </div>
              </div>
            );
          })
        )}
      </div>
    </div>
  );
}

/* ─── Main page ──────────────────────────────────────────────────────────── */
export default function Investment() {
  const [summary,       setSummary]       = useState(null);
  const [indices,       setIndices]       = useState([]);
  const [gainers,       setGainers]       = useState([]);
  const [losers,        setLosers]        = useState([]);
  const [turnover,      setTurnover]      = useState([]);
  const [loading,       setLoading]       = useState(false);
  const [backendOnline, setBackendOnline] = useState(false);
  const [lastUpdated,   setLastUpdated]   = useState(null);
  const [countdown,     setCountdown]     = useState(90);
  const [marketRegime,  setMarketRegime]  = useState(null);
  const [aiOverview,    setAiOverview]    = useState(null);
  const [aiLoading,     setAiLoading]     = useState(true);
  const [showTrust,     setShowTrust]     = useState(false);

  useEffect(() => {
    const iv = setInterval(() => setCountdown(c => (c > 1 ? c - 1 : 90)), 1000);
    return () => clearInterval(iv);
  }, []);

  useEffect(() => {
    fetch('/api/ai/market-regime')
      .then(r => (r.ok ? r.json() : null))
      .then(d => { if (d && !d.offline) setMarketRegime(d); })
      .catch(() => {});
  }, []);

  useEffect(() => {
    let active = true;
    const load = async () => {
      try {
        const res = await fetch('/api/ai/screener?strategy=both&top=6');
        const json = await res.json();
        if (!active) return;
        setAiOverview(json);
        if (json.marketRegime) setMarketRegime(json.marketRegime);
      } catch {
        if (active) setAiOverview(null);
      } finally {
        if (active) setAiLoading(false);
      }
    };
    load();
    return () => { active = false; };
  }, []);

  const loadData = useCallback(async () => {
    setLoading(true);
    try {
      const [sumData, idxData, gainData, loseData, turnData] = await Promise.all([
        tryFetch('/summary'),
        tryFetch('/indices'),
        tryFetch('/top-gainers'),
        tryFetch('/top-losers'),
        tryFetch('/top-turnover'),
      ]);
      setSummary(sumData);
      setIndices(idxData.indices || []);
      setGainers(gainData.gainers || []);
      setLosers(loseData.losers || []);
      setTurnover(turnData.turnover || []);
      setBackendOnline(true);
      setLastUpdated(
        sumData?.asOf
          ? new Date(sumData.asOf).toLocaleString('en-US', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' })
          : new Date().toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' })
      );
    } catch {
      setBackendOnline(false);
      setSummary({ isOpen: false });
      setIndices([]);
      setGainers([]);
      setLosers([]);
      setTurnover([]);
    } finally {
      setLoading(false);
      setCountdown(90);
    }
  }, []);

  useEffect(() => {
    const id = window.setTimeout(() => {
      void loadData();
    }, 0);
    const iv = window.setInterval(loadData, 90000);
    return () => {
      window.clearTimeout(id);
      window.clearInterval(iv);
    };
  }, [loadData]);

  return (
    <main className="page">
      {/* ── Header ── */}
      <div className="page-header investment-page-header">
        <div className="page-header-left">
          <h1 className="page-title">
            <TrendingUp size={22} style={{ marginRight: '0.6rem', color: 'var(--accent)' }} />
            NEPSE Market
          </h1>
          <p className="page-subtitle">
            Nepal Stock Exchange · Live & Multi-Year Historical Data
          </p>
        </div>
        <div className="investment-header-right">
          {summary && summary.nepseIndex && (
            <div className={`nepse-index-badge ${summary.nepseChange >= 0 ? 'up' : 'down'}`}>
              <span className="nib-label">NEPSE</span>
              <span className="nib-value">
                {summary.nepseIndex.toLocaleString('en-IN', { maximumFractionDigits: 2 })}
              </span>
              <span className="nib-change">
                {summary.nepseChange >= 0 ? <ChevronUp size={12} /> : <ChevronDown size={12} />}
                {Math.abs(summary.nepseChange).toFixed(2)}
              </span>
            </div>
          )}
        </div>
      </div>

      {/* ── Market status bar — always visible ── */}
      <MarketStatusBar
        isOpen={summary?.isOpen || false}
        statusText={summary?.statusText || ''}
        backendOnline={backendOnline}
        lastUpdated={lastUpdated}
        onRefresh={loadData}
        loading={loading}
        countdown={countdown}
      />

      <div className="page-content investment-content">
        {/* ── Market regime context (same data as the screener) ── */}
        {marketRegime && !marketRegime.error && (
          <div style={{ marginTop: '0.25rem', marginBottom: '1rem' }}>
            <RegimeBanner marketRegime={marketRegime} />
          </div>
        )}

        {/* ── Index KPI cards ── */}
        <div className="index-kpi-grid">
          <IndexKPICard
            name="NEPSE Index"
            value={summary?.nepseIndex ?? 0}
            change={summary?.nepseChange ?? 0}
            changePct={summary?.nepseChangePct ?? 0}
            loading={loading}
          />
          <StatKPICard
            name="Sensitive Index"
            value={summary?.sensitiveIndex != null
              ? summary.sensitiveIndex.toLocaleString('en-IN', { maximumFractionDigits: 2 })
              : '—'}
            sub={summary?.sensitiveChange != null ? `${fmtPt(summary.sensitiveChange)} pts` : '—'}
            icon={TrendingUp}
            color="var(--green)"
            loading={loading}
          />
          <StatKPICard
            name="Float Index"
            value={summary?.floatIndex != null
              ? summary.floatIndex.toLocaleString('en-IN', { maximumFractionDigits: 2 })
              : '—'}
            sub={summary?.floatChange != null ? `${fmtPt(summary.floatChange)} pts` : '—'}
            icon={TrendingDown}
            color="var(--red)"
            loading={loading}
          />
          <StatKPICard
            name="Total Turnover"
            value={fmtNPRk(summary?.totalTurnover ?? 0)}
            sub={`Vol: ${fmtNum(summary?.totalVolume ?? 0)} shares`}
            icon={Activity}
            color="var(--blue)"
            loading={loading}
          />
        </div>

        {/* ── Actionable intelligence: picks + sector rotation ── */}
        <div className="overview-grid">
          <AIPicksCard data={aiOverview} loading={aiLoading} />
          <SectorRotationCard data={aiOverview} loading={aiLoading} />
        </div>

        {/* ── Honesty scorecard (trust) ── */}
        <div style={{ marginTop: '1rem' }}>
          <button className="trust-toggle" onClick={() => setShowTrust(s => !s)}>
            <ShieldCheck size={15} style={{ color: '#0ea5e9' }} />
            Does this actually work? — honest performance scorecard
            {showTrust ? <ChevronUp size={14} /> : <ChevronDown size={14} />}
          </button>
          {showTrust && <TrustCheck />}
        </div>

        {/* ── Breadth + index trend ── */}
        <div className="overview-grid">
          <IndexTrendCard idx={indices[0]} />
          <div className="overview-movers">
            <BreadthCard />
            <MoversCard title="Top Turnover" type="turnover" data={turnover} loading={loading} metric="turnover" />
          </div>
        </div>

        {/* ── Day movers + sentiment ── */}
        <div className="overview-grid">
          <MoversCard title="Top Gainers" type="gainers" data={gainers} loading={loading} />
          <MoversCard title="Top Losers" type="losers" data={losers} loading={loading} />
        </div>

        <MarketSentiment />
        <NewsPanel />
      </div>
    </main>
  );
}
