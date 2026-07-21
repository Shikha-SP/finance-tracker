const User = require('../models/User');
const bcrypt = require('bcryptjs');

exports.updateProfile = async (req, res) => {
  try {
    const user = await User.findById(req.user.userId);
    if (!user) {
      return res.status(404).json({ message: 'User not found' });
    }

    user.name = req.body.name || user.name;
    user.email = req.body.email || user.email;
    
    if (req.body.profilePic !== undefined) {
      user.profilePic = req.body.profilePic;
    }

    const updatedUser = await user.save();

    res.json({
      id: updatedUser._id,
      name: updatedUser.name,
      email: updatedUser.email,
      profilePic: updatedUser.profilePic,
      theme: updatedUser.theme
    });
  } catch (error) {
    res.status(500).json({ message: 'Server error updating profile' });
  }
};

exports.changePassword = async (req, res) => {
  try {
    const { currentPassword, newPassword } = req.body;
    const user = await User.findById(req.user.userId);

    if (!user) {
      return res.status(404).json({ message: 'User not found' });
    }

    const isMatch = await bcrypt.compare(currentPassword, user.password);
    if (!isMatch) {
      return res.status(401).json({ message: 'Incorrect current password' });
    }

    user.password = newPassword;
    await user.save();

    res.json({ message: 'Password updated successfully' });
  } catch (error) {
    res.status(500).json({ message: 'Server error changing password' });
  }
};

exports.updateSettings = async (req, res) => {
  try {
    const user = await User.findById(req.user.userId);
    if (!user) {
      return res.status(404).json({ message: 'User not found' });
    }

    if (req.body.theme !== undefined) {
      user.theme = req.body.theme;
    }

    if (req.body.notifications) {
      user.notifications = {
        ...user.notifications,
        ...req.body.notifications
      };
    }

    const updatedUser = await user.save();

    res.json({
      theme: updatedUser.theme,
      notifications: updatedUser.notifications
    });
  } catch (error) {
    res.status(500).json({ message: 'Server error updating settings' });
  }
};
