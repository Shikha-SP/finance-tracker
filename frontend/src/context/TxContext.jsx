import { createContext, useContext, useState, useCallback, useMemo } from 'react';

const TxContext = createContext(null);

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
  const [theme, setTheme]               = useState('dark');
  const [budgets, setBudgets]           = useState(DEFAULT_BUDGETS);

  /* ── CRUD ── */
  const addTransaction = useCallback((tx) => {
    setTransactions(prev => [tx, ...prev]);
  }, []);

  const deleteTransaction = useCallback((id) => {
    setTransactions(prev => prev.filter(t => t.id !== id));
  }, []);

  const updateBudget = useCallback((category, value) => {
    setBudgets(prev => ({ ...prev, [category]: Number(value) }));
  }, []);

  /* ── Theme ── */
  const toggleTheme = useCallback(() => {
    setTheme(prev => {
      const next = prev === 'dark' ? 'light' : 'dark';
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
      transactions, addTransaction, deleteTransaction,
      total, income, expense, byCategory, monthlyData, healthScore,
      budgets, updateBudget,
      theme, toggleTheme,
    }}>
      {children}
    </TxContext.Provider>
  );
}

export function useTx() {
  return useContext(TxContext);
}
