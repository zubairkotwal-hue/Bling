const { getPool, json, isAdmin, newId } = require('./_utils');

function makeCode(){
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  let out = '';
  for (let i = 0; i < 12; i++){
    if (i && i % 4 === 0) out += '-';
    out += chars[Math.floor(Math.random() * chars.length)];
  }
  return out;
}

// Gift cards hold buyer and recipient details, so only the admin can read them.
exports.handler = async (event) => {
  const pool = getPool();
  try {
    if (event.httpMethod === 'GET'){
      if (!isAdmin(event)) return json(401, { error: 'Admin login required' });
      const result = await pool.query('SELECT * FROM gift_cards ORDER BY created_at DESC');
      return json(200, result.rows);
    }

    if (event.httpMethod === 'POST'){
      const { purchaser, recipient, amount, note, phone } = JSON.parse(event.body || '{}');
      if (!purchaser || !recipient || !amount){
        return json(400, { error: 'purchaser, recipient and amount are required' });
      }
      const id = newId();
      const code = makeCode();
      await pool.query(
        'INSERT INTO gift_cards (id, code, purchaser, recipient, amount, note, phone, status) VALUES ($1,$2,$3,$4,$5,$6,$7,$8)',
        [id, code, purchaser, recipient, String(amount), (note || '').trim() || null, (phone || '').trim() || null, 'Enquired']
      );
      return json(201, { id, code });
    }

    if (event.httpMethod === 'PATCH'){
      if (!isAdmin(event)) return json(401, { error: 'Admin login required' });
      const { id, status } = JSON.parse(event.body || '{}');
      if (!id || !status) return json(400, { error: 'id and status are required' });
      await pool.query('UPDATE gift_cards SET status = $1 WHERE id = $2', [status, id]);
      return json(200, { ok: true });
    }

    if (event.httpMethod === 'DELETE'){
      if (!isAdmin(event)) return json(401, { error: 'Admin login required' });
      const { id } = JSON.parse(event.body || '{}');
      if (!id) return json(400, { error: 'id is required' });
      await pool.query('DELETE FROM gift_cards WHERE id = $1', [id]);
      return json(200, { ok: true });
    }

    return json(405, { error: 'Method not allowed' });
  } catch (err) {
    console.error(err);
    return json(500, { error: err.message });
  }
};
