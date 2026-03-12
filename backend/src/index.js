require('dotenv').config();
const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const morgan = require('morgan');
const rateLimit = require('express-rate-limit');

const authRoutes = require('./routes/auth');
const userRoutes = require('./routes/users');
const listingRoutes = require('./routes/listings');
const referenceRoutes = require('./routes/references');
const ratingRoutes = require('./routes/ratings');
const messageRoutes = require('./routes/messages');
const adminRoutes = require('./routes/admin');
const escrowRoutes = require('./routes/escrow');
const dealRoutes = require('./routes/deals');

const app = express();

// Security middleware
app.use(helmet());
app.use(cors());
app.use(express.json({ limit: '10mb' }));
app.use(morgan('combined'));

// Rate limiting
const generalLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 200,
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: 'Too many requests, please try again later' },
});
app.use(generalLimiter);

const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 20,
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: 'Too many login attempts, please try again later' },
});
app.use('/auth/login', authLimiter);
app.use('/auth/signup', authLimiter);

const otpLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 5,
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: 'Too many OTP requests, please try again later' },
});
app.use('/auth/send-otp', otpLimiter);
app.use('/auth/verify-otp', otpLimiter);

const path = require('path');

// Privacy Policy & Terms
app.get('/privacy', (req, res) => {
  res.sendFile(path.join(__dirname, 'pages', 'privacy.html'));
});

// Health check
app.get('/health', (req, res) => {
  res.json({
    status: 'ok',
    timestamp: new Date().toISOString(),
    twilio: !!process.env.TWILIO_ACCOUNT_SID,
    cloudinary: !!process.env.CLOUDINARY_URL,
  });
});

// Routes
app.use('/auth', authRoutes);
app.use('/users', userRoutes);
app.use('/listings', listingRoutes);
app.use('/references', referenceRoutes);
app.use('/ratings', ratingRoutes);
app.use('/messages', messageRoutes);
app.use('/admin', adminRoutes);
app.use('/escrow', escrowRoutes);
app.use('/deals', dealRoutes);

// 404 handler
app.use((req, res) => {
  res.status(404).json({ error: 'Not found' });
});

// Error handler
app.use((err, req, res, next) => {
  console.error('Unhandled error:', err);
  res.status(500).json({ error: 'Internal server error' });
});

// Run schema updates on startup
const db = require('./config/database');
async function applySchemaUpdates() {
  try {
    await db.query('ALTER TABLE ratings ADD COLUMN IF NOT EXISTS status VARCHAR(20) DEFAULT \'approved\'');
    await db.query('ALTER TABLE ratings ADD COLUMN IF NOT EXISTS escrow_id UUID');
    await db.query("ALTER TABLE escrows ADD COLUMN IF NOT EXISTS payment_method VARCHAR(20) DEFAULT 'wire'");
    await db.query('ALTER TABLE escrows ADD COLUMN IF NOT EXISTS wire_fee DECIMAL(12,2) DEFAULT 0');
    await db.query('ALTER TABLE escrows ADD COLUMN IF NOT EXISTS buyer_total DECIMAL(12,2)');
    await db.query("ALTER TABLE escrows ADD COLUMN IF NOT EXISTS seller_payout_method VARCHAR(20) DEFAULT 'wire'");
    await db.query('ALTER TABLE users ADD COLUMN IF NOT EXISTS push_token TEXT');
    await db.query('ALTER TABLE users ADD COLUMN IF NOT EXISTS phone_verified BOOLEAN DEFAULT FALSE');
    await db.query('ALTER TABLE users ADD COLUMN IF NOT EXISTS email VARCHAR(255)');
    await db.query('ALTER TABLE users ADD COLUMN IF NOT EXISTS avatar_url TEXT');
    await db.query('ALTER TABLE users ADD COLUMN IF NOT EXISTS is_approved BOOLEAN DEFAULT FALSE');
    await db.query('ALTER TABLE users ADD COLUMN IF NOT EXISTS referred_by UUID REFERENCES users(id)');
    await db.query('ALTER TABLE users ADD COLUMN IF NOT EXISTS referral_phone TEXT');
    // Auto-approve existing users who don't have referral (pre-referral system)
    await db.query('UPDATE users SET is_approved = TRUE WHERE referral_phone IS NULL AND is_approved = FALSE');
    await db.query(`CREATE TABLE IF NOT EXISTS deals (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      listing_id UUID REFERENCES listings(id) ON DELETE SET NULL,
      seller_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      buyer_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
    )`);
    console.log('Schema updates applied.');
  } catch (err) {
    console.error('Schema update error (non-fatal):', err.message);
  }
}

const PORT = process.env.PORT || 3000;
app.listen(PORT, '0.0.0.0', async () => {
  console.log(`WholesaleHub API running on port ${PORT}`);
  await applySchemaUpdates();
});
