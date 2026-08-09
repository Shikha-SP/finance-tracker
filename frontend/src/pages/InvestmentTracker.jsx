import { useState, useEffect, useCallback, useRef, useMemo } from 'react';
import {
  Briefcase, Plus, Trash2, Edit2, TrendingUp, TrendingDown,
  ChevronUp, ChevronDown, Loader, X, Search, WifiOff, Clock, Activity,
  Gauge, ShieldCheck, Target, Layers, BarChart3, ArrowRight, LineChart,
  Sparkles, User, BookOpen, CheckCircle2, MinusCircle, AlertTriangle
} from 'lucide-react';
import SECTOR_COMPANIES from '../sectorCompanies.json';
import RegimeBanner from '../lib/regime';
import TrustCheck from '../components/TrustCheck';
import TradeJournal from '../components/TradeJournal';

const API_BASE = '/api';
const LOCAL_KEY = 'portfolio_local';

const fmtNPR = n => 'रू ' + Math.abs(n).toLocaleString('en-IN', { maximumFractionDigits: 2 });
const fmtNPRk = n => {
  if (n >= 1e9) return 'रू ' + (n / 1e9).toFixed(2) + 'B';
  if (n >= 1e6) return 'रू ' + (n / 1e6).toFixed(2) + 'M';
  if (n >= 1e3) return 'रू ' + (n / 1e3).toFixed(1) + 'K';
  return fmtNPR(n);
};
const fmtDay = iso => {
  if (!iso) return '';
  const m = String(iso).match(/^(\d{4})-(\d{2})-(\d{2})/);
  if (!m) return iso;
  return new Date(Number(m[1]), Number(m[2]) - 1, Number(m[3])).toLocaleDateString('en-GB', { day: 'numeric', month: 'short' });
};
const ratingColor = v => (v === 'STRONG BUY' || v === 'BUY') ? 'var(--green)' : v === 'HOLD' ? '#f59e0b' : v === 'SELL' ? '#f97316' : '#ef4444';

/* ── Long-term outlook derived from the per-stock AI analysis ────────────── */
function longTermOutlook(ai) {
  if (!ai) return null;
  const r = ai.investmentRating || {};
  const tp = ai.trendProjection;
  const sm = ai.sectorMomentum;
  const f = ai.fundamentals || {};
  const ratingScore = typeof r.score === 'number' ? r.score : null;
  const upside = typeof ai.upsideScore === 'number' ? ai.upsideScore : null;
  const safety = typeof ai.safetyScore === 'number' ? ai.safetyScore : null;

  const base = (ratingScore ?? 50) * 0.5 + (upside ?? 50) * 0.3 + (safety ?? 50) * 0.2;
  let adj = 0;
  if (tp) adj += tp.direction === 'UP' ? (tp.trendQuality === 'strong' ? 6 : 3) : tp.direction === 'DOWN' ? -6 : 0;
  if (sm) adj += sm.trend === 'STRENGTHENING' ? 4 : sm.trend === 'WEAKENING' ? -4 : 0;
  if (f) {
    if (typeof f.dividendYield === 'number' && f.dividendYield > 3) adj += 3;
    if (typeof f.roe === 'number' && f.roe > 12) adj += 2;
    if (typeof f.peRatio === 'number' && f.peRatio > 0 && f.peRatio < 15) adj += 2;
  }
  const score = Math.max(0, Math.min(100, Math.round(base + adj)));

  const label = score >= 70 ? 'Strong' : score >= 55 ? 'Decent' : score >= 45 ? 'Mixed' : 'Weak';

  const bullets = [];
  if (tp) bullets.push(`Trend ${tp.direction}: ${tp.expectedMovePct > 0 ? '+' : ''}${tp.expectedMovePct}% projected over ${tp.horizonDays} sessions (${tp.trendQuality})`);
  if (sm) bullets.push(`Sector momentum ${sm.trend} (20d ${sm.ret20 > 0 ? '+' : ''}${sm.ret20}%)`);
  if (typeof f.peRatio === 'number') bullets.push(`P/E ${f.peRatio}x`);
  if (typeof f.roe === 'number') bullets.push(`ROE ${f.roe}%`);
  if (typeof f.dividendYield === 'number') bullets.push(`Dividend yield ${f.dividendYield}%`);
  if (ratingScore != null) bullets.push(`AI rating ${r.verdict} (${ratingScore}/100)`);

  return { score, label, bullets, upside, safety };
}

/* ── Equity curve: portfolio value over time from real trades + closes ───── */
function buildEquityCurve(portfolio, historyBySym) {
  const daySet = new Set();
  Object.values(historyBySym).forEach(recs => recs.forEach(r => daySet.add(r.timestamp)));
  if (!daySet.size) return [];
  const days = [...daySet].sort((a, b) => a - b);

  const trades = [];
  portfolio.forEach(tx => {
    const sym = String(tx.symbol || '').toUpperCase();
    const ts = Math.floor(new Date(`${String(tx.date).slice(0, 10)}T00:00:00Z`).getTime() / 1000);
    if (!sym || isNaN(ts)) return;
    const delta = tx.type === 'buy' ? Number(tx.quantity) || 0 : -(Number(tx.quantity) || 0);
    trades.push({ ts, sym, delta });
  });
  trades.sort((a, b) => a.ts - b.ts);

  const closesBySym = {};
  Object.keys(historyBySym).forEach(sym => {
    closesBySym[sym] = [...historyBySym[sym]].filter(r => r.close != null).sort((a, b) => a.timestamp - b.timestamp);
  });

  const ptr = {};
  Object.keys(closesBySym).forEach(s => { ptr[s] = -1; });
  const qty = {};

  const points = [];
  let ti = 0;
  for (let i = 0; i < days.length; i++) {
    const d = days[i];
    while (ti < trades.length && trades[ti].ts <= d) {
      const t = trades[ti++];
      qty[t.sym] = (qty[t.sym] || 0) + t.delta;
    }
    let value = 0;
    let active = false;
    Object.keys(closesBySym).forEach(sym => {
      const recs = closesBySym[sym];
      while (ptr[sym] + 1 < recs.length && recs[ptr[sym] + 1].timestamp <= d) ptr[sym]++;
      const q = qty[sym] || 0;
      if (q > 0 && ptr[sym] >= 0) {
        active = true;
        value += q * recs[ptr[sym]].close;
      }
    });
    if (active) points.push({ timestamp: d, value });
  }
  return points;
}

function getAuthHeaders() {
  const token = localStorage.getItem('token');
  return {
    'Content-Type': 'application/json',
    ...(token ? { Authorization: `Bearer ${token}` } : {})
  };
}

const fmtR = v => (typeof v === 'number' ? v.toLocaleString('en-IN', { maximumFractionDigits: 2 }) : v);

/* ── Sell-signal logic ──────────────────────────────────────────────────────
   Mechanical triggers based on the per-stock analysis (RSI, support/resistance,
   trend vs 20-day average, AI rating) plus the position's own P&L. Order matters:
   strongest reason wins. */
function buildSellSignal(ai, holding) {
  const price = ai?.currentPrice || holding.currentLTP;
  const rsi = ai?.technicalIndicators?.rsi;
  const sma20 = ai?.technicalIndicators?.sma20;
  const sr = ai?.supportResistance || {};
  const rating = ai?.investmentRating?.verdict;
  const score = ai?.investmentRating?.score;
  const positionPct = typeof sr.positionPct === 'number' ? sr.positionPct : null;
  const atResistance = sr.nearResistance === true;
  const atSupport = sr.nearSupport === true;
  const plPct = holding.unrealizedPLPct;

  const brokeSupport = price > 0 && sr.support > 0 && price < sr.support;
  const belowSma20 = price > 0 && sma20 > 0 && price < sma20;

  const reasons = [];

  if (brokeSupport) reasons.push(`Price ${fmtR(price)} broke support ${fmtR(sr.support)} — stop level hit`);
  if (typeof rsi === 'number' && rsi >= 75) reasons.push(`Very overbought (RSI ${rsi})`);
  if (atResistance && typeof rsi === 'number' && rsi >= 68) reasons.push(`Overbought right at resistance ${fmtR(sr.resistance)}`);
  if (belowSma20 && typeof rsi === 'number' && rsi <= 40) reasons.push('Falling below its 20-day average on weak momentum');
  if (rating === 'SELL' || rating === 'STRONG SELL') reasons.push(`AI rating ${rating} (${score ?? '—'}/100)`);

  if (reasons.length) {
    return { level: 'sell', label: 'Sell', reason: reasons.join(' · ') };
  }

  if (atResistance && plPct >= 5) {
    return { level: 'trim', label: 'Trim', reason: `At resistance ${fmtR(sr.resistance)} while up ${plPct.toFixed(1)}% — bank some profit` };
  }
  if (typeof rsi === 'number' && rsi >= 68 && plPct >= 10) {
    return { level: 'trim', label: 'Trim', reason: `Overbought (RSI ${rsi}) and up ${plPct.toFixed(1)}% — take some profit` };
  }
  if (typeof positionPct === 'number' && positionPct >= 85) {
    return { level: 'trim', label: 'Trim', reason: `${positionPct.toFixed(0)}% into its support/resistance range — little upside left` };
  }

  if (typeof rsi === 'number' && rsi >= 65) {
    return { level: 'watch', label: 'Watch', reason: `Getting overbought (RSI ${rsi})` };
  }
  if (typeof positionPct === 'number' && positionPct >= 70) {
    return { level: 'watch', label: 'Watch', reason: `${positionPct.toFixed(0)}% into its support/resistance range` };
  }
  if (atResistance) {
    return { level: 'watch', label: 'Watch', reason: `Sitting near resistance ${fmtR(sr.resistance)}` };
  }
  if (belowSma20) {
    return { level: 'watch', label: 'Watch', reason: 'Trading below its 20-day average — keep an eye on it' };
  }

  return { level: 'hold', label: 'Hold', reason: rating ? `AI rating ${rating} — no sell signal` : 'No sell signal' };
}

/* ── Local storage helpers ─────────────────────────────────────────────── */
function loadLocalPortfolio() {
  try {
    const raw = localStorage.getItem(LOCAL_KEY);
    return raw ? JSON.parse(raw) : [];
  } catch {
    return [];
  }
}
function saveLocalPortfolio(items) {
  try {
    localStorage.setItem(LOCAL_KEY, JSON.stringify(items));
  } catch {
    /* ignore local cache write failures */
  }
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

  // Sell-signal analysis state
  const [regimeData, setRegimeData] = useState(null);
  const [signalMap, setSignalMap] = useState({});
  const [signalLoading, setSignalLoading] = useState(false);
  const signalsFetched = useRef({});

  // Equity curve + detail drawer state
  const [equityCurve, setEquityCurve] = useState([]);
  const [nepseSeries, setNepseSeries] = useState([]);
  const [equityLoading, setEquityLoading] = useState(false);
  const [drawerSymbol, setDrawerSymbol] = useState(null);
  const [showTrust, setShowTrust] = useState(false);

  // Form state
  const [form, setForm] = useState({
    symbol: '', type: 'buy', quantity: '', price: '', date: new Date().toISOString().slice(0, 10), source: 'own'
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
    } catch {
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
    } catch {
      setLtpUnavailable(true);
    }
  }, []);

  useEffect(() => {
    const timer = window.setTimeout(() => {
      void Promise.all([fetchPortfolio(), fetchLiveMarket()])
        .finally(() => setLoading(false));
    }, 0);

    return () => window.clearTimeout(timer);
  }, [fetchPortfolio, fetchLiveMarket]);

  // Fetch the current market regime (shared with the screener)
  useEffect(() => {
    fetch(`${API_BASE}/ai/market-regime`)
      .then(r => (r.ok ? r.json() : null))
      .then(d => { if (d && !d.offline) setRegimeData(d); })
      .catch(() => {});
  }, []);

  // Snapshot what the app said about a symbol at the time of a trade (best-effort)
  const fetchAppSnapshot = useCallback(async (symbol) => {
    try {
      const res = await fetch(`${API_BASE}/ai/analyze/${encodeURIComponent(symbol)}`, { headers: getAuthHeaders() });
      if (!res.ok) return null;
      const d = await res.json();
      if (!d || d.offline) return null;
      const sr = d.supportResistance || {};
      return {
        verdict: d.investmentRating?.verdict ?? null,
        score: typeof d.investmentRating?.score === 'number' ? d.investmentRating.score : null,
        rsi: d.technicals?.rsi ?? null,
        support: typeof sr.support === 'number' ? sr.support : null,
        resistance: typeof sr.resistance === 'number' ? sr.resistance : null,
        nearSupport: !!sr.nearSupport,
        nearResistance: !!sr.nearResistance,
        positionPct: typeof sr.positionPct === 'number' ? sr.positionPct : null,
        asOf: d.asOf || null,
      };
    } catch {
      return null;
    }
  }, []);

  // Fetch per-holding analysis and derive sell signals whenever holdings change
  useEffect(() => {
    if (!portfolio.length) {
      setSignalMap({});
      return;
    }

    const netQty = {};
    portfolio.forEach(tx => {
      const sym = String(tx.symbol || '').toUpperCase();
      if (!sym) return;
      netQty[sym] = (netQty[sym] || 0) + (tx.type === 'buy' ? Number(tx.quantity) || 0 : -(Number(tx.quantity) || 0));
    });

    const held = new Set(Object.entries(netQty).filter(([, q]) => q > 0).map(([s]) => s));
    Object.keys(signalsFetched.current).forEach(s => { if (!held.has(s)) delete signalsFetched.current[s]; });

    const syms = [...held].filter(s => !signalsFetched.current[s]);
    if (!syms.length) return;

    setSignalLoading(true);
    Promise.allSettled(
      syms.map(sym =>
        fetch(`${API_BASE}/ai/analyze/${encodeURIComponent(sym)}`, { headers: getAuthHeaders() })
          .then(r => (r.ok ? r.json() : Promise.reject(new Error(`HTTP ${r.status}`))))
      )
    ).then(results => {
      const next = {};
      results.forEach((res, i) => {
        const sym = syms[i];
        signalsFetched.current[sym] = true;
        if (res.status === 'fulfilled' && res.value && !res.value.offline &&
            String(res.value.symbol || '').toUpperCase() === sym) {
          next[sym] = res.value;
        }
      });
      if (Object.keys(next).length) setSignalMap(prev => ({ ...prev, ...next }));
      setSignalLoading(false);
    }).catch(() => setSignalLoading(false));
  }, [portfolio]);

  // Build the equity curve: fetch real daily closes per held symbol, then
  // value the portfolio (from actual trades) on each trading day.
  useEffect(() => {
    if (!portfolio.length) {
      setEquityCurve([]);
      setEquityLoading(false);
      return;
    }

    const netQty = {};
    portfolio.forEach(tx => {
      const sym = String(tx.symbol || '').toUpperCase();
      if (!sym) return;
      netQty[sym] = (netQty[sym] || 0) + (tx.type === 'buy' ? Number(tx.quantity) || 0 : -(Number(tx.quantity) || 0));
    });
    const syms = Object.keys(netQty).filter(s => netQty[s] > 0);
    if (!syms.length) {
      setEquityCurve([]);
      setEquityLoading(false);
      return;
    }

    const firstTradeTs = portfolio.reduce((m, tx) => {
      const ts = Math.floor(new Date(`${String(tx.date).slice(0, 10)}T00:00:00Z`).getTime() / 1000);
      return Number.isFinite(ts) ? Math.min(m, ts) : m;
    }, Math.floor(Date.now() / 1000));
    const from = Math.max(0, firstTradeTs - 10 * 24 * 3600);
    const to = Math.floor(Date.now() / 1000);

    let active = true;
    setEquityLoading(true);
    const historyJobs = syms.map(sym =>
      fetch(`${API_BASE}/nepse/history/${encodeURIComponent(sym)}?from=${from}&to=${to}&resolution=1D`)
        .then(r => (r.ok ? r.json() : Promise.reject(new Error(`HTTP ${r.status}`))))
    );
    // Also pull the NEPSE index over the same window for a market-relative view.
    historyJobs.push(
      fetch(`${API_BASE}/nepse/history/NEPSE?from=${from}&to=${to}&resolution=1D`)
        .then(r => (r.ok ? r.json() : Promise.reject(new Error(`HTTP ${r.status}`))))
    );
    Promise.allSettled(historyJobs).then(results => {
      if (!active) return;
      const historyBySym = {};
      results.slice(0, syms.length).forEach((res, i) => {
        if (res.status === 'fulfilled' && Array.isArray(res.value)) historyBySym[syms[i]] = res.value;
      });
      const idxRes = results[syms.length];
      setNepseSeries(
        idxRes.status === 'fulfilled' && Array.isArray(idxRes.value)
          ? [...idxRes.value].filter(r => r.close != null).sort((a, b) => a.timestamp - b.timestamp)
          : []
      );
      setEquityCurve(buildEquityCurve(portfolio, historyBySym));
      setEquityLoading(false);
    }).catch(() => {
      if (active) setEquityLoading(false);
    });
    return () => { active = false; };
  }, [portfolio]);

  // Ensure the detail drawer has full AI analysis for its symbol
  useEffect(() => {
    if (!drawerSymbol || signalMap[drawerSymbol]) return;
    let active = true;
    fetch(`${API_BASE}/ai/analyze/${encodeURIComponent(drawerSymbol)}`, { headers: getAuthHeaders() })
      .then(r => (r.ok ? r.json() : null))
      .then(d => {
        if (active && d && !d.offline && String(d.symbol || '').toUpperCase() === drawerSymbol) {
          setSignalMap(prev => ({ ...prev, [drawerSymbol]: d }));
        }
      })
      .catch(() => {});
    return () => { active = false; };
  }, [drawerSymbol, signalMap]);

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

  // Helper function for NEPSE Brokerage & Charges (0.36% avg + NPR 25 DP fee + 0.015% SEBON fee)
  const calcBuyCharges = (amount) => {
    if (amount <= 0) return 0;
    let comm;
    if (amount <= 50000) comm = Math.max(10, amount * 0.0040);
    else if (amount <= 500000) comm = amount * 0.0037;
    else if (amount <= 2000000) comm = amount * 0.0034;
    else if (amount <= 10000000) comm = amount * 0.0030;
    else comm = amount * 0.0027;
    const sebon = amount * 0.00015;
    const dpFee = 25;
    return comm + sebon + dpFee;
  };

  const holdingsList = Object.values(holdings).map(h => {
    const qtyHeld = h.totalBuyQty - h.totalSellQty;
    
    // WACC Calculation including buy charges
    const totalBuyCostWithCharges = h.totalBuyCost + calcBuyCharges(h.totalBuyCost);
    const waccPrice = h.totalBuyQty > 0 ? totalBuyCostWithCharges / h.totalBuyQty : 0;
    
    const avgBuyPrice = h.totalBuyQty > 0 ? h.totalBuyCost / h.totalBuyQty : 0;
    const currentLTP = ltpMap[h.symbol] || 0;
    const currentValue = qtyHeld * currentLTP;
    const investedValue = qtyHeld * waccPrice;
    
    // Sell charges deduction on current liquidation value
    const estSellCharges = calcBuyCharges(currentValue);
    const netCurrentValue = Math.max(0, currentValue - estSellCharges);
    
    const unrealizedPL = netCurrentValue - investedValue;
    const unrealizedPLPct = investedValue > 0 ? (unrealizedPL / investedValue) * 100 : 0;
    const realizedPL = h.totalSellRevenue - (h.totalSellQty * waccPrice);

    const signal = qtyHeld > 0 && signalMap[h.symbol]
      ? buildSellSignal(signalMap[h.symbol], { currentLTP, unrealizedPLPct })
      : null;

    return {
      ...h,
      qtyHeld,
      avgBuyPrice,
      waccPrice,
      currentLTP,
      currentValue,
      netCurrentValue,
      investedValue,
      unrealizedPL,
      unrealizedPLPct,
      realizedPL,
      signal
    };
  });

  // Filter holdings by search
  const filteredHoldings = holdingsList.filter(h =>
    h.symbol.toLowerCase().includes(search.toLowerCase())
  );

  // Sell-signal summary
  const sellCount = holdingsList.filter(h => h.signal?.level === 'sell').length;
  const trimCount = holdingsList.filter(h => h.signal?.level === 'trim').length;
  const watchCount = holdingsList.filter(h => h.signal?.level === 'watch').length;
  const holdCount = holdingsList.filter(h => h.signal?.level === 'hold').length;
  const hasSignals = sellCount + trimCount + watchCount + holdCount > 0;

  // Portfolio-level stats
  const totalInvested = holdingsList.reduce((s, h) => s + h.investedValue, 0);
  const totalCurrentVal = holdingsList.reduce((s, h) => s + h.currentValue, 0);
  const totalUnrealizedPL = totalCurrentVal - totalInvested;
  const totalRealizedPL = holdingsList.reduce((s, h) => s + h.realizedPL, 0);

  // Equity curve display stats
  const eqLast = equityCurve.length ? equityCurve[equityCurve.length - 1] : null;
  const eqFirst = equityCurve.length ? equityCurve[0] : null;
  const eqReturnPct = eqLast && eqFirst && eqFirst.value > 0
    ? ((eqLast.value - eqFirst.value) / eqFirst.value) * 100
    : null;
  const eqUp = eqReturnPct != null && eqReturnPct >= 0;
  const eqW = 600, eqH = 220, eqPadY = 10;
  const eqVals = equityCurve.map(p => p.value);
  const eqMin = eqVals.length ? Math.min(...eqVals) : 0;
  const eqMax = eqVals.length ? Math.max(...eqVals) : 1;
  const eqSpan = (eqMax - eqMin) || 1;
  const eqN = eqVals.length;
  const eqPx = i => (eqN > 1 ? (i / (eqN - 1)) * eqW : eqW / 2);
  const eqPy = v => eqH - eqPadY - ((v - eqMin) / eqSpan) * (eqH - eqPadY * 2);
  const eqLinePts = eqVals.map((v, i) => `${eqPx(i).toFixed(1)},${eqPy(v).toFixed(1)}`);
  const eqAreaPath = `M0,${eqH} L${eqLinePts.join(' L')} L${eqW},${eqH} Z`;
  const eqColor = eqUp ? '#10b981' : '#ef4444';
  const eqFirstLabel = equityCurve.length ? fmtDay(new Date(equityCurve[0].timestamp * 1000).toISOString()) : '';
  const eqMidLabel = equityCurve.length > 2 ? fmtDay(new Date(equityCurve[Math.floor(equityCurve.length / 2)].timestamp * 1000).toISOString()) : '';
  const eqLastLabel = equityCurve.length ? fmtDay(new Date(equityCurve[equityCurve.length - 1].timestamp * 1000).toISOString()) : '';

  // Market-relative comparison: align NEPSE index to the portfolio timeline and
  // normalize both to 100 at the first trade so the curves are directly comparable.
  const eqNorm = equityCurve.map(p => eqFirst && eqFirst.value > 0 ? (p.value / eqFirst.value) * 100 : 0);
  let nePtr = -1;
  const neNorm = equityCurve.map(p => {
    while (nePtr + 1 < nepseSeries.length && nepseSeries[nePtr + 1].timestamp <= p.timestamp) nePtr++;
    return nePtr >= 0 ? nepseSeries[nePtr].close : null;
  });
  const neFirst = neNorm.find(v => v != null);
  const neNormScaled = neFirst != null && neFirst > 0
    ? neNorm.map(v => (v != null ? (v / neFirst) * 100 : null))
    : neNorm.map(() => null);
  const normMax = Math.max(...eqNorm, ...neNormScaled.filter(v => v != null), 100);
  const normMin = Math.min(...eqNorm, ...neNormScaled.filter(v => v != null), 100);
  const normSpan = (normMax - normMin) || 1;
  const normY = v => eqH - eqPadY - ((v - normMin) / normSpan) * (eqH - eqPadY * 2);
  const neLinePts = neNormScaled.map((v, i) => v != null ? `${eqPx(i).toFixed(1)},${normY(v).toFixed(1)}` : null).filter(Boolean);
  const neLastVal = neNormScaled.filter(v => v != null).pop();
  const marketRetPct = neFirst != null && neFirst > 0 && neLastVal != null ? neLastVal - 100 : null;
  const vsMarketPct = eqReturnPct != null && marketRetPct != null ? eqReturnPct - marketRetPct : null;

  // Sector exposure + concentration
  const sectorOf = {};
  Object.entries(SECTOR_COMPANIES).forEach(([sector, syms]) => {
    syms.forEach(s => { sectorOf[s.toUpperCase()] = sector; });
  });
  const sectorExposure = {};
  holdingsList.forEach(h => {
    if (h.currentValue <= 0) return;
    const sec = sectorOf[h.symbol] || 'Others';
    sectorExposure[sec] = (sectorExposure[sec] || 0) + h.currentValue;
  });
  const sectorList = Object.entries(sectorExposure)
    .map(([sector, value]) => ({ sector, value, pct: totalCurrentVal > 0 ? (value / totalCurrentVal) * 100 : 0 }))
    .sort((a, b) => b.value - a.value);
  const topHolding = holdingsList.reduce((m, h) => (h.currentValue > (m?.currentValue || 0) ? h : m), null);
  const topHoldingPct = topHolding && totalCurrentVal > 0 ? (topHolding.currentValue / totalCurrentVal) * 100 : 0;
  const concentrationRisk = topHoldingPct >= 25 || (sectorList[0]?.pct || 0) >= 40;

  // Support/resistance zones for each holding (from the per-stock analysis).
  const srRows = holdingsList
    .filter(h => h.qtyHeld > 0)
    .map(h => {
      const ai = signalMap[h.symbol];
      const sr = ai?.supportResistance;
      if (!sr || typeof sr.support !== 'number' || typeof sr.resistance !== 'number' || !(sr.resistance > sr.support)) return null;
      const price = h.currentLTP > 0 ? h.currentLTP : ai?.currentPrice;
      const pos = typeof sr.positionPct === 'number' ? Math.max(0, Math.min(100, sr.positionPct)) : null;
      let zone = 'mid';
      let zoneLabel = 'Mid-range';
      let hint = 'Room in both directions';
      if (pos != null && pos <= 20) { zone = 'support'; zoneLabel = 'Near support'; hint = 'Potential entry zone — watch for a bounce'; }
      else if (sr.nearResistance === true || (pos != null && pos >= 80)) { zone = 'resistance'; zoneLabel = 'Near resistance'; hint = 'Breakout or pullback — profit-taking zone'; }
      else if (sr.nearSupport === true && pos != null && pos <= 35) { zone = 'support'; zoneLabel = 'Support zone'; hint = 'Getting close to support — add-able if it holds'; }
      return { ...h, sr, pos, zone, zoneLabel, hint, srPrice: price };
    })
    .filter(Boolean)
    .sort((a, b) => {
      const order = { support: 0, mid: 1, resistance: 2 };
      return (order[a.zone] - order[b.zone]);
    });
  const srSupportCount = srRows.filter(r => r.zone === 'support').length;
  const srResistanceCount = srRows.filter(r => r.zone === 'resistance').length;

  // Detail drawer derived data
  const drawerHolding = drawerSymbol ? holdingsList.find(h => h.symbol === drawerSymbol) : null;
  const drawerAi = drawerSymbol ? signalMap[drawerSymbol] : null;
  const drawerOutlook = drawerAi ? longTermOutlook(drawerAi) : null;
  const drawerTxs = drawerSymbol
    ? portfolio.filter(tx => String(tx.symbol || '').toUpperCase() === drawerSymbol).sort((a, b) => new Date(a.date) - new Date(b.date))
    : [];
  const cd = drawerAi?.chartData || [];
  const cdVals = cd.map(r => r.close).filter(v => typeof v === 'number' && !isNaN(v));
  const cdMin = cdVals.length ? Math.min(...cdVals) : 0;
  const cdMax = cdVals.length ? Math.max(...cdVals) : 1;
  const cdSpan = (cdMax - cdMin) || 1;
  const cdN = cdVals.length;
  const cdW = 560, cdH = 120, cdPadY = 6;
  const cdPx = i => (cdN > 1 ? (i / (cdN - 1)) * cdW : cdW / 2);
  const cdPy = v => cdH - cdPadY - ((v - cdMin) / cdSpan) * (cdH - cdPadY * 2);
  const cdPts = cdVals.map((v, i) => `${cdPx(i).toFixed(1)},${cdPy(v).toFixed(1)}`).join(' ');
  const cdPath = `M0,${cdH} L${cdVals.map((v, i) => `${cdPx(i).toFixed(1)},${cdPy(v).toFixed(1)}`).join(' L')} L${cdW},${cdH} Z`;
  const cdColor = drawerHolding && drawerHolding.unrealizedPL >= 0 ? '#10b981' : '#ef4444';

  // Add transaction
  async function handleSubmit(e) {
    e.preventDefault();
    setFormError('');
    if (!form.symbol.trim()) { setFormError('Symbol is required'); return; }
    if (!form.quantity || Number(form.quantity) <= 0) { setFormError('Quantity must be positive'); return; }
    if (!form.price || Number(form.price) <= 0) { setFormError('Price must be positive'); return; }

    setFormLoading(true);
    try {
      const snapshot = form.type === 'buy' ? await fetchAppSnapshot(form.symbol.toUpperCase().trim()) : null;
      const payload = {
        symbol: form.symbol.toUpperCase().trim(),
        type: form.type,
        quantity: Number(form.quantity),
        price: Number(form.price),
        date: form.date,
        source: form.type === 'buy' ? form.source : undefined,
        appSnapshot: snapshot || null
      };
      const resetForm = { symbol: '', type: 'buy', quantity: '', price: '', date: new Date().toISOString().slice(0, 10), source: 'own' };

      if (backendAvailable) {
        const res = await fetch(`${API_BASE}/portfolio`, {
          method: 'POST',
          headers: getAuthHeaders(),
          body: JSON.stringify(payload)
        });
        if (res.ok) {
          setForm(resetForm);
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
            setForm(resetForm);
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
        setForm(resetForm);
        setShowForm(false);
      }
    } catch {
      // Network error — save locally
      const payload = {
        _id: localNextId(),
        symbol: form.symbol.toUpperCase().trim(),
        type: form.type,
        quantity: Number(form.quantity),
        price: Number(form.price),
        date: form.date,
        source: form.type === 'buy' ? form.source : undefined,
        appSnapshot: null
      };
      const updated = [payload, ...loadLocalPortfolio()];
      saveLocalPortfolio(updated);
      setPortfolio(updated);
      setForm({ symbol: '', type: 'buy', quantity: '', price: '', date: new Date().toISOString().slice(0, 10), source: 'own' });
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
      date: tx.date ? new Date(tx.date).toISOString().slice(0, 10) : new Date().toISOString().slice(0, 10),
      source: tx.source === 'app' ? 'app' : 'own',
      appSnapshot: tx.appSnapshot || null
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
      date: editItem.date,
      source: editItem.type === 'buy' ? editItem.source : undefined,
      appSnapshot: editItem.appSnapshot || null
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
      } catch {
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


        {/* ── Market Regime + Sell-signal summary ── */}
        {regimeData && !regimeData.error && (
          <div style={{ marginTop: '1.25rem' }}>
            <RegimeBanner marketRegime={regimeData} compact />
          </div>
        )}

        {signalLoading && (
          <div className="signal-summary signal-loading" style={{ marginTop: '0.9rem' }}>
            <Loader size={12} className="spin" /> Analyzing your positions for sell signals…
          </div>
        )}
        {!signalLoading && hasSignals && (
          <div className="signal-summary" style={{ marginTop: '0.9rem' }}>
            <span className="signal-summary-label">Position check:</span>
            {sellCount > 0 && <span className="sell-signal-badge sell">Sell {sellCount}</span>}
            {trimCount > 0 && <span className="sell-signal-badge trim">Trim {trimCount}</span>}
            {watchCount > 0 && <span className="sell-signal-badge watch">Watch {watchCount}</span>}
            {holdCount > 0 && <span className="sell-signal-badge hold">Hold {holdCount}</span>}
            <span className="signal-summary-hint">Hover a Signal badge in the table for the reason</span>
          </div>
        )}

        {/* ── Honesty scorecard (trust) ── */}
        <div style={{ marginTop: '1rem' }}>
          <button className="trust-toggle" onClick={() => setShowTrust(s => !s)}>
            <ShieldCheck size={15} style={{ color: '#0ea5e9' }} />
            Does this actually work? — honest performance scorecard
            {showTrust ? <ChevronUp size={14} /> : <ChevronDown size={14} />}
          </button>
          {showTrust && <TrustCheck />}
        </div>

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

        {/* ── Portfolio Value over Time (equity curve) ── */}
        <div className="card" style={{ marginTop: '1.5rem' }}>
          <div className="card-header">
            <span className="card-title" style={{ display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
              <LineChart size={15} style={{ color: 'var(--accent)' }} /> Portfolio Value over Time
            </span>
            {eqLast && (
              <span className="card-badge">
                {fmtNPR(eqLast.value)}
                {eqReturnPct != null && (
                  <span className={eqUp ? 'positive' : 'negative'} style={{ marginLeft: '0.4rem', fontWeight: 700 }}>
                    {eqReturnPct >= 0 ? '+' : '−'}{Math.abs(eqReturnPct).toFixed(1)}%
                  </span>
                )}
              </span>
            )}
          </div>
          <div className="equity-body">
            {equityLoading ? (
              <div className="skeleton" style={{ width: '100%', height: '14rem' }} />
            ) : eqN > 1 ? (
              <>
                <div className="equity-chart">
                  <svg className="snapshot-chart-svg" viewBox={`0 0 ${eqW} ${eqH}`} preserveAspectRatio="none" role="img" aria-label="Portfolio value over time vs NEPSE index">
                    <defs>
                      <linearGradient id="equityGrad" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="0%" stopColor={eqColor} stopOpacity="0.35" />
                        <stop offset="100%" stopColor={eqColor} stopOpacity="0" />
                      </linearGradient>
                    </defs>
                    <path d={eqAreaPath} fill="url(#equityGrad)" />
                    {neLinePts.length > 1 && (
                      <>
                        <polyline
                          points={neLinePts.join(' ')}
                          fill="none"
                          stroke="#a78bfa"
                          strokeWidth="1.6"
                          strokeDasharray="5 4"
                          vectorEffect="non-scaling-stroke"
                          strokeLinejoin="round"
                          strokeLinecap="round"
                        />
                        {(() => {
                          const lastNe = neLinePts[neLinePts.length - 1].split(',');
                          return <circle cx={lastNe[0]} cy={lastNe[1]} r="4" fill="#a78bfa" />;
                        })()}
                      </>
                    )}
                    <polyline
                      points={eqLinePts.join(' ')}
                      fill="none"
                      stroke={eqColor}
                      strokeWidth="2.5"
                      vectorEffect="non-scaling-stroke"
                      strokeLinejoin="round"
                      strokeLinecap="round"
                    />
                    {eqN > 1 && <circle cx={eqPx(eqN - 1)} cy={eqPy(eqVals[eqN - 1])} r="4.5" fill={eqColor} />}
                  </svg>
                  <div className="snapshot-chart-labels">
                    <span>{eqFirstLabel}</span>
                    <span>{eqMidLabel}</span>
                    <span>{eqLastLabel}</span>
                  </div>
                </div>
                <div className="equity-legend">
                  <span className="equity-legend-item"><i style={{ background: eqColor }} /> Portfolio</span>
                  <span className="equity-legend-item"><i style={{ background: '#a78bfa' }} /> NEPSE index</span>
                  {marketRetPct != null && eqReturnPct != null && (
                    <span className={`equity-legend-item ${vsMarketPct >= 0 ? 'positive' : 'negative'}`}>
                      {vsMarketPct >= 0 ? 'Beating' : 'Behind'} the market by {Math.abs(vsMarketPct).toFixed(1)}%
                    </span>
                  )}
                </div>
                <div className="equity-note">
                  Your portfolio's value on each real trading day vs the NEPSE index (both set to 100 on your first trade). Market {marketRetPct != null ? `${marketRetPct >= 0 ? '+' : '−'}${Math.abs(marketRetPct).toFixed(1)}%` : '—'} since then.
                </div>
              </>
            ) : (
              <div className="equity-empty">
                <LineChart size={24} style={{ opacity: 0.35 }} />
                <span>Add a trade to see your portfolio value over time.</span>
              </div>
            )}
          </div>
        </div>

        {/* ── Sector Exposure + Concentration ── */}
        {holdingsList.some(h => h.currentValue > 0) && (
          <div className="card" style={{ marginTop: '1.5rem' }}>
            <div className="card-header">
              <span className="card-title" style={{ display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
                <Layers size={15} style={{ color: 'var(--accent)' }} /> Sector Exposure
              </span>
              {concentrationRisk && (
                <span className="card-badge" style={{ color: '#f59e0b', borderColor: 'rgba(245,158,11,0.4)' }}>
                  Concentration risk
                </span>
              )}
            </div>
            <div className="sector-exposure-body">
              {topHolding && (
                <div className="sector-exposure-top">
                  <span>
                    Biggest holding: <strong className="stock-symbol">{topHolding.symbol}</strong> at{' '}
                    <strong>{topHoldingPct.toFixed(0)}%</strong> of your portfolio
                  </span>
                  {topHoldingPct >= 25 && (
                    <span className="sector-exposure-warn">Over 25% in one stock — a single bad quarter can hurt</span>
                  )}
                </div>
              )}
              {sectorList.length === 0 ? (
                <div className="equity-empty"><span>No current positions to break down.</span></div>
              ) : (
                <div className="sector-exposure-list">
                  {sectorList.map(({ sector, value, pct }) => (
                    <div className="sector-exposure-row" key={sector}>
                      <span className="sector-exposure-name">{sector}</span>
                      <div className="sector-exposure-track">
                        <span className="sector-exposure-fill" style={{ width: `${Math.min(100, pct)}%` }} />
                      </div>
                      <span className="sector-exposure-val">{pct.toFixed(0)}%</span>
                      <span className="sector-exposure-amt">{fmtNPRk(value)}</span>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        )}

        {/* ── Support & Resistance zones ── */}
        {srRows.length > 0 && (
          <div className="card" style={{ marginTop: '1.5rem' }}>
            <div className="card-header">
              <span className="card-title" style={{ display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
                <Target size={15} style={{ color: 'var(--accent)' }} /> Support & Resistance
              </span>
              {(srSupportCount > 0 || srResistanceCount > 0) && (
                <span className="card-badge">
                  {srSupportCount > 0 && <span style={{ color: 'var(--green)' }}>{srSupportCount} near support</span>}
                  {srSupportCount > 0 && srResistanceCount > 0 && ' · '}
                  {srResistanceCount > 0 && <span style={{ color: '#f59e0b' }}>{srResistanceCount} near resistance</span>}
                </span>
              )}
            </div>
            <div className="sr-body">
              <div className="sr-intro">
                Where each position sits between its 50-session support and resistance. NEPSE respects these levels — plan entries near support, exits near resistance.
              </div>
              <div className="sr-list">
                {srRows.map(r => (
                  <div className="sr-row" key={r.symbol}>
                    <div className="sr-row-top">
                      <span className="stock-symbol">{r.symbol}</span>
                      <span className={`sr-zone sr-zone-${r.zone}`}>{r.zoneLabel}</span>
                      <span className="sr-price">LTP {r.srPrice > 0 ? r.srPrice.toLocaleString('en-IN', { maximumFractionDigits: 2 }) : '—'}</span>
                    </div>
                    <div className="sr-track">
                      {r.pos != null && (
                        <span className="sr-marker" style={{ left: `${r.pos}%` }} title={`Price at ${r.pos.toFixed(0)}% of support/resistance range`} />
                      )}
                    </div>
                    <div className="sr-labels">
                      <span className="sr-support">S {r.sr.support.toLocaleString('en-IN', { maximumFractionDigits: 2 })}</span>
                      <span className="sr-mid">Pivot {r.sr.pivot != null ? r.sr.pivot.toLocaleString('en-IN', { maximumFractionDigits: 2 }) : '—'}</span>
                      <span className="sr-resistance">R {r.sr.resistance.toLocaleString('en-IN', { maximumFractionDigits: 2 })}</span>
                    </div>
                    <div className="sr-hint">{r.hint}</div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        )}

        {/* ── Trade journal (accountability scoreboard) ── */}
        <TradeJournal portfolio={portfolio} liveMarket={liveMarket} nepseSeries={nepseSeries} />

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
              <span>Signal</span>
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
                    <span>
                      {h.signal ? (
                        <span className={`sell-signal-badge ${h.signal.level}`} title={h.signal.reason}>
                          {h.signal.label}
                        </span>
                      ) : h.qtyHeld > 0 && signalLoading ? (
                        <span className="sell-signal-badge pending" title="Analyzing this position…">…</span>
                      ) : (
                        <span style={{ color: 'var(--text-muted)', fontSize: '0.72rem' }}>—</span>
                      )}
                    </span>
                    <span className="tracker-actions">
                      <button
                        className="btn-ghost"
                        title="View details"
                        onClick={() => setDrawerSymbol(h.symbol)}
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
              {form.type === 'buy' && (
                <div className="form-group" style={{ marginTop: '0.5rem' }}>
                  <label>What kind of buy was this?</label>
                  <div className="trade-type-toggle journal-source-toggle">
                    <button
                      type="button"
                      className={`toggle-btn${form.source === 'app' ? ' active buy' : ''}`}
                      onClick={() => setForm(f => ({ ...f, source: 'app' }))}
                    >
                      <Sparkles size={14} /> App pick
                    </button>
                    <button
                      type="button"
                      className={`toggle-btn${form.source === 'own' ? ' active own' : ''}`}
                      onClick={() => setForm(f => ({ ...f, source: 'own' }))}
                    >
                      <User size={14} /> My own call
                    </button>
                  </div>
                  <p className="journal-source-hint">
                    {form.source === 'app'
                      ? 'Journal will snapshot the app rating at this buy and hold it accountable.'
                      : 'Journal will still record this buy and compare it against app picks.'}
                  </p>
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
              {editItem.type === 'buy' && (
                <div className="form-group" style={{ marginTop: '0.5rem' }}>
                  <label>What kind of buy was this?</label>
                  <div className="trade-type-toggle journal-source-toggle">
                    <button
                      type="button"
                      className={`toggle-btn${editItem.source === 'app' ? ' active buy' : ''}`}
                      onClick={() => setEditItem({ ...editItem, source: 'app' })}
                    >
                      <Sparkles size={14} /> App pick
                    </button>
                    <button
                      type="button"
                      className={`toggle-btn${editItem.source === 'own' ? ' active own' : ''}`}
                      onClick={() => setEditItem({ ...editItem, source: 'own' })}
                    >
                      <User size={14} /> My own call
                    </button>
                  </div>
                </div>
              )}
              <button type="submit" className="btn-primary" style={{ width: '100%', marginTop: '0.5rem' }}>
                Save Changes
              </button>
            </form>
          </div>
        </div>
      )}

      {/* ── Holding Detail Drawer ── */}
      {drawerSymbol && (
        <div className="drawer-overlay" onClick={() => setDrawerSymbol(null)}>
          <div className="holding-drawer" onClick={e => e.stopPropagation()}>
            <div className="drawer-head">
              <div className="drawer-title">
                <span className="stock-symbol" style={{ fontSize: '1rem' }}>{drawerSymbol}</span>
                {drawerAi?.companyName && <span className="drawer-company">{drawerAi.companyName}</span>}
              </div>
              <button className="btn-ghost" onClick={() => setDrawerSymbol(null)} title="Close"><X size={18} /></button>
            </div>

            <div className="drawer-scroll">
              {/* Position summary */}
              {drawerHolding && (
                <div className="drawer-pos-grid">
                  <div className="drawer-pos-cell">
                    <span className="drawer-pos-label">Qty</span>
                    <span className="drawer-pos-val">{drawerHolding.qtyHeld}</span>
                  </div>
                  <div className="drawer-pos-cell">
                    <span className="drawer-pos-label">Avg Buy</span>
                    <span className="drawer-pos-val">{drawerHolding.avgBuyPrice.toLocaleString('en-IN', { maximumFractionDigits: 2 })}</span>
                  </div>
                  <div className="drawer-pos-cell">
                    <span className="drawer-pos-label">LTP</span>
                    <span className="drawer-pos-val">{drawerHolding.currentLTP > 0 ? drawerHolding.currentLTP.toLocaleString('en-IN', { maximumFractionDigits: 2 }) : '—'}</span>
                  </div>
                  <div className="drawer-pos-cell">
                    <span className="drawer-pos-label">P&L</span>
                    <span className={`drawer-pos-val ${drawerHolding.unrealizedPL >= 0 ? 'positive' : 'negative'}`}>
                      {drawerHolding.currentLTP > 0 ? (
                        <>
                          {drawerHolding.unrealizedPL >= 0 ? '+' : '−'}{fmtNPR(drawerHolding.unrealizedPL)}
                          <span className="drawer-pl-pct">({Math.abs(drawerHolding.unrealizedPLPct).toFixed(1)}%)</span>
                        </>
                      ) : '—'}
                    </span>
                  </div>
                  <div className="drawer-pos-cell">
                    <span className="drawer-pos-label">Invested</span>
                    <span className="drawer-pos-val">{fmtNPR(drawerHolding.investedValue)}</span>
                  </div>
                  <div className="drawer-pos-cell">
                    <span className="drawer-pos-label">Current Val</span>
                    <span className="drawer-pos-val">{drawerHolding.currentLTP > 0 ? fmtNPR(drawerHolding.currentValue) : '—'}</span>
                  </div>
                </div>
              )}

              {/* Signal */}
              {drawerHolding?.signal && (
                <div className={`drawer-signal drawer-signal-${drawerHolding.signal.level}`}>
                  <span className="drawer-signal-label">Position check: <strong>{drawerHolding.signal.label}</strong></span>
                  <span className="drawer-signal-reason">{drawerHolding.signal.reason}</span>
                </div>
              )}

              {/* Long-term potential */}
              <div className="drawer-block">
                <div className="drawer-block-title">
                  <Gauge size={14} style={{ color: 'var(--accent)' }} /> Long-term potential
                </div>
                {drawerOutlook ? (
                  <>
                    <div className="drawer-outlook-row">
                      <div className="drawer-outlook-score">
                        <span className={`outlook-gauge ${drawerOutlook.label.toLowerCase()}`}>{drawerOutlook.score}</span>
                        <span className="outlook-gauge-cap">/100</span>
                      </div>
                      <div className="drawer-outlook-meta">
                        <span className={`outlook-label ${drawerOutlook.label.toLowerCase()}`}>{drawerOutlook.label} long-term potential</span>
                        <span className="outlook-sub">
                          Based on AI rating{drawerOutlook.upside != null ? ` (${drawerOutlook.upside} upside /` : ''}
                          {drawerOutlook.safety != null ? ` ${drawerOutlook.safety} safety)` : ''}
                        </span>
                      </div>
                    </div>
                    <div className="drawer-outlook-bar">
                      <span className="drawer-outlook-fill" style={{ width: `${drawerOutlook.score}%` }} />
                    </div>
                    <ul className="drawer-outlook-bullets">
                      {drawerOutlook.bullets.slice(0, 5).map((b, i) => <li key={i}>{b}</li>)}
                    </ul>
                  </>
                ) : (
                  <div className="drawer-muted"><Loader size={12} className="spin" /> Analyzing for long-term outlook…</div>
                )}
              </div>

              {/* Price chart (90 days from analysis) */}
              {drawerAi && cdN > 1 && (
                <div className="drawer-block">
                  <div className="drawer-block-title">
                    <BarChart3 size={14} style={{ color: 'var(--accent)' }} /> Price trend <span className="drawer-sub">last 90 sessions</span>
                  </div>
                  <svg className="snapshot-chart-svg" viewBox={`0 0 ${cdW} ${cdH}`} preserveAspectRatio="none">
                    <defs>
                      <linearGradient id="drawerGrad" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="0%" stopColor={cdColor} stopOpacity="0.3" />
                        <stop offset="100%" stopColor={cdColor} stopOpacity="0" />
                      </linearGradient>
                    </defs>
                    <path d={cdPath} fill="url(#drawerGrad)" />
                    <polyline points={cdPts} fill="none" stroke={cdColor} strokeWidth="2" vectorEffect="non-scaling-stroke" strokeLinejoin="round" strokeLinecap="round" />
                  </svg>
                </div>
              )}

              {/* AI rating */}
              {drawerAi?.investmentRating && (
                <div className="drawer-block">
                  <div className="drawer-block-title">
                    <ShieldCheck size={14} style={{ color: 'var(--accent)' }} /> AI rating
                    <span className="drawer-rating-badge" style={{ color: ratingColor(drawerAi.investmentRating.verdict) }}>
                      {drawerAi.investmentRating.verdict} · {drawerAi.investmentRating.score}/100
                    </span>
                  </div>
                  <div className="drawer-chips">
                    {(drawerAi.investmentRating.parts || []).slice(0, 4).map((p, i) => (
                      <span key={i} className="drawer-chip" title={p[1]}>
                        {p[0]}: <strong style={{ color: p[2].startsWith('+') ? 'var(--green)' : p[2].startsWith('-') ? '#ef4444' : 'var(--text-primary)' }}>{p[2]}</strong>
                      </span>
                    ))}
                  </div>
                </div>
              )}

              {/* Entry / target / stop */}
              {drawerAi?.supportResistance && (
                <div className="drawer-block">
                  <div className="drawer-block-title"><Target size={14} style={{ color: 'var(--accent)' }} /> Entry / Target / Stop</div>
                  <div className="drawer-pos-grid">
                    <div className="drawer-pos-cell">
                      <span className="drawer-pos-label">Support</span>
                      <span className="drawer-pos-val">{fmtNPR(drawerAi.supportResistance.support)}</span>
                    </div>
                    <div className="drawer-pos-cell">
                      <span className="drawer-pos-label">Pivot</span>
                      <span className="drawer-pos-val">{fmtNPR(drawerAi.supportResistance.pivot)}</span>
                    </div>
                    <div className="drawer-pos-cell">
                      <span className="drawer-pos-label">Resistance</span>
                      <span className="drawer-pos-val">{fmtNPR(drawerAi.supportResistance.resistance)}</span>
                    </div>
                    <div className="drawer-pos-cell">
                      <span className="drawer-pos-label">Range pos</span>
                      <span className="drawer-pos-val" title="Price at this % of the support/resistance range">
                        {drawerAi.supportResistance.positionPct != null ? `${drawerAi.supportResistance.positionPct.toFixed(0)}% of S/R` : '—'}
                      </span>
                    </div>
                  </div>
                </div>
              )}

              {/* Transactions for this symbol */}
              <div className="drawer-block">
                <div className="drawer-block-title">
                  <Activity size={14} style={{ color: 'var(--accent)' }} /> Transactions <span className="drawer-sub">{drawerTxs.length}</span>
                </div>
                {drawerTxs.length === 0 ? (
                  <div className="drawer-muted">No transactions for this symbol.</div>
                ) : (
                  <div className="drawer-tx-list">
                    {drawerTxs.map(tx => (
                      <div className="drawer-tx-row" key={tx._id}>
                        <span className={`trade-type-badge ${tx.type}`}>
                          {tx.type === 'buy' ? <TrendingUp size={10} /> : <TrendingDown size={10} />}
                          {tx.type.toUpperCase()}
                        </span>
                        <span className="drawer-tx-date">{new Date(tx.date).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' })}</span>
                        <span className="drawer-tx-qty">{tx.quantity} @ {tx.price.toLocaleString('en-IN', { maximumFractionDigits: 2 })}</span>
                        <span className="drawer-tx-total">{fmtNPR(tx.quantity * tx.price)}</span>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>
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
