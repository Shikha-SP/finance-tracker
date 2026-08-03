import { useState, useEffect, useCallback } from 'react';
import { Link } from 'react-router-dom';
import { AreaChart, Area, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid } from 'recharts';
import { Search, TrendingUp, DollarSign, Activity, BarChart2, Newspaper, RefreshCw } from 'lucide-react';
import AIExplanationCard from '../components/AIExplanationCard';

const POPULAR_SCRIPS = ['NABIL', 'CHCL', 'GBIME', 'NTC', 'SHIVM', 'NLIC', 'HDL', 'STC', 'OHL', 'ICFC', 'CBBL', 'NLG'];

export default function CompanyAnalysis() {
  const [selectedSymbol, setSelectedSymbol] = useState('NABIL');
  const [searchQuery, setSearchQuery] = useState('');
  const [searchSuggestions, setSearchSuggestions] = useState([]);
  const [showSuggestions, setShowSuggestions] = useState(false);
  const [loading, setLoading] = useState(true);
  const [data, setData] = useState(null);

  const fetchCompanyData = useCallback(async (symbol) => {
    setLoading(true);
    try {
      const res = await fetch(`/api/ai/analyze/${symbol}`);
      const json = await res.json();
      setData(json);
    } catch (err) {
      console.error("Failed to load company analysis:", err);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    const id = window.setTimeout(() => {
      void fetchCompanyData(selectedSymbol);
    }, 0);

    return () => window.clearTimeout(id);
  }, [fetchCompanyData, selectedSymbol]);

  const handleSearchSubmit = (e) => {
    e.preventDefault();
    if (searchQuery.trim()) {
      setSelectedSymbol(searchQuery.trim().toUpperCase());
    }
  };

  return (
    <div className="space-y-6 pb-12">
      {/* Header bar */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 bg-slate-900/60 p-4 rounded-xl border border-slate-800 backdrop-blur-md">
        <div>
          <h1 className="text-xl font-bold text-slate-100 flex items-center gap-2">
            <BarChart2 className="w-5 h-5 text-indigo-400" />
            Company AI Analysis Terminal
          </h1>
          <p className="text-xs text-slate-400">Technical indicators, fundamental valuation, news sentiment & explainable AI signals</p>
        </div>

        {/* Search input with autocomplete */}
        <form onSubmit={handleSearchSubmit} className="flex items-center gap-2 relative">
          <div className="relative">
            <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              placeholder="Search scrip (e.g. NIMB, CHCL, SHIVM)"
              value={searchQuery}
              onChange={(e) => {
                const val = e.target.value;
                setSearchQuery(val);
                if (val.trim()) {
                  const filtered = ['NABIL', 'NIMB', 'SCB', 'HBL', 'SBI', 'EBL', 'NICA', 'GBIME', 'CHCL', 'SHIVM', 'NTC', 'NLIC', 'NLG', 'OHL', 'ICFC', 'CBBL', 'AKPL', 'UPPER', 'HDL', 'STC', 'RADHI'].filter(s => s.toLowerCase().includes(val.toLowerCase())).slice(0, 8);
                  setSearchSuggestions(filtered);
                  setShowSuggestions(true);
                } else {
                  setShowSuggestions(false);
                }
              }}
              onFocus={() => searchQuery.trim() && setShowSuggestions(true)}
              className="bg-slate-950 border border-slate-700 text-slate-100 text-xs rounded-lg pl-9 pr-4 py-2 w-64 focus:outline-none focus:border-indigo-500"
            />
            {showSuggestions && searchSuggestions.length > 0 && (
              <div className="absolute top-full left-0 right-0 mt-1 bg-slate-900 border border-slate-700 rounded-lg shadow-xl z-50 overflow-hidden max-h-48 overflow-y-auto">
                {searchSuggestions.map((sym) => (
                  <button
                    key={sym}
                    type="button"
                    onClick={() => {
                      setSelectedSymbol(sym);
                      setSearchQuery(sym);
                      setShowSuggestions(false);
                    }}
                    className="w-full text-left px-3 py-2 text-xs text-slate-200 hover:bg-indigo-600/30 hover:text-white flex items-center justify-between border-b border-slate-800/50 last:border-0"
                  >
                    <span className="font-bold">{sym}</span>
                    <span className="text-[10px] text-slate-400">Analyze →</span>
                  </button>
                ))}
              </div>
            )}
          </div>
          <button type="submit" className="bg-indigo-600 hover:bg-indigo-500 text-white text-xs px-3.5 py-2 rounded-lg font-medium transition-colors">
            Analyze
          </button>
        </form>
      </div>

      {/* Quick Scrip Selector Pills */}
      <div className="flex items-center gap-2 overflow-x-auto pb-1 scrollbar-thin">
        <span className="text-xs font-semibold text-slate-400 shrink-0">Popular:</span>
        {POPULAR_SCRIPS.map(sym => (
          <button
            key={sym}
            onClick={() => setSelectedSymbol(sym)}
            className={`px-3 py-1 text-xs rounded-lg font-medium shrink-0 transition-all border ${
              selectedSymbol === sym
                ? 'bg-indigo-600/20 text-indigo-300 border-indigo-500/50 shadow-sm'
                : 'bg-slate-900/80 text-slate-400 border-slate-800 hover:text-slate-200'
            }`}
          >
            {sym}
          </button>
        ))}
      </div>

      {loading ? (
        <div className="flex items-center justify-center py-20 bg-slate-900/40 rounded-xl border border-slate-800">
          <RefreshCw className="w-8 h-8 text-indigo-400 animate-spin" />
        </div>
      ) : data && data.technicalIndicators ? (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Main Left Column: Chart & Indicators */}
          <div className="lg:col-span-2 space-y-6">
            {/* Price Chart Card */}
            <div className="bg-slate-900/90 border border-slate-800 rounded-xl p-5 shadow-xl">
              <div className="flex justify-between items-start mb-4 border-b border-slate-800/80 pb-3">
                <div>
                  <div className="flex items-center gap-2">
                    <h2 className="text-lg font-bold text-slate-100">{data.symbol}</h2>
                    <span className="text-xs px-2 py-0.5 rounded bg-slate-800 text-slate-300">{data.sector || 'Commercial Banks'}</span>
                  </div>
                  <p className="text-xs text-slate-400">{data.companyName || `${data.symbol} Enterprise Ltd.`}</p>
                </div>
                <div className="text-right">
                  <div className="text-xl font-bold text-slate-100">Rs. {data.currentPrice || 500}</div>
                  <div className="text-xs font-semibold text-emerald-400 flex items-center justify-end gap-1">
                    <TrendingUp className="w-3.5 h-3.5" />
                    RSI: {data.technicalIndicators?.rsi ?? 50.0}
                  </div>
                </div>
              </div>

              {/* Price Area Chart */}
              <div className="h-64 w-full mb-4">
                <ResponsiveContainer width="100%" height="100%">
                  <AreaChart data={data.chartData || []}>
                    <defs>
                      <linearGradient id="colorClose" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="5%" stopColor="#6366f1" stopOpacity={0.4}/>
                        <stop offset="95%" stopColor="#6366f1" stopOpacity={0}/>
                      </linearGradient>
                    </defs>
                    <CartesianGrid strokeDasharray="3 3" stroke="#1e293b" />
                    <XAxis dataKey="date" stroke="#64748b" tick={{ fontSize: 10 }} />
                    <YAxis domain={['auto', 'auto']} stroke="#64748b" tick={{ fontSize: 10 }} />
                    <Tooltip
                      contentStyle={{ backgroundColor: '#0f172a', borderColor: '#334155', borderRadius: '8px', fontSize: '12px' }}
                      itemStyle={{ color: '#cbd5e1' }}
                    />
                    <Area type="monotone" dataKey="close" stroke="#6366f1" strokeWidth={2} fillOpacity={1} fill="url(#colorClose)" />
                  </AreaChart>
                </ResponsiveContainer>
              </div>

              {/* Volume & RSI Sub-panel */}
              <div className="grid grid-cols-2 gap-4 pt-3 border-t border-slate-800/80">
                <div>
                  <span className="text-[11px] text-slate-400">Moving Averages</span>
                  <div className="text-xs text-slate-200 mt-1 flex justify-between">
                    <span>SMA 20: <strong>Rs. {data.technicalIndicators?.sma20 ?? '—'}</strong></span>
                    <span>SMA 50: <strong>Rs. {data.technicalIndicators?.sma50 ?? '—'}</strong></span>
                  </div>
                </div>
                <div>
                  <span className="text-[11px] text-slate-400">MACD Histogram</span>
                  <div className="text-xs text-slate-200 mt-1 flex justify-between">
                    <span>MACD: <strong>{data.technicalIndicators?.macd ?? '0.0'}</strong></span>
                    <span>Signal: <strong>{data.technicalIndicators?.macdSignal ?? '0.0'}</strong></span>
                  </div>
                </div>
              </div>
            </div>

            {/* Explainable AI Card */}
            <AIExplanationCard
              prediction={data.prediction || { signal: 'BULLISH', bullishProb: 70, confidenceScore: 70 }}
              explainableAI={data.explainableAI || { positiveReasons: ["Stable support"], negativeReasons: ["Market volatility"] }}
              symbol={data.symbol}
            />

            {/* Link to RAG Stock Recommendation Advisor */}
            <div className="bg-indigo-950/40 border border-indigo-500/30 rounded-xl p-4 flex flex-col md:flex-row items-center justify-between gap-4">
              <div>
                <h4 className="text-sm font-bold text-indigo-200">Want RAG AI Stock Recommendation?</h4>
                <p className="text-xs text-slate-400">Ask the Financial RAG Assistant to explain whether {data.symbol} is recommended to BUY based on disclosures and ML models.</p>
              </div>
              <Link
                to="/investment/rag"
                className="bg-indigo-600 hover:bg-indigo-500 text-white text-xs px-4 py-2 rounded-lg font-bold shrink-0 transition-colors"
              >
                Ask RAG Stock Advisor →
              </Link>
            </div>
          </div>

          {/* Right Column: Fundamentals & News */}
          <div className="space-y-6">
            {/* Fundamental Metrics Card */}
            <div className="bg-slate-900/90 border border-slate-800 rounded-xl p-5 shadow-xl">
              <h3 className="text-sm font-semibold text-slate-200 mb-4 flex items-center gap-2 border-b border-slate-800 pb-2.5">
                <DollarSign className="w-4 h-4 text-emerald-400" />
                Fundamental Valuation
              </h3>

              <div className="grid grid-cols-2 gap-3 text-xs">
                <div className="bg-slate-950/60 p-2.5 rounded-lg border border-slate-800">
                  <span className="text-slate-400 block text-[11px]">P/E Ratio</span>
                  <span className="text-slate-100 font-bold text-sm">{data.fundamentals?.peRatio ?? '—'}x</span>
                </div>
                <div className="bg-slate-950/60 p-2.5 rounded-lg border border-slate-800">
                  <span className="text-slate-400 block text-[11px]">P/B Ratio</span>
                  <span className="text-slate-100 font-bold text-sm">{data.fundamentals?.pbRatio ?? '—'}x</span>
                </div>
                <div className="bg-slate-950/60 p-2.5 rounded-lg border border-slate-800">
                  <span className="text-slate-400 block text-[11px]">EPS (Rs.)</span>
                  <span className="text-slate-100 font-bold text-sm">{data.fundamentals?.eps ?? '—'}</span>
                </div>
                <div className="bg-slate-950/60 p-2.5 rounded-lg border border-slate-800">
                  <span className="text-slate-400 block text-[11px]">Div Yield</span>
                  <span className="text-emerald-400 font-bold text-sm">{data.fundamentals?.dividendYield ?? '—'}%</span>
                </div>
                <div className="bg-slate-950/60 p-2.5 rounded-lg border border-slate-800">
                  <span className="text-slate-400 block text-[11px]">ROE</span>
                  <span className="text-slate-100 font-bold text-sm">{data.fundamentals?.roe ?? '—'}%</span>
                </div>
                <div className="bg-slate-950/60 p-2.5 rounded-lg border border-slate-800">
                  <span className="text-slate-400 block text-[11px]">Market Cap</span>
                  <span className="text-slate-100 font-bold text-xs">
                    {data.fundamentals?.marketCap ? `Rs. ${(data.fundamentals.marketCap / 1e9).toFixed(1)}B` : '—'}
                  </span>
                </div>
              </div>
            </div>

            {/* News Sentiment Feed */}
            <div className="bg-slate-900/90 border border-slate-800 rounded-xl p-5 shadow-xl">
              <div className="flex justify-between items-center mb-4 border-b border-slate-800 pb-2.5">
                <h3 className="text-sm font-semibold text-slate-200 flex items-center gap-2">
                  <Newspaper className="w-4 h-4 text-sky-400" />
                  News Sentiment
                </h3>
                <span className={`text-[11px] font-bold px-2 py-0.5 rounded ${
                  data.sentiment?.label === 'BULLISH' ? 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/20' : 'bg-slate-800 text-slate-300'
                }`}>
                  {data.sentiment?.label || 'NEUTRAL'} ({data.sentiment?.score ?? '0.0'})
                </span>
              </div>

              <div className="space-y-3">
                {(data.sentiment?.articles || []).map((item, idx) => (
                  <a
                    key={idx}
                    href={item.url || '#'}
                    target="_blank"
                    rel="noreferrer"
                    className="block bg-slate-950/50 hover:bg-slate-950 p-3 rounded-lg border border-slate-800/80 transition-colors group"
                  >
                    <p className="text-xs text-slate-200 group-hover:text-indigo-400 line-clamp-2 transition-colors font-medium">
                      {item.title}
                    </p>
                    <div className="flex justify-between items-center mt-2 text-[10px] text-slate-500">
                      <span>{item.pubDate}</span>
                      <span className={item.sentimentLabel === 'BULLISH' ? 'text-emerald-400 font-semibold' : 'text-slate-400'}>
                        {item.sentimentLabel}
                      </span>
                    </div>
                  </a>
                ))}
              </div>
            </div>
          </div>
        </div>
      ) : (
        <div className="flex flex-col items-center justify-center py-16 bg-slate-900/40 rounded-xl border border-slate-800 text-center p-6 space-y-3">
          <Activity className="w-10 h-10 text-slate-500" />
          <h3 className="text-base font-bold text-slate-200">Unable to load AI analysis for {selectedSymbol}</h3>
          <p className="text-xs text-slate-400 max-w-md">The analysis server may be recalibrating market features. Click below to refresh analysis.</p>
          <button
            onClick={() => fetchCompanyData(selectedSymbol)}
            className="bg-indigo-600 hover:bg-indigo-500 text-white text-xs px-4 py-2 rounded-lg font-semibold transition-colors"
          >
            Refresh Analysis Terminal
          </button>
        </div>
      )}
    </div>
  );
}
