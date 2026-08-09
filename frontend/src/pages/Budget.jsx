import { useState, useMemo, useEffect } from 'react';
import { useTx } from '../context/TxContext';
import { getCategoryIcon } from '../utils/categoryIcons';
import { AlertTriangle, CheckCircle, TrendingDown, Calendar, PiggyBank, Unlock } from 'lucide-react';

const fmt = n => 'रू ' + Math.abs(n).toLocaleString('en-IN', { maximumFractionDigits: 0 });

const EXPENSE_CATEGORIES = [
  'Food & Dining', 'Transport', 'Shopping', 'Health',
  'Bills & Utilities', 'Entertainment', 'Other',
];

const currentMonthKey = () => new Date().toLocaleDateString('en-IN', { month: 'short', year: 'numeric' });

function Budget() {
  const { transactions, budgets, updateBudget } = useTx();
  const [editing, setEditing] = useState(null);
  const [editVal, setEditVal] = useState('');
  const [selectedMonth, setSelectedMonth] = useState(null);

  // Month options from actual data, sorted chronologically
  const monthMeta = useMemo(() => {
    const map = {};
    transactions.forEach(t => {
      if (!t.monthKey || map[t.monthKey]) return;
      const d = t.dateISO ? new Date(t.dateISO) : null;
      map[t.monthKey] = { key: t.monthKey, ts: d && !isNaN(d) ? d.getTime() : 0 };
    });
    return Object.values(map).sort((a, b) => a.ts - b.ts);
  }, [transactions]);

  const latestMonth = monthMeta.length ? monthMeta[monthMeta.length - 1].key : null;

  // Default to the most recent month once data loads
  useEffect(() => {
    if (latestMonth && selectedMonth === null) setSelectedMonth(latestMonth);
  }, [latestMonth, selectedMonth]);

  const effectiveMonth = selectedMonth || latestMonth || currentMonthKey();

  // Month-scoped aggregates (budgets are monthly, so these are the real numbers)
  const monthTxs = useMemo(
    () => transactions.filter(t => t.monthKey === effectiveMonth),
    [transactions, effectiveMonth]
  );

  const mIncome = useMemo(
    () => monthTxs.filter(t => t.type === 'income').reduce((s, t) => s + t.amount, 0),
    [monthTxs]
  );
  const mSpent = useMemo(
    () => monthTxs.filter(t => t.type === 'expense').reduce((s, t) => s + t.amount, 0),
    [monthTxs]
  );
  const mByCat = useMemo(() => {
    const map = {};
    monthTxs.filter(t => t.type === 'expense').forEach(t => {
      map[t.category] = (map[t.category] || 0) + t.amount;
    });
    return map;
  }, [monthTxs]);

  const totalBudget = useMemo(() =>
    EXPENSE_CATEGORIES.reduce((s, c) => s + (budgets[c] || 0), 0),
    [budgets]
  );

  const overallPct = totalBudget > 0 ? Math.min(100, (mSpent / totalBudget) * 100) : 0;
  const overallColor = overallPct > 90 ? '#ef4444' : overallPct > 70 ? '#f59e0b' : '#10b981';
  const remaining = totalBudget - mSpent;

  const overBudgetCats = EXPENSE_CATEGORIES.filter(c => budgets[c] > 0 && (mByCat[c] || 0) > budgets[c]);
  const unbudgetedCats = EXPENSE_CATEGORIES.filter(c => !budgets[c] && (mByCat[c] || 0) > 0);

  // Pacing — only meaningful for the current month
  const isCurrentMonth = effectiveMonth === currentMonthKey();
  const pacing = useMemo(() => {
    if (!isCurrentMonth || mSpent === 0) return null;
    const now = new Date();
    const day = now.getDate();
    const dim = new Date(now.getFullYear(), now.getMonth() + 1, 0).getDate();
    const daysLeft = dim - day;
    const perDay = mSpent / day;
    const projected = perDay * dim;
    const allowance = remaining > 0 && daysLeft > 0 ? remaining / daysLeft : null;
    return { day, dim, daysLeft, perDay, projected, allowance };
  }, [isCurrentMonth, mSpent, remaining]);

  // Categories to show: anything with spend this month or a limit set
  const shownCats = useMemo(() =>
    EXPENSE_CATEGORIES.filter(c => (mByCat[c] || 0) > 0 || (budgets[c] || 0) > 0),
    [mByCat, budgets]
  );

  function startEdit(cat) {
    setEditing(cat);
    setEditVal(budgets[cat] || '');
  }

  function saveEdit(cat) {
    if (editVal !== '') updateBudget(cat, editVal);
    setEditing(null);
  }

  const empty = monthTxs.length === 0;

  return (
    <main className="page">
      <div className="page-header">
        <div className="page-header-left">
          <h1 className="page-title">Budget Control</h1>
          <p className="page-subtitle">Spending limits &bull; Allocation tracker</p>
        </div>
      </div>

      <div className="page-content">
        {/* Month selector */}
        <div className="card" style={{ padding: '0.65rem 1rem', marginBottom: '1.5rem' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', flexWrap: 'wrap' }}>
            <Calendar size={14} style={{ color: 'var(--accent)' }} />
            <span style={{ fontSize: '0.75rem', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.08em', color: 'var(--text-muted)' }}>
              Viewing
            </span>
            <select
              className="field-select"
              style={{ width: 'auto', padding: '0.25rem 0.5rem', fontSize: '0.78rem' }}
              value={effectiveMonth}
              onChange={e => setSelectedMonth(e.target.value)}
            >
              {monthMeta.length === 0 && <option value={effectiveMonth}>{effectiveMonth}</option>}
              {monthMeta.map(m => (
                <option key={m.key} value={m.key}>{m.key}</option>
              ))}
            </select>
            {!isCurrentMonth && (
              <span className="budget-alert" style={{ marginLeft: 'auto' }}>
                <PiggyBank size={13} />
                <span>Past month — budgets are set for your current month</span>
              </span>
            )}
          </div>
        </div>

        {/* Overview card — summary stats + donut together */}
        <div className="card" style={{ marginBottom: '1.5rem' }}>
          <div className="card-header">
            <span className="card-title">Budget Overview &mdash; {effectiveMonth}</span>
            {overBudgetCats.length > 0 ? (
              <div className="budget-alert">
                <AlertTriangle size={13} />
                <span>{overBudgetCats.length} categor{overBudgetCats.length > 1 ? 'ies' : 'y'} over budget</span>
              </div>
            ) : (
              <div className="budget-alert ok">
                <CheckCircle size={13} />
                <span>All within limits</span>
              </div>
            )}
          </div>
          <div className="card-body" style={{ display: 'flex', alignItems: 'center', gap: '2.5rem' }}>
            {/* Summary stats */}
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: '1rem', flex: 1 }}>
              {[
                { label: 'Income', value: fmt(mIncome), color: 'var(--green)' },
                { label: 'Allocated Budget', value: fmt(totalBudget), color: 'var(--text-primary)' },
                { label: 'Spent', value: fmt(mSpent), color: remaining < 0 ? 'var(--red)' : 'var(--text-primary)' },
                {
                  label: remaining < 0 ? 'Over by' : 'Left to spend',
                  value: fmt(Math.abs(remaining)),
                  color: remaining < 0 ? 'var(--red)' : 'var(--text-muted)',
                },
              ].map((item, i) => (
                <div key={item.label} style={{ paddingLeft: i > 0 ? '1.5rem' : '0', borderLeft: i > 0 ? '1px solid var(--border)' : 'none' }}>
                  <p style={{ fontSize: '0.65rem', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.1em', color: 'var(--text-muted)', marginBottom: '0.25rem' }}>{item.label}</p>
                  <p style={{ fontSize: '1.25rem', fontWeight: 800, color: item.color, fontFamily: "'Outfit', sans-serif", letterSpacing: '-0.02em' }}>{item.value}</p>
                </div>
              ))}
            </div>

            {/* Donut */}
            <div style={{ flexShrink: 0, display: 'flex', alignItems: 'center', justifyContent: 'center', paddingLeft: '1.5rem', borderLeft: '1px solid var(--border)' }}>
              <svg viewBox="0 0 100 100" width="110" height="110">
                <circle cx="50" cy="50" r="40" fill="none" stroke="var(--border-strong)" strokeWidth="12" />
                <circle
                  cx="50" cy="50" r="40" fill="none"
                  stroke={overallColor}
                  strokeWidth="12"
                  strokeDasharray={`${overallPct * 2.513} 251.3`}
                  strokeLinecap="butt"
                  transform="rotate(-90 50 50)"
                />
                <text x="50" y="46" textAnchor="middle" fontSize="15" fontWeight="800" fill="var(--text-primary)" fontFamily="'Outfit', sans-serif">
                  {Math.round(overallPct)}%
                </text>
                <text x="50" y="60" textAnchor="middle" fontSize="8" fill="var(--text-muted)" fontFamily="system-ui, sans-serif">
                  USED
                </text>
              </svg>
            </div>
          </div>

          {/* Pacing strip */}
          {pacing && (
            <div className="budget-pacing">
              <div className="budget-pacing-stat">
                <span className="budget-pacing-label">Day</span>
                <span className="budget-pacing-value">{pacing.day}/{pacing.dim}</span>
              </div>
              <div className="budget-pacing-stat">
                <span className="budget-pacing-label">Spend / day so far</span>
                <span className="budget-pacing-value">{fmt(pacing.perDay)}</span>
              </div>
              <div className="budget-pacing-stat">
                <span className="budget-pacing-label">Projected month end</span>
                <span className={`budget-pacing-value ${pacing.projected > totalBudget && totalBudget > 0 ? 'over' : ''}`}>
                  {fmt(pacing.projected)}
                </span>
              </div>
              <div className="budget-pacing-stat">
                <span className="budget-pacing-label">{pacing.allowance !== null ? 'You can spend / day' : 'Over budget / day'}</span>
                <span className={`budget-pacing-value ${pacing.allowance !== null ? '' : 'over'}`}>
                  {fmt(pacing.allowance !== null ? pacing.allowance : Math.abs(remaining) / pacing.daysLeft)}
                </span>
              </div>
            </div>
          )}
        </div>

        {/* Category budget rows */}
        <div className="card">
          <div className="card-header">
            <span className="card-title">Category Limits</span>
            <span className="card-badge">Click amount to edit</span>
          </div>
          <div className="budget-list">
            {empty ? (
              <p className="empty-text" style={{ textAlign: 'center', margin: '2rem 0' }}>
                No transactions in {effectiveMonth}. Add some, or pick another month.
              </p>
            ) : shownCats.map(cat => {
              const spent  = mByCat[cat] || 0;
              const limit  = budgets[cat] || 0;
              const unbudgeted = limit === 0 && spent > 0;
              const pct    = limit > 0 ? Math.min(100, (spent / limit) * 100) : 0;
              const over   = limit > 0 && spent > limit;
              const barColor = over ? '#ef4444' : pct > 70 ? '#f59e0b' : '#10b981';

              return (
                <div className="budget-row" key={cat}>
                  <div className="budget-row-icon">
                    {getCategoryIcon(cat, 16)}
                  </div>
                  <div className="budget-row-body">
                    <div className="budget-row-top">
                      <span className="budget-row-cat">
                        {cat}
                        {unbudgeted && (
                          <span className="budget-unbudgeted-chip">
                            <Unlock size={9} /> no limit
                          </span>
                        )}
                      </span>
                      <div className="budget-row-amounts">
                        <span style={{ color: barColor, fontWeight: 700 }}>{fmt(spent)}</span>
                        <span style={{ color: 'var(--text-muted)' }}> / </span>
                        {editing === cat ? (
                          <div style={{ display: 'flex', alignItems: 'center', gap: '0.25rem' }}>
                            <input
                              className="settings-input"
                              style={{ width: '80px', padding: '0.2rem 0.5rem', fontSize: '0.75rem' }}
                              type="number"
                              value={editVal}
                              autoFocus
                              onChange={e => setEditVal(e.target.value)}
                              onKeyDown={e => {
                                if (e.key === 'Enter') saveEdit(cat);
                                if (e.key === 'Escape') setEditing(null);
                              }}
                            />
                            <button className="btn-primary" style={{ padding: '0.2rem 0.4rem', fontSize: '0.7rem' }} onClick={() => saveEdit(cat)}>Save</button>
                            <button className="btn-ghost" style={{ padding: '0.2rem 0.4rem', fontSize: '0.7rem' }} onClick={() => setEditing(null)}>Cancel</button>
                          </div>
                        ) : (
                          <button className="budget-limit-btn" style={{ textDecoration: 'underline', textUnderlineOffset: '2px', color: limit > 0 ? 'var(--text-primary)' : 'var(--accent)', cursor: 'pointer', background: 'none', border: 'none', fontSize: '0.85rem' }} onClick={() => startEdit(cat)}>
                            {limit > 0 ? fmt(limit) : '+ Set limit'}
                          </button>
                        )}
                      </div>
                    </div>
                    {unbudgeted ? (
                      <div className="budget-row-bar-track">
                        <div className="budget-row-bar-fill" style={{ width: '100%', background: 'var(--amber)', opacity: 0.55 }} />
                      </div>
                    ) : (
                      <div className="budget-row-bar-track">
                        <div
                          className="budget-row-bar-fill"
                          style={{ width: `${pct}%`, background: barColor }}
                        />
                      </div>
                    )}
                    {over && (
                      <p className="budget-over-label">
                        <TrendingDown size={11} /> Over by {fmt(spent - limit)}
                      </p>
                    )}
                    {limit > 0 && !over && (
                      <p className="budget-left-label">
                        {fmt(limit - spent)} left
                      </p>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      </div>
    </main>
  );
}

export default Budget;
