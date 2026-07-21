import { useState, useEffect, useCallback } from 'react';
import { TrendingUp, TrendingDown, Activity, RefreshCw, WifiOff, ChevronUp, ChevronDown, Clock, Layers, Zap, AlertCircle } from 'lucide-react';
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

/* ─── Inline simulated data (always available without backend) ──────────── */
const SIMULATED_DATA = {
  summary: {
    isOpen: false,
    simulatedData: true,
    nepseIndex:      2074.56,
    nepseChange:     -8.34,
    nepseChangePct:  -0.40,
    sensitiveIndex:  418.22,
    sensitiveChange: -1.22,
    floatIndex:      157.88,
    floatChange:     -0.65,
    totalTurnover:   2341567890,
    totalVolume:     4823450,
    totalTrades:     48234,
  },
  indices: [
    { name: 'NEPSE Index',     value: 2074.56, change: -8.34,  changePct: -0.40 },
    { name: 'Sensitive Index', value: 418.22,  change: -1.22,  changePct: -0.29 },
    { name: 'Float Index',     value: 157.88,  change: -0.65,  changePct: -0.41 },
    { name: 'Banking',         value: 1234.45, change: -5.12,  changePct: -0.41 },
    { name: 'Dev. Bank',       value: 2345.67, change:  12.34, changePct:  0.53 },
    { name: 'Finance',         value: 1567.89, change: -7.45,  changePct: -0.47 },
    { name: 'Insurance',       value: 8765.43, change:  32.10, changePct:  0.37 },
    { name: 'Hydropower',      value: 2134.56, change: -9.87,  changePct: -0.46 },
  ],
  gainers: [
    { symbol: 'NABIL',  ltp: 920,  pointChange:  42, pctChange:  4.78, volume:  12340 },
    { symbol: 'GBIME',  ltp: 345,  pointChange:  15, pctChange:  4.54, volume:   8920 },
    { symbol: 'NTC',    ltp: 780,  pointChange:  32, pctChange:  4.28, volume:   5670 },
    { symbol: 'SANIMA', ltp: 298,  pointChange:  11, pctChange:  3.83, volume:  15430 },
    { symbol: 'NICA',   ltp: 567,  pointChange:  21, pctChange:  3.84, volume:   6780 },
    { symbol: 'ADBL',   ltp: 412,  pointChange:  14, pctChange:  3.52, volume:   9820 },
    { symbol: 'BOKL',   ltp: 234,  pointChange:   7, pctChange:  3.08, volume:  23450 },
    { symbol: 'SWBBL',  ltp: 189,  pointChange:   5, pctChange:  2.71, volume:   4530 },
    { symbol: 'MEGA',   ltp: 245,  pointChange:   6, pctChange:  2.51, volume:  18760 },
    { symbol: 'MLBSL',  ltp: 456,  pointChange:  11, pctChange:  2.47, volume:   7890 },
  ],
  losers: [
    { symbol: 'UPPER',  ltp: 612,  pointChange:  -38, pctChange: -5.84, volume:  34560 },
    { symbol: 'HDHPC',  ltp: 145,  pointChange:   -8, pctChange: -5.23, volume:  12340 },
    { symbol: 'BFC',    ltp: 278,  pointChange:  -14, pctChange: -4.79, volume:   8920 },
    { symbol: 'CHDC',   ltp: 398,  pointChange:  -19, pctChange: -4.56, volume:   5670 },
    { symbol: 'PRIC',   ltp: 1234, pointChange:  -55, pctChange: -4.27, volume:   3450 },
    { symbol: 'LICN',   ltp: 4560, pointChange: -198, pctChange: -4.16, volume:   2340 },
    { symbol: 'NLG',    ltp: 2345, pointChange:  -98, pctChange: -4.01, volume:   4560 },
    { symbol: 'SICL',   ltp: 1890, pointChange:  -74, pctChange: -3.77, volume:   6780 },
    { symbol: 'KBBL',   ltp: 189,  pointChange:   -7, pctChange: -3.57, volume:   9870 },
    { symbol: 'NIBL',   ltp: 623,  pointChange:  -22, pctChange: -3.41, volume:  15430 },
  ],
  turnover: [
    { symbol: 'NABIL',  turnover: 113634000, volume: 123456, ltp: 920  },
    { symbol: 'GBIME',  turnover:  98765432, volume: 286122, ltp: 345  },
    { symbol: 'NTC',    turnover:  87654321, volume: 112379, ltp: 780  },
    { symbol: 'NICA',   turnover:  76543210, volume: 134992, ltp: 567  },
    { symbol: 'UPPER',  turnover:  65432198, volume: 106912, ltp: 612  },
    { symbol: 'ADBL',   turnover:  54321987, volume: 131849, ltp: 412  },
    { symbol: 'SANIMA', turnover:  43210876, volume: 144999, ltp: 298  },
    { symbol: 'MEGA',   turnover:  32109765, volume: 131060, ltp: 245  },
    { symbol: 'BOKL',   turnover:  21098654, volume:  90114, ltp: 234  },
    { symbol: 'NIBL',   turnover:  10987543, volume:  17636, ltp: 623  },
  ],
};

/* ─── Graph Data Processor ────────────────────────────────────────────────── */
function processGraphData(rawData, chartType) {
  if (!rawData || !rawData.length) return [];
  
  if (chartType === 'line') {
    return rawData.map(([ts, val]) => ({ time: ts, value: val })).sort((a, b) => a.time - b.time);
  }
  
  // Candlestick: bucket by 5 minutes (300 seconds)
  const bucketSize = 300; 
  const buckets = {};
  
  rawData.forEach(([ts, val]) => {
    // Round down to nearest bucket
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

const API = 'http://localhost:5000/api/nepse';

async function tryFetch(path) {
  const res = await fetch(`${API}${path}`, { signal: AbortSignal.timeout(4000) });
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  return res.json();
}

/* ─── Sub-components ─────────────────────────────────────────────────────── */

function SimBadge() {
  return (
    <span className="sim-badge">
      <AlertCircle size={10} /> Demo Data
    </span>
  );
}

function MarketStatusBar({ isOpen, simulatedData, backendOnline, lastUpdated, onRefresh, loading }) {
  return (
    <div className={`market-status-bar ${isOpen ? 'market-open' : 'market-closed'}`}>
      <div className="market-status-left">
        <span className="market-pulse" />
        <span className="market-status-text">
          {isOpen ? 'MARKET OPEN' : 'MARKET CLOSED'}
        </span>
        <span className="market-status-sub">
          Nepal Stock Exchange ·{' '}
          {backendOnline ? 'Live via NepseUnofficialApi' : 'Fallback Mode'}
        </span>
        {simulatedData && <SimBadge />}
        {!backendOnline && (
          <span className="offline-badge" title="Unable to reach backend API server. Showing fallback data.">
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

function StockTable({ title, data, type, loading, simulatedData }) {
  const isGainer = type === 'gainers';
  const color     = isGainer ? 'var(--green)' : 'var(--red)';
  const softColor = isGainer ? 'var(--green-soft)' : 'var(--red-soft)';

  return (
    <div className="stock-table-block">
      <div className="stock-table-header">
        <div className="stock-table-title-row">
          <div className="stock-table-indicator" style={{ background: color }} />
          <span className="stock-table-title">{title}</span>
          {simulatedData && <SimBadge />}
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

function TurnoverTable({ data, loading, simulatedData }) {
  return (
    <div className="stock-table-block">
      <div className="stock-table-header">
        <div className="stock-table-title-row">
          <div className="stock-table-indicator" style={{ background: 'var(--blue)' }} />
          <span className="stock-table-title">Top by Turnover</span>
          {simulatedData && <SimBadge />}
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

function IndexChart({ indices, loading }) {
  const [sel, setSel] = useState(0);
  const [chartType, setChartType] = useState('line'); 
  const idx = indices[sel] || { name: 'NEPSE Index', value: 2074.56, change: -8.34 };
  const up = idx.change >= 0;
  
  const [rawData, setRawData] = useState([]);
  const [isFetchingGraph, setIsFetchingGraph] = useState(false);

  useEffect(() => {
    let active = true;
    const fetchGraph = async () => {
      setIsFetchingGraph(true);
      try {
        const res = await tryFetch(`/graph/${encodeURIComponent(idx.name)}`);
        if (active) {
          if (res.graph && res.graph.length > 0) {
            setRawData(res.graph);
          } else {
            throw new Error('Empty graph data');
          }
        }
      } catch (err) {
        console.error(err);
        if (active) {
          const base = idx.value;
          const points = [];
          let time = Math.floor(Date.now() / 1000) - 3600 * 4;
          let val = base - idx.change;
          for (let i = 0; i < 60; i++) {
            points.push([time, val]);
            time += 240;
            val += (Math.random() - 0.45) * 5;
          }
          points.push([Math.floor(Date.now() / 1000), base]);
          setRawData(points);
        }
      } finally {
        if (active) setIsFetchingGraph(false);
      }
    };
    fetchGraph();
    return () => { active = false; };
  }, [sel, idx.name]);

  const chartData = processGraphData(rawData, chartType);

  return (
    <div className="index-chart-block">
      <div className="index-chart-header" style={{ alignItems: 'flex-start' }}>
        <div>
          <div className="index-chart-title">Market Chart {isFetchingGraph && <span style={{fontSize: '0.7rem', color: 'var(--text-muted)'}}>(Loading...)</span>}</div>
          <div className="index-chart-subtitle">Intraday · {idx.name}</div>
        </div>
        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: '0.5rem' }}>
          <div className="index-chart-tabs" style={{ background: 'var(--bg-card)', padding: '2px', borderRadius: 'var(--radius-sm)', border: '1px solid var(--border)' }}>
            <button
              className={`index-chart-tab ${chartType === 'line' ? 'active' : ''}`}
              onClick={() => setChartType('line')}
              style={{ border: 'none', background: chartType === 'line' ? 'var(--bg-glass)' : 'transparent', color: chartType === 'line' ? 'var(--text-primary)' : 'var(--text-muted)' }}
            >
              Line
            </button>
            <button
              className={`index-chart-tab ${chartType === 'candle' ? 'active' : ''}`}
              onClick={() => setChartType('candle')}
              style={{ border: 'none', background: chartType === 'candle' ? 'var(--bg-glass)' : 'transparent', color: chartType === 'candle' ? 'var(--text-primary)' : 'var(--text-muted)' }}
            >
              Candle
            </button>
          </div>
          <div className="index-chart-tabs">
            {indices.slice(0, 4).map((ind, i) => (
              <button
                key={ind.name}
                className={`index-chart-tab${sel === i ? ' active' : ''}`}
                onClick={() => setSel(i)}
              >
                {ind.name.replace(' Index', '')}
              </button>
            ))}
          </div>
        </div>
      </div>
      <div style={{ width: '100%', height: 250, position: 'relative' }}>
        {chartData.length > 0 ? (
          <TradingChart 
            data={chartData} 
            type={chartType} 
            colors={{
              upColor: 'var(--green)',
              downColor: 'var(--red)',
              lineColor: up ? 'var(--green)' : 'var(--red)',
            }}
          />
        ) : (
          <div style={{ display: 'flex', height: '100%', alignItems: 'center', justifyContent: 'center', color: 'var(--text-muted)' }}>
            {isFetchingGraph ? 'Loading graph data...' : 'No graph data available'}
          </div>
        )}
      </div>
    </div>
  );
}

/* ─── Main page ──────────────────────────────────────────────────────────── */
export default function Investment() {
  const [summary,       setSummary]       = useState(SIMULATED_DATA.summary);
  const [indices,       setIndices]       = useState(SIMULATED_DATA.indices);
  const [gainers,       setGainers]       = useState(SIMULATED_DATA.gainers);
  const [losers,        setLosers]        = useState(SIMULATED_DATA.losers);
  const [turnover,      setTurnover]      = useState(SIMULATED_DATA.turnover);
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
      setIndices(idxData.indices  || SIMULATED_DATA.indices);
      setGainers(gainData.gainers || SIMULATED_DATA.gainers);
      setLosers(loseData.losers   || SIMULATED_DATA.losers);
      setTurnover(turnData.turnover || SIMULATED_DATA.turnover);
      setBackendOnline(true);
      setLastUpdated(
        new Date().toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' })
      );
    } catch {
      // Backend offline → keep / restore simulated data
      setBackendOnline(false);
      setSummary(SIMULATED_DATA.summary);
      setIndices(SIMULATED_DATA.indices);
      setGainers(SIMULATED_DATA.gainers);
      setLosers(SIMULATED_DATA.losers);
      setTurnover(SIMULATED_DATA.turnover);
    } finally {
      setLoading(false);
    }
  }, []);

  // Try live data on mount; silently fall back
  useEffect(() => {
    loadData();
    const iv = setInterval(loadData, 90000);
    return () => clearInterval(iv);
  }, [loadData]);

  const sim = summary?.simulatedData !== false;

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
            Nepal Stock Exchange · NepseUnofficialApi
          </p>
        </div>
        <div className="investment-header-right">
          {summary && (
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
        simulatedData={sim}
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
          <StatKPICard
            name="Total Trades"
            value={fmtNum(summary?.totalTrades ?? 0)}
            sub="Executed orders"
            icon={Layers}
            color="var(--amber)"
            loading={loading}
          />
          <StatKPICard
            name="Market Status"
            value={summary?.isOpen ? 'OPEN' : 'CLOSED'}
            sub={summary?.isOpen ? 'Trading in progress' : 'Next: 11:00 AM NST'}
            icon={Zap}
            color={summary?.isOpen ? 'var(--green)' : 'var(--red)'}
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
                        <div style={{ fontWeight: 600, marginBottom: '0.25rem', color: 'var(--text-primary)' }}>Listed Companies:</div>
                        <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.35rem', maxHeight: '160px', overflowY: 'auto', paddingRight: '0.25rem' }}>
                          {companies.map(c => (
                            <span key={c} style={{ background: 'var(--bg-surface)', padding: '2px 6px', borderRadius: '4px', border: '1px solid var(--border)' }}>
                              {c}
                            </span>
                          ))}
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
          <StockTable title="Top Gainers" data={gainers} type="gainers" loading={loading} simulatedData={sim} />
          <StockTable title="Top Losers"  data={losers}  type="losers"  loading={loading} simulatedData={sim} />
        </div>

        {/* ── Top Turnover ── */}
        <TurnoverTable data={turnover} loading={loading} simulatedData={sim} />
      </div>
    </main>
  );
}
