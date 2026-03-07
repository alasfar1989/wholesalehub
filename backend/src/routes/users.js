const express = require('express');
const { body } = require('express-validator');
const db = require('../config/database');
const { authenticate } = require('../middleware/auth');
const validate = require('../middleware/validate');

const router = express.Router();

// GET /users/me - get current user profile
router.get('/me', authenticate, (req, res) => {
  res.json({ user: req.user });
});

// GET /users/search?q=name - search users by business name
router.get('/search', authenticate, async (req, res) => {
  try {
    const q = (req.query.q || '').trim();
    if (q.length < 2) {
      return res.json({ users: [] });
    }
    const result = await db.query(
      `SELECT id, business_name, city, rating_score FROM users
       WHERE is_suspended = FALSE AND id != $1 AND LOWER(business_name) LIKE LOWER($2)
       ORDER BY business_name LIMIT 10`,
      [req.user.id, `%${q}%`]
    );
    res.json({ users: result.rows });
  } catch (err) {
    console.error('Search users error:', err);
    res.status(500).json({ error: 'Server error' });
  }
});

// GET /users/:id - get user profile
router.get('/:id', async (req, res) => {
  try {
    const result = await db.query(
      'SELECT id, phone, business_name, city, category, bio, rating_score, rating_count, created_at FROM users WHERE id = $1 AND is_suspended = FALSE',
      [req.params.id]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'User not found' });
    }

    res.json({ user: result.rows[0] });
  } catch (err) {
    console.error('Get user error:', err);
    res.status(500).json({ error: 'Server error' });
  }
});

// PUT /users/me - update current user profile
router.put(
  '/me',
  authenticate,
  [
    body('business_name').optional().trim().notEmpty(),
    body('city').optional().trim().notEmpty(),
    body('category').optional().trim().notEmpty(),
    body('bio').optional().trim(),
  ],
  validate,
  async (req, res) => {
    try {
      const { business_name, city, category, bio } = req.body;
      const fields = [];
      const values = [];
      let paramCount = 0;

      if (business_name !== undefined) {
        paramCount++;
        fields.push(`business_name = $${paramCount}`);
        values.push(business_name);
      }
      if (city !== undefined) {
        paramCount++;
        fields.push(`city = $${paramCount}`);
        values.push(city);
      }
      if (category !== undefined) {
        paramCount++;
        fields.push(`category = $${paramCount}`);
        values.push(category);
      }
      if (bio !== undefined) {
        paramCount++;
        fields.push(`bio = $${paramCount}`);
        values.push(bio);
      }

      if (fields.length === 0) {
        return res.status(400).json({ error: 'No fields to update' });
      }

      paramCount++;
      fields.push(`updated_at = NOW()`);
      values.push(req.user.id);

      const result = await db.query(
        `UPDATE users SET ${fields.join(', ')} WHERE id = $${paramCount}
         RETURNING id, phone, business_name, city, category, bio, rating_score, rating_count, is_admin, created_at`,
        values
      );

      res.json({ user: result.rows[0] });
    } catch (err) {
      console.error('Update user error:', err);
      res.status(500).json({ error: 'Server error' });
    }
  }
);

module.exports = router;
