import { BrowserRouter as Router, Routes, Route } from 'react-router-dom';
import Home from './pages/Home';
import Transactions from './pages/Transactions';
import Reports from './pages/Reports';

export default function App() {
  return (
    <Router>
      <Routes>
        <Route path="/" element={<Home />}></Route>
        <Route path="/transactions" element={<Transactions />}></Route>
        <Route path="/reports" element={<Reports />}></Route>
      </Routes>
    </Router>
  );
}