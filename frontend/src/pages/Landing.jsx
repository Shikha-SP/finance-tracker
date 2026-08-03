import { useNavigate } from 'react-router-dom';
import TopNav from '../components/TopNav';
import { ShieldCheck, BarChart3, Wallet, PieChart, Target, ArrowRight, TrendingUp, Lock } from 'lucide-react';

export default function Landing() {
  const navigate = useNavigate();

  return (
    <div className="app-wrapper">
      <TopNav />

      <main className="landing-page" style={{ paddingTop: '60px', minHeight: '100vh', background: 'var(--bg-base)' }}>

        {/* ── Hero Section ── */}
        <section className="hero-section">
          <div className="hero-container">
            <div className="hero-content">
              <div className="hero-eyebrow">
                <span className="hero-eyebrow-line"></span>
                Personal Finance Platform
              </div>
              <h1 className="hero-title">
                Clear visibility into<br />your financial position.
              </h1>
              <p className="hero-subtitle">
                Track income, expenses, and net worth with professional-grade tools. Designed for clarity, built for accuracy.
              </p>
              <div className="hero-actions">
                <button className="btn-primary btn-large" id="hero-cta-signup" onClick={() => navigate('/signup')}>
                  Open Account <ArrowRight size={15} />
                </button>
                <button className="btn-outline btn-large" id="hero-cta-login" onClick={() => navigate('/login')}>
                  Sign In
                </button>
              </div>
              <div className="hero-trust-row">
                <div className="hero-trust-item">
                  <ShieldCheck size={13} />
                  <span>Bank-level encryption</span>
                </div>
                <div className="hero-trust-sep"></div>
                <div className="hero-trust-item">
                  <Lock size={13} />
                  <span>Private by default</span>
                </div>
                <div className="hero-trust-sep"></div>
                <div className="hero-trust-item">
                  <TrendingUp size={13} />
                  <span>Real-time sync</span>
                </div>
              </div>
            </div>

            {/* Clean flat dashboard preview */}
            <div className="hero-dashboard">
              <div className="dashboard-preview">
                {/* Header bar */}
                <div className="dp-header">
                  <div className="dp-header-left">
                    <div className="dp-dot dp-dot--blue"></div>
                    <div className="dp-dot dp-dot--grey"></div>
                    <div className="dp-dot dp-dot--grey"></div>
                  </div>
                  <span className="dp-title-text">Portfolio Overview</span>
                </div>

                {/* KPI row */}
                <div className="dp-kpi-row">
                  <div className="dp-kpi">
                    <span className="dp-kpi-label">Net Worth</span>
                    <span className="dp-kpi-val dp-kpi-val--primary">रू 8,43,200</span>
                    <span className="dp-kpi-change dp-kpi-change--up">+4.2%</span>
                  </div>
                  <div className="dp-kpi">
                    <span className="dp-kpi-label">Income</span>
                    <span className="dp-kpi-val dp-kpi-val--green">रू 64,000</span>
                    <span className="dp-kpi-change dp-kpi-change--up">this month</span>
                  </div>
                  <div className="dp-kpi">
                    <span className="dp-kpi-label">Expenses</span>
                    <span className="dp-kpi-val dp-kpi-val--red">रू 31,800</span>
                    <span className="dp-kpi-change dp-kpi-change--down">-8% vs avg</span>
                  </div>
                </div>

                {/* Chart area */}
                <div className="dp-chart-section">
                  <div className="dp-chart-label">Monthly Cash Flow</div>
                  <div className="dp-chart">
                    {[55, 70, 42, 88, 65, 95, 78].map((h, i) => (
                      <div key={i} className="dp-chart-col">
                        <div className="dp-bar dp-bar--income" style={{ height: `${h}%` }}></div>
                        <div className="dp-bar dp-bar--expense" style={{ height: `${Math.round(h * 0.52)}%` }}></div>
                      </div>
                    ))}
                  </div>
                  <div className="dp-chart-footer">
                    <div className="dp-legend-item"><div className="dp-legend-dot dp-legend-dot--green"></div>Income</div>
                    <div className="dp-legend-item"><div className="dp-legend-dot dp-legend-dot--red"></div>Expenses</div>
                  </div>
                </div>

                {/* Recent transactions */}
                <div className="dp-tx-section">
                  <div className="dp-section-label">Recent Transactions</div>
                  <div className="dp-tx-item">
                    <div className="dp-tx-dot dp-tx-dot--green"></div>
                    <span className="dp-tx-name">Salary</span>
                    <span className="dp-tx-amt dp-tx-amt--green">+रू 42,000</span>
                  </div>
                  <div className="dp-tx-item">
                    <div className="dp-tx-dot dp-tx-dot--red"></div>
                    <span className="dp-tx-name">Rent Payment</span>
                    <span className="dp-tx-amt dp-tx-amt--red">-रू 14,000</span>
                  </div>
                  <div className="dp-tx-item">
                    <div className="dp-tx-dot dp-tx-dot--red"></div>
                    <span className="dp-tx-name">Groceries</span>
                    <span className="dp-tx-amt dp-tx-amt--red">-रू 2,300</span>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </section>

        {/* ── Divider strip ── */}
        <div className="stat-strip">
          <div className="stat-strip-inner">
            <div className="strip-stat">
              <span className="strip-stat-val">Real-time</span>
              <span className="strip-stat-label">NEPSE market data</span>
            </div>
            <div className="strip-divider"></div>
            <div className="strip-stat">
              <span className="strip-stat-val">AI-Powered</span>
              <span className="strip-stat-label">Stock analysis</span>
            </div>
            <div className="strip-divider"></div>
            <div className="strip-stat">
              <span className="strip-stat-val">99.9%</span>
              <span className="strip-stat-label">Uptime guarantee</span>
            </div>
            <div className="strip-divider"></div>
            <div className="strip-stat">
              <span className="strip-stat-val">256-bit</span>
              <span className="strip-stat-label">AES encryption</span>
            </div>
          </div>
        </div>

        {/* ── Features Section ── */}
        <section className="features-section" id="features">
          <div className="features-container">
            <div className="features-header">
              <div className="features-eyebrow">
                <span></span>
                Platform Capabilities
              </div>
              <h2>Built for serious financial management.</h2>
              <p>No ads, no data selling, no compromise. A private ledger for your financial life.</p>
            </div>

            <div className="features-grid">
              <div className="feature-card">
                <div className="feature-icon"><Wallet size={18} /></div>
                <h3>Unified Ledger</h3>
                <p>Track all income and expenses in one place. Categorize transactions and monitor cash flow with precision.</p>
              </div>
              <div className="feature-card">
                <div className="feature-icon"><PieChart size={18} /></div>
                <h3>Visual Analytics</h3>
                <p>Interactive charts that surface spending patterns, monthly trends, and budget performance at a glance.</p>
              </div>
              <div className="feature-card">
                <div className="feature-icon"><Target size={18} /></div>
                <h3>Budget Control</h3>
                <p>Set category-level spending limits and receive alerts before you exceed your monthly thresholds.</p>
              </div>
              <div className="feature-card">
                <div className="feature-icon"><ShieldCheck size={18} /></div>
                <h3>Private by Design</h3>
                <p>Your data is encrypted at rest and in transit. Only you can access your financial records — no exceptions.</p>
              </div>
            </div>
          </div>
        </section>

        {/* Footer */}
        <footer className="landing-footer">
          <div className="footer-inner">
            <div className="footer-brand">
              <div className="footer-logo">
                <BarChart3 size={14} />
              </div>
              <span>Welth</span>
            </div>
            <p>&copy; {new Date().getFullYear()} Welth Financial. All rights reserved.</p>
            <div className="footer-links">
              <a href="#">Privacy Policy</a>
              <a href="#">Terms of Use</a>
              <a href="#">Security</a>
            </div>
          </div>
        </footer>
      </main>

      <style dangerouslySetInnerHTML={{__html: `
        /* ── Hero ── */
        .hero-section {
          padding: 5rem 2rem 5rem;
          display: flex;
          justify-content: center;
          border-bottom: 1px solid var(--border);
        }
        .hero-container {
          width: 100%; max-width: 1180px;
          display: grid;
          grid-template-columns: 1fr 1fr;
          gap: 5rem;
          align-items: center;
        }
        .hero-content { display: flex; flex-direction: column; align-items: flex-start; }
        
        .hero-eyebrow {
          display: flex; align-items: center; gap: 0.65rem;
          font-size: 0.68rem; font-weight: 600;
          text-transform: uppercase; letter-spacing: 0.12em;
          color: var(--accent);
          margin-bottom: 1.5rem;
        }
        .hero-eyebrow-line {
          display: inline-block; width: 20px; height: 1.5px;
          background: var(--accent); border-radius: 2px;
        }
        
        .hero-title {
          font-family: 'Inter', sans-serif;
          font-size: clamp(2.2rem, 4.5vw, 3.5rem);
          font-weight: 700;
          color: var(--text-primary);
          line-height: 1.12;
          letter-spacing: -0.03em;
          margin-bottom: 1.35rem;
        }
        .hero-subtitle {
          font-size: 1rem;
          color: var(--text-secondary);
          line-height: 1.65;
          margin-bottom: 2.25rem;
          max-width: 440px;
          font-weight: 400;
        }
        .hero-actions { display: flex; gap: 0.875rem; margin-bottom: 2rem; width: 100%; }
        .btn-large { padding: 0.8rem 1.5rem; font-size: 0.875rem; }
        
        .hero-trust-row {
          display: flex; align-items: center; gap: 1rem;
          flex-wrap: wrap;
        }
        .hero-trust-item {
          display: flex; align-items: center; gap: 0.4rem;
          font-size: 0.74rem; font-weight: 500; color: var(--text-muted);
        }
        .hero-trust-sep {
          width: 1px; height: 14px;
          background: var(--border-strong);
        }

        /* ── Dashboard Preview ── */
        .hero-dashboard {}
        .dashboard-preview {
          background: var(--bg-surface);
          border: 1px solid var(--border-strong);
          border-radius: var(--radius-lg);
          overflow: hidden;
          box-shadow: var(--shadow-card);
        }
        .dp-header {
          display: flex; align-items: center;
          padding: 0.75rem 1rem;
          border-bottom: 1px solid var(--border);
          background: var(--bg-elevated);
          gap: 0.5rem;
        }
        .dp-header-left { display: flex; gap: 0.4rem; }
        .dp-dot { width: 9px; height: 9px; border-radius: 50%; }
        .dp-dot--blue { background: var(--accent); }
        .dp-dot--grey { background: var(--border-strong); }
        .dp-title-text { 
          flex: 1; text-align: center;
          font-size: 0.68rem; font-weight: 600;
          color: var(--text-muted);
          text-transform: uppercase; letter-spacing: 0.08em;
        }

        .dp-kpi-row {
          display: grid; grid-template-columns: repeat(3, 1fr);
          border-bottom: 1px solid var(--border);
        }
        .dp-kpi {
          padding: 1rem;
          display: flex; flex-direction: column; gap: 0.2rem;
          border-right: 1px solid var(--border);
        }
        .dp-kpi:last-child { border-right: none; }
        .dp-kpi-label { font-size: 0.6rem; font-weight: 600; text-transform: uppercase; letter-spacing: 0.08em; color: var(--text-muted); }
        .dp-kpi-val { font-family: 'DM Mono', monospace; font-size: 1.1rem; font-weight: 500; }
        .dp-kpi-val--primary { color: var(--text-primary); }
        .dp-kpi-val--green { color: var(--green); }
        .dp-kpi-val--red { color: var(--red); }
        .dp-kpi-change { font-size: 0.6rem; font-weight: 500; }
        .dp-kpi-change--up { color: var(--green); }
        .dp-kpi-change--down { color: var(--red); }

        .dp-chart-section { padding: 1rem 1rem 0.75rem; border-bottom: 1px solid var(--border); }
        .dp-chart-label { font-size: 0.62rem; font-weight: 600; text-transform: uppercase; letter-spacing: 0.08em; color: var(--text-muted); margin-bottom: 0.75rem; }
        .dp-chart {
          display: flex; align-items: flex-end; gap: 0.5rem;
          height: 90px;
        }
        .dp-chart-col {
          flex: 1; display: flex; align-items: flex-end; gap: 2px;
          height: 100%;
        }
        .dp-bar {
          flex: 1; border-radius: 2px 2px 0 0;
          min-height: 3px;
        }
        .dp-bar--income { background: var(--green); opacity: 0.85; }
        .dp-bar--expense { background: var(--red); opacity: 0.7; }
        .dp-chart-footer {
          display: flex; gap: 1rem; padding-top: 0.6rem;
        }
        .dp-legend-item { display: flex; align-items: center; gap: 0.35rem; font-size: 0.6rem; color: var(--text-muted); }
        .dp-legend-dot { width: 8px; height: 3px; border-radius: 2px; }
        .dp-legend-dot--green { background: var(--green); }
        .dp-legend-dot--red { background: var(--red); }

        .dp-tx-section { padding: 0.875rem 1rem 1rem; }
        .dp-section-label { font-size: 0.6rem; font-weight: 600; text-transform: uppercase; letter-spacing: 0.08em; color: var(--text-muted); margin-bottom: 0.6rem; }
        .dp-tx-item {
          display: flex; align-items: center; gap: 0.6rem;
          padding: 0.4rem 0;
          border-bottom: 1px solid var(--border);
        }
        .dp-tx-item:last-child { border-bottom: none; }
        .dp-tx-dot { width: 6px; height: 6px; border-radius: 50%; flex-shrink: 0; }
        .dp-tx-dot--green { background: var(--green); }
        .dp-tx-dot--red { background: var(--red); }
        .dp-tx-name { flex: 1; font-size: 0.74rem; color: var(--text-secondary); font-weight: 400; }
        .dp-tx-amt { font-family: 'DM Mono', monospace; font-size: 0.74rem; font-weight: 500; }
        .dp-tx-amt--green { color: var(--green); }
        .dp-tx-amt--red { color: var(--red); }

        /* ── Stat Strip ── */
        .stat-strip {
          border-bottom: 1px solid var(--border);
          background: var(--bg-surface);
        }
        .stat-strip-inner {
          display: flex; align-items: center;
          max-width: 1180px; margin: 0 auto; padding: 0 2rem;
        }
        .strip-stat {
          flex: 1; display: flex; flex-direction: column;
          align-items: center; gap: 0.2rem;
          padding: 1.35rem 1rem;
        }
        .strip-stat-val {
          font-family: 'DM Mono', monospace;
          font-size: 1.35rem; font-weight: 500;
          color: var(--text-primary); letter-spacing: -0.01em;
        }
        .strip-stat-label {
          font-size: 0.68rem; font-weight: 500;
          color: var(--text-muted); text-transform: uppercase;
          letter-spacing: 0.06em;
        }
        .strip-divider { width: 1px; height: 40px; background: var(--border); flex-shrink: 0; }

        /* ── Features ── */
        .features-section { padding: 5rem 2rem; display: flex; justify-content: center; }
        .features-container { width: 100%; max-width: 1180px; }
        .features-header { max-width: 520px; margin-bottom: 3.5rem; }
        .features-eyebrow {
          display: flex; align-items: center; gap: 0.65rem;
          font-size: 0.68rem; font-weight: 600;
          text-transform: uppercase; letter-spacing: 0.12em;
          color: var(--accent); margin-bottom: 1rem;
        }
        .features-eyebrow span {
          display: inline-block; width: 20px; height: 1.5px;
          background: var(--accent); border-radius: 2px;
        }
        .features-header h2 {
          font-family: 'Inter', sans-serif; font-size: 2rem; font-weight: 700;
          color: var(--text-primary); margin-bottom: 0.75rem; letter-spacing: -0.02em;
          line-height: 1.2;
        }
        .features-header p { font-size: 0.95rem; color: var(--text-secondary); line-height: 1.6; font-weight: 400; }
        
        .features-grid { display: grid; grid-template-columns: repeat(auto-fit, minmax(240px, 1fr)); gap: 1.25rem; }
        .feature-card {
          background: var(--bg-surface);
          border: 1px solid var(--border);
          border-radius: var(--radius-md);
          padding: 1.75rem;
          transition: border-color 0.18s;
          position: relative;
        }
        .feature-card::before {
          content: ''; position: absolute; top: 0; left: 0;
          width: 2.5px; height: 100%;
          background: var(--accent);
          border-radius: var(--radius-md) 0 0 var(--radius-md);
          opacity: 0;
          transition: opacity 0.18s;
        }
        .feature-card:hover { border-color: var(--border-strong); }
        .feature-card:hover::before { opacity: 1; }
        .feature-icon {
          width: 38px; height: 38px;
          background: var(--accent-soft); color: var(--accent);
          border-radius: var(--radius-sm);
          display: flex; align-items: center; justify-content: center;
          margin-bottom: 1.25rem; border: 1px solid var(--border-accent);
        }
        .feature-card h3 { font-size: 0.95rem; font-weight: 600; color: var(--text-primary); margin-bottom: 0.65rem; }
        .feature-card p { font-size: 0.82rem; color: var(--text-secondary); line-height: 1.65; font-weight: 400; }

        /* ── Footer ── */
        .landing-footer {
          border-top: 1px solid var(--border);
          background: var(--bg-surface);
          padding: 2rem;
        }
        .footer-inner {
          max-width: 1180px; margin: 0 auto;
          display: flex; align-items: center; justify-content: space-between; gap: 2rem;
          flex-wrap: wrap;
        }
        .footer-brand { display: flex; align-items: center; gap: 0.5rem; font-size: 0.875rem; font-weight: 600; color: var(--text-secondary); }
        .footer-logo {
          width: 26px; height: 26px; background: var(--accent); color: #fff;
          border-radius: 5px; display: flex; align-items: center; justify-content: center;
        }
        .landing-footer p { font-size: 0.76rem; color: var(--text-muted); }
        .footer-links { display: flex; gap: 1.5rem; }
        .footer-links a { font-size: 0.76rem; color: var(--text-muted); text-decoration: none; transition: color 0.15s; }
        .footer-links a:hover { color: var(--text-primary); }

        /* ── Responsive ── */
        @media (max-width: 960px) {
          .hero-container { grid-template-columns: 1fr; gap: 3rem; }
          .hero-dashboard { max-width: 500px; }
          .stat-strip-inner { flex-wrap: wrap; }
          .strip-stat { flex: 0 0 50%; }
          .strip-divider { display: none; }
          .footer-inner { flex-direction: column; text-align: center; }
          .footer-links { justify-content: center; }
        }
        @media (max-width: 600px) {
          .hero-section { padding: 3rem 1.25rem; }
          .hero-title { font-size: 2rem; }
          .hero-actions { flex-direction: column; }
          .features-section { padding: 3rem 1.25rem; }
          .strip-stat { flex: 0 0 100%; border-bottom: 1px solid var(--border); }
        }
      `}} />
    </div>
  );
}
