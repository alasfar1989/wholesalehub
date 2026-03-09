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

const app = express();

// Security middleware
app.use(helmet());
app.use(cors());
app.use(express.json({ limit: '10mb' }));
app.use(morgan('combined'));

// Rate limiting
const limiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 100,
  standardHeaders: true,
  legacyHeaders: false,
});
app.use('/auth', limiter);

// Health check
app.get('/health', (req, res) => {
  res.json({ status: 'ok', timestamp: new Date().toISOString() });
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
