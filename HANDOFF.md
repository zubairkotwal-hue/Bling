# Bling · Happiness — handoff

Written for whoever picks this up next. Read the whole thing before changing code. The
"Traps" section is not optional — every item in it is something that already went wrong.

---

## What this is

An anonymous story-sharing page plus a small lingerie shop, run by one person in South
Africa.

- **Owner:** Sabihah. Works almost entirely from her phone (Samsung, Samsung Internet).
- **Audience:** Instagram `@bling_happiness_`, roughly 5k–25k followers, and unusually
  engaged — **50–100 story submissions a day by DM**. That engagement is the business.
  The shop is downstream of it.
- **Live at:** `blinghappiness.netlify.app`
- **Also has:** a WhatsApp broadcast list. **No email list, and the site captures no email
  addresses anywhere.** Everything customer-facing runs on WhatsApp.
- **Money:** manual EFT, reconciled by hand. No payment gateway.

Two halves that are deliberately kept apart: a permanent archive of anonymous stories,
and a shop. See "The boundary" below — it is a real product principle, not decoration.

---

## Stack

No build step. No framework. No package.json in the deployed app.

```
public/index.html          the ENTIRE frontend — ~236KB, one file, vanilla JS
netlify/functions/*.js     one file per endpoint, Node, node-postgres
schema.sql                 base tables only (incomplete — see Database)
netlify.toml               publish=public, functions=netlify/functions, SPA redirect
```

Frontend architecture: global `let` state (`stories`, `products`, `leads`, `replies`,
`reviews`, `helpMessages`, `nav`, `transient`, `settings`), and a single `render()` that
rebuilds `#root` from template strings. There is no virtual DOM and no diffing — every
render throws away the DOM and rebuilds it.

**The consequence of that is the single most important thing to understand here:** any
uncontrolled input loses its value on every render. This caused the add-product bug (see
Traps). Form fields must be bound to `transient` and written back on `oninput`.

Deploy is GitHub Desktop → push → Netlify auto-builds.

---

## Database

Postgres (Neon, via Netlify). **`schema.sql` does NOT create every table.**

`help_messages`, `settings`, `gift_cards`, `discount_codes`, `reviews` and
`product_images` are created **only by `migrate.js`**, along with most columns on
`products`, `leads` and `stories`.

### migrate.js discipline — read this twice

`migrate.js` is the accumulated schema. It is entirely `IF NOT EXISTS`, so running it
again is safe. The workflow is: add your change to it → deploy → **visit
`/.netlify/functions/migrate` in a browser** → confirm `"ok": true` → delete the file →
push again.

- **Deploying does not run it.** It is a URL you visit. This was missed once and cost an
  afternoon.
- **Never replace it with just your own change.** I did exactly that, which deleted the
  statements creating `help_messages` and `stories.pseudonym`, and took the help form and
  story submissions down. Always append to what is there.
- **Delete it after running.** It has no admin check. Anyone with the URL can run it.

### Making backend code tolerate a missing column

Postgres fails the *whole query* if you reference a column that does not exist, so
shipping code that selects a new column before the migration has run takes the feature
down. Both `products.js` and `stories.js` now check `information_schema` once, cache the
answer for 60s, and build their SQL accordingly. **Copy this pattern for any new
column.** It makes deploy order irrelevant.

```js
let hasThing = null, checkedAt = 0;
async function thingReady(pool){
  if (hasThing !== null && Date.now() - checkedAt < 60000) return hasThing;
  try {
    const r = await pool.query(`SELECT 1 FROM information_schema.columns
      WHERE table_name = 'x' AND column_name = 'thing' LIMIT 1`);
    hasThing = r.rows.length > 0;
  } catch (e) { hasThing = false; }
  checkedAt = Date.now();
  return hasThing;
}
```

### Known cruft
`products.image` and `products.is_voucher` are dead. Nothing reads `is_voucher`;
`image.js` only falls back to `products.image` for very old rows. Leave them; do not
populate them in the bulk import.

---

## Current state — what was done in the last session

### Frontend (`index.html`)

**Admin dashboard** (`renderDashboard`, `dashStats`) — the landing screen. A focus panel
with the pending-story count, the age of the oldest unread one, and a 7-day submissions
bar row. Then a "what needs you" action list (only non-zero items, each taps through).
Then Reposting and Shop stat columns. Everything is derived from already-loaded data — no
separate fetch, so it cannot drift.

**Bottom bar navigation** (`renderAdminNav`, `ADMIN_NAV`, `ADMIN_MORE`, `adminBadge`) —
replaced a wrapping tab row that ate three lines and had previously pushed Settings
off-screen entirely. Five slots: Dashboard, Queue, Post, Orders, More. Badges on icons,
rolled up onto More. `env(safe-area-inset-bottom)` padding for iOS Safari's toolbar.

**Orders rebuilt** (`renderLeadsManager`, `leadCard`, `LEAD_GROUPS`) — was twelve buttons
per card. Now grouped by status with one primary action each, plus:
- **Archive** — uses `status: 'Archived'`, no migration. Collapsible section, Put back.
- **Remind** — chases an unpaid order. Template: `reminderMessage`.
- **Update** — "we haven't forgotten you". Template: `updateMessage`.
- **Remind all N** (`startChase`, `renderChase`) — a guided one-at-a-time walkthrough of
  unpaid orders. WhatsApp cannot bulk send from a web page; bulk tools get numbers
  banned. Do not try to "improve" this into a real bulk send.

**Product editing** (`editProduct`, `resetProductForm`) — was delete-and-re-add. Uses
PATCH. Picture optional on edit.

**Story links** (`storyLinkRow`, `copyStoryLink`) — the link is now printed as selectable
text, present before *and after* downloading, on ready-to-post, already-downloaded, the
replies round-up, and archived stories. Copy has three fallbacks. Previously the link
vanished the moment you downloaded, with no way back.

**Round-up card** — draws the original poster's pseudonym in gold at 62% of the quote
size, on the last line's baseline, dropping to its own line if it will not fit.

**Multiple pictures per product** — up to 4. `product_images` stores a thumb row and a
full row per picture, sharing a `position` (0 is the main one, shown in the grid).
`products.image_count` says how many, so the frontend needs no extra query. `image.js`
takes `?i=0..3`. Admin has a multi-file picker with a thumbnail strip, remove, and
make-main; the product page gets a scroll-snap gallery with dots. Legacy products with no
`image_count` are treated as having one picture.

**Fonts** — Cormorant Garamond (display) + Jost (UI), driven by `--f-display` / `--f-ui`
on `.bh-root`. Swap those two lines to change the whole site.

### Backend
- `products.js` — PATCH rewritten to update only supplied fields (the old `COALESCE`
  version made it impossible to clear a description). `image_version` support.
- `stories.js` — stamps `posted_at` when a card is downloaded, clears it when un-marked.
- `migrate.js` — full original schema **plus** `products.image_version` and
  `stories.posted_at`.

### Bug fixed that was live
`sendLeadWhatsApp(id, kind)` accepted `kind` and never used it, so all three Send buttons
on an order sent the *same* message. Receipt and Delivery were both sending the
order-and-banking text.

---

## Deploying

1. `index.html` → `public/`
2. `stories.js`, `products.js`, `migrate.js` → `netlify/functions/`
3. Push all together, wait for **Published**
4. Visit `/.netlify/functions/migrate`, confirm `"ok": true` and check the `tables` list
5. **Delete `migrate.js`, push again**

The site works between steps 3 and 4 — both backend files tolerate the missing columns.

---

## Testing

`tests/` holds 12 jsdom suites, ~320 assertions. They boot the **real** `index.html`, seed
globals, and assert against rendered DOM and captured fetch calls.

```bash
cd tests && npm install jsdom && bash run-all.sh
```

Run them before and after any change. Notes:

- Top-level `let` bindings are **not** on `window`. Reach them with a bridge:
  `w.eval('window.S={get nav(){return nav}, ...}')`.
- Stub `_markImg` before anything that draws a card, or `loadMark()` waits forever on an
  `Image` that never fires in jsdom and the test **hangs silently with exit 0**.
- jsdom does not resolve CSS `var()` or `clamp()` the way a browser does.
- `toLocaleString('en-ZA')` uses a **non-breaking space** — `R2 097` will not match a
  regex with a normal space.
- **These tests render markup; they do not check visibility.** A control pushed off the
  edge of a 360px screen passes every assertion. That is exactly how the Settings tab went
  missing. Tap through on a real phone after deploying.

---

## Traps

Things that already went wrong. Do not rediscover them.

1. **This file is fragile.** Find-and-replace has repeatedly eaten neighbouring functions.
   After every edit, diff the function list against the previous version:
   `grep -oE "^(async )?function [a-zA-Z0-9_]+" index.html | sort -u`
2. **Never set `font-size` in a broad selector** like `.bh-root .bh-serif, h1, h2, h3`. It
   outranks individual heading classes and silently flattens every heading on the site.
   This shrank the hero wordmark to ~18px.
3. **Canvas fonts are not the site fonts.** The story-card and gift-card generators draw
   in **Fraunces / Instrument Sans**, still loaded in the `@import` purely for that.
   Changing the site fonts must not touch them — it would change every card she posts.
4. **`position: fixed` breaks under a transformed ancestor.** Drawers and the nav bar are
   mounted at the top level of `render()` for this reason. Keep them there.
5. **Uncontrolled inputs lose their value on every render.** Bind to `transient`.
6. **Empty arrays are truthy.** `if (transient.filterColour)` was always true once filters
   became arrays. Use `anyFilterActive()` or check `.length`.
7. **Only the main picture may fall back.** `image.js` returns 404 for a missing
   picture 2–4 rather than falling back to picture 1 — otherwise the gallery shows the
   same photo repeatedly.
8. **`images` in the API may be one object or an array.** A check of `images.thumb` is
   false for an array, which silently skipped saving pictures on PATCH. Handle both.
9. **Product images are cached `immutable` for a year, keyed on product id.** Replacing a
   photo keeps the id, so `image_version` is what tells the browser it changed. Any new
   image path must carry it.

---

## The boundary — please respect this

The archive is not a funnel. Women send intimate disclosures on the understanding that
this is a safe place, and the shop's existence is downstream of that trust.

- **Never put a shop link on a story card.**
- Keep story and shop announcements on separate days.
- The original placeholder subheading said *"Kept separate from the stories, on purpose."*
  Someone chose that deliberately. It has been reworded, not abandoned.
- A bottom bar on the **public** site was considered and rejected, partly because a
  persistent shopping bag on screen while someone reads a story is the wrong feeling.

---

## Open decisions

**1. Consent for permanently publishing old DMs — unresolved and the most important one.**
People currently DM her and she reposts to Instagram Stories, which vanish in 24 hours.
Approving a story in this app publishes it **permanently, publicly, with a shareable
link**. That is materially different from what the sender agreed to. Options discussed:
only file stories she would be comfortable defending; start the archive at launch with
form submissions where consent is explicit; or add a line to her Instagram bio now so
incoming DMs carry informed consent. **No decision made.**

**2. Soft launch.** Plan is for her to start pasting DMs into the app and posting the
generated cards to Instagram *without* announcing the site. Cards carry only the logo and
"Shared anonymously" — no URL — so this genuinely stays private. Real benefits are her
fluency with the tool and a non-empty archive on day 1, not audience familiarity with the
card format. **Do not post link stickers during this period.**

**3. Bulk import of 100+ products.** Not done. It gates the launch — announcing a shop
with three products wastes the one clean shot at the audience. See
`CLAUDE-CODE-IMPORT-BRIEF.md` if present.

**4. `posted_at` history starts at the migration.** Old rows are deliberately left null
rather than backfilled from submission dates, which would have put invented data on the
dashboard. "Pictures made this week" will read 0 for the first few days. Tell Sabihah, or
it looks broken.

**5. Not built, worth raising eventually:** no email capture anywhere (everything depends
on Instagram, which can throttle reach at will); no analytics until Netlify Analytics is
switched on; EFT reconciliation is manual and will not scale past modest order volume.

---

## Working style that suited this project

The owner is not a developer but is technically literate and reviews carefully on a phone.
What worked:

- **Build a standalone preview before committing to a design.** Several were made this
  way — fonts, the round-up card, admin navigation — by copying `index.html`, stubbing
  `fetch`, and seeding demo data. Much better than describing options in prose.
- **Say plainly when a request is the wrong move**, and why. A bottom bar for the public
  site was talked out of, and a claim about conversion uplift was retracted when
  challenged, because it was not supported.
- **Own mistakes directly.** Several outages in this session were self-inflicted: the
  clobbered migration, the flattened headings, the off-screen tabs. Saying so plainly was
  more useful than hedging.
- Keep answers short. Lead with the answer. She is reading on a phone.
