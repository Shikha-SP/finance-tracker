import { BrowserRouter as Router, Routes, Route } from 'react-router-dom';
import { TxProvider } from './context/TxContext';
import Navbar from './components/Navbar';
import Ticker from './components/Ticker';
import Home from './pages/Home';
import Transactions from './pages/Transactions';
import Reports from './pages/Reports';
import Budget from './pages/Budget';
import Analytics from './pages/Analytics';

export default function App() {
  return (
    <TxProvider>
      <Router>
        <div className="app-wrapper">
          <Ticker />
          <div className="layout">
            <Navbar />
            <Routes>
              <Route path="/"             element={<Home />} />
              <Route path="/transactions" element={<Transactions />} />
              <Route path="/reports"      element={<Reports />} />
              <Route path="/budget"       element={<Budget />} />
              <Route path="/analytics"    element={<Analytics />} />
            </Routes>
          </div>
        </div>
      </Router>
    </TxProvider>
  );
}