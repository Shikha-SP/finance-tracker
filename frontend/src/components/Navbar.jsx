import { useState } from 'react';
import { NavLink, useNavigate } from 'react-router-dom';
import { useTx } from '../context/TxContext';
import {
  Landmark, LayoutDashboard, ArrowRightLeft, PieChart,
  Target, TrendingUp, Moon, Sun, LogOut, User,
  ChevronDown, Settings, Bell, Shield
} from 'lucide-react';

const navItems = [
  { to: '/home',         label: 'Overview',      icon: LayoutDashboard, end: true  },
  { to: '/transactions', label: 'Transactions',  icon: ArrowRightLeft,  end: false },
  { to: '/reports',      label: 'Reports',       icon: PieChart,        end: false },
  { to: '/budget',       label: 'Budget',        icon: Target,          end: false },
  { to: '/analytics',    label: 'Analytics',     icon: TrendingUp,      end: false },
];

function getUserInfo() {
  const name  = localStorage.getItem('userName')  || 'Jane Doe';
  const email = localStorage.getItem('userEmail') || 'jane@example.com';
  const initials = name.split(' ').map(w => w[0]).join('').slice(0, 2).toUpperCase();
  return { name, email, initials };
}

function Navbar() {
  const navigate = useNavigate();
  const { theme, toggleTheme } = useTx();
  const isDark = theme === 'dark';
  const [profileOpen, setProfileOpen] = useState(false);
  const { name, email, initials } = getUserInfo();

  function handleLogout() {
    localStorage.removeItem('token');
    localStorage.removeItem('userName');
    localStorage.removeItem('userEmail');
    navigate('/');
  }

  return (
    <nav className="navbar">
      {/* ── Brand ── */}
      <NavLink to="/home" className="navbar-brand">
        <div className="brand-icon">
          <Landmark size={20} />
        </div>
        <div>
          <div className="brand-name">FinanceTracker</div>
        </div>
      </NavLink>

      {/* ── Nav Links ── */}
      <ul className="navbar-nav">
        {navItems.map(({ to, label, icon: Icon, end }) => (
          <li key={to}>
            <NavLink
              to={to}
              end={end}
              className={({ isActive }) => `navbar-link${isActive ? ' active' : ''}`}
            >
              <Icon size={16} />
              {label}
            </NavLink>
          </li>
        ))}
      </ul>

      {/* ── Right Controls ── */}
      <div className="navbar-controls">
        <button
          className="theme-toggle-btn"
          onClick={toggleTheme}
          title="Toggle theme"
          style={{ background: 'transparent', border: 'none', cursor: 'pointer', color: 'var(--text-secondary)' }}
        >
          {isDark ? <Moon size={18} /> : <Sun size={18} />}
        </button>

        <div className={`profile-card${profileOpen ? ' is-open' : ''}`} style={{ position: 'relative' }}>
          <button
            className="profile-card-trigger"
            onClick={() => setProfileOpen(v => !v)}
            style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', background: 'transparent', border: 'none', cursor: 'pointer' }}
          >
            <div className="profile-avatar" style={{ background: 'var(--accent)', color: 'var(--bg-base)', width: '32px', height: '32px', borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 'bold' }}>
              {initials}
            </div>
            <ChevronDown size={14} className={`profile-chevron${profileOpen ? ' rotated' : ''}`} style={{ color: 'var(--text-secondary)' }} />
          </button>

          {profileOpen && (
            <div className="profile-dropdown" style={{ position: 'absolute', top: '100%', right: '0', background: 'var(--bg-elevated)', border: '1px solid var(--border)', borderRadius: 'var(--radius-md)', padding: '0.5rem', minWidth: '180px', marginTop: '0.5rem', zIndex: 100 }}>
              <div style={{ padding: '0.5rem', borderBottom: '1px solid var(--border)', marginBottom: '0.5rem' }}>
                <div style={{ fontWeight: 600, fontSize: '0.85rem' }}>{name}</div>
                <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>{email}</div>
              </div>
              <button className="profile-menu-item" onClick={() => setProfileOpen(false)} style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', width: '100%', padding: '0.5rem', background: 'transparent', border: 'none', cursor: 'pointer', color: 'var(--text-secondary)' }}>
                <Settings size={14} /> Settings
              </button>
              <button className="profile-menu-item" onClick={handleLogout} style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', width: '100%', padding: '0.5rem', background: 'transparent', border: 'none', cursor: 'pointer', color: 'var(--red)' }}>
                <LogOut size={14} /> Sign Out
              </button>
            </div>
          )}
        </div>
      </div>
    </nav>
  );
}

export default Navbar;