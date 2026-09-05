const { getPool, json, isAdmin } = require('./_utils');

// Everything here is shown to customers anyway (banking details, collection
// address, shipping cost), so reading is public — the checkout page needs
// the shipping cost. Only an admin can change anything.
exports.handler = async (event) => {
  const pool = getPool();

  try {
    if (event.httpMethod === 'GET'){
      const result = await pool.query('SELECT key, value FROM settings');
      const out = {};
      result.rows.forEach(r => { out[r.key] = r.value; });
      return json(200, out);
    }

    if (event.httpMethod === 'PATCH'){
      if (!isAdmin(event)) return json(401, { error: 'Admin login required' });
      const updates = JSON.parse(event.body || '{}');
      const keys = Object.keys(updates);
      if (!keys.length) return json(400, { error: 'nothing to update' });

      for (const key of keys){
        await pool.query(
          `INSERT INTO settings (key, value) VALUES ($1, $2)
           ON CONFLICT (key) DO UPDATE SET value = EXCLUDED.value`,
          [key, String(updates[key])]
        );
      }
      return json(200, { ok: true, saved: keys.length });
    }

    return json(405, { error: 'Method not allowed' });
  } catch (err) {
    console.error(err);
    return json(500, { error: err.message });
  }
};
