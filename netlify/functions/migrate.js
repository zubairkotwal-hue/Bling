const { getPool, json } = require('./_utils');

// One-time database update. Safe to run more than once — everything here is
// IF NOT EXISTS. Visit this function's URL in your browser, then delete this file.
//
// This creates help_messages, gift_cards, discount_codes, reviews,
// product_images and settings, and adds the extra products/leads/stories
// columns. If any of those are missing, the matching feature fails with a
// 500 — the help form and story submissions are the usual symptoms.
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
      ALTER TABLE products ADD COLUMN IF NOT EXISTS has_image BOOLEAN DEFAULT FALSE;
      ALTER TABLE products ADD COLUMN IF NOT EXISTS image_version TEXT;
      -- When a story card was made. Left empty for stories posted before this
      -- ran: guessing dates from submission times would put invented data on
      -- the dashboard, so the record simply starts from here.
      ALTER TABLE stories ADD COLUMN IF NOT EXISTS posted_at TIMESTAMPTZ;
      UPDATE products SET image_version = '1' WHERE image_version IS NULL;

      ALTER TABLE leads ADD COLUMN IF NOT EXISTS size TEXT;
      ALTER TABLE leads ADD COLUMN IF NOT EXISTS items TEXT;
      ALTER TABLE leads ADD COLUMN IF NOT EXISTS total TEXT;
      ALTER TABLE leads ADD COLUMN IF NOT EXISTS shipping TEXT;
      ALTER TABLE leads ADD COLUMN IF NOT EXISTS subtotal TEXT;
      ALTER TABLE leads ADD COLUMN IF NOT EXISTS lead_time TEXT;

      -- Pseudonyms and archiving
      ALTER TABLE stories ADD COLUMN IF NOT EXISTS pseudonym TEXT;
      ALTER TABLE stories ADD COLUMN IF NOT EXISTS archived_at TIMESTAMPTZ;
      ALTER TABLE replies ADD COLUMN IF NOT EXISTS pseudonym TEXT;
      ALTER TABLE replies ADD COLUMN IF NOT EXISTS archived_at TIMESTAMPTZ;

      CREATE TABLE IF NOT EXISTS product_images (
        id         TEXT PRIMARY KEY,
        product_id TEXT NOT NULL,
        kind       TEXT NOT NULL,
        data       TEXT NOT NULL,
        created_at TIMESTAMPTZ NOT NULL DEFAULT now()
      );
      CREATE INDEX IF NOT EXISTS idx_pimg ON product_images(product_id, kind);

      -- Product reviews
      CREATE TABLE IF NOT EXISTS reviews (
        id          TEXT PRIMARY KEY,
        product_id  TEXT NOT NULL,
        rating      INTEGER NOT NULL DEFAULT 5,
        text        TEXT,
        pseudonym   TEXT,
        status      TEXT NOT NULL DEFAULT 'pending',
        created_at  TIMESTAMPTZ NOT NULL DEFAULT now()
      );
      CREATE INDEX IF NOT EXISTS idx_reviews_product ON reviews(product_id, status);

      -- Help / contact messages
      CREATE TABLE IF NOT EXISTS help_messages (
        id          TEXT PRIMARY KEY,
        name        TEXT,
        phone       TEXT,
        message     TEXT NOT NULL,
        status      TEXT NOT NULL DEFAULT 'new',
        created_at  TIMESTAMPTZ NOT NULL DEFAULT now()
      );

      -- Gift cards
      CREATE TABLE IF NOT EXISTS gift_cards (
        id          TEXT PRIMARY KEY,
        code        TEXT,
        purchaser   TEXT NOT NULL,
        recipient   TEXT NOT NULL,
        amount      TEXT NOT NULL,
        note        TEXT,
        phone       TEXT,
        status      TEXT NOT NULL DEFAULT 'Enquired',
        created_at  TIMESTAMPTZ NOT NULL DEFAULT now()
      );

      -- Discount codes
      CREATE TABLE IF NOT EXISTS discount_codes (
        id          TEXT PRIMARY KEY,
        code        TEXT UNIQUE NOT NULL,
        kind        TEXT NOT NULL DEFAULT 'percent',
        value       NUMERIC NOT NULL,
        max_uses    INTEGER NOT NULL DEFAULT 0,
        used_count  INTEGER NOT NULL DEFAULT 0,
        active      BOOLEAN NOT NULL DEFAULT TRUE,
        created_at  TIMESTAMPTZ NOT NULL DEFAULT now()
      );
      ALTER TABLE leads ADD COLUMN IF NOT EXISTS discount_code TEXT;
      ALTER TABLE leads ADD COLUMN IF NOT EXISTS discount_amount TEXT;

      CREATE TABLE IF NOT EXISTS settings (
        key   TEXT PRIMARY KEY,
        value TEXT
      );
    `);
    const cols = await pool.query(`
      SELECT table_name, column_name FROM information_schema.columns
      WHERE table_name IN ('products','leads','stories','replies') ORDER BY table_name, column_name
    `);
    // Listing the tables makes a missing one obvious at a glance — that is what
    // breaks the help form and story submissions.
    const tabs = await pool.query(`
      SELECT table_name FROM information_schema.tables
      WHERE table_schema = 'public' ORDER BY table_name
    `);
    return json(200, {
      ok: true,
      message: 'Success! Database updated. You can delete this file now.',
      tables: tabs.rows.map(r => r.table_name),
      columns: cols.rows.map(r => r.table_name + '.' + r.column_name),
    });
  } catch (err) {
    console.error(err);
    return json(500, { ok: false, error: err.message });
  }
};
