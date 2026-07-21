import { useState } from 'react';
import { NavLink, useNavigate } from 'react-router-dom';
import { Landmark, Menu, X, ArrowRight } from 'lucide-react';

function TopNav() {
  const navigate = useNavigate();
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

  return (
    <nav className="topnav">
      <div className="topnav-inner">
        {/* Brand */}
        <NavLink to="/" className="topnav-brand">
          <div className="brand-icon">
            <Landmark size={20} strokeWidth={2.5} />
          </div>
            <div className="brand-name">Welth</div>
        </NavLink>

        {/* Desktop Links */}
        <div className="topnav-links desktop-only">
          <a href="#features" className="topnav-link">Features</a>
          <a href="#testimonials" className="topnav-link">Testimonials</a>
          <a href="#pricing" className="topnav-link">Pricing</a>
        </div>

        {/* CTA */}
        <div className="topnav-actions desktop-only">
          <button className="btn-ghost" onClick={() => navigate('/login')}>Sign In</button>
          <button className="btn-primary" onClick={() => navigate('/signup')}>
            Get Started <ArrowRight size={14} style={{ marginLeft: '4px' }} />
          </button>
        </div>

        {/* Mobile menu trigger */}
        <button className="mobile-menu-btn mobile-only" onClick={() => setMobileMenuOpen(!mobileMenuOpen)}>
          {mobileMenuOpen ? <X size={24} /> : <Menu size={24} />}
        </button>
      </div>

      {/* Mobile Menu */}
      {mobileMenuOpen && (
        <div className="topnav-mobile-menu">
          <a href="#features" className="topnav-link" onClick={() => setMobileMenuOpen(false)}>Features</a>
          <a href="#testimonials" className="topnav-link" onClick={() => setMobileMenuOpen(false)}>Testimonials</a>
          <a href="#pricing" className="topnav-link" onClick={() => setMobileMenuOpen(false)}>Pricing</a>
          <div style={{ marginTop: '1rem', display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
            <button className="btn-outline" style={{ width: '100%' }} onClick={() => navigate('/login')}>Sign In</button>
            <button className="btn-primary" style={{ width: '100%' }} onClick={() => navigate('/signup')}>Get Started</button>
          </div>
        </div>
      )}
    </nav>
  );
}

export default TopNav;
