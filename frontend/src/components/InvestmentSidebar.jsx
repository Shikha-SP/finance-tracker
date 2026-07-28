import { NavLink } from 'react-router-dom';
import { TrendingUp, Filter, Briefcase, Bot } from 'lucide-react';

const investmentNavItems = [
  { to: '/investment/market',   label: 'Market Overview',            icon: TrendingUp },
  { to: '/investment/screener', label: 'Stock Screener & AI Analysis', icon: Filter },
  { to: '/investment/tracker',  label: 'Portfolio Tracker',          icon: Briefcase },
  { to: '/investment/rag',      label: 'AI Stock Advisor (RAG)',     icon: Bot },
];

export default function InvestmentSidebar() {
  return (
    <aside className="sidebar">
      <ul className="sidebar-nav">
        {investmentNavItems.map(({ to, label, icon: Icon }) => (
          <li key={to}>
            <NavLink
              to={to}
              className={({ isActive }) => `sidebar-link${isActive ? ' active' : ''}`}
            >
              <Icon size={18} strokeWidth={2.2} />
              {label}
            </NavLink>
          </li>
        ))}
      </ul>
    </aside>
  );
}
