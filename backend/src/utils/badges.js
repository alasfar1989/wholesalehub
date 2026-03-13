const db = require('../config/database');

// Badge tiers in priority order (highest first)
const BADGE_TIERS = [
  // founder is manually assigned and never overwritten
  {
    key: 'top_rated',
    label: 'Top Rated',
    check: (stats) => stats.rating_score >= 4.5 && stats.rating_count >= 5,
  },
  {
    key: 'trusted',
    label: 'Trusted Trader',
    check: (stats) => stats.completed_escrows >= 5,
  },
  {
    key: 'active',
    label: 'Active Seller',
    check: (stats) => stats.listing_count >= 10,
  },
  {
    key: 'rising',
    label: 'Rising Star',
    check: (stats) => stats.rating_count >= 3 || stats.completed_escrows >= 2,
  },
];

async function recalcBadge(userId) {
  try {
    // Don't overwrite founder badge
    const user = await db.query('SELECT badge FROM users WHERE id = $1', [userId]);
    if (user.rows.length === 0) return;
    if (user.rows[0].badge === 'founder') return;

    // Gather stats
    const [ratings, escrows, listings] = await Promise.all([
      db.query(
        'SELECT rating_score, rating_count FROM users WHERE id = $1',
        [userId]
      ),
      db.query(
        "SELECT COUNT(*) as count FROM escrows WHERE (buyer_id = $1 OR seller_id = $1) AND status = 'completed'",
        [userId]
      ),
      db.query(
        'SELECT COUNT(*) as count FROM listings WHERE user_id = $1',
        [userId]
      ),
    ]);

    const stats = {
      rating_score: parseFloat(ratings.rows[0].rating_score) || 0,
      rating_count: parseInt(ratings.rows[0].rating_count) || 0,
      completed_escrows: parseInt(escrows.rows[0].count) || 0,
      listing_count: parseInt(listings.rows[0].count) || 0,
    };

    // Find highest matching badge
    let newBadge = null;
    for (const tier of BADGE_TIERS) {
      if (tier.check(stats)) {
        newBadge = tier.key;
        break;
      }
    }

    // Update if changed
    if (newBadge !== user.rows[0].badge) {
      await db.query('UPDATE users SET badge = $1 WHERE id = $2', [newBadge, userId]);
    }
  } catch (err) {
    console.error('Badge recalc error:', err.message);
  }
}

module.exports = { recalcBadge, BADGE_TIERS };
