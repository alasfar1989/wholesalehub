const express = require('express');
const { body } = require('express-validator');
const db = require('../config/database');
const { authenticate } = require('../middleware/auth');
const validate = require('../middleware/validate');
const { sendPushNotification } = require('../utils/pushNotifications');

const router = express.Router();

// GET /messages/conversations - list conversations
router.get('/conversations', authenticate, async (req, res) => {
  try {
    const result = await db.query(
      `SELECT DISTINCT ON (other_user_id)
        other_user_id, business_name, last_message, last_time, unread_count
       FROM (
         SELECT
           CASE WHEN m.from_user_id = $1 THEN m.to_user_id ELSE m.from_user_id END as other_user_id,
           u.business_name,
           m.content as last_message,
           m.created_at as last_time,
           (SELECT COUNT(*) FROM messages WHERE from_user_id =
             CASE WHEN m.from_user_id = $1 THEN m.to_user_id ELSE m.from_user_id END
             AND to_user_id = $1 AND is_read = FALSE) as unread_count
         FROM messages m
         JOIN users u ON u.id = CASE WHEN m.from_user_id = $1 THEN m.to_user_id ELSE m.from_user_id END
         WHERE m.from_user_id = $1 OR m.to_user_id = $1
         ORDER BY m.created_at DESC
       ) sub
       ORDER BY other_user_id, last_time DESC`,
      [req.user.id]
    );

    // Re-sort by last_time
    const conversations = result.rows.sort((a, b) => new Date(b.last_time) - new Date(a.last_time));
    res.json({ conversations });
  } catch (err) {
    console.error('Get conversations error:', err);
    res.status(500).json({ error: 'Server error' });
  }
});

// GET /messages/:userId - get messages with a user
router.get('/:userId', authenticate, async (req, res) => {
  try {
    // Check if either user has blocked the other
    const blocked = await db.query(
      'SELECT id FROM blocks WHERE (blocker_id = $1 AND blocked_id = $2) OR (blocker_id = $2 AND blocked_id = $1)',
      [req.user.id, req.params.userId]
    );
    if (blocked.rows.length > 0) {
      return res.json({ messages: [], blocked: true });
    }

    const page = Math.max(1, parseInt(req.query.page) || 1);
    const limit = 50;
    const offset = (page - 1) * limit;

    const result = await db.query(
      `SELECT m.*, u.business_name as from_business_name
       FROM messages m
       JOIN users u ON m.from_user_id = u.id
       WHERE (m.from_user_id = $1 AND m.to_user_id = $2)
          OR (m.from_user_id = $2 AND m.to_user_id = $1)
       ORDER BY m.created_at DESC
       LIMIT $3 OFFSET $4`,
      [req.user.id, req.params.userId, limit, offset]
    );

    // Mark messages as read
    await db.query(
      'UPDATE messages SET is_read = TRUE WHERE from_user_id = $1 AND to_user_id = $2 AND is_read = FALSE',
      [req.params.userId, req.user.id]
    );

    res.json({ messages: result.rows.reverse(), blocked: false });
  } catch (err) {
    console.error('Get messages error:', err);
    res.status(500).json({ error: 'Server error' });
  }
});

// POST /messages - send message
router.post(
  '/',
  authenticate,
  [
    body('to_user_id').notEmpty().withMessage('Recipient is required'),
    body('content').trim().notEmpty().withMessage('Message content is required'),
  ],
  validate,
  async (req, res) => {
    try {
      const { to_user_id, content } = req.body;

      if (to_user_id === req.user.id) {
        return res.status(400).json({ error: 'Cannot message yourself' });
      }

      const userExists = await db.query('SELECT id FROM users WHERE id = $1 AND is_suspended = FALSE', [to_user_id]);
      if (userExists.rows.length === 0) {
        return res.status(404).json({ error: 'User not found' });
      }

      // Check if either user has blocked the other
      const blocked = await db.query(
        'SELECT id FROM blocks WHERE (blocker_id = $1 AND blocked_id = $2) OR (blocker_id = $2 AND blocked_id = $1)',
        [req.user.id, to_user_id]
      );
      if (blocked.rows.length > 0) {
        return res.status(403).json({ error: 'Cannot send message to this user' });
      }

      const result = await db.query(
        `INSERT INTO messages (from_user_id, to_user_id, content)
         VALUES ($1, $2, $3) RETURNING *`,
        [req.user.id, to_user_id, content]
      );

      // Send push notification to recipient
      const sender = await db.query('SELECT business_name FROM users WHERE id = $1', [req.user.id]);
      const senderName = sender.rows[0]?.business_name || 'Someone';
      sendPushNotification(to_user_id, `Message from ${senderName}`, content.substring(0, 100), { type: 'message', userId: req.user.id, name: senderName });

      res.status(201).json({ message: result.rows[0] });
    } catch (err) {
      console.error('Send message error:', err);
      res.status(500).json({ error: 'Server error' });
    }
  }
);

module.exports = router;
