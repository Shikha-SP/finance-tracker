import { useState, useEffect, useCallback } from 'react';
import { Filter, Activity, ShieldCheck, RefreshCw, X, DollarSign, Newspaper, Sparkles, TrendingUp } from 'lucide-react';
import AIExplanationCard from '../components/AIExplanationCard';
import { AreaChart, Area, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid } from 'recharts';

const SECTORS = ['ALL', 'Commercial Banks', 'Development Banks', 'Finance', 'Hydro Power', 'Life Insurance', 'Non Life Insurance', 'Manufacturing And Processing', 'Microfinance', 'Hotels And Tourism', 'Trading', 'Others'];

const fmtNPR  = n => 'रू ' + Math.abs(n).toLocaleString('en-IN', { maximumFractionDigits: 2 });
const fmtNPRk = n => {
  if (n >= 1e9) return 'रू ' + (n / 1e9).toFixed(2) + 'B';
  if (n >= 1e6) return 'रू ' + (n / 1e6).toFixed(2) + 'M';
  return fmtNPR(n);
};

const GRID = '1.2fr 1.1fr 100px 70px 80px 90px 110px 100px 85px 95px';
const ratingColor = v => v === 'STRONG BUY' ? 'var(--green)' : v === 'BUY' ? 'var(--green)' : v === 'HOLD' ? '#f59e0b' : v === 'SELL' ? '#f97316' : '#ef4444';
const verdictBg = v => (v === 'STRONG BUY' || v === 'BUY') ? 'rgba(16,185,129,0.15)' : v === 'HOLD' ? 'rgba(245,158,11,0.15)' : 'rgba(239,68,68,0.15)';
const verdictColor = v => (v === 'STRONG BUY' || v === 'BUY') ? 'var(--green)' : v === 'HOLD' ? '#f59e0b' : '#ef4444';

const STRATEGIES = [
  { value: 'both', label: 'Both Rounds', desc: 'Fundamental → Technical (recommended)' },
  { value: 'fundamental', label: 'Fundamental', desc: 'Value first, ranked by fundamentals' },
  { value: 'technical', label: 'Technical', desc: 'Momentum first, ranked by technicals' }
];

export default function StockScreener() {
  const [sector, setSector] = useState('ALL');
  const [maxPe, setMaxPe] = useState(60);
  const [minConfidence, setMinConfidence] = useState(50);
  const [minSentiment, setMinSentiment] = useState(0);
  const [strategy, setStrategy] = useState('both');
  const [searchQuery, setSearchQuery] = useState('');
  
  const [screenerLoading, setScreenerLoading] = useState(false);
  const [results, setResults] = useState([]);
  const [topPicks, setTopPicks] = useState([]);
  const [marketBias, setMarketBias] = useState(null);
  
  const [selectedSymbol, setSelectedSymbol] = useState(null);
  const [analysisData, setAnalysisData] = useState(null);
  const [analysisLoading, setAnalysisLoading] = useState(false);

  const runScreener = useCallback(async () => {
    setScreenerLoading(true);
    try {
      const params = new URLSearchParams({
        sector,
        maxPe,
        minConfidence,
        minSentiment,
        strategy,
        top: 5
      });
      const res = await fetch(`/api/ai/screener?${params.toString()}`);
      const json = await res.json();
      setResults(json.screenerResults || []);
      setTopPicks(json.topPicks || []);
      setMarketBias(json.marketBias || null);
    } catch (err) {
      console.error("Screener fetch error:", err);
    } finally {
      setScreenerLoading(false);
    }
  }, [sector, maxPe, minConfidence, minSentiment, strategy]);

  useEffect(() => {
    const id = window.setTimeout(() => {
      void runScreener();
    }, 0);

    return () => window.clearTimeout(id);
  }, [runScreener]);

  const handleSelectSymbol = async (sym) => {
    setSelectedSymbol(sym);
    setAnalysisLoading(true);
    try {
      const res = await fetch(`/api/ai/analyze/${sym}`);
      const json = await res.json();
      setAnalysisData(json);
    } catch (err) {
      console.error("Analysis fetch error:", err);
    } finally {
      setAnalysisLoading(false);
    }
  };

  const filteredResults = results.filter(item =>
    item.symbol.toLowerCase().includes(searchQuery.toLowerCase()) ||
    item.name.toLowerCase().includes(searchQuery.toLowerCase())
  );

  const strategyMeta = STRATEGIES.find(s => s.value === strategy);

  return (
    <main className="page">
      {/* ── Page Header ── */}
      <div className="page-header investment-page-header">
        <div className="page-header-left">
          <h1 className="page-title" style={{ display: 'flex', alignItems: 'center', gap: '0.6rem' }}>
            <Filter size={22} style={{ color: 'var(--accent)' }} />
            Stock Screener & AI Analysis
          </h1>
          <p className="page-subtitle">
            Two-round stock selection: good fundamentals first, then technicals, sentiment & market trend — ranked into "buy now" picks
          </p>
        </div>
      </div>

      <div className="page-content investment-content space-y-6">
        {/* ── Strategy Mode Selector ── */}
        <div className="card" style={{ padding: '1.2rem 1.5rem' }}>
          <label style={{ fontSize: '0.78rem', fontWeight: 600, color: 'var(--text-muted)', display: 'block', marginBottom: '0.5rem' }}>
            Selection Strategy
          </label>
          <div style={{ display: 'flex', gap: '0.6rem', flexWrap: 'wrap' }}>
            {STRATEGIES.map(s => (
              <button
                key={s.value}
                onClick={() => setStrategy(s.value)}
                style={{
                  flex: '1 1 200px',
                  textAlign: 'left',
                  padding: '0.7rem 1rem',
                  borderRadius: 'var(--radius-md)',
                  cursor: 'pointer',
                  border: strategy === s.value ? '1.5px solid var(--accent)' : '1px solid var(--border)',
                  background: strategy === s.value ? 'var(--accent-soft, rgba(59,130,246,0.12))' : 'var(--bg-surface)'
                }}
              >
                <span style={{ display: 'block', fontWeight: 700, fontSize: '0.85rem', color: strategy === s.value ? 'var(--accent)' : 'var(--text-primary)' }}>
                  {s.label}
                </span>
                <span style={{ display: 'block', fontSize: '0.72rem', color: 'var(--text-muted)' }}>{s.desc}</span>
              </button>
            ))}
          </div>

          {/* Market bias strip */}
          {marketBias?.available && (
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginTop: '0.9rem', fontSize: '0.78rem', color: 'var(--text-muted)', background: 'var(--bg-card)', border: '1px solid var(--border)', borderRadius: 'var(--radius-md)', padding: '0.5rem 0.8rem' }}>
              <TrendingUp size={14} style={{ color: marketBias.changePct >= 0 ? 'var(--green)' : '#ef4444' }} />
              <span>NEPSE index <strong style={{ color: 'var(--text-primary)' }}>{marketBias.index}</strong> is{' '}
                <strong style={{ color: marketBias.changePct >= 0 ? 'var(--green)' : '#ef4444' }}>{marketBias.trend} ({marketBias.changePct > 0 ? '+' : ''}{marketBias.changePct}%)</strong>
              </span>
              <span style={{ color: 'var(--text-muted)' }}>
                {marketBias.bias >= 0 ? '→' : '→'} confidence {marketBias.bias >= 0 ? '+' : ''}{marketBias.bias} pts {marketBias.bias >= 0 ? 'boosted' : 'reduced'} across all picks
              </span>
            </div>
          )}
        </div>

        {/* ── Filter Bar ── */}
        <div className="card" style={{ padding: '1.2rem 1.5rem' }}>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '1rem', alignItems: 'end' }}>
            {/* Search Input */}
            <div>
              <label style={{ fontSize: '0.78rem', fontWeight: 600, color: 'var(--text-muted)', display: 'block', marginBottom: '0.4rem' }}>
                Search Stock / Symbol
              </label>
              <div style={{ position: 'relative' }}>
                <input
                  type="text"
                  placeholder="e.g. NABIL or Chilime"
                  value={searchQuery}
                  onChange={e => setSearchQuery(e.target.value)}
                  style={{
                    width: '100%',
                    background: 'var(--bg-surface)',
                    border: '1px solid var(--border)',
                    borderRadius: 'var(--radius-md)',
                    padding: '0.5rem 0.8rem',
                    fontSize: '0.85rem',
                    color: 'var(--text-primary)'
                  }}
                />
              </div>
            </div>

            {/* Sector Dropdown */}
            <div>
              <label style={{ fontSize: '0.78rem', fontWeight: 600, color: 'var(--text-muted)', display: 'block', marginBottom: '0.4rem' }}>
                Sector Filter
              </label>
              <select
                value={sector}
                onChange={e => setSector(e.target.value)}
                style={{
                  width: '100%',
                  background: 'var(--bg-surface)',
                  border: '1px solid var(--border)',
                  borderRadius: 'var(--radius-md)',
                  padding: '0.5rem 0.8rem',
                  fontSize: '0.85rem',
                  color: 'var(--text-primary)'
                }}
              >
                {SECTORS.map(s => <option key={s} value={s}>{s}</option>)}
              </select>
            </div>

            {/* Max P/E Slider */}
            <div>
              <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.78rem', fontWeight: 600, color: 'var(--text-muted)', marginBottom: '0.4rem' }}>
                <span>Max P/E Valuation</span>
                <span style={{ color: 'var(--text-primary)' }}>{maxPe}x</span>
              </div>
              <input
                type="range"
                min="10"
                max="80"
                value={maxPe}
                onChange={e => setMaxPe(Number(e.target.value))}
                style={{ width: '100%', accentColor: 'var(--accent)' }}
              />
            </div>

            {/* Min AI Confidence */}
            <div>
              <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.78rem', fontWeight: 600, color: 'var(--text-muted)', marginBottom: '0.4rem' }}>
                <span>Min AI Confidence</span>
                <span style={{ color: 'var(--accent)' }}>{minConfidence}%</span>
              </div>
              <input
                type="range"
                min="40"
                max="90"
                value={minConfidence}
                onChange={e => setMinConfidence(Number(e.target.value))}
                style={{ width: '100%', accentColor: 'var(--accent)' }}
              />
            </div>

            {/* Min News Sentiment */}
            <div>
              <label style={{ fontSize: '0.78rem', fontWeight: 600, color: 'var(--text-muted)', display: 'block', marginBottom: '0.4rem' }}>
                Min News Sentiment
              </label>
              <select
                value={minSentiment}
                onChange={e => setMinSentiment(Number(e.target.value))}
                style={{
                  width: '100%',
                  background: 'var(--bg-surface)',
                  border: '1px solid var(--border)',
                  borderRadius: 'var(--radius-md)',
                  padding: '0.5rem 0.8rem',
                  fontSize: '0.85rem',
                  color: 'var(--text-primary)'
                }}
              >
                <option value={0}>Any sentiment</option>
                <option value={0.1}>Bullish only (≥ +0.10)</option>
                <option value={0.25}>Strongly bullish (≥ +0.25)</option>
              </select>
            </div>
          </div>
        </div>

        {/* ── Top Picks: Best Stocks to Buy Now ── */}
        {!screenerLoading && (
          <div className="card" style={{ padding: '1.25rem' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '0.25rem' }}>
              <Sparkles size={18} style={{ color: '#f59e0b' }} />
              <h2 style={{ fontSize: '1.05rem', fontWeight: 800, color: 'var(--text-primary)' }}>
                Top Picks — Best to Buy Right Now
              </h2>
            </div>
            <p style={{ fontSize: '0.78rem', color: 'var(--text-muted)', marginBottom: '1rem' }}>
              {strategyMeta?.label} mode · ranked by {strategyMeta?.value === 'technical' ? 'technical score' : strategyMeta?.value === 'fundamental' ? 'fundamental score' : 'combined rating'}
              {results.length > 0 && <> · {results.length} stocks passed the {strategyMeta?.label} screen</>}
            </p>

            {topPicks.length === 0 ? (
              <div style={{ fontSize: '0.85rem', color: 'var(--text-muted)', textAlign: 'center', padding: '1.5rem 0' }}>
                No stocks passed the selected rounds with the current filters. Try loosening Max P/E or AI confidence.
              </div>
            ) : (
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(300px, 1fr))', gap: '1rem' }}>
                {topPicks.map((p, i) => (
                  <div
                    key={p.symbol}
                    onClick={() => handleSelectSymbol(p.symbol)}
                    style={{
                      background: 'var(--bg-surface)',
                      border: '1px solid var(--border)',
                      borderRadius: 'var(--radius-md)',
                      padding: '1rem',
                      cursor: 'pointer',
                      transition: 'border-color 0.15s'
                    }}
                    onMouseEnter={e => e.currentTarget.style.borderColor = 'var(--accent)'}
                    onMouseLeave={e => e.currentTarget.style.borderColor = 'var(--border)'}
                  >
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.5rem' }}>
                      <div>
                        <span style={{ fontWeight: 800, color: 'var(--text-primary)', fontSize: '1rem' }}>
                          {i + 1}. {p.symbol}
                        </span>
                        <div style={{ fontSize: '0.7rem', color: 'var(--text-muted)' }}>{p.name}</div>
                      </div>
                      <span style={{
                        fontSize: '0.72rem', fontWeight: 800, padding: '4px 8px', borderRadius: '6px',
                        background: verdictBg(p.ratingVerdict), color: verdictColor(p.ratingVerdict), border: `1px solid ${verdictColor(p.ratingVerdict)}`
                      }}>
                        {p.ratingVerdict} · {p.rating}/100
                      </span>
                    </div>

                    <div style={{ display: 'flex', gap: '0.35rem', flexWrap: 'wrap', marginBottom: '0.6rem' }}>
                      {(p.passedRounds || []).map(r => (
                        <span key={r} style={{ fontSize: '0.65rem', fontWeight: 700, padding: '2px 6px', borderRadius: '4px', background: 'rgba(16,185,129,0.12)', color: 'var(--green)', border: '1px solid rgba(16,185,129,0.3)' }}>
                          ✓ {r}
                        </span>
                      ))}
                      {(p.fundamentalReasons || []).map(r => (
                        <span key={r} style={{ fontSize: '0.65rem', padding: '2px 6px', borderRadius: '4px', background: 'var(--bg-card)', color: 'var(--text-muted)', border: '1px solid var(--border)' }}>
                          {r}
                        </span>
                      ))}
                    </div>

                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.5rem', fontSize: '0.76rem' }}>
                      <div style={{ background: 'var(--bg-card)', borderRadius: '6px', padding: '0.5rem', border: '1px solid var(--border)' }}>
                        <div style={{ color: 'var(--text-muted)', fontSize: '0.68rem' }}>LTP · RSI</div>
                        <strong style={{ color: 'var(--text-primary)' }}>रू {p.price}</strong> <span style={{ color: 'var(--text-muted)' }}>· {p.rsi}</span>
                      </div>
                      <div style={{ background: 'var(--bg-card)', borderRadius: '6px', padding: '0.5rem', border: '1px solid var(--border)' }}>
                        <div style={{ color: 'var(--text-muted)', fontSize: '0.68rem' }}>AI Signal</div>
                        <strong style={{ color: p.aiSignal === 'BULLISH' ? 'var(--green)' : '#ef4444' }}>{p.aiSignal}</strong>
                        <span style={{ color: 'var(--text-muted)' }}> · {p.confidenceScore}% conf</span>
                      </div>
                      {p.projection && (
                        <div style={{ background: 'var(--bg-card)', borderRadius: '6px', padding: '0.5rem', border: '1px solid var(--border)' }}>
                          <div style={{ color: 'var(--text-muted)', fontSize: '0.68rem' }}>
                            Expected {p.projection.horizonDays}-day move ({p.projection.trendQuality} trend)
                          </div>
                          <strong style={{ color: p.projection.expectedMovePct >= 0 ? 'var(--green)' : '#ef4444' }}>
                            {p.projection.direction} {p.projection.expectedMovePct > 0 ? '+' : ''}{p.projection.expectedMovePct}%
                          </strong>
                          <span style={{ color: 'var(--text-muted)' }}> · {p.projection.lowPct}% to {p.projection.highPct}%</span>
                        </div>
                      )}
                      <div style={{ background: 'var(--bg-card)', borderRadius: '6px', padding: '0.5rem', border: '1px solid var(--border)' }}>
                        <div style={{ color: 'var(--text-muted)', fontSize: '0.68rem' }}>Support · Resistance</div>
                        <strong style={{ color: 'var(--text-primary)' }}>रू {p.support}</strong>
                        <span style={{ color: 'var(--text-muted)' }}> · </span>
                        <strong style={{ color: 'var(--text-primary)' }}>रू {p.resistance}</strong>
                        <div style={{ color: 'var(--text-muted)', fontSize: '0.66rem' }}>price at {p.positionPct}% of range</div>
                      </div>
                    </div>

                    <div style={{ marginTop: '0.6rem', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                      <span style={{ fontSize: '0.68rem', color: 'var(--text-muted)' }}>
                        Sentiment: <strong style={{ color: (p.sentimentScore || 0) > 0.1 ? 'var(--green)' : (p.sentimentScore || 0) < -0.1 ? '#ef4444' : 'var(--text-primary)' }}>
                          {p.sentimentLabel || '—'} ({p.sentimentScore ?? '0'})
                        </strong> · {p.newsCount ?? 0} headlines
                      </span>
                      <span style={{ fontSize: '0.7rem', color: 'var(--accent)', fontWeight: 700 }}>Analyze →</span>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {/* ── Screener Table Block ── */}
        <div className="stock-table-block">
          <div className="stock-table-header">
            <div className="stock-table-title-row">
              <div className="stock-table-indicator" style={{ background: 'var(--accent)' }} />
              <span className="stock-table-title">Filtered NEPSE Scrips ({filteredResults.length})</span>
            </div>
            <span style={{ fontSize: '0.78rem', color: 'var(--text-muted)' }}>Click any stock row for full AI analysis & chart</span>
          </div>

          <div className="stock-table-body">
            <div className="stock-table-row stock-table-head-row" style={{ display: 'grid', gridTemplateColumns: GRID }}>
              <span>Symbol</span>
              <span>Sector</span>
              <span>LTP (रू)</span>
              <span>RSI</span>
              <span>P/E</span>
              <span>Div Yield</span>
              <span>AI Signal</span>
              <span>AI Conf</span>
              <span>Sentiment</span>
              <span>Rating</span>
            </div>

            {screenerLoading ? (
              Array.from({ length: 5 }).map((_, i) => (
                <div className="stock-table-row loading-row" key={i}>
                  {Array.from({ length: 10 }).map((_, j) => <span key={j}><div className="skeleton" /></span>)}
                </div>
              ))
            ) : filteredResults.map((item) => (
              <div
                key={item.symbol}
                onClick={() => handleSelectSymbol(item.symbol)}
                className={`stock-table-row stock-table-data-row${selectedSymbol === item.symbol ? ' active' : ''}`}
                style={{
                  display: 'grid',
                  gridTemplateColumns: GRID,
                  cursor: 'pointer',
                  background: selectedSymbol === item.symbol ? 'var(--bg-surface)' : undefined,
                  borderLeft: selectedSymbol === item.symbol ? '3px solid var(--accent)' : undefined
                }}
              >
                <span className="stock-symbol" style={{ color: 'var(--text-primary)', fontWeight: 700 }}>
                  {item.symbol}
                  <div style={{ fontSize: '0.7rem', color: 'var(--text-muted)', fontWeight: 400 }}>{item.name}</div>
                </span>
                <span style={{ color: 'var(--text-muted)', fontSize: '0.8rem' }}>{item.sector}</span>
                <span style={{ fontWeight: 600 }}>रू {item.price}</span>
                <span style={{ fontFamily: "'DM Mono', monospace" }}>{item.rsi}</span>
                <span>{item.peRatio}x</span>
                <span style={{ color: 'var(--green)', fontWeight: 600 }}>{item.dividendYield}%</span>
                <span>
                  <span className={`change-badge ${item.aiSignal === 'BULLISH' ? 'up' : 'down'}`}>
                    {item.aiSignal} ({item.bullishProb}%)
                  </span>
                </span>
                <span style={{ color: 'var(--accent)', fontWeight: 700, display: 'flex', alignItems: 'center', gap: '4px' }}>
                  <ShieldCheck size={13} />
                  {item.confidenceScore}%
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

        {/* ── Selected Stock AI Analysis Breakdown Modal / Drawer ── */}
        {selectedSymbol && (
          <div className="card" style={{ padding: '1.5rem', marginTop: '1.5rem' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.25rem', borderBottom: '1px solid var(--border)', pb: '0.75rem' }}>
              <div>
                <h2 style={{ fontSize: '1.2rem', fontWeight: 700, color: 'var(--text-primary)', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                  <Activity size={20} style={{ color: 'var(--accent)' }} />
                  {selectedSymbol} - Deep AI Analysis & Fundamentals
                </h2>
                <div style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>
                  Technical Indicators, Fundamental Ratios, News Sentiment & Explainable AI Recommendation
                </div>
              </div>
              <button
                onClick={() => setSelectedSymbol(null)}
                style={{ background: 'var(--bg-surface)', border: '1px solid var(--border)', borderRadius: '50%', width: '32px', height: '32px', display: 'flex', alignItems: 'center', justifyCenter: 'center', color: 'var(--text-muted)', cursor: 'pointer' }}
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
                {/* Left: Price Chart & Technical Indicators */}
                <div>
                  <div style={{ background: 'var(--bg-surface)', padding: '1rem', borderRadius: 'var(--radius-md)', border: '1px solid var(--border)', marginBottom: '1rem' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '0.75rem' }}>
                      <span style={{ fontWeight: 700, color: 'var(--text-primary)' }}>Price & Momentum History</span>
                      <span style={{ fontWeight: 700, color: 'var(--accent)' }}>रू {analysisData.currentPrice}</span>
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

                  {/* Technical Values */}
                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.75rem', fontSize: '0.8rem' }}>
                    <div style={{ background: 'var(--bg-surface)', padding: '0.75rem', borderRadius: 'var(--radius-md)', border: '1px solid var(--border)' }}>
                      <span style={{ color: 'var(--text-muted)', display: 'block', fontSize: '0.75rem' }}>RSI (14)</span>
                      <strong style={{ color: 'var(--text-primary)', fontSize: '0.95rem' }}>{analysisData.technicalIndicators.rsi}</strong>
                    </div>
                    <div style={{ background: 'var(--bg-surface)', padding: '0.75rem', borderRadius: 'var(--radius-md)', border: '1px solid var(--border)' }}>
                      <span style={{ color: 'var(--text-muted)', display: 'block', fontSize: '0.75rem' }}>MACD / Signal</span>
                      <strong style={{ color: 'var(--text-primary)', fontSize: '0.95rem' }}>{analysisData.technicalIndicators.macd} / {analysisData.technicalIndicators.macdSignal}</strong>
                    </div>
                  </div>

                  {/* Support & Resistance + Trend Projection */}
                  {analysisData.supportResistance && (
                    <div style={{ background: 'var(--bg-surface)', padding: '0.9rem', borderRadius: 'var(--radius-md)', border: '1px solid var(--border)', marginTop: '0.75rem', fontSize: '0.8rem' }}>
                      <div style={{ fontWeight: 700, color: 'var(--text-primary)', marginBottom: '0.5rem' }}>
                        Support & Resistance
                      </div>
                      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.5rem' }}>
                        <span style={{ color: 'var(--text-muted)' }}>Support: <strong style={{ color: 'var(--text-primary)' }}>रू {analysisData.supportResistance.support}</strong></span>
                        <span style={{ color: 'var(--text-muted)' }}>Resistance: <strong style={{ color: 'var(--text-primary)' }}>रू {analysisData.supportResistance.resistance}</strong></span>
                        <span style={{ color: 'var(--text-muted)' }}>Pivot: <strong style={{ color: 'var(--text-primary)' }}>रू {analysisData.supportResistance.pivot}</strong></span>
                        <span style={{ color: 'var(--text-muted)' }}>
                          Position: <strong style={{ color: analysisData.supportResistance.positionPct > 75 ? '#f59e0b' : 'var(--green)' }}>
                            {analysisData.supportResistance.positionPct}% of range
                          </strong>
                        </span>
                      </div>
                      {(analysisData.supportResistance.nearSupport || analysisData.supportResistance.nearResistance) && (
                        <div style={{ marginTop: '0.4rem', fontSize: '0.72rem', color: '#f59e0b' }}>
                          {analysisData.supportResistance.nearSupport ? '⚠ Price is hugging support — watch for a bounce or break.' : '⚠ Price is at resistance — upside capped until a breakout.'}
                        </div>
                      )}
                    </div>
                  )}

                  {analysisData.trendProjection && (
                    <div style={{ background: 'var(--bg-surface)', padding: '0.9rem', borderRadius: 'var(--radius-md)', border: '1px solid var(--border)', marginTop: '0.75rem', fontSize: '0.8rem' }}>
                      <div style={{ fontWeight: 700, color: 'var(--text-primary)', marginBottom: '0.5rem' }}>
                        Projected {analysisData.trendProjection.horizonDays}-Day Move
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

                {/* Right: Explainable AI & Fundamentals */}
                <div className="space-y-4">
                  <AIExplanationCard
                    prediction={analysisData.prediction}
                    explainableAI={analysisData.explainableAI}
                    symbol={analysisData.symbol}
                  />

                  {/* Investment Rating */}
                  <div style={{ background: 'var(--bg-surface)', padding: '1rem', borderRadius: 'var(--radius-md)', border: '1px solid var(--border)' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.75rem' }}>
                      <span style={{ fontSize: '0.85rem', fontWeight: 700, color: 'var(--text-primary)' }}>
                        <ShieldCheck size={14} style={{ color: 'var(--accent)', verticalAlign: '-2px', marginRight: '6px' }} />
                        Investment Rating
                      </span>
                      <span className="change-badge" style={{ color: ratingColor(analysisData.investmentRating?.verdict), fontWeight: 700 }}>
                        {analysisData.investmentRating?.verdict} · {analysisData.investmentRating?.score}/100
                      </span>
                    </div>
                    <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.4rem' }}>
                      {(analysisData.investmentRating?.parts || []).map((p, i) => (
                        <span key={i} title={p[1]} style={{ fontSize: '0.72rem', background: 'var(--bg-card)', border: '1px solid var(--border)', borderRadius: '999px', padding: '0.25rem 0.6rem', color: 'var(--text-muted)', whiteSpace: 'nowrap' }}>
                          {p[0]}: <strong style={{ color: p[2].startsWith('+') ? 'var(--green)' : p[2].startsWith('-') ? '#ef4444' : 'var(--text-primary)' }}>{p[2]}</strong>
                        </span>
                      ))}
                    </div>
                  </div>

                  {/* News Sentiment */}
                  <div style={{ background: 'var(--bg-surface)', padding: '1rem', borderRadius: 'var(--radius-md)', border: '1px solid var(--border)' }}>
                    <div style={{ fontSize: '0.85rem', fontWeight: 700, color: 'var(--text-primary)', marginBottom: '0.75rem', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                      <span style={{ display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
                        <Newspaper size={15} style={{ color: '#0ea5e9' }} /> News Sentiment
                      </span>
                      <span className={`change-badge ${(analysisData.sentiment?.score || 0) > 0.1 ? 'up' : (analysisData.sentiment?.score || 0) < -0.1 ? 'down' : ''}`}>
                        {analysisData.sentiment?.label || 'NEUTRAL'} ({analysisData.sentiment?.score ?? '0.0'})
                      </span>
                    </div>
                    <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)', marginBottom: '0.5rem' }}>
                      {analysisData.sentiment?.newsCount ?? 0} headlines{analysisData.sentiment?.recent
                        ? <> · latest {analysisData.sentiment?.lastNewsAgo || ''}</>
                        : <> · no recent news (45d)</>}
                      {analysisData.sentiment?.sentimentModel === 'llm-groq' && (
                        <span style={{ marginLeft: '0.4rem', fontSize: '0.65rem', color: 'var(--accent)', border: '1px solid var(--accent)', borderRadius: '4px', padding: '1px 5px' }}>LLM</span>
                      )}
                    </div>
                    {(analysisData.sentiment?.topKeywords || []).length > 0 && (
                      <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.3rem', marginBottom: '0.5rem' }}>
                        {(analysisData.sentiment?.topKeywords || []).map((k, i) => (
                          <span key={i} style={{ fontSize: '0.66rem', background: 'var(--bg-card)', border: '1px solid var(--border)', borderRadius: '999px', padding: '2px 8px', color: 'var(--text-muted)' }}>#{k}</span>
                        ))}
                      </div>
                    )}
                    <div className="space-y-2" style={{ maxHeight: 220, overflowY: 'auto' }}>
                      {(analysisData.sentiment?.articles || []).slice(0, 4).map((item, idx) => (
                        <a key={idx} href={item.url || '#'} target="_blank" rel="noreferrer"
                          style={{ display: 'block', fontSize: '0.72rem', color: 'var(--text-muted)', textDecoration: 'none', background: 'var(--bg-card)', border: '1px solid var(--border)', borderRadius: 'var(--radius-sm, 6px)', padding: '0.45rem 0.6rem' }}>
                          <div style={{ color: 'var(--text-primary)' }}>{item.title}</div>
                          <div style={{ fontSize: '0.66rem', marginTop: '0.15rem' }}>
                            {item.publishedAgo || item.pubDate} · {item.llmLabel || item.sentimentLabel}
                          </div>
                        </a>
                      ))}
                    </div>
                  </div>

                  {/* Fundamental Metrics */}
                  <div style={{ background: 'var(--bg-surface)', padding: '1rem', borderRadius: 'var(--radius-md)', border: '1px solid var(--border)' }}>
                    <div style={{ fontSize: '0.85rem', fontWeight: 700, color: 'var(--text-primary)', marginBottom: '0.75rem', display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
                      <DollarSign size={15} style={{ color: 'var(--green)' }} /> Fundamentals Breakdown
                    </div>
                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '0.6rem', fontSize: '0.78rem' }}>
                      <div><span style={{ color: 'var(--text-muted)' }}>P/E Ratio:</span> <strong style={{ display: 'block' }}>{analysisData.fundamentals.peRatio}x</strong></div>
                      <div><span style={{ color: 'var(--text-muted)' }}>EPS:</span> <strong style={{ display: 'block' }}>Rs. {analysisData.fundamentals.eps}</strong></div>
                      <div><span style={{ color: 'var(--text-muted)' }}>Div Yield:</span> <strong style={{ display: 'block', color: 'var(--green)' }}>{analysisData.fundamentals.dividendYield}%</strong></div>
                      <div><span style={{ color: 'var(--text-muted)' }}>P/B Ratio:</span> <strong style={{ display: 'block' }}>{analysisData.fundamentals.pbRatio}x</strong></div>
                      <div><span style={{ color: 'var(--text-muted)' }}>ROE:</span> <strong style={{ display: 'block' }}>{analysisData.fundamentals.roe}%</strong></div>
                      <div><span style={{ color: 'var(--text-muted)' }}>Market Cap:</span> <strong style={{ display: 'block' }}>{fmtNPRk(analysisData.fundamentals.marketCap)}</strong></div>
                    </div>
                  </div>
                </div>
              </div>
            ) : null}
          </div>
        )}
      </div>
    </main>
  );
}
