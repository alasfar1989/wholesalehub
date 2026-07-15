// Renders a shareable public web page for a listing, with Open Graph tags so
// links pasted into WhatsApp/iMessage/etc. show a rich preview. Once the app
// ships universal-links support, installed devices open the app directly and
// never see this page — so its job is a nice preview + an "install" CTA.

const APP_STORE_URL = 'https://apps.apple.com/app/id6760482210';

function esc(str) {
  return String(str == null ? '' : str)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

function money(v) {
  if (v == null) return 'DM for price';
  return '$' + Number(v).toLocaleString();
}

function renderListingPage(listing, baseUrl) {
  const title = esc(listing.title);
  const price = money(listing.price);
  const seller = esc(listing.business_name);
  const typeLabel = listing.type === 'WTB' ? 'Wanted' : 'For Sale';
  const condition = esc(listing.condition || '');
  const city = esc(listing.city || '');
  const qty = listing.quantity || 1;
  const desc = esc(listing.description || '');
  const photo = listing.photo || '';
  const pageUrl = `${baseUrl}/listing/${listing.id}`;
  const deepLink = `wholesalehub://listing/${listing.id}`;

  const ogDesc = `${price} · ${typeLabel}${condition ? ' · ' + condition : ''} — posted by ${seller} on WholesaleHub`;

  return `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8" />
<meta name="viewport" content="width=device-width, initial-scale=1" />
<title>${title} — WholesaleHub</title>
<meta property="og:type" content="product" />
<meta property="og:title" content="${title}" />
<meta property="og:description" content="${esc(ogDesc)}" />
<meta property="og:url" content="${esc(pageUrl)}" />
${photo ? `<meta property="og:image" content="${esc(photo)}" />` : ''}
<meta name="twitter:card" content="${photo ? 'summary_large_image' : 'summary'}" />
<meta name="twitter:title" content="${title}" />
<meta name="twitter:description" content="${esc(ogDesc)}" />
${photo ? `<meta name="twitter:image" content="${esc(photo)}" />` : ''}
<style>
  :root { --navy:#1a1a2e; --accent:#0f3460; --red:#e94560; --muted:#666; --bg:#f5f5f7; --line:#e3e3e8; }
  * { box-sizing: border-box; }
  body { margin:0; font-family:-apple-system,BlinkMacSystemFont,"Segoe UI",Roboto,Helvetica,Arial,sans-serif; background:var(--bg); color:var(--navy); }
  .wrap { max-width:520px; margin:0 auto; padding:16px; }
  .brand { display:flex; align-items:center; gap:8px; padding:8px 0 16px; }
  .brand .mark { width:26px; height:26px; border-radius:7px; background:var(--navy); color:#fff; display:flex; align-items:center; justify-content:center; font-weight:800; font-size:14px; }
  .brand b { font-size:18px; letter-spacing:-0.3px; }
  .card { background:#fff; border:1px solid var(--line); border-radius:16px; overflow:hidden; }
  .photo { width:100%; aspect-ratio:1/1; object-fit:cover; background:#ececed; display:block; }
  .nophoto { width:100%; aspect-ratio:16/9; background:#ececed; display:flex; align-items:center; justify-content:center; color:#aaa; font-size:14px; }
  .body { padding:18px; }
  .badge { display:inline-block; font-size:12px; font-weight:700; color:#fff; background:${listing.type === 'WTB' ? '#2980b9' : '#27ae60'}; padding:3px 10px; border-radius:999px; }
  h1 { font-size:20px; line-height:1.3; margin:12px 0 6px; }
  .price { font-size:26px; font-weight:800; color:var(--navy); letter-spacing:-0.5px; margin:2px 0 12px; }
  .meta { display:flex; flex-wrap:wrap; gap:8px; margin-bottom:14px; }
  .chip { font-size:12px; color:var(--muted); background:var(--bg); border:1px solid var(--line); padding:4px 10px; border-radius:8px; text-transform:capitalize; }
  .desc { font-size:15px; color:#333; line-height:1.5; white-space:pre-wrap; }
  .seller { margin-top:14px; padding-top:14px; border-top:1px solid var(--line); font-size:14px; color:var(--muted); }
  .seller b { color:var(--navy); }
  .cta { display:block; text-align:center; margin-top:18px; background:var(--navy); color:#fff; text-decoration:none; font-weight:700; padding:15px; border-radius:12px; }
  .foot { text-align:center; color:#999; font-size:12px; margin:18px 0; }
</style>
</head>
<body>
  <div class="wrap">
    <div class="brand"><span class="mark">W</span><b>WholesaleHub</b></div>
    <div class="card">
      ${photo ? `<img class="photo" src="${esc(photo)}" alt="${title}" />` : `<div class="nophoto">No photo</div>`}
      <div class="body">
        <span class="badge">${typeLabel}</span>
        <h1>${title}</h1>
        <div class="price">${price}</div>
        <div class="meta">
          ${condition ? `<span class="chip">${condition}</span>` : ''}
          ${qty > 1 ? `<span class="chip">Qty: ${qty}</span>` : ''}
          ${city ? `<span class="chip">${city}</span>` : ''}
        </div>
        ${desc ? `<div class="desc">${desc}</div>` : ''}
        <div class="seller">Posted by <b>${seller}</b></div>
      </div>
    </div>
    <a class="cta" href="${esc(APP_STORE_URL)}">Open in the WholesaleHub app</a>
    <p class="foot">B2B wholesale marketplace · Trade with verified sellers</p>
  </div>
  <script>
    // If the app is installed and registers the scheme, try to open it.
    (function () {
      try { window.location.href = ${JSON.stringify(deepLink)}; } catch (e) {}
    })();
  </script>
</body>
</html>`;
}

function renderNotFound() {
  return `<!doctype html><html lang="en"><head><meta charset="utf-8" />
<meta name="viewport" content="width=device-width, initial-scale=1" />
<title>Listing not found — WholesaleHub</title>
<style>body{font-family:-apple-system,Helvetica,Arial,sans-serif;background:#f5f5f7;color:#1a1a2e;display:flex;min-height:100vh;margin:0;align-items:center;justify-content:center;text-align:center;padding:24px}</style>
</head><body><div><h1>Listing not available</h1><p style="color:#666">This listing may have been removed or sold.</p></div></body></html>`;
}

module.exports = { renderListingPage, renderNotFound };
