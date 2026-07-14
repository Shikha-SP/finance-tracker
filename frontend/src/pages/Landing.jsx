import { useNavigate } from 'react-router-dom';
import TopNav from '../components/TopNav';
import { Activity, ShieldCheck, BarChart3, Zap, ArrowRight, Wallet, PieChart, Target, ChevronRight } from 'lucide-react';

export default function Landing() {
  const navigate = useNavigate();

  return (
    <div className="app-wrapper">
      <TopNav />
      
      <main className="landing-page" style={{ paddingTop: '64px', minHeight: '100vh', background: 'var(--bg-base)' }}>
        
        {/* ── Hero Section ── */}
        <section className="hero-section">
          <div className="hero-bg-glow"></div>
          <div className="hero-container">
            <div className="hero-content">
              <div className="hero-badge">
                <span className="hero-badge-dot"></span>
                LedgerLive 2.0 is here
              </div>
              <h1 className="hero-title">
                Master your wealth with <span className="text-gradient">precision.</span>
              </h1>
              <p className="hero-subtitle">
                The most elegant way to track your net worth, categorize expenses, and achieve your financial goals. Ditch the spreadsheets.
              </p>
              <div className="hero-actions">
                <button className="btn-primary btn-large" onClick={() => navigate('/signup')}>
                  Start for free <ArrowRight size={16} />
                </button>
                <button className="btn-outline btn-large" onClick={() => navigate('/login')}>
                  Sign in to account
                </button>
              </div>
              <div className="hero-social-proof">
                <div className="avatars">
                  <div className="avatar-circle"></div>
                  <div className="avatar-circle"></div>
                  <div className="avatar-circle"></div>
                </div>
                <p>Join 10,000+ investors tracking millions daily.</p>
              </div>
            </div>

            {/* Premium Mock UI floating next to/below text */}
            <div className="hero-mockup">
              <div className="mockup-window">
                <div className="mockup-header">
                  <div className="mockup-dots"><span></span><span></span><span></span></div>
                </div>
                <div className="mockup-body">
                  <div className="mockup-sidebar">
                    <div className="mockup-nav-item active"></div>
                    <div className="mockup-nav-item"></div>
                    <div className="mockup-nav-item"></div>
                  </div>
                  <div className="mockup-main">
                    <div className="mockup-kpi-row">
                      <div className="mockup-kpi"></div>
                      <div className="mockup-kpi"></div>
                      <div className="mockup-kpi"></div>
                    </div>
                    <div className="mockup-chart">
                      <div className="mockup-chart-bar" style={{ height: '40%' }}></div>
                      <div className="mockup-chart-bar" style={{ height: '70%' }}></div>
                      <div className="mockup-chart-bar" style={{ height: '50%' }}></div>
                      <div className="mockup-chart-bar" style={{ height: '90%' }}></div>
                      <div className="mockup-chart-bar active" style={{ height: '100%' }}></div>
                      <div className="mockup-chart-bar" style={{ height: '60%' }}></div>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </section>

        {/* ── Features Section ── */}
        <section className="features-section" id="features">
          <div className="features-container">
            <div className="features-header">
              <h2>Everything you need, nothing you don't.</h2>
              <p>Built for speed, privacy, and clarity. No ads, no selling your data.</p>
            </div>
            
            <div className="features-grid">
              <div className="feature-card">
                <div className="feature-icon"><Wallet size={22} /></div>
                <h3>Unified Ledger</h3>
                <p>Track all your accounts in one place. Categorize effortlessly and see exactly where your money goes.</p>
              </div>
              <div className="feature-card">
                <div className="feature-icon"><PieChart size={22} /></div>
                <h3>Visual Analytics</h3>
                <p>Beautiful, interactive charts that make understanding your cash flow and spending habits intuitive.</p>
              </div>
              <div className="feature-card">
                <div className="feature-icon"><Target size={22} /></div>
                <h3>Budget Control</h3>
                <p>Set custom limits for any category. Get visual alerts when you're approaching your monthly threshold.</p>
              </div>
              <div className="feature-card">
                <div className="feature-icon"><ShieldCheck size={22} /></div>
                <h3>Bank-Level Privacy</h3>
                <p>Your financial data is encrypted and stored securely. You are the only one who can access your ledger.</p>
              </div>
            </div>
          </div>
        </section>
        
        {/* Footer */}
        <footer className="landing-footer">
          <p>&copy; {new Date().getFullYear()} LedgerLive Capital Management. All rights reserved.</p>
        </footer>
      </main>

      <style dangerouslySetInnerHTML={{__html: `
        .hero-section {
          position: relative;
          padding: 6rem 2rem;
          overflow: hidden;
          display: flex;
          justify-content: center;
          border-bottom: 1px solid var(--border);
        }
        .hero-bg-glow {
          position: absolute;
          top: -20%; left: 50%;
          transform: translateX(-50%);
          width: 80vw; height: 80vw;
          max-width: 1000px; max-height: 1000px;
          background: radial-gradient(circle, var(--accent-soft) 0%, transparent 60%);
          z-index: 0; opacity: 0.8;
          pointer-events: none;
        }
        .hero-container {
          position: relative;
          z-index: 1;
          width: 100%; max-width: 1200px;
          display: grid;
          grid-template-columns: 1fr 1fr;
          gap: 4rem;
          align-items: center;
        }
        .hero-content { display: flex; flex-direction: column; align-items: flex-start; }
        .hero-badge {
          display: flex; align-items: center; gap: 0.5rem;
          padding: 0.4rem 0.8rem;
          background: var(--bg-surface);
          border: 1px solid var(--border);
          border-radius: 100px;
          font-size: 0.75rem; font-weight: 600; color: var(--text-secondary);
          margin-bottom: 1.5rem;
          box-shadow: var(--shadow-sm);
        }
        .hero-badge-dot { width: 8px; height: 8px; background: var(--accent); border-radius: 50%; }
        .hero-title {
          font-family: 'Outfit', sans-serif;
          font-size: clamp(2.5rem, 5vw, 4.2rem);
          font-weight: 900;
          color: var(--text-primary);
          line-height: 1.05;
          letter-spacing: -0.04em;
          margin-bottom: 1.25rem;
        }
        .text-gradient {
          background: linear-gradient(135deg, var(--accent) 0%, #f97316 100%);
          -webkit-background-clip: text;
          -webkit-text-fill-color: transparent;
        }
        :root[data-theme="light"] .text-gradient {
          background: linear-gradient(135deg, var(--accent-dark) 0%, var(--accent) 100%);
          -webkit-background-clip: text;
          -webkit-text-fill-color: transparent;
        }
        .hero-subtitle {
          font-size: 1.1rem;
          color: var(--text-secondary);
          line-height: 1.6;
          margin-bottom: 2.5rem;
          max-width: 480px;
        }
        .hero-actions { display: flex; gap: 1rem; margin-bottom: 2.5rem; width: 100%; }
        .btn-large { padding: 0.9rem 1.6rem; font-size: 0.9rem; }
        .hero-social-proof { display: flex; align-items: center; gap: 1rem; font-size: 0.8rem; color: var(--text-muted); font-weight: 500; }
        .avatars { display: flex; }
        .avatar-circle {
          width: 30px; height: 30px; border-radius: 50%;
          border: 2px solid var(--bg-base);
          background: var(--bg-elevated);
          margin-left: -10px;
        }
        .avatar-circle:first-child { margin-left: 0; background: var(--accent); }
        .avatar-circle:nth-child(2) { background: var(--blue); }
        .avatar-circle:nth-child(3) { background: var(--green); }
        
        .hero-mockup {
          perspective: 1000px;
        }
        .mockup-window {
          background: var(--bg-surface);
          border: 1px solid var(--border-strong);
          border-radius: var(--radius-lg);
          box-shadow: var(--shadow-card);
          overflow: hidden;
          transform: rotateY(-5deg) rotateX(2deg);
          transition: transform 0.3s ease;
        }
        .mockup-window:hover { transform: rotateY(0) rotateX(0); }
        .mockup-header {
          background: var(--bg-elevated);
          padding: 0.75rem 1rem;
          border-bottom: 1px solid var(--border);
        }
        .mockup-dots { display: flex; gap: 0.4rem; }
        .mockup-dots span { width: 10px; height: 10px; border-radius: 50%; background: var(--border-strong); }
        .mockup-dots span:nth-child(1) { background: #ef4444; }
        .mockup-dots span:nth-child(2) { background: #f59e0b; }
        .mockup-dots span:nth-child(3) { background: #10b981; }
        
        .mockup-body { display: flex; height: 320px; }
        .mockup-sidebar {
          width: 80px;
          border-right: 1px solid var(--border);
          padding: 1rem 0.5rem;
          display: flex; flex-direction: column; gap: 0.75rem;
          background: var(--bg-base);
        }
        .mockup-nav-item { height: 24px; border-radius: 4px; background: var(--bg-glass); }
        .mockup-nav-item.active { background: var(--accent-soft); border-left: 2px solid var(--accent); }
        
        .mockup-main { flex: 1; padding: 1.5rem; display: flex; flex-direction: column; gap: 1.5rem; background: var(--bg-base); }
        .mockup-kpi-row { display: grid; grid-template-columns: 1fr 1fr 1fr; gap: 1rem; }
        .mockup-kpi { height: 60px; background: var(--bg-surface); border: 1px solid var(--border); border-radius: 8px; }
        
        .mockup-chart { flex: 1; background: var(--bg-surface); border: 1px solid var(--border); border-radius: 8px; display: flex; align-items: flex-end; justify-content: space-around; padding: 1rem 1.5rem; gap: 0.5rem; }
        .mockup-chart-bar { flex: 1; background: var(--bg-elevated); border-radius: 4px 4px 0 0; }
        .mockup-chart-bar.active { background: var(--accent); }

        .features-section { padding: 6rem 2rem; display: flex; justify-content: center; }
        .features-container { width: 100%; max-width: 1200px; }
        .features-header { text-align: center; margin-bottom: 4rem; }
        .features-header h2 { font-family: 'Outfit', sans-serif; font-size: 2.2rem; font-weight: 800; color: var(--text-primary); margin-bottom: 0.75rem; letter-spacing: -0.02em; }
        .features-header p { font-size: 1.05rem; color: var(--text-secondary); max-width: 600px; margin: 0 auto; }
        
        .features-grid { display: grid; grid-template-columns: repeat(auto-fit, minmax(250px, 1fr)); gap: 2rem; }
        .feature-card {
          background: var(--bg-surface);
          border: 1px solid var(--border);
          border-radius: var(--radius-md);
          padding: 2rem;
          transition: transform 0.2s, border-color 0.2s;
        }
        .feature-card:hover { transform: translateY(-4px); border-color: var(--border-strong); }
        .feature-icon {
          width: 48px; height: 48px;
          background: var(--accent-soft); color: var(--accent);
          border-radius: 12px;
          display: flex; align-items: center; justify-content: center;
          margin-bottom: 1.5rem; border: 1px solid var(--border-accent);
        }
        .feature-card h3 { font-size: 1.1rem; font-weight: 700; color: var(--text-primary); margin-bottom: 0.75rem; }
        .feature-card p { font-size: 0.85rem; color: var(--text-secondary); line-height: 1.6; }

        .landing-footer { text-align: center; padding: 3rem 2rem; border-top: 1px solid var(--border); color: var(--text-muted); font-size: 0.8rem; }
        
        @media (max-width: 900px) {
          .hero-container { grid-template-columns: 1fr; gap: 3rem; text-align: center; }
          .hero-content { align-items: center; }
          .hero-actions { justify-content: center; flex-direction: column; }
          .hero-mockup { display: none; } /* Hide mockup on small screens for cleaner look */
        }
      `}} />
    </div>
  );
}
