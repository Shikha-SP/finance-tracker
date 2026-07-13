import { useState, useMemo } from 'react';
import { useTx } from '../context/TxContext';
import { getCategoryIcon } from '../utils/categoryIcons';
import { Target, AlertTriangle, CheckCircle, TrendingDown } from 'lucide-react';

const fmt = n => '₹' + Math.abs(n).toLocaleString('en-IN', { maximumFractionDigits: 0 });

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
        {/* Income and Allocation Summary */}
        <div className="budget-summary-card" style={{ display: 'flex', justifyContent: 'space-around', padding: '1rem', background: 'var(--bg-elevated)', borderRadius: '8px', marginBottom: '1rem' }}>
          <div style={{ textAlign: 'center' }}>
            <p className="budget-summary-label" style={{ margin: 0, color: 'var(--text-muted)' }}>Total Income</p>
            <p className="budget-summary-value" style={{ margin: 0, fontWeight: 700, color: 'var(--text-primary)' }}>{fmt(income)}</p>
          </div>
          <div style={{ textAlign: 'center' }}>
            <p className="budget-summary-label" style={{ margin: 0, color: 'var(--text-muted)' }}>Allocated</p>
            <p className="budget-summary-value" style={{ margin: 0, fontWeight: 700, color: 'var(--text-primary)' }}>{fmt(totalBudget)}</p>
          </div>
          <div style={{ textAlign: 'center' }}>
            <p className="budget-summary-label" style={{ margin: 0, color: 'var(--text-muted)' }}>Unallocated</p>
            <p className="budget-summary-value" style={{ margin: 0, fontWeight: 700, color: totalBudget > income ? '#ef4444' : 'var(--text-primary)' }}>{fmt(Math.max(0, income - totalBudget))}</p>
          </div>
        </div>
          <div className="budget-overview-right">
            <div className="budget-donut-wrap">
              <svg viewBox="0 0 100 100" width="120" height="120" className="budget-donut">
                <circle cx="50" cy="50" r="40" fill="none" stroke="var(--bg-elevated)" strokeWidth="12" />
                <circle
                  cx="50" cy="50" r="40" fill="none"
                  stroke={overallColor}
                  strokeWidth="12"
                  strokeDasharray={`${overallPct * 2.513} 251.3`}
                  strokeLinecap="butt"
                  transform="rotate(-90 50 50)"
                />
                <text x="50" y="46" textAnchor="middle" fontSize="14" fontWeight="700" fill="var(--text-primary)" fontFamily="'Playfair Display', serif">
                  {Math.round(overallPct)}%
                </text>
                <text x="50" y="60" textAnchor="middle" fontSize="8" fill="var(--text-muted)" fontFamily="'Courier Prime', monospace">
                  USED
                </text>
</svg>

            </div>
            {overBudgetCats.length > 0 ? (
              <div className="budget-alert">
                <AlertTriangle size={14} style={{ color: '#ef4444' }} />
                <span>{overBudgetCats.length} categor{overBudgetCats.length > 1 ? 'ies' : 'y'} over budget</span>
              </div>
            ) : (
              <div className="budget-alert ok">
                <CheckCircle size={14} style={{ color: '#10b981' }} />
                <span>All within limits</span>
              </div>
            )}
        </div>
        {/* Category budget rows */}
        <div className="card" style={{ marginTop: '2rem' }}>
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
                          <input
                            className="budget-inline-input"
                            type="number"
                            value={editVal}
                            autoFocus
                            onChange={e => setEditVal(e.target.value)}
                            onBlur={() => saveEdit(cat)}
                            onKeyDown={e => e.key === 'Enter' && saveEdit(cat)}
                          />
                        ) : (
                          <button className="budget-limit-btn" onClick={() => startEdit(cat)}>
                            {limit > 0 ? fmt(limit) : 'Set limit'}
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
