const express = require('express');
const router = express.Router();
const Portfolio = require('../models/Portfolio');
const { protect: auth } = require('../middleware/authMiddleware');

// Get user's portfolio items
router.get('/', auth, async (req, res) => {
  try {
    const userId = req.user.userId || req.user.id;
    const items = await Portfolio.find({ user: userId }).sort({ date: -1 });
    res.json(items);
  } catch (err) {
    console.error(err.message);
    res.status(500).send('Server Error');
  }
});

// Add a portfolio item
router.post('/', auth, async (req, res) => {
  const { symbol, type, quantity, price, date } = req.body;
  try {
    const userId = req.user.userId || req.user.id;
    const newItem = new Portfolio({
      user: userId,
      symbol,
      type,
      quantity,
      price,
      date: date || Date.now()
    });
    const item = await newItem.save();
    res.json(item);
  } catch (err) {
    console.error(err.message);
    res.status(500).send('Server Error');
  }
});

// Delete an item
router.delete('/:id', auth, async (req, res) => {
  try {
    const item = await Portfolio.findById(req.params.id);
    if (!item) return res.status(404).json({ msg: 'Item not found' });
    const userId = req.user.userId || req.user.id;
    if (item.user.toString() !== userId) return res.status(401).json({ msg: 'Not authorized' });

    await item.deleteOne();
    res.json({ msg: 'Item removed' });
  } catch (err) {
    console.error(err.message);
    if (err.kind === 'ObjectId') return res.status(404).json({ msg: 'Item not found' });
    res.status(500).send('Server Error');
  }
});

module.exports = router;
