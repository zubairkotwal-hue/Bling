const { getPool } = require('./_utils');

// Anonymous visit counting for the admin Analytics tab. Public: the page calls
// this in the background as people move around.
//
// What is kept is deliberately thin. One row per browser per day, holding a
// random id made up by that browser plus a handful of yes/no flags (read
// stories, opened the shop, added to basket, ...). No IP address, no name, no
// phone, no link to an order or to which story a particular person read. The
// "most viewed" lists are plain tallies in a second table with no visitor id
// on them at all — on a site where people read about very private things,
// nobody's reading history should exist anywhere.
const SOURCES = ['instagram', 'facebook', 'whatsapp', 'google', 'other', 'direct'];
const DEVICES = ['iphone', 'android', 'computer', 'other'];
const KINDS = ['product', 'story'];
const DAY = `(NOW() AT TIME ZONE 'Africa/Johannesburg')::date`; // her day, not the server's

let ready = null;
let checkedAt = 0;
async function tablesReady(pool){
  const now = Date.now();
  if (ready !== null && now - checkedAt < 60000) return ready;
  try {
    const r = await pool.query(
      `SELECT table_name FROM information_schema.tables WHERE table_name IN ('visits','view_counts')`
    );
    ready = r.rows.length === 2;
  } catch (e) { ready = false; }
  checkedAt = now;
  return ready;
}

const done = () => ({ statusCode: 204, body: '' });

exports.handler = async (event) => {
  // Counting must never get in anyone's way: whatever goes wrong here, the
  // page is told "fine" and carries on.
  try {
    if (event.httpMethod !== 'POST') return done();
    const pool = getPool();
    if (!(await tablesReady(pool))) return done();

    let b;
    try { b = JSON.parse(event.body || '{}'); } catch (e) { return done(); }
    const visitor = String(b.v || '');
    if (!/^[a-z0-9]{10,40}$/.test(visitor)) return done();

    const views = Math.max(0, Math.min(50, parseInt(b.views, 10) || 0));
    const f = (b.flags && typeof b.flags === 'object') ? b.flags : {};
    const flag = (k) => f[k] === true;
    const source = SOURCES.includes(b.src) ? b.src : 'other';
    const device = DEVICES.includes(b.dev) ? b.dev : 'other';

    await pool.query(
      `INSERT INTO visits (day, visitor, is_new, views, saw_stories, saw_shop, saw_product, added_cart,
                           started_checkout, ordered, replied, submitted, source, device, installed)
       VALUES (${DAY}, $1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14)
       ON CONFLICT (day, visitor) DO UPDATE SET
         views            = LEAST(visits.views + EXCLUDED.views, 5000),
         saw_stories      = visits.saw_stories      OR EXCLUDED.saw_stories,
         saw_shop         = visits.saw_shop         OR EXCLUDED.saw_shop,
         saw_product      = visits.saw_product      OR EXCLUDED.saw_product,
         added_cart       = visits.added_cart       OR EXCLUDED.added_cart,
         started_checkout = visits.started_checkout OR EXCLUDED.started_checkout,
         ordered          = visits.ordered          OR EXCLUDED.ordered,
         replied          = visits.replied          OR EXCLUDED.replied,
         submitted        = visits.submitted        OR EXCLUDED.submitted,
         installed        = visits.installed        OR EXCLUDED.installed`,
      [visitor, b.isNew === true, views, flag('stories'), flag('shop'), flag('product'), flag('cart'),
       flag('checkout'), flag('order'), flag('reply'), flag('submit'), source, device, b.pwa === true]
    );

    // Tallies for "most viewed". No visitor id goes anywhere near these.
    const items = Array.isArray(b.items) ? b.items.slice(0, 20) : [];
    for (const it of items){
      if (!it || !KINDS.includes(it.k)) continue;
      const ref = String(it.id || '');
      if (!/^[\w-]{1,80}$/.test(ref)) continue;
      await pool.query(
        `INSERT INTO view_counts (day, kind, ref, n) VALUES (${DAY}, $1, $2, 1)
         ON CONFLICT (day, kind, ref) DO UPDATE SET n = view_counts.n + 1`,
        [it.k, ref]
      );
    }
    return done();
  } catch (err) {
    console.error('track failed', err.message);
    return done();
  }
};
