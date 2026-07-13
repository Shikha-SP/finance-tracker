import { useState } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { Mail, Lock, Eye, EyeOff, ArrowRight, Sparkles, TrendingUp, ShieldCheck, BarChart3 } from 'lucide-react';

export default function Login() {
  const navigate = useNavigate();
  const [email, setEmail]     = useState('');
  const [password, setPassword] = useState('');
  const [showPw, setShowPw]   = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError]     = useState('');

  const handleSubmit = async e => {
    e.preventDefault();
    setError('');
    setLoading(true);

    try {
      const res = await fetch('/api/auth/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, password }),
      });

      const data = await res.json();

      if (!res.ok) {
        setError(data.message || 'Login failed. Please try again.');
        setLoading(false);
        return;
      }

      // Store JWT and user info
      localStorage.setItem('token', data.token);
      localStorage.setItem('userName',  data.user.name);
      localStorage.setItem('userEmail', data.user.email);
      localStorage.setItem('userId',    data.user.id);

      navigate('/home');
    } catch (err) {
      setError('Could not reach the server. Is the backend running?');
      setLoading(false);
    }
  };

  return (
    <div className="auth-root">
      {/* ── Left panel – branding ── */}
      <div className="auth-panel auth-panel--brand">
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
            <div className="auth-feature-item">
              <div className="auth-feature-icon"><TrendingUp size={18} /></div>
              <div>
                <div className="auth-feature-title">Real-time Analytics</div>
                <div className="auth-feature-desc">Live charts for every transaction.</div>
              </div>
            </div>
            <div className="auth-feature-item">
              <div className="auth-feature-icon"><ShieldCheck size={18} /></div>
              <div>
                <div className="auth-feature-title">256-bit Encryption</div>
                <div className="auth-feature-desc">Your data is always private &amp; safe.</div>
              </div>
            </div>
            <div className="auth-feature-item">
              <div className="auth-feature-icon"><BarChart3 size={18} /></div>
              <div>
                <div className="auth-feature-title">Budget Intelligence</div>
                <div className="auth-feature-desc">Smart goals that adapt to your habits.</div>
              </div>
            </div>
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

      {/* ── Right panel – form ── */}
      <div className="auth-panel auth-panel--form">
        <div className="auth-form-card">
          <div className="auth-form-header">
            <div className="auth-logo auth-logo--dark">
              <Sparkles size={22} />
            </div>
            <h2 className="auth-form-title">Welcome back</h2>
            <p className="auth-form-subtitle">Sign in to your account to continue.</p>
          </div>

          {error && <div className="auth-error">{error}</div>}

          <form id="login-form" onSubmit={handleSubmit} className="auth-form">
            <div className="auth-field">
              <label className="auth-label" htmlFor="login-email">Email address</label>
              <div className="auth-input-wrap">
                <Mail size={16} className="auth-input-icon" />
                <input
                  id="login-email"
                  className="auth-input"
                  type="email"
                  placeholder="you@example.com"
                  value={email}
                  onChange={e => setEmail(e.target.value)}
                  required
                  autoComplete="email"
                />
              </div>
            </div>

            <div className="auth-field">
              <div className="auth-label-row">
                <label className="auth-label" htmlFor="login-password">Password</label>
              </div>
              <div className="auth-input-wrap">
                <Lock size={16} className="auth-input-icon" />
                <input
                  id="login-password"
                  className="auth-input"
                  type={showPw ? 'text' : 'password'}
                  placeholder="••••••••"
                  value={password}
                  onChange={e => setPassword(e.target.value)}
                  required
                  autoComplete="current-password"
                />
                <button
                  type="button"
                  className="auth-eye-btn"
                  onClick={() => setShowPw(v => !v)}
                  aria-label="Toggle password visibility"
                >
                  {showPw ? <EyeOff size={16} /> : <Eye size={16} />}
                </button>
              </div>
            </div>

            <button
              id="login-submit-btn"
              className={`auth-btn auth-btn--primary${loading ? ' auth-btn--loading' : ''}`}
              type="submit"
              disabled={loading}
            >
              {loading ? (
                <span className="auth-spinner" />
              ) : (
                <>
                  <span>Sign In</span>
                  <ArrowRight size={18} />
                </>
              )}
            </button>
          </form>

          <p className="auth-switch">
            Don't have an account?{' '}
            <Link to="/signup">Create one for free</Link>
          </p>
        </div>
      </div>
    </div>
  );
}
