const express = require('express');
const { body } = require('express-validator');
const db = require('../config/database');
const { authenticate } = require('../middleware/auth');
const validate = require('../middleware/validate');
const { sendPushNotification } = require('../utils/pushNotifications');

const router = express.Router();

// Whose turn is it to respond, given a status: pending -> seller, countered -> buyer.
function awaitingUserId(offer) {
  if (offer.status === 'pending') return offer.seller_id;
  if (offer.status === 'countered') return offer.buyer_id;
  return null; // terminal
}

// POST /offers - buyer makes an offer on a listing
router.post(
  '/',
  authenticate,
  [
    body('listing_id').notEmpty().withMessage('Listing is required'),
    body('price').isFloat({ min: 0 }).withMessage('Offer price is required'),
    body('quantity').optional().isInt({ min: 1 }),
    body('message').optional().trim(),
  ],
  validate,
  async (req, res) => {
    try {
      const { listing_id, price, quantity, message } = req.body;

      const listingRes = await db.query(
        'SELECT id, user_id, title, type, is_active FROM listings WHERE id = $1',
        [listing_id]
      );
      if (listingRes.rows.length === 0) {
        return res.status(404).json({ error: 'Listing not found' });
      }
      const listing = listingRes.rows[0];
      if (!listing.is_active) {
        return res.status(400).json({ error: 'This listing is no longer active' });
      }
      if (listing.user_id === req.user.id) {
        return res.status(400).json({ error: 'You cannot make an offer on your own listing' });
      }

      const result = await db.query(
        `INSERT INTO offers (listing_id, buyer_id, seller_id, price, quantity, message, status)
         VALUES ($1, $2, $3, $4, $5, $6, 'pending')
         RETURNING *`,
        [listing_id, req.user.id, listing.user_id, price, quantity || 1, message || '']
      );

      sendPushNotification(
        listing.user_id,
        'New Offer',
        `${req.user.business_name} offered $${parseFloat(price)} on "${listing.title}"`,
        { type: 'offer', offerId: result.rows[0].id }
      );

      res.status(201).json({ offer: result.rows[0] });
    } catch (err) {
      console.error('Create offer error:', err);
      res.status(500).json({ error: 'Server error' });
    }
  }
);

// GET /offers/mine - offers the user has sent or received
router.get('/mine', authenticate, async (req, res) => {
  try {
    const result = await db.query(
      `SELECT o.*,
              l.title as listing_title, l.type as listing_type,
              b.business_name as buyer_name,
              s.business_name as seller_name,
              CASE WHEN o.buyer_id = $1 THEN 'buyer' ELSE 'seller' END as my_role
       FROM offers o
       JOIN listings l ON o.listing_id = l.id
       JOIN users b ON o.buyer_id = b.id
       JOIN users s ON o.seller_id = s.id
       WHERE o.buyer_id = $1 OR o.seller_id = $1
       ORDER BY o.updated_at DESC`,
      [req.user.id]
    );
    res.json({ offers: result.rows });
  } catch (err) {
    console.error('Get offers error:', err);
    res.status(500).json({ error: 'Server error' });
  }
});

// POST /offers/:id/respond - accept, decline, or counter (only the awaiting party)
router.post(
  '/:id/respond',
  authenticate,
  [
    body('action').isIn(['accept', 'decline', 'counter']).withMessage('Invalid action'),
    body('price').optional().isFloat({ min: 0 }),
    body('message').optional().trim(),
  ],
  validate,
  async (req, res) => {
    try {
      const { action, price, message } = req.body;
      const offerRes = await db.query('SELECT * FROM offers WHERE id = $1', [req.params.id]);
      if (offerRes.rows.length === 0) return res.status(404).json({ error: 'Offer not found' });
      const offer = offerRes.rows[0];

      if (offer.buyer_id !== req.user.id && offer.seller_id !== req.user.id) {
        return res.status(403).json({ error: 'Not authorized' });
      }

      const awaiting = awaitingUserId(offer);
      if (!awaiting) {
        return res.status(400).json({ error: `This offer is already ${offer.status}` });
      }
      if (awaiting !== req.user.id) {
        return res.status(400).json({ error: 'It is not your turn to respond to this offer' });
      }

      const otherParty = req.user.id === offer.buyer_id ? offer.seller_id : offer.buyer_id;
      const listing = await db.query('SELECT title FROM listings WHERE id = $1', [offer.listing_id]);
      const title = listing.rows[0]?.title || 'a listing';

      let updated;
      if (action === 'accept') {
        updated = await db.query(
          "UPDATE offers SET status = 'accepted', updated_at = NOW() WHERE id = $1 RETURNING *",
          [req.params.id]
        );
        sendPushNotification(otherParty, 'Offer Accepted', `${req.user.business_name} accepted the offer on "${title}"`, { type: 'offer', offerId: offer.id });
      } else if (action === 'decline') {
        updated = await db.query(
          "UPDATE offers SET status = 'declined', updated_at = NOW() WHERE id = $1 RETURNING *",
          [req.params.id]
        );
        sendPushNotification(otherParty, 'Offer Declined', `${req.user.business_name} declined the offer on "${title}"`, { type: 'offer', offerId: offer.id });
      } else {
        // counter
        if (price == null) return res.status(400).json({ error: 'A counter price is required' });
        // pending (seller's turn) -> countered (buyer's turn); countered (buyer's turn) -> pending (seller's turn)
        const newStatus = offer.status === 'pending' ? 'countered' : 'pending';
        updated = await db.query(
          "UPDATE offers SET status = $1, price = $2, message = $3, updated_at = NOW() WHERE id = $4 RETURNING *",
          [newStatus, price, message || '', req.params.id]
        );
        sendPushNotification(otherParty, 'Counter Offer', `${req.user.business_name} countered at $${parseFloat(price)} on "${title}"`, { type: 'offer', offerId: offer.id });
      }

      res.json({ offer: updated.rows[0] });
    } catch (err) {
      console.error('Respond to offer error:', err);
      res.status(500).json({ error: 'Server error' });
    }
  }
);

// POST /offers/:id/withdraw - either party pulls out of a live negotiation
router.post('/:id/withdraw', authenticate, async (req, res) => {
  try {
    const offerRes = await db.query('SELECT * FROM offers WHERE id = $1', [req.params.id]);
    if (offerRes.rows.length === 0) return res.status(404).json({ error: 'Offer not found' });
    const offer = offerRes.rows[0];

    if (offer.buyer_id !== req.user.id && offer.seller_id !== req.user.id) {
      return res.status(403).json({ error: 'Not authorized' });
    }
    if (!['pending', 'countered'].includes(offer.status)) {
      return res.status(400).json({ error: `Cannot withdraw a ${offer.status} offer` });
    }

    const updated = await db.query(
      "UPDATE offers SET status = 'withdrawn', updated_at = NOW() WHERE id = $1 RETURNING *",
      [req.params.id]
    );
    const otherParty = req.user.id === offer.buyer_id ? offer.seller_id : offer.buyer_id;
    sendPushNotification(otherParty, 'Offer Withdrawn', `${req.user.business_name} withdrew their offer`, { type: 'offer', offerId: offer.id });

    res.json({ offer: updated.rows[0] });
  } catch (err) {
    console.error('Withdraw offer error:', err);
    res.status(500).json({ error: 'Server error' });
  }
});

module.exports = router;
