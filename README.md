# Bling Happiness — update: logo, product sizes, product detail pages

## STEP 1 — upload the new image files to GitHub

These go in the **public/** folder (GitHub: Add file → Upload files):

- favicon.png       (browser tab icon)
- icon-180.png      (iPhone home-screen icon)
- icon-192.png      (Android home-screen icon)
- icon-512.png      (Android home-screen icon, large)
- mark.png          (cream logo — used as the watermark on generated cards)
- mark-dark.png     (dark logo — used in the site header)
- manifest.webmanifest  (tells phones the name/icon when saved to home screen)

## STEP 2 — update the code files

- public/index.html                       (replaced)
- netlify/functions/products.js           (replaced — sizes, description, editing)
- netlify/functions/leads.js              (updated — records the ordered size)
- netlify/functions/migrate-sizes.js      (NEW — run once, then delete)

## STEP 3 — run the database migration ONCE

After deploying, visit this address in your browser:

    https://blinghappiness.netlify.app/.netlify/functions/migrate-sizes

You should see  "ok": true  and a list of columns. Then DELETE
netlify/functions/migrate-sizes.js from GitHub — it has done its job.

Without this step the shop will error, because the database doesn't yet
have anywhere to store sizes.

## What's new

**Logo** — appears in the site header, as the browser tab icon, as the
home-screen icon when someone saves the site to their phone, and as a
subtle watermark in the bottom-right of every generated card (story
cards, reply round-ups, and order confirmations).

**Product detail pages** — the shop now shows thumbnails. Tapping one
opens a full page with a large picture, description, price and the
available sizes, plus an "Order this" button.

**Sizes** — when adding a product she picks a size type:
  - Clothing (XS–XXL)
  - Bra sizes (30A through 44G — all standard SA band/cup combinations)
  - Free size (one size)
…then taps which sizes are actually in stock. Only those appear to
customers, customers must choose one when ordering, and the chosen size
shows in the Leads list, in the WhatsApp message, and on the order card.
