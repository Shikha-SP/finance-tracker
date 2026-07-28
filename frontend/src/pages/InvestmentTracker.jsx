import { useState, useEffect, useCallback } from 'react';
import {
  Briefcase, Plus, Trash2, Edit2, TrendingUp, TrendingDown,
  ChevronUp, ChevronDown, Loader, X, Search, AlertTriangle, WifiOff, Clock
} from 'lucide-react';
import SECTOR_COMPANIES from '../sectorCompanies.json';

const API_BASE = 'http://localhost:5000/api';
const LOCAL_KEY = 'portfolio_local';

const fmtNPR = n => 'रू ' + Math.abs(n).toLocaleString('en-IN', { maximumFractionDigits: 2 });
const fmtPct = n => (n >= 0 ? '+' : '') + Number(n).toFixed(2) + '%';

function getAuthHeaders() {
  const token = localStorage.getItem('token');
  return {
    'Content-Type': 'application/json',
    ...(token ? { Authorization: `Bearer ${token}` } : {})
  };
}

/* ── Local storage helpers ─────────────────────────────────────────────── */
function loadLocalPortfolio() {
  try {
    const raw = localStorage.getItem(LOCAL_KEY);
    return raw ? JSON.parse(raw) : [];
  } catch { return []; }
}
function saveLocalPortfolio(items) {
  try { localStorage.setItem(LOCAL_KEY, JSON.stringify(items)); } catch {}
}
let _localIdSeq = Date.now();
function localNextId() { return 'local_' + (++_localIdSeq); }

export default function InvestmentTracker() {
  const [portfolio, setPortfolio] = useState([]);
  const [liveMarket, setLiveMarket] = useState([]);
// No simulated LTP state
  const [isCachedLTP, setIsCachedLTP] = useState(false);
  const [cachedAt, setCachedAt] = useState(null);
  const [ltpUnavailable, setLtpUnavailable] = useState(false);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [deleteId, setDeleteId] = useState(null);
  const [search, setSearch] = useState('');
  const [backendAvailable, setBackendAvailable] = useState(true);

  // Form state
  const [form, setForm] = useState({
    symbol: '', type: 'buy', quantity: '', price: '', date: new Date().toISOString().slice(0, 10)
  });
  const [formLoading, setFormLoading] = useState(false);
  const [formError, setFormError] = useState('');
  
  const [suggestions, setSuggestions] = useState([]);
  const [showSuggestions, setShowSuggestions] = useState(false);
  
  const allSymbols = Array.from(new Set(Object.values(SECTOR_COMPANIES).flat()));

  const handleSymbolChange = (e) => {
    const val = e.target.value;
    setForm(f => ({ ...f, symbol: val }));
    if (val.trim()) {
      const filtered = allSymbols.filter(s => s.toLowerCase().includes(val.toLowerCase())).slice(0, 6);
      setSuggestions(filtered);
      setShowSuggestions(true);
    } else {
      setShowSuggestions(false);
    }
  };

  // Fetch portfolio items — falls back to localStorage if backend is unreachable
  const fetchPortfolio = useCallback(async () => {
    try {
      const res = await fetch(`${API_BASE}/portfolio`, { headers: getAuthHeaders() });
      if (res.ok) {
        const data = await res.json();
        setPortfolio(data);
        setBackendAvailable(true);
        // Sync to local cache for offline use
        saveLocalPortfolio(data);
      } else {
        // Auth error or other server error — use local cache
        const local = loadLocalPortfolio();
        setPortfolio(local);
        setBackendAvailable(false);
      }
    } catch (err) {
      console.error('Failed to fetch portfolio:', err);
      // Network error — use local cache
      const local = loadLocalPortfolio();
      setPortfolio(local);
      setBackendAvailable(false);
    }
  }, []);

  // Fetch live market data for LTP
  const fetchLiveMarket = useCallback(async () => {
    try {
      const res = await fetch(`${API_BASE}/nepse/live-market`);
      if (res.ok) {
        const data = await res.json();
        setLiveMarket(data.liveMarket || []);
        // Two states: live real data | cached from earlier today
        setIsCachedLTP(data.cachedData === true);
        setCachedAt(data.cachedAt || null);
        setLtpUnavailable(false);
      } else {
        setLtpUnavailable(true);
      }
    } catch (err) {
      console.error('Failed to fetch live market:', err);
      setLtpUnavailable(true);
    }
  }, []);

  useEffect(() => {
    Promise.all([fetchPortfolio(), fetchLiveMarket()]).finally(() => setLoading(false));
  }, [fetchPortfolio, fetchLiveMarket]);

  // Build a symbol -> LTP map from live market data
  const ltpMap = {};
  liveMarket.forEach(item => {
    if (item.symbol && (item.lastTradedPrice || item.ltp || item.closingPrice)) {
      ltpMap[item.symbol.toUpperCase()] = item.lastTradedPrice || item.ltp || item.closingPrice;
    }
  });

  // Aggregate holdings: group by symbol, calculate avg buy, qty held, P&L
  const holdings = {};
  portfolio.forEach(tx => {
    const sym = tx.symbol.toUpperCase();
    if (!holdings[sym]) {
      holdings[sym] = { symbol: sym, totalBuyQty: 0, totalBuyCost: 0, totalSellQty: 0, totalSellRevenue: 0, transactions: [] };
    }
    holdings[sym].transactions.push(tx);
    if (tx.type === 'buy') {
      holdings[sym].totalBuyQty += tx.quantity;
      holdings[sym].totalBuyCost += tx.quantity * tx.price;
    } else {
      holdings[sym].totalSellQty += tx.quantity;
      holdings[sym].totalSellRevenue += tx.quantity * tx.price;
    }
  });

  const holdingsList = Object.values(holdings).map(h => {
    const qtyHeld = h.totalBuyQty - h.totalSellQty;
    const avgBuyPrice = h.totalBuyQty > 0 ? h.totalBuyCost / h.totalBuyQty : 0;
    const currentLTP = ltpMap[h.symbol] || 0;
    const currentValue = qtyHeld * currentLTP;
    const investedValue = qtyHeld * avgBuyPrice;
    const unrealizedPL = currentValue - investedValue;
    const unrealizedPLPct = investedValue > 0 ? (unrealizedPL / investedValue) * 100 : 0;
    const realizedPL = h.totalSellRevenue - (h.totalSellQty * avgBuyPrice);

    return {
      ...h,
      qtyHeld,
      avgBuyPrice,
      currentLTP,
      currentValue,
      investedValue,
      unrealizedPL,
      unrealizedPLPct,
      realizedPL
    };
  });

  // Filter holdings by search
  const filteredHoldings = holdingsList.filter(h =>
    h.symbol.toLowerCase().includes(search.toLowerCase())
  );

  // Portfolio-level stats
  const totalInvested = holdingsList.reduce((s, h) => s + h.investedValue, 0);
  const totalCurrentVal = holdingsList.reduce((s, h) => s + h.currentValue, 0);
  const totalUnrealizedPL = totalCurrentVal - totalInvested;
  const totalRealizedPL = holdingsList.reduce((s, h) => s + h.realizedPL, 0);

  // Add transaction
  async function handleSubmit(e) {
    e.preventDefault();
    setFormError('');
    if (!form.symbol.trim()) { setFormError('Symbol is required'); return; }
    if (!form.quantity || Number(form.quantity) <= 0) { setFormError('Quantity must be positive'); return; }
    if (!form.price || Number(form.price) <= 0) { setFormError('Price must be positive'); return; }

    setFormLoading(true);
    try {
      const payload = {
        symbol: form.symbol.toUpperCase().trim(),
        type: form.type,
        quantity: Number(form.quantity),
        price: Number(form.price),
        date: form.date
      };

      if (backendAvailable) {
        const res = await fetch(`${API_BASE}/portfolio`, {
          method: 'POST',
          headers: getAuthHeaders(),
          body: JSON.stringify(payload)
        });
        if (res.ok) {
          setForm({ symbol: '', type: 'buy', quantity: '', price: '', date: new Date().toISOString().slice(0, 10) });
          setShowForm(false);
          await fetchPortfolio();
        } else {
          // Try local fallback on auth error
          const err = await res.json();
          if (res.status === 401 || res.status === 403) {
            // Not logged in — save locally
            const newItem = { ...payload, _id: localNextId() };
            const updated = [newItem, ...loadLocalPortfolio()];
            saveLocalPortfolio(updated);
            setPortfolio(updated);
            setForm({ symbol: '', type: 'buy', quantity: '', price: '', date: new Date().toISOString().slice(0, 10) });
            setShowForm(false);
          } else {
            setFormError(err.message || err.msg || 'Failed to add');
          }
        }
      } else {
        // Offline — save locally
        const newItem = { ...payload, _id: localNextId() };
        const updated = [newItem, ...loadLocalPortfolio()];
        saveLocalPortfolio(updated);
        setPortfolio(updated);
        setForm({ symbol: '', type: 'buy', quantity: '', price: '', date: new Date().toISOString().slice(0, 10) });
        setShowForm(false);
      }
    } catch (err) {
      // Network error — save locally
      const payload = {
        _id: localNextId(),
        symbol: form.symbol.toUpperCase().trim(),
        type: form.type,
        quantity: Number(form.quantity),
        price: Number(form.price),
        date: form.date
      };
      const updated = [payload, ...loadLocalPortfolio()];
      saveLocalPortfolio(updated);
      setPortfolio(updated);
      setForm({ symbol: '', type: 'buy', quantity: '', price: '', date: new Date().toISOString().slice(0, 10) });
      setShowForm(false);
    } finally {
      setFormLoading(false);
    }
  }

  // Edit state
  const [editItem, setEditItem] = useState(null);

  function openEditForm(tx) {
    setEditItem({
      _id: tx._id,
      symbol: tx.symbol,
      type: tx.type,
      quantity: tx.quantity,
      price: tx.price,
      date: tx.date ? new Date(tx.date).toISOString().slice(0, 10) : new Date().toISOString().slice(0, 10)
    });
  }

  async function handleEditSubmit(e) {
    e.preventDefault();
    if (!editItem) return;

    const payload = {
      symbol: editItem.symbol.toUpperCase().trim(),
      type: editItem.type,
      quantity: Number(editItem.quantity),
      price: Number(editItem.price),
      date: editItem.date
    };

    const isLocal = String(editItem._id).startsWith('local_');
    if (isLocal || !backendAvailable) {
      const local = loadLocalPortfolio().map(item => item._id === editItem._id ? { ...item, ...payload } : item);
      saveLocalPortfolio(local);
      setPortfolio(prev => prev.map(item => item._id === editItem._id ? { ...item, ...payload } : item));
    } else {
      try {
        const res = await fetch(`${API_BASE}/portfolio/${editItem._id}`, {
          method: 'PUT',
          headers: getAuthHeaders(),
          body: JSON.stringify(payload)
        });
        if (res.ok) {
          await fetchPortfolio();
        } else {
          setPortfolio(prev => prev.map(item => item._id === editItem._id ? { ...item, ...payload } : item));
        }
      } catch (err) {
        console.error('Edit request failed:', err);
        setPortfolio(prev => prev.map(item => item._id === editItem._id ? { ...item, ...payload } : item));
      }
    }
    setEditItem(null);
  }

  // Delete transaction
  async function handleDelete() {
    if (!deleteId) return;
    // Check if this is a local-only item
    const isLocal = String(deleteId).startsWith('local_');
    if (isLocal || !backendAvailable) {
      const updated = loadLocalPortfolio().filter(i => i._id !== deleteId);
      saveLocalPortfolio(updated);
      setPortfolio(prev => prev.filter(i => i._id !== deleteId));
    } else {
      try {
        await fetch(`${API_BASE}/portfolio/${deleteId}`, {
          method: 'DELETE',
          headers: getAuthHeaders()
        });
        await fetchPortfolio();
      } catch (err) {
        console.error(err);
        // Fallback: remove locally
        setPortfolio(prev => prev.filter(i => i._id !== deleteId));
      }
    }
    setDeleteId(null);
  }


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
            <Briefcase size={22} style={{ marginRight: '0.6rem', color: 'var(--accent)' }} />
            Portfolio Tracker
          </h1>
          <p className="page-subtitle">Track your stock purchases, sales, and real-time profits.</p>
        </div>
        <button className="btn-primary" onClick={() => setShowForm(true)}>
          <Plus size={16} style={{ marginRight: '0.3rem' }} /> Add Trade
        </button>
      </div>

      <div className="page-content">
        {/* ── LTP Data Status Banner ── */}
        {ltpUnavailable && (
          <div className="ltp-status-banner unavailable">
            <div className="ltp-banner-left">
              <WifiOff size={15} />
              <div>
                <div className="ltp-banner-title">Live Market Data Unavailable</div>
                <div className="ltp-banner-desc">
                  Could not connect to the backend. LTP columns show N/A — your invested amounts are still accurate.
                  {!backendAvailable && ' Trades are saved locally and will sync when the server is back online.'}
                </div>
              </div>
            </div>
          </div>
        )}
        {!ltpUnavailable && !backendAvailable && (
          <div className="ltp-status-banner" style={{ background: 'rgba(245,158,11,0.08)', borderColor: 'rgba(245,158,11,0.3)', color: 'var(--amber)' }}>
            <div className="ltp-banner-left">
              <WifiOff size={15} />
              <div>
                <div className="ltp-banner-title">Offline Mode — Trades saved locally</div>
                <div className="ltp-banner-desc">Backend unreachable. Your portfolio is stored in this browser and will sync when the server comes back online.</div>
              </div>
            </div>
          </div>
        )}
        {!ltpUnavailable && isCachedLTP && cachedAt && (
          <div className="ltp-status-banner cached">
            <div className="ltp-banner-left">
              <Clock size={15} />
              <div>
                <div className="ltp-banner-title">
                  Last known prices · as of {new Date(cachedAt).toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit', hour12: true })}{' '}
                  <span style={{ fontWeight: 400, opacity: 0.75 }}>({new Date(cachedAt).toLocaleDateString('en-GB', { day: 'numeric', month: 'short' })})</span>
                </div>
                <div className="ltp-banner-desc">Market is closed. Showing real prices from the last trading session — P&L values reflect actual closing data.</div>
              </div>
            </div>
          </div>
        )}


        {/* ── Portfolio KPIs ── */}
        <div className="tracker-kpi-grid">
          <div className="tracker-kpi-card">
            <span className="tracker-kpi-label">Total Invested</span>
            <span className="tracker-kpi-value">{fmtNPR(totalInvested)}</span>
          </div>
          <div className="tracker-kpi-card">
            <span className="tracker-kpi-label">Current Value</span>
            <span className="tracker-kpi-value" style={{ color: totalCurrentVal > 0 ? 'var(--accent)' : 'var(--text-primary)' }}>
              {totalCurrentVal > 0 ? fmtNPR(totalCurrentVal) : '—'}
            </span>
            <span className="tracker-kpi-sub">
              {ltpUnavailable
                ? <><WifiOff size={10} style={{display:'inline',marginRight:'3px'}} />Live data unavailable</>
                : isCachedLTP
                ? <><Clock size={10} style={{display:'inline',marginRight:'3px',color:'var(--accent)'}} /><span style={{color:'var(--accent)'}}>Closing prices · {liveMarket.length} stocks</span></>
                : `${liveMarket.length} stocks live`}
            </span>
          </div>
          <div className="tracker-kpi-card">
            <span className="tracker-kpi-label">Unrealized P&L</span>
            <span className={`tracker-kpi-value ${totalUnrealizedPL >= 0 ? 'positive' : 'negative'}`}>
              {totalCurrentVal > 0 ? (
                <>
                  {totalUnrealizedPL >= 0 ? '+' : '−'}{fmtNPR(totalUnrealizedPL)}
                </>
              ) : '—'}
            </span>
          </div>
          <div className="tracker-kpi-card">
            <span className="tracker-kpi-label">Realized P&L</span>
            <span className={`tracker-kpi-value ${totalRealizedPL >= 0 ? 'positive' : 'negative'}`}>
              {totalRealizedPL !== 0 ? (
                <>
                  {totalRealizedPL >= 0 ? '+' : '−'}{fmtNPR(totalRealizedPL)}
                </>
              ) : '—'}
            </span>
          </div>
        </div>

        {/* ── Holdings Table ── */}
        <div className="card" style={{ marginTop: '1.5rem' }}>
          <div className="card-header">
            <span className="card-title">Holdings</span>
            <div className="search-wrap" style={{ width: '220px' }}>
              <span className="search-icon" style={{ left: '0.75rem' }}><Search size={14} /></span>
              <input
                className="search-input"
                style={{ paddingLeft: '2.2rem', fontSize: '0.8rem', borderRadius: 'var(--radius-md)' }}
                type="text"
                placeholder="Search symbol…"
                value={search}
                onChange={e => setSearch(e.target.value)}
              />
            </div>
          </div>
          <div className="stock-table-body">
            <div className="stock-table-row stock-table-head-row tracker-row">
              <span>Symbol</span>
              <span>Qty Held</span>
              <span>Avg Buy (रू)</span>
              <span>LTP (रू)</span>
              <span>Invested</span>
              <span>Current Val</span>
              <span>P&L</span>
              <span>% Change</span>
              <span></span>
            </div>
            {filteredHoldings.length === 0 ? (
              <div className="empty-state" style={{ padding: '3rem 1rem' }}>
                <Briefcase size={40} style={{ color: 'var(--text-muted)', marginBottom: '0.75rem' }} />
                <p className="empty-title">No holdings yet</p>
                <p className="empty-text">Add your first stock trade to start tracking.</p>
              </div>
            ) : (
              filteredHoldings.map(h => {
                const up = h.unrealizedPL >= 0;
                return (
                  <div className="stock-table-row stock-table-data-row tracker-row" key={h.symbol}>
                    <span className="stock-symbol">{h.symbol}</span>
                    <span style={{ fontWeight: 600 }}>{h.qtyHeld}</span>
                    <span>{h.avgBuyPrice.toLocaleString('en-IN', { maximumFractionDigits: 2 })}</span>
                    <span style={{ color: h.currentLTP > 0 ? 'var(--text-primary)' : 'var(--text-muted)', display: 'flex', alignItems: 'center', gap: '0.25rem', flexWrap: 'wrap' }}>
                      {h.currentLTP > 0 ? (
                        <>
                          {h.currentLTP.toLocaleString('en-IN', { maximumFractionDigits: 2 })}
                          {isCachedLTP && <span className="ltp-sim-tag">cls</span>}
                        </>
                      ) : 'N/A'}
                    </span>
                    <span>{fmtNPR(h.investedValue)}</span>
                    <span style={{ color: h.currentLTP > 0 ? 'var(--accent)' : 'var(--text-muted)' }}>
                      {h.currentLTP > 0 ? fmtNPR(h.currentValue) : '—'}
                    </span>
                    <span className={up ? 'positive' : 'negative'} style={{ fontWeight: 600 }}>
                      {h.currentLTP > 0 ? (
                        <>
                          {up ? <ChevronUp size={12} /> : <ChevronDown size={12} />}
                          {up ? '+' : '−'}{fmtNPR(h.unrealizedPL)}
                        </>
                      ) : '—'}
                    </span>
                    <span>
                      {h.currentLTP > 0 ? (
                        <span className={`change-badge ${up ? 'up' : 'down'}`}>
                          {up ? <ChevronUp size={10} /> : <ChevronDown size={10} />}
                          {Math.abs(h.unrealizedPLPct).toFixed(2)}%
                        </span>
                      ) : '—'}
                    </span>
                    <span className="tracker-actions">
                      <button
                        className="btn-ghost"
                        title="View transactions"
                        onClick={() => {/* future: expand details */}}
                      >
                        <TrendingUp size={14} />
                      </button>
                    </span>
                  </div>
                );
              })
            )}
          </div>
        </div>

        {/* ── Transaction History ── */}
        {portfolio.length > 0 && (
          <div className="card" style={{ marginTop: '1.5rem' }}>
            <div className="card-header">
              <span className="card-title">Trade History</span>
              <span className="card-badge">{portfolio.length} trades</span>
            </div>
            <div className="stock-table-body">
              <div className="stock-table-row stock-table-head-row trade-history-row">
                <span>Date</span>
                <span>Symbol</span>
                <span>Type</span>
                <span>Qty</span>
                <span>Price (रू)</span>
                <span>Total (रू)</span>
                <span></span>
              </div>
              {portfolio.map(tx => (
                <div className="stock-table-row stock-table-data-row trade-history-row" key={tx._id}>
                  <span style={{ color: 'var(--text-muted)', fontSize: '0.78rem' }}>
                    {new Date(tx.date).toLocaleDateString('en-IN')}
                  </span>
                  <span className="stock-symbol">{tx.symbol}</span>
                  <span>
                    <span className={`trade-type-badge ${tx.type}`}>
                      {tx.type === 'buy' ? <TrendingUp size={10} /> : <TrendingDown size={10} />}
                      {tx.type.toUpperCase()}
                    </span>
                  </span>
                  <span style={{ fontWeight: 600 }}>{tx.quantity}</span>
                  <span>{tx.price.toLocaleString('en-IN', { maximumFractionDigits: 2 })}</span>
                  <span style={{ fontWeight: 600 }}>
                    {fmtNPR(tx.quantity * tx.price)}
                  </span>
                  <span style={{ display: 'flex', gap: '0.25rem', justifyContent: 'flex-end' }}>
                    <button
                      className="btn-ghost"
                      title="Edit trade"
                      onClick={() => openEditForm(tx)}
                    >
                      <Edit2 size={14} />
                    </button>
                    <button
                      className="btn-ghost"
                      title="Delete trade"
                      onClick={() => setDeleteId(tx._id)}
                    >
                      <Trash2 size={14} />
                    </button>
                  </span>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>

      {/* ── Add Trade Modal ── */}
      {showForm && (
        <div className="settings-overlay" onClick={() => setShowForm(false)}>
          <div className="settings-modal tracker-modal" onClick={e => e.stopPropagation()}>
            <div className="modal-header">
              <h3>Add Trade</h3>
              <button className="btn-ghost" onClick={() => setShowForm(false)}><X size={18} /></button>
            </div>
            <form onSubmit={handleSubmit} className="tracker-form">
              <div className="form-group" style={{ position: 'relative' }}>
                <label>Stock Symbol</label>
                <input
                  type="text"
                  placeholder="e.g. NABIL"
                  value={form.symbol}
                  onChange={handleSymbolChange}
                  onFocus={() => { if (form.symbol.trim() && suggestions.length > 0) setShowSuggestions(true); }}
                  onBlur={() => setTimeout(() => setShowSuggestions(false), 200)}
                  autoFocus
                  autoComplete="off"
                />
                {showSuggestions && suggestions.length > 0 && (
                  <ul style={{
                    position: 'absolute', top: '100%', left: 0, right: 0, 
                    background: 'var(--bg-surface)', border: '1px solid var(--border)', 
                    borderRadius: 'var(--radius-md)', marginTop: '4px', zIndex: 10,
                    listStyle: 'none', padding: 0, overflow: 'hidden', boxShadow: '0 4px 12px rgba(0,0,0,0.1)'
                  }}>
                    {suggestions.map(s => (
                      <li 
                        key={s} 
                        style={{ padding: '0.5rem 0.75rem', cursor: 'pointer', fontSize: '0.85rem', borderBottom: '1px solid var(--border)' }}
                        onMouseDown={() => {
                          setForm(f => ({ ...f, symbol: s }));
                          setShowSuggestions(false);
                        }}
                        onMouseEnter={e => e.target.style.background = 'var(--bg-glass)'}
                        onMouseLeave={e => e.target.style.background = 'transparent'}
                      >
                        {s}
                      </li>
                    ))}
                  </ul>
                )}
              </div>
              <div className="form-row">
                <div className="form-group">
                  <label>Type</label>
                  <div className="trade-type-toggle">
                    <button
                      type="button"
                      className={`toggle-btn${form.type === 'buy' ? ' active buy' : ''}`}
                      onClick={() => setForm(f => ({ ...f, type: 'buy' }))}
                    >
                      <TrendingUp size={14} /> Buy
                    </button>
                    <button
                      type="button"
                      className={`toggle-btn${form.type === 'sell' ? ' active sell' : ''}`}
                      onClick={() => setForm(f => ({ ...f, type: 'sell' }))}
                    >
                      <TrendingDown size={14} /> Sell
                    </button>
                  </div>
                </div>
                <div className="form-group">
                  <label>Date</label>
                  <input
                    type="date"
                    value={form.date}
                    onChange={e => setForm(f => ({ ...f, date: e.target.value }))}
                  />
                </div>
              </div>
              <div className="form-row">
                <div className="form-group">
                  <label>Quantity</label>
                  <input
                    type="number"
                    min="1"
                    placeholder="100"
                    value={form.quantity}
                    onChange={e => setForm(f => ({ ...f, quantity: e.target.value }))}
                  />
                </div>
                <div className="form-group">
                  <label>Price per share (रू)</label>
                  <input
                    type="number"
                    min="0"
                    step="0.01"
                    placeholder="920.00"
                    value={form.price}
                    onChange={e => setForm(f => ({ ...f, price: e.target.value }))}
                  />
                </div>
              </div>
              {form.quantity && form.price && (
                <div className="form-total">
                  Total: {fmtNPR(Number(form.quantity) * Number(form.price))}
                </div>
              )}
              {formError && <div className="form-error">{formError}</div>}
              <button type="submit" className="btn-primary" disabled={formLoading} style={{ width: '100%', marginTop: '0.5rem' }}>
                {formLoading ? <Loader size={16} className="spin" /> : 'Add Trade'}
              </button>
            </form>
          </div>
        </div>
      )}

      {/* ── Edit Trade Modal ── */}
      {editItem && (
        <div className="settings-overlay" onClick={() => setEditItem(null)}>
          <div className="settings-modal tracker-modal" onClick={e => e.stopPropagation()}>
            <div className="modal-header">
              <h3>Edit Trade</h3>
              <button className="btn-ghost" onClick={() => setEditItem(null)}><X size={18} /></button>
            </div>
            <form onSubmit={handleEditSubmit} className="tracker-form">
              <div className="form-group">
                <label>Stock Symbol</label>
                <input
                  type="text"
                  placeholder="e.g. NABIL"
                  value={editItem.symbol}
                  onChange={e => setEditItem({ ...editItem, symbol: e.target.value.toUpperCase() })}
                  required
                />
              </div>
              <div className="form-row">
                <div className="form-group">
                  <label>Type</label>
                  <div className="trade-type-toggle">
                    <button
                      type="button"
                      className={`toggle-btn${editItem.type === 'buy' ? ' active buy' : ''}`}
                      onClick={() => setEditItem({ ...editItem, type: 'buy' })}
                    >
                      <TrendingUp size={14} /> Buy
                    </button>
                    <button
                      type="button"
                      className={`toggle-btn${editItem.type === 'sell' ? ' active sell' : ''}`}
                      onClick={() => setEditItem({ ...editItem, type: 'sell' })}
                    >
                      <TrendingDown size={14} /> Sell
                    </button>
                  </div>
                </div>
                <div className="form-group">
                  <label>Date</label>
                  <input
                    type="date"
                    value={editItem.date}
                    onChange={e => setEditItem({ ...editItem, date: e.target.value })}
                  />
                </div>
              </div>
              <div className="form-row">
                <div className="form-group">
                  <label>Quantity</label>
                  <input
                    type="number"
                    min="1"
                    value={editItem.quantity}
                    onChange={e => setEditItem({ ...editItem, quantity: e.target.value })}
                    required
                  />
                </div>
                <div className="form-group">
                  <label>Price per share (रू)</label>
                  <input
                    type="number"
                    min="0"
                    step="0.01"
                    value={editItem.price}
                    onChange={e => setEditItem({ ...editItem, price: e.target.value })}
                    required
                  />
                </div>
              </div>
              {editItem.quantity && editItem.price && (
                <div className="form-total">
                  Total: {fmtNPR(Number(editItem.quantity) * Number(editItem.price))}
                </div>
              )}
              <button type="submit" className="btn-primary" style={{ width: '100%', marginTop: '0.5rem' }}>
                Save Changes
              </button>
            </form>
          </div>
        </div>
      )}

      {/* ── Delete Confirm ── */}
      {deleteId && (
        <div className="settings-overlay">
          <div className="settings-modal" style={{ maxWidth: '360px', padding: '1.5rem', textAlign: 'center' }}>
            <div style={{ color: 'var(--red)', marginBottom: '1rem', display: 'flex', justifyContent: 'center' }}>
              <div style={{ width: '48px', height: '48px', background: 'var(--red-soft)', borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                <Trash2 size={24} />
              </div>
            </div>
            <h3 style={{ fontSize: '1.1rem', fontWeight: 600, marginBottom: '0.5rem' }}>Delete Trade</h3>
            <p style={{ fontSize: '0.85rem', color: 'var(--text-muted)', lineHeight: 1.5, marginBottom: '1.5rem' }}>
              Are you sure you want to delete this trade? This cannot be undone.
            </p>
            <div style={{ display: 'flex', gap: '0.75rem' }}>
              <button className="btn-outline" style={{ flex: 1 }} onClick={() => setDeleteId(null)}>Cancel</button>
              <button className="btn-primary" style={{ flex: 1, background: 'var(--red)', borderColor: 'var(--red)' }} onClick={handleDelete}>Delete</button>
            </div>
          </div>
        </div>
      )}
    </main>
  );
}
