// One-off: post an auto-approved 5-star admin review on EVERY existing user.
// Idempotent — users the admin has already reviewed are left untouched, so this
// is safe to re-run. Skips the admin account itself.
//
// Usage: node scripts/backfill-admin-reviews.js
// Requires DATABASE_URL in env (same one Railway uses).

const db = require('../src/config/database');
const { getAdminReviewer, postAdminFiveStar } = require('../src/utils/adminReview');

async function main() {
  const admin = await getAdminReviewer();
  if (!admin) {
    console.error('No admin reviewer found (no "CP Wireless" account and no is_admin user). Aborting.');
    process.exit(1);
  }
  console.log(`Reviewer: ${admin.business_name} (${admin.id})\n`);

  const { rows: users } = await db.query(
    'SELECT id, business_name FROM users WHERE id <> $1 ORDER BY created_at ASC',
    [admin.id]
  );
  console.log(`Found ${users.length} users to process.\n`);

  let posted = 0;
  let skipped = 0;
  for (const u of users) {
    try {
      const res = await postAdminFiveStar(u.id, admin);
      if (res.posted) {
        posted++;
        console.log(`  ✓ ${u.business_name} → 5★`);
      } else {
        skipped++;
        console.log(`  – ${u.business_name} (skipped: ${res.reason})`);
      }
    } catch (err) {
      skipped++;
      console.error(`  ! ${u.business_name} failed: ${err.message}`);
    }
  }

  console.log(`\nDone. Posted ${posted}, skipped ${skipped}.`);
  process.exit(0);
}

main().catch((err) => {
  console.error('Fatal:', err);
  process.exit(1);
});
