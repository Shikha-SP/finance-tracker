import { NavLink } from 'react-router-dom';
import { LayoutDashboard, ArrowRightLeft, Target } from 'lucide-react';

const budgetNavItems = [
  { to: '/budget/overview',     label: 'Overview',      icon: LayoutDashboard },
  { to: '/budget/transactions', label: 'Transactions',  icon: ArrowRightLeft  },
  { to: '/budget/plan',         label: 'Budget Plan',   icon: Target          },
];

export default function BudgetSidebar() {
  return (
    <aside className="sidebar">
      <ul className="sidebar-nav">
        {budgetNavItems.map(({ to, label, icon: Icon }) => (
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
