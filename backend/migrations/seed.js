require('dotenv').config();
const bcrypt = require('bcryptjs');
const { pool } = require('../src/config/database');

async function seed() {
  try {
    console.log('Seeding database...');
    const hash = await bcrypt.hash('password123', 12);

    // Create admin user
    await pool.query(
      `INSERT INTO users (phone, password_hash, business_name, city, category, is_admin, bio)
       VALUES ($1, $2, $3, $4, $5, TRUE, $6)
       ON CONFLICT (phone) DO NOTHING`,
      [process.env.ADMIN_PHONE || '+1234567890', hash, 'WholesaleHub Admin', 'Dubai', 'electronics', 'Platform administrator']
    );

    // Create sample users
    const users = [
      ['+1111111111', hash, 'TechParts Co', 'Dubai', 'electronics'],
      ['+2222222222', hash, 'PhoneWorld LLC', 'Amman', 'phones'],
      ['+3333333333', hash, 'LaptopZone', 'Riyadh', 'laptops'],
    ];

    for (const u of users) {
      await pool.query(
        `INSERT INTO users (phone, password_hash, business_name, city, category)
         VALUES ($1, $2, $3, $4, $5) ON CONFLICT (phone) DO NOTHING`,
        u
      );
    }

    // Get user IDs
    const usersResult = await pool.query('SELECT id, business_name FROM users ORDER BY created_at');
    const userIds = usersResult.rows.map(r => r.id);

    // Create sample listings
    const listings = [
      [userIds[1], 'WTS', 'iPhone 15 Pro Max 256GB - Bulk', 'Brand new sealed, minimum order 10 units', 1099.99, 50, 'new', 'phones', 'Dubai'],
      [userIds[1], 'WTS', 'Samsung Galaxy S24 Ultra', 'Factory sealed, wholesale pricing', 899.99, 100, 'new', 'phones', 'Dubai'],
      [userIds[2], 'WTB', 'Looking for iPhone 14 Pro', 'Need 200 units, any color, must be sealed', 750.00, 200, 'new', 'phones', 'Amman'],
      [userIds[3], 'WTS', 'MacBook Pro M3 14"', 'Wholesale lot, all configs available', 1899.99, 30, 'new', 'laptops', 'Riyadh'],
      [userIds[2], 'WTB', 'Samsung Tablets Needed', 'Need Galaxy Tab S9 series, 500 units', 450.00, 500, 'new', 'tablets', 'Amman'],
      [userIds[3], 'WTS', 'Refurbished Dell Laptops', 'Grade A refurbished, warranty included', 399.99, 75, 'refurbished', 'laptops', 'Riyadh'],
    ];

    for (const l of listings) {
      await pool.query(
        `INSERT INTO listings (user_id, type, title, description, price, quantity, condition, category, city)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)`,
        l
      );
    }

    console.log('Seed completed successfully.');
  } catch (err) {
    console.error('Seed failed:', err);
  } finally {
    await pool.end();
  }
}

seed();
