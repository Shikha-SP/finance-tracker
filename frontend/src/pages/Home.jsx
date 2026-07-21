import { useMemo } from 'react';
import { useTx } from '../context/TxContext';
import { useNavigate } from 'react-router-dom';
import { getCategoryIcon } from '../utils/categoryIcons';
import { Wallet, TrendingUp, TrendingDown, Activity, CreditCard, Award } from 'lucide-react';
import { AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, PieChart, Pie, Cell } from 'recharts';

const fmt = n => 'रू ' + Math.abs(n).toLocaleString('en-IN', { maximumFractionDigits: 2 });
const fmtK = n  => n >= 1000 ? 'रू ' + (n / 1000).toFixed(1) + 'k' : fmt(n);
const COLORS = ['#10b981', '#ef4444', '#f59e0b', '#3b82f6', '#8b5cf6', '#d0a36e', '#ec4899'];

function Home() {
  const { transactions, total, income, expense, monthlyData, healthScore } = useTx();
  const navigate = useNavigate();
  
  const recent = transactions.slice(0, 5);
  const savingsRate = income > 0 ? Math.round(((income - expense) / income) * 100) : 0;
  
  // Health score colors & labels
  const scoreColor = healthScore >= 75 ? '#10b981' : healthScore >= 50 ? '#f59e0b' : '#ef4444';
  const scoreLabel = healthScore >= 75 ? 'EXCELLENT' : healthScore >= 50 ? 'FAIR' : 'NEEDS ATTENTION';

  // Area Chart Data
  const areaData = monthlyData.length > 0 
    ? monthlyData.map(m => ({
        name: m.label.split(' ')[0], // e.g., "Oct" from "Oct 2026"
        income: m.income,
        expense: m.expense
      }))
    : [
        { name: 'No Data', income: 0, expense: 0 }
      ];

  // Aggregate category data for PieChart
  const expenseTxs = transactions.filter(t => t.type === 'expense');
  const catMap = expenseTxs.reduce((acc, tx) => {
    acc[tx.category] = (acc[tx.category] || 0) + tx.amount;
    return acc;
  }, {});
  const pieData = Object.keys(catMap).map(key => ({ name: key, value: catMap[key] }));
  if (pieData.length === 0) {
    pieData.push({ name: 'No Data', value: 1 });
  }

  // Day of week heatmap data
  const byDow = useMemo(() => {
    const days = ['Sun','Mon','Tue','Wed','Thu','Fri','Sat'];
    const map  = days.reduce((a, d) => ({ ...a, [d]: 0 }), {});
    transactions.filter(t => t.type === 'expense').forEach(t => {
      const d = new Date(t.date);
      if (!isNaN(d)) map[days[d.getDay()]] += t.amount;
    });
    return days.map(d => ({ day: d, val: map[d] }));
  }, [transactions]);
  const maxDow = Math.max(...byDow.map(d => d.val), 1);

  return (
    <main className="page">
      {/* ── Dashboard Header ── */}
      <div className="page-header">
        <div className="page-header-left">
          <h1 className="page-title">Portfolio Overview</h1>
          <p className="page-subtitle">Your financial snapshot · Nepal Rupee (NPR)</p>
        </div>
        <div>
          <button className="btn-primary" onClick={() => navigate('/budget/transactions')}>
            <Wallet size={14} style={{ marginRight: '0.4rem' }}/> Log Transaction
          </button>
        </div>
      </div>

      <div className="page-content">
      {/* ── KPI Stat Cards ── */}
      <div className="stat-grid">
        <div className="stat-card">
          <div className="stat-header">
            <span className="stat-label">Net Balance</span>
            <div className="stat-icon"><Activity size={18} /></div>
          </div>
          <div className="stat-value" style={{ color: 'var(--text-primary)' }}>
            {total < 0 ? '−' : ''}{fmt(total)}
          </div>
        </div>
        <div className="stat-card">
          <div className="stat-header">
            <span className="stat-label">Total Income</span>
            <div className="stat-icon"><TrendingUp size={18} color="var(--green)"/></div>
          </div>
          <div className="stat-value" style={{ color: 'var(--green)' }}>
            +{fmt(income)}
          </div>
        </div>
        <div className="stat-card">
          <div className="stat-header">
            <span className="stat-label">Total Expenses</span>
            <div className="stat-icon"><TrendingDown size={18} color="var(--red)"/></div>
          </div>
          <div className="stat-value" style={{ color: 'var(--red)' }}>
            −{fmt(expense)}
          </div>
        </div>
        <div className="stat-card">
          <div className="stat-header">
            <span className="stat-label">Savings Rate</span>
            <div className="stat-icon"><CreditCard size={18} color="var(--amber)"/></div>
          </div>
          <div className="stat-value" style={{ color: 'var(--amber)' }}>
            {savingsRate}%
          </div>
        </div>
      </div>

      {/* ── Primary Charts Area (Cash Flow & Health Score) ── */}
      <div style={{ display: 'grid', gridTemplateColumns: '2fr 1fr', gap: '1.5rem', marginBottom: '1.5rem' }}>
        
        {/* Cash Flow Chart */}
        <div className="ledger-block" style={{ padding: '1.5rem' }}>
          <h3 style={{ fontSize: '0.85rem', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.1em', marginBottom: '1.5rem' }}>Cash Flow Trend</h3>
          <div style={{ width: '100%', height: 280 }}>
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={areaData} margin={{ top: 10, right: 10, left: 0, bottom: 15 }}>
                <defs>
                  <linearGradient id="colorIncome" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="var(--green)" stopOpacity={0.3}/>
                    <stop offset="95%" stopColor="var(--green)" stopOpacity={0}/>
                  </linearGradient>
                  <linearGradient id="colorExpense" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="var(--red)" stopOpacity={0.3}/>
                    <stop offset="95%" stopColor="var(--red)" stopOpacity={0}/>
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" vertical={false} />
                <XAxis dataKey="name" stroke="var(--text-muted)" fontSize={12} tickLine={false} axisLine={false} />
                <YAxis stroke="var(--text-muted)" fontSize={12} tickLine={false} axisLine={false} tickFormatter={(val) => '$'+val} />
                <Tooltip 
                  contentStyle={{ backgroundColor: 'var(--bg-card)', borderColor: 'var(--border-strong)', borderRadius: '8px' }}
                  itemStyle={{ fontSize: '0.8rem', fontWeight: 600 }}
                />
                <Area type="monotone" dataKey="income" stroke="var(--green)" strokeWidth={3} fillOpacity={1} fill="url(#colorIncome)" />
                <Area type="monotone" dataKey="expense" stroke="var(--red)" strokeWidth={3} fillOpacity={1} fill="url(#colorExpense)" />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        </div>

        {/* Health Score Card */}
        <div className="ledger-block" style={{ display: 'flex', flexDirection: 'column' }}>
          <div style={{ padding: '1.25rem 1.5rem', borderBottom: '1px solid var(--border)', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <h3 style={{ fontSize: '0.85rem', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.1em' }}>Health Score</h3>
            <Award size={18} style={{ color: scoreColor }} />
          </div>
          <div style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', padding: '2rem 1.5rem' }}>
            <svg viewBox="0 0 120 120" width="140" height="140">
              <circle cx="60" cy="60" r="50" fill="none" stroke="var(--bg-elevated)" strokeWidth="14"/>
              <circle
                cx="60" cy="60" r="50" fill="none"
                stroke={scoreColor} strokeWidth="14"
                strokeDasharray={`${healthScore * 3.14} 314`}
                strokeLinecap="butt"
                transform="rotate(-90 60 60)"
              />
              <text x="60" y="56" textAnchor="middle" fontSize="22" fontWeight="800" fill={scoreColor} fontFamily="'Playfair Display', serif">
                {healthScore}
              </text>
              <text x="60" y="72" textAnchor="middle" fontSize="9" fill="var(--text-muted)" fontFamily="'Courier Prime', monospace">
                / 100
              </text>
            </svg>
            <div style={{ textAlign: 'center', marginTop: '1.25rem' }}>
              <p style={{ fontFamily:"'Courier Prime', monospace", fontWeight:700, fontSize:'0.75rem', textTransform:'uppercase', letterSpacing:'0.12em', color: scoreColor }}>
                {scoreLabel}
              </p>
              <p style={{ fontSize:'0.8rem', color:'var(--text-secondary)', marginTop:'0.5rem' }}>
                Based on your savings rate & spending
              </p>
            </div>
          </div>
        </div>

      </div>

      {/* ── Secondary Charts Area (Expense Breakdown & Heatmap) ── */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1.5rem', marginBottom: '1.5rem' }}>
        
        {/* Expense Breakdown */}
        <div className="ledger-block" style={{ padding: '1.5rem', display: 'flex', flexDirection: 'column' }}>
          <h3 style={{ fontSize: '0.85rem', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.1em', marginBottom: '1rem' }}>Expenses by Category</h3>
          <div style={{ flex: 1, minHeight: 220, paddingBottom: '1.5rem' }}>
            <ResponsiveContainer width="100%" height="100%">
              <PieChart>
                <Pie data={pieData} cx="50%" cy="50%" innerRadius={60} outerRadius={80} paddingAngle={5} dataKey="value" stroke="none">
                  {pieData.map((entry, index) => (
                    <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                  ))}
                </Pie>
                <Tooltip 
                  contentStyle={{ backgroundColor: 'var(--bg-card)', borderColor: 'var(--border-strong)', borderRadius: '8px', fontSize: '0.8rem' }}
                />
              </PieChart>
            </ResponsiveContainer>
          </div>
        </div>

        {/* Day-of-week heatmap */}
        <div className="ledger-block" style={{ padding: '1.5rem', display: 'flex', flexDirection: 'column' }}>
          <h3 style={{ fontSize: '0.85rem', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.1em', marginBottom: '1.5rem' }}>Spending by Day of Week</h3>
          <div className="dow-heatmap" style={{ flex: 1, display: 'flex', alignItems: 'flex-end', justifyContent: 'space-between', gap: '0.5rem', marginTop: 'auto' }}>
            {byDow.map(({ day, val }) => {
              const intensity = maxDow > 0 ? val / maxDow : 0;
              return (
                <div className="dow-cell" key={day} style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '0.5rem' }}>
                  <div
                    className="dow-bar"
                    style={{
                      width: '32px',
                      borderRadius: '4px',
                      height: `${Math.max(6, intensity * 140)}px`,
                      background: `rgba(208, 163, 110, ${0.15 + intensity * 0.85})`,
                      transition: 'height 0.3s ease'
                    }}
                    title={`${day}: ${fmt(val)}`}
                  />
                  <span className="dow-label" style={{ fontSize: '0.7rem', color: 'var(--text-muted)', fontFamily: "'Courier Prime', monospace" }}>{day}</span>
                  <span className="dow-val" style={{ fontSize: '0.75rem', fontWeight: 'bold' }}>{val > 0 ? fmtK(val) : '—'}</span>
                </div>
              );
            })}
          </div>
        </div>

      </div>

      {/* ── Recent Transactions ── */}
      <div className="ledger-block" style={{ padding: '0', overflow: 'hidden' }}>
        <div className="ledger-block-header" style={{ padding: '1.25rem 1.5rem', borderLeft: 'none' }}>
          <h2 className="ledger-block-title" style={{ fontSize: '0.85rem' }}>Recent Transactions</h2>
        </div>
        <div className="transaction-list" style={{ padding: '0.5rem 1.5rem 1.5rem' }}>
          {recent.length === 0 ? (
            <p className="empty-text" style={{ textAlign: 'center', margin: '2rem 0' }}>No recent transactions.</p>
          ) : (
            recent.map(tx => (
              <div className={`transaction-item ${tx.type === 'income' ? 'is-income' : 'is-expense'}`} key={tx.id} style={{ padding: '0.75rem 0', borderBottom: '1px solid var(--border)' }}>
                <div className="tx-left">
                  <div className="tx-icon-wrap" style={{ width: '32px', height: '32px' }}>
                    {getCategoryIcon(tx.category, 14)}
                  </div>
                  <div className="tx-info">
                    <p className="tx-desc" style={{ fontSize: '0.85rem' }}>{tx.description}</p>
                    <p className="tx-meta" style={{ fontSize: '0.7rem' }}>{tx.category} &middot; {tx.date}</p>
                  </div>
                </div>
                <div className="tx-right">
                  <p className={`tx-amount ${tx.type === 'income' ? 'positive' : 'negative'}`} style={{ fontSize: '0.9rem' }}>
                    {tx.type === 'income' ? '+' : '−'}{fmt(tx.amount)}
                  </p>
                </div>
              </div>
            ))
          )}
        </div>
      </div>
      </div>
    </main>
  );
}

export default Home;