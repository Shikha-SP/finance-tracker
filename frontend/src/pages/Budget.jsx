import { useState, useMemo } from 'react';
import { useTx } from '../context/TxContext';
import { getCategoryIcon } from '../utils/categoryIcons';
import { Target, AlertTriangle, CheckCircle, TrendingDown } from 'lucide-react';

const fmt = n => 'रू ' + Math.abs(n).toLocaleString('en-IN', { maximumFractionDigits: 0 });

const EXPENSE_CATEGORIES = [
  'Food & Dining', 'Transport', 'Shopping', 'Health',
  'Bills & Utilities', 'Entertainment', 'Other',
];

function Budget() {
  const { byCategory, expense, budgets, updateBudget, income } = useTx();
  const [editing, setEditing] = useState(null);
  const [editVal, setEditVal] = useState('');

  const totalBudget = useMemo(() =>
    EXPENSE_CATEGORIES.reduce((s, c) => s + (budgets[c] || 0), 0),
    [budgets]
  );

  const totalSpent = expense;
  const overBudgetCats = EXPENSE_CATEGORIES.filter(c => budgets[c] > 0 && (byCategory[c] || 0) > budgets[c]);

  const overallPct = totalBudget > 0 ? Math.min(100, (totalSpent / totalBudget) * 100) : 0;
  const overallColor = overallPct > 90 ? '#ef4444' : overallPct > 70 ? '#f59e0b' : '#10b981';

  function startEdit(cat) {
    setEditing(cat);
    setEditVal(budgets[cat] || '');
  }

  function saveEdit(cat) {
    if (editVal !== '') updateBudget(cat, editVal);
    setEditing(null);
  }

  return (
    <main className="page">
      <div className="page-header">
        <div className="page-header-left">
          <h1 className="page-title">Budget Control</h1>
          <p className="page-subtitle">Spending limits &bull; Allocation tracker</p>
        </div>
      </div>

      <div className="page-content">
        {/* Overview card — summary stats + donut together */}
        <div className="card" style={{ marginBottom: '1.5rem' }}>
          <div className="card-header">
            <span className="card-title">Budget Overview</span>
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
                { label: 'Monthly Income', value: fmt(income), color: 'var(--green)' },
                { label: 'Allocated Budget', value: fmt(totalBudget), color: 'var(--text-primary)' },
                { label: 'Total Spent', value: fmt(totalSpent), color: totalSpent > totalBudget ? 'var(--red)' : 'var(--text-primary)' },
                { label: 'Unallocated', value: fmt(Math.max(0, income - totalBudget)), color: totalBudget > income ? 'var(--red)' : 'var(--text-muted)' },
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
        </div>

        {/* Category budget rows */}
        <div className="card">
          <div className="card-header">
            <span className="card-title">Category Limits</span>
            <span className="card-badge">Click amount to edit</span>
          </div>
          <div className="budget-list">
            {EXPENSE_CATEGORIES.map(cat => {
              const spent  = byCategory[cat] || 0;
              const limit  = budgets[cat] || 0;
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
                      <span className="budget-row-cat">{cat}</span>
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
                    <div className="budget-row-bar-track">
                      <div
                        className="budget-row-bar-fill"
                        style={{ width: `${pct}%`, background: barColor }}
                      />
                    </div>
                    {over && (
                      <p className="budget-over-label">
                        <TrendingDown size={11} /> Over by {fmt(spent - limit)}
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
