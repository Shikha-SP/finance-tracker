import { useState } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { Mail, Lock, Eye, EyeOff, ArrowRight, Landmark } from 'lucide-react';

export default function Login() {
  const navigate = useNavigate();
  const [email, setEmail]     = useState('');
  const [password, setPassword] = useState('');
  const [showPw, setShowPw]   = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError]     = useState('');
  const [fieldErrors, setFieldErrors] = useState({});

  const validate = () => {
    const errs = {};
    if (!email) errs.email = 'Email address is required';
    else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) errs.email = 'Please enter a valid email address';
    
    if (!password) errs.password = 'Password is required';
    
    setFieldErrors(errs);
    return Object.keys(errs).length === 0;
  };

  const handleSubmit = async e => {
    e.preventDefault();
    if (!validate()) return;
    
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

      navigate('/investment/market');
    } catch (err) {
      setError('Could not reach the server. Is the backend running?');
      setLoading(false);
    }
  };

  return (
    <div className="auth-root">
      {/* ── Left panel – branding ── */}
      <div className="auth-panel auth-panel--brand">
        <div className="auth-brand-content">
          <div className="auth-logo">
            <Landmark size={28} />
          </div>
          <h1 className="auth-brand-title">Welth</h1>
          <p className="auth-brand-tagline">Institutional grade wealth management.</p>

          <div className="auth-feature-list">
            <div className="auth-feature-item">
              <div>
                <div className="auth-feature-title">Real-time Analytics</div>
                <div className="auth-feature-desc">Monitor cash flows and balance trends with precision.</div>
              </div>
            </div>
            <div className="auth-feature-item">
              <div>
                <div className="auth-feature-title">Enterprise Security</div>
                <div className="auth-feature-desc">Bank-level encryption protecting your financial data.</div>
              </div>
            </div>
          </div>

          <div className="auth-stat-row">
            <div className="auth-stat"><span>$2.4B+</span><small>Assets Tracked</small></div>
            <div className="auth-stat-divider" />
            <div className="auth-stat"><span>99.9%</span><small>Uptime</small></div>
          </div>
        </div>
      </div>

      {/* ── Right panel – form ── */}
      <div className="auth-panel auth-panel--form">
        <div className="auth-form-card">
          <div className="auth-form-header">
            <div className="auth-logo auth-logo--dark" style={{ background: 'var(--accent)', color: '#fff', border: 'none' }}>
              <Landmark size={22} />
            </div>
            <h2 className="auth-form-title">Welcome back to Welth</h2>
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
                  className={`auth-input ${fieldErrors.email ? 'auth-input--error' : ''}`}
                  type="email"
                  placeholder="you@example.com"
                  value={email}
                  onChange={e => {
                    setEmail(e.target.value);
                    if (fieldErrors.email) setFieldErrors(prev => ({ ...prev, email: '' }));
                  }}
                  required
                  autoComplete="email"
                />
              </div>
              {fieldErrors.email && <div className="auth-field-error" style={{ color: 'var(--red)', fontSize: '0.75rem', marginTop: '0.25rem' }}>{fieldErrors.email}</div>}
            </div>

            <div className="auth-field">
              <div className="auth-label-row">
                <label className="auth-label" htmlFor="login-password">Password</label>
              </div>
              <div className="auth-input-wrap">
                <Lock size={16} className="auth-input-icon" />
                <input
                  id="login-password"
                  className={`auth-input ${fieldErrors.password ? 'auth-input--error' : ''}`}
                  type={showPw ? 'text' : 'password'}
                  placeholder="••••••••"
                  value={password}
                  onChange={e => {
                    setPassword(e.target.value);
                    if (fieldErrors.password) setFieldErrors(prev => ({ ...prev, password: '' }));
                  }}
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
              {fieldErrors.password && <div className="auth-field-error" style={{ color: 'var(--red)', fontSize: '0.75rem', marginTop: '0.25rem' }}>{fieldErrors.password}</div>}
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
