const { getPool, json } = require('./_utils');

// Visit this function's URL once in your browser (e.g.
// yoursite.netlify.app/.netlify/functions/setup-db) to create the tables.
// Safe to run more than once — every statement says "IF NOT EXISTS".
// Delete this file once you've confirmed it worked.

exports.handler = async (event, context) => {
  const pool = getPool();

  const schema = `
    CREATE TABLE IF NOT EXISTS stories (
      id           TEXT PRIMARY KEY,
      text         TEXT NOT NULL,
      category     TEXT NOT NULL,
      status       TEXT NOT NULL DEFAULT 'pending',
      posted       BOOLEAN NOT NULL DEFAULT FALSE,
      created_at   TIMESTAMPTZ NOT NULL DEFAULT now()
    );

    CREATE TABLE IF NOT EXISTS replies (
      id           TEXT PRIMARY KEY,
      story_id     TEXT NOT NULL REFERENCES stories(id) ON DELETE CASCADE,
      text         TEXT NOT NULL,
      status       TEXT NOT NULL DEFAULT 'pending',
      created_at   TIMESTAMPTZ NOT NULL DEFAULT now()
    );

    CREATE TABLE IF NOT EXISTS products (
      id           TEXT PRIMARY KEY,
      name         TEXT NOT NULL,
      price        TEXT NOT NULL,
      image        TEXT,
      created_at   TIMESTAMPTZ NOT NULL DEFAULT now()
    );

    CREATE TABLE IF NOT EXISTS leads (
      id               TEXT PRIMARY KEY,
      buyer            TEXT NOT NULL,
      phone            TEXT,
      item             TEXT NOT NULL,
      price            TEXT,
      delivery_method  TEXT DEFAULT 'Collection',
      address          TEXT,
      status           TEXT NOT NULL DEFAULT 'Enquired',
      created_at       TIMESTAMPTZ NOT NULL DEFAULT now()
    );

    CREATE INDEX IF NOT EXISTS idx_replies_story_id ON replies(story_id);
    CREATE INDEX IF NOT EXISTS idx_stories_status ON stories(status);
    CREATE INDEX IF NOT EXISTS idx_replies_status ON replies(status);
  `;

  try {
    await pool.query(schema);
    const check = await pool.query(`
      SELECT table_name FROM information_schema.tables
      WHERE table_schema = 'public' ORDER BY table_name
    `);
    return json(200, {
      ok: true,
      message: 'Success! Tables created. You can delete this file now.',
      tables: check.rows.map(r => r.table_name),
    });
  } catch (err) {
    console.error(err);
    return json(500, { ok: false, error: err.message });
  }
};
