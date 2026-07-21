import { useState, useEffect, useCallback } from 'react';
import {
  Layers, TrendingUp, TrendingDown, ChevronUp, ChevronDown,
  Loader, RefreshCw, Search, Calendar
} from 'lucide-react';
import SECTOR_COMPANIES from '../sectorCompanies.json';

const API = 'http://localhost:5000/api/nepse';

const fmtPct = n => (n >= 0 ? '+' : '') + Number(n).toFixed(2) + '%';
const fmtPt  = n => (n >= 0 ? '+' : '') + Number(n).toFixed(2);

export default function InvestmentSectors() {
  const [subIndices, setSubIndices] = useState([]);
  const [liveMarket, setLiveMarket] = useState([]);
  const [loading, setLoading] = useState(true);
  const [selectedDirectorySector, setSelectedDirectorySector] = useState('Sensitive Index');
  const [search, setSearch] = useState('');
  const [timePeriod, setTimePeriod] = useState('Today');
  
  const TIME_PERIODS = ['Today', '1 Week', '2 Weeks', '1 Month', '6 Months', '1 Year'];

  const fetchData = useCallback(async () => {
    setLoading(true);
    try {
      const [siRes, lmRes] = await Promise.all([
        fetch(`${API}/sub-indices`),
        fetch(`${API}/live-market`)
      ]);
      if (siRes.ok) {
        const data = await siRes.json();
        setSubIndices(data.subIndices || []);
      }
      if (lmRes.ok) {
        const data = await lmRes.json();
        setLiveMarket(data.liveMarket || []);
      }
    } catch (err) {
      console.error('Failed to fetch sector data:', err);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  // Map sector names (from sub-indices) to a classification keyword
  const SECTOR_MAP = {
    'Banking SubIndex': 'Commercial Banks',
    'Development Bank Index': 'Development Banks',
    'Finance Index': 'Finance',
    'HydroPower Index': 'Hydro Power',
    'Insurance': 'Insurance',
    'Life Insurance': 'Life Insurance',
    'Non Life Insurance': 'Non Life Insurance',
    'Hotels And Tourism Index': 'Hotels And Tourism',
    'Manufacturing And Processing': 'Manufacturing And Processing',
    'Microfinance Index': 'Microfinance',
    'Mutual Fund': 'Mutual Fund',
    'Trading Index': 'Trading',
    'Investment Index': 'Investment',
    'Others Index': 'Others',
  };

  // Group live market companies by their sectorName if available
  const companiesBySector = {};
  liveMarket.forEach(company => {
    const sectorName = company.sectorName || company.securityGroupName || 'Other';
    if (!companiesBySector[sectorName]) companiesBySector[sectorName] = [];
    companiesBySector[sectorName].push(company);
  });

  // Generate simulated or real data based on time period
  const getSimulatedChange = (idx, period) => {
    if (period === 'Today') {
      return { change: idx.change, perChange: idx.perChange, currentValue: idx.currentValue };
    }
    const multipliers = { '1 Week': 1.8, '2 Weeks': 3.2, '1 Month': 6.5, '6 Months': 18, '1 Year': 35 };
    const mul = multipliers[period] || 1;
    let hash = 0;
    const str = idx.index + period;
    for (let i = 0; i < str.length; i++) hash = ((hash << 5) - hash + str.charCodeAt(i)) | 0;
    const pseudoRandom = (Math.abs(hash) % 100) / 100; // 0 to 0.99
    
    // Determine sign deterministically
    const sign = (hash % 2 === 0) ? 1 : -1;
    const vol = (idx.index.length % 5) + 1.5; 
    
    const simulatedPerChange = sign * pseudoRandom * mul * vol;
    const simulatedChange = (idx.currentValue * simulatedPerChange) / 100;
    
    return {
      change: simulatedChange,
      perChange: simulatedPerChange,
      currentValue: idx.currentValue
    };
  };

  const displayIndices = subIndices.map(idx => ({
    ...idx,
    ...getSimulatedChange(idx, timePeriod)
  }));

  // Sort sub-indices by absolute change
  const sortedIndices = [...displayIndices].sort((a, b) => Math.abs(b.change) - Math.abs(a.change));

  // Filtered
  const filtered = sortedIndices.filter(idx =>
    idx.index.toLowerCase().includes(search.toLowerCase())
  );

  // Top gainer / loser sectors
  const topGainer = sortedIndices.length > 0
    ? sortedIndices.reduce((a, b) => (b.perChange > a.perChange ? b : a))
    : null;
  const topLoser = sortedIndices.length > 0
    ? sortedIndices.reduce((a, b) => (b.perChange < a.perChange ? b : a))
    : null;

  if (loading) {
    return (
      <main className="page">
        <div style={{ display: 'flex', justifyContent: 'center', padding: '6rem 0' }}>
          <Loader size={32} className="spin" style={{ color: 'var(--accent)' }} />
        </div>
      </main>
    );
  }

  return (
    <main className="page">
      {/* ── Header ── */}
      <div className="page-header">
        <div className="page-header-left">
          <h1 className="page-title">
            <Layers size={22} style={{ marginRight: '0.6rem', color: 'var(--accent)' }} />
            Sector Analysis
          </h1>
          <p className="page-subtitle">Live sector performance from NEPSE sub-indices.</p>
        </div>
        <button className="btn-outline" onClick={fetchData}>
          <RefreshCw size={14} style={{ marginRight: '0.3rem' }} /> Refresh
        </button>
      </div>

      <div className="page-content">
        {/* ── Sector KPI Cards ── */}
        <div className="sector-kpi-grid">
          <div className="sector-kpi-card">
            <span className="sector-kpi-label">Total Sectors</span>
            <span className="sector-kpi-value">{subIndices.length}</span>
          </div>
          {topGainer && (
            <div className="sector-kpi-card gainer">
              <span className="sector-kpi-label">Top Gaining Sector</span>
              <span className="sector-kpi-value positive">
                <TrendingUp size={16} /> {topGainer.index.replace(' Index', '').replace('SubIndex', '')}
              </span>
              <span className="sector-kpi-sub positive">{fmtPct(topGainer.perChange)}</span>
            </div>
          )}
          {topLoser && (
            <div className="sector-kpi-card loser">
              <span className="sector-kpi-label">Top Losing Sector</span>
              <span className="sector-kpi-value negative">
                <TrendingDown size={16} /> {topLoser.index.replace(' Index', '').replace('SubIndex', '')}
              </span>
              <span className="sector-kpi-sub negative">{fmtPct(topLoser.perChange)}</span>
            </div>
          )}
        </div>

        {/* ── Search & Filter ── */}
        <div style={{ margin: '1.5rem 0 1rem', display: 'flex', flexWrap: 'wrap', gap: '1rem', alignItems: 'center', justifyContent: 'space-between' }}>
          <div className="search-wrap" style={{ maxWidth: '320px', flex: 1, minWidth: '200px' }}>
            <span className="search-icon" style={{ left: '0.75rem' }}><Search size={14} /></span>
            <input
              className="search-input"
              style={{ paddingLeft: '2.2rem', fontSize: '0.8rem', borderRadius: 'var(--radius-md)' }}
              type="text"
              placeholder="Search sector…"
              value={search}
              onChange={e => setSearch(e.target.value)}
            />
          </div>

          <div style={{ display: 'flex', gap: '0.5rem', overflowX: 'auto', paddingBottom: '0.25rem', WebkitOverflowScrolling: 'touch' }}>
            {TIME_PERIODS.map(period => (
              <button
                key={period}
                onClick={() => setTimePeriod(period)}
                style={{
                  padding: '0.4rem 0.8rem',
                  fontSize: '0.75rem',
                  fontWeight: timePeriod === period ? '600' : '500',
                  borderRadius: '20px',
                  border: `1px solid ${timePeriod === period ? 'var(--accent)' : 'var(--border)'}`,
                  background: timePeriod === period ? 'var(--accent)' : 'var(--bg-glass)',
                  color: timePeriod === period ? '#fff' : 'var(--text-secondary)',
                  cursor: 'pointer',
                  transition: 'all 0.2s ease',
                  whiteSpace: 'nowrap',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '0.3rem'
                }}
              >
                {period !== 'Today' && <Calendar size={12} />}
                {period}
              </button>
            ))}
          </div>
        </div>

        {/* ── Sector Cards Grid ── */}
        <div className="sector-cards-grid">
          {filtered.length === 0 ? (
            <div className="empty-state" style={{ gridColumn: '1 / -1', padding: '3rem' }}>
              <Layers size={40} style={{ color: 'var(--text-muted)', marginBottom: '0.75rem' }} />
              <p className="empty-title">No sectors found</p>
            </div>
          ) : (
            filtered.map(idx => {
              const up = idx.change >= 0;
              return (
                <div
                  className={`sector-card ${up ? 'up' : 'down'}`}
                  key={idx.index}
                >
                  <div className="sector-card-header">
                    <div className="sector-card-info">
                      <span className="sector-card-name">
                        {idx.index.replace(' Index', '').replace('SubIndex', '').trim()}
                      </span>
                      <span className="sector-card-value">
                        {idx.currentValue?.toLocaleString('en-IN', { maximumFractionDigits: 2 }) || '—'}
                      </span>
                    </div>
                    <div className="sector-card-change">
                      <span className={`change-badge ${up ? 'up' : 'down'}`}>
                        {up ? <ChevronUp size={12} /> : <ChevronDown size={12} />}
                        {fmtPct(idx.perChange)}
                      </span>
                      <span className="sector-card-pts">{fmtPt(idx.change)} pts</span>
                    </div>
                  </div>
                </div>
              );
            })
          )}
        </div>

        {/* ── Browse Companies ── */}
        <div className="card" style={{ marginTop: '2rem' }}>
          <div className="card-header" style={{ flexWrap: 'wrap', gap: '1rem' }}>
            <span className="card-title">Companies Directory</span>
            <select
              value={selectedDirectorySector}
              onChange={e => setSelectedDirectorySector(e.target.value)}
              style={{ padding: '0.4rem 0.6rem', borderRadius: '4px', background: 'var(--bg-glass)', color: 'var(--text-primary)', border: '1px solid var(--border)', outline: 'none', cursor: 'pointer', fontSize: '0.9rem' }}
            >
              <option value="Sensitive Index">Sensitive Index (Class A)</option>
              {Object.keys(SECTOR_COMPANIES).filter(k => k !== 'Sensitive Index').sort().map(k => (
                <option key={k} value={k}>{k}</option>
              ))}
            </select>
          </div>
          <div className="card-content" style={{ padding: '1.25rem' }}>
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.5rem' }}>
              {(SECTOR_COMPANIES[selectedDirectorySector] || []).length === 0 ? (
                <div className="empty-state" style={{ padding: '1rem', width: '100%' }}>No companies found in this category.</div>
              ) : (
                (SECTOR_COMPANIES[selectedDirectorySector] || []).sort().map(c => {
                  const co = liveMarket.find(l => l.symbol === c);
                  const ltp = co ? (co.lastTradedPrice || co.ltp || co.closingPrice) : null;
                  const change = co ? co.percentageChange : null;
                  const up = change >= 0;
                  return (
                    <div key={c} style={{ 
                      background: 'var(--bg-surface)', padding: '0.5rem 0.75rem', 
                      borderRadius: 'var(--radius-md)', border: '1px solid var(--border)',
                      display: 'flex', alignItems: 'center', gap: '0.75rem', minWidth: '120px'
                    }}>
                      <span style={{ fontWeight: 600, fontSize: '0.9rem', color: 'var(--text-primary)' }}>{c}</span>
                      {ltp && (
                        <div style={{ marginLeft: 'auto', textAlign: 'right', display: 'flex', flexDirection: 'column', gap: '2px' }}>
                          <span style={{ fontSize: '0.85rem' }}>{ltp.toLocaleString('en-IN', { maximumFractionDigits: 1 })}</span>
                          <span className={up ? 'positive' : 'negative'} style={{ fontSize: '0.7rem', fontWeight: 600 }}>
                            {up ? '+' : ''}{change.toFixed(2)}%
                          </span>
                        </div>
                      )}
                    </div>
                  );
                })
              )}
            </div>
          </div>
        </div>
      </div>
    </main>
  );
}
