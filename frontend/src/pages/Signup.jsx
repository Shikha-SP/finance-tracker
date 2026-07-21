import { useState } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { Mail, Lock, User, Eye, EyeOff, ArrowRight, Landmark } from 'lucide-react';

const strength = pw => {
  if (!pw) return { score: 0, label: '', color: '' };
  let s = 0;
  if (pw.length >= 8)          s++;
  if (/[A-Z]/.test(pw))        s++;
  if (/[0-9]/.test(pw))        s++;
  if (/[^A-Za-z0-9]/.test(pw)) s++;
  const labels = ['', 'Weak', 'Fair', 'Good', 'Strong'];
  const colors = ['', '#f87171', '#fbbf24', '#34d399', '#10b981'];
  return { score: s, label: labels[s], color: colors[s] };
};

export default function Signup() {
  const navigate = useNavigate();
  const [name, setName]         = useState('');
  const [email, setEmail]       = useState('');
  const [password, setPassword] = useState('');
  const [showPw, setShowPw]     = useState(false);
  const [loading, setLoading]   = useState(false);
  const [error, setError]       = useState('');
  const [success, setSuccess]   = useState('');
  const [fieldErrors, setFieldErrors] = useState({});

  const pw = strength(password);

  const validate = () => {
    const errs = {};
    if (!name.trim()) errs.name = 'Full name is required';
    else if (name.trim().length < 2) errs.name = 'Name must be at least 2 characters';

    if (!email) errs.email = 'Email address is required';
    else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) errs.email = 'Please enter a valid email address';
    
    if (!password) errs.password = 'Password is required';
    else if (pw.score < 3) errs.password = 'Password must be at least Good strength';
    
    setFieldErrors(errs);
    return Object.keys(errs).length === 0;
  };

  const handleSubmit = async e => {
    e.preventDefault();
    if (!validate()) return;
    
    setError('');
    setSuccess('');
    setLoading(true);

    try {
      const res = await fetch('/api/auth/register', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name, email, password }),
      });

      const data = await res.json();

      if (!res.ok) {
        setError(data.message || 'Registration failed. Please try again.');
        setLoading(false);
        return;
      }

      setSuccess('Account created! Redirecting to sign in…');
      setTimeout(() => navigate('/login'), 1200);
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
            <h2 className="auth-form-title">Create your account</h2>
            <p className="auth-form-subtitle">Start your financial journey — it's free.</p>
          </div>

          {error   && <div className="auth-error">{error}</div>}
          {success && <div className="auth-success">{success}</div>}

          <form id="signup-form" onSubmit={handleSubmit} className="auth-form">
            <div className="auth-field">
              <label className="auth-label" htmlFor="signup-name">Full name</label>
              <div className="auth-input-wrap">
                <User size={16} className="auth-input-icon" />
                <input
                  id="signup-name"
                  className={`auth-input ${fieldErrors.name ? 'auth-input--error' : ''}`}
                  type="text"
                  placeholder="Jane Doe"
                  value={name}
                  onChange={e => {
                    setName(e.target.value);
                    if (fieldErrors.name) setFieldErrors(prev => ({ ...prev, name: '' }));
                  }}
                  required
                  autoComplete="name"
                />
              </div>
              {fieldErrors.name && <div className="auth-field-error" style={{ color: 'var(--red)', fontSize: '0.75rem', marginTop: '0.25rem' }}>{fieldErrors.name}</div>}
            </div>

            <div className="auth-field">
              <label className="auth-label" htmlFor="signup-email">Email address</label>
              <div className="auth-input-wrap">
                <Mail size={16} className="auth-input-icon" />
                <input
                  id="signup-email"
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
              <label className="auth-label" htmlFor="signup-password">Password</label>
              <div className="auth-input-wrap">
                <Lock size={16} className="auth-input-icon" />
                <input
                  id="signup-password"
                  className={`auth-input ${fieldErrors.password ? 'auth-input--error' : ''}`}
                  type={showPw ? 'text' : 'password'}
                  placeholder="Min. 8 characters"
                  value={password}
                  onChange={e => {
                    setPassword(e.target.value);
                    if (fieldErrors.password) setFieldErrors(prev => ({ ...prev, password: '' }));
                  }}
                  required
                  minLength={8}
                  autoComplete="new-password"
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
              {password && (
                <div className="auth-pw-strength">
                  <div className="auth-pw-bars">
                    {[1,2,3,4].map(i => (
                      <div
                        key={i}
                        className="auth-pw-bar"
                        style={{ background: i <= pw.score ? pw.color : 'var(--auth-input-border)' }}
                      />
                    ))}
                  </div>
                  <span style={{ color: pw.color }}>{pw.label}</span>
                </div>
              )}
            </div>

            <button
              id="signup-submit-btn"
              className={`auth-btn auth-btn--primary${loading ? ' auth-btn--loading' : ''}`}
              type="submit"
              disabled={loading}
            >
              {loading ? (
                <span className="auth-spinner" />
              ) : (
                <>
                  <span>Create Account</span>
                  <ArrowRight size={18} />
                </>
              )}
            </button>
          </form>

          <p className="auth-switch">
            Already have an account?{' '}
            <Link to="/login">Sign in instead</Link>
          </p>
        </div>
      </div>
    </div>
  );
}
