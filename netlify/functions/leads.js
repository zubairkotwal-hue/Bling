const { getPool, json, isAdmin, newId } = require('./_utils');
const { lookupCode, discountAmount } = require('./discounts');

exports.handler = async (event, context) => {
  const pool = getPool();
  const admin = isAdmin(event);

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
      const { buyer, phone, item, price, deliveryMethod, address, size, items, total, shipping, subtotal, leadTime, discountCode } = JSON.parse(event.body || '{}');
      if (!buyer) return json(400, { error: 'buyer is required' });
      if (!item && !(Array.isArray(items) && items.length)) return json(400, { error: 'at least one item is required' });

      // A basket order arrives as `items`. We also store a short readable
      // summary in `item` so older screens and messages still make sense.
      const basket = Array.isArray(items) ? items : [];
      const summary = item || (basket.length === 1
        ? basket[0].name + (basket[0].size ? ' (' + basket[0].size + ')' : '')
        : basket.length + ' items');
      // Re-check any discount code HERE. Whatever the browser claims the
      // total is, the code has to be real, active and still have uses left.
      let appliedCode = null;
      let appliedAmount = 0;
      if (discountCode){
        const res = await lookupCode(pool, discountCode);
        if (res.ok){
          appliedCode = res.discount.code;
          appliedAmount = discountAmount(res.discount, parseFloat(subtotal) || 0);
          // Count the use straight away, and only if it is still within the
          // limit — so the 11th person cannot slip through on a code capped at 10.
          const upd = await pool.query(
            `UPDATE discount_codes SET used_count = used_count + 1
              WHERE id = $1 AND active = TRUE AND (max_uses = 0 OR used_count < max_uses)
              RETURNING used_count`,
            [res.discount.id]
          );
          if (!upd.rows.length){ appliedCode = null; appliedAmount = 0; }
        }
      }

      const id = newId();
      await pool.query(
        'INSERT INTO leads (id, buyer, phone, item, price, delivery_method, address, status, size, items, total, shipping, subtotal, lead_time, discount_code, discount_amount) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16)',
        [id, buyer, phone || null, summary, price || null, deliveryMethod || 'Collection', address || null, 'Enquired', size || null, basket.length ? JSON.stringify(basket) : null, total || null, shipping || null, subtotal || null, leadTime || null, appliedCode, appliedAmount ? String(appliedAmount) : null]
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
