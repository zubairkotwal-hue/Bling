const { getPool, json, isAdmin, newId } = require('./_utils');

// Pictures are deliberately NOT included in this list. They're stored in
// product_images and fetched one at a time by the image function, which
// lets the browser cache them. Sending every picture with every list
// request is what makes a shop crawl once it has more than a few items.
const PRODUCT_FIELDS = `id, name, price, size_type, sizes, description,
  stock_status, order_sizes, category, colours, product_type, has_image, created_at`;

async function saveImages(pool, productId, images){
  if (!images) return false;
  const entries = [];
  if (images.thumb) entries.push(['thumb', images.thumb]);
  if (images.full) entries.push(['full', images.full]);
  if (!entries.length) return false;

  await pool.query('DELETE FROM product_images WHERE product_id = $1', [productId]);
  for (const [kind, data] of entries){
    await pool.query(
      'INSERT INTO product_images (id, product_id, kind, data) VALUES ($1,$2,$3,$4)',
      [newId(), productId, kind, data]
    );
  }
  return true;
}

exports.handler = async (event) => {
  const pool = getPool();
  const admin = isAdmin(event);

  try {
    if (event.httpMethod === 'GET'){
      const result = await pool.query(`SELECT ${PRODUCT_FIELDS} FROM products ORDER BY created_at DESC`);
      return json(200, result.rows);
    }

    if (event.httpMethod === 'POST'){
      if (!admin) return json(401, { error: 'Admin login required' });
      const { name, price, images, sizeType, sizes, description,
              stockStatus, orderSizes, category, colours, productType } = JSON.parse(event.body || '{}');
      if (!name || !price) return json(400, { error: 'name and price are required' });

      const id = newId();
      const hasImage = !!(images && (images.thumb || images.full));
      await pool.query(
        `INSERT INTO products (id, name, price, size_type, sizes, description,
           stock_status, order_sizes, category, colours, product_type, has_image)
         VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12)`,
        [id, name, price, sizeType || 'freesize', JSON.stringify(sizes || []), description || null,
         stockStatus || 'in_stock', JSON.stringify(orderSizes || []), category || null,
         JSON.stringify(colours || []), productType || 'item', hasImage]
      );
      await saveImages(pool, id, images);
      return json(201, { id });
    }

    if (event.httpMethod === 'PATCH'){
      if (!admin) return json(401, { error: 'Admin login required' });
      const { id, name, price, images, sizeType, sizes, description,
              stockStatus, orderSizes, category, colours, productType } = JSON.parse(event.body || '{}');
      if (!id) return json(400, { error: 'id is required' });

      await pool.query(
        `UPDATE products SET
           name = COALESCE($2, name),
           price = COALESCE($3, price),
           size_type = COALESCE($4, size_type),
           sizes = COALESCE($5, sizes),
           description = COALESCE($6, description),
           stock_status = COALESCE($7, stock_status),
           order_sizes = COALESCE($8, order_sizes),
           category = COALESCE($9, category),
           colours = COALESCE($10, colours),
           product_type = COALESCE($11, product_type)
         WHERE id = $1`,
        [id, name || null, price || null, sizeType || null,
         sizes ? JSON.stringify(sizes) : null, description || null,
         stockStatus || null, orderSizes ? JSON.stringify(orderSizes) : null,
         category || null, colours ? JSON.stringify(colours) : null, productType || null]
      );

      if (images && (images.thumb || images.full)){
        await saveImages(pool, id, images);
        await pool.query('UPDATE products SET has_image = TRUE WHERE id = $1', [id]);
      }
      return json(200, { ok: true });
    }

    if (event.httpMethod === 'DELETE'){
      if (!admin) return json(401, { error: 'Admin login required' });
      const { id } = JSON.parse(event.body || '{}');
      if (!id) return json(400, { error: 'id is required' });
      await pool.query('DELETE FROM product_images WHERE product_id = $1', [id]);
      await pool.query('DELETE FROM products WHERE id = $1', [id]);
      return json(200, { ok: true });
    }

    return json(405, { error: 'Method not allowed' });
  } catch (err) {
    console.error(err);
    return json(500, { error: err.message });
  }
};
