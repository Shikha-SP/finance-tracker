import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom';
import { TxProvider } from './context/TxContext';
import Navbar from './components/Navbar';
import Home from './pages/Home';
import Transactions from './pages/Transactions';
import Reports from './pages/Reports';
import Budget from './pages/Budget';
import Analytics from './pages/Analytics';
import Login from './pages/Login';
import Signup from './pages/Signup';
import Landing from './pages/Landing';

// Simple auth guard
function RequireAuth({ children }) {
  const isAuth = !!localStorage.getItem('token');
  return isAuth ? children : <Navigate to="/login" replace />;
}

// Layout for authenticated pages (with navbar)
function AppLayout({ children }) {
  return (
    <div className="app-wrapper">
      <Navbar />
      <div className="layout">
        {children}
      </div>
    </div>
  );
}

export default function App() {
  return (
    <TxProvider>
      <Router>
        <Routes>
          {/* Auth pages – NO sidebar/ticker */}
          <Route path="/"       element={<Landing />} />
          <Route path="/login"  element={<Login />} />
          <Route path="/signup" element={<Signup />} />

          {/* Protected pages – WITH layout */}
          <Route
            path="/home"
            element={
              <RequireAuth>
                <AppLayout><Home /></AppLayout>
              </RequireAuth>
            }
          />
          <Route
            path="/transactions"
            element={
              <RequireAuth>
                <AppLayout><Transactions /></AppLayout>
              </RequireAuth>
            }
          />
          <Route
            path="/reports"
            element={
              <RequireAuth>
                <AppLayout><Reports /></AppLayout>
              </RequireAuth>
            }
          />
          <Route
            path="/budget"
            element={
              <RequireAuth>
                <AppLayout><Budget /></AppLayout>
              </RequireAuth>
            }
          />
          <Route
            path="/analytics"
            element={
              <RequireAuth>
                <AppLayout><Analytics /></AppLayout>
              </RequireAuth>
            }
          />
        </Routes>
      </Router>
    </TxProvider>
  );
}