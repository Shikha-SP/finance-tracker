import { useState } from 'react'

function TransactionForm() {
  const [amount, setAmount] = useState('')
  const [description, setDescription] = useState('')
  const [transactions, setTransactions] = useState([])

  function handleSubmit(e) {
    e.preventDefault()

    if (!amount || !description) return

    const newTransaction = {
      id: Date.now(),
      amount,
      description
    }

    setTransactions([...transactions, newTransaction])

    setAmount('')
    setDescription('')
  }

  return (
    <div>
      <form onSubmit={handleSubmit}>
        <input
          type="number"
          placeholder="Amount"
          value={amount}
          onChange={(e) => setAmount(e.target.value)}
        />

        <input
          type="text"
          placeholder="What was it for?"
          value={description}
          onChange={(e) => setDescription(e.target.value)}
        />

        <button type="submit">
          Add
        </button>
      </form>

      {transactions.map((tx) => (
        <div key={tx.id}>
          <p>{tx.description}</p>
          <p>₹{tx.amount}</p>
        </div>
      ))}
    </div>
  )
}

export default TransactionForm