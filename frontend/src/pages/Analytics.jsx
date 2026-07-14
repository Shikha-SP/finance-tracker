import { useMemo } from 'react';
import { useTx } from '../context/TxContext';
import { getCategoryIcon } from '../utils/categoryIcons';
import { TrendingUp, TrendingDown, Activity, Award, Zap, Target } from 'lucide-react';

const fmt  = n  => '₹' + Math.abs(n).toLocaleString('en-IN', { maximumFractionDigits: 0 });
const fmtK = n  => n >= 1000 ? '₹' + (n / 1000).toFixed(1) + 'k' : fmt(n);

const MONTH_NAMES = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];

function BarPair({ income, expense, maxVal, month }) {
  const iH = maxVal > 0 ? Math.max(2, (income  / maxVal) * 100) + '%' : '4px';
  const eH = maxVal > 0 ? Math.max(2, (expense / maxVal) * 100) + '%' : '4px';
  return (
    <div className="analytics-col">
      <div className="analytics-bars">
        <div className="analytics-bar income-bar"  style={{ height: iH }} title={`Income: ${fmt(income)}`}  />
        <div className="analytics-bar expense-bar" style={{ height: eH }} title={`Expense: ${fmt(expense)}`} />
      </div>
      <span className="analytics-month-label">{month}</span>
    </div>
  );
}

function Analytics() {
  const { transactions, income, expense, total, byCategory, monthlyData, healthScore } = useTx();

  /* ── Day-of-week heatmap ── */
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

  /* ── Top category ── */
  const topCat = useMemo(() => {
    const entries = Object.entries(byCategory);
    if (!entries.length) return null;
    return entries.sort((a,b) => b[1]-a[1])[0];
  }, [byCategory]);

  /* ── Avg transaction ── */
  const avgExpense = useMemo(() => {
    const exps = transactions.filter(t => t.type === 'expense');
    return exps.length ? expense / exps.length : 0;
  }, [transactions, expense]);

  /* ── Monthly max ── */
  const maxMonthly = useMemo(() =>
    Math.max(...monthlyData.flatMap(m => [m.income, m.expense]), 1),
    [monthlyData]
  );

  const scoreColor = healthScore >= 75 ? '#10b981' : healthScore >= 50 ? '#f59e0b' : '#ef4444';
  const scoreLabel = healthScore >= 75 ? 'EXCELLENT' : healthScore >= 50 ? 'FAIR' : 'NEEDS ATTENTION';
  const savingsRate = income > 0 ? Math.round(((income - expense) / income) * 100) : 0;

  return (
    <main className="page">
      <div className="page-header">
        <div className="page-header-left">
          <h1 className="page-title">Analytics</h1>
          <p className="page-subtitle">Financial intelligence &bull; Deep analysis</p>
        </div>
      </div>

      <div className="page-content">
        {/* KPI Strip */}
        <div className="analytics-kpi-strip">
          <div className="kpi-card">
            <div className="kpi-icon" style={{ color: '#10b981' }}><TrendingUp size={20} /></div>
            <p className="kpi-label">Total Income</p>
            <p className="kpi-val" style={{ color: '#10b981' }}>{fmt(income)}</p>
          </div>
          <div className="kpi-card">
            <div className="kpi-icon" style={{ color: '#ef4444' }}><TrendingDown size={20} /></div>
            <p className="kpi-label">Total Expense</p>
            <p className="kpi-val" style={{ color: '#ef4444' }}>{fmt(expense)}</p>
          </div>
          <div className="kpi-card">
            <div className="kpi-icon" style={{ color: '#f59e0b' }}><Zap size={20} /></div>
            <p className="kpi-label">Avg. Transaction</p>
            <p className="kpi-val" style={{ color: '#f59e0b' }}>{fmt(avgExpense)}</p>
          </div>
          <div className="kpi-card">
            <div className="kpi-icon" style={{ color: '#6366f1' }}><Target size={20} /></div>
            <p className="kpi-label">Savings Rate</p>
            <p className="kpi-val" style={{ color: '#6366f1' }}>{savingsRate}%</p>
          </div>
        </div>

        <div className="analytics-grid">
          {/* Monthly chart */}
          <div className="card" style={{ display: 'flex', flexDirection: 'column' }}>
            <div className="card-header">
              <span className="card-title">Monthly Trend</span>
              <div style={{ display:'flex', gap:'1rem', alignItems:'center' }}>
                <span style={{ display:'flex', gap:'0.4rem', alignItems:'center', fontSize:'0.7rem', color:'var(--text-muted)', fontFamily:'Courier Prime, monospace', textTransform:'uppercase', letterSpacing:'0.08em' }}>
                  <span style={{ width:10, height:10, background:'#10b981', display:'inline-block' }}/> Income
                </span>
                <span style={{ display:'flex', gap:'0.4rem', alignItems:'center', fontSize:'0.7rem', color:'var(--text-muted)', fontFamily:'Courier Prime, monospace', textTransform:'uppercase', letterSpacing:'0.08em' }}>
                  <span style={{ width:10, height:10, background:'var(--accent)', display:'inline-block' }}/> Expense
                </span>
              </div>
            </div>
            <div className="card-body" style={{ flex: 1, display: 'flex', flexDirection: 'column' }}>
              {monthlyData.length === 0 ? (
                <div className="empty-state" style={{ padding:'3rem', flex: 1, justifyContent: 'center' }}>
                  <Activity size={32} style={{ color:'var(--text-muted)' }} />
                  <p className="empty-title">No data yet</p>
                </div>
              ) : (
                <div className="analytics-chart" style={{ flex: 1, height: 'auto', minHeight: '150px' }}>
                  {monthlyData.map(m => (
                    <BarPair
                      key={m.label}
                      income={m.income}
                      expense={m.expense}
                      maxVal={maxMonthly}
                      month={m.label.split(' ')[0]}
                    />
                  ))}
                </div>
              )}
            </div>
          </div>

          {/* Health score card */}
          <div className="card">
            <div className="card-header">
              <span className="card-title">Health Score</span>
              <Award size={18} style={{ color: scoreColor }} />
            </div>
            <div className="card-body" style={{ display:'flex', flexDirection:'column', alignItems:'center', gap:'1.5rem', padding:'2.5rem 2rem' }}>
              <svg viewBox="0 0 120 120" width="150" height="150">
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
              <div style={{ textAlign:'center' }}>
                <p style={{ fontFamily:"'Courier Prime', monospace", fontWeight:700, fontSize:'0.75rem', textTransform:'uppercase', letterSpacing:'0.12em', color: scoreColor }}>
                  {scoreLabel}
                </p>
                <p style={{ fontSize:'0.8rem', color:'var(--text-secondary)', marginTop:'0.5rem', lineHeight:1.5 }}>
                  Based on your savings rate and spending patterns
                </p>
              </div>
              <div style={{ width:'100%', display:'flex', flexDirection:'column', gap:'0.75rem' }}>
                {[
                  { label:'Savings Rate', val:`${savingsRate}%`, color: savingsRate >= 20 ? '#10b981' : '#f59e0b' },
                  { label:'Expense/Income', val: income > 0 ? `${Math.round((expense/income)*100)}%` : '—', color: income > 0 && expense/income < 0.7 ? '#10b981' : '#ef4444' },
                  { label:'Transactions', val: transactions.length, color:'#6366f1' },
                ].map(item => (
                  <div key={item.label} style={{ display:'flex', justifyContent:'space-between', alignItems:'center', borderBottom:'1px dashed var(--border)', paddingBottom:'0.5rem' }}>
                    <span style={{ fontSize:'0.75rem', fontFamily:"'Courier Prime', monospace", fontWeight:700, textTransform:'uppercase', letterSpacing:'0.06em', color:'var(--text-muted)' }}>{item.label}</span>
                    <span style={{ fontFamily:"'Playfair Display', serif", fontWeight:700, fontSize:'1rem', color: item.color }}>{item.val}</span>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>

        {/* Day-of-week heatmap */}
        <div className="card" style={{ marginTop:'2rem' }}>
          <div className="card-header">
            <span className="card-title">Spending by Day of Week</span>
            <span className="card-badge">Expenses only</span>
          </div>
          <div className="card-body">
            <div className="dow-heatmap">
              {byDow.map(({ day, val }) => {
                const intensity = maxDow > 0 ? val / maxDow : 0;
                return (
                  <div className="dow-cell" key={day}>
                    <div
                      className="dow-bar"
                      style={{
                        height: `${Math.max(6, intensity * 80)}px`,
                        background: `rgba(208, 163, 110, ${0.15 + intensity * 0.85})`,
                      }}
                      title={`${day}: ${fmt(val)}`}
                    />
                    <span className="dow-label">{day}</span>
                    <span className="dow-val">{val > 0 ? fmtK(val) : '—'}</span>
                  </div>
                );
              })}
            </div>
          </div>
        </div>

        {/* Top categories */}
        {Object.keys(byCategory).length > 0 && (
          <div className="card" style={{ marginTop:'2rem' }}>
            <div className="card-header">
              <span className="card-title">Expense Breakdown</span>
            </div>
            <div className="card-body">
              {Object.entries(byCategory).sort((a,b) => b[1]-a[1]).map(([cat, amt], i) => {
                const pct = expense > 0 ? (amt/expense)*100 : 0;
                const colors = ['#ef4444','#f59e0b','#10b981','#6366f1','#d0a36e','#ec4899'];
                const color  = colors[i % colors.length];
                return (
                  <div key={cat} style={{ marginBottom:'1.25rem' }}>
                    <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center', marginBottom:'0.5rem' }}>
                      <span style={{ display:'flex', alignItems:'center', gap:'0.75rem', fontSize:'0.875rem', fontFamily:"'Courier Prime',monospace", fontWeight:700, textTransform:'uppercase', letterSpacing:'0.06em', color:'var(--text-primary)' }}>
                        <span style={{ color }}>{getCategoryIcon(cat, 16)}</span>
                        {cat}
                      </span>
                      <span style={{ fontFamily:"'Playfair Display',serif", fontWeight:700, fontSize:'1rem', color }}>
                        {fmt(amt)} <span style={{ fontSize:'0.8rem', color:'var(--text-muted)' }}>({pct.toFixed(1)}%)</span>
                      </span>
                    </div>
                    <div className="progress-track">
                      <div className="progress-fill" style={{ width:`${pct}%`, background: color }} />
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

export default Analytics;
