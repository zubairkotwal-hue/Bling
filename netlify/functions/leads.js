const { getPool, json, getAdminUser, newId } = require('./_utils');

exports.handler = async (event, context) => {
  const pool = getPool();
  const admin = getAdminUser(context);

  try {
    // Leads hold customer phone numbers and addresses — never public,
    // unlike stories/products. Only the logged-in admin can read them.
    if (event.httpMethod === 'GET'){
      if (!admin) return json(401, { error: 'Admin login required' });
      const result = await pool.query('SELECT * FROM leads ORDER BY created_at DESC');
      return json(200, result.rows);
    }

    // Placing an order (from the storefront, or added manually by the admin)
    // is the one write anyone can do without being logged in.
    if (event.httpMethod === 'POST'){
      const { buyer, phone, item, price, deliveryMethod, address } = JSON.parse(event.body || '{}');
      if (!buyer || !item) return json(400, { error: 'buyer and item are required' });
      const id = newId();
      await pool.query(
        'INSERT INTO leads (id, buyer, phone, item, price, delivery_method, address, status) VALUES ($1,$2,$3,$4,$5,$6,$7,$8)',
        [id, buyer, phone || null, item, price || null, deliveryMethod || 'Collection', address || null, 'Enquired']
      );
      return json(201, { id });
    }

    if (event.httpMethod === 'PATCH'){
      if (!admin) return json(401, { error: 'Admin login required' });
      const { id, status } = JSON.parse(event.body || '{}');
      if (!id || !status) return json(400, { error: 'id and status are required' });
      await pool.query('UPDATE leads SET status = $1 WHERE id = $2', [status, id]);
      return json(200, { ok: true });
    }

    if (event.httpMethod === 'DELETE'){
      if (!admin) return json(401, { error: 'Admin login required' });
      const { id } = JSON.parse(event.body || '{}');
      if (!id) return json(400, { error: 'id is required' });
      await pool.query('DELETE FROM leads WHERE id = $1', [id]);
      return json(200, { ok: true });
    }

    return json(405, { error: 'Method not allowed' });
  } catch (err) {
    console.error(err);
    return json(500, { error: err.message });
  }
};
