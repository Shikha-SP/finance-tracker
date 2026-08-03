import { useState } from 'react';
import {
  ArrowDownCircle,
  ArrowUpCircle
} from 'lucide-react';
import { TRANSACTION_CATEGORIES } from '../utils/transactionCategories';

const todayISO = () => new Date().toISOString().split('T')[0];

function getInitialState(editTx) {
  if (editTx) {
    const raw = editTx.dateISO || editTx.date;
    const parsed = new Date(raw);

    return {
      amount: editTx.amount.toString(),
      description: editTx.description,
      type: editTx.type,
      category: editTx.category,
      note: editTx.note || '',
      date: !isNaN(parsed) ? parsed.toISOString().split('T')[0] : todayISO(),
    };
  }

  return {
    amount: '',
    description: '',
    type: 'expense',
    category: 'Other',
    note: '',
    date: todayISO(),
  };
}

function TransactionForm({ onAdd, editTx, onCancelEdit, onUpdate }) {
  const initialState = getInitialState(editTx);

  const [amount,      setAmount]      = useState(initialState.amount);
  const [description, setDescription] = useState(initialState.description);
  const [type,        setType]        = useState(initialState.type);
  const [category,    setCategory]    = useState(initialState.category);
  const [note,        setNote]        = useState(initialState.note);
  const [date,        setDate]        = useState(initialState.date);

  function handleSubmit(e) {
    e.preventDefault();
    if (!amount || !description) return;

    const selectedDate = new Date(date + 'T00:00:00');
    const displayDate  = selectedDate.toLocaleDateString('en-IN', {
      day: '2-digit', month: 'short', year: 'numeric',
    });
    const monthKey = selectedDate.toLocaleDateString('en-IN', {
      month: 'short', year: 'numeric',
    });

    const payload = {
      amount:      Number(amount),
      description: description.trim(),
      type,
      category,
      note:        note.trim(),
      date:        displayDate,
      dateISO:     date,
      monthKey,
    };

    if (editTx) {
      onUpdate?.(editTx.id, payload);
    } else {
      onAdd?.(payload);
      setAmount('');
      setDescription('');
      setType('expense');
      setCategory('Other');
      setNote('');
      setDate(todayISO());
    }
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
          <label className="field-label" htmlFor="tx-amount">Amount (रू)</label>
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

      {/* Category + Date */}
      <div className="form-row">
        <div className="field-group">
          <label className="field-label" htmlFor="tx-cat">Category</label>
          <select
            id="tx-cat"
            className="field-select"
            value={category}
            onChange={e => setCategory(e.target.value)}
          >
            {TRANSACTION_CATEGORIES.map(c => (
              <option key={c} value={c}>{c}</option>
            ))}
          </select>
        </div>
        <div className="field-group">
          <label className="field-label" htmlFor="tx-date">Date</label>
          <input
            id="tx-date"
            className="field-input"
            type="date"
            value={date}
            onChange={e => setDate(e.target.value)}
            max={todayISO()}
          />
        </div>
      </div>

      {/* Note */}
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

      <div style={{ display: 'flex', gap: '0.75rem', marginTop: '0.25rem' }}>
        <button className="btn-primary" type="submit" id="submit-tx" style={{ flex: 1 }}>
          {editTx ? 'Save Changes' : 'Add Transaction'}
        </button>
        {editTx && (
          <button className="btn-outline" type="button" onClick={onCancelEdit} style={{ flex: 1 }}>
            Cancel
          </button>
        )}
      </div>
    </form>
  );
}

export default TransactionForm;