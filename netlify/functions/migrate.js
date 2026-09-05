const { getPool, json } = require('./_utils');

// One-time database update. Safe to run more than once.
// Visit this function's URL in your browser, then delete this file.
exports.handler = async () => {
  const pool = getPool();
  try {
    await pool.query(`
      ALTER TABLE products ADD COLUMN IF NOT EXISTS size_type TEXT DEFAULT 'freesize';
      ALTER TABLE products ADD COLUMN IF NOT EXISTS sizes TEXT DEFAULT '[]';
      ALTER TABLE products ADD COLUMN IF NOT EXISTS description TEXT;
      ALTER TABLE products ADD COLUMN IF NOT EXISTS stock_status TEXT DEFAULT 'in_stock';
      ALTER TABLE products ADD COLUMN IF NOT EXISTS order_sizes TEXT DEFAULT '[]';
      ALTER TABLE products ADD COLUMN IF NOT EXISTS category TEXT;
      ALTER TABLE products ADD COLUMN IF NOT EXISTS colours TEXT DEFAULT '[]';
      ALTER TABLE products ADD COLUMN IF NOT EXISTS product_type TEXT DEFAULT 'item';
      ALTER TABLE products ADD COLUMN IF NOT EXISTS category TEXT;
      ALTER TABLE products ADD COLUMN IF NOT EXISTS colours TEXT DEFAULT '[]';
      ALTER TABLE products ADD COLUMN IF NOT EXISTS is_voucher BOOLEAN DEFAULT FALSE;
      ALTER TABLE leads ADD COLUMN IF NOT EXISTS lead_time TEXT;
      ALTER TABLE leads ADD COLUMN IF NOT EXISTS size TEXT;
      ALTER TABLE leads ADD COLUMN IF NOT EXISTS items TEXT;
      ALTER TABLE leads ADD COLUMN IF NOT EXISTS total TEXT;
      ALTER TABLE leads ADD COLUMN IF NOT EXISTS shipping TEXT;
      ALTER TABLE leads ADD COLUMN IF NOT EXISTS subtotal TEXT;
      CREATE TABLE IF NOT EXISTS product_images (
        id         TEXT PRIMARY KEY,
        product_id TEXT NOT NULL,
        kind       TEXT NOT NULL,
        data       TEXT NOT NULL,
        created_at TIMESTAMPTZ NOT NULL DEFAULT now()
      );
      CREATE INDEX IF NOT EXISTS idx_pimg ON product_images(product_id, kind);
      ALTER TABLE products ADD COLUMN IF NOT EXISTS has_image BOOLEAN DEFAULT FALSE;

      CREATE TABLE IF NOT EXISTS settings (
        key   TEXT PRIMARY KEY,
        value TEXT
      );
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
