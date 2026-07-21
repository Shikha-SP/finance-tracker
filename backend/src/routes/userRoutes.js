const express = require('express');
const router = express.Router();
const { updateProfile, changePassword, updateSettings } = require('../controllers/userController');
const { protect } = require('../middleware/authMiddleware');

// Get/Update profile
router.put('/profile', protect, updateProfile);

// Change password
router.put('/password', protect, changePassword);

// Update settings
router.put('/settings', protect, updateSettings);

module.exports = router;
