import { useState } from 'react';
import { NavLink, useNavigate } from 'react-router-dom';
import { useTx } from '../context/TxContext';
import {
  Landmark, Moon, Sun, LogOut, Settings,
  ChevronDown, User
} from 'lucide-react';

function getUserInfo() {
  const name  = localStorage.getItem('userName')  || 'Jane Doe';
  const email = localStorage.getItem('userEmail') || 'jane@example.com';
  const profilePic = localStorage.getItem('profilePic') || '';
  const initials = name.split(' ').map(w => w[0]).join('').slice(0, 2).toUpperCase();
  return { name, email, initials, profilePic };
}

function TopNavbar() {
  const navigate = useNavigate();
  const { theme, toggleTheme } = useTx();
  const isDark = theme === 'dark';
  const [profileOpen, setProfileOpen] = useState(false);
  const { name, email, initials, profilePic } = getUserInfo();

  function handleLogout() {
    localStorage.removeItem('token');
    localStorage.removeItem('userName');
    localStorage.removeItem('userEmail');
    localStorage.removeItem('profilePic');
    navigate('/');
  }

  return (
    <nav className="top-navbar">
      {/* ── Brand ── */}
      <div className="top-navbar-brand" onClick={() => navigate('/investment/market')} style={{cursor: 'pointer'}}>
        <div className="brand-icon">
          <Landmark size={22} strokeWidth={2.5} />
        </div>
        <div>
          <div className="brand-name">Welth</div>
        </div>
      </div>

      {/* ── Nav Links ── */}
      <ul className="top-navbar-nav">
        <li>
          <NavLink to="/investment" className={({ isActive }) => `top-navbar-link${isActive ? ' active' : ''}`}>
            Investment
          </NavLink>
        </li>
        <li>
          <NavLink to="/budget" className={({ isActive }) => `top-navbar-link${isActive ? ' active' : ''}`}>
            Budget
          </NavLink>
        </li>
      </ul>

      {/* ── Right Controls ── */}
      <div className="top-navbar-controls">
        <button className="theme-toggle-btn top" onClick={toggleTheme} title="Toggle theme">
          {isDark ? <Sun size={18} /> : <Moon size={18} />}
        </button>

        <div className={`profile-card top-profile${profileOpen ? ' is-open' : ''}`}>
          <button className="profile-card-trigger" onClick={() => setProfileOpen(v => !v)}>
            {profilePic ? (
              <img src={profilePic} alt="Profile" className="profile-avatar-img" />
            ) : (
              <div className="profile-avatar">{initials}</div>
            )}
            <ChevronDown size={14} className={`profile-chevron${profileOpen ? ' rotated' : ''}`} />
          </button>

          {profileOpen && (
            <div className="profile-dropdown top-dropdown">
              <div className="dropdown-header">
                <span className="profile-name">{name}</span>
                <span className="profile-email">{email}</span>
              </div>
              <div className="profile-menu-divider" />
              <button className="profile-menu-item" onClick={() => { setProfileOpen(false); navigate('/profile'); }}>
                <User size={14} /> Profile
              </button>
              <button className="profile-menu-item" onClick={() => { setProfileOpen(false); navigate('/settings'); }}>
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
  );
}

export default TopNavbar;