import { useState, useMemo, useEffect } from 'react';
import { useLocation } from 'react-router-dom';
import { useTx } from '../context/TxContext';
import TransactionForm from '../components/TransactionForm';
import { getCategoryIcon } from '../utils/categoryIcons';
import { Search, Trash2, SearchX, FileText, Pencil } from 'lucide-react';

const fmt = n => '₹' + Math.abs(n).toLocaleString('en-IN', { maximumFractionDigits: 2 });

function Transactions() {
  const { transactions, addTransaction, deleteTransaction, updateTransaction, income, expense } = useTx();
  const [search, setSearch]   = useState('');
  const [filter, setFilter]   = useState('all'); // 'all' | 'income' | 'expense'
  const [editTx, setEditTx]   = useState(null);

  const location = useLocation();

  useEffect(() => {
    if (location.state?.editTx) {
      setEditTx(location.state.editTx);
      window.scrollTo({ top: 0, behavior: 'smooth' });
    }
  }, [location.state]);

  const filtered = useMemo(() => {
    return transactions.filter(tx => {
      const matchType   = filter === 'all' || tx.type === filter;
      const matchSearch = !search.trim() ||
        tx.description.toLowerCase().includes(search.toLowerCase()) ||
        tx.category.toLowerCase().includes(search.toLowerCase());
      return matchType && matchSearch;
    });
  }, [transactions, search, filter]);

  const net = income - expense;

  return (
    <main className="page">
      <div className="page-header">
        <div className="page-header-left">
          <h1 className="page-title">Ledger</h1>
          <p className="page-subtitle">Record and manage all your financial transactions.</p>
        </div>
      </div>

      <div className="page-content">
        {/* Add form card */}
        <div className="card" style={{ marginBottom: '1.5rem' }}>
          <div className="card-header">
            <span className="card-title">{editTx ? 'Edit Entry' : 'New Entry'}</span>
          </div>
          <div className="card-body">
            <TransactionForm 
              onAdd={addTransaction} 
              editTx={editTx} 
              onCancelEdit={() => setEditTx(null)} 
              onUpdate={(id, payload) => {
                updateTransaction(id, payload);
                setEditTx(null);
              }}
            />
          </div>
        </div>

        {/* History card */}
        <div className="card">
          <div className="card-header">
            <span className="card-title">Transaction History</span>
            <span className="card-badge">{filtered.length} / {transactions.length} entries</span>
          </div>

          {/* Summary bar */}
          {transactions.length > 0 && (
            <div className="summary-bar">
              <div className="summary-item">
                <span className="summary-item-label">Deposits</span>
                <span className="summary-item-value positive">{fmt(income)}</span>
              </div>
              <div className="summary-item">
                <span className="summary-item-label">Debits</span>
                <span className="summary-item-value negative">{fmt(expense)}</span>
              </div>
              <div className="summary-item">
                <span className="summary-item-label">Net Balance</span>
                <span
                  className="summary-item-value"
                  style={{ color: net >= 0 ? 'var(--green)' : 'var(--red)' }}
                >
                  {net < 0 ? '−' : ''}{fmt(net)}
                </span>
              </div>
            </div>
          )}

          {/* Search & filter */}
          <div className="filter-bar">
            <div className="search-wrap">
              <span className="search-icon"><Search size={16} /></span>
              <input
                id="search-tx"
                className="search-input"
                type="text"
                placeholder="Search ledger entries&hellip;"
                value={search}
                onChange={e => setSearch(e.target.value)}
              />
            </div>
            {['all', 'income', 'expense'].map(f => (
              <button
                key={f}
                id={`filter-${f}`}
                className={`filter-btn${filter === f ? ' active' : ''}`}
                onClick={() => setFilter(f)}
              >
                {f.charAt(0).toUpperCase() + f.slice(1)}
              </button>
            ))}
          </div>

          {/* List */}
          {filtered.length === 0 ? (
            <div className="empty-state">
              <div className="empty-icon">
                {transactions.length === 0 ? <FileText size={48} /> : <SearchX size={48} />}
              </div>
              <p className="empty-title">
                {transactions.length === 0 ? 'No transactions yet' : 'No records found'}
              </p>
              <p className="empty-text">
                {transactions.length === 0
                  ? 'Use the form above to add an entry to the ledger.'
                  : 'Adjust your search or filter terms.'}
              </p>
            </div>
          ) : (
            <div className="transaction-list">
              {filtered.map(tx => (
                <div className={`transaction-item ${tx.type === 'income' ? 'is-income' : 'is-expense'}`} key={tx.id}>
                  <div className="tx-left">
                    <div className={`tx-icon-wrap ${tx.type}`}>
                      {getCategoryIcon(tx.category, 20)}
                    </div>
                    <div className="tx-info">
                      <p className="tx-desc">{tx.description}</p>
                      <p className="tx-meta">
                        {tx.category} &middot; {tx.date}
                        {tx.note ? ` \u2014 "${tx.note}"` : ''}
                      </p>
                    </div>
                  </div>
                  <div className="tx-right">
                    <p className={`tx-amount ${tx.type === 'income' ? 'positive' : 'negative'}`}>
                      {tx.type === 'income' ? '+' : '−'}{fmt(tx.amount)}
                    </p>
                    <button
                      className="btn-ghost"
                      title="Edit entry"
                      style={{ marginRight: '0.25rem' }}
                      onClick={() => {
                        setEditTx(tx);
                        window.scrollTo({ top: 0, behavior: 'smooth' });
                      }}
                    >
                      <Pencil size={16} />
                    </button>
                    <button
                      className="btn-ghost"
                      title="Delete entry"
                      onClick={() => deleteTransaction(tx.id)}
                    >
                      <Trash2 size={16} />
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </main>
  );
}

export default Transactions;
