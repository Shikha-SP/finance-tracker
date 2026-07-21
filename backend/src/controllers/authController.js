const jwt = require('jsonwebtoken');
const AuthModel = require('../models/authModel');

const JWT_SECRET = process.env.JWT_SECRET || 'financetracker_secret_key';
const JWT_EXPIRES = '7d';

exports.registerUser = async (req, res) => {
  try {
    const user = await AuthModel.register(req.body);
    if (user) {
      return res
        .status(201)
        .json({ message: 'User registered successfully', data: user });
    }
    return res
      .status(400)
      .json({ error: 'Please provide user details correctly' });
  } catch (err) {
    if (err.code === 11000) {
      return res.status(409).json({ message: 'An account with that email already exists.' });
    }
    console.error('Register error:', err);
    res.status(500).json({ message: 'Server error during registration.', error: err.message, stack: err.stack });
  }
};

exports.loginUser = async (req, res) => {
  try {
    const { email, password } = req.body;
    const user = await AuthModel.login(email, password);
    
    if (user) {
      // Generate token so the frontend stays authenticated
      const token = jwt.sign(
        { userId: user._id, email: user.email },
        JWT_SECRET,
        { expiresIn: JWT_EXPIRES }
      );

      return res
        .status(201)
        .json({ 
          message: 'User logged in successfully', 
          token,
          user: {
            id: user._id,
            name: user.name,
            email: user.email,
            profilePic: user.profilePic,
            theme: user.theme
          } 
        });
    }
    
    return res
      .status(400)
      .json({ error: 'Invalid email or password' });
  } catch (err) {
    console.error('Login error:', err);
    res.status(500).json({ message: 'Server error during login.' });
  }
};
