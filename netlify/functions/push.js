const { getPool, json, isAdmin, newId } = require('./_utils');
const { sendOne, vapidKeys } = require('./_push');

// Stores the admin's push subscription and sends test notifications.
// GET returns the public key the browser needs in order to subscribe.
exports.handler = async (event) => {
  const pool = getPool();
  const admin = isAdmin(event);

  try {
    if (event.httpMethod === 'GET'){
      const keys = vapidKeys();
      return json(200, {
        configured: !!keys,
        publicKey: keys ? keys.pub : null,
      });
    }

    // Everything below is admin-only. Without this check anyone could
    // register to receive notifications about her orders.
    if (!admin) return json(401, { error: 'Admin login required' });

    if (event.httpMethod === 'POST'){
      const { subscription, test } = JSON.parse(event.body || '{}');

      if (test){
        const keys = vapidKeys();
        if (!keys) return json(400, { error: 'Push keys are not set up on the server yet.' });
        const subs = await pool.query('SELECT * FROM push_subscriptions');
        if (!subs.rows.length) return json(400, { error: 'This device is not signed up yet.' });
        let sent = 0;
        for (const row of subs.rows){
          const r = await sendOne(row, JSON.stringify({
            title: 'Bling Happiness',
            body: 'Notifications are working.',
            url: '/?admin=1',
            kind: 'test',
          }), keys);
          if (r === 'sent') sent += 1;
          if (r === 'gone') await pool.query('DELETE FROM push_subscriptions WHERE id = $1', [row.id]);
        }
        return json(200, { sent, devices: subs.rows.length });
      }

      if (!subscription || !subscription.endpoint || !subscription.keys){
        return json(400, { error: 'subscription is required' });
      }

      // One row per device. Re-subscribing on the same device replaces it
      // rather than piling up duplicates.
      await pool.query('DELETE FROM push_subscriptions WHERE endpoint = $1', [subscription.endpoint]);
      await pool.query(
        `INSERT INTO push_subscriptions (id, endpoint, p256dh, auth, created_at)
         VALUES ($1,$2,$3,$4,NOW())`,
        [newId(), subscription.endpoint, subscription.keys.p256dh, subscription.keys.auth]
      );
      const count = await pool.query('SELECT COUNT(*)::int AS n FROM push_subscriptions');
      return json(201, { ok: true, devices: count.rows[0].n });
    }

    if (event.httpMethod === 'DELETE'){
      const { endpoint } = JSON.parse(event.body || '{}');
      if (endpoint){
        await pool.query('DELETE FROM push_subscriptions WHERE endpoint = $1', [endpoint]);
      } else {
        await pool.query('DELETE FROM push_subscriptions');
      }
      return json(200, { ok: true });
    }

    return json(405, { error: 'Method not allowed' });
  } catch (err) {
    console.error(err);
    return json(500, { error: err.message });
  }
};
