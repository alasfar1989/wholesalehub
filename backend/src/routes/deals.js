const express = require('express');
const { body } = require('express-validator');
const db = require('../config/database');
const { authenticate } = require('../middleware/auth');
const validate = require('../middleware/validate');
const { sendPushNotification } = require('../utils/pushNotifications');

const router = express.Router();

// POST /deals - mark listing as sold and record the deal
router.post(
  '/',
  authenticate,
  [
    body('listing_id').notEmpty().withMessage('Listing is required'),
    body('buyer_id').notEmpty().withMessage('Buyer is required'),
    body('stars').optional().isInt({ min: 1, max: 5 }),
    body('comment').optional().trim(),
  ],
  validate,
  async (req, res) => {
    try {
      const { listing_id, buyer_id, stars, comment } = req.body;

      // Verify listing ownership
      const listing = await db.query('SELECT * FROM listings WHERE id = $1', [listing_id]);
      if (listing.rows.length === 0) return res.status(404).json({ error: 'Listing not found' });
      if (listing.rows[0].user_id !== req.user.id) return res.status(403).json({ error: 'Not your listing' });

      if (buyer_id === req.user.id) return res.status(400).json({ error: 'Cannot mark yourself as buyer' });

      // Verify buyer exists
      const buyer = await db.query('SELECT id, business_name FROM users WHERE id = $1 AND is_suspended = FALSE', [buyer_id]);
      if (buyer.rows.length === 0) return res.status(404).json({ error: 'Buyer not found' });

      // Create the deal
      const deal = await db.query(
        'INSERT INTO deals (listing_id, seller_id, buyer_id) VALUES ($1, $2, $3) RETURNING *',
        [listing_id, req.user.id, buyer_id]
      );

      // Mark listing as sold (inactive)
      await db.query('UPDATE listings SET is_active = FALSE, updated_at = NOW() WHERE id = $1', [listing_id]);

      // Add buyer as reference for seller
      await db.query(
        'INSERT INTO references_table (user_id, reference_name, reference_phone) VALUES ($1, $2, $3) ON CONFLICT DO NOTHING',
        [req.user.id, buyer.rows[0].business_name, 'deal-ref']
      );

      // Add seller as reference for buyer
      await db.query(
        'INSERT INTO references_table (user_id, reference_name, reference_phone) VALUES ($1, $2, $3) ON CONFLICT DO NOTHING',
        [buyer_id, req.user.business_name, 'deal-ref']
      );

      // If seller left a rating for buyer
      if (stars) {
        const existingRating = await db.query(
          'SELECT id FROM ratings WHERE from_user_id = $1 AND to_user_id = $2',
          [req.user.id, buyer_id]
        );
        if (existingRating.rows.length === 0) {
          await db.query(
            "INSERT INTO ratings (from_user_id, to_user_id, stars, comment, status) VALUES ($1, $2, $3, $4, 'pending')",
            [req.user.id, buyer_id, stars, comment || '']
          );
        }
      }

      // Notify buyer - they can now rate the seller back
      sendPushNotification(
        buyer_id,
        'Deal Completed!',
        `${req.user.business_name} marked a deal with you as completed. Rate your experience!`,
        { type: 'deal', dealId: deal.rows[0].id, sellerId: req.user.id }
      );

      res.status(201).json({ deal: deal.rows[0] });
    } catch (err) {
      console.error('Create deal error:', err);
      res.status(500).json({ error: 'Server error' });
    }
  }
);

// GET /deals/pending-reviews - deals where the user hasn't rated the other party yet
router.get('/pending-reviews', authenticate, async (req, res) => {
  try {
    const result = await db.query(
      `SELECT d.*,
        l.title as listing_title,
        s.business_name as seller_name,
        b.business_name as buyer_name
       FROM deals d
       LEFT JOIN listings l ON d.listing_id = l.id
       JOIN users s ON d.seller_id = s.id
       JOIN users b ON d.buyer_id = b.id
       WHERE (d.buyer_id = $1 OR d.seller_id = $1)
       ORDER BY d.created_at DESC`,
      [req.user.id]
    );

    // Filter to deals where user hasn't left a rating yet
    const deals = [];
    for (const deal of result.rows) {
      const otherUserId = deal.seller_id === req.user.id ? deal.buyer_id : deal.seller_id;
      const existingRating = await db.query(
        'SELECT id FROM ratings WHERE from_user_id = $1 AND to_user_id = $2',
        [req.user.id, otherUserId]
      );
      deals.push({ ...deal, has_rated: existingRating.rows.length > 0 });
    }

    res.json({ deals });
  } catch (err) {
    console.error('Get pending reviews error:', err);
    res.status(500).json({ error: 'Server error' });
  }
});

// POST /deals/:id/rate - rate the other party in a deal
router.post(
  '/:id/rate',
  authenticate,
  [
    body('stars').isInt({ min: 1, max: 5 }).withMessage('Stars required (1-5)'),
    body('comment').trim().notEmpty().withMessage('Feedback is required'),
  ],
  validate,
  async (req, res) => {
    try {
      const deal = await db.query('SELECT * FROM deals WHERE id = $1', [req.params.id]);
      if (deal.rows.length === 0) return res.status(404).json({ error: 'Deal not found' });

      const d = deal.rows[0];
      if (d.buyer_id !== req.user.id && d.seller_id !== req.user.id) {
        return res.status(403).json({ error: 'Not part of this deal' });
      }

      const otherUserId = d.seller_id === req.user.id ? d.buyer_id : d.seller_id;

      // Check if already rated
      const existing = await db.query(
        'SELECT id FROM ratings WHERE from_user_id = $1 AND to_user_id = $2',
        [req.user.id, otherUserId]
      );
      if (existing.rows.length > 0) {
        return res.status(400).json({ error: 'You have already rated this trader' });
      }

      await db.query(
        "INSERT INTO ratings (from_user_id, to_user_id, stars, comment, status) VALUES ($1, $2, $3, $4, 'pending')",
        [req.user.id, otherUserId, req.body.stars, req.body.comment]
      );

      res.json({ success: true, message: 'Rating submitted for review' });
    } catch (err) {
      console.error('Rate deal error:', err);
      res.status(500).json({ error: 'Server error' });
    }
  }
);

module.exports = router;
