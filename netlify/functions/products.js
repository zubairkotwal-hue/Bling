const { getPool, json, isAdmin, newId } = require('./_utils');

// Pictures are deliberately NOT included in this list. They're stored in
// product_images and fetched one at a time by the image function, which
// lets the browser cache them. Sending every picture with every list
// request is what makes a shop crawl once it has more than a few items.
const BASE_FIELDS = `id, name, price, size_type, sizes, description,
  stock_status, order_sizes, category, colours, product_type, has_image, created_at`;

// image_version is added by migrate.js. Between deploying this file and
// visiting the migrate URL the column does not exist yet, and asking for a
// column Postgres doesn't have fails the whole query — which took the shop
// down. So check once whether it's there and work either way. Deploy order
// stops mattering, and it starts being used on its own once migrate has run.
let hasImageVersion = null;
let checkedAt = 0;

async function imageVersionReady(pool){
  const now = Date.now();
  if (hasImageVersion !== null && now - checkedAt < 60000) return hasImageVersion;
  try {
    const r = await pool.query(
      `SELECT 1 FROM information_schema.columns
        WHERE table_name = 'products' AND column_name = 'image_version' LIMIT 1`
    );
    hasImageVersion = r.rows.length > 0;
  } catch (e) {
    hasImageVersion = false;
  }
  checkedAt = now;
  return hasImageVersion;
}

// image_count is added by the same migration as position on product_images.
let hasImageCount = null;
let countCheckedAt = 0;
async function imageCountReady(pool){
  const now = Date.now();
  if (hasImageCount !== null && now - countCheckedAt < 60000) return hasImageCount;
  try {
    const r = await pool.query(
      `SELECT 1 FROM information_schema.columns
        WHERE table_name = 'products' AND column_name = 'image_count' LIMIT 1`
    );
    hasImageCount = r.rows.length > 0;
  } catch (e) {
    hasImageCount = false;
  }
  countCheckedAt = now;
  return hasImageCount;
}

async function productFields(pool){
  let f = (await imageVersionReady(pool)) ? `${BASE_FIELDS}, image_version` : BASE_FIELDS;
  if (await imageCountReady(pool)) f += ', image_count';
  return f;
}

// Returns the new image_version, or false if nothing was saved. The version
// goes into the picture's URL: image.js caches for a year, so without it a
// replaced photo would keep showing the old one.
const MAX_PICTURES = 4;

// Accepts either one picture ({thumb, full}) or several ([{thumb, full}, ...]),
// so older callers keep working. Each picture is stored as a thumb row and a
// full row sharing a position; position 0 is the main one.
// Returns { version, count } or false if nothing was saved.
async function saveImages(pool, productId, images){
  if (!images) return false;
  const list = (Array.isArray(images) ? images : [images])
    .filter(im => im && (im.thumb || im.full))
    .slice(0, MAX_PICTURES);
  if (!list.length) return false;

  const positioned = await positionReady(pool);
  await pool.query('DELETE FROM product_images WHERE product_id = $1', [productId]);

  for (let i = 0; i < list.length; i++){
    for (const kind of ['thumb', 'full']){
      if (!list[i][kind]) continue;
      if (positioned){
        await pool.query(
          'INSERT INTO product_images (id, product_id, kind, data, position) VALUES ($1,$2,$3,$4,$5)',
          [newId(), productId, kind, list[i][kind], i]
        );
      } else if (i === 0){
        // Before the migration there is nowhere to put the extra pictures, so
        // only the main one is kept rather than writing rows that collide.
        await pool.query(
          'INSERT INTO product_images (id, product_id, kind, data) VALUES ($1,$2,$3,$4)',
          [newId(), productId, kind, list[i][kind]]
        );
      }
    }
  }
  return { version: newId(), count: positioned ? list.length : 1 };
}

let hasPosition = null;
let posCheckedAt = 0;
async function positionReady(pool){
  const now = Date.now();
  if (hasPosition !== null && now - posCheckedAt < 60000) return hasPosition;
  try {
    const r = await pool.query(
      `SELECT 1 FROM information_schema.columns
        WHERE table_name = 'product_images' AND column_name = 'position' LIMIT 1`
    );
    hasPosition = r.rows.length > 0;
  } catch (e) {
    hasPosition = false;
  }
  posCheckedAt = now;
  return hasPosition;
}

exports.handler = async (event) => {
  const pool = getPool();
  const admin = isAdmin(event);

  try {
    if (event.httpMethod === 'GET'){
      const fields = await productFields(pool);
      const result = await pool.query(`SELECT ${fields} FROM products ORDER BY created_at DESC`);
      return json(200, result.rows);
    }

    if (event.httpMethod === 'POST'){
      if (!admin) return json(401, { error: 'Admin login required' });
      const { name, price, images, sizeType, sizes, description,
              stockStatus, orderSizes, category, colours, productType } = JSON.parse(event.body || '{}');
      if (!name || !price) return json(400, { error: 'name and price are required' });

      const id = newId();
      const hasImage = !!(images && (images.thumb || images.full));
      const saved = await saveImages(pool, id, images);
      const version = saved ? saved.version : null;
      const withVersion = await imageVersionReady(pool);

      const cols = ['id','name','price','size_type','sizes','description',
        'stock_status','order_sizes','category','colours','product_type','has_image'];
      const vals = [id, name, price, sizeType || 'freesize', JSON.stringify(sizes || []),
        description || null, stockStatus || 'in_stock', JSON.stringify(orderSizes || []),
        category || null, JSON.stringify(colours || []), productType || 'item', hasImage];
      if (withVersion){ cols.push('image_version'); vals.push(version || null); }
      if (await imageCountReady(pool)){ cols.push('image_count'); vals.push(saved ? saved.count : 0); }

      await pool.query(
        `INSERT INTO products (${cols.join(', ')})
         VALUES (${vals.map((_, i) => '$' + (i + 1)).join(',')})`,
        vals
      );
      return json(201, { id, imageVersion: version || null, images: saved ? saved.count : 0 });
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
      // images may be one object or an array of up to 4.
      const anyPicture = Array.isArray(images)
        ? images.some(im => im && (im.thumb || im.full))
        : !!(images && (images.thumb || images.full));
      if (anyPicture){
        const saved = await saveImages(pool, id, images);
        values.push(true); sets.push(`has_image = $${values.length}`);
        if (await imageVersionReady(pool)){
          values.push(saved ? saved.version : null); sets.push(`image_version = $${values.length}`);
        }
        if (await imageCountReady(pool)){
          values.push(saved ? saved.count : 1); sets.push(`image_count = $${values.length}`);
        }
      }

      if (!sets.length) return json(400, { error: 'nothing to update' });

      const result = await pool.query(
        `UPDATE products SET ${sets.join(', ')} WHERE id = $1 RETURNING ${await productFields(pool)}`,
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
