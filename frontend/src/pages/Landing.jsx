import { useNavigate } from 'react-router-dom';
import { TrendingUp, ShieldCheck, BarChart3, Zap, ArrowRight, Sparkles } from 'lucide-react';

const features = [
  { icon: TrendingUp,  title: 'Smart Analytics',   desc: 'Visualise your wealth with beautiful, real-time charts.' },
  { icon: ShieldCheck, title: 'Bank-Level Security', desc: 'Your data is encrypted end-to-end and never shared.' },
  { icon: BarChart3,   title: 'Budget Mastery',      desc: 'Set goals, track spending and hit every milestone.' },
  { icon: Zap,         title: 'Instant Insights',    desc: 'AI-powered tips to grow and protect your money.' },
];

export default function Landing() {
  const navigate = useNavigate();

  return (
    <div className="auth-root">
      {/* ── Left panel – branding ── */}
      <div className="auth-panel auth-panel--brand">
        {/* Animated background orbs */}
        <div className="auth-orb auth-orb--1" />
        <div className="auth-orb auth-orb--2" />
        <div className="auth-orb auth-orb--3" />

        <div className="auth-brand-content">
          <div className="auth-logo">
            <Sparkles size={28} />
          </div>
          <h1 className="auth-brand-title">Finance<span>Tracker</span></h1>
          <p className="auth-brand-tagline">Your wealth, beautifully organised.</p>

          <div className="auth-feature-list">
            {features.map(({ icon: Icon, title, desc }) => (
              <div key={title} className="auth-feature-item">
                <div className="auth-feature-icon">
                  <Icon size={18} />
                </div>
                <div>
                  <div className="auth-feature-title">{title}</div>
                  <div className="auth-feature-desc">{desc}</div>
                </div>
              </div>
            ))}
          </div>

          <div className="auth-stat-row">
            <div className="auth-stat"><span>50K+</span><small>Users</small></div>
            <div className="auth-stat-divider" />
            <div className="auth-stat"><span>$2B+</span><small>Tracked</small></div>
            <div className="auth-stat-divider" />
            <div className="auth-stat"><span>4.9★</span><small>Rating</small></div>
          </div>
        </div>
      </div>

      {/* ── Right panel – CTA ── */}
      <div className="auth-panel auth-panel--form">
        <div className="auth-form-card auth-landing-card">
          <div className="auth-form-header">
            <div className="auth-logo auth-logo--dark">
              <Sparkles size={22} />
            </div>
            <h2 className="auth-form-title">Welcome back</h2>
            <p className="auth-form-subtitle">Take control of your financial future today.</p>
          </div>

          <div className="auth-landing-actions">
            <button
              id="landing-login-btn"
              className="auth-btn auth-btn--primary"
              onClick={() => navigate('/login')}
            >
              <span>Sign In to Dashboard</span>
              <ArrowRight size={18} />
            </button>
            <button
              id="landing-signup-btn"
              className="auth-btn auth-btn--outline"
              onClick={() => navigate('/signup')}
            >
              Create Free Account
            </button>
          </div>

          <p className="auth-terms">
            By continuing, you agree to our{' '}
            <a href="#">Terms of Service</a> and <a href="#">Privacy Policy</a>.
          </p>
        </div>
      </div>
    </div>
  );
}
