const { getPool, json, isAdmin, newId } = require('./_utils');

// Help messages carry a phone number, so only the admin may read them.
exports.handler = async (event) => {
  const pool = getPool();
  try {
    if (event.httpMethod === 'GET'){
      if (!isAdmin(event)) return json(401, { error: 'Admin login required' });
      const result = await pool.query('SELECT * FROM help_messages ORDER BY created_at DESC');
      return json(200, result.rows);
    }

    if (event.httpMethod === 'POST'){
      const { name, phone, message } = JSON.parse(event.body || '{}');
      if (!message || !phone) return json(400, { error: 'message and phone are required' });
      const id = newId();
      await pool.query(
        'INSERT INTO help_messages (id, name, phone, message, status) VALUES ($1,$2,$3,$4,$5)',
        [id, (name || '').trim() || null, phone, message, 'new']
      );
      return json(201, { id });
    }

    if (event.httpMethod === 'PATCH'){
      if (!isAdmin(event)) return json(401, { error: 'Admin login required' });
      const { id, status } = JSON.parse(event.body || '{}');
      if (!id || !status) return json(400, { error: 'id and status are required' });
      await pool.query('UPDATE help_messages SET status = $1 WHERE id = $2', [status, id]);
      return json(200, { ok: true });
    }

    if (event.httpMethod === 'DELETE'){
      if (!isAdmin(event)) return json(401, { error: 'Admin login required' });
      const { id } = JSON.parse(event.body || '{}');
      if (!id) return json(400, { error: 'id is required' });
      await pool.query('DELETE FROM help_messages WHERE id = $1', [id]);
      return json(200, { ok: true });
    }

    return json(405, { error: 'Method not allowed' });
  } catch (err) {
    console.error(err);
    return json(500, { error: err.message });
  }
};
