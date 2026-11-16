const { getPool, json, isAdmin } = require('./_utils');

// The customer list: everyone who has placed an order with an email address.
// Names, emails and phone numbers — admin only, every method.
async function tableReady(pool){
  try {
    const r = await pool.query(
      `SELECT 1 FROM information_schema.tables WHERE table_name = 'customers' LIMIT 1`
    );
    return r.rows.length > 0;
  } catch (e) { return false; }
}

exports.handler = async (event) => {
  const pool = getPool();
  if (!isAdmin(event)) return json(401, { error: 'Admin login required' });

  try {
    // Before the database update has run there is simply no list yet. Say so
    // rather than failing, so the admin screen can explain what to do.
    if (!(await tableReady(pool))) return json(200, { ready: false, customers: [] });

    if (event.httpMethod === 'GET'){
      const result = await pool.query('SELECT * FROM customers ORDER BY last_order_at DESC');
      return json(200, { ready: true, customers: result.rows });
    }

    // Switching offers on or off for one person — for when someone asks to
    // stop hearing from the shop.
    if (event.httpMethod === 'PATCH'){
      const { id, marketingOk } = JSON.parse(event.body || '{}');
      if (!id || typeof marketingOk !== 'boolean') return json(400, { error: 'id and marketingOk are required' });
      await pool.query('UPDATE customers SET marketing_ok = $1 WHERE id = $2', [marketingOk, id]);
      return json(200, { ok: true });
    }

    // Removing someone entirely, if they ask for their details to be deleted.
    if (event.httpMethod === 'DELETE'){
      const { id } = JSON.parse(event.body || '{}');
      if (!id) return json(400, { error: 'id is required' });
      await pool.query('DELETE FROM customers WHERE id = $1', [id]);
      return json(200, { ok: true });
    }

    return json(405, { error: 'Method not allowed' });
  } catch (err) {
    console.error(err);
    return json(500, { error: err.message });
  }
};
