const { getPool, json } = require('./_utils');

// One-time database update. Safe to run more than once — everything here is
// IF NOT EXISTS. Visit this function's URL in your browser, then delete this file.
//
// This creates help_messages, gift_cards, discount_codes, reviews,
// product_images, settings, customers, customer_push_subscriptions,
// broadcasts, visits and view_counts, and adds the extra products/leads/stories columns. If any of those are missing, the matching feature fails with a
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

      -- Up to 4 pictures per product. Each picture is two rows (thumb + full)
      -- sharing a position; position 0 is the main one shown in the grid.
      -- Existing single pictures become position 0, so nothing is disturbed.
      -- Admin push notifications: one row per device she signs up on.
      CREATE TABLE IF NOT EXISTS push_subscriptions (
        id TEXT PRIMARY KEY,
        endpoint TEXT NOT NULL UNIQUE,
        p256dh TEXT NOT NULL,
        auth TEXT NOT NULL,
        created_at TIMESTAMPTZ DEFAULT NOW()
      );

      ALTER TABLE products ADD COLUMN IF NOT EXISTS image_count INTEGER DEFAULT 1;
      UPDATE products SET image_count = 1 WHERE image_count IS NULL;
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
      -- These two used to sit above the statement that creates this table. That worked on the live
      -- database, where the table already existed, but failed on a blank one.
      ALTER TABLE product_images ADD COLUMN IF NOT EXISTS position INTEGER DEFAULT 0;
      UPDATE product_images SET position = 0 WHERE position IS NULL;

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

      -- Email address on every order.
      ALTER TABLE leads ADD COLUMN IF NOT EXISTS email TEXT;

      -- The customer list. One row per email address, kept even after the
      -- order itself is archived or deleted. marketing_ok records whether
      -- they left the "email me offers" box ticked at checkout.
      CREATE TABLE IF NOT EXISTS customers (
        id             TEXT PRIMARY KEY,
        email          TEXT NOT NULL UNIQUE,
        name           TEXT,
        phone          TEXT,
        marketing_ok   BOOLEAN NOT NULL DEFAULT FALSE,
        orders         INTEGER NOT NULL DEFAULT 0,
        first_order_at TIMESTAMPTZ NOT NULL DEFAULT now(),
        last_order_at  TIMESTAMPTZ NOT NULL DEFAULT now()
      );

      -- Customers who asked for offer notifications. Deliberately a separate
      -- table from push_subscriptions: that one receives "New order" alerts
      -- with a buyer's name in them, and must only ever hold admin devices.
      CREATE TABLE IF NOT EXISTS customer_push_subscriptions (
        id         TEXT PRIMARY KEY,
        endpoint   TEXT NOT NULL UNIQUE,
        p256dh     TEXT NOT NULL,
        auth       TEXT NOT NULL,
        created_at TIMESTAMPTZ DEFAULT NOW()
      );

      -- A record of every offer sent, so the admin can see what went out.
      CREATE TABLE IF NOT EXISTS broadcasts (
        id         TEXT PRIMARY KEY,
        title      TEXT NOT NULL,
        body       TEXT NOT NULL,
        url        TEXT,
        audience   INTEGER NOT NULL DEFAULT 0,
        sent       INTEGER NOT NULL DEFAULT 0,
        failed     INTEGER NOT NULL DEFAULT 0,
        removed    INTEGER NOT NULL DEFAULT 0,
        finished   BOOLEAN NOT NULL DEFAULT FALSE,
        created_at TIMESTAMPTZ NOT NULL DEFAULT now()
      );

      -- Anonymous visit counts for the Analytics tab. One row per browser per
      -- day: a random id the browser made up, and yes/no flags for what was
      -- done. No IP address, name, phone or order is ever attached.
      CREATE TABLE IF NOT EXISTS visits (
        day              DATE NOT NULL,
        visitor          TEXT NOT NULL,
        is_new           BOOLEAN NOT NULL DEFAULT FALSE,
        views            INTEGER NOT NULL DEFAULT 0,
        saw_stories      BOOLEAN NOT NULL DEFAULT FALSE,
        saw_shop         BOOLEAN NOT NULL DEFAULT FALSE,
        saw_product      BOOLEAN NOT NULL DEFAULT FALSE,
        added_cart       BOOLEAN NOT NULL DEFAULT FALSE,
        started_checkout BOOLEAN NOT NULL DEFAULT FALSE,
        ordered          BOOLEAN NOT NULL DEFAULT FALSE,
        replied          BOOLEAN NOT NULL DEFAULT FALSE,
        submitted        BOOLEAN NOT NULL DEFAULT FALSE,
        source           TEXT,
        device           TEXT,
        installed        BOOLEAN NOT NULL DEFAULT FALSE,
        first_at         TIMESTAMPTZ NOT NULL DEFAULT now(),
        PRIMARY KEY (day, visitor)
      );

      -- How often each product and story was opened, per day. Plain tallies:
      -- there is no visitor id here, so nobody's reading history exists.
      CREATE TABLE IF NOT EXISTS view_counts (
        day  DATE NOT NULL,
        kind TEXT NOT NULL,
        ref  TEXT NOT NULL,
        n    INTEGER NOT NULL DEFAULT 0,
        PRIMARY KEY (day, kind, ref)
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
