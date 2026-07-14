import { useNavigate } from 'react-router-dom';
import TopNav from '../components/TopNav';
import { Activity, TrendingUp, TrendingDown, FileBarChart, Wallet, FileText, BarChart3, ShieldCheck, Zap } from 'lucide-react';
import { getCategoryIcon } from '../utils/categoryIcons';

const fmt = n => '$' + Math.abs(n).toLocaleString('en-US', { maximumFractionDigits: 2 });
const today = new Date().toLocaleDateString('en-US', {
  weekday: 'long', month: 'long', day: 'numeric', year: 'numeric'
});

const dummyTransactions = [
  { id: 1, type: 'expense', category: 'Housing', description: 'Monthly Rent', date: 'Oct 01, 2026', amount: 2500 },
  { id: 2, type: 'income', category: 'Salary', description: 'Tech Corp Payroll', date: 'Sep 30, 2026', amount: 8400 },
  { id: 3, type: 'expense', category: 'Food', description: 'Whole Foods Market', date: 'Sep 28, 2026', amount: 142.50 },
  { id: 4, type: 'expense', category: 'Transport', description: 'Uber Rides', date: 'Sep 27, 2026', amount: 34.20 },
];

export default function Landing() {
  const navigate = useNavigate();

  return (
    <div className="app-wrapper">
      <TopNav />
      
      <main className="page" style={{ paddingTop: '70px', minHeight: '100vh' }}>
        {/* ── Hero Masthead with Wall Street bg ── */}
        <div className="masthead">
          <div className="masthead-inner">
            {/* Left: headline */}
            <div className="masthead-left">
              <div className="masthead-kicker">
                <Activity size={11} style={{ display: 'inline' }} />
                Next-Gen Wealth Management
              </div>
              <h1 className="masthead-title">The Daily<br />Ledger</h1>
              <div className="masthead-rule" />
              <div className="masthead-dateline">{today}</div>
            </div>

            {/* Right: glass panel with balance */}
            <div className="masthead-panel">
              <div className="masthead-panel-title">Portfolio Summary (Demo)</div>

              <div className="balance-strip">
                <div className="balance-strip-left">
                  <p className="balance-strip-label">Net Treasury Balance</p>
                  <p className="balance-strip-amount is-positive">
                    +{fmt(124500.80)}
                  </p>
                </div>

                <div className="balance-strip-right">
                  <div className="balance-stat">
                    <TrendingUp size={13} style={{ color: 'var(--green)' }} />
                    <span className="balance-stat-label">Deposits</span>
                    <span className="balance-stat-val pop-green">{fmt(8400)}</span>
                  </div>
                  <div className="balance-stat">
                    <TrendingDown size={13} style={{ color: 'var(--red)' }} />
                    <span className="balance-stat-label">Debits</span>
                    <span className="balance-stat-val pop-red">{fmt(2676.70)}</span>
                  </div>
                  <div className="balance-stat">
                    <span className="balance-stat-label">Savings</span>
                    <span className="balance-stat-val pop-amber">68%</span>
                  </div>
                </div>
              </div>

              {/* Quick actions inside panel */}
              <div style={{ display: 'flex', flexDirection: 'column', gap: '0.6rem', marginTop: '1rem', paddingTop: '1rem', borderTop: '1px solid var(--border)' }}>
                <button className="btn-primary" style={{ width: '100%', fontSize: '0.75rem' }} onClick={() => navigate('/signup')}>
                  <Wallet size={13} /> Start Your Ledger
                </button>
              </div>
            </div>
          </div>
        </div>

        {/* ── Main content (Marketing & Demo) ── */}
        <div className="broadsheet" id="features">
          {/* LEFT: Ledger entries */}
          <div className="broadsheet-main">
            <div className="ledger-block">
              <div className="ledger-block-header">
                <h2 className="ledger-block-title">Live Ledger Preview</h2>
              </div>
              <div className="transaction-list">
                {dummyTransactions.map(tx => (
                  <div className={`transaction-item ${tx.type === 'income' ? 'is-income' : 'is-expense'}`} key={tx.id}>
                    <div className="tx-left">
                      <div className="tx-icon-wrap">
                        {getCategoryIcon(tx.category, 16)}
                      </div>
                      <div className="tx-info">
                        <p className="tx-desc">{tx.description}</p>
                        <p className="tx-meta">{tx.category} &middot; {tx.date}</p>
                      </div>
                    </div>
                    <div className="tx-right">
                      <p className={`tx-amount ${tx.type === 'income' ? 'positive' : 'negative'}`}>
                        {tx.type === 'income' ? '+' : '−'}{fmt(tx.amount)}
                      </p>
                    </div>
                  </div>
                ))}
              </div>
            </div>

            {/* Features Grid */}
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(250px, 1fr))', gap: '1.5rem', marginTop: '2rem' }}>
              <div className="stat-card" style={{ minHeight: '160px' }}>
                <ShieldCheck size={28} color="var(--accent)" style={{ marginBottom: '1rem' }} />
                <h3 style={{ fontSize: '1.1rem', fontWeight: 800 }}>Bank-Level Security</h3>
                <p style={{ fontSize: '0.8rem', color: 'var(--text-secondary)' }}>Your financial data is encrypted and securely stored. We never sell your data.</p>
              </div>
              <div className="stat-card" style={{ minHeight: '160px' }}>
                <BarChart3 size={28} color="var(--accent)" style={{ marginBottom: '1rem' }} />
                <h3 style={{ fontSize: '1.1rem', fontWeight: 800 }}>Visual Analytics</h3>
                <p style={{ fontSize: '0.8rem', color: 'var(--text-secondary)' }}>Track your wealth over time with stunning charts and deep-dive reports.</p>
              </div>
              <div className="stat-card" style={{ minHeight: '160px' }}>
                <Zap size={28} color="var(--accent)" style={{ marginBottom: '1rem' }} />
                <h3 style={{ fontSize: '1.1rem', fontWeight: 800 }}>Instant Insights</h3>
                <p style={{ fontSize: '0.8rem', color: 'var(--text-secondary)' }}>Get AI-driven tips on where to cut expenses and how to maximize your savings rate.</p>
              </div>
            </div>
          </div>

          {/* RIGHT: sidebar stats */}
          <aside className="broadsheet-side">
            {/* Quote */}
            <div>
              <div className="side-section-label">Market Wisdom</div>
              <blockquote className="pull-quote" style={{ marginTop: '0.5rem' }}>
                "The stock market is a device for transferring money from the impatient to the patient."
                <cite className="pull-quote-cite">— Warren Buffett</cite>
              </blockquote>
            </div>

            {/* Testimonial */}
            <div id="testimonials">
              <div className="side-section-label">What Users Say</div>
              <div style={{ marginTop: '1rem', padding: '1rem', background: 'var(--bg-glass)', borderRadius: '12px', border: '1px solid var(--border)' }}>
                <p style={{ fontSize: '0.85rem', fontStyle: 'italic', color: 'var(--text-primary)' }}>
                  "LedgerLive changed how I view my net worth. The design is absolutely breathtaking compared to messy spreadsheets."
                </p>
                <div style={{ marginTop: '0.8rem', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                  <div style={{ width: '24px', height: '24px', borderRadius: '50%', background: 'var(--accent)', color: '#000', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '0.6rem', fontWeight: 800 }}>
                    JS
                  </div>
                  <div>
                    <div style={{ fontSize: '0.7rem', fontWeight: 700 }}>Jane Smith</div>
                    <div style={{ fontSize: '0.6rem', color: 'var(--text-muted)' }}>Retail Investor</div>
                  </div>
                </div>
              </div>
            </div>
          </aside>
        </div>
        
        {/* Footer */}
        <footer style={{ borderTop: '1px solid var(--border)', padding: '2rem 2.5rem', textAlign: 'center', color: 'var(--text-muted)', fontSize: '0.75rem', marginTop: '2rem' }}>
          <p>&copy; {new Date().getFullYear()} LedgerLive Capital Management. All rights reserved.</p>
        </footer>
      </main>
    </div>
  );
}
