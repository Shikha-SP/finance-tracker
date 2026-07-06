import { useState } from 'react';
import { 
  ArrowDownCircle, 
  ArrowUpCircle 
} from 'lucide-react';

export const CATEGORIES = [
  'Food & Dining',
  'Transport',
  'Shopping',
  'Health',
  'Bills & Utilities',
  'Entertainment',
  'Salary',
  'Freelance',
  'Investment',
  'Other',
];

function TransactionForm({ onAdd }) {
  const [amount,      setAmount]      = useState('');
  const [description, setDescription] = useState('');
  const [type,        setType]        = useState('expense');
  const [category,    setCategory]    = useState('Other');
  const [note,        setNote]        = useState('');

  function handleSubmit(e) {
    e.preventDefault();
    if (!amount || !description) return;

    onAdd?.({
      id: Date.now(),
      amount:      Number(amount),
      description: description.trim(),
      type,
      category,
      note: note.trim(),
      date: new Date().toLocaleDateString('en-IN', {
        day: '2-digit', month: 'short', year: 'numeric',
      }),
      monthKey: new Date().toLocaleDateString('en-IN', {
        month: 'short', year: 'numeric',
      }),
    });

    setAmount('');
    setDescription('');
    setType('expense');
    setCategory('Other');
    setNote('');
  }

  return (
    <form className="transaction-form" onSubmit={handleSubmit}>
      {/* Income / Expense toggle */}
      <div className="field-group">
        <span className="field-label">Transaction Type</span>
        <div className="type-toggle">
          <button
            type="button"
            className={`type-btn${type === 'expense' ? ' active-expense' : ''}`}
            onClick={() => setType('expense')}
          >
            <ArrowDownCircle size={16} /> Expense
          </button>
          <button
            type="button"
            className={`type-btn${type === 'income' ? ' active-income' : ''}`}
            onClick={() => setType('income')}
          >
            <ArrowUpCircle size={16} /> Income
          </button>
        </div>
      </div>

      {/* Description + Amount */}
      <div className="form-row">
        <div className="field-group">
          <label className="field-label" htmlFor="tx-desc">Description</label>
          <input
            id="tx-desc"
            className="field-input"
            type="text"
            placeholder="e.g. Business Lunch"
            value={description}
            onChange={e => setDescription(e.target.value)}
            required
          />
        </div>
        <div className="field-group">
          <label className="field-label" htmlFor="tx-amount">Amount (₹)</label>
          <input
            id="tx-amount"
            className="field-input"
            type="number"
            min="0"
            step="0.01"
            placeholder="0.00"
            value={amount}
            onChange={e => setAmount(e.target.value)}
            required
          />
        </div>
      </div>

      {/* Category + Note */}
      <div className="form-row">
        <div className="field-group">
          <label className="field-label" htmlFor="tx-cat">Category</label>
          <select
            id="tx-cat"
            className="field-select"
            value={category}
            onChange={e => setCategory(e.target.value)}
          >
            {CATEGORIES.map(c => (
              <option key={c} value={c}>
                {c}
              </option>
            ))}
          </select>
        </div>
        <div className="field-group">
          <label className="field-label" htmlFor="tx-note">Note (optional)</label>
          <input
            id="tx-note"
            className="field-input"
            type="text"
            placeholder="Any extra detail…"
            value={note}
            onChange={e => setNote(e.target.value)}
          />
        </div>
      </div>

      <button className="btn-primary" type="submit" id="submit-tx">
        Add Transaction
      </button>
    </form>
  );
}

export default TransactionForm;