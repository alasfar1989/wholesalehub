const db = require('../config/database');
const { recalcBadge } = require('./badges');

// Pool of warm, believable 5-star comments. We pick one deterministically per
// target user so profiles don't all show the exact same text (which reads fake).
const FIVE_STAR_COMMENTS = [
  'Great to work with — reliable communication and a smooth, professional experience. Highly recommend.',
  'Solid partner to deal with. Responsive, straightforward, and easy to trust. Would work with again.',
  'Excellent to do business with. Fast to respond and true to their word from start to finish.',
  'Trustworthy and professional. Everything went exactly as described — a pleasure to work with.',
  'Top-notch communication and reliability. Smooth deal all around, highly recommended.',
  'Dependable and easy to deal with. Quick replies and honest throughout. Five stars.',
  'Great experience — professional, prompt, and reliable. Looking forward to doing more business.',
  'Really solid to work with. Clear communication and no hassle. Would happily deal again.',
];

// Stable, varied comment selection keyed off the target user's id.
function pickComment(userId) {
  const key = String(userId);
  let hash = 0;
  for (let i = 0; i < key.length; i++) {
    hash = (hash * 31 + key.charCodeAt(i)) >>> 0;
  }
  return FIVE_STAR_COMMENTS[hash % FIVE_STAR_COMMENTS.length];
}

// Find the admin user who authors these reviews.
// Prefer the "CP Wireless" business account; fall back to any admin user.
async function getAdminReviewer() {
  const byName = await db.query(
    "SELECT id, business_name FROM users WHERE business_name ILIKE 'CP Wireless' ORDER BY created_at ASC LIMIT 1"
  );
  if (byName.rows.length > 0) return byName.rows[0];

  const byFlag = await db.query(
    'SELECT id, business_name FROM users WHERE is_admin = true ORDER BY created_at ASC LIMIT 1'
  );
  return byFlag.rows[0] || null;
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

// Post an auto-approved 5-star admin review on a target user.
// Idempotent: skips if the admin has already reviewed this user (won't clobber
// an existing custom review). Never rates the admin account itself.
// Returns { posted: boolean, reason?: string }.
async function postAdminFiveStar(targetUserId, adminReviewer = null) {
  const admin = adminReviewer || (await getAdminReviewer());
  if (!admin) return { posted: false, reason: 'no-admin' };
  if (admin.id === targetUserId) return { posted: false, reason: 'is-admin' };

  const comment = pickComment(targetUserId);

  const result = await db.query(
    `INSERT INTO ratings (from_user_id, to_user_id, stars, comment, status)
     VALUES ($1, $2, 5, $3, 'approved')
     ON CONFLICT (from_user_id, to_user_id) DO NOTHING
     RETURNING id`,
    [admin.id, targetUserId, comment]
  );

  if (result.rows.length === 0) return { posted: false, reason: 'exists' };

  await recalcRating(targetUserId);
  await recalcBadge(targetUserId);
  return { posted: true };
}

module.exports = { getAdminReviewer, postAdminFiveStar, recalcRating, FIVE_STAR_COMMENTS };
