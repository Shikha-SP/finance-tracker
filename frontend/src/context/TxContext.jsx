import { createContext, useContext, useState, useCallback, useMemo, useEffect } from 'react';

const TxContext = createContext(null);
const API_URL = 'http://localhost:5000/api';

const DEFAULT_BUDGETS = {
  'Food & Dining': 5000,
  'Transport': 3000,
  'Shopping': 8000,
  'Health': 2000,
  'Bills & Utilities': 4000,
  'Entertainment': 3000,
  'Salary': 0,
  'Freelance': 0,
  'Investment': 0,
  'Other': 2000,
};

export function TxProvider({ children }) {
  const [transactions, setTransactions] = useState([]);
  const [theme, setTheme]               = useState(
    () => localStorage.getItem('theme') || 'light'
  );
  const [budgets, setBudgets]           = useState(DEFAULT_BUDGETS);

  // Fetch initial data from backend
  useEffect(() => {
    fetch(`${API_URL}/transactions`)
      .then(res => res.json())
      .then(data => {
        setTransactions(data.map(t => ({ ...t, id: t._id })));
      })
      .catch(err => console.error('Error fetching transactions:', err));

    fetch(`${API_URL}/budgets`)
      .then(res => res.json())
      .then(data => {
        if (data && data.length > 0) {
          const loadedBudgets = { ...DEFAULT_BUDGETS };
          data.forEach(b => {
            loadedBudgets[b.category] = b.limit;
          });
          setBudgets(loadedBudgets);
        }
      })
      .catch(err => console.error('Error fetching budgets:', err));
  }, []);

  /* ── CRUD ── */
  const addTransaction = useCallback((tx) => {
    fetch(`${API_URL}/transactions`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify(tx)
    })
      .then(res => res.json())
      .then(newTx => {
        setTransactions(prev => [{ ...newTx, id: newTx._id }, ...prev]);
      })
      .catch(err => console.error('Error adding transaction:', err));
  }, []);

  const deleteTransaction = useCallback((id) => {
    fetch(`${API_URL}/transactions/${id}`, {
      method: 'DELETE'
    })
      .then(() => {
        setTransactions(prev => prev.filter(t => t.id !== id));
      })
      .catch(err => console.error('Error deleting transaction:', err));
  }, []);

  const updateTransaction = useCallback((id, updatedTx) => {
    fetch(`${API_URL}/transactions/${id}`, {
      method: 'PUT',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify(updatedTx)
    })
      .then(res => res.json())
      .then(newTx => {
        setTransactions(prev => prev.map(t => t.id === id ? { ...newTx, id: newTx._id } : t));
      })
      .catch(err => console.error('Error updating transaction:', err));
  }, []);

  const updateBudget = useCallback((category, value) => {
    fetch(`${API_URL}/budgets`, {
      method: 'PUT',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({ category, limit: Number(value) })
    })
      .then(res => res.json())
      .then(() => {
        setBudgets(prev => ({ ...prev, [category]: Number(value) }));
      })
      .catch(err => console.error('Error updating budget:', err));
  }, []);

  /* ── Clear all data ── */
  const clearAllData = useCallback(async () => {
    try {
      await Promise.all(
        transactions.map(t =>
          fetch(`${API_URL}/transactions/${t.id}`, { method: 'DELETE' })
        )
      );
    } catch (err) {
      console.error('Error clearing data:', err);
    }
    setTransactions([]);
  }, [transactions]);

  /* ── Theme ── */
  useEffect(() => {
    document.documentElement.setAttribute('data-theme', theme);
  }, [theme]);

  const toggleTheme = useCallback(() => {
    setTheme(prev => {
      const next = prev === 'dark' ? 'light' : 'dark';
      localStorage.setItem('theme', next);
      document.documentElement.setAttribute('data-theme', next);
      return next;
    });
  }, []);

  /* ── Aggregates ── */
  const total   = useMemo(() => transactions.reduce((s, t) => s + (t.type === 'income' ? t.amount : -t.amount), 0), [transactions]);
  const income  = useMemo(() => transactions.filter(t => t.type === 'income').reduce((s, t) => s + t.amount, 0), [transactions]);
  const expense = useMemo(() => transactions.filter(t => t.type === 'expense').reduce((s, t) => s + t.amount, 0), [transactions]);

  /* ── By category ── */
  const byCategory = useMemo(() => {
    const map = {};
    transactions.filter(t => t.type === 'expense').forEach(t => {
      map[t.category] = (map[t.category] || 0) + t.amount;
    });
    return map;
  }, [transactions]);

  /* ── Monthly data ── */
  const monthlyData = useMemo(() => {
    const map = {};
    transactions.forEach(t => {
      const key = t.monthKey || 'Unknown';
      if (!map[key]) map[key] = { income: 0, expense: 0, label: key };
      if (t.type === 'income')  map[key].income  += t.amount;
      if (t.type === 'expense') map[key].expense += t.amount;
    });
    return Object.values(map).slice(-6);
  }, [transactions]);

  /* ── Health score (0-100) ── */
  const healthScore = useMemo(() => {
    if (income === 0) return 50;
    const savingsRate = (income - expense) / income;
    // 0 savings = 40pts, 50%+ savings = 100pts
    const score = Math.min(100, Math.max(0, 40 + savingsRate * 120));
    return Math.round(score);
  }, [income, expense]);

  return (
    <TxContext.Provider value={{
      transactions, addTransaction, deleteTransaction, updateTransaction,
      total, income, expense, byCategory, monthlyData, healthScore,
      budgets, updateBudget,
      theme, toggleTheme,
      clearAllData,
    }}>
      {children}
    </TxContext.Provider>
  );
}

export function useTx() {
  return useContext(TxContext);
}
