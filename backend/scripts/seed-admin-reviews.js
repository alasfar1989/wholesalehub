// One-off: post 5-star admin reviews on specific users.
// Usage: node scripts/seed-admin-reviews.js
// Requires DATABASE_URL in env (same one Railway uses).

const db = require('../src/config/database');
const { recalcBadge } = require('../src/utils/badges');

const ADMIN_BUSINESS_NAME = 'CP Wireless';

const REVIEWS = [
  {
    target: 'Inspiration Wireless',
    stars: 5,
    comment: 'Great to work with — products arrived exactly as described and shipped fast. Highly recommend.',
  },
  {
    target: 'Nhut Nguyen',
    stars: 5,
    comment: 'Solid communication and reliable. Smooth deal from start to finish — will buy again.',
  },
];

async function findUserByName(name) {
  const result = await db.query(
    'SELECT id, business_name FROM users WHERE business_name ILIKE $1 LIMIT 1',
    [name]
  );
  return result.rows[0] || null;
}

async function recalcRating(userId) {
  const result = await db.query(
    `SELECT AVG(stars)::DECIMAL(3,2) AS avg_rating, COUNT(*) AS count
     FROM ratings WHERE to_user_id = $1 AND status = 'approved'`,
    [userId]
  );
  await db.query(
    'UPDATE users SET rating_score = $1, rating_count = $2 WHERE id = $3',
    [result.rows[0].avg_rating || 0, result.rows[0].count, userId]
  );
}

async function main() {
  const admin = await findUserByName(ADMIN_BUSINESS_NAME);
  if (!admin) {
    console.error(`Admin user "${ADMIN_BUSINESS_NAME}" not found. Aborting.`);
    process.exit(1);
  }
  console.log(`Reviewer: ${admin.business_name} (${admin.id})`);

  for (const r of REVIEWS) {
    const target = await findUserByName(r.target);
    if (!target) {
      console.warn(`  ! Skipping "${r.target}" — not found`);
      continue;
    }
    await db.query(
      `INSERT INTO ratings (from_user_id, to_user_id, stars, comment, status)
       VALUES ($1, $2, $3, $4, 'approved')
       ON CONFLICT (from_user_id, to_user_id)
       DO UPDATE SET stars = $3, comment = $4, status = 'approved', created_at = NOW()`,
      [admin.id, target.id, r.stars, r.comment]
    );
    await recalcRating(target.id);
    await recalcBadge(target.id);

    const { rows } = await db.query(
      'SELECT rating_score, rating_count, badge FROM users WHERE id = $1',
      [target.id]
    );
    const agg = rows[0];
    console.log(`  ✓ ${target.business_name} → ${r.stars}★ (avg=${agg.rating_score}, count=${agg.rating_count}, badge=${agg.badge || 'none'})`);
  }

  process.exit(0);
}

main().catch(err => {
  console.error('Fatal:', err);
  process.exit(1);
});
