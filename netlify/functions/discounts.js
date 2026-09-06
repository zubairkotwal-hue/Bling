const { getPool, json, isAdmin, newId } = require('./_utils');

// Works out what a code is worth, and whether it can still be used.
// Exported so the order function can re-check it — a customer's browser
// must never be trusted to decide a discount.
async function lookupCode(pool, rawCode){
  const code = String(rawCode || '').trim().toUpperCase();
  if (!code) return { ok: false, reason: 'No code entered.' };

  const r = await pool.query('SELECT * FROM discount_codes WHERE UPPER(code) = $1', [code]);
  if (!r.rows.length) return { ok: false, reason: 'That code is not recognised.' };

  const d = r.rows[0];
  if (!d.active) return { ok: false, reason: 'That code is no longer active.' };
  if (d.max_uses > 0 && d.used_count >= d.max_uses){
    return { ok: false, reason: 'That code has already been used the maximum number of times.' };
  }
  return { ok: true, discount: d };
}

function discountAmount(d, subtotal){
  const value = parseFloat(d.value) || 0;
  const amount = d.kind === 'amount' ? value : (subtotal * value / 100);
  return Math.max(0, Math.min(subtotal, Math.round(amount)));
}

exports.handler = async (event) => {
  const pool = getPool();
  try {
    // Anyone can check a code at checkout. Checking does NOT use it up.
    if (event.httpMethod === 'POST' && (event.queryStringParameters || {}).check === '1'){
      const { code, subtotal } = JSON.parse(event.body || '{}');
      const res = await lookupCode(pool, code);
      if (!res.ok) return json(200, { ok: false, reason: res.reason });
      const d = res.discount;
      return json(200, {
        ok: true,
        code: d.code,
        kind: d.kind,
        value: parseFloat(d.value),
        amount: discountAmount(d, parseFloat(subtotal) || 0),
        remaining: d.max_uses > 0 ? d.max_uses - d.used_count : null,
      });
    }

    if (event.httpMethod === 'GET'){
      if (!isAdmin(event)) return json(401, { error: 'Admin login required' });
      const r = await pool.query('SELECT * FROM discount_codes ORDER BY created_at DESC');
      return json(200, r.rows);
    }

    if (event.httpMethod === 'POST'){
      if (!isAdmin(event)) return json(401, { error: 'Admin login required' });
      const { code, kind, value, maxUses } = JSON.parse(event.body || '{}');
      const clean = String(code || '').trim().toUpperCase();
      if (!clean) return json(400, { error: 'A code is required' });
      if (!value || parseFloat(value) <= 0) return json(400, { error: 'A value is required' });

      const exists = await pool.query('SELECT 1 FROM discount_codes WHERE UPPER(code) = $1', [clean]);
      if (exists.rows.length) return json(409, { error: 'That code already exists.' });

      const id = newId();
      await pool.query(
        'INSERT INTO discount_codes (id, code, kind, value, max_uses, used_count, active) VALUES ($1,$2,$3,$4,$5,0,TRUE)',
        [id, clean, kind === 'amount' ? 'amount' : 'percent', parseFloat(value), parseInt(maxUses, 10) || 0]
      );
      return json(201, { id, code: clean });
    }

    if (event.httpMethod === 'PATCH'){
      if (!isAdmin(event)) return json(401, { error: 'Admin login required' });
      const { id, active } = JSON.parse(event.body || '{}');
      if (!id) return json(400, { error: 'id is required' });
      await pool.query('UPDATE discount_codes SET active = $1 WHERE id = $2', [!!active, id]);
      return json(200, { ok: true });
    }

    if (event.httpMethod === 'DELETE'){
      if (!isAdmin(event)) return json(401, { error: 'Admin login required' });
      const { id } = JSON.parse(event.body || '{}');
      if (!id) return json(400, { error: 'id is required' });
      await pool.query('DELETE FROM discount_codes WHERE id = $1', [id]);
      return json(200, { ok: true });
    }

    return json(405, { error: 'Method not allowed' });
  } catch (err) {
    console.error(err);
    return json(500, { error: err.message });
  }
};

exports.lookupCode = lookupCode;
exports.discountAmount = discountAmount;
