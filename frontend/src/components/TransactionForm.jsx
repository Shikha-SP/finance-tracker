import { useState } from 'react'

export default function TransactionForm() {
  const [amount, setAmount] = useState('')
  const [description, setDescription] = useState('')
  const [transactions, setTransactions] = useState([])

  const handleSubmit = (e) => {
    e.preventDefault()
    if (!amount || !description) return

    setTransactions([
      ...transactions,
      { id: Date.now(), amount, description }
    ])
    setAmount('')
    setDescription('')
  }

  return (
    <div>
      <form onSubmit={handleSubmit} className="space-y-3 mb-6">
        <input
          type="number"
          placeholder="amount"
          value={amount}
          onChange={(e) => setAmount(e.target.value)}
          className="w-full px-3 py-2 border border-gray-300 text-sm"
        />
        <input
          type="text"
          placeholder="what was it for"
          value={description}
          onChange={(e) => setDescription(e.target.value)}
          className="w-full px-3 py-2 border border-gray-300 text-sm"
        />
        <button
          type="submit"
          className="w-full px-3 py-2 bg-black text-white text-sm hover:bg-gray-800"
        >
          add
        </button>
      </form>

      <div className="space-y-2 border-t pt-4">
        {transactions.length === 0 ? (
          <p className="text-gray-400 text-sm">nothing yet</p>
        ) : (
          transactions.map((tx) => (
            <div key={tx.id} className="flex justify-between text-sm">
              <span>{tx.description}</span>
              <span>₹{tx.amount}</span>
            </div>
          ))
        )}
      </div>
    </div>
  )
}