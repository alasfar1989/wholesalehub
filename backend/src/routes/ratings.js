const express = require('express');
const { body } = require('express-validator');
const db = require('../config/database');
const { authenticate, requireAdmin } = require('../middleware/auth');
const validate = require('../middleware/validate');

const { recalcBadge } = require('../utils/badges');

const router = express.Router();

// Helper: recalculate user's rating from approved ratings only
async function recalcRating(userId) {
  const result = await db.query(
    `SELECT AVG(stars)::DECIMAL(3,2) as avg_rating, COUNT(*) as count
     FROM ratings WHERE to_user_id = $1 AND status = 'approved'`,
    [userId]
  );
  await db.query(
    'UPDATE users SET rating_score = $1, rating_count = $2 WHERE id = $3',
    [result.rows[0].avg_rating || 0, result.rows[0].count, userId]
  );
}

// GET /ratings/pending - admin: get pending ratings (MUST be before /:userId)
router.get('/pending', authenticate, requireAdmin, async (req, res) => {
  try {
    const result = await db.query(
      `SELECT r.*,
        f.business_name as from_business_name,
        t.business_name as to_business_name,
        t.rating_score as to_rating_score,
        t.rating_count as to_rating_count
       FROM ratings r
       JOIN users f ON r.from_user_id = f.id
       JOIN users t ON r.to_user_id = t.id
       WHERE r.status = 'pending'
       ORDER BY r.created_at ASC`
    );
    res.json({ ratings: result.rows });
  } catch (err) {
    console.error('Pending ratings error:', err);
    res.status(500).json({ error: 'Server error' });
  }
});

// PUT /ratings/:id/approve - admin approves rating
router.put('/:id/approve', authenticate, requireAdmin, async (req, res) => {
  try {
    const rating = await db.query('SELECT * FROM ratings WHERE id = $1', [req.params.id]);
    if (rating.rows.length === 0) return res.status(404).json({ error: 'Rating not found' });
    if (rating.rows[0].status !== 'pending') return res.status(400).json({ error: 'Rating is not pending' });

    await db.query("UPDATE ratings SET status = 'approved' WHERE id = $1", [req.params.id]);
    await recalcRating(rating.rows[0].to_user_id);
    await recalcBadge(rating.rows[0].to_user_id);

    res.json({ message: 'Rating approved' });
  } catch (err) {
    console.error('Approve rating error:', err);
    res.status(500).json({ error: 'Server error' });
  }
});

// PUT /ratings/:id/reject - admin rejects rating
router.put('/:id/reject', authenticate, requireAdmin, async (req, res) => {
  try {
    const rating = await db.query('SELECT * FROM ratings WHERE id = $1', [req.params.id]);
    if (rating.rows.length === 0) return res.status(404).json({ error: 'Rating not found' });
    if (rating.rows[0].status !== 'pending') return res.status(400).json({ error: 'Rating is not pending' });

    await db.query("UPDATE ratings SET status = 'rejected' WHERE id = $1", [req.params.id]);

    res.json({ message: 'Rating rejected' });
  } catch (err) {
    console.error('Reject rating error:', err);
    res.status(500).json({ error: 'Server error' });
  }
});

// GET /ratings/:userId - get APPROVED ratings for a user (public)
router.get('/:userId', async (req, res) => {
  try {
    const result = await db.query(
      `SELECT r.id, r.stars, r.comment, r.created_at, u.business_name as from_business_name
       FROM ratings r
       JOIN users u ON r.from_user_id = u.id
       WHERE r.to_user_id = $1 AND r.status = 'approved'
       ORDER BY r.created_at DESC`,
      [req.params.userId]
    );
    res.json({ ratings: result.rows });
  } catch (err) {
    console.error('Get ratings error:', err);
    res.status(500).json({ error: 'Server error' });
  }
});

// POST /ratings/admin - admin leaves review on a user (auto-approved)
router.post(
  '/admin',
  authenticate,
  requireAdmin,
  [
    body('to_user_id').notEmpty().withMessage('Target user is required'),
    body('stars').isInt({ min: 1, max: 5 }).withMessage('Stars must be 1-5'),
    body('comment').trim().notEmpty().withMessage('Feedback is required'),
  ],
  validate,
  async (req, res) => {
    try {
      const { to_user_id, stars, comment } = req.body;

      if (to_user_id === req.user.id) {
        return res.status(400).json({ error: 'Cannot rate yourself' });
      }

      const userExists = await db.query('SELECT id FROM users WHERE id = $1', [to_user_id]);
      if (userExists.rows.length === 0) {
        return res.status(404).json({ error: 'User not found' });
      }

      const result = await db.query(
        `INSERT INTO ratings (from_user_id, to_user_id, stars, comment, status)
         VALUES ($1, $2, $3, $4, 'approved')
         ON CONFLICT (from_user_id, to_user_id)
         DO UPDATE SET stars = $3, comment = $4, status = 'approved', created_at = NOW()
         RETURNING *`,
        [req.user.id, to_user_id, stars, comment]
      );

      await recalcRating(to_user_id);
      await recalcBadge(to_user_id);

      res.status(201).json({ rating: result.rows[0], message: 'Admin review posted' });
    } catch (err) {
      console.error('Admin rate user error:', err);
      res.status(500).json({ error: 'Server error' });
    }
  }
);

// POST /ratings - submit rating (goes to moderation)
router.post(
  '/',
  authenticate,
  [
    body('to_user_id').notEmpty().withMessage('Target user is required'),
    body('stars').isInt({ min: 1, max: 5 }).withMessage('Stars must be 1-5'),
    body('comment').trim().notEmpty().withMessage('Feedback is required'),
    body('escrow_id').optional(),
  ],
  validate,
  async (req, res) => {
    try {
      const { to_user_id, stars, comment, escrow_id } = req.body;

      if (to_user_id === req.user.id) {
        return res.status(400).json({ error: 'Cannot rate yourself' });
      }

      const userExists = await db.query('SELECT id FROM users WHERE id = $1', [to_user_id]);
      if (userExists.rows.length === 0) {
        return res.status(404).json({ error: 'User not found' });
      }

      // If escrow_id provided, verify the escrow is completed and user is the buyer
      if (escrow_id) {
        const escrow = await db.query(
          "SELECT * FROM escrows WHERE id = $1 AND status = 'completed'",
          [escrow_id]
        );
        if (escrow.rows.length === 0) {
          return res.status(400).json({ error: 'Escrow not found or not completed' });
        }
        if (escrow.rows[0].buyer_id !== req.user.id) {
          return res.status(403).json({ error: 'Only the buyer can rate the seller for this escrow' });
        }
      }

      // Upsert rating as pending
      const result = await db.query(
        `INSERT INTO ratings (from_user_id, to_user_id, escrow_id, stars, comment, status)
         VALUES ($1, $2, $3, $4, $5, 'pending')
         ON CONFLICT (from_user_id, to_user_id)
         DO UPDATE SET stars = $4, comment = $5, escrow_id = $3, status = 'pending', created_at = NOW()
         RETURNING *`,
        [req.user.id, to_user_id, escrow_id || null, stars, comment]
      );

      res.status(201).json({ rating: result.rows[0], message: 'Rating submitted for review' });
    } catch (err) {
      console.error('Rate user error:', err);
      res.status(500).json({ error: 'Server error' });
    }
  }
);

module.exports = router;
