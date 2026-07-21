import { Outlet } from 'react-router-dom';
import BudgetSidebar from './BudgetSidebar';

export default function BudgetLayout() {
  return (
    <div className="section-layout">
      <BudgetSidebar />
      <div className="section-content">
        <Outlet />
      </div>
    </div>
  );
}
