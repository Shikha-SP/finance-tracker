import { useState, useEffect } from 'react';
import { Filter, Search, ChevronDown, ChevronUp, TrendingUp, TrendingDown, DollarSign, Activity, Newspaper, ShieldCheck, RefreshCw, X, ArrowRight } from 'lucide-react';
import AIExplanationCard from '../components/AIExplanationCard';
import { AreaChart, Area, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid } from 'recharts';

const SECTORS = ['ALL', 'Commercial Banks', 'Development Banks', 'Finance', 'Hydro Power', 'Life Insurance', 'Non Life Insurance', 'Manufacturing And Processing', 'Microfinance', 'Hotels And Tourism', 'Trading', 'Others'];

const fmtNPR  = n => 'रू ' + Math.abs(n).toLocaleString('en-IN', { maximumFractionDigits: 2 });
const fmtNPRk = n => {
  if (n >= 1e9) return 'रू ' + (n / 1e9).toFixed(2) + 'B';
  if (n >= 1e6) return 'रू ' + (n / 1e6).toFixed(2) + 'M';
  return fmtNPR(n);
};

export default function StockScreener() {
  const [sector, setSector] = useState('ALL');
  const [maxPe, setMaxPe] = useState(60);
  const [minConfidence, setMinConfidence] = useState(50);
  const [searchQuery, setSearchQuery] = useState('');
  
  const [screenerLoading, setScreenerLoading] = useState(false);
  const [results, setResults] = useState([]);
  
  const [selectedSymbol, setSelectedSymbol] = useState(null);
  const [analysisData, setAnalysisData] = useState(null);
  const [analysisLoading, setAnalysisLoading] = useState(false);

  useEffect(() => {
    runScreener();
  }, [sector, maxPe, minConfidence]);

  const runScreener = async () => {
    setScreenerLoading(true);
    try {
      const params = new URLSearchParams({
        sector,
        maxPe,
        minConfidence
      });
      const res = await fetch(`http://localhost:5000/api/ai/screener?${params.toString()}`);
      const json = await res.json();
      setResults(json.screenerResults || []);
    } catch (err) {
      console.error("Screener fetch error:", err);
    } finally {
      setScreenerLoading(false);
    }
  };

  const handleSelectSymbol = async (sym) => {
    setSelectedSymbol(sym);
    setAnalysisLoading(true);
    try {
      const res = await fetch(`http://localhost:5000/api/ai/analyze/${sym}`);
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
            Filter NEPSE companies by fundamental valuation, technical indicators, and explainable AI signals
          </p>
        </div>
      </div>

      <div className="page-content investment-content space-y-6">
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
          </div>
        </div>

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
            <div className="stock-table-row stock-table-head-row" style={{ display: 'grid', gridTemplateColumns: '1.2fr 1.2fr 100px 80px 90px 90px 110px 100px' }}>
              <span>Symbol</span>
              <span>Sector</span>
              <span>LTP (रू)</span>
              <span>RSI</span>
              <span>P/E</span>
              <span>Div Yield</span>
              <span>AI Signal</span>
              <span>AI Conf</span>
            </div>

            {screenerLoading ? (
              Array.from({ length: 5 }).map((_, i) => (
                <div className="stock-table-row loading-row" key={i}>
                  {Array.from({ length: 8 }).map((_, j) => <span key={j}><div className="skeleton" /></span>)}
                </div>
              ))
            ) : filteredResults.map((item) => (
              <div
                key={item.symbol}
                onClick={() => handleSelectSymbol(item.symbol)}
                className={`stock-table-row stock-table-data-row${selectedSymbol === item.symbol ? ' active' : ''}`}
                style={{
                  display: 'grid',
                  gridTemplateColumns: '1.2fr 1.2fr 100px 80px 90px 90px 110px 100px',
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
                </div>

                {/* Right: Explainable AI & Fundamentals */}
                <div className="space-y-4">
                  <AIExplanationCard
                    prediction={analysisData.prediction}
                    explainableAI={analysisData.explainableAI}
                    symbol={analysisData.symbol}
                  />

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
