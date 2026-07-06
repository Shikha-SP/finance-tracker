import { NavLink } from 'react-router-dom';
import { useTx } from '../context/TxContext';
import { Landmark, LayoutDashboard, ArrowRightLeft, PieChart, Target, TrendingUp, Moon, Sun } from 'lucide-react';

const navItems = [
  { to: '/',             label: 'Overview',     icon: LayoutDashboard,  end: true  },
  { to: '/transactions', label: 'Transactions', icon: ArrowRightLeft,   end: false },
  { to: '/reports',      label: 'Reports',      icon: PieChart,         end: false },
  { to: '/budget',       label: 'Budget',       icon: Target,           end: false },
  { to: '/analytics',   label: 'Analytics',    icon: TrendingUp,       end: false },
];

function Navbar() {
  const { theme, toggleTheme, healthScore } = useTx();
  const isDark = theme === 'dark';

  const scoreColor = healthScore >= 75 ? '#10b981' : healthScore >= 50 ? '#f59e0b' : '#ef4444';
  const scoreLabel = healthScore >= 75 ? 'STRONG' : healthScore >= 50 ? 'FAIR' : 'WEAK';

  return (
    <aside className="sidebar">
      {/* Brand */}
      <NavLink to="/" className="sidebar-brand">
        <div className="brand-icon">
          <Landmark size={20} />
        </div>
        <div>
          <div className="brand-name">FinanceTracker</div>
          <div className="brand-sub">Wealth Management</div>
        </div>
      </NavLink>

      {/* Health Score pill */}
      <div className="health-pill">
        <span className="health-pill-label">Portfolio Health</span>
        <div className="health-pill-bar-wrap">
          <div className="health-pill-bar" style={{ width: `${healthScore}%`, background: scoreColor }} />
        </div>
        <div className="health-pill-foot">
          <span style={{ color: scoreColor, fontWeight: 700 }}>{scoreLabel}</span>
          <span style={{ color: 'var(--text-muted)' }}>{healthScore}/100</span>
        </div>
      </div>

      {/* Nav */}
      <p className="sidebar-section-label">Navigation</p>
      <ul className="sidebar-nav">
        {navItems.map(({ to, label, icon: Icon, end }) => (
          <li key={to}>
            <NavLink
              to={to}
              end={end}
              className={({ isActive }) =>
                `sidebar-link${isActive ? ' active' : ''}`
              }
            >
              <span className="sidebar-icon">
                <Icon size={16} />
              </span>
              {label}
            </NavLink>
          </li>
        ))}
      </ul>

      {/* Footer with theme toggle */}
      <div className="sidebar-footer">
        <button className={`theme-toggle ${isDark ? 'is-dark' : 'is-light'}`} onClick={toggleTheme} title="Toggle theme">
          <span className="theme-toggle-icon">
            {isDark ? <Moon size={14} /> : <Sun size={14} />}
          </span>
          <div className="theme-toggle-text">
            <span className="theme-toggle-option" data-active={isDark}>DARK</span>
            <span className="theme-toggle-sep">/</span>
            <span className="theme-toggle-option" data-active={!isDark}>LIGHT</span>
          </div>
        </button>
        <span className="sidebar-version">v2.0 · FinanceTracker</span>
      </div>
    </aside>
  );
}

export default Navbar;