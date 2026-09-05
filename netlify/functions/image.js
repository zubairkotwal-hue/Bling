const { getPool } = require('./_utils');

// Serves a product picture as a real image file, with caching, so the
// browser only downloads each one once. Keeping pictures out of the
// product list is what stops the shop getting slow as the catalogue grows.
exports.handler = async (event) => {
  const pool = getPool();
  const id = (event.queryStringParameters || {}).id;
  const kind = ((event.queryStringParameters || {}).size === 'full') ? 'full' : 'thumb';

  if (!id) return { statusCode: 400, body: 'missing id' };

  try {
    let result = await pool.query(
      'SELECT data FROM product_images WHERE product_id = $1 AND kind = $2 LIMIT 1',
      [id, kind]
    );

    // Fall back to the other size, then to the older single-image column,
    // so products added before this change still show a picture.
    if (!result.rows.length){
      result = await pool.query(
        'SELECT data FROM product_images WHERE product_id = $1 LIMIT 1', [id]
      );
    }
    if (!result.rows.length){
      const legacy = await pool.query('SELECT image FROM products WHERE id = $1', [id]);
      if (legacy.rows.length && legacy.rows[0].image){
        result = { rows: [{ data: legacy.rows[0].image }] };
      }
    }
    if (!result.rows.length) return { statusCode: 404, body: 'not found' };

    const dataUrl = result.rows[0].data || '';
    const match = /^data:(image\/[a-z+]+);base64,(.*)$/i.exec(dataUrl);
    if (!match) return { statusCode: 404, body: 'not an image' };

    return {
      statusCode: 200,
      headers: {
        'Content-Type': match[1],
        // Pictures never change once uploaded — a new upload gets a new id.
        'Cache-Control': 'public, max-age=31536000, immutable',
      },
      body: match[2],
      isBase64Encoded: true,
    };
  } catch (err) {
    console.error(err);
    return { statusCode: 500, body: 'error' };
  }
};
