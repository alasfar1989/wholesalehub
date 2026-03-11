const express = require('express');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const { body } = require('express-validator');
const db = require('../config/database');
const validate = require('../middleware/validate');

const router = express.Router();

// Strip all non-digit characters for phone comparison
function normalizePhone(phone) {
  return (phone || '').replace(/\D/g, '');
}

// Format phone to E.164 for Twilio (assumes US if 10 digits)
function formatPhoneE164(phone) {
  const digits = (phone || '').replace(/\D/g, '');
  if (digits.length === 10) return `+1${digits}`;
  if (digits.length === 11 && digits.startsWith('1')) return `+${digits}`;
  if (phone.startsWith('+')) return phone;
  return `+${digits}`;
}

function isAdminPhone(phone) {
  return normalizePhone(phone) === normalizePhone(process.env.ADMIN_PHONE);
}

function generateToken(userId) {
  return jwt.sign({ userId }, process.env.JWT_SECRET, {
    expiresIn: process.env.JWT_EXPIRES_IN || '30d',
  });
}

// POST /auth/signup
router.post(
  '/signup',
  [
    body('phone').trim().notEmpty().withMessage('Phone is required'),
    body('password').isLength({ min: 6 }).withMessage('Password must be at least 6 characters'),
    body('business_name').trim().notEmpty().withMessage('Business name is required'),
    body('city').trim().notEmpty().withMessage('City is required'),
    body('category').trim().optional(),
    body('referral_phone').trim().notEmpty().withMessage('Referral phone is required'),
  ],
  validate,
  async (req, res) => {
    try {
      const { phone, password, business_name, city, category, referral_phone } = req.body;

      const existing = await db.query('SELECT id FROM users WHERE phone = $1', [phone]);
      if (existing.rows.length > 0) {
        return res.status(409).json({ error: 'Phone number already registered' });
      }

      // Validate referral phone belongs to an existing user (match by last 10 digits)
      const referralDigits = normalizePhone(referral_phone).slice(-10);
      const referrer = await db.query(
        "SELECT id, business_name FROM users WHERE RIGHT(REGEXP_REPLACE(phone, '\\D', '', 'g'), 10) = $1",
        [referralDigits]
      );
      if (referrer.rows.length === 0) {
        return res.status(400).json({ error: 'Referral phone number is not registered. Please enter a valid referral.' });
      }

      const password_hash = await bcrypt.hash(password, 12);
      const isAdmin = isAdminPhone(phone);
      const isApproved = isAdmin; // Admin auto-approved

      const result = await db.query(
        `INSERT INTO users (phone, password_hash, business_name, city, category, is_admin, is_approved, referred_by, referral_phone)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
         RETURNING id, phone, business_name, city, category, is_admin, is_approved, referral_phone, created_at`,
        [phone, password_hash, business_name, city, category || 'electronics', isAdmin, isApproved, referrer.rows[0].id, referral_phone]
      );

      const user = result.rows[0];
      user.referrer_name = referrer.rows[0].business_name;
      const token = generateToken(user.id);

      res.status(201).json({ token, user });
    } catch (err) {
      console.error('Signup error:', err);
      res.status(500).json({ error: 'Server error' });
    }
  }
);

// POST /auth/login
router.post(
  '/login',
  [
    body('phone').trim().notEmpty().withMessage('Phone is required'),
    body('password').notEmpty().withMessage('Password is required'),
  ],
  validate,
  async (req, res) => {
    try {
      const { phone, password } = req.body;

      const result = await db.query(
        'SELECT id, phone, email, avatar_url, password_hash, business_name, city, category, bio, rating_score, rating_count, is_suspended, is_admin, is_approved, referral_phone, created_at FROM users WHERE phone = $1',
        [phone]
      );

      if (result.rows.length === 0) {
        return res.status(401).json({ error: 'Invalid credentials' });
      }

      const user = result.rows[0];

      if (user.is_suspended) {
        return res.status(403).json({ error: 'Account suspended' });
      }

      const validPassword = await bcrypt.compare(password, user.password_hash);
      if (!validPassword) {
        return res.status(401).json({ error: 'Invalid credentials' });
      }

      // Sync admin status on login
      const shouldBeAdmin = isAdminPhone(phone);
      if (shouldBeAdmin !== user.is_admin) {
        await db.query('UPDATE users SET is_admin = $1 WHERE id = $2', [shouldBeAdmin, user.id]);
        user.is_admin = shouldBeAdmin;
      }

      const { password_hash, ...userWithoutPassword } = user;
      const token = generateToken(user.id);

      res.json({ token, user: userWithoutPassword });
    } catch (err) {
      console.error('Login error:', err);
      res.status(500).json({ error: 'Server error' });
    }
  }
);

// POST /auth/send-otp - send OTP to phone number
router.post(
  '/send-otp',
  [body('phone').trim().notEmpty().withMessage('Phone is required')],
  validate,
  async (req, res) => {
    try {
      const phone = formatPhoneE164(req.body.phone);

      // Only send if Twilio is configured
      if (!process.env.TWILIO_ACCOUNT_SID || !process.env.TWILIO_AUTH_TOKEN || !process.env.TWILIO_VERIFY_SERVICE_SID) {
        // Skip OTP in dev mode
        return res.json({ success: true, message: 'OTP sent (dev mode - use any code)' });
      }

      const twilio = require('twilio')(process.env.TWILIO_ACCOUNT_SID, process.env.TWILIO_AUTH_TOKEN);
      await twilio.verify.v2
        .services(process.env.TWILIO_VERIFY_SERVICE_SID)
        .verifications.create({ to: phone, channel: 'sms' });

      res.json({ success: true, message: 'OTP sent' });
    } catch (err) {
      console.error('Send OTP error:', err);
      if (err.code === 60200) {
        return res.status(400).json({ error: 'Invalid phone number format. Use +1234567890' });
      }
      res.status(500).json({ error: `Failed to send OTP: ${err.message || err.code || 'Unknown error'}` });
    }
  }
);

// POST /auth/verify-otp - verify OTP code
router.post(
  '/verify-otp',
  [
    body('phone').trim().notEmpty().withMessage('Phone is required'),
    body('code').trim().notEmpty().withMessage('Code is required'),
  ],
  validate,
  async (req, res) => {
    try {
      const phone = formatPhoneE164(req.body.phone);
      const { code } = req.body;

      // Skip verification in dev mode
      if (!process.env.TWILIO_ACCOUNT_SID || !process.env.TWILIO_AUTH_TOKEN || !process.env.TWILIO_VERIFY_SERVICE_SID) {
        return res.json({ success: true, verified: true });
      }

      const twilio = require('twilio')(process.env.TWILIO_ACCOUNT_SID, process.env.TWILIO_AUTH_TOKEN);
      const verification = await twilio.verify.v2
        .services(process.env.TWILIO_VERIFY_SERVICE_SID)
        .verificationChecks.create({ to: phone, code });

      if (verification.status === 'approved') {
        res.json({ success: true, verified: true });
      } else {
        res.status(400).json({ error: 'Invalid or expired code' });
      }
    } catch (err) {
      console.error('Verify OTP error:', err);
      res.status(500).json({ error: 'Verification failed' });
    }
  }
);

module.exports = router;
