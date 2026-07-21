const User = require('./User');
const bcrypt = require('bcryptjs');

async function register(userDetails) {
  return User.create(userDetails);
}

async function login(email, password) {
  const user = await User.findOne({ email });
  if (!user) return null;
  
  const isValid = await bcrypt.compare(password, user.password);
  return isValid ? user : null;
}

module.exports = {
  register,
  login
};
