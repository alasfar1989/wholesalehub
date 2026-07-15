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
const offerRoutes = require('./routes/offers');
const savedSearchRoutes = require('./routes/savedSearches');

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
app.get('/terms', (req, res) => {
  res.sendFile(path.join(__dirname, 'pages', 'terms.html'));
});

// Shareable public listing page (rich preview for WhatsApp/social; deep-links into the app)
app.get('/listing/:id', async (req, res) => {
  const db = require('./config/database');
  const { renderListingPage, renderNotFound } = require('./utils/listingPage');
  try {
    const result = await db.query(
      `SELECT l.id, l.title, l.price, l.condition, l.quantity, l.city, l.description, l.type, l.is_active,
              u.business_name,
              (SELECT photo_url FROM listing_photos WHERE listing_id = l.id ORDER BY sort_order LIMIT 1) AS photo
       FROM listings l JOIN users u ON l.user_id = u.id
       WHERE l.id = $1`,
      [req.params.id]
    );
    if (result.rows.length === 0) {
      return res.status(404).type('html').send(renderNotFound());
    }
    const proto = req.get('x-forwarded-proto') || req.protocol;
    const baseUrl = `${proto}://${req.get('host')}`;
    res.type('html').send(renderListingPage(result.rows[0], baseUrl));
  } catch (err) {
    console.error('Listing page error:', err);
    res.status(500).type('html').send(renderNotFound());
  }
});

// Universal Links (iOS) — lets installed apps open https://<domain>/listing/* directly
app.get('/.well-known/apple-app-site-association', (req, res) => {
  res.type('application/json').json({
    applinks: {
      apps: [],
      details: [
        {
          appID: '6ZGA3Q69H8.com.wholesalehub.app',
          paths: ['/listing/*'],
        },
      ],
    },
  });
});

// App Links (Android) — requires the signing cert SHA-256 set in env (from `eas credentials`
// or Play Console → App integrity). 404 until configured so Android won't half-verify.
app.get('/.well-known/assetlinks.json', (req, res) => {
  const fp = process.env.ANDROID_SHA256_CERT_FINGERPRINT;
  if (!fp) return res.status(404).json({ error: 'assetlinks not configured' });
  res.type('application/json').json([
    {
      relation: ['delegate_permission/common.handle_all_urls'],
      target: {
        namespace: 'android_app',
        package_name: 'com.wholesalehubapp.app',
        sha256_cert_fingerprints: fp.split(',').map((s) => s.trim()),
      },
    },
  ]);
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
app.use('/offers', offerRoutes);
app.use('/saved-searches', savedSearchRoutes);

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
    await db.query("ALTER TABLE escrows ADD COLUMN IF NOT EXISTS fee_payer VARCHAR(10) DEFAULT 'buyer'");
    await db.query('ALTER TABLE escrows ADD COLUMN IF NOT EXISTS seller_deposit DECIMAL(12,2) DEFAULT 0');
    await db.query('ALTER TABLE escrows ADD COLUMN IF NOT EXISTS deposit_forfeited BOOLEAN DEFAULT FALSE');
    await db.query('ALTER TABLE escrows ADD COLUMN IF NOT EXISTS deposit_paid BOOLEAN DEFAULT FALSE');
    await db.query('ALTER TABLE escrows ADD COLUMN IF NOT EXISTS buyer_tracking_number TEXT');
    await db.query('ALTER TABLE users ADD COLUMN IF NOT EXISTS strikes INTEGER DEFAULT 0');
    await db.query('ALTER TABLE escrows ADD COLUMN IF NOT EXISTS shipping_photo_url TEXT');
    await db.query('ALTER TABLE escrows ADD COLUMN IF NOT EXISTS delivery_photo_url TEXT');
    await db.query('ALTER TABLE escrows ADD COLUMN IF NOT EXISTS contents_photo_url TEXT');
    await db.query('ALTER TABLE users ADD COLUMN IF NOT EXISTS push_token TEXT');
    await db.query('ALTER TABLE users ADD COLUMN IF NOT EXISTS phone_verified BOOLEAN DEFAULT FALSE');
    await db.query('ALTER TABLE users ADD COLUMN IF NOT EXISTS email VARCHAR(255)');
    await db.query('ALTER TABLE users ADD COLUMN IF NOT EXISTS avatar_url TEXT');
    await db.query('ALTER TABLE users ADD COLUMN IF NOT EXISTS is_approved BOOLEAN DEFAULT FALSE');
    await db.query('ALTER TABLE users ADD COLUMN IF NOT EXISTS referred_by UUID REFERENCES users(id)');
    await db.query('ALTER TABLE users ADD COLUMN IF NOT EXISTS referral_phone TEXT');
    await db.query('ALTER TABLE users ADD COLUMN IF NOT EXISTS badge VARCHAR(30)');
    await db.query('ALTER TABLE users ADD COLUMN IF NOT EXISTS last_active_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()');
    // Set CP Wireless as founder with 5-star rating
    await db.query("UPDATE users SET badge = 'founder', rating_score = 5.0, rating_count = GREATEST(rating_count, 1) WHERE business_name ILIKE '%CP Wireless%' AND badge IS NULL");
    // Auto-approve existing users who don't have referral (pre-referral system)
    await db.query('UPDATE users SET is_approved = TRUE WHERE referral_phone IS NULL AND is_approved = FALSE');
    await db.query(`CREATE TABLE IF NOT EXISTS deals (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      listing_id UUID REFERENCES listings(id) ON DELETE SET NULL,
      seller_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      buyer_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
    )`);
    await db.query(`CREATE TABLE IF NOT EXISTS reports (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      reporter_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      reported_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      reason TEXT NOT NULL,
      created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
    )`);
    await db.query(`CREATE TABLE IF NOT EXISTS blocks (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      blocker_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      blocked_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
      UNIQUE(blocker_id, blocked_id)
    )`);
    await db.query(`CREATE TABLE IF NOT EXISTS favorites (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      listing_id UUID NOT NULL REFERENCES listings(id) ON DELETE CASCADE,
      created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
      UNIQUE(user_id, listing_id)
    )`);
    await db.query('ALTER TABLE listings ADD COLUMN IF NOT EXISTS expires_at TIMESTAMP WITH TIME ZONE');
    await db.query('ALTER TABLE listings ADD COLUMN IF NOT EXISTS quantity_sold INTEGER NOT NULL DEFAULT 0');
    await db.query('ALTER TABLE listings ADD COLUMN IF NOT EXISTS view_count INTEGER NOT NULL DEFAULT 0');
    // Make-an-offer negotiations
    await db.query(`CREATE TABLE IF NOT EXISTS offers (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      listing_id UUID NOT NULL REFERENCES listings(id) ON DELETE CASCADE,
      buyer_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      seller_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      price DECIMAL(12,2) NOT NULL,
      quantity INTEGER NOT NULL DEFAULT 1,
      message TEXT DEFAULT '',
      status VARCHAR(20) NOT NULL DEFAULT 'pending'
        CHECK (status IN ('pending', 'countered', 'accepted', 'declined', 'withdrawn')),
      created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
      updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
    )`);
    await db.query('CREATE INDEX IF NOT EXISTS idx_offers_listing ON offers(listing_id)');
    await db.query('CREATE INDEX IF NOT EXISTS idx_offers_buyer ON offers(buyer_id)');
    await db.query('CREATE INDEX IF NOT EXISTS idx_offers_seller ON offers(seller_id)');
    // Saved searches with new-listing alerts
    await db.query(`CREATE TABLE IF NOT EXISTS saved_searches (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      keyword TEXT,
      type VARCHAR(3),
      city TEXT,
      category TEXT,
      condition TEXT,
      min_price DECIMAL(12,2),
      max_price DECIMAL(12,2),
      created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
    )`);
    await db.query('CREATE INDEX IF NOT EXISTS idx_saved_searches_user ON saved_searches(user_id)');
    // Set expiration for existing listings that don't have one (90 days from creation)
    await db.query("UPDATE listings SET expires_at = created_at + INTERVAL '90 days' WHERE expires_at IS NULL");
    // Auto-deactivate expired listings
    await db.query("UPDATE listings SET is_active = FALSE WHERE expires_at < NOW() AND is_active = TRUE");
    // Create Apple review demo account if it doesn't exist
    const bcrypt = require('bcryptjs');
    const demoPhone = '5550001234';
    const demoExists = await db.query("SELECT id FROM users WHERE RIGHT(REGEXP_REPLACE(phone, '\\D', '', 'g'), 10) = $1", [demoPhone]);
    if (demoExists.rows.length === 0) {
      const demoHash = await bcrypt.hash('Demo2026!', 12);
      await db.query(
        `INSERT INTO users (phone, password_hash, business_name, email, city, category, is_admin, is_approved)
         VALUES ($1, $2, $3, $4, $5, $6, FALSE, TRUE)`,
        [demoPhone, demoHash, 'Demo Business', 'demo@wholesalehub.app', 'Miami', 'electronics']
      );
      console.log('Demo account created for App Store review.');
    }
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
