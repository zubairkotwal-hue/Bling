const { getPool, json, isAdmin, newId } = require('./_utils');

exports.handler = async (event, context) => {
  const pool = getPool();
  const admin = isAdmin(event);

  try {
    if (event.httpMethod === 'GET'){
      const result = admin
        ? await pool.query('SELECT * FROM replies ORDER BY created_at DESC')
        : await pool.query("SELECT * FROM replies WHERE status = 'approved' ORDER BY created_at DESC");
      return json(200, result.rows);
    }

    // Anyone can reply — no login required, same as submitting a story.
    if (event.httpMethod === 'POST'){
      const { storyId, text } = JSON.parse(event.body || '{}');
      if (!storyId || !text) return json(400, { error: 'storyId and text are required' });
      const id = newId();
      await pool.query(
        'INSERT INTO replies (id, story_id, text, status) VALUES ($1, $2, $3, $4)',
        [id, storyId, text, 'pending']
      );
      return json(201, { id });
    }

    if (event.httpMethod === 'PATCH'){
      if (!admin) return json(401, { error: 'Admin login required' });
      const { id, status } = JSON.parse(event.body || '{}');
      if (!id || !status) return json(400, { error: 'id and status are required' });
      await pool.query('UPDATE replies SET status = $1 WHERE id = $2', [status, id]);
      return json(200, { ok: true });
    }

    if (event.httpMethod === 'DELETE'){
      if (!admin) return json(401, { error: 'Admin login required' });
      const { id } = JSON.parse(event.body || '{}');
      if (!id) return json(400, { error: 'id is required' });
      await pool.query('DELETE FROM replies WHERE id = $1', [id]);
      return json(200, { ok: true });
    }

    return json(405, { error: 'Method not allowed' });
  } catch (err) {
    console.error(err);
    return json(500, { error: err.message });
  }
};
