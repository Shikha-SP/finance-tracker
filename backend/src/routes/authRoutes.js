const express = require('express');
const router = express.Router();
const { registerUser, loginUser } = require('../controllers/authController');
const { validateRegister, validateLogin } = require('../validators/authValidator');

// POST /api/auth/register
router.post('/register', validateRegister, registerUser);

// POST /api/auth/login
router.post('/login', validateLogin, loginUser);

module.exports = router;
