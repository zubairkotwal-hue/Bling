const { getPool, json, isAdmin, newId } = require('./_utils');

// Pictures are deliberately NOT included in this list. They're stored in
// product_images and fetched one at a time by the image function, which
// lets the browser cache them. Sending every picture with every list
// request is what makes a shop crawl once it has more than a few items.
const PRODUCT_FIELDS = `id, name, price, size_type, sizes, description,
  stock_status, order_sizes, category, colours, product_type, has_image,
  image_version, created_at`;

// Returns the new image_version, or false if nothing was saved. The version
// goes into the picture's URL: image.js caches for a year, so without it a
// replaced photo would keep showing the old one.
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
  return newId();
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
      const version = await saveImages(pool, id, images);
      await pool.query(
        `INSERT INTO products (id, name, price, size_type, sizes, description,
           stock_status, order_sizes, category, colours, product_type, has_image, image_version)
         VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13)`,
        [id, name, price, sizeType || 'freesize', JSON.stringify(sizes || []), description || null,
         stockStatus || 'in_stock', JSON.stringify(orderSizes || []), category || null,
         JSON.stringify(colours || []), productType || 'item', hasImage, version || null]
      );
      return json(201, { id, imageVersion: version || null });
    }

    if (event.httpMethod === 'PATCH'){
      if (!admin) return json(401, { error: 'Admin login required' });
      const body = JSON.parse(event.body || '{}');
      const { id, images } = body;
      if (!id) return json(400, { error: 'id is required' });

      // Only fields actually present in the request are written. The previous
      // version used COALESCE, which read an empty string as "leave it alone" —
      // that made it impossible to clear a description once one had been set.
      const columns = {
        name: v => v,
        price: v => v,
        sizeType: v => v,
        sizes: v => JSON.stringify(Array.isArray(v) ? v : []),
        description: v => (v === '' ? null : v),
        stockStatus: v => v,
        orderSizes: v => JSON.stringify(Array.isArray(v) ? v : []),
        category: v => v,
        colours: v => JSON.stringify(Array.isArray(v) ? v : []),
        productType: v => v,
      };
      const dbName = {
        name: 'name', price: 'price', sizeType: 'size_type', sizes: 'sizes',
        description: 'description', stockStatus: 'stock_status',
        orderSizes: 'order_sizes', category: 'category', colours: 'colours',
        productType: 'product_type',
      };

      const sets = [], values = [id];
      for (const key of Object.keys(columns)){
        if (!Object.prototype.hasOwnProperty.call(body, key)) continue;
        values.push(columns[key](body[key]));
        sets.push(`${dbName[key]} = $${values.length}`);
      }

      // A new picture is optional when editing — leaving it off keeps the
      // existing one.
      if (images && (images.thumb || images.full)){
        const version = await saveImages(pool, id, images);
        values.push(true);       sets.push(`has_image = $${values.length}`);
        values.push(version);    sets.push(`image_version = $${values.length}`);
      }

      if (!sets.length) return json(400, { error: 'nothing to update' });

      const result = await pool.query(
        `UPDATE products SET ${sets.join(', ')} WHERE id = $1 RETURNING ${PRODUCT_FIELDS}`,
        values
      );
      if (!result.rows.length) return json(404, { error: 'product not found' });
      return json(200, { ok: true, product: result.rows[0] });
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
