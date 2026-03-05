const express = require('express');
const { body } = require('express-validator');
const db = require('../config/database');
const { authenticate } = require('../middleware/auth');
const validate = require('../middleware/validate');

const router = express.Router();

// GET /references/:userId - get references for a user
router.get('/:userId', async (req, res) => {
  try {
    const result = await db.query(
      'SELECT * FROM references_table WHERE user_id = $1 ORDER BY created_at DESC',
      [req.params.userId]
    );
    res.json({ references: result.rows });
  } catch (err) {
    console.error('Get references error:', err);
    res.status(500).json({ error: 'Server error' });
  }
});

// POST /references/:userId - add reference to a user's profile
router.post(
  '/:userId',
  authenticate,
  [
    body('reference_name').trim().notEmpty().withMessage('Reference name is required'),
    body('reference_phone').trim().notEmpty().withMessage('Reference phone is required'),
  ],
  validate,
  async (req, res) => {
    try {
      // Can only add references to your own profile
      if (req.params.userId !== req.user.id) {
        return res.status(403).json({ error: 'Can only add references to your own profile' });
      }

      const { reference_name, reference_phone } = req.body;

      const result = await db.query(
        `INSERT INTO references_table (user_id, reference_name, reference_phone)
         VALUES ($1, $2, $3) RETURNING *`,
        [req.user.id, reference_name, reference_phone]
      );

      res.status(201).json({ reference: result.rows[0] });
    } catch (err) {
      console.error('Add reference error:', err);
      res.status(500).json({ error: 'Server error' });
    }
  }
);

// DELETE /references/:id - delete own reference
router.delete('/:id', authenticate, async (req, res) => {
  try {
    const existing = await db.query('SELECT user_id FROM references_table WHERE id = $1', [req.params.id]);
    if (existing.rows.length === 0) {
      return res.status(404).json({ error: 'Reference not found' });
    }
    if (existing.rows[0].user_id !== req.user.id) {
      return res.status(403).json({ error: 'Not authorized' });
    }

    await db.query('DELETE FROM references_table WHERE id = $1', [req.params.id]);
    res.json({ message: 'Reference deleted' });
  } catch (err) {
    console.error('Delete reference error:', err);
    res.status(500).json({ error: 'Server error' });
  }
});

module.exports = router;
