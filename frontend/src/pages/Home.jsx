import { useTx } from '../context/TxContext';
import { useNavigate } from 'react-router-dom';
import { getCategoryIcon } from '../utils/categoryIcons';
import { FileText, Trash2, Wallet, FileBarChart, TrendingUp, TrendingDown } from 'lucide-react';

const fmt = n => '₹' + Math.abs(n).toLocaleString('en-IN', { maximumFractionDigits: 2 });
const today = new Date().toLocaleDateString('en-US', {
  weekday: 'long', month: 'long', day: 'numeric', year: 'numeric'
});

function Home() {
  const { transactions, total, income, expense, deleteTransaction } = useTx();
  const navigate = useNavigate();
  const recent = transactions.slice(0, 6);
  const savingsRate = income > 0 ? Math.round(((income - expense) / income) * 100) : 0;

  return (
    <main className="page">
      {/* ── Masthead ── */}
      <div className="masthead">
        <div className="masthead-kicker">Est. {new Date().getFullYear()} &bull; Personal Finance Edition</div>
        <h1 className="masthead-title">THE DAILY LEDGER</h1>
        <div className="masthead-rule" />
        <div className="masthead-dateline">{today}</div>
      </div>

      <div className="page-content" style={{ paddingTop: 0 }}>
        {/* ── Broadsheet grid ── */}
        <div className="broadsheet">

          {/* ── LEFT: main content ── */}
          <div className="broadsheet-main">

            {/* Hero image — full bleed, editorial */}
            <div className="hero-image-block">
              <img src="/hero_collage.png" alt="Financial Market Collage" className="hero-full-img" />
              <div className="hero-caption">
                <span className="hero-caption-label">MARKET DISPATCH</span>
                Mixed-media collage · Capital markets roundup · {today}
              </div>
            </div>

            {/* Balance strip */}
            <div className="balance-strip">
              <div className="balance-strip-left">
                <p className="balance-strip-label">Net Treasury Balance</p>
                <p className={`balance-strip-amount ${total >= 0 ? 'is-positive' : 'is-negative'}`}>
                  {total < 0 ? '−' : '+'}{fmt(total)}
                </p>
              </div>
              <div className="balance-strip-divider" />
              <div className="balance-strip-right">
                <div className="balance-stat">
                  <TrendingUp size={14} style={{ color: 'var(--green)' }} />
                  <span className="balance-stat-label">Deposits</span>
                  <span className="balance-stat-val pop-green">{fmt(income)}</span>
                </div>
                <div className="balance-stat">
                  <TrendingDown size={14} style={{ color: 'var(--red)' }} />
                  <span className="balance-stat-label">Debits</span>
                  <span className="balance-stat-val pop-red">{fmt(expense)}</span>
                </div>
                <div className="balance-stat">
                  <span className="balance-stat-label">Savings</span>
                  <span className="balance-stat-val pop-amber">{savingsRate}%</span>
                </div>
              </div>
            </div>

            {/* Ledger entries */}
            <div className="ledger-block">
              <div className="ledger-block-header">
                <h2 className="ledger-block-title">Recent Entries</h2>
                {transactions.length > 6 && (
                  <button className="btn-outline" onClick={() => navigate('/transactions')}
                    style={{ fontSize: '0.7rem', padding: '0.3rem 0.75rem' }}>
                    Full Ledger
                  </button>
                )}
              </div>

              {recent.length === 0 ? (
                <div className="empty-state">
                  <div className="empty-icon"><FileText size={36} /></div>
                  <p className="empty-title">No entries recorded</p>
                  <p className="empty-text">Begin by logging your first voucher.</p>
                </div>
              ) : (
                <div className="transaction-list">
                  {recent.map(tx => (
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
                        <button className="btn-ghost" onClick={() => deleteTransaction(tx.id)}>
                          <Trash2 size={13} />
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>

          {/* ── RIGHT: editorial sidebar ── */}
          <aside className="broadsheet-side">
            {/* Sidebar collage image */}
            <div className="side-image-block">
              <img src="/sidebar_collage.png" alt="Ticker Tape Collage" className="side-full-img" />
              <div className="side-img-caption">Fig. I — Capital Assets, Mixed Media</div>
            </div>

            {/* Pull quote */}
            <blockquote className="pull-quote">
              "The stock market is a device for transferring money from the impatient to the patient."
              <cite className="pull-quote-cite">— Warren Buffett</cite>
            </blockquote>

            {/* Quick actions */}
            <div className="side-actions">
              <p className="side-section-label">Quick Dispatch</p>
              <button className="btn-primary" style={{ width: '100%' }} onClick={() => navigate('/transactions')}>
                <Wallet size={13} /> Log New Voucher
              </button>
              <button className="btn-outline" style={{ width: '100%' }} onClick={() => navigate('/reports')}>
                <FileBarChart size={13} /> View Annual Report
              </button>
            </div>

            {/* Thin divider */}
            <div style={{ borderTop: '2px solid var(--border-strong)', margin: '0.5rem 0' }} />

            {/* Side stats column */}
            <div className="side-stats">
              <p className="side-section-label">Portfolio At A Glance</p>
              <div className="side-stat-row">
                <span className="side-stat-label">Total Records</span>
                <span className="side-stat-val">{transactions.length}</span>
              </div>
              <div className="side-stat-row">
                <span className="side-stat-label">Net P&amp;L</span>
                <span className="side-stat-val" style={{ color: total >= 0 ? 'var(--green)' : 'var(--red)' }}>
                  {total >= 0 ? '+' : '−'}{fmt(total)}
                </span>
              </div>
              <div className="side-stat-row">
                <span className="side-stat-label">Savings Rate</span>
                <span className="side-stat-val pop-amber">{savingsRate}%</span>
              </div>
              <div className="side-stat-row">
                <span className="side-stat-label">Expense Ratio</span>
                <span className="side-stat-val pop-red">
                  {income > 0 ? Math.round((expense / income) * 100) : 0}%
                </span>
              </div>
            </div>
          </aside>
        </div>
      </div>
    </main>
  );
}

export default Home;