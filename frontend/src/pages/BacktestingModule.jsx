import { useState, useEffect, useCallback } from 'react';
import { LineChart, Line, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid, Legend } from 'recharts';
import { Play, RefreshCw, BarChart } from 'lucide-react';

export default function BacktestingModule() {
  const [symbol, setSymbol] = useState('NABIL');
  const [initialCapital, setInitialCapital] = useState(100000);
  const [minConfidence, setMinConfidence] = useState(60);
  
  const [loading, setLoading] = useState(false);
  const [backtestResult, setBacktestResult] = useState(null);

  const runBacktest = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch('/api/ai/backtest', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ symbol, initialCapital, minConfidence })
      });
      const data = await res.json();
      setBacktestResult(data);
    } catch (err) {
      console.error("Failed to run strategy backtest:", err);
    } finally {
      setLoading(false);
    }
  }, [symbol, initialCapital, minConfidence]);

  useEffect(() => {
    const id = window.setTimeout(() => {
      void runBacktest();
    }, 0);

    return () => window.clearTimeout(id);
  }, [runBacktest]);

  const summary = backtestResult?.summary || {};

  return (
    <div className="space-y-6 pb-12">
      {/* Header */}
      <div className="bg-slate-900/60 p-4 rounded-xl border border-slate-800 backdrop-blur-md">
        <h1 className="text-xl font-bold text-slate-100 flex items-center gap-2">
          <BarChart className="w-5 h-5 text-indigo-400" />
          Quantitative Strategy Backtester (2023 - 2026)
        </h1>
        <p className="text-xs text-slate-400">Simulate performance of AI Directional Buy Signals vs Buy & Hold strategy</p>
      </div>

      {/* Control Panel */}
      <div className="bg-slate-900/90 border border-slate-800 rounded-xl p-5 shadow-xl grid grid-cols-1 md:grid-cols-4 gap-4 text-xs">
        <div>
          <label className="text-slate-400 font-medium block mb-1.5">Target Scrip</label>
          <select
            value={symbol}
            onChange={(e) => setSymbol(e.target.value)}
            className="w-full bg-slate-950 border border-slate-700 text-slate-200 rounded-lg p-2 focus:outline-none focus:border-indigo-500"
          >
            <option value="NABIL">NABIL (Nabil Bank)</option>
            <option value="GBIME">GBIME (Global IME Bank)</option>
            <option value="CHCL">CHCL (Chilime Hydro)</option>
            <option value="SHIVM">SHIVM (Shivam Cements)</option>
            <option value="NTC">NTC (Nepal Telecom)</option>
            <option value="HDL">HDL (Himalayan Distillery)</option>
          </select>
        </div>

        <div>
          <label className="text-slate-400 font-medium block mb-1.5">Initial Portfolio Capital (Rs.)</label>
          <input
            type="number"
            value={initialCapital}
            onChange={(e) => setInitialCapital(Number(e.target.value))}
            className="w-full bg-slate-950 border border-slate-700 text-slate-200 rounded-lg p-2 focus:outline-none focus:border-indigo-500"
          />
        </div>

        <div>
          <label className="text-slate-400 font-medium block mb-1.5">AI Confidence Trigger ({minConfidence}%)</label>
          <input
            type="range"
            min="50"
            max="80"
            value={minConfidence}
            onChange={(e) => setMinConfidence(Number(e.target.value))}
            className="w-full accent-indigo-500"
          />
        </div>

        <div className="flex items-end">
          <button
            onClick={runBacktest}
            disabled={loading}
            className="w-full bg-indigo-600 hover:bg-indigo-500 text-white font-semibold py-2.5 rounded-lg transition-colors flex items-center justify-center gap-2"
          >
            {loading ? <RefreshCw className="w-4 h-4 animate-spin" /> : <Play className="w-4 h-4" />}
            Execute Backtest
          </button>
        </div>
      </div>

      {/* Metrics Performance Grid */}
      {summary.aiReturnPct !== undefined && (
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <div className="bg-slate-900/90 border border-slate-800 rounded-xl p-4 shadow-xl">
            <span className="text-xs text-slate-400 font-medium block">AI Strategy Total Return</span>
            <div className="text-xl font-bold text-emerald-400 mt-1">+{summary.aiReturnPct}%</div>
            <span className="text-[11px] text-slate-500">CAGR: +{summary.aiCagr}%</span>
          </div>

          <div className="bg-slate-900/90 border border-slate-800 rounded-xl p-4 shadow-xl">
            <span className="text-xs text-slate-400 font-medium block">Buy & Hold Return</span>
            <div className="text-xl font-bold text-slate-200 mt-1">+{summary.bhReturnPct}%</div>
            <span className="text-[11px] text-slate-500">CAGR: +{summary.bhCagr}%</span>
          </div>

          <div className="bg-slate-900/90 border border-slate-800 rounded-xl p-4 shadow-xl">
            <span className="text-xs text-slate-400 font-medium block">Max Drawdown (Risk)</span>
            <div className="text-xl font-bold text-rose-400 mt-1">-{summary.maxAiDrawdown}%</div>
            <span className="text-[11px] text-slate-500">vs Buy & Hold: -{summary.maxBhDrawdown}%</span>
          </div>

          <div className="bg-slate-900/90 border border-slate-800 rounded-xl p-4 shadow-xl">
            <span className="text-xs text-slate-400 font-medium block">Sharpe Ratio & Win Rate</span>
            <div className="text-xl font-bold text-indigo-400 mt-1">{summary.sharpeRatio}</div>
            <span className="text-[11px] text-slate-500">Win Rate: {summary.winRate}% ({summary.totalTrades} trades)</span>
          </div>
        </div>
      )}

      {/* Equity Curves Chart */}
      {backtestResult?.equityCurve && (
        <div className="bg-slate-900/90 border border-slate-800 rounded-xl p-5 shadow-xl">
          <h3 className="text-sm font-semibold text-slate-200 mb-4 flex items-center justify-between border-b border-slate-800 pb-3">
            <span>Portfolio Equity Curve Comparison (NRS)</span>
            <span className="text-xs font-normal text-slate-400">Green: AI Signals | Gray: Buy & Hold</span>
          </h3>

          <div className="h-80 w-full">
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={backtestResult.equityCurve}>
                <CartesianGrid strokeDasharray="3 3" stroke="#1e293b" />
                <XAxis dataKey="date" stroke="#64748b" tick={{ fontSize: 10 }} />
                <YAxis stroke="#64748b" tick={{ fontSize: 10 }} domain={['auto', 'auto']} />
                <Tooltip
                  contentStyle={{ backgroundColor: '#0f172a', borderColor: '#334155', borderRadius: '8px', fontSize: '12px' }}
                  itemStyle={{ color: '#cbd5e1' }}
                />
                <Legend wrapperStyle={{ fontSize: '12px', paddingTop: '10px' }} />
                <Line type="monotone" dataKey="aiStrategy" name="AI Buy Signal Strategy" stroke="#10b981" strokeWidth={2.5} dot={false} />
                <Line type="monotone" dataKey="buyAndHold" name="Buy & Hold Baseline" stroke="#94a3b8" strokeWidth={2} strokeDasharray="4 4" dot={false} />
              </LineChart>
            </ResponsiveContainer>
          </div>
        </div>
      )}
    </div>
  );
}
