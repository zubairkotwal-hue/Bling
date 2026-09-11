const { getPool, json } = require('./_utils');
const { sendOne, vapidKeys, loadPrefs, shouldNotify, inQuietHours } = require('./_push');

// One notification summarising everything set to "batched", rather than a ping
// per event. Runs on a schedule (see netlify.toml). Anything already set to
// "instant" is skipped here — it has been sent already.
//
// The high-water mark is kept in the settings table so nothing is counted
// twice and nothing is missed between runs.

const MARK = 'notifyLastDigest';

async function getMark(pool){
  try {
    const r = await pool.query('SELECT value FROM settings WHERE key = $1 LIMIT 1', [MARK]);
    if (r.rows.length) return new Date(r.rows[0].value);
  } catch (e) { /* first run */ }
  // First ever run: look back a few hours rather than announcing the whole history.
  return new Date(Date.now() - 6 * 3600 * 1000);
}

async function setMark(pool, when){
  await pool.query(
    `INSERT INTO settings (key, value) VALUES ($1, $2)
     ON CONFLICT (key) DO UPDATE SET value = EXCLUDED.value`,
    [MARK, when.toISOString()]
  );
}

async function countSince(pool, sql, since){
  try {
    const r = await pool.query(sql, [since.toISOString()]);
    return parseInt(r.rows[0].n, 10) || 0;
  } catch (e) { return 0; }
}

exports.handler = async () => {
  const pool = getPool();
  try {
    const keys = vapidKeys();
    if (!keys) return json(200, { skipped: 'no push keys set' });

    const prefs = await loadPrefs(pool);

    // Never wake her during quiet hours. The next run picks it all up.
    if (inQuietHours(prefs)) return json(200, { skipped: 'quiet hours' });

    const since = await getMark(pool);
    const now = new Date();

    const parts = [];
    if (shouldNotify(prefs, 'stories', 'batched')){
      const n = await countSince(pool,
        `SELECT COUNT(*)::int AS n FROM stories WHERE status = 'pending' AND created_at > $1`, since);
      if (n) parts.push(n + (n === 1 ? ' new story' : ' new stories'));
    }
    if (shouldNotify(prefs, 'replies', 'batched')){
      const n = await countSince(pool,
        `SELECT COUNT(*)::int AS n FROM replies WHERE status = 'pending' AND created_at > $1`, since);
      if (n) parts.push(n + (n === 1 ? ' reply' : ' replies'));
    }
    if (shouldNotify(prefs, 'orders', 'batched')){
      const n = await countSince(pool,
        `SELECT COUNT(*)::int AS n FROM leads WHERE created_at > $1`, since);
      if (n) parts.push(n + (n === 1 ? ' order' : ' orders'));
    }
    if (shouldNotify(prefs, 'help', 'batched')){
      const n = await countSince(pool,
        `SELECT COUNT(*)::int AS n FROM help_messages WHERE status = 'new' AND created_at > $1`, since);
      if (n) parts.push(n + (n === 1 ? ' help message' : ' help messages'));
    }
    if (shouldNotify(prefs, 'reviews', 'batched')){
      const n = await countSince(pool,
        `SELECT COUNT(*)::int AS n FROM reviews WHERE status = 'pending' AND created_at > $1`, since);
      if (n) parts.push(n + (n === 1 ? ' review' : ' reviews'));
    }

    // Move the mark even when nothing is sent, so a quiet spell does not turn
    // into one enormous catch-up notification later.
    await setMark(pool, now);
    if (!parts.length) return json(200, { sent: 0, nothing: true });

    // Always say how big the queue is overall — that is the number she acts on.
    let waiting = 0;
    try {
      const r = await pool.query(
        `SELECT COUNT(*)::int AS n FROM stories WHERE status = 'pending' AND archived_at IS NULL`);
      waiting = r.rows[0].n;
    } catch (e) { /* ignore */ }

    const body = parts.join(' \u00b7 ') + (waiting ? `\n${waiting} waiting in the queue` : '');
    const payload = JSON.stringify({
      title: 'Since you last looked',
      body,
      url: '/?admin=1',
      kind: 'digest',
    });

    const subs = await pool.query('SELECT * FROM push_subscriptions');
    let sent = 0;
    for (const row of subs.rows){
      const r = await sendOne(row, payload, keys);
      if (r === 'sent') sent += 1;
      if (r === 'gone') await pool.query('DELETE FROM push_subscriptions WHERE id = $1', [row.id]);
    }
    return json(200, { sent, summary: body });
  } catch (err) {
    console.error(err);
    return json(500, { error: err.message });
  }
};
