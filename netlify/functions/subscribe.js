const { getPool, json, newId } = require('./_utils');
const { vapidKeys } = require('./_push');

// Customers signing up for offer notifications. Public: no login.
//
// This writes to customer_push_subscriptions and nothing else. The admin's
// devices live in push_subscriptions, which receives "New order" alerts with
// buyers' names in them — a customer must never be able to add themselves to
// that table, which is why this is a separate function and a separate table
// rather than a flag on the existing one.
const MAX_ROWS = 50000; // a ceiling, so the open endpoint cannot be used to fill the database

async function tableReady(pool){
  try {
    const r = await pool.query(
      `SELECT 1 FROM information_schema.tables WHERE table_name = 'customer_push_subscriptions' LIMIT 1`
    );
    return r.rows.length > 0;
  } catch (e) { return false; }
}

const short = (v, max) => typeof v === 'string' && v.length > 0 && v.length <= max;

exports.handler = async (event) => {
  const pool = getPool();

  try {
    if (event.httpMethod === 'GET'){
      const keys = vapidKeys();
      const ready = await tableReady(pool);
      return json(200, {
        // The browser only offers notifications when all of this is in place.
        configured: !!keys && ready,
        publicKey: keys ? keys.pub : null,
      });
    }

    if (event.httpMethod === 'POST'){
      const { subscription } = JSON.parse(event.body || '{}');
      const keys = subscription && subscription.keys;
      if (!subscription || !short(subscription.endpoint, 2000) || !/^https:\/\//.test(subscription.endpoint)
          || !keys || !short(keys.p256dh, 300) || !short(keys.auth, 300)){
        return json(400, { error: 'subscription is required' });
      }
      if (!(await tableReady(pool))) return json(503, { error: 'Notifications are not set up yet.' });

      const count = await pool.query('SELECT COUNT(*)::int AS n FROM customer_push_subscriptions');
      if (count.rows[0].n >= MAX_ROWS) return json(503, { error: 'Notifications are full right now.' });

      // One row per device; signing up again on the same device refreshes it.
      await pool.query(
        `INSERT INTO customer_push_subscriptions (id, endpoint, p256dh, auth, created_at)
         VALUES ($1,$2,$3,$4,NOW())
         ON CONFLICT (endpoint) DO UPDATE SET p256dh = EXCLUDED.p256dh, auth = EXCLUDED.auth`,
        [newId(), subscription.endpoint, keys.p256dh, keys.auth]
      );
      return json(201, { ok: true });
    }

    // Turning them off again. Only ever removes the one device that asks.
    if (event.httpMethod === 'DELETE'){
      const { endpoint } = JSON.parse(event.body || '{}');
      if (!short(endpoint, 2000)) return json(400, { error: 'endpoint is required' });
      if (await tableReady(pool)){
        await pool.query('DELETE FROM customer_push_subscriptions WHERE endpoint = $1', [endpoint]);
      }
      return json(200, { ok: true });
    }

    return json(405, { error: 'Method not allowed' });
  } catch (err) {
    console.error(err);
    return json(500, { error: err.message });
  }
};
