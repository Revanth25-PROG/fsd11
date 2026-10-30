const express = require('express');
const jwt = require('jsonwebtoken');
const User = require('../models/User');
const { verifyAuth, JWT_SECRET } = require('../middleware/auth');

const router = express.Router();

function createToken(user) {
  return jwt.sign(
    {
      id: user._id,
      name: user.name,
      email: user.email,
      role: user.role,
      businessId: user.businessId
    },
    JWT_SECRET,
    { expiresIn: '7d' }
  );
}

// POST /api/auth/register
router.post('/register', async (req, res) => {
  try {
    const { name, email, password, role, businessId } = req.body;
    if (!name || !email || !password) {
      return res.status(400).json({ message: 'Name, email, and password are required.' });
    }

    const existing = await User.findOne({ email: email.toLowerCase().trim() });
    if (existing) {
      return res.status(400).json({ message: 'A user with this email already exists.' });
    }

    const user = await User.create({
      name,
      email: email.toLowerCase().trim(),
      password,
      role: role === 'admin' ? 'admin' : 'staff',
      businessId: businessId || 'biz_default'
    });

    const token = createToken(user);
    res.status(201).json({
      token,
      user: {
        id: user._id,
        name: user.name,
        email: user.email,
        role: user.role,
        businessId: user.businessId
      }
    });
  } catch (error) {
    res.status(500).json({ message: 'Could not register user.' });
  }
});

// POST /api/auth/login
router.post('/login', async (req, res) => {
  try {
    const { email, password } = req.body;
    if (!email || !password) {
      return res.status(400).json({ message: 'Email and password are required.' });
    }

    const user = await User.findOne({ email: email.toLowerCase().trim() });
    if (!user) {
      return res.status(401).json({ message: 'Invalid email or password.' });
    }

    const isMatch = await user.comparePassword(password);
    if (!isMatch) {
      return res.status(401).json({ message: 'Invalid email or password.' });
    }

    const token = createToken(user);
    res.json({
      token,
      user: {
        id: user._id,
        name: user.name,
        email: user.email,
        role: user.role,
        businessId: user.businessId
      }
    });
  } catch (error) {
    res.status(500).json({ message: 'Could not log in.' });
  }
});

// GET /api/auth/me
router.get('/me', verifyAuth, async (req, res) => {
  try {
    if (req.user.id && req.user.id !== 'demo-user-id' && req.user.id !== 'default-admin-id') {
      const user = await User.findById(req.user.id).select('-password');
      if (user) return res.json(user);
    }
    res.json(req.user);
  } catch (error) {
    res.status(500).json({ message: 'Could not fetch user profile.' });
  }
});

// POST /api/auth/seed - Auto seed default admin & staff accounts
router.post('/seed', async (req, res) => {
  try {
    const count = await User.countDocuments();
    if (count === 0) {
      await User.create([
        {
          name: 'Sarah Connor (Admin)',
          email: 'admin@stockwise.com',
          password: 'admin123',
          role: 'admin',
          businessId: 'biz_default'
        },
        {
          name: 'Alex Rivera (Staff)',
          email: 'staff@stockwise.com',
          password: 'staff123',
          role: 'staff',
          businessId: 'biz_default'
        }
      ]);
      return res.json({ message: 'Default admin and staff accounts created.' });
    }
    res.json({ message: 'Accounts already exist.' });
  } catch (error) {
    res.status(500).json({ message: 'Could not seed default accounts.' });
  }
});

module.exports = router;
