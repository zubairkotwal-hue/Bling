const { getPool, json } = require('./_utils');

// One-time fix for products added BEFORE the picture update.
// Their photos are still in the database, but the new `has_image` flag
// defaulted to false, so the shop never asked for them.
// Visit this function's URL once, then delete this file.
exports.handler = async () => {
  const pool = getPool();
  try {
    const result = await pool.query(
      `UPDATE products
          SET has_image = TRUE
        WHERE (has_image IS NULL OR has_image = FALSE)
          AND image IS NOT NULL
          AND image <> ''
        RETURNING id, name`
    );
    return json(200, {
      ok: true,
      message: result.rows.length
        ? 'Fixed. Their pictures will show again. You can delete this file now.'
        : 'Nothing needed fixing.',
      fixed: result.rows.map(r => r.name),
    });
  } catch (err) {
    console.error(err);
    return json(500, { ok: false, error: err.message });
  }
};
