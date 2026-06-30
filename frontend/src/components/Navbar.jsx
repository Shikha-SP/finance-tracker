import { useNavigate } from 'react-router-dom';

function Navbar() {
    const navigate = useNavigate();

    return (
        <nav className="navbar">
            <div className="navbar-brand">
                <span className="navbar-title">FinanceTracker</span>
            </div>
            <ul className="navbar-links">
                <li><button className="nav-link" onClick={() => navigate('/')}>Home</button></li>
                <li><button className="nav-link" onClick={() => navigate('/transactions')}>Transactions</button></li>
                <li><button className="nav-link" onClick={() => navigate('/reports')}>Reports</button></li>
            </ul>
        </nav>
    );
}

export default Navbar;