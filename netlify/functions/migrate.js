const { getPool, json } = require('./_utils');

// One-time database update. Safe to run more than once.
// Visit this function's URL in your browser, then delete this file.
//
// Adds image_version to products. Pictures are served by image.js with a
// one-year "immutable" cache header, keyed on the product id. That was fine
// while a picture could only ever be uploaded once. Now that a product can be
// edited, replacing its photo keeps the same product id, so the browser would
// keep showing the old picture — possibly for a year. image_version changes
// every time a picture is replaced and goes into the image URL, which makes
// the browser treat it as a new file.
exports.handler = async () => {
  const pool = getPool();
  try {
    await pool.query(`
      ALTER TABLE products ADD COLUMN IF NOT EXISTS image_version TEXT;

      -- Existing products keep their cached picture: give them a fixed
      -- starting version rather than a new one, so nothing is re-downloaded.
      UPDATE products SET image_version = '1' WHERE image_version IS NULL;
    `);
    return json(200, { ok: true, added: 'products.image_version' });
  } catch (err) {
    console.error(err);
    return json(500, { ok: false, error: err.message });
  }
};
