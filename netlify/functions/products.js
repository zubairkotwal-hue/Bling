const { getPool, json, isAdmin, newId } = require('./_utils');

exports.handler = async (event) => {
  const pool = getPool();
  const admin = isAdmin(event);

  try {
    // Anyone can browse the shop.
    if (event.httpMethod === 'GET'){
      const result = await pool.query('SELECT * FROM products ORDER BY created_at DESC');
      return json(200, result.rows);
    }

    // Only the logged-in admin can add or remove products.
    if (event.httpMethod === 'POST'){
      if (!admin) return json(401, { error: 'Admin login required' });
      const { name, price, image, sizeType, sizes, description } = JSON.parse(event.body || '{}');
      if (!name || !price) return json(400, { error: 'name and price are required' });
      const id = newId();
      await pool.query(
        'INSERT INTO products (id, name, price, image, size_type, sizes, description) VALUES ($1,$2,$3,$4,$5,$6,$7)',
        [id, name, price, image || null, sizeType || 'freesize', JSON.stringify(sizes || []), description || null]
      );
      return json(201, { id });
    }

    // Edit an existing product.
    if (event.httpMethod === 'PATCH'){
      if (!admin) return json(401, { error: 'Admin login required' });
      const { id, name, price, image, sizeType, sizes, description } = JSON.parse(event.body || '{}');
      if (!id) return json(400, { error: 'id is required' });
      await pool.query(
        `UPDATE products SET
           name = COALESCE($2, name),
           price = COALESCE($3, price),
           image = COALESCE($4, image),
           size_type = COALESCE($5, size_type),
           sizes = COALESCE($6, sizes),
           description = COALESCE($7, description)
         WHERE id = $1`,
        [id, name || null, price || null, image || null, sizeType || null,
         sizes ? JSON.stringify(sizes) : null, description || null]
      );
      return json(200, { ok: true });
    }

    if (event.httpMethod === 'DELETE'){
      if (!admin) return json(401, { error: 'Admin login required' });
      const { id } = JSON.parse(event.body || '{}');
      if (!id) return json(400, { error: 'id is required' });
      await pool.query('DELETE FROM products WHERE id = $1', [id]);
      return json(200, { ok: true });
    }

    return json(405, { error: 'Method not allowed' });
  } catch (err) {
    console.error(err);
    return json(500, { error: err.message });
  }
};
