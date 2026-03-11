const express = require('express');
const { body } = require('express-validator');
const db = require('../config/database');
const { authenticate, requireAdmin } = require('../middleware/auth');
const validate = require('../middleware/validate');

const router = express.Router();

// All admin routes require authentication + admin role
router.use(authenticate, requireAdmin);

// GET /admin/dashboard - dashboard stats
router.get('/dashboard', async (req, res) => {
  try {
    const [users, listings, featured, ratings, pendingRatings, escrows] = await Promise.all([
      db.query('SELECT COUNT(*) as total, COUNT(*) FILTER (WHERE is_suspended) as suspended, COUNT(*) FILTER (WHERE is_approved = FALSE) as pending_approval FROM users'),
      db.query('SELECT COUNT(*) as total, COUNT(*) FILTER (WHERE is_active) as active, COUNT(*) FILTER (WHERE type = \'WTS\') as wts, COUNT(*) FILTER (WHERE type = \'WTB\') as wtb FROM listings'),
      db.query('SELECT COUNT(*) as total FROM listings WHERE is_featured = TRUE AND is_active = TRUE'),
      db.query("SELECT COUNT(*) as total, AVG(stars)::DECIMAL(3,2) as avg FROM ratings WHERE status = 'approved'"),
      db.query("SELECT COUNT(*) as pending FROM ratings WHERE status = 'pending'"),
      db.query(`SELECT
        COUNT(*) as total,
        COUNT(*) FILTER (WHERE status IN ('pending_seller','pending_payment','payment_received','shipped','delivered')) as active,
        COUNT(*) FILTER (WHERE status = 'completed') as completed,
        COUNT(*) FILTER (WHERE status = 'disputed') as disputed,
        COALESCE(SUM(escrow_fee) FILTER (WHERE status = 'completed'), 0)::DECIMAL(12,2) as fees_collected,
        COALESCE(SUM(amount) FILTER (WHERE status = 'completed'), 0)::DECIMAL(12,2) as total_volume,
        COUNT(*) FILTER (WHERE status = 'pending_payment' AND wire_proof_url IS NOT NULL) as pending_verification
       FROM escrows`),
    ]);

    res.json({
      dashboard: {
        users: users.rows[0],
        listings: listings.rows[0],
        featured: featured.rows[0],
        ratings: { ...ratings.rows[0], pending: pendingRatings.rows[0].pending },
        escrows: escrows.rows[0],
      },
    });
  } catch (err) {
    console.error('Dashboard error:', err);
    res.status(500).json({ error: 'Server error' });
  }
});

// GET /admin/pending-users - list users awaiting approval
router.get('/pending-users', async (req, res) => {
  try {
    const result = await db.query(
      `SELECT u.id, u.phone, u.business_name, u.city, u.category, u.referral_phone, u.created_at,
              r.business_name as referrer_name, r.phone as referrer_phone_actual
       FROM users u
       LEFT JOIN users r ON u.referred_by = r.id
       WHERE u.is_approved = FALSE AND u.is_suspended = FALSE
       ORDER BY u.created_at DESC`
    );
    res.json({ users: result.rows });
  } catch (err) {
    console.error('Pending users error:', err);
    res.status(500).json({ error: 'Server error' });
  }
});

// PUT /admin/users/:id/approve - approve a user
router.put('/users/:id/approve', async (req, res) => {
  try {
    const result = await db.query(
      'UPDATE users SET is_approved = TRUE, updated_at = NOW() WHERE id = $1 RETURNING id, business_name, is_approved',
      [req.params.id]
    );
    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'User not found' });
    }

    // Send push notification to the approved user
    try {
      const { sendPushNotification } = require('../utils/pushNotifications');
      await sendPushNotification(req.params.id, 'Account Approved!', 'Welcome to WholesaleHub! Your account has been approved.');
    } catch {}

    res.json({ user: result.rows[0] });
  } catch (err) {
    console.error('Approve user error:', err);
    res.status(500).json({ error: 'Server error' });
  }
});

// PUT /admin/users/:id/reject - reject (delete) a pending user
router.put('/users/:id/reject', async (req, res) => {
  try {
    const result = await db.query('DELETE FROM users WHERE id = $1 AND is_approved = FALSE RETURNING id', [req.params.id]);
    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'User not found or already approved' });
    }
    res.json({ message: 'User rejected and removed' });
  } catch (err) {
    console.error('Reject user error:', err);
    res.status(500).json({ error: 'Server error' });
  }
});

// GET /admin/users - list all users
router.get('/users', async (req, res) => {
  try {
    const result = await db.query(
      'SELECT id, phone, business_name, city, category, rating_score, rating_count, is_suspended, is_admin, is_approved, referral_phone, created_at FROM users ORDER BY created_at DESC'
    );
    res.json({ users: result.rows });
  } catch (err) {
    console.error('Admin users error:', err);
    res.status(500).json({ error: 'Server error' });
  }
});

// PUT /admin/users/:id/suspend - suspend/unsuspend user
router.put('/users/:id/suspend', async (req, res) => {
  try {
    const result = await db.query(
      'UPDATE users SET is_suspended = NOT is_suspended, updated_at = NOW() WHERE id = $1 RETURNING id, business_name, is_suspended',
      [req.params.id]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'User not found' });
    }

    res.json({ user: result.rows[0] });
  } catch (err) {
    console.error('Suspend user error:', err);
    res.status(500).json({ error: 'Server error' });
  }
});

// GET /admin/listings - all listings
router.get('/listings', async (req, res) => {
  try {
    const result = await db.query(
      `SELECT l.*, u.business_name, u.phone as user_phone
       FROM listings l
       JOIN users u ON l.user_id = u.id
       ORDER BY l.created_at DESC`
    );
    res.json({ listings: result.rows });
  } catch (err) {
    console.error('Admin listings error:', err);
    res.status(500).json({ error: 'Server error' });
  }
});

// PUT /admin/listings/:id/feature - toggle featured
router.put('/listings/:id/feature', async (req, res) => {
  try {
    const listing = await db.query('SELECT id, type, is_featured FROM listings WHERE id = $1', [req.params.id]);
    if (listing.rows.length === 0) {
      return res.status(404).json({ error: 'Listing not found' });
    }

    const willFeature = !listing.rows[0].is_featured;

    // Check featured limit (3 WTS + 3 WTB)
    if (willFeature) {
      const type = listing.rows[0].type;
      const count = await db.query(
        'SELECT COUNT(*) FROM listings WHERE is_featured = TRUE AND is_active = TRUE AND type = $1',
        [type]
      );
      if (parseInt(count.rows[0].count) >= 3) {
        return res.status(400).json({ error: `Maximum 3 featured ${type} listings reached` });
      }
    }

    const result = await db.query(
      'UPDATE listings SET is_featured = $1, updated_at = NOW() WHERE id = $2 RETURNING *',
      [willFeature, req.params.id]
    );

    // Manage featured_slots record
    if (willFeature) {
      await db.query(
        `INSERT INTO featured_slots (listing_id, start_date, end_date)
         VALUES ($1, CURRENT_DATE, CURRENT_DATE + INTERVAL '7 days')`,
        [req.params.id]
      );
    }

    res.json({ listing: result.rows[0] });
  } catch (err) {
    console.error('Feature listing error:', err);
    res.status(500).json({ error: 'Server error' });
  }
});

// DELETE /admin/listings/:id - delete any listing
router.delete('/listings/:id', async (req, res) => {
  try {
    const result = await db.query('DELETE FROM listings WHERE id = $1 RETURNING id', [req.params.id]);
    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Listing not found' });
    }
    res.json({ message: 'Listing deleted' });
  } catch (err) {
    console.error('Admin delete listing error:', err);
    res.status(500).json({ error: 'Server error' });
  }
});

module.exports = router;
