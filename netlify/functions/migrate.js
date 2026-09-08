const { getPool, json } = require('./_utils');

// One-time database update. Safe to run more than once.
// Visit this function's URL, then delete this file.
exports.handler = async () => {
  const pool = getPool();
  try {
    await pool.query(`
      -- several photos per product, kept in order
      ALTER TABLE product_images ADD COLUMN IF NOT EXISTS position INTEGER DEFAULT 0;
      CREATE INDEX IF NOT EXISTS idx_pimg_pos ON product_images(product_id, position, kind);
      ALTER TABLE products ADD COLUMN IF NOT EXISTS image_count INTEGER DEFAULT 0;
    `);

    // Existing single photos become photo number 1.
    await pool.query(`UPDATE product_images SET position = 0 WHERE position IS NULL`);
    await pool.query(`
      UPDATE products p
         SET image_count = COALESCE((
           SELECT COUNT(DISTINCT position) FROM product_images i WHERE i.product_id = p.id
         ), 0)
    `);
    await pool.query(`UPDATE products SET has_image = TRUE WHERE image_count > 0`);

    const cols = await pool.query(`
      SELECT table_name, column_name FROM information_schema.columns
      WHERE table_name IN ('products','product_images') ORDER BY table_name, column_name
    `);
    return json(200, {
      ok: true,
      message: 'Success! Products can now have several photos. You can delete this file.',
      columns: cols.rows.map(r => r.table_name + '.' + r.column_name),
    });
  } catch (err) {
    console.error(err);
    return json(500, { ok: false, error: err.message });
  }
};
