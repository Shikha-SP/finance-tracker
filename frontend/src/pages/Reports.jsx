import { useMemo } from 'react';
import { useTx } from '../context/TxContext';
import { getCategoryIcon } from '../utils/categoryIcons';
import { BarChart3 } from 'lucide-react';

const fmt = n => '₹' + Math.abs(n).toLocaleString('en-IN', { maximumFractionDigits: 2 });

const BAR_COLORS = [
  '#f87171',   /* coral red */
  '#fbbf24',   /* amber */
  '#34d399',   /* emerald */
  '#818cf8',   /* indigo */
  '#d0a36e',   /* gold */
  '#fb7185',   /* rose */
  '#38bdf8',   /* sky */
  '#a78bfa',   /* violet */
];

function Reports() {
  const { transactions, income, expense } = useTx();

  // Category breakdown (expenses only)
  const byCategory = useMemo(() => {
    const map = {};
    transactions
      .filter(t => t.type === 'expense')
      .forEach(t => {
        map[t.category] = (map[t.category] || 0) + t.amount;
      });
    return Object.entries(map).sort((a, b) => b[1] - a[1]);
  }, [transactions]);

  // Monthly aggregation (last 6 months)
  const monthlyData = useMemo(() => {
    const map = {};
    transactions.forEach(t => {
      const key = t.monthKey || 'Unknown';
      if (!map[key]) map[key] = { income: 0, expense: 0 };
      if (t.type === 'income')  map[key].income  += t.amount;
      if (t.type === 'expense') map[key].expense += t.amount;
    });
    return Object.entries(map).slice(-6);
  }, [transactions]);

  const maxMonthVal = useMemo(
    () => Math.max(...monthlyData.flatMap(([, v]) => [v.income, v.expense]), 1),
    [monthlyData]
  );

  const savingsRate = income > 0 ? Math.round(((income - expense) / income) * 100) : 0;
  const expenseIncomeRatio = income > 0 ? Math.round((expense / income) * 100) : 0;

  if (transactions.length === 0) {
    return (
      <main className="page">
        <div className="page-header">
          <div className="page-header-left">
            <h1 className="page-title">Reports</h1>
            <p className="page-subtitle">Insights from your financial activity.</p>
          </div>
        </div>
        <div className="page-content">
          <div style={{
            display: 'flex', flexDirection: 'column', alignItems: 'center',
            justifyContent: 'center', padding: '5rem 2rem', gap: '0.75rem',
            textAlign: 'center',
            border: '1px dashed var(--border-strong)',
            borderRadius: 'var(--radius-lg)',
            background: 'var(--bg-surface)',
          }}>
            <div className="empty-icon"><BarChart3 size={48} /></div>
            <p style={{ fontWeight: 600, color: 'var(--text-primary)' }}>No data yet</p>
            <p style={{ fontSize: '0.85rem', color: 'var(--text-muted)', maxWidth: 280 }}>
              Add some transactions first and your spending insights will appear here automatically.
            </p>
          </div>
        </div>
      </main>
    );
  }

  return (
    <main className="page">
      <div className="page-header">
        <div className="page-header-left">
          <h1 className="page-title">Reports</h1>
          <p className="page-subtitle">Insights from your financial activity.</p>
        </div>
      </div>

      <div className="page-content">
        {/* Summary stats */}
        <div className="stat-grid" style={{ marginBottom: '1.2rem' }}>
          <div className="stat-card">
            <div className="stat-header">
              <span className="stat-label">Total Income</span>
            </div>
            <div className="stat-value" style={{ color: 'var(--green)' }}>{fmt(income)}</div>
            <div className="stat-trend">{transactions.filter(t => t.type === 'income').length} entries</div>
          </div>
          <div className="stat-card">
            <div className="stat-header">
              <span className="stat-label">Total Expenses</span>
            </div>
            <div className="stat-value" style={{ color: 'var(--red)' }}>{fmt(expense)}</div>
            <div className="stat-trend">{transactions.filter(t => t.type === 'expense').length} entries</div>
          </div>
          <div className="stat-card">
            <div className="stat-header">
              <span className="stat-label">Savings Rate</span>
            </div>
            <div
              className="stat-value"
              style={{ color: savingsRate >= 0 ? 'var(--green)' : 'var(--red)' }}
            >
              {savingsRate}%
            </div>
            <div className="stat-trend">Spend ratio: {expenseIncomeRatio}%</div>
          </div>
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1.2rem' }}>
          {/* Category breakdown */}
          {byCategory.length > 0 && (
            <div className="card">
              <div className="card-header">
                <span className="card-title">Expense Breakdown</span>
                <span className="card-badge">{byCategory.length} categories</span>
              </div>
              <div className="card-body">
                {byCategory.map(([cat, amount], i) => {
                  const pct = expense > 0 ? (amount / expense) * 100 : 0;
                  return (
                    <div className="category-row" key={cat}>
                      <div className="category-row-header">
                        <span className="category-name">
                          <span className="category-name-icon">
                            {getCategoryIcon(cat, 16)}
                          </span>
                          {cat}
                        </span>
                        <span className="category-pct">
                          {fmt(amount)} · {pct.toFixed(0)}%
                        </span>
                      </div>
                      <div className="progress-track">
                        <div
                          className="progress-fill"
                          style={{
                            width: `${pct}%`,
                            background: BAR_COLORS[i % BAR_COLORS.length],
                          }}
                        />
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          {/* Monthly bar chart */}
          {monthlyData.length > 0 && (
            <div className="card">
              <div className="card-header">
                <span className="card-title">Monthly Activity</span>
                <span className="card-badge">{monthlyData.length} months</span>
              </div>
              <div className="card-body">
                <div className="chart-legend">
                  <div className="legend-item">
                    <div className="legend-dot" style={{ background: 'var(--green)' }} />
                    Income
                  </div>
                  <div className="legend-item">
                    <div className="legend-dot" style={{ background: 'var(--red)' }} />
                    Expenses
                  </div>
                </div>
                <div className="month-chart">
                  {monthlyData.map(([month, val]) => (
                    <div className="month-col" key={month}>
                      <div className="month-bars">
                        <div
                          className="month-bar income-bar"
                          style={{ height: `${(val.income / maxMonthVal) * 90}px` }}
                          title={`Income: ${fmt(val.income)}`}
                        />
                        <div
                          className="month-bar expense-bar"
                          style={{ height: `${(val.expense / maxMonthVal) * 90}px` }}
                          title={`Expense: ${fmt(val.expense)}`}
                        />
                      </div>
                      <span className="month-label">{month.split(' ')[0]}</span>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          )}
        </div>

        {/* Top spending categories list */}
        {byCategory.length > 0 && (
          <div className="card" style={{ marginTop: '1.2rem' }}>
            <div className="card-header">
              <span className="card-title">Category Details</span>
            </div>
            <div className="transaction-list">
              {byCategory.map(([cat, amount]) => {
                const count = transactions.filter(
                  t => t.type === 'expense' && t.category === cat
                ).length;
                const pct = expense > 0 ? ((amount / expense) * 100).toFixed(1) : '0';
                return (
                  <div className="transaction-item" key={cat}>
                    <div className="tx-left">
                      <div className="tx-icon-wrap expense">
                        {getCategoryIcon(cat, 18)}
                      </div>
                      <div className="tx-info">
                        <p className="tx-desc">{cat}</p>
                        <p className="tx-meta">{count} transaction{count !== 1 ? 's' : ''}</p>
                      </div>
                    </div>
                    <div className="tx-right">
                      <p className="tx-amount negative">{fmt(amount)}</p>
                      <span className="card-badge">{pct}%</span>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        )}
      </div>
    </main>
  );
}

export default Reports;
