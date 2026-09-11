const { getPool, json, isAdmin, newId } = require('./_utils');
const { notify } = require('./_push');

exports.handler = async (event) => {
  const pool = getPool();
  const admin = isAdmin(event);
  try {
    // Shoppers see approved reviews; the admin sees everything.
    if (event.httpMethod === 'GET'){
      const result = admin
        ? await pool.query('SELECT * FROM reviews ORDER BY created_at DESC')
        : await pool.query("SELECT * FROM reviews WHERE status = 'approved' ORDER BY created_at DESC");
      return json(200, result.rows);
    }

    // Anyone can leave a review — it waits for approval, like a story.
    if (event.httpMethod === 'POST'){
      const { productId, rating, text, pseudonym } = JSON.parse(event.body || '{}');
      if (!productId || !text) return json(400, { error: 'productId and text are required' });
      const id = newId();
      const r = Math.max(1, Math.min(5, parseInt(rating, 10) || 5));
      await pool.query(
        'INSERT INTO reviews (id, product_id, rating, text, pseudonym, status) VALUES ($1,$2,$3,$4,$5,$6)',
        [id, productId, r, text, (pseudonym || '').trim() || null, 'pending']
      );
      await notify(pool, 'reviews', r + '-star review to approve',
        'Open Reviews to read it.', '/?admin=1');
      return json(201, { id });
    }

    if (event.httpMethod === 'PATCH'){
      if (!admin) return json(401, { error: 'Admin login required' });
      const { id, status } = JSON.parse(event.body || '{}');
      if (!id || !status) return json(400, { error: 'id and status are required' });
      await pool.query('UPDATE reviews SET status = $1 WHERE id = $2', [status, id]);
      return json(200, { ok: true });
    }

    if (event.httpMethod === 'DELETE'){
      if (!admin) return json(401, { error: 'Admin login required' });
      const { id } = JSON.parse(event.body || '{}');
      if (!id) return json(400, { error: 'id is required' });
      await pool.query('DELETE FROM reviews WHERE id = $1', [id]);
      return json(200, { ok: true });
    }

    return json(405, { error: 'Method not allowed' });
  } catch (err) {
    console.error(err);
    return json(500, { error: err.message });
  }
};
