// One-time boot seed: posts 5-star CP Wireless reviews on specific users.
// Safe to run repeatedly (upserts); remove this file + its call-site after confirming.
const db = require('../config/database');
const { recalcBadge } = require('../utils/badges');

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

module.exports = async function seedAdminReviewsOnBoot() {
  const admin = await findUserByName(ADMIN_BUSINESS_NAME);
  if (!admin) {
    console.log(`[seed] Admin user "${ADMIN_BUSINESS_NAME}" not found — skipping review seed.`);
    return;
  }

  for (const r of REVIEWS) {
    const target = await findUserByName(r.target);
    if (!target) {
      console.log(`[seed] Skip "${r.target}" — not found`);
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
    console.log(`[seed] ${target.business_name} -> ${r.stars}* (avg=${rows[0].rating_score}, count=${rows[0].rating_count}, badge=${rows[0].badge || 'none'})`);
  }
};
