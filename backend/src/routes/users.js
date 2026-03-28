const express = require('express');
const { body } = require('express-validator');
const bcrypt = require('bcryptjs');
const multer = require('multer');
const db = require('../config/database');
const { authenticate } = require('../middleware/auth');
const validate = require('../middleware/validate');
const { uploadImage } = require('../utils/cloudinary');

const router = express.Router();
const upload = multer({ storage: multer.memoryStorage(), limits: { fileSize: 5 * 1024 * 1024 } });

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

// GET /users/me/blocks - get blocked users
router.get('/me/blocks', authenticate, async (req, res) => {
  try {
    const result = await db.query(
      'SELECT b.blocked_id, u.business_name FROM blocks b JOIN users u ON b.blocked_id = u.id WHERE b.blocker_id = $1',
      [req.user.id]
    );
    res.json({ blocks: result.rows });
  } catch (err) {
    console.error('Get blocks error:', err);
    res.status(500).json({ error: 'Server error' });
  }
});

// PUT /users/me/password - change password
router.put('/me/password', authenticate, async (req, res) => {
  try {
    const { current_password, new_password } = req.body;

    if (!current_password || !new_password) {
      return res.status(400).json({ error: 'Current password and new password are required' });
    }
    if (new_password.length < 6) {
      return res.status(400).json({ error: 'New password must be at least 6 characters' });
    }

    // Fetch the password hash from the database (not included in req.user)
    const userResult = await db.query('SELECT password_hash FROM users WHERE id = $1', [req.user.id]);
    if (userResult.rows.length === 0) {
      return res.status(404).json({ error: 'User not found' });
    }

    const isMatch = await bcrypt.compare(current_password, userResult.rows[0].password_hash);
    if (!isMatch) {
      return res.status(401).json({ error: 'Current password is incorrect' });
    }

    const hashedPassword = await bcrypt.hash(new_password, 12);

    await db.query('UPDATE users SET password_hash = $1, updated_at = NOW() WHERE id = $2', [hashedPassword, req.user.id]);

    res.json({ success: true, message: 'Password updated' });
  } catch (err) {
    console.error('Change password error:', err);
    res.status(500).json({ error: 'Server error' });
  }
});

// GET /users/:id - get user profile
router.get('/:id', async (req, res) => {
  try {
    const result = await db.query(
      'SELECT id, phone, email, avatar_url, business_name, city, category, bio, rating_score, rating_count, badge, is_suspended, last_active_at, created_at FROM users WHERE id = $1',
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
         RETURNING id, phone, business_name, city, category, bio, rating_score, rating_count, badge, is_admin, created_at`,
        values
      );

      res.json({ user: result.rows[0] });
    } catch (err) {
      console.error('Update user error:', err);
      res.status(500).json({ error: 'Server error' });
    }
  }
);

// POST /users/me/avatar - upload profile photo
router.post('/me/avatar', authenticate, upload.single('avatar'), async (req, res) => {
  try {
    if (!req.file) return res.status(400).json({ error: 'No image provided' });

    const { url } = await uploadImage(req.file.buffer, 'wholesalehub/avatars');
    await db.query('UPDATE users SET avatar_url = $1, updated_at = NOW() WHERE id = $2', [url, req.user.id]);

    res.json({ avatar_url: url });
  } catch (err) {
    console.error('Upload avatar error:', err);
    res.status(500).json({ error: 'Server error' });
  }
});

// PUT /users/me/push-token - register push notification token
router.put('/me/push-token', authenticate, async (req, res) => {
  try {
    const { push_token } = req.body;
    await db.query('UPDATE users SET push_token = $1 WHERE id = $2', [push_token || null, req.user.id]);
    res.json({ success: true });
  } catch (err) {
    console.error('Update push token error:', err);
    res.status(500).json({ error: 'Server error' });
  }
});

// POST /users/:id/report - report a user
router.post('/:id/report', authenticate, async (req, res) => {
  try {
    const { reason } = req.body;
    if (!reason || !reason.trim()) {
      return res.status(400).json({ error: 'Reason is required' });
    }
    if (req.params.id === req.user.id) {
      return res.status(400).json({ error: 'Cannot report yourself' });
    }
    await db.query(
      'INSERT INTO reports (reporter_id, reported_id, reason) VALUES ($1, $2, $3)',
      [req.user.id, req.params.id, reason.trim()]
    );
    res.json({ success: true, message: 'Report submitted' });
  } catch (err) {
    console.error('Report user error:', err);
    res.status(500).json({ error: 'Server error' });
  }
});

// POST /users/:id/block - block a user
router.post('/:id/block', authenticate, async (req, res) => {
  try {
    if (req.params.id === req.user.id) {
      return res.status(400).json({ error: 'Cannot block yourself' });
    }
    await db.query(
      'INSERT INTO blocks (blocker_id, blocked_id) VALUES ($1, $2) ON CONFLICT DO NOTHING',
      [req.user.id, req.params.id]
    );
    res.json({ success: true, message: 'User blocked' });
  } catch (err) {
    console.error('Block user error:', err);
    res.status(500).json({ error: 'Server error' });
  }
});

// DELETE /users/:id/block - unblock a user
router.delete('/:id/block', authenticate, async (req, res) => {
  try {
    await db.query(
      'DELETE FROM blocks WHERE blocker_id = $1 AND blocked_id = $2',
      [req.user.id, req.params.id]
    );
    res.json({ success: true, message: 'User unblocked' });
  } catch (err) {
    console.error('Unblock user error:', err);
    res.status(500).json({ error: 'Server error' });
  }
});

// DELETE /users/me - delete own account
router.delete('/me', authenticate, async (req, res) => {
  try {
    // Don't allow deletion if user has active escrows
    const active = await db.query(
      "SELECT COUNT(*) as count FROM escrows WHERE (buyer_id = $1 OR seller_id = $1) AND status NOT IN ('completed', 'cancelled', 'inspection_failed')",
      [req.user.id]
    );
    if (parseInt(active.rows[0].count) > 0) {
      return res.status(400).json({ error: 'Cannot delete account while you have active escrows. Please complete or cancel them first.' });
    }

    await db.query('DELETE FROM users WHERE id = $1', [req.user.id]);
    res.json({ success: true, message: 'Account deleted' });
  } catch (err) {
    console.error('Delete account error:', err);
    res.status(500).json({ error: 'Server error' });
  }
});

module.exports = router;
