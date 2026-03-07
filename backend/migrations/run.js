require('dotenv').config();
const { pool } = require('../src/config/database');

const migration = `
-- Users table
CREATE TABLE IF NOT EXISTS users (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  phone VARCHAR(20) UNIQUE NOT NULL,
  password_hash VARCHAR(255) NOT NULL,
  business_name VARCHAR(255) NOT NULL,
  city VARCHAR(100) NOT NULL,
  category VARCHAR(100) NOT NULL DEFAULT 'electronics',
  bio TEXT DEFAULT '',
  rating_score DECIMAL(3,2) DEFAULT 0.00,
  rating_count INTEGER DEFAULT 0,
  is_suspended BOOLEAN DEFAULT FALSE,
  is_admin BOOLEAN DEFAULT FALSE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Listings table
CREATE TABLE IF NOT EXISTS listings (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  type VARCHAR(3) NOT NULL CHECK (type IN ('WTS', 'WTB')),
  title VARCHAR(255) NOT NULL,
  description TEXT DEFAULT '',
  price DECIMAL(12,2),
  quantity INTEGER DEFAULT 1,
  condition VARCHAR(50) DEFAULT 'new',
  category VARCHAR(100) NOT NULL DEFAULT 'electronics',
  city VARCHAR(100) NOT NULL,
  is_featured BOOLEAN DEFAULT FALSE,
  is_active BOOLEAN DEFAULT TRUE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- References table
CREATE TABLE IF NOT EXISTS references_table (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  reference_name VARCHAR(255) NOT NULL,
  reference_phone VARCHAR(20) NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Ratings table
CREATE TABLE IF NOT EXISTS ratings (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  from_user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  to_user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  escrow_id UUID REFERENCES escrows(id) ON DELETE SET NULL,
  stars INTEGER NOT NULL CHECK (stars >= 1 AND stars <= 5),
  comment TEXT DEFAULT '',
  status VARCHAR(20) NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'approved', 'rejected')),
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  UNIQUE(from_user_id, to_user_id)
);

-- Featured slots table
CREATE TABLE IF NOT EXISTS featured_slots (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  listing_id UUID NOT NULL REFERENCES listings(id) ON DELETE CASCADE,
  start_date DATE NOT NULL,
  end_date DATE NOT NULL,
  cost DECIMAL(10,2) DEFAULT 0.00,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Messages table (for in-app chat)
CREATE TABLE IF NOT EXISTS messages (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  from_user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  to_user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  content TEXT NOT NULL,
  is_read BOOLEAN DEFAULT FALSE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Escrows table
CREATE TABLE IF NOT EXISTS escrows (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  buyer_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  seller_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  listing_id UUID REFERENCES listings(id) ON DELETE SET NULL,
  product_description TEXT NOT NULL,
  amount DECIMAL(12,2) NOT NULL,
  escrow_fee DECIMAL(12,2) NOT NULL DEFAULT 0.00,
  seller_payout DECIMAL(12,2) NOT NULL DEFAULT 0.00,
  status VARCHAR(30) NOT NULL DEFAULT 'pending_seller'
    CHECK (status IN ('pending_seller', 'pending_payment', 'payment_received', 'shipped', 'delivered', 'completed', 'disputed', 'cancelled')),
  wire_proof_url TEXT,
  tracking_number VARCHAR(255),
  wire_instructions TEXT,
  admin_notes TEXT DEFAULT '',
  buyer_confirmed BOOLEAN DEFAULT FALSE,
  seller_confirmed BOOLEAN DEFAULT FALSE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Escrow history / audit log
CREATE TABLE IF NOT EXISTS escrow_events (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  escrow_id UUID NOT NULL REFERENCES escrows(id) ON DELETE CASCADE,
  action VARCHAR(50) NOT NULL,
  performed_by UUID REFERENCES users(id) ON DELETE SET NULL,
  details TEXT DEFAULT '',
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Indexes for performance
CREATE INDEX IF NOT EXISTS idx_listings_user_id ON listings(user_id);
CREATE INDEX IF NOT EXISTS idx_listings_type ON listings(type);
CREATE INDEX IF NOT EXISTS idx_listings_category ON listings(category);
CREATE INDEX IF NOT EXISTS idx_listings_city ON listings(city);
CREATE INDEX IF NOT EXISTS idx_listings_featured ON listings(is_featured) WHERE is_featured = TRUE;
CREATE INDEX IF NOT EXISTS idx_listings_active ON listings(is_active) WHERE is_active = TRUE;
CREATE INDEX IF NOT EXISTS idx_ratings_to_user ON ratings(to_user_id);
CREATE INDEX IF NOT EXISTS idx_ratings_status ON ratings(status);
CREATE INDEX IF NOT EXISTS idx_messages_to_user ON messages(to_user_id, is_read);
CREATE INDEX IF NOT EXISTS idx_messages_conversation ON messages(from_user_id, to_user_id);
CREATE INDEX IF NOT EXISTS idx_escrows_buyer ON escrows(buyer_id);
CREATE INDEX IF NOT EXISTS idx_escrows_seller ON escrows(seller_id);
CREATE INDEX IF NOT EXISTS idx_escrows_status ON escrows(status);
CREATE INDEX IF NOT EXISTS idx_escrow_events_escrow ON escrow_events(escrow_id);
`;

// Alter existing ratings table to add new columns if they don't exist
const alterMigration = `
ALTER TABLE ratings ADD COLUMN IF NOT EXISTS status VARCHAR(20) DEFAULT 'approved';
ALTER TABLE ratings ADD COLUMN IF NOT EXISTS escrow_id UUID REFERENCES escrows(id) ON DELETE SET NULL;
`;

async function runMigration() {
  try {
    console.log('Running migrations...');
    await pool.query(migration);
    await pool.query(alterMigration);
    console.log('Migrations completed successfully.');
  } catch (err) {
    console.error('Migration failed:', err);
  } finally {
    await pool.end();
  }
}

runMigration();
