import { Outlet } from 'react-router-dom';
import InvestmentSidebar from './InvestmentSidebar';

export default function InvestmentLayout() {
  return (
    <div className="section-layout">
      <InvestmentSidebar />
      <div className="section-content">
        <Outlet />
      </div>
    </div>
  );
}
