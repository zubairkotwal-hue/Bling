const { getPool, json, isAdmin, newId } = require('./_utils');
const { sendOne, vapidKeys } = require('./_push');

// Sending an offer to every customer who asked for notifications. Admin only.
//
// A function here is cut off after a few seconds, and a list can outgrow what
// fits in that. So a send is done in slices: the first call creates the record
// and sends as many as fit, and returns a cursor; the admin page keeps calling
// with that cursor until `done` comes back true. Each device is visited once,
// in id order, so stopping and resuming can never send the same offer twice.
const BATCH = 25;          // devices contacted at the same moment
const TIME_BUDGET = 6000;  // ms of sending per call, well inside the limit
const MAX_TITLE = 60;
const MAX_BODY = 180;

async function tablesReady(pool){
  try {
    const r = await pool.query(
      `SELECT table_name FROM information_schema.tables
        WHERE table_name IN ('customer_push_subscriptions','broadcasts')`
    );
    return r.rows.length === 2;
  } catch (e) { return false; }
}

// Only links into this site, so a notification can never send people elsewhere.
function cleanUrl(value){
  const u = String(value || '/').trim();
  return (u.startsWith('/') && !u.startsWith('//') && u.length <= 300) ? u : '/';
}

exports.handler = async (event) => {
  const pool = getPool();
  if (!isAdmin(event)) return json(401, { error: 'Admin login required' });

  try {
    const keys = vapidKeys();
    const ready = await tablesReady(pool);

    if (event.httpMethod === 'GET'){
      if (!ready) return json(200, { ready: false, configured: !!keys, subscribers: 0, recent: [] });
      const count = await pool.query('SELECT COUNT(*)::int AS n FROM customer_push_subscriptions');
      const recent = await pool.query('SELECT * FROM broadcasts ORDER BY created_at DESC LIMIT 20');
      return json(200, { ready: true, configured: !!keys, subscribers: count.rows[0].n, recent: recent.rows });
    }

    if (event.httpMethod !== 'POST') return json(405, { error: 'Method not allowed' });
    if (!keys) return json(400, { error: 'Push keys are not set up on the server yet.' });
    if (!ready) return json(400, { error: 'Run the database update first.' });

    const input = JSON.parse(event.body || '{}');

    // ---- "Send to my phone first": one device, nothing recorded ----
    if (input.testEndpoint){
      const title = String(input.title || '').trim().slice(0, MAX_TITLE);
      const body = String(input.body || '').trim().slice(0, MAX_BODY);
      if (!title || !body) return json(400, { error: 'Add a title and a message first.' });
      const row = await pool.query(
        'SELECT * FROM customer_push_subscriptions WHERE endpoint = $1 LIMIT 1', [String(input.testEndpoint)]
      );
      if (!row.rows.length) return json(400, { error: 'This device is not signed up for offers yet.' });
      const result = await sendOne(row.rows[0],
        JSON.stringify({ title, body, url: cleanUrl(input.url), kind: 'offer' }), keys);
      return json(200, { sent: result === 'sent' ? 1 : 0 });
    }

    // ---- Start a new send, or carry on with one ----
    let record;
    if (input.broadcastId){
      const found = await pool.query('SELECT * FROM broadcasts WHERE id = $1', [String(input.broadcastId)]);
      if (!found.rows.length) return json(404, { error: 'That send could not be found.' });
      record = found.rows[0];
      if (record.finished) return json(200, { done: true, broadcast: record });
    } else {
      const title = String(input.title || '').trim();
      const body = String(input.body || '').trim();
      if (!title || !body) return json(400, { error: 'Add a title and a message first.' });
      if (title.length > MAX_TITLE) return json(400, { error: `Keep the title under ${MAX_TITLE} characters.` });
      if (body.length > MAX_BODY) return json(400, { error: `Keep the message under ${MAX_BODY} characters.` });
      const audience = await pool.query('SELECT COUNT(*)::int AS n FROM customer_push_subscriptions');
      if (!audience.rows[0].n) return json(400, { error: 'Nobody has signed up for offers yet.' });
      const created = await pool.query(
        `INSERT INTO broadcasts (id, title, body, url, audience) VALUES ($1,$2,$3,$4,$5) RETURNING *`,
        [newId(), title, body, cleanUrl(input.url), audience.rows[0].n]
      );
      record = created.rows[0];
    }

    const payload = JSON.stringify({ title: record.title, body: record.body, url: record.url || '/', kind: 'offer' });
    const started = Date.now();
    let cursor = String(input.cursor || '');
    let sent = 0, failed = 0, removed = 0, done = false;

    while (Date.now() - started < TIME_BUDGET){
      const slice = await pool.query(
        'SELECT * FROM customer_push_subscriptions WHERE id > $1 ORDER BY id LIMIT $2', [cursor, BATCH]
      );
      if (!slice.rows.length){ done = true; break; }

      const results = await Promise.all(slice.rows.map(row => sendOne(row, payload, keys)));
      const gone = [];
      results.forEach((r, i) => {
        if (r === 'sent') sent += 1;
        else if (r === 'gone'){ removed += 1; gone.push(slice.rows[i].id); }
        else failed += 1;
      });
      // A device that has uninstalled or switched notifications off says so.
      // Drop it, so the subscriber count stays honest.
      if (gone.length){
        await pool.query('DELETE FROM customer_push_subscriptions WHERE id = ANY($1)', [gone]);
      }
      cursor = slice.rows[slice.rows.length - 1].id;
      if (slice.rows.length < BATCH){ done = true; break; }
    }

    const updated = await pool.query(
      `UPDATE broadcasts SET sent = sent + $1, failed = failed + $2, removed = removed + $3, finished = $4
        WHERE id = $5 RETURNING *`,
      [sent, failed, removed, done, record.id]
    );
    return json(200, { done, cursor, broadcast: updated.rows[0] });
  } catch (err) {
    console.error(err);
    return json(500, { error: err.message });
  }
};
