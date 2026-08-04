import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom';
import { TxProvider } from './context/TxContext';
import ErrorBoundary from './components/ErrorBoundary';
import TopNavbar from './components/TopNavbar';
import BudgetLayout from './components/BudgetLayout';
import InvestmentLayout from './components/InvestmentLayout';
import Home from './pages/Home';
import Transactions from './pages/Transactions';
import Budget from './pages/Budget';
import Investment from './pages/Investment';
import InvestmentTracker from './pages/InvestmentTracker';
import InvestmentSectors from './pages/InvestmentSectors';
import StockScreener from './pages/StockScreener';
import RAGAssistant from './pages/RAGAssistant';
import Profile from './pages/Profile';
import Settings from './pages/Settings';
import Login from './pages/Login';
import Signup from './pages/Signup';
import Landing from './pages/Landing';

// Simple auth guard
function RequireAuth({ children }) {
  const isAuth = !!localStorage.getItem('token');
  return isAuth ? children : <Navigate to="/login" replace />;
}

// Layout for authenticated pages (with top navbar)
function AppLayout({ children }) {
  return (
    <div className="app-wrapper">
      <TopNavbar />
      <div className="layout">
        {children}
      </div>
    </div>
  );
}

export default function App() {
  return (
    <TxProvider>
      <ErrorBoundary>
        <Router>
        <Routes>
          {/* Auth pages – NO navbar */}
          <Route path="/"       element={<Landing />} />
          <Route path="/login"  element={<Login />} />
          <Route path="/signup" element={<Signup />} />

          {/* Default redirect after login → investment market */}
          <Route
            path="/home"
            element={
              <RequireAuth>
                <Navigate to="/investment/market" replace />
              </RequireAuth>
            }
          />

          {/* ── Investment Section ── */}
          <Route
            path="/investment"
            element={
              <RequireAuth>
                <AppLayout>
                  <InvestmentLayout />
                </AppLayout>
              </RequireAuth>
            }
          >
            <Route index element={<Navigate to="market" replace />} />
            <Route path="market"   element={<Investment />} />
            <Route path="screener" element={<StockScreener />} />
            <Route path="tracker"  element={<InvestmentTracker />} />
            <Route path="rag"      element={<RAGAssistant />} />
            <Route path="sectors"  element={<InvestmentSectors />} />
          </Route>

          {/* ── Budget Section ── */}
          <Route
            path="/budget"
            element={
              <RequireAuth>
                <AppLayout>
                  <BudgetLayout />
                </AppLayout>
              </RequireAuth>
            }
          >
            <Route index element={<Navigate to="overview" replace />} />
            <Route path="overview"     element={<Home />} />
            <Route path="transactions" element={<Transactions />} />
            <Route path="plan"         element={<Budget />} />
          </Route>

          {/* ── Standalone pages ── */}
          <Route
            path="/profile"
            element={
              <RequireAuth>
                <AppLayout><Profile /></AppLayout>
              </RequireAuth>
            }
          />
          <Route
            path="/settings"
            element={
              <RequireAuth>
                <AppLayout><Settings /></AppLayout>
              </RequireAuth>
            }
          />
        </Routes>
        </Router>
      </ErrorBoundary>
    </TxProvider>
  );
}