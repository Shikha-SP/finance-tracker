import { useState, useEffect, useCallback } from 'react';
import {
  Activity, RefreshCw, X, Newspaper, DollarSign, Sparkles,
  ShieldCheck, ChevronDown, ChevronUp, Clock, AlertTriangle
} from 'lucide-react';
import StockNews from '../components/StockNews';
import TrustCheck from '../components/TrustCheck';
import BasketBuilder from '../components/BasketBuilder';
import RegimeBanner from '../lib/regime';
import { AreaChart, Area, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid } from 'recharts';

const SECTORS = ['ALL', 'Commercial Banks', 'Development Banks', 'Finance', 'Hydro Power', 'Life Insurance', 'Non Life Insurance', 'Manufacturing And Processing', 'Microfinance', 'Hotels And Tourism', 'Trading', 'Others'];

const STRATEGIES = [
  { value: 'both',        label: 'Both',        hint: 'quality + timing' },
  { value: 'fundamental', label: 'Fundamentals', hint: 'quality first' },
  { value: 'technical',   label: 'Technicals',   hint: 'timing first' },
];

const GRID = '1.3fr 1.1fr 90px 70px 105px 120px 95px';

const fmtNPR  = n => 'रू ' + Math.abs(n).toLocaleString('en-IN', { maximumFractionDigits: 2 });
const fmtNPRk = n => {
  if (n >= 1e9) return 'रू ' + (n / 1e9).toFixed(2) + 'B';
  if (n >= 1e6) return 'रू ' + (n / 1e6).toFixed(2) + 'M';
  return fmtNPR(n);
};
const fmtDate = iso => {
  if (!iso) return '—';
  const d = new Date(iso);
  if (isNaN(d)) return iso;
  return d.toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' });
};
const clampPos = v => Math.max(2, Math.min(98, Number(v) || 0));

const ratingColor = v => v === 'STRONG BUY' ? 'var(--green)' : v === 'BUY' ? 'var(--green)' : v === 'HOLD' ? '#f59e0b' : v === 'SELL' ? '#f97316' : '#ef4444';
const verdictBg = v => (v === 'STRONG BUY' || v === 'BUY') ? 'rgba(16,185,129,0.15)' : v === 'HOLD' ? 'rgba(245,158,11,0.15)' : 'rgba(239,68,68,0.15)';

const sessionsLabel = s => {
  if (s == null) return '—';
  if (s <= 1) return '~1 session';
  const w = Math.round(s / 5);
  const suffix = w > 1 ? ` (~${w} weeks)` : w === 1 ? ' (~1 week)' : '';
  return `~${s} sessions${suffix}`;
};

export default function StockScreener() {
  const [sector, setSector] = useState('ALL');
  const [maxPe, setMaxPe] = useState(60);
  const [strategy, setStrategy] = useState('both');
  const [searchQuery, setSearchQuery] = useState('');

  const [screenerLoading, setScreenerLoading] = useState(true);
  const [results, setResults] = useState([]);
  const [topPicks, setTopPicks] = useState([]);
  const [marketBias, setMarketBias] = useState(null);
  const [marketRegime, setMarketRegime] = useState(null);
  const [topSectors, setTopSectors] = useState([]);
  const [asOf, setAsOf] = useState(null);

  const [selectedSymbol, setSelectedSymbol] = useState(null);
  const [analysisData, setAnalysisData] = useState(null);
  const [analysisLoading, setAnalysisLoading] = useState(false);
  const [showTrust, setShowTrust] = useState(false);

  const runScreener = useCallback(async () => {
    setScreenerLoading(true);
    try {
      const params = new URLSearchParams({ sector, maxPe, strategy, top: 5 });
      const res = await fetch(`/api/ai/screener?${params.toString()}`);
      const json = await res.json();
      setResults(json.screenerResults || []);
      setTopPicks(json.topPicks || []);
      setMarketBias(json.marketBias || null);
      setMarketRegime(json.marketRegime || null);
      setTopSectors(json.topSectors || []);
      setAsOf(json.asOf || json.marketRegime?.asOf || null);
    } catch (err) {
      console.error("Screener fetch error:", err);
    } finally {
      setScreenerLoading(false);
    }
  }, [sector, maxPe, strategy]);

  useEffect(() => {
    const id = window.setTimeout(() => void runScreener(), 0);
    return () => window.clearTimeout(id);
  }, [runScreener]);

  const handleSelectSymbol = async sym => {
    setSelectedSymbol(sym);
    setAnalysisLoading(true);
    try {
      const res = await fetch(`/api/ai/analyze/${sym}`);
      setAnalysisData(await res.json());
    } catch (err) {
      console.error("Analysis fetch error:", err);
    } finally {
      setAnalysisLoading(false);
    }
  };

  // Deep-link support: ?symbol=SANIMA opens that company's analysis on load.
  useEffect(() => {
    const sym = new URLSearchParams(window.location.search).get('symbol');
    if (sym) void handleSelectSymbol(sym.toUpperCase());
  }, []);

  const inDowntrend = marketRegime?.regime === 'DOWNTREND';

  const filteredResults = results.filter(item =>
    item.symbol.toLowerCase().includes(searchQuery.toLowerCase()) ||
    item.name.toLowerCase().includes(searchQuery.toLowerCase())
  );

  return (
    <main className="page">
      {/* ── Header ── */}
      <div className="page-header">
        <div className="page-header-left">
          <h1 className="page-title" style={{ display: 'flex', alignItems: 'center', gap: '0.6rem' }}>
            <Sparkles size={22} style={{ color: '#f59e0b' }} />
            Stock Screener
          </h1>
          <p className="page-subtitle">
            {results.length} stocks analyzed · data as of <strong style={{ color: 'var(--text-primary)' }}>{fmtDate(asOf)}</strong>
          </p>
        </div>
        <button className="btn-outline" onClick={runScreener} disabled={screenerLoading}>
          <RefreshCw size={14} className={screenerLoading ? 'spin' : ''} style={{ marginRight: '0.3rem' }} /> Refresh
        </button>
      </div>

      <div className="page-content sc-page">
        {/* ── Market Regime Hero ── */}
        <RegimeBanner marketRegime={marketRegime} />

        {/* ── Simple controls ── */}
        <div className="sc-controls card" style={{ padding: '1rem 1.25rem' }}>
          <div className="sc-search-wrap">
            <input
              type="text"
              placeholder="Search symbol or company…"
              value={searchQuery}
              onChange={e => setSearchQuery(e.target.value)}
              className="sc-search"
            />
          </div>
          <select value={sector} onChange={e => setSector(e.target.value)} className="sc-select" title="Sector filter">
            {SECTORS.map(s => <option key={s} value={s}>{s === 'ALL' ? 'All sectors' : s}</option>)}
          </select>
          <div className="sc-strategy" title="Selection strategy">
            {STRATEGIES.map(s => (
              <button
                key={s.value}
                onClick={() => setStrategy(s.value)}
                className={`sc-strat-btn${strategy === s.value ? ' active' : ''}`}
              >
                {s.label}
              </button>
            ))}
          </div>
          <div className="sc-pe">
            <span className="sc-pe-label">Max P/E <b>{maxPe}x</b></span>
            <input type="range" min="10" max="80" value={maxPe} onChange={e => setMaxPe(Number(e.target.value))} style={{ width: '100%', accentColor: 'var(--accent)' }} />
          </div>
        </div>

        {/* ── Hottest sectors ── */}
        {topSectors.length > 0 && (
          <div className="sc-sectors">
            <span className="sc-sectors-label">Hottest sectors right now</span>
            {topSectors.map(s => {
              const hot = s.momentumScore >= 1;
              const cold = s.momentumScore <= -1;
              return (
                <span key={s.name} className="sector-chip" style={{ background: 'var(--bg-surface)', border: '1px solid var(--border)' }}>
                  <span style={{ fontSize: '0.74rem', fontWeight: 700, color: 'var(--text-primary)' }}>{s.name}</span>
                  <span className="change-badge" style={{ color: hot ? 'var(--green)' : cold ? '#ef4444' : 'var(--text-muted)' }}>
                    {hot ? 'HOT' : cold ? 'COLD' : 'FLAT'} {s.momentumScore > 0 ? '+' : ''}{s.momentumScore}
                  </span>
                  <span style={{ fontSize: '0.64rem', color: 'var(--text-muted)' }}>20d {s.ret20 > 0 ? '+' : ''}{s.ret20}%</span>
                </span>
              );
            })}
          </div>
        )}

        {/* ── Top Picks ── */}
        {!screenerLoading && (
          <div className="card" style={{ padding: '1.25rem' }}>
            <div className="pick-head">
              <div>
                <h2 className="pick-title">
                  {inDowntrend ? 'Watch List — not a buy list' : 'Top Picks'}
                </h2>
                <p className="pick-sub">
                  {inDowntrend
                    ? 'Market is falling. These are the strongest stocks, for watching only — small size, tight stops.'
                    : 'Strongest candidates to act on now — as of ' + fmtDate(asOf) + '.'}
                </p>
              </div>
            </div>

            {topPicks.length === 0 ? (
              <div style={{ fontSize: '0.85rem', color: 'var(--text-muted)', textAlign: 'center', padding: '1.5rem 0' }}>
                No stocks passed both rounds with these filters. Try widening Max P/E.
              </div>
            ) : (
              <div className="pick-grid">
                {topPicks.map((p, i) => (
                  <div key={p.symbol} className="pick-card" onClick={() => handleSelectSymbol(p.symbol)}>
                    <div className="pick-card-top">
                      <div className="pick-id">
                        <span className="pick-rank">{i + 1}</span>
                        <div>
                          <div className="pick-symbol">{p.symbol}</div>
                          <div className="pick-name">{p.name}</div>
                        </div>
                      </div>
                      <span className="pick-verdict" style={{ background: verdictBg(p.ratingVerdict), color: ratingColor(p.ratingVerdict), borderColor: ratingColor(p.ratingVerdict) }}>
                        {p.ratingVerdict} · {p.rating}
                      </span>
                    </div>

                    <div className="pick-why">
                      {(p.ratingParts || []).slice(0, 3).map((part, idx) => {
                        const [title, detail, effect] = part;
                        const good = effect.startsWith('+');
                        const bad = effect.startsWith('-');
                        return (
                          <span key={idx} className="pick-why-chip" title={detail}>
                            {title}: <b style={{ color: good ? 'var(--green)' : bad ? '#ef4444' : 'var(--text-primary)' }}>{effect}</b>
                          </span>
                        );
                      })}
                      <span className="pick-date"><Clock size={11} /> {fmtDate(asOf)}</span>
                    </div>

                    <div className="pick-stats">
                      <div className="pick-stat">
                        <span className="pick-stat-label">Price</span>
                        <b>{fmtNPR(p.price)}</b>
                      </div>
                      <div className="pick-stat">
                        <span className="pick-stat-label">RSI</span>
                        <b style={{ color: p.rsi >= 70 ? '#ef4444' : 'var(--text-primary)' }}>{p.rsi}</b>
                      </div>
                      <div className="pick-stat">
                        <span className="pick-stat-label">AI signal</span>
                        <b style={{ color: p.aiSignal === 'BULLISH' ? 'var(--green)' : p.aiSignal === 'BEARISH' ? '#ef4444' : 'var(--text-primary)' }}>
                          {p.aiSignal || '—'} {p.confidenceScore ? `(${p.confidenceScore}%)` : ''}
                        </b>
                      </div>
                      <div className="pick-stat">
                        <span className="pick-stat-label">Sentiment</span>
                        <b style={{ color: (p.sentimentScore || 0) > 0.1 ? 'var(--green)' : (p.sentimentScore || 0) < -0.1 ? '#ef4444' : 'var(--text-primary)' }}>
                          {p.sentimentLabel || '—'}
                        </b>
                      </div>
                    </div>

                    <div className="pick-levels">
                      <span className="pick-level"><span className="pick-lvl-label">Entry zone</span><b>रू {p.support ?? '—'}</b></span>
                      <span className="pick-level"><span className="pick-lvl-label">Target</span><b className="positive">रू {p.resistance ?? '—'}</b></span>
                      <span className="pick-level"><span className="pick-lvl-label">Stop</span><b style={{ color: '#ef4444' }}>below रू {p.support ?? '—'}</b></span>
                    </div>

                    <div className="pick-pos">
                      <span className="pick-pos-label">price at {p.positionPct ?? '—'}% of support/resistance range</span>
                      <div className="pos-bar">
                        <span className="pos-dot" style={{ left: `${clampPos(p.positionPct)}%` }} />
                      </div>
                    </div>

                    {p.nearResistance ? (
                      <div className="pick-note warn">Chasing into resistance — wait for a breakout, or skip.</div>
                    ) : p.nearSupport ? (
                      <div className="pick-note ok">Sitting on support — low-risk entry, room to {p.resistance ? `रू ${p.resistance}` : 'resistance'}.</div>
                    ) : (p.rsi || 0) >= 68 && (p.positionPct || 0) >= 75 ? (
                      <div className="pick-note warn">Overextended (RSI {p.rsi}) — expect a pullback, wait for support.</div>
                    ) : null}

                    {inDowntrend && (
                      <div className="pick-note warn"><AlertTriangle size={12} /> Market falling — small size only, stop below support.</div>
                    )}
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {/* ── Buy basket ── */}
        {!screenerLoading && (
          <BasketBuilder results={results} loading={screenerLoading} asOf={asOf} inDowntrend={inDowntrend} />
        )}

        {/* ── Trust Check (collapsible) ── */}
        <button className="trust-toggle" onClick={() => setShowTrust(s => !s)}>
          <ShieldCheck size={15} style={{ color: '#0ea5e9' }} />
          Does this actually work? — honest performance scorecard
          {showTrust ? <ChevronUp size={14} /> : <ChevronDown size={14} />}
        </button>
        {showTrust && <TrustCheck />}

        {/* ── Full list ── */}
        <div className="stock-table-block">
          <div className="stock-table-header">
            <div className="stock-table-title-row">
              <div className="stock-table-indicator" style={{ background: 'var(--accent)' }} />
              <span className="stock-table-title">All passing stocks ({filteredResults.length})</span>
            </div>
            <span style={{ fontSize: '0.78rem', color: 'var(--text-muted)' }}>Click a row for the full AI analysis</span>
          </div>

          <div className="stock-table-body">
            <div className="stock-table-row stock-table-head-row" style={{ display: 'grid', gridTemplateColumns: GRID }}>
              <span>Symbol</span><span>Sector</span><span>LTP</span><span>P/E</span>
              <span>AI Signal</span><span>Sentiment</span><span>Rating</span>
            </div>

            {screenerLoading ? (
              Array.from({ length: 4 }).map((_, i) => (
                <div className="stock-table-row loading-row" key={i}>
                  {Array.from({ length: 7 }).map((_, j) => <span key={j}><div className="skeleton" /></span>)}
                </div>
              ))
            ) : filteredResults.map(item => (
              <div
                key={item.symbol}
                onClick={() => handleSelectSymbol(item.symbol)}
                className={`stock-table-row stock-table-data-row${selectedSymbol === item.symbol ? ' active' : ''}`}
                style={{
                  display: 'grid', gridTemplateColumns: GRID, cursor: 'pointer',
                  background: selectedSymbol === item.symbol ? 'var(--bg-surface)' : undefined,
                  borderLeft: selectedSymbol === item.symbol ? '3px solid var(--accent)' : undefined
                }}
              >
                <span className="stock-symbol" style={{ color: 'var(--text-primary)', fontWeight: 700 }}>
                  {item.symbol}
                  <div style={{ fontSize: '0.7rem', color: 'var(--text-muted)', fontWeight: 400 }}>{item.name}</div>
                </span>
                <span style={{ color: 'var(--text-muted)', fontSize: '0.8rem' }}>{item.sector}</span>
                <span style={{ fontWeight: 600 }}>{fmtNPR(item.price)}</span>
                <span style={{ fontFamily: "'DM Mono', monospace" }}>{item.peRatio}x</span>
                <span>
                  <span className={`change-badge ${item.aiSignal === 'BULLISH' ? 'up' : 'down'}`}>
                    {item.aiSignal || '—'} {item.bullishProb != null ? `(${item.bullishProb}%)` : ''}
                  </span>
                </span>
                <span>
                  <span className={`change-badge ${(item.sentimentScore || 0) > 0.1 ? 'up' : (item.sentimentScore || 0) < -0.1 ? 'down' : ''}`}>
                    {item.sentimentLabel || '—'}{item.sentimentScore != null ? ` (${item.sentimentScore})` : ''}
                  </span>
                </span>
                <span style={{ textAlign: 'center' }}>
                  <strong style={{ color: ratingColor(item.ratingVerdict), fontSize: '0.8rem' }}>{item.ratingVerdict}</strong>
                  <div style={{ fontSize: '0.68rem', color: 'var(--text-muted)' }}>{item.rating}/100</div>
                </span>
              </div>
            ))}
          </div>
        </div>

        {/* ── Analysis drawer ── */}
        {selectedSymbol && (
          <div className="card" style={{ padding: '1.5rem', marginTop: '1.5rem' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.25rem', borderBottom: '1px solid var(--border)', paddingBottom: '0.75rem' }}>
              <div>
                <h2 style={{ fontSize: '1.2rem', fontWeight: 700, color: 'var(--text-primary)', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                  <Activity size={20} style={{ color: 'var(--accent)' }} />
                  {selectedSymbol} — Full AI Analysis
                </h2>
                <div style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>
                  Technical indicators, fundamentals, news sentiment & explainable rating · as of {fmtDate(asOf)}
                </div>
              </div>
              <button
                onClick={() => setSelectedSymbol(null)}
                style={{ background: 'var(--bg-surface)', border: '1px solid var(--border)', borderRadius: '50%', width: '32px', height: '32px', display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--text-muted)', cursor: 'pointer' }}
              >
                <X size={16} />
              </button>
            </div>

            {analysisLoading ? (
              <div style={{ display: 'flex', justifyContent: 'center', padding: '3rem 0' }}>
                <RefreshCw size={24} className="spin" style={{ color: 'var(--accent)' }} />
              </div>
            ) : analysisData ? (
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(320px, 1fr))', gap: '1.5rem' }}>
                {/* Left: chart + technicals */}
                <div>
                  <div style={{ background: 'var(--bg-surface)', padding: '1rem', borderRadius: 'var(--radius-md)', border: '1px solid var(--border)', marginBottom: '1rem' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '0.75rem' }}>
                      <span style={{ fontWeight: 700, color: 'var(--text-primary)' }}>Price history</span>
                      <span style={{ fontWeight: 700, color: 'var(--accent)' }}>{fmtNPR(analysisData.currentPrice)}</span>
                    </div>
                    <div style={{ width: '100%', height: 220 }}>
                      <ResponsiveContainer width="100%" height="100%">
                        <AreaChart data={analysisData.chartData}>
                          <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" />
                          <XAxis dataKey="date" stroke="var(--text-muted)" tick={{ fontSize: 10 }} />
                          <YAxis domain={['auto', 'auto']} stroke="var(--text-muted)" tick={{ fontSize: 10 }} />
                          <Tooltip contentStyle={{ backgroundColor: 'var(--bg-card)', borderColor: 'var(--border)', borderRadius: '8px', fontSize: '12px' }} />
                          <Area type="monotone" dataKey="close" stroke="var(--accent)" fill="var(--accent-soft, rgba(59,130,246,0.15))" />
                        </AreaChart>
                      </ResponsiveContainer>
                    </div>
                  </div>

                  {analysisData.supportResistance && (
                    <div style={{ background: 'var(--bg-surface)', padding: '0.9rem', borderRadius: 'var(--radius-md)', border: '1px solid var(--border)', fontSize: '0.8rem' }}>
                      <div style={{ fontWeight: 700, color: 'var(--text-primary)', marginBottom: '0.5rem' }}>Entry / Target / Stop</div>
                      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '0.5rem', marginBottom: '0.4rem' }}>
                        <span style={{ color: 'var(--text-muted)' }}>Support: <strong style={{ color: 'var(--text-primary)' }}>{fmtNPR(analysisData.supportResistance.support)}</strong></span>
                        <span style={{ color: 'var(--text-muted)' }}>Resistance: <strong style={{ color: 'var(--text-primary)' }}>{fmtNPR(analysisData.supportResistance.resistance)}</strong></span>
                        <span style={{ color: 'var(--text-muted)' }}>Pivot: <strong style={{ color: 'var(--text-primary)' }}>{fmtNPR(analysisData.supportResistance.pivot)}</strong></span>
                      </div>
                      {analysisData.duration?.sessionsToResistance != null && (
                        <div style={{ fontSize: '0.72rem', color: 'var(--text-muted)' }}>
                          If the trend holds, upside room to resistance ≈ <strong className="positive">{sessionsLabel(analysisData.duration.sessionsToResistance)}</strong>
                          {analysisData.duration.sessionsToSupport != null && (
                            <> · if it reverses, downside to support ≈ <strong style={{ color: '#ef4444' }}>{sessionsLabel(analysisData.duration.sessionsToSupport)}</strong></>
                          )}
                        </div>
                      )}
                      {analysisData.supportResistance.positionPct != null && (
                        <div className="pos-bar" style={{ marginTop: '0.5rem' }}>
                          <span className="pos-dot" style={{ left: `${clampPos(analysisData.supportResistance.positionPct)}%` }} />
                        </div>
                      )}
                    </div>
                  )}

                  {analysisData.trendProjection && (
                    <div style={{ background: 'var(--bg-surface)', padding: '0.9rem', borderRadius: 'var(--radius-md)', border: '1px solid var(--border)', marginTop: '0.75rem', fontSize: '0.8rem' }}>
                      <div style={{ fontWeight: 700, color: 'var(--text-primary)', marginBottom: '0.4rem' }}>
                        Projected {analysisData.trendProjection.horizonDays}-day move
                      </div>
                      <div style={{ fontSize: '1rem', fontWeight: 800, color: analysisData.trendProjection.expectedMovePct >= 0 ? 'var(--green)' : '#ef4444' }}>
                        {analysisData.trendProjection.direction} {analysisData.trendProjection.expectedMovePct > 0 ? '+' : ''}{analysisData.trendProjection.expectedMovePct}%
                      </div>
                      <div style={{ color: 'var(--text-muted)', fontSize: '0.72rem', marginTop: '0.25rem' }}>
                        Range {analysisData.trendProjection.lowPct}% to {analysisData.trendProjection.highPct}% · trend {analysisData.trendProjection.trendQuality} (R² {analysisData.trendProjection.rSquared})
                      </div>
                    </div>
                  )}
                </div>

                {/* Right: rating + fundamentals */}
                <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
                  {analysisData.investmentRating && (
                    <div style={{ background: 'var(--bg-surface)', padding: '1rem', borderRadius: 'var(--radius-md)', border: '1px solid var(--border)' }}>
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.75rem' }}>
                        <span style={{ fontSize: '0.85rem', fontWeight: 700, color: 'var(--text-primary)' }}>
                          <ShieldCheck size={14} style={{ color: 'var(--accent)', verticalAlign: '-2px', marginRight: '6px' }} />
                          Investment Rating
                        </span>
                        <span className="change-badge" style={{ color: ratingColor(analysisData.investmentRating.verdict), fontWeight: 700 }}>
                          {analysisData.investmentRating.verdict} · {analysisData.investmentRating.score}/100
                        </span>
                      </div>
                      <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.4rem' }}>
                        {(analysisData.investmentRating.parts || []).map((p, i) => (
                          <span key={i} title={p[1]} style={{ fontSize: '0.72rem', background: 'var(--bg-card)', border: '1px solid var(--border)', borderRadius: '999px', padding: '0.25rem 0.6rem', color: 'var(--text-muted)', whiteSpace: 'nowrap' }}>
                            {p[0]}: <strong style={{ color: p[2].startsWith('+') ? 'var(--green)' : p[2].startsWith('-') ? '#ef4444' : 'var(--text-primary)' }}>{p[2]}</strong>
                          </span>
                        ))}
                      </div>
                    </div>
                  )}

                  {analysisData.fundamentals && (
                    <div style={{ background: 'var(--bg-surface)', padding: '1rem', borderRadius: 'var(--radius-md)', border: '1px solid var(--border)' }}>
                      <div style={{ fontSize: '0.85rem', fontWeight: 700, color: 'var(--text-primary)', marginBottom: '0.75rem', display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
                        <DollarSign size={15} style={{ color: 'var(--green)' }} /> Fundamentals
                      </div>
                      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '0.6rem', fontSize: '0.78rem' }}>
                        <div><span style={{ color: 'var(--text-muted)' }}>P/E:</span> <strong style={{ display: 'block' }}>{analysisData.fundamentals.peRatio}x</strong></div>
                        <div><span style={{ color: 'var(--text-muted)' }}>EPS:</span> <strong style={{ display: 'block' }}>Rs {analysisData.fundamentals.eps}</strong></div>
                        <div><span style={{ color: 'var(--text-muted)' }}>Div yield:</span> <strong style={{ display: 'block', color: 'var(--green)' }}>{analysisData.fundamentals.dividendYield}%</strong></div>
                        <div><span style={{ color: 'var(--text-muted)' }}>P/B:</span> <strong style={{ display: 'block' }}>{analysisData.fundamentals.pbRatio}x</strong></div>
                        <div><span style={{ color: 'var(--text-muted)' }}>ROE:</span> <strong style={{ display: 'block' }}>{analysisData.fundamentals.roe}%</strong></div>
                        <div><span style={{ color: 'var(--text-muted)' }}>Mkt cap:</span> <strong style={{ display: 'block' }}>{fmtNPRk(analysisData.fundamentals.marketCap)}</strong></div>
                      </div>
                    </div>
                  )}

                  {analysisData.sentiment && (
                    <div style={{ background: 'var(--bg-surface)', padding: '1rem', borderRadius: 'var(--radius-md)', border: '1px solid var(--border)' }}>
                      <div style={{ fontSize: '0.85rem', fontWeight: 700, color: 'var(--text-primary)', marginBottom: '0.5rem', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                        <span style={{ display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
                          <Newspaper size={15} style={{ color: '#0ea5e9' }} /> News Sentiment
                        </span>
                        <span className={`change-badge ${(analysisData.sentiment.score || 0) > 0.1 ? 'up' : (analysisData.sentiment.score || 0) < -0.1 ? 'down' : ''}`}>
                          {analysisData.sentiment.label || 'NEUTRAL'} ({analysisData.sentiment.score ?? '0.0'})
                        </span>
                      </div>
                      <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)', marginBottom: '0.5rem' }}>
                        {analysisData.sentiment.newsCount ?? 0} headlines · {analysisData.sentiment.recent ? `latest ${analysisData.sentiment.lastNewsAgo || ''}` : 'no recent news (45d)'}
                      </div>
                      <StockNews symbol={analysisData.symbol} />
                    </div>
                  )}
                </div>
              </div>
            ) : null}
          </div>
        )}
      </div>
    </main>
  );
}
