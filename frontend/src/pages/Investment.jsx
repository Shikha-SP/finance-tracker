import { useState, useEffect, useCallback } from 'react';
import { TrendingUp, TrendingDown, Activity, RefreshCw, WifiOff, ChevronUp, ChevronDown, Clock, Maximize2, X, Calendar } from 'lucide-react';
import SECTOR_COMPANIES from '../sectorCompanies.json';
import TradingChart from '../components/TradingChart';

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

/* ─── Graph Data Processor ────────────────────────────────────────────────── */
function processGraphData(rawData, chartType) {
  if (!rawData || !rawData.length) return [];

  // Check if first item is object { time, open, high, low, close, value } vs array [ts, val]
  const isObject = typeof rawData[0] === 'object' && !Array.isArray(rawData[0]);

  // Normalize: dedupe by time and sort ascending so lightweight-charts never throws
  const byTime = new Map();

  if (isObject) {
    rawData.forEach(item => {
      if (item && item.time !== undefined) {
        byTime.set(String(item.time), item);
      }
    });
  } else {
    rawData.forEach(([ts, val]) => {
      if (ts !== undefined && ts !== null && !isNaN(ts)) {
        byTime.set(String(ts), [ts, val]);
      }
    });
  }

  const toTimeNum = v => {
    if (typeof v === 'string') {
      const t = Date.parse(v);
      return isNaN(t) ? 0 : t;
    }
    return Number(v) || 0;
  };

  const sorted = [...byTime.values()].sort((a, b) => {
    const ta = (Array.isArray(a) ? a[0] : a.time);
    const tb = (Array.isArray(b) ? b[0] : b.time);
    return toTimeNum(ta) - toTimeNum(tb);
  });

  if (isObject) {
    if (chartType === 'line') {
      return sorted.map(item => ({
        time: item.time,
        value: item.close !== undefined ? item.close : item.value
      }));
    }
    return sorted.map(item => ({
      time: item.time,
      open: item.open || item.close || item.value,
      high: item.high || item.close || item.value,
      low: item.low || item.close || item.value,
      close: item.close || item.value
    }));
  }

  // Tuple array format [ts, val]
  if (chartType === 'line') {
    return sorted.map(([ts, val]) => ({ time: ts, value: val }));
  }

  // Candlestick bucket by 5 minutes (300 seconds)
  const bucketSize = 300;
  const buckets = {};

  sorted.forEach(([ts, val]) => {
    const bucketTime = Math.floor(ts / bucketSize) * bucketSize;
    if (!buckets[bucketTime]) {
      buckets[bucketTime] = { time: bucketTime, open: val, high: val, low: val, close: val };
    } else {
      const b = buckets[bucketTime];
      b.high = Math.max(b.high, val);
      b.low = Math.min(b.low, val);
      b.close = val;
    }
  });

  return Object.values(buckets).sort((a, b) => a.time - b.time);
}

const API = '/api/nepse';

async function tryFetch(path) {
  const res = await fetch(`${API}${path}`, { signal: AbortSignal.timeout(8000) });
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  return res.json();
}

/* ─── Sub-components ─────────────────────────────────────────────────────── */

function MarketStatusBar({ isOpen, statusText, backendOnline, lastUpdated, onRefresh, loading }) {
  const isFallback = statusText && (statusText.includes('Fallback') || statusText.includes('past data'));
  
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

function StockTable({ title, data, type, loading }) {
  const isGainer = type === 'gainers';
  const color     = isGainer ? 'var(--green)' : 'var(--red)';
  const softColor = isGainer ? 'var(--green-soft)' : 'var(--red-soft)';

  return (
    <div className="stock-table-block">
      <div className="stock-table-header">
        <div className="stock-table-title-row">
          <div className="stock-table-indicator" style={{ background: color }} />
          <span className="stock-table-title">{title}</span>
        </div>
      </div>
      <div className="stock-table-body">
        <div className="stock-table-row stock-table-head-row">
          <span>#</span><span>Symbol</span><span>LTP (रू)</span>
          <span>Change</span><span>% Chg</span><span>Volume</span>
        </div>
        {loading
          ? Array.from({ length: 8 }).map((_, i) => (
              <div className="stock-table-row loading-row" key={i}>
                {Array.from({ length: 6 }).map((_, j) => (
                  <span key={j}><div className="skeleton" /></span>
                ))}
              </div>
            ))
          : data.map((s, i) => (
              <div className="stock-table-row stock-table-data-row" key={s.symbol}>
                <span className="stock-rank">{i + 1}</span>
                <span className="stock-symbol">{s.symbol}</span>
                <span className="stock-ltp">{fmtNum(s.ltp)}</span>
                <span style={{ color, fontFamily: "'DM Mono',monospace", fontSize: '0.8rem', fontWeight: 600 }}>
                  {fmtPt(s.pointChange)}
                </span>
                <span>
                  <span className="change-badge" style={{ background: softColor, color }}>
                    {isGainer ? <ChevronUp size={10} /> : <ChevronDown size={10} />}
                    {Math.abs(s.pctChange).toFixed(2)}%
                  </span>
                </span>
                <span className="stock-volume">{fmtNum(s.volume)}</span>
              </div>
            ))}
      </div>
    </div>
  );
}

function TurnoverTable({ data, loading }) {
  return (
    <div className="stock-table-block">
      <div className="stock-table-header">
        <div className="stock-table-title-row">
          <div className="stock-table-indicator" style={{ background: 'var(--blue)' }} />
          <span className="stock-table-title">Top by Turnover</span>
        </div>
      </div>
      <div className="stock-table-body">
        <div className="stock-table-row turnover-row stock-table-head-row">
          <span>#</span><span>Symbol</span><span>LTP (रू)</span>
          <span>Volume</span><span>Turnover</span>
        </div>
        {loading
          ? Array.from({ length: 8 }).map((_, i) => (
              <div className="stock-table-row turnover-row loading-row" key={i}>
                {Array.from({ length: 5 }).map((_, j) => (
                  <span key={j}><div className="skeleton" /></span>
                ))}
              </div>
            ))
          : data.map((s, i) => (
              <div className="stock-table-row turnover-row stock-table-data-row" key={s.symbol}>
                <span className="stock-rank">{i + 1}</span>
                <span className="stock-symbol">{s.symbol}</span>
                <span className="stock-ltp">{fmtNum(s.ltp)}</span>
                <span className="stock-volume">{fmtNum(s.volume)}</span>
                <span style={{ fontFamily: "'DM Mono',monospace", fontSize: '0.79rem', fontWeight: 600, color: 'var(--blue)' }}>
                  {fmtNPRk(s.turnover)}
                </span>
              </div>
            ))}
      </div>
    </div>
  );
}

const TIME_RANGES = ['1D', '1W', '1M', '1Y', '3Y', '5Y', 'ALL'];

function ChartPanel({ idx, indices, sel, setSel, chartType, setChartType, chartData, isFetchingGraph, up, isExpanded = false, onExpand, onClose, timeRange, setTimeRange, liveMode, setLiveMode }) {
  return (
    <div className={isExpanded ? 'chart-panel-expanded' : 'index-chart-block'}>
      {/* Header */}
      <div className="chart-panel-header">
        {/* Left: index selector tabs */}
        <div className="chart-index-tabs" style={{ overflowX: 'auto', flexWrap: 'nowrap', paddingBottom: '2px', maxWidth: isExpanded ? 'none' : '380px' }}>
          {indices.map((ind, i) => (
            <button
              key={ind.name}
              className={`chart-index-tab${sel === i ? ' active' : ''}`}
              onClick={() => setSel(i)}
              style={{ whiteSpace: 'nowrap', flexShrink: 0 }}
            >
              {ind.name.replace(' Index', '').replace('SubIndex', '')}
            </button>
          ))}
        </div>
        {/* Right: live toggle + time range + chart type + expand */}
        <div className="chart-panel-controls" style={{ flexShrink: 0, gap: '0.4rem' }}>
          {/* Live vs Historic Toggle */}
          <button
            onClick={() => setLiveMode(!liveMode)}
            style={{
              padding: '0.25rem 0.6rem', fontSize: '0.75rem', fontWeight: 600, borderRadius: '4px',
              border: liveMode ? '1px solid var(--green)' : '1px solid var(--border)',
              background: liveMode ? 'var(--green-soft, rgba(16,185,129,0.15))' : 'var(--bg-surface)',
              color: liveMode ? 'var(--green)' : 'var(--text-muted)', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '4px'
            }}
            title={liveMode ? "Live Stream Enabled" : "Showing Historic Candle Data"}
          >
            <span style={{ width: '6px', height: '6px', borderRadius: '50%', background: liveMode ? 'var(--green)' : 'var(--text-muted)' }} />
            {liveMode ? 'LIVE' : 'HISTORIC'}
          </button>
          <div className="chart-type-toggle">
            {TIME_RANGES.map(r => (
              <button
                key={r}
                className={`chart-type-btn${timeRange === r ? ' active' : ''}`}
                onClick={() => setTimeRange(r)}
              >{r}</button>
            ))}
          </div>
          <div className="chart-type-toggle">
            <button
              className={`chart-type-btn${chartType === 'line' ? ' active' : ''}`}
              onClick={() => setChartType('line')}
            >Line</button>
            <button
              className={`chart-type-btn${chartType === 'candle' ? ' active' : ''}`}
              onClick={() => setChartType('candle')}
            >Candle</button>
          </div>
          {isExpanded ? (
            <button className="chart-expand-btn" onClick={onClose} title="Close">
              <X size={15} />
            </button>
          ) : (
            <button className="chart-expand-btn" onClick={onExpand} title="Expand chart">
              <Maximize2 size={14} />
            </button>
          )}
        </div>
      </div>

      {/* Value display */}
      <div className="chart-value-row">
        <div>
          <div className="chart-index-name">
            {idx.name}
            {isFetchingGraph && <span className="chart-loading-dot">●</span>}
          </div>
          <div className="chart-index-value">
            {idx.value.toLocaleString('en-IN', { maximumFractionDigits: 2 })}
          </div>
        </div>
        <div className={`chart-index-change ${up ? 'up' : 'down'}`}>
          {up ? <ChevronUp size={16} /> : <ChevronDown size={16} />}
          <div>
            <div className="chart-change-pt">{fmtPt(idx.change)}</div>
            <div className="chart-change-pct">{fmtPct(idx.changePct)}</div>
          </div>
        </div>
      </div>

      {/* Chart area */}
      <div style={{ width: '100%', height: isExpanded ? 'calc(100% - 140px)' : 320, position: 'relative', flex: isExpanded ? 1 : 'unset' }}>
        {chartData.length > 0 ? (
          <TradingChart
            data={chartData}
            type={chartType}
            colors={{
              upColor: '#10b981',
              downColor: '#ef4444',
              lineColor: up ? '#10b981' : '#ef4444',
            }}
          />
        ) : (
          <div style={{ display: 'flex', height: '100%', alignItems: 'center', justifyContent: 'center', color: 'var(--text-muted)', flexDirection: 'column', gap: '0.5rem' }}>
            <Activity size={28} style={{ opacity: 0.3 }} />
            <span style={{ fontSize: '0.8rem' }}>{isFetchingGraph ? 'Loading real chart data…' : 'No chart data available'}</span>
          </div>
        )}
      </div>
    </div>
  );
}

function IndexChart({ indices }) {
  const [sel, setSel] = useState(0);
  const [chartType, setChartType] = useState('line');
  const [timeRange, setTimeRange] = useState('1D');
  const [liveMode, setLiveMode] = useState(true);
  const [expanded, setExpanded] = useState(false);
  const idx = indices[sel] || { name: 'NEPSE Index', value: 2074.56, change: -8.34, changePct: -0.40 };
  const up = idx.change >= 0;

  const [rawData, setRawData] = useState([]);
  const [isFetchingGraph, setIsFetchingGraph] = useState(false);

  useEffect(() => {
    let active = true;
    const fetchGraph = async () => {
      setIsFetchingGraph(true);
      try {
        let res = null;
        const now = Math.floor(Date.now() / 1000);
        let from = now - 30 * 24 * 3600;

        if (timeRange === '1D' && liveMode) {
          try {
            res = await tryFetch(`/graph/${encodeURIComponent(idx.name)}`);
          } catch {
            res = null;
          }
        }

        if (!liveMode || timeRange !== '1D' || !res || !res.graph || res.graph.length === 0) {
          if (timeRange === '1W') from = now - 7 * 24 * 3600;
          if (timeRange === '1M') from = now - 30 * 24 * 3600;
          if (timeRange === '1Y') from = now - 365 * 24 * 3600;
          if (timeRange === '3Y') from = now - 1095 * 24 * 3600;
          if (timeRange === '5Y') from = now - 1825 * 24 * 3600;
          if (timeRange === 'ALL') from = now - 3650 * 24 * 3600;
          if (timeRange === '1D') from = now - 14 * 24 * 3600;

          res = await tryFetch(`/history/${encodeURIComponent(idx.name)}?from=${from}&to=${now}&resolution=1D`);
        }

        if (active) {
          const data = Array.isArray(res) ? res : (res && res.graph ? res.graph : []);
          setRawData(data);
        }
      } catch {
        if (active) setRawData([]);
      } finally {
        if (active) setIsFetchingGraph(false);
      }
    };
    fetchGraph();
    let poll = null;
    if (liveMode && timeRange === '1D') {
      poll = setInterval(fetchGraph, 60000);
    }
    return () => { active = false; if (poll) clearInterval(poll); };
  }, [sel, idx.name, timeRange, liveMode]);

  const chartData = processGraphData(rawData, chartType);
  const sharedProps = { idx, indices, sel, setSel, chartType, setChartType, chartData, isFetchingGraph, up, timeRange, setTimeRange, liveMode, setLiveMode };


  return (
    <>
      <ChartPanel {...sharedProps} onExpand={() => setExpanded(true)} />
      {expanded && (
        <div className="chart-expand-overlay" onClick={() => setExpanded(false)}>
          <div className="chart-expand-modal chart-expand-modal--xl" onClick={e => e.stopPropagation()}>
            <ChartPanel {...sharedProps} isExpanded onClose={() => setExpanded(false)} />
          </div>
        </div>
      )}
    </>
  );
}

/* ─── Market History & Performance Section Component ────────────────────── */
function MarketHistorySection() {
  const [period, setPeriod] = useState('1M');
  const [showHistory, setShowHistory] = useState(false);
  const [historyData, setHistoryData] = useState(null);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    let active = true;
    const fetchHistory = async () => {
      setLoading(true);
      try {
        const res = await fetch(`${API}/market-history?period=${period}`);
        if (res.ok) {
          const data = await res.json();
          if (active) setHistoryData(data);
        }
      } catch {
        if (active) setHistoryData(null);
      } finally {
        if (active) setLoading(false);
      }
    };

    const id = window.setTimeout(() => {
      void fetchHistory();
    }, 0);

    return () => {
      active = false;
      window.clearTimeout(id);
    };
  }, [period]);

  const periods = ['1W', '1M', '3M', '1Y', '3Y', '5Y'];

  return (
    <div className="card" style={{ marginTop: '2.5rem', padding: '1.5rem' }}>
      <div style={{ display: 'flex', flexWrap: 'wrap', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.25rem', gap: '1rem' }}>
        <div>
          <div style={{ fontSize: '1.1rem', fontWeight: 700, display: 'flex', alignItems: 'center', gap: '0.5rem', color: 'var(--text-primary)' }}>
            <Calendar size={18} style={{ color: 'var(--accent)' }} />
            Market History & Sector Performance
          </div>
          <div style={{ fontSize: '0.8rem', color: 'var(--text-muted)', marginTop: '2px' }}>
            Historical price returns, period highs/lows, and volume analysis computed from real NEPSE datasets.
          </div>
        </div>

        <div className="chart-type-toggle" style={{ background: 'var(--bg-surface)', padding: '3px', borderRadius: 'var(--radius-md)', border: '1px solid var(--border)' }}>
          <button
            className={`chart-type-btn${showHistory ? ' active' : ''}`}
            onClick={() => setShowHistory(!showHistory)}
            style={{ padding: '0.3rem 0.75rem', fontSize: '0.8rem', fontWeight: 600 }}
          >
            {showHistory ? 'Hide' : 'Show'} History
          </button>
          {showHistory && periods.map(p => (
            <button
              key={p}
              className={`chart-type-btn${period === p ? ' active' : ''}`}
              onClick={() => setPeriod(p)}
              style={{ padding: '0.3rem 0.75rem', fontSize: '0.8rem', fontWeight: 600 }}
            >
              {p}
            </button>
          ))}
        </div>
      </div>

      {showHistory && (loading ? (
        <div style={{ display: 'flex', justifyContent: 'center', padding: '3rem 0' }}>
          <RefreshCw size={24} className="spin" style={{ color: 'var(--accent)' }} />
        </div>
      ) : historyData && historyData.data ? (
        <>
          {/* Top Performer Highlights */}
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', gap: '1rem', marginBottom: '1.5rem' }}>
            {/* Gainers */}
            <div style={{ background: 'var(--bg-surface)', padding: '1rem', borderRadius: 'var(--radius-md)', border: '1px solid var(--border)' }}>
              <div style={{ fontSize: '0.85rem', fontWeight: 700, color: 'var(--green)', display: 'flex', alignItems: 'center', gap: '0.4rem', marginBottom: '0.75rem' }}>
                <TrendingUp size={16} /> Top Performers ({period})
              </div>
              {historyData.gainers.slice(0, 4).map(g => (
                <div key={g.symbol} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '0.4rem 0', borderBottom: '1px solid var(--border)' }}>
                  <span style={{ fontWeight: 600, fontSize: '0.85rem' }}>{g.symbol}</span>
                  <span style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>रू {g.currentPrice}</span>
                  <span className="change-badge up" style={{ fontSize: '0.75rem' }}>
                    +{g.pctChange.toFixed(2)}%
                  </span>
                </div>
              ))}
            </div>

            {/* Decliners */}
            <div style={{ background: 'var(--bg-surface)', padding: '1rem', borderRadius: 'var(--radius-md)', border: '1px solid var(--border)' }}>
              <div style={{ fontSize: '0.85rem', fontWeight: 700, color: 'var(--red)', display: 'flex', alignItems: 'center', gap: '0.4rem', marginBottom: '0.75rem' }}>
                <TrendingDown size={16} /> Lowest Performers ({period})
              </div>
              {historyData.decliners.slice(0, 4).map(d => (
                <div key={d.symbol} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '0.4rem 0', borderBottom: '1px solid var(--border)' }}>
                  <span style={{ fontWeight: 600, fontSize: '0.85rem' }}>{d.symbol}</span>
                  <span style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>रू {d.currentPrice}</span>
                  <span className="change-badge down" style={{ fontSize: '0.75rem' }}>
                    {d.pctChange.toFixed(2)}%
                  </span>
                </div>
              ))}
            </div>
          </div>

          {/* Detailed Performance Table */}
          <div className="stock-table-body">
            <div className="stock-table-row stock-table-head-row" style={{ display: 'grid', gridTemplateColumns: '50px 1fr 100px 100px 100px 100px 100px 100px' }}>
              <span>#</span>
              <span>Symbol</span>
              <span>Start Price</span>
              <span>Current</span>
              <span>Return %</span>
              <span>Period High</span>
              <span>Period Low</span>
              <span>Avg Vol</span>
            </div>
            {historyData.data.map((item, idx) => {
              const up = item.pctChange >= 0;
              return (
                <div key={item.symbol} className="stock-table-row stock-table-data-row" style={{ display: 'grid', gridTemplateColumns: '50px 1fr 100px 100px 100px 100px 100px 100px' }}>
                  <span className="stock-rank">{idx + 1}</span>
                  <span className="stock-symbol">{item.symbol}</span>
                  <span>रू {item.startPrice.toLocaleString('en-IN', { maximumFractionDigits: 1 })}</span>
                  <span style={{ fontWeight: 600 }}>रू {item.currentPrice.toLocaleString('en-IN', { maximumFractionDigits: 1 })}</span>
                  <span>
                    <span className={`change-badge ${up ? 'up' : 'down'}`}>
                      {up ? <ChevronUp size={10} /> : <ChevronDown size={10} />}
                      {Math.abs(item.pctChange).toFixed(2)}%
                    </span>
                  </span>
                  <span style={{ color: 'var(--green)' }}>रू {item.high.toLocaleString('en-IN', { maximumFractionDigits: 1 })}</span>
                  <span style={{ color: 'var(--red)' }}>रू {item.low.toLocaleString('en-IN', { maximumFractionDigits: 1 })}</span>
                  <span className="stock-volume">{fmtNum(item.avgVolume)}</span>
                </div>
              );
            })}
          </div>
        </>
      ) : (
        <div style={{ textAlign: 'center', padding: '2rem', color: 'var(--text-muted)' }}>
          No market history data available.
        </div>
      ))}
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
  const [expandedIdx,   setExpandedIdx]   = useState(null);

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
        new Date().toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' })
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
      />

      <div className="page-content investment-content">
        {/* ── Index KPI cards ── */}
        <div className="index-kpi-grid">
          <IndexKPICard
            name="NEPSE Index"
            value={summary?.nepseIndex ?? 0}
            change={summary?.nepseChange ?? 0}
            changePct={summary?.nepseChangePct ?? 0}
            loading={loading}
          />
          <IndexKPICard
            name="Sensitive Index"
            value={summary?.sensitiveIndex ?? 0}
            change={summary?.sensitiveChange ?? 0}
            changePct={
              summary?.sensitiveIndex
                ? (summary.sensitiveChange / summary.sensitiveIndex) * 100
                : 0
            }
            loading={loading}
          />
          <IndexKPICard
            name="Float Index"
            value={summary?.floatIndex ?? 0}
            change={summary?.floatChange ?? 0}
            changePct={
              summary?.floatIndex
                ? (summary.floatChange / summary.floatIndex) * 100
                : 0
            }
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

        {/* ── Chart + all indices ── */}
        <div className="investment-chart-row">
          <IndexChart indices={indices} loading={loading} />
          <div className="indices-panel">
            <div className="indices-panel-header">All Indices</div>
            <div className="indices-list">
              {indices.map(ind => {
                const up = ind.change >= 0;
                const isExpanded = expandedIdx === ind.name;
                const companies = SECTOR_COMPANIES[ind.name] || [];
                const top50Companies = companies.slice(0, 50);
                const extraCount = companies.length - 50;

                return (
                  <div key={ind.name} style={{ display: 'flex', flexDirection: 'column' }}>
                    <div 
                      className="indices-row" 
                      onClick={() => setExpandedIdx(isExpanded ? null : ind.name)}
                      style={{ cursor: companies.length > 0 ? 'pointer' : 'default', borderBottom: isExpanded ? 'none' : undefined }}
                    >
                      <div>
                        <div className="indices-name" style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
                          {ind.name}
                          {companies.length > 0 && (isExpanded ? <ChevronUp size={12} /> : <ChevronDown size={12} />)}
                        </div>
                        <div className="indices-value">
                          {ind.value.toLocaleString('en-IN', { maximumFractionDigits: 2 })}
                        </div>
                      </div>
                      <div className={`indices-change ${up ? 'positive' : 'negative'}`}>
                        {up ? <ChevronUp size={11} /> : <ChevronDown size={11} />}
                        <div>
                          <div>{fmtPct(ind.changePct)}</div>
                          <div style={{ fontSize: '0.67rem', opacity: 0.75 }}>{fmtPt(ind.change)}</div>
                        </div>
                      </div>
                    </div>
                    {isExpanded && companies.length > 0 && (
                      <div style={{ padding: '0 0.75rem 0.75rem', background: 'var(--bg-card)', borderBottom: '1px solid var(--border)', fontSize: '0.75rem', color: 'var(--text-muted)' }}>
                        <div style={{ fontWeight: 600, marginBottom: '0.25rem', color: 'var(--text-primary)', display: 'flex', justifyContent: 'space-between' }}>
                          <span>Top Companies ({top50Companies.length} shown):</span>
                          {extraCount > 0 && <span>+{extraCount} more</span>}
                        </div>
                        <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.35rem', maxHeight: '160px', overflowY: 'auto', paddingRight: '0.25rem' }}>
                          {top50Companies.map(c => (
                            <span key={c} style={{ background: 'var(--bg-surface)', padding: '2px 6px', borderRadius: '4px', border: '1px solid var(--border)' }}>
                              {c}
                            </span>
                          ))}
                          {extraCount > 0 && (
                            <span style={{ background: 'var(--accent-soft, rgba(59,130,246,0.1))', color: 'var(--accent)', padding: '2px 6px', borderRadius: '4px', border: '1px solid var(--accent)', fontWeight: 600 }}>
                              +{extraCount} more
                            </span>
                          )}
                        </div>
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          </div>
        </div>

        {/* ── Top Gainers / Losers ── */}
        <div className="investment-tables-row">
          <StockTable title="Top Gainers" data={gainers} type="gainers" loading={loading}  />
          <StockTable title="Top Losers"  data={losers}  type="losers"  loading={loading}  />
        </div>

        {/* ── Top Turnover ── */}
        <TurnoverTable data={turnover} loading={loading}  />

        {/* ── Market History & Performance Section ── */}
        <MarketHistorySection />
      </div>
    </main>
  );
}
