const db = require('../config/database');
const { sendPushNotification } = require('./pushNotifications');

// When a new listing is created, find saved searches it matches and push-notify
// their owners. Each saved-search filter that is NULL acts as a wildcard.
// Best-effort — never throws into the caller.
async function notifySavedSearchMatches(listing) {
  try {
    const price = listing.price != null ? parseFloat(listing.price) : null;
    const result = await db.query(
      `SELECT ss.id, ss.user_id
       FROM saved_searches ss
       WHERE ss.user_id <> $1
         AND (ss.type IS NULL OR ss.type = $2)
         AND (ss.keyword IS NULL OR $3 ILIKE '%' || ss.keyword || '%' OR $4 ILIKE '%' || ss.keyword || '%')
         AND (ss.city IS NULL OR $5 ILIKE '%' || ss.city || '%')
         AND (ss.category IS NULL OR $6 ILIKE '%' || ss.category || '%')
         AND (ss.condition IS NULL OR $7 ILIKE ss.condition)
         AND (ss.min_price IS NULL OR ($8::DECIMAL IS NOT NULL AND $8::DECIMAL >= ss.min_price))
         AND (ss.max_price IS NULL OR ($8::DECIMAL IS NOT NULL AND $8::DECIMAL <= ss.max_price))`,
      [
        listing.user_id,
        listing.type,
        listing.title || '',
        listing.description || '',
        listing.city || '',
        listing.category || '',
        listing.condition || '',
        price,
      ]
    );

    // One user may have multiple matching saved searches — notify once each.
    const seen = new Set();
    const label = listing.type === 'WTB' ? 'wanted' : 'for sale';
    for (const row of result.rows) {
      if (seen.has(row.user_id)) continue;
      seen.add(row.user_id);
      sendPushNotification(
        row.user_id,
        'New listing matches your search',
        `"${listing.title}" (${label})${price != null ? ` — $${price}` : ''}`,
        { type: 'listing', listingId: listing.id }
      );
    }
  } catch (err) {
    console.error('Saved-search match error:', err.message);
  }
}

module.exports = { notifySavedSearchMatches };
