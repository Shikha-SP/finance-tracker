const express = require('express');
const router = express.Router();
const Transaction = require('../models/Transaction');

// Get all transactions
router.get('/', async (req, res) => {
  try {
    const transactions = await Transaction.find().sort({ createdAt: -1 });
    res.json(transactions);
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

// Create a transaction
router.post('/', async (req, res) => {
  const transaction = new Transaction({
    amount: req.body.amount,
    description: req.body.description,
    type: req.body.type,
    category: req.body.category,
    note: req.body.note,
    date: req.body.date,
    monthKey: req.body.monthKey
  });

  try {
    const newTransaction = await transaction.save();
    res.status(201).json(newTransaction);
  } catch (err) {
    res.status(400).json({ message: err.message });
  }
});

// Delete a transaction
router.delete('/:id', async (req, res) => {
  try {
    const transaction = await Transaction.findById(req.params.id);
    if (!transaction) {
      return res.status(404).json({ message: 'Transaction not found' });
    }
    await transaction.deleteOne();
    res.json({ message: 'Transaction deleted' });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

// Update a transaction
router.put('/:id', async (req, res) => {
  try {
    const transaction = await Transaction.findById(req.params.id);
    if (!transaction) {
      return res.status(404).json({ message: 'Transaction not found' });
    }

    if (req.body.amount !== undefined) transaction.amount = req.body.amount;
    if (req.body.description !== undefined) transaction.description = req.body.description;
    if (req.body.type !== undefined) transaction.type = req.body.type;
    if (req.body.category !== undefined) transaction.category = req.body.category;
    if (req.body.note !== undefined) transaction.note = req.body.note;
    if (req.body.date !== undefined) transaction.date = req.body.date;
    if (req.body.monthKey !== undefined) transaction.monthKey = req.body.monthKey;

    const updatedTransaction = await transaction.save();
    res.json(updatedTransaction);
  } catch (err) {
    res.status(400).json({ message: err.message });
  }
});

module.exports = router;
