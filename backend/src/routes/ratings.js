const express = require('express');
const { body } = require('express-validator');
const db = require('../config/database');
const { authenticate } = require('../middleware/auth');
const validate = require('../middleware/validate');

const router = express.Router();

// GET /ratings/:userId - get ratings for a user
router.get('/:userId', async (req, res) => {
  try {
    const result = await db.query(
      `SELECT r.*, u.business_name as from_business_name
       FROM ratings r
       JOIN users u ON r.from_user_id = u.id
       WHERE r.to_user_id = $1
       ORDER BY r.created_at DESC`,
      [req.params.userId]
    );
    res.json({ ratings: result.rows });
  } catch (err) {
    console.error('Get ratings error:', err);
    res.status(500).json({ error: 'Server error' });
  }
});

// POST /ratings - rate a user
router.post(
  '/',
  authenticate,
  [
    body('to_user_id').notEmpty().withMessage('Target user is required'),
    body('stars').isInt({ min: 1, max: 5 }).withMessage('Stars must be 1-5'),
    body('comment').optional().trim(),
  ],
  validate,
  async (req, res) => {
    try {
      const { to_user_id, stars, comment } = req.body;

      if (to_user_id === req.user.id) {
        return res.status(400).json({ error: 'Cannot rate yourself' });
      }

      // Check if target user exists
      const userExists = await db.query('SELECT id FROM users WHERE id = $1', [to_user_id]);
      if (userExists.rows.length === 0) {
        return res.status(404).json({ error: 'User not found' });
      }

      // Upsert rating
      const result = await db.query(
        `INSERT INTO ratings (from_user_id, to_user_id, stars, comment)
         VALUES ($1, $2, $3, $4)
         ON CONFLICT (from_user_id, to_user_id)
         DO UPDATE SET stars = $3, comment = $4, created_at = NOW()
         RETURNING *`,
        [req.user.id, to_user_id, stars, comment || '']
      );

      // Recalculate average rating
      const avgResult = await db.query(
        'SELECT AVG(stars)::DECIMAL(3,2) as avg_rating, COUNT(*) as count FROM ratings WHERE to_user_id = $1',
        [to_user_id]
      );

      await db.query(
        'UPDATE users SET rating_score = $1, rating_count = $2 WHERE id = $3',
        [avgResult.rows[0].avg_rating, avgResult.rows[0].count, to_user_id]
      );

      res.status(201).json({ rating: result.rows[0] });
    } catch (err) {
      console.error('Rate user error:', err);
      res.status(500).json({ error: 'Server error' });
    }
  }
);

module.exports = router;
