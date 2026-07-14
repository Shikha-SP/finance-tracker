import { useTx } from '../context/TxContext';
import { useNavigate } from 'react-router-dom';
import { getCategoryIcon } from '../utils/categoryIcons';
import { Wallet, TrendingUp, TrendingDown, Activity, CreditCard } from 'lucide-react';
import { AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, PieChart, Pie, Cell } from 'recharts';

const fmt = n => '₹' + Math.abs(n).toLocaleString('en-IN', { maximumFractionDigits: 2 });
const COLORS = ['#10b981', '#ef4444', '#f59e0b', '#3b82f6', '#8b5cf6'];

function Home() {
  const { transactions, total, income, expense, monthlyData } = useTx();
  const navigate = useNavigate();
  
  const recent = transactions.slice(0, 5);
  const savingsRate = income > 0 ? Math.round(((income - expense) / income) * 100) : 0;

  // Use real monthly data, or empty if none
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

  return (
    <main className="page" style={{ padding: '2rem 2.5rem', background: 'var(--bg-base)' }}>
      {/* ── Dashboard Header ── */}
      <div className="page-header" style={{ borderBottom: 'none', padding: '0 0 1.5rem' }}>
        <div className="page-header-left">
          <h1 className="page-title">Dashboard Overview</h1>
          <p className="page-subtitle">Welcome back! Here's what's happening with your finances today.</p>
        </div>
        <div>
          <button className="btn-primary" onClick={() => navigate('/transactions')}>
            <Wallet size={14} style={{ marginRight: '0.4rem' }}/> Log Transaction
          </button>
        </div>
      </div>

      {/* ── KPI Stat Cards ── */}
      <div className="stat-grid" style={{ gridTemplateColumns: 'repeat(4, 1fr)', gap: '1.25rem', marginBottom: '1.5rem' }}>
        <div className="stat-card" style={{ padding: '1.25rem' }}>
          <div className="stat-header" style={{ borderBottom: 'none', paddingBottom: 0 }}>
            <span className="stat-label">Net Balance</span>
            <div className="stat-icon"><Activity size={18} /></div>
          </div>
          <div className="stat-value" style={{ fontSize: '1.75rem', marginTop: '0.5rem', color: 'var(--text-primary)' }}>
            {total < 0 ? '−' : ''}{fmt(total)}
          </div>
        </div>
        <div className="stat-card" style={{ padding: '1.25rem' }}>
          <div className="stat-header" style={{ borderBottom: 'none', paddingBottom: 0 }}>
            <span className="stat-label">Total Income</span>
            <div className="stat-icon"><TrendingUp size={18} color="var(--green)"/></div>
          </div>
          <div className="stat-value" style={{ fontSize: '1.75rem', marginTop: '0.5rem', color: 'var(--green)' }}>
            +{fmt(income)}
          </div>
        </div>
        <div className="stat-card" style={{ padding: '1.25rem' }}>
          <div className="stat-header" style={{ borderBottom: 'none', paddingBottom: 0 }}>
            <span className="stat-label">Total Expenses</span>
            <div className="stat-icon"><TrendingDown size={18} color="var(--red)"/></div>
          </div>
          <div className="stat-value" style={{ fontSize: '1.75rem', marginTop: '0.5rem', color: 'var(--red)' }}>
            −{fmt(expense)}
          </div>
        </div>
        <div className="stat-card" style={{ padding: '1.25rem' }}>
          <div className="stat-header" style={{ borderBottom: 'none', paddingBottom: 0 }}>
            <span className="stat-label">Savings Rate</span>
            <div className="stat-icon"><CreditCard size={18} color="var(--amber)"/></div>
          </div>
          <div className="stat-value" style={{ fontSize: '1.75rem', marginTop: '0.5rem', color: 'var(--amber)' }}>
            {savingsRate}%
          </div>
        </div>
      </div>

      {/* ── Main Charts Area ── */}
      <div style={{ display: 'grid', gridTemplateColumns: '2fr 1fr', gap: '1.5rem', marginBottom: '1.5rem' }}>
        
        {/* Cash Flow Chart */}
        <div className="ledger-block" style={{ padding: '1.5rem' }}>
          <h3 style={{ fontSize: '0.85rem', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.1em', marginBottom: '1.5rem' }}>Cash Flow Trend</h3>
          <div style={{ width: '100%', height: 280 }}>
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={areaData} margin={{ top: 10, right: 10, left: 0, bottom: 0 }}>
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

        {/* Expense Breakdown */}
        <div className="ledger-block" style={{ padding: '1.5rem', display: 'flex', flexDirection: 'column' }}>
          <h3 style={{ fontSize: '0.85rem', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.1em', marginBottom: '1rem' }}>Expenses by Category</h3>
          <div style={{ flex: 1, minHeight: 200 }}>
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
    </main>
  );
}

export default Home;