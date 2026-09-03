const { getPool, json, getAdminUser, newId } = require('./_utils');

exports.handler = async (event, context) => {
  const pool = getPool();
  const admin = getAdminUser(context);

  try {
    // Anyone can read approved stories (the public library).
    // Only the logged-in admin can see pending/rejected ones too (the review queue).
    if (event.httpMethod === 'GET'){
      const result = admin
        ? await pool.query('SELECT * FROM stories ORDER BY created_at DESC')
        : await pool.query("SELECT * FROM stories WHERE status = 'approved' ORDER BY created_at DESC");
      return json(200, result.rows);
    }

    // Anyone can submit a story — no login required, exactly as designed.
    if (event.httpMethod === 'POST'){
      const { text, category } = JSON.parse(event.body || '{}');
      if (!text || !category) return json(400, { error: 'text and category are required' });
      const id = newId();
      await pool.query(
        'INSERT INTO stories (id, text, category, status) VALUES ($1, $2, $3, $4)',
        [id, text, category, 'pending']
      );
      return json(201, { id });
    }

    // Approving/rejecting/marking-posted is admin only.
    if (event.httpMethod === 'PATCH'){
      if (!admin) return json(401, { error: 'Admin login required' });
      const { id, status, posted } = JSON.parse(event.body || '{}');
      if (!id) return json(400, { error: 'id is required' });
      if (status) await pool.query('UPDATE stories SET status = $1 WHERE id = $2', [status, id]);
      if (typeof posted === 'boolean') await pool.query('UPDATE stories SET posted = $1 WHERE id = $2', [posted, id]);
      return json(200, { ok: true });
    }

    return json(405, { error: 'Method not allowed' });
  } catch (err) {
    console.error(err);
    return json(500, { error: err.message });
  }
};
