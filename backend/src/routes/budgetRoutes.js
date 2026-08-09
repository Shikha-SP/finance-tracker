const express = require('express');
const router = express.Router();
const Budget = require('../models/Budget');

// Get all budgets
router.get('/', async (req, res) => {
  try {
    const budgets = await Budget.find();
    res.json(budgets);
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

// Update or Create a budget for a category
router.put('/', async (req, res) => {
  const { category, limit } = req.body;
  try {
    let budget = await Budget.findOne({ category });
    if (budget) {
      budget.limit = limit;
      await budget.save();
    } else {
      budget = new Budget({ category, limit });
      await budget.save();
    }
    res.json(budget);
  } catch (err) {
    res.status(400).json({ message: err.message });
  }
});

// Delete a budget by category
router.delete('/:category', async (req, res) => {
  try {
    const budget = await Budget.findOneAndDelete({ category: req.params.category });
    if (!budget) return res.status(404).json({ message: 'Budget not found.' });
    res.json({ message: 'Budget deleted.', deleted: budget });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

module.exports = router;
