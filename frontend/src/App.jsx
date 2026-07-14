import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom';
import { useEffect } from 'react';
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

// Global twinkling starfield effect
function Starfield() {
  useEffect(() => {
    const canvas = document.getElementById('starfield');
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    let animId;

    const resize = () => {
      canvas.width  = window.innerWidth;
      canvas.height = window.innerHeight;
    };
    resize();
    window.addEventListener('resize', resize);

    // Create stars
    const STAR_COUNT = 140;
    const stars = Array.from({ length: STAR_COUNT }, () => ({
      x:       Math.random() * window.innerWidth,
      y:       Math.random() * window.innerHeight,
      r:       Math.random() * 1.4 + 0.3,
      alpha:   Math.random(),
      speed:   Math.random() * 0.008 + 0.003,
      dir:     Math.random() > 0.5 ? 1 : -1,
      phase:   Math.random() * Math.PI * 2,
    }));

    const draw = (t) => {
      ctx.clearRect(0, 0, canvas.width, canvas.height);
      stars.forEach(s => {
        s.alpha = 0.3 + 0.7 * (0.5 + 0.5 * Math.sin(t * s.speed * s.dir + s.phase));
        ctx.beginPath();
        ctx.arc(s.x, s.y, s.r, 0, Math.PI * 2);
        ctx.fillStyle = `rgba(255, 252, 230, ${s.alpha})`;
        ctx.fill();
      });
      animId = requestAnimationFrame(draw);
    };
    animId = requestAnimationFrame(draw);

    return () => {
      cancelAnimationFrame(animId);
      window.removeEventListener('resize', resize);
    };
  }, []);

  return <canvas id="starfield" aria-hidden="true" />;
}

// Simple auth guard
function RequireAuth({ children }) {
  const isAuth = !!localStorage.getItem('token');
  return isAuth ? children : <Navigate to="/login" replace />;
}

// Layout for authenticated pages (with navbar + ticker)
function AppLayout({ children }) {
  return (
    <div className="app-wrapper">
      <Starfield />
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