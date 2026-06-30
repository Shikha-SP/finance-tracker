import { useState } from 'react'

function TransactionForm() {
  const [amount, setAmount] = useState('')
  const [description, setDescription] = useState('')
  const [transactions, setTransactions] = useState([])

  const total = transactions.reduce((sum, tx) => sum + Number(tx.amount || 0), 0)

  function handleSubmit(e) {
    e.preventDefault()

    if (!amount || !description) return

    const newTransaction = {
      id: Date.now(),
      amount: Number(amount),
      description
    }

    setTransactions([...transactions, newTransaction])

    setAmount('')
    setDescription('')
  }

  return (
    <section className="tracker-card">
      <form className="transaction-form" onSubmit={handleSubmit}>
        <div className="field-group">
          <label htmlFor="amount">Amount</label>
          <input
            id="amount"
            type="number"
            placeholder="Enter amount"
            value={amount}
            onChange={(e) => setAmount(e.target.value)}
          />
        </div>

        <div className="field-group">
          <label htmlFor="description">Description</label>
          <input
            id="description"
            type="text"
            placeholder="What was it for?"
            value={description}
            onChange={(e) => setDescription(e.target.value)}
          />
        </div>

        <button type="submit">Add transaction</button>
      </form>

      <div className="tracker-summary">
        <div>
          <span className="summary-label">Tracked total</span>
          <strong>₹{total.toLocaleString()}</strong>
        </div>
        <span className="summary-pill">{transactions.length} entries</span>
      </div>

      <div className="transaction-list">
        {transactions.length === 0 ? (
          <p className="empty-state">No transactions yet. Add your first expense or income.</p>
        ) : (
          transactions.map((tx) => (
            <div className="transaction-item" key={tx.id}>
              <div>
                <p className="transaction-description">{tx.description}</p>
                <p className="transaction-meta">Added recently</p>
              </div>
              <p className="transaction-amount">₹{tx.amount.toLocaleString()}</p>
            </div>
          ))
        )}
      </div>
    </section>
  )
}

export default TransactionForm