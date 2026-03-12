const express = require('express');
const { body } = require('express-validator');
const db = require('../config/database');
const { authenticate, requireAdmin } = require('../middleware/auth');
const validate = require('../middleware/validate');
const { sendPushNotification } = require('../utils/pushNotifications');

const router = express.Router();
const ESCROW_FEE_PERCENT = 0.005; // 0.5%
const WIRE_FEE = 25; // flat wire transfer fee

// Helper to log escrow events
async function logEvent(escrowId, action, userId, details) {
  await db.query(
    'INSERT INTO escrow_events (escrow_id, action, performed_by, details) VALUES ($1, $2, $3, $4)',
    [escrowId, action, userId, details || '']
  );
}

// POST /escrow/initiate - buyer initiates escrow
router.post(
  '/initiate',
  authenticate,
  [
    body('seller_id').notEmpty().withMessage('Seller is required'),
    body('amount').isFloat({ min: 1 }).withMessage('Amount must be at least $1'),
    body('product_description').trim().notEmpty().withMessage('Product description is required'),
    body('listing_id').optional(),
    body('payment_method').optional().isIn(['wire', 'usdt']).withMessage('Payment method must be wire or usdt'),
  ],
  validate,
  async (req, res) => {
    try {
      const { seller_id, amount, product_description, listing_id, payment_method } = req.body;

      if (seller_id === req.user.id) {
        return res.status(400).json({ error: 'Cannot create escrow with yourself' });
      }

      const seller = await db.query('SELECT id, business_name FROM users WHERE id = $1 AND is_suspended = FALSE', [seller_id]);
      if (seller.rows.length === 0) {
        return res.status(404).json({ error: 'Seller not found' });
      }

      const fee = (parseFloat(amount) * ESCROW_FEE_PERCENT).toFixed(2);
      const method = payment_method || 'wire';
      const wireFee = method === 'wire' ? WIRE_FEE.toFixed(2) : '0.00';
      const payout = parseFloat(amount).toFixed(2); // seller gets full invoice amount
      const buyerTotal = (parseFloat(amount) + parseFloat(fee) + parseFloat(wireFee)).toFixed(2);

      const result = await db.query(
        `INSERT INTO escrows (buyer_id, seller_id, listing_id, product_description, amount, escrow_fee, wire_fee, seller_payout, buyer_total, payment_method, status)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, 'pending_seller')
         RETURNING *`,
        [req.user.id, seller_id, listing_id || null, product_description, amount, fee, wireFee, payout, buyerTotal, method]
      );

      await logEvent(result.rows[0].id, 'initiated', req.user.id, `Escrow created for $${amount} via ${method.toUpperCase()}. Buyer total: $${buyerTotal}`);

      // Notify seller
      const buyer = await db.query('SELECT business_name FROM users WHERE id = $1', [req.user.id]);
      sendPushNotification(seller_id, 'New Escrow Request', `${buyer.rows[0]?.business_name} wants to escrow $${amount}`, { type: 'escrow', escrowId: result.rows[0].id });

      res.status(201).json({ escrow: result.rows[0] });
    } catch (err) {
      console.error('Escrow initiate error:', err);
      res.status(500).json({ error: 'Server error' });
    }
  }
);

// POST /escrow/:id/confirm - seller approves escrow
router.post('/:id/confirm', authenticate, async (req, res) => {
  try {
    const escrow = await db.query('SELECT * FROM escrows WHERE id = $1', [req.params.id]);
    if (escrow.rows.length === 0) return res.status(404).json({ error: 'Escrow not found' });

    const e = escrow.rows[0];
    if (e.seller_id !== req.user.id) return res.status(403).json({ error: 'Only the seller can confirm' });
    if (e.status !== 'pending_seller') return res.status(400).json({ error: `Cannot confirm from status: ${e.status}` });

    const sellerPayoutMethod = req.body.seller_payout_method || 'wire';
    const result = await db.query(
      `UPDATE escrows SET status = 'pending_payment', seller_confirmed = TRUE, seller_payout_method = $1, updated_at = NOW()
       WHERE id = $2 RETURNING *`,
      [sellerPayoutMethod, req.params.id]
    );

    await logEvent(req.params.id, 'seller_confirmed', req.user.id, `Seller approved the escrow. Payout via ${sellerPayoutMethod.toUpperCase()}`);
    sendPushNotification(e.buyer_id, 'Escrow Approved', 'The seller approved your escrow. Please send payment.', { type: 'escrow', escrowId: req.params.id });
    res.json({ escrow: result.rows[0] });
  } catch (err) {
    console.error('Escrow confirm error:', err);
    res.status(500).json({ error: 'Server error' });
  }
});

// POST /escrow/:id/upload-proof - buyer uploads wire proof
router.post(
  '/:id/upload-proof',
  authenticate,
  [body('wire_proof_url').trim().notEmpty().withMessage('Wire proof is required')],
  validate,
  async (req, res) => {
    try {
      const escrow = await db.query('SELECT * FROM escrows WHERE id = $1', [req.params.id]);
      if (escrow.rows.length === 0) return res.status(404).json({ error: 'Escrow not found' });

      const e = escrow.rows[0];
      if (e.buyer_id !== req.user.id) return res.status(403).json({ error: 'Only the buyer can upload proof' });
      if (e.status !== 'pending_payment') return res.status(400).json({ error: `Cannot upload proof in status: ${e.status}` });

      const result = await db.query(
        `UPDATE escrows SET wire_proof_url = $1, updated_at = NOW() WHERE id = $2 RETURNING *`,
        [req.body.wire_proof_url, req.params.id]
      );

      await logEvent(req.params.id, 'proof_uploaded', req.user.id, 'Buyer uploaded wire proof');
      // Notify admin(s) about uploaded proof
      const admins = await db.query('SELECT id FROM users WHERE is_admin = TRUE');
      for (const admin of admins.rows) {
        sendPushNotification(admin.id, 'Wire Proof Uploaded', `Buyer uploaded payment proof for escrow $${e.amount}`, { type: 'escrow', escrowId: req.params.id });
      }
      res.json({ escrow: result.rows[0] });
    } catch (err) {
      console.error('Upload proof error:', err);
      res.status(500).json({ error: 'Server error' });
    }
  }
);

// POST /escrow/:id/payment-received - admin verifies payment
router.post('/:id/payment-received', authenticate, requireAdmin, async (req, res) => {
  try {
    const escrow = await db.query('SELECT * FROM escrows WHERE id = $1', [req.params.id]);
    if (escrow.rows.length === 0) return res.status(404).json({ error: 'Escrow not found' });

    const e = escrow.rows[0];
    if (e.status !== 'pending_payment') return res.status(400).json({ error: `Cannot verify from status: ${e.status}` });

    const wireInstructions = req.body.wire_instructions || '';
    const result = await db.query(
      `UPDATE escrows SET status = 'payment_received', wire_instructions = $1, updated_at = NOW()
       WHERE id = $2 RETURNING *`,
      [wireInstructions, req.params.id]
    );

    await logEvent(req.params.id, 'payment_verified', req.user.id, 'Admin verified payment received');
    sendPushNotification(e.buyer_id, 'Payment Verified', 'Your payment has been verified. Waiting for seller to ship.', { type: 'escrow', escrowId: req.params.id });
    sendPushNotification(e.seller_id, 'Payment Received', 'Payment verified by admin. Please ship the product.', { type: 'escrow', escrowId: req.params.id });
    res.json({ escrow: result.rows[0] });
  } catch (err) {
    console.error('Payment received error:', err);
    res.status(500).json({ error: 'Server error' });
  }
});

// POST /escrow/:id/ship - seller uploads tracking
router.post(
  '/:id/ship',
  authenticate,
  [body('tracking_number').trim().notEmpty().withMessage('Tracking number is required')],
  validate,
  async (req, res) => {
    try {
      const escrow = await db.query('SELECT * FROM escrows WHERE id = $1', [req.params.id]);
      if (escrow.rows.length === 0) return res.status(404).json({ error: 'Escrow not found' });

      const e = escrow.rows[0];
      if (e.seller_id !== req.user.id) return res.status(403).json({ error: 'Only the seller can ship' });
      if (e.status !== 'payment_received') return res.status(400).json({ error: `Cannot ship from status: ${e.status}` });

      const result = await db.query(
        `UPDATE escrows SET status = 'shipped', tracking_number = $1, updated_at = NOW()
         WHERE id = $2 RETURNING *`,
        [req.body.tracking_number, req.params.id]
      );

      await logEvent(req.params.id, 'shipped', req.user.id, `Tracking: ${req.body.tracking_number}`);
      sendPushNotification(e.buyer_id, 'Order Shipped', `Your order has been shipped. Tracking: ${req.body.tracking_number}`, { type: 'escrow', escrowId: req.params.id });
      res.json({ escrow: result.rows[0] });
    } catch (err) {
      console.error('Ship error:', err);
      res.status(500).json({ error: 'Server error' });
    }
  }
);

// POST /escrow/:id/confirm-receipt - buyer confirms delivery
router.post('/:id/confirm-receipt', authenticate, async (req, res) => {
  try {
    const escrow = await db.query('SELECT * FROM escrows WHERE id = $1', [req.params.id]);
    if (escrow.rows.length === 0) return res.status(404).json({ error: 'Escrow not found' });

    const e = escrow.rows[0];
    if (e.buyer_id !== req.user.id) return res.status(403).json({ error: 'Only the buyer can confirm receipt' });
    if (e.status !== 'shipped') return res.status(400).json({ error: `Cannot confirm receipt from status: ${e.status}` });

    const result = await db.query(
      `UPDATE escrows SET status = 'delivered', buyer_confirmed = TRUE, updated_at = NOW()
       WHERE id = $1 RETURNING *`,
      [req.params.id]
    );

    await logEvent(req.params.id, 'delivered', req.user.id, 'Buyer confirmed receipt');
    sendPushNotification(e.seller_id, 'Delivery Confirmed', 'The buyer confirmed receipt. Awaiting admin to release payment.', { type: 'escrow', escrowId: req.params.id });
    res.json({ escrow: result.rows[0] });
  } catch (err) {
    console.error('Confirm receipt error:', err);
    res.status(500).json({ error: 'Server error' });
  }
});

// POST /escrow/:id/release-payment - admin releases funds to seller
router.post('/:id/release-payment', authenticate, requireAdmin, async (req, res) => {
  try {
    const escrow = await db.query('SELECT * FROM escrows WHERE id = $1', [req.params.id]);
    if (escrow.rows.length === 0) return res.status(404).json({ error: 'Escrow not found' });

    const e = escrow.rows[0];
    if (e.status !== 'delivered') return res.status(400).json({ error: `Cannot release from status: ${e.status}. Buyer must confirm receipt first.` });

    const result = await db.query(
      `UPDATE escrows SET status = 'completed', updated_at = NOW()
       WHERE id = $1 RETURNING *`,
      [req.params.id]
    );

    await logEvent(req.params.id, 'payment_released', req.user.id,
      `Released $${e.seller_payout} to seller. Fee collected: $${e.escrow_fee}${e.wire_fee > 0 ? ` + $${e.wire_fee} wire fee` : ''}`);
    sendPushNotification(e.seller_id, 'Payment Released', `$${e.seller_payout} has been released to you.`, { type: 'escrow', escrowId: req.params.id });
    sendPushNotification(e.buyer_id, 'Escrow Completed', 'Your escrow transaction is complete.', { type: 'escrow', escrowId: req.params.id });
    res.json({ escrow: result.rows[0] });
  } catch (err) {
    console.error('Release payment error:', err);
    res.status(500).json({ error: 'Server error' });
  }
});

// POST /escrow/:id/dispute - either party can dispute
router.post('/:id/dispute', authenticate, async (req, res) => {
  try {
    const escrow = await db.query('SELECT * FROM escrows WHERE id = $1', [req.params.id]);
    if (escrow.rows.length === 0) return res.status(404).json({ error: 'Escrow not found' });

    const e = escrow.rows[0];
    if (e.buyer_id !== req.user.id && e.seller_id !== req.user.id) {
      return res.status(403).json({ error: 'Not authorized' });
    }
    if (['completed', 'cancelled', 'disputed'].includes(e.status)) {
      return res.status(400).json({ error: `Cannot dispute from status: ${e.status}` });
    }

    const reason = req.body.reason || '';
    const result = await db.query(
      `UPDATE escrows SET status = 'disputed', admin_notes = COALESCE(admin_notes, '') || $1, updated_at = NOW()
       WHERE id = $2 RETURNING *`,
      [`\nDISPUTE by ${req.user.business_name}: ${reason}`, req.params.id]
    );

    await logEvent(req.params.id, 'disputed', req.user.id, `Reason: ${reason}`);
    res.json({ escrow: result.rows[0] });
  } catch (err) {
    console.error('Dispute error:', err);
    res.status(500).json({ error: 'Server error' });
  }
});

// PUT /escrow/:id/wire-instructions - admin sets payment instructions
router.put('/:id/wire-instructions', authenticate, requireAdmin, async (req, res) => {
  try {
    const { wire_instructions } = req.body;
    const result = await db.query(
      'UPDATE escrows SET wire_instructions = $1, updated_at = NOW() WHERE id = $2 RETURNING *',
      [wire_instructions, req.params.id]
    );
    if (result.rows.length === 0) return res.status(404).json({ error: 'Escrow not found' });

    const e = result.rows[0];
    sendPushNotification(e.buyer_id, 'Payment Instructions Updated', 'The admin has updated the payment details for your escrow.', { type: 'escrow', escrowId: req.params.id });

    res.json({ escrow: result.rows[0] });
  } catch (err) {
    console.error('Update wire instructions error:', err);
    res.status(500).json({ error: 'Server error' });
  }
});

// POST /escrow/:id/resolve-dispute - admin resolves dispute
router.post('/:id/resolve-dispute', authenticate, requireAdmin, async (req, res) => {
  try {
    const escrow = await db.query('SELECT * FROM escrows WHERE id = $1', [req.params.id]);
    if (escrow.rows.length === 0) return res.status(404).json({ error: 'Escrow not found' });

    const e = escrow.rows[0];
    if (e.status !== 'disputed') return res.status(400).json({ error: 'Escrow is not disputed' });

    const { resolution } = req.body; // 'release' or 'refund'

    if (resolution === 'release') {
      const result = await db.query(
        `UPDATE escrows SET status = 'completed', admin_notes = COALESCE(admin_notes, '') || $1, updated_at = NOW()
         WHERE id = $2 RETURNING *`,
        [`\nADMIN RESOLVED: Payment released to seller by ${req.user.business_name}`, req.params.id]
      );
      await logEvent(req.params.id, 'dispute_resolved_release', req.user.id, 'Admin released payment to seller');
      sendPushNotification(e.seller_id, 'Dispute Resolved', `Payment of $${e.seller_payout} released to you.`, { type: 'escrow', escrowId: req.params.id });
      sendPushNotification(e.buyer_id, 'Dispute Resolved', 'Admin resolved the dispute. Payment released to seller.', { type: 'escrow', escrowId: req.params.id });
      res.json({ escrow: result.rows[0] });
    } else if (resolution === 'refund') {
      const result = await db.query(
        `UPDATE escrows SET status = 'cancelled', admin_notes = COALESCE(admin_notes, '') || $1, updated_at = NOW()
         WHERE id = $2 RETURNING *`,
        [`\nADMIN RESOLVED: Refund to buyer by ${req.user.business_name}`, req.params.id]
      );
      await logEvent(req.params.id, 'dispute_resolved_refund', req.user.id, 'Admin refunded buyer');
      sendPushNotification(e.buyer_id, 'Dispute Resolved', `Your $${e.amount} will be refunded.`, { type: 'escrow', escrowId: req.params.id });
      sendPushNotification(e.seller_id, 'Dispute Resolved', 'Admin resolved the dispute. Buyer refunded.', { type: 'escrow', escrowId: req.params.id });
      res.json({ escrow: result.rows[0] });
    } else {
      res.status(400).json({ error: 'Resolution must be "release" or "refund"' });
    }
  } catch (err) {
    console.error('Resolve dispute error:', err);
    res.status(500).json({ error: 'Server error' });
  }
});

// POST /escrow/:id/cancel - buyer or seller can cancel if pending
router.post('/:id/cancel', authenticate, async (req, res) => {
  try {
    const escrow = await db.query('SELECT * FROM escrows WHERE id = $1', [req.params.id]);
    if (escrow.rows.length === 0) return res.status(404).json({ error: 'Escrow not found' });

    const e = escrow.rows[0];
    if (e.buyer_id !== req.user.id && e.seller_id !== req.user.id && !req.user.is_admin) {
      return res.status(403).json({ error: 'Not authorized' });
    }
    if (!['pending_seller', 'pending_payment'].includes(e.status)) {
      return res.status(400).json({ error: 'Can only cancel before payment is verified' });
    }

    const result = await db.query(
      `UPDATE escrows SET status = 'cancelled', updated_at = NOW() WHERE id = $1 RETURNING *`,
      [req.params.id]
    );

    await logEvent(req.params.id, 'cancelled', req.user.id, 'Escrow cancelled');
    res.json({ escrow: result.rows[0] });
  } catch (err) {
    console.error('Cancel error:', err);
    res.status(500).json({ error: 'Server error' });
  }
});

// GET /escrow/my/all - get user's escrows (MUST be before /:id)
router.get('/my/all', authenticate, async (req, res) => {
  try {
    const result = await db.query(
      `SELECT e.*,
        b.business_name as buyer_name,
        s.business_name as seller_name
       FROM escrows e
       JOIN users b ON e.buyer_id = b.id
       JOIN users s ON e.seller_id = s.id
       WHERE e.buyer_id = $1 OR e.seller_id = $1
       ORDER BY e.updated_at DESC`,
      [req.user.id]
    );

    res.json({ escrows: result.rows });
  } catch (err) {
    console.error('My escrows error:', err);
    res.status(500).json({ error: 'Server error' });
  }
});

// GET /escrow/admin/all - admin: all escrows (MUST be before /:id)
router.get('/admin/all', authenticate, requireAdmin, async (req, res) => {
  try {
    const statusFilter = req.query.status;
    let query = `
      SELECT e.*,
        b.business_name as buyer_name, b.phone as buyer_phone,
        s.business_name as seller_name, s.phone as seller_phone
      FROM escrows e
      JOIN users b ON e.buyer_id = b.id
      JOIN users s ON e.seller_id = s.id`;
    const values = [];

    if (statusFilter) {
      query += ' WHERE e.status = $1';
      values.push(statusFilter);
    }

    query += ' ORDER BY e.updated_at DESC';
    const result = await db.query(query, values);

    // Revenue summary
    const revenue = await db.query(
      `SELECT
        COUNT(*) FILTER (WHERE status = 'completed') as completed_count,
        COALESCE(SUM(escrow_fee) FILTER (WHERE status = 'completed'), 0) as total_fees,
        COALESCE(SUM(COALESCE(wire_fee, 0)) FILTER (WHERE status = 'completed'), 0) as total_wire_fees,
        COALESCE(SUM(amount) FILTER (WHERE status = 'completed'), 0) as total_volume,
        COUNT(*) FILTER (WHERE status IN ('pending_seller','pending_payment','payment_received','shipped','delivered')) as active_count,
        COUNT(*) FILTER (WHERE status = 'disputed') as disputed_count
       FROM escrows`
    );

    res.json({ escrows: result.rows, revenue: revenue.rows[0] });
  } catch (err) {
    console.error('Admin escrows error:', err);
    res.status(500).json({ error: 'Server error' });
  }
});

// GET /escrow/:id - get escrow details (MUST be after /my/all and /admin/all)
router.get('/:id', authenticate, async (req, res) => {
  try {
    const result = await db.query(
      `SELECT e.*,
        b.business_name as buyer_name, b.phone as buyer_phone,
        s.business_name as seller_name, s.phone as seller_phone
       FROM escrows e
       JOIN users b ON e.buyer_id = b.id
       JOIN users s ON e.seller_id = s.id
       WHERE e.id = $1`,
      [req.params.id]
    );

    if (result.rows.length === 0) return res.status(404).json({ error: 'Escrow not found' });

    const e = result.rows[0];
    if (e.buyer_id !== req.user.id && e.seller_id !== req.user.id && !req.user.is_admin) {
      return res.status(403).json({ error: 'Not authorized' });
    }

    const events = await db.query(
      `SELECT ee.*, u.business_name as performed_by_name
       FROM escrow_events ee
       LEFT JOIN users u ON ee.performed_by = u.id
       WHERE ee.escrow_id = $1 ORDER BY ee.created_at ASC`,
      [req.params.id]
    );

    res.json({ escrow: e, events: events.rows });
  } catch (err) {
    console.error('Get escrow error:', err);
    res.status(500).json({ error: 'Server error' });
  }
});

module.exports = router;
