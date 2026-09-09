# Deploying this update

Everything in the zip. Nothing here touches the login code — `_utils.js`,
`admin-login.js`, `settings.js`, `discounts.js` and `giftcards.js` are
byte-identical to what is running on the site right now.

---

## Step 1 — add two keys to Netlify (do this FIRST)

Netlify → your site → **Site configuration** → **Environment variables** → **Add a variable**.

Add these two:

| Key | Value |
|---|---|
| `VAPID_PUBLIC_KEY` | `BGHxNRsSS3ALmyB45uOmgrBHjREFiAPRcslGDaEQtoBqWBR-2fz8vYGc_oUeydTlCq3ryHd8ndzJSuJ17EHTlf8` |
| `VAPID_PRIVATE_KEY` | `xRKNOOH93uZkmlCtVF6VqwHrZ5cwb8MqPeJMv1H2Bcc` |

They prove notifications really came from your site — Google will not deliver
them otherwise. Keep the private one secret, like the admin password.

Do this before pushing. If you push first, just hit **Trigger deploy** →
**Clear cache and deploy site** afterwards, or the functions will not see them.

## Step 2 — copy the files in

Unzip over your local project folder, replacing what is there.

## Step 3 — commit and push

GitHub Desktop, as usual. Wait for Netlify to say **Published**.

At this point the site is fully working. Notifications will not arrive yet
because the database table does not exist — everything else is live.

## Step 4 — run the migration once

Open this in a browser:

```
blinghappiness.netlify.app/.netlify/functions/migrate
```

Look for `"ok": true`. This adds the table that remembers which phones want
notifications, plus the columns for multiple product pictures and for recording
when a story card was made.

## Step 5 — delete migrate.js

Delete `netlify/functions/migrate.js`, commit, push again. It rebuilds database
tables and has no password on it, so it must not stay on a live site.

## Step 6 — turn notifications on

Admin → **Settings** → Notifications → **Turn on** → allow the browser popup →
**Send a test**.

Do this on each phone that should get them. Only turn it on for phones that
belong to you or Sabihah: a phone stays subscribed after logging out, and can
only be turned off from that same phone.

---

## Check it worked

- Admin → Shop: every product has its link underneath with a Copy button
- Open a product link in a browser: it opens that product
- Open a story from an Instagram DM, tap the reply box: it scrolls above the keyboard
- Admin → Settings: Notifications section, five types, quiet hours
- Add a product: you can pick up to 4 pictures at once
- Make a story card: text is upright, not italic, and bigger on long stories

---

## What is in this update

**New**
- Admin push notifications — orders, help, replies, reviews, stories. Each set
  to Straight away / Every 2 hours / Never, with quiet hours. No message
  content is ever shown on the lock screen.
- A copy-able link for every product, for Instagram link stickers
  (`?item=<id>` opens that product).
- Up to 4 pictures per product, with a swipeable gallery on the product page.
- A trim box on the round-up card for shortening a long story.

**Fixed**
- The reply box could not be reached when the keyboard opened in the Instagram
  in-app browser. That browser reports no keyboard at all, so the page now
  reserves space unconditionally on focus.
- Story text was italic, tightly spaced and shrank to unreadable sizes on long
  stories. Card body text is now Inter, upright, with a minimum size, and the
  website's story text matches.
- All three Send buttons on an order sent the same message — receipt and
  delivery both sent the order-and-banking text. **This has been wrong on the
  live site.**

**Files changed:** `public/index.html`, `netlify.toml`, and in
`netlify/functions/`: `leads.js`, `help.js`, `replies.js`, `reviews.js`,
`stories.js` (two lines each — one import, one notify call), plus
`products.js`, `image.js`, `migrate.js`.

**Files added:** `public/sw.js`, `netlify/functions/_push.js`,
`netlify/functions/push.js`, `netlify/functions/notify-digest.js`.

**Not changed:** everything to do with logging in.

---

## If something goes wrong

**Test notification does not arrive** — check both keys are in Netlify and that
you deployed after adding them; check step 4 returned `ok: true`; check you
tapped Allow. If you tapped Block, Android will not ask again — clear it in the
browser's site settings for blinghappiness.netlify.app.

**Migration page shows an error** — send me the message. Do not delete
`migrate.js` until it says `ok: true`.

**Anything looks broken after deploying** — Netlify → Deploys → the previous
deploy → **Publish deploy**. That puts the old version back in about
30 seconds. Then tell me what you saw.

---

## Tests

`tests/` holds 15 suites, ~390 checks, run against the real `index.html`:

```
cd tests && npm install jsdom && bash run-all.sh
```

They render markup but cannot see the screen, so they would not catch something
pushed off the edge of a phone. Tap through the admin once after deploying.
