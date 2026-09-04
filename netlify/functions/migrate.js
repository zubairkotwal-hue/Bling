const { getPool, json } = require('./_utils');

// One-time database update. Safe to run more than once — every statement
// uses IF NOT EXISTS. Visit this function's URL in your browser, then
// delete this file.
exports.handler = async () => {
  const pool = getPool();
  try {
    await pool.query(`
      ALTER TABLE products ADD COLUMN IF NOT EXISTS size_type TEXT DEFAULT 'freesize';
      ALTER TABLE products ADD COLUMN IF NOT EXISTS sizes TEXT DEFAULT '[]';
      ALTER TABLE products ADD COLUMN IF NOT EXISTS description TEXT;
      ALTER TABLE leads ADD COLUMN IF NOT EXISTS size TEXT;
      ALTER TABLE leads ADD COLUMN IF NOT EXISTS items TEXT;
      ALTER TABLE leads ADD COLUMN IF NOT EXISTS total TEXT;
    `);
    const cols = await pool.query(`
      SELECT table_name, column_name FROM information_schema.columns
      WHERE table_name IN ('products','leads') ORDER BY table_name, column_name
    `);
    return json(200, {
      ok: true,
      message: 'Success! Database updated. You can delete this file now.',
      columns: cols.rows.map(r => r.table_name + '.' + r.column_name),
    });
  } catch (err) {
    console.error(err);
    return json(500, { ok: false, error: err.message });
  }
};
