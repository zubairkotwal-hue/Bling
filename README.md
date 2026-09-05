# Bling Happiness — update: picture handling (do this before importing products)

## STEP 1 — update on GitHub

  public/index.html                 (replaced)
  netlify/functions/products.js     (replaced)
  netlify/functions/image.js        (NEW)
  netlify/functions/leads.js        (replaced)
  netlify/functions/stories.js      (replaced)
  netlify/functions/replies.js      (replaced)
  netlify/functions/settings.js     (NEW if not already there)
  netlify/functions/migrate.js      (run once, then delete)

## STEP 2 — run the database update ONCE

  https://blinghappiness.netlify.app/.netlify/functions/migrate

Then delete migrate.js.

## Why this update matters

Before: every photo was stored as text inside the product record, and the
shop downloaded EVERY photo, at full phone-camera size, every time
someone opened it. Three products with real photos meant about 18 MB
downloaded on every visit. That is why it would have crawled once the
catalogue grew.

After: 0.9 MB became 0.9 KB for the same three products - the list no
longer carries pictures at all.

Three things changed:

1. Photos are shrunk when uploaded. A 6 MB phone photo becomes a 7 KB
   thumbnail for the grid and a 211 KB version for the product page.

2. Pictures are stored separately and fetched one at a time, with
   caching, so the browser downloads each picture once and remembers it.

3. Grid pictures only load as they scroll into view.

Existing products keep working - old pictures are still found and served.

## What this means for the catalogue

The shop will now stay quick into the hundreds of products, rather than
slowing down after about fifteen. Nothing about how she adds a product
has changed, except that she now sees the picture size after choosing
one.
