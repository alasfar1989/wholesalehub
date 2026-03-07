const express = require('express');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const { body } = require('express-validator');
const db = require('../config/database');
const validate = require('../middleware/validate');

const router = express.Router();

// Strip all non-digit characters for phone comparison
function normalizePhone(phone) {
  return (phone || '').replace(/\D/g, '');
}

function isAdminPhone(phone) {
  return normalizePhone(phone) === normalizePhone(process.env.ADMIN_PHONE);
}

function generateToken(userId) {
  return jwt.sign({ userId }, process.env.JWT_SECRET, {
    expiresIn: process.env.JWT_EXPIRES_IN || '30d',
  });
}

// POST /auth/signup
router.post(
  '/signup',
  [
    body('phone').trim().notEmpty().withMessage('Phone is required'),
    body('password').isLength({ min: 6 }).withMessage('Password must be at least 6 characters'),
    body('business_name').trim().notEmpty().withMessage('Business name is required'),
    body('city').trim().notEmpty().withMessage('City is required'),
    body('category').trim().optional(),
  ],
  validate,
  async (req, res) => {
    try {
      const { phone, password, business_name, city, category } = req.body;

      const existing = await db.query('SELECT id FROM users WHERE phone = $1', [phone]);
      if (existing.rows.length > 0) {
        return res.status(409).json({ error: 'Phone number already registered' });
      }

      const password_hash = await bcrypt.hash(password, 12);
      const isAdmin = isAdminPhone(phone);

      const result = await db.query(
        `INSERT INTO users (phone, password_hash, business_name, city, category, is_admin)
         VALUES ($1, $2, $3, $4, $5, $6)
         RETURNING id, phone, business_name, city, category, is_admin, created_at`,
        [phone, password_hash, business_name, city, category || 'electronics', isAdmin]
      );

      const user = result.rows[0];
      const token = generateToken(user.id);

      res.status(201).json({ token, user });
    } catch (err) {
      console.error('Signup error:', err);
      res.status(500).json({ error: 'Server error' });
    }
  }
);

// POST /auth/login
router.post(
  '/login',
  [
    body('phone').trim().notEmpty().withMessage('Phone is required'),
    body('password').notEmpty().withMessage('Password is required'),
  ],
  validate,
  async (req, res) => {
    try {
      const { phone, password } = req.body;

      const result = await db.query(
        'SELECT id, phone, password_hash, business_name, city, category, bio, rating_score, rating_count, is_suspended, is_admin, created_at FROM users WHERE phone = $1',
        [phone]
      );

      if (result.rows.length === 0) {
        return res.status(401).json({ error: 'Invalid credentials' });
      }

      const user = result.rows[0];

      if (user.is_suspended) {
        return res.status(403).json({ error: 'Account suspended' });
      }

      const validPassword = await bcrypt.compare(password, user.password_hash);
      if (!validPassword) {
        return res.status(401).json({ error: 'Invalid credentials' });
      }

      // Sync admin status on login
      const shouldBeAdmin = isAdminPhone(phone);
      if (shouldBeAdmin !== user.is_admin) {
        await db.query('UPDATE users SET is_admin = $1 WHERE id = $2', [shouldBeAdmin, user.id]);
        user.is_admin = shouldBeAdmin;
      }

      const { password_hash, ...userWithoutPassword } = user;
      const token = generateToken(user.id);

      res.json({ token, user: userWithoutPassword });
    } catch (err) {
      console.error('Login error:', err);
      res.status(500).json({ error: 'Server error' });
    }
  }
);

module.exports = router;
