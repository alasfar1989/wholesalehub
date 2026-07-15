const express = require('express');
const db = require('../config/database');
const { authenticate } = require('../middleware/auth');

const router = express.Router();

// Turn empty strings into null so they act as wildcards in the matcher.
function nn(v) {
  if (v === undefined || v === null) return null;
  const s = String(v).trim();
  return s === '' ? null : s;
}
function nnum(v) {
  if (v === undefined || v === null || v === '') return null;
  const n = parseFloat(v);
  return Number.isNaN(n) ? null : n;
}

// POST /saved-searches - save a search so new matching listings trigger an alert
router.post('/', authenticate, async (req, res) => {
  try {
    const keyword = nn(req.body.keyword);
    const type = nn(req.body.type);
    const city = nn(req.body.city);
    const category = nn(req.body.category);
    const condition = nn(req.body.condition);
    const min_price = nnum(req.body.min_price);
    const max_price = nnum(req.body.max_price);

    if (type && type !== 'WTS' && type !== 'WTB') {
      return res.status(400).json({ error: 'Type must be WTS or WTB' });
    }
    if (!keyword && !type && !city && !category && !condition && min_price == null && max_price == null) {
      return res.status(400).json({ error: 'Add at least one filter to save a search' });
    }

    const result = await db.query(
      `INSERT INTO saved_searches (user_id, keyword, type, city, category, condition, min_price, max_price)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8) RETURNING *`,
      [req.user.id, keyword, type, city, category, condition, min_price, max_price]
    );
    res.status(201).json({ saved_search: result.rows[0] });
  } catch (err) {
    console.error('Create saved search error:', err);
    res.status(500).json({ error: 'Server error' });
  }
});

// GET /saved-searches - list the user's saved searches
router.get('/', authenticate, async (req, res) => {
  try {
    const result = await db.query(
      'SELECT * FROM saved_searches WHERE user_id = $1 ORDER BY created_at DESC',
      [req.user.id]
    );
    res.json({ saved_searches: result.rows });
  } catch (err) {
    console.error('Get saved searches error:', err);
    res.status(500).json({ error: 'Server error' });
  }
});

// DELETE /saved-searches/:id - remove a saved search
router.delete('/:id', authenticate, async (req, res) => {
  try {
    const result = await db.query(
      'DELETE FROM saved_searches WHERE id = $1 AND user_id = $2 RETURNING id',
      [req.params.id, req.user.id]
    );
    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Saved search not found' });
    }
    res.json({ success: true });
  } catch (err) {
    console.error('Delete saved search error:', err);
    res.status(500).json({ error: 'Server error' });
  }
});

module.exports = router;
