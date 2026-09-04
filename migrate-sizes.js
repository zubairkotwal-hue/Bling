const { getPool, json } = require('./_utils');

// One-time migration: adds size support to the products table.
// Visit this function's URL once in your browser, then delete this file.
// Safe to run more than once.
exports.handler = async () => {
  const pool = getPool();
  try {
    await pool.query(`
      ALTER TABLE products ADD COLUMN IF NOT EXISTS size_type TEXT DEFAULT 'freesize';
      ALTER TABLE products ADD COLUMN IF NOT EXISTS sizes TEXT DEFAULT '[]';
      ALTER TABLE products ADD COLUMN IF NOT EXISTS description TEXT;
      ALTER TABLE leads ADD COLUMN IF NOT EXISTS size TEXT;
    `);
    const check = await pool.query(`
      SELECT column_name FROM information_schema.columns
      WHERE table_name = 'products' ORDER BY column_name
    `);
    return json(200, {
      ok: true,
      message: 'Success! Products table updated. You can delete this file now.',
      columns: check.rows.map(r => r.column_name),
    });
  } catch (err) {
    console.error(err);
    return json(500, { ok: false, error: err.message });
  }
};
