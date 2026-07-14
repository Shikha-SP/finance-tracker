import { useState } from 'react';
import { NavLink, useNavigate } from 'react-router-dom';
import { useTx } from '../context/TxContext';
import {
  Landmark, LayoutDashboard, ArrowRightLeft, PieChart,
  Target, TrendingUp, Moon, Sun, LogOut, Settings,
  ChevronDown, X, Trash2, Check
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

function SettingsModal({ onClose }) {
  const { clearAllData } = useTx();
  const [confirmClear, setConfirmClear] = useState(false);
  const [saved, setSaved] = useState(false);

  function handleClearData() {
    if (confirmClear) {
      clearAllData?.();
      setConfirmClear(false);
      onClose();
    } else {
      setConfirmClear(true);
    }
  }

  function handleSave() {
    setSaved(true);
    setTimeout(() => { setSaved(false); onClose(); }, 900);
  }

  return (
    <div className="settings-overlay" onClick={onClose}>
      <div className="settings-modal" onClick={e => e.stopPropagation()}>
        <div className="settings-modal-header">
          <span className="settings-modal-title">Settings</span>
          <button className="settings-close-btn" onClick={onClose}><X size={16} /></button>
        </div>

        <div className="settings-modal-body">
          {/* Profile section */}
          <div className="settings-section">
            <p className="settings-section-label">Profile</p>
            <div className="settings-row">
              <label className="settings-row-label" htmlFor="s-name">Display Name</label>
              <input
                id="s-name"
                className="settings-input"
                defaultValue={localStorage.getItem('userName') || ''}
                onChange={e => localStorage.setItem('userName', e.target.value)}
              />
            </div>
            <div className="settings-row">
              <label className="settings-row-label" htmlFor="s-email">Email</label>
              <input
                id="s-email"
                className="settings-input"
                type="email"
                defaultValue={localStorage.getItem('userEmail') || ''}
                onChange={e => localStorage.setItem('userEmail', e.target.value)}
              />
            </div>
          </div>

          {/* Danger zone */}
          <div className="settings-section settings-section--danger">
            <p className="settings-section-label">Danger Zone</p>
            <div className="settings-row settings-row--between">
              <div>
                <p className="settings-row-label">Clear all data</p>
                <p className="settings-row-desc">Permanently delete all transactions and budget limits.</p>
              </div>
              <button
                className={`settings-danger-btn${confirmClear ? ' is-confirm' : ''}`}
                onClick={handleClearData}
              >
                <Trash2 size={14} />
                {confirmClear ? 'Confirm?' : 'Clear Data'}
              </button>
            </div>
          </div>
        </div>

        <div className="settings-modal-footer">
          <button className="btn-outline" onClick={onClose}>Cancel</button>
          <button className="btn-primary" onClick={handleSave}>
            {saved ? <><Check size={14}/> Saved</> : 'Save Changes'}
          </button>
        </div>
      </div>
    </div>
  );
}

function Navbar() {
  const navigate = useNavigate();
  const { theme, toggleTheme } = useTx();
  const isDark = theme === 'dark';
  const [profileOpen, setProfileOpen]   = useState(false);
  const [settingsOpen, setSettingsOpen] = useState(false);
  const { name, email, initials } = getUserInfo();

  function handleLogout() {
    localStorage.removeItem('token');
    localStorage.removeItem('userName');
    localStorage.removeItem('userEmail');
    navigate('/');
  }

  return (
    <>
      <nav className="navbar">
        {/* ── Brand ── */}
        <NavLink to="/home" className="navbar-brand">
          <div className="brand-icon">
            <Landmark size={20} strokeWidth={2.5} />
          </div>
          <div>
            <div className="brand-name">LedgerLive</div>
            <div className="brand-sub">Capital Management</div>
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
                <Icon size={18} strokeWidth={2.2} />
                {label}
              </NavLink>
            </li>
          ))}
        </ul>

        {/* ── Bottom Controls ── */}
        <div className="navbar-controls">
          <button className="theme-toggle-btn" onClick={toggleTheme} title="Toggle theme">
            {isDark ? (
              <><Sun size={15} /> <span>Light Mode</span></>
            ) : (
              <><Moon size={15} /> <span>Dark Mode</span></>
            )}
          </button>

          <div className={`profile-card${profileOpen ? ' is-open' : ''}`}>
            <button className="profile-card-trigger" onClick={() => setProfileOpen(v => !v)}>
              <div className="profile-avatar">{initials}</div>
              <div className="profile-info">
                <span className="profile-name">{name}</span>
                <span className="profile-email">{email}</span>
              </div>
              <ChevronDown size={14} className={`profile-chevron${profileOpen ? ' rotated' : ''}`} />
            </button>

            {profileOpen && (
              <div className="profile-dropdown">
                <button
                  className="profile-menu-item"
                  onClick={() => { setProfileOpen(false); setSettingsOpen(true); }}
                >
                  <Settings size={14} /> Settings
                </button>
                <div className="profile-menu-divider" />
                <button className="profile-menu-item profile-menu-item--danger" onClick={handleLogout}>
                  <LogOut size={14} /> Sign Out
                </button>
              </div>
            )}
          </div>
        </div>
      </nav>

      {settingsOpen && <SettingsModal onClose={() => setSettingsOpen(false)} />}
    </>
  );
}

export default Navbar;