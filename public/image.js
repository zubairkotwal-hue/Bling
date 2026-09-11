const { getPool } = require('./_utils');

// Serves a product picture as a real image file, with caching, so the
// browser only downloads each one once. Keeping pictures out of the
// product list is what stops the shop getting slow as the catalogue grows.
exports.handler = async (event) => {
  const pool = getPool();
  const id = (event.queryStringParameters || {}).id;
  const kind = ((event.queryStringParameters || {}).size === 'full') ? 'full' : 'thumb';
  const rawIndex = parseInt((event.queryStringParameters || {}).i, 10);
  const index = (isNaN(rawIndex) || rawIndex < 0 || rawIndex > 3) ? 0 : rawIndex;

  if (!id) return { statusCode: 400, body: 'missing id' };

  try {
    // Products can have up to 4 pictures; ?i= picks which one. The position
    // column arrives with a migration, so fall back to the un-positioned query
    // if it is not there yet — otherwise the whole query fails and no picture
    // loads at all.
    let result;
    try {
      result = await pool.query(
        'SELECT data FROM product_images WHERE product_id = $1 AND kind = $2 AND COALESCE(position, 0) = $3 LIMIT 1',
        [id, kind, index]
      );
    } catch (e) {
      if (index > 0) return { statusCode: 404, body: 'not found' };
      result = await pool.query(
        'SELECT data FROM product_images WHERE product_id = $1 AND kind = $2 LIMIT 1',
        [id, kind]
      );
    }

    // Only the main picture falls back. Asking for picture 3 must not quietly
    // return picture 1 — the gallery would show duplicates.
    if (!result.rows.length && index > 0) return { statusCode: 404, body: 'not found' };

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
