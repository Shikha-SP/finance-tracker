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

// Grab a stored display name, or fall back to email initial
function getUserInfo() {
  const name  = localStorage.getItem('userName')  || 'Jane Doe';
  const email = localStorage.getItem('userEmail') || 'jane@example.com';
  const initials = name.split(' ').map(w => w[0]).join('').slice(0, 2).toUpperCase();
  return { name, email, initials };
}

function Navbar() {
  const navigate = useNavigate();
  const { theme, toggleTheme, healthScore } = useTx();
  const isDark = theme === 'dark';
  const [profileOpen, setProfileOpen] = useState(false);
  const { name, email, initials } = getUserInfo();

  const scoreColor = healthScore >= 75 ? 'var(--green)' : healthScore >= 50 ? 'var(--amber)' : 'var(--red)';
  const scoreLabel = healthScore >= 75 ? 'STRONG' : healthScore >= 50 ? 'FAIR'   : 'WEAK';

  function handleLogout() {
    localStorage.removeItem('token');
    localStorage.removeItem('userName');
    localStorage.removeItem('userEmail');
    navigate('/');
  }

  return (
    <aside className="sidebar">
      {/* ── Brand ── */}
      <NavLink to="/home" className="sidebar-brand">
        <div className="brand-icon">
          <Landmark size={20} />
        </div>
        <div>
          <div className="brand-name">FinanceTracker</div>
          <div className="brand-sub">Wealth Management</div>
        </div>
      </NavLink>

      {/* ── Profile card ── */}
      <div className={`profile-card${profileOpen ? ' is-open' : ''}`}>
        <button
          id="profile-toggle-btn"
          className="profile-card-trigger"
          onClick={() => setProfileOpen(v => !v)}
          aria-expanded={profileOpen}
        >
          <div className="profile-avatar">
            {initials}
            <span className="profile-status-dot" />
          </div>
          <div className="profile-info">
            <span className="profile-name">{name}</span>
            <span className="profile-email">{email}</span>
          </div>
          <ChevronDown size={14} className={`profile-chevron${profileOpen ? ' rotated' : ''}`} />
        </button>

        {/* Dropdown menu */}
        {profileOpen && (
          <div className="profile-dropdown">
            <button id="profile-menu-profile" className="profile-menu-item" onClick={() => setProfileOpen(false)}>
              <User size={14} />
              <span>My Profile</span>
            </button>
            <button id="profile-menu-settings" className="profile-menu-item" onClick={() => setProfileOpen(false)}>
              <Settings size={14} />
              <span>Settings</span>
            </button>
            <button id="profile-menu-notifications" className="profile-menu-item" onClick={() => setProfileOpen(false)}>
              <Bell size={14} />
              <span>Notifications</span>
            </button>
            <button id="profile-menu-security" className="profile-menu-item" onClick={() => setProfileOpen(false)}>
              <Shield size={14} />
              <span>Security</span>
            </button>
            <div className="profile-menu-divider" />
            <button
              id="profile-menu-logout"
              className="profile-menu-item profile-menu-item--danger"
              onClick={handleLogout}
            >
              <LogOut size={14} />
              <span>Sign Out</span>
            </button>
          </div>
        )}
      </div>

      {/* ── Health Score ── */}
      <div className="health-pill">
        <div className="health-pill-header">
          <span className="health-pill-label">Portfolio Health</span>
          <span className="health-pill-score" style={{ color: scoreColor }}>{scoreLabel}</span>
        </div>
        <div className="health-pill-bar-wrap">
          <div className="health-pill-bar" style={{ width: `${healthScore}%`, background: scoreColor }} />
        </div>
        <div className="health-pill-foot">
          <span style={{ color: 'var(--text-muted)' }}>Score</span>
          <span style={{ color: scoreColor, fontWeight: 700 }}>{healthScore} / 100</span>
        </div>
      </div>

      {/* ── Nav ── */}
      <p className="sidebar-section-label">Navigation</p>
      <ul className="sidebar-nav">
        {navItems.map(({ to, label, icon: Icon, end }) => (
          <li key={to}>
            <NavLink
              to={to}
              end={end}
              className={({ isActive }) => `sidebar-link${isActive ? ' active' : ''}`}
            >
              <span className="sidebar-icon"><Icon size={16} /></span>
              {label}
            </NavLink>
          </li>
        ))}
      </ul>

      {/* ── Footer ── */}
      <div className="sidebar-footer">
        {/* Theme toggle */}
        <button
          id="theme-toggle-btn"
          className={`theme-toggle ${isDark ? 'is-dark' : 'is-light'}`}
          onClick={toggleTheme}
          title="Toggle theme"
        >
          <span className="theme-toggle-icon">
            {isDark ? <Moon size={14} /> : <Sun size={14} />}
          </span>
          <div className="theme-toggle-text">
            <span className="theme-toggle-option" data-active={isDark}>DARK</span>
            <span className="theme-toggle-sep">/</span>
            <span className="theme-toggle-option" data-active={!isDark}>LIGHT</span>
          </div>
        </button>

        {/* Logout button — always visible at bottom */}
        <button
          id="sidebar-logout-btn"
          className="sidebar-logout-btn"
          onClick={handleLogout}
        >
          <LogOut size={15} />
          <span>Sign Out</span>
        </button>

        <span className="sidebar-version">v2.0 · FinanceTracker</span>
      </div>
    </aside>
  );
}

export default Navbar;