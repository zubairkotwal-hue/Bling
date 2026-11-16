# This update — 16 November 2026

Shop search for customers, a required email at checkout with a customer list,
an "add to home screen" prompt that leads into offer notifications, and an
admin screen for sending offers.

## What was deployed

| File | Change |
|---|---|
| `public/index.html` | All four features |
| `public/sw.js` | **New to the repo.** It was never uploaded in September, so notifications could not work at all |
| `netlify.toml` | Adds the two-hourly schedule for batched admin alerts (also missed in September) and correct headers for `sw.js` and the manifest |
| `netlify/functions/leads.js` | Saves the email; adds the buyer to the customer list |
| `netlify/functions/customers.js` | **New.** The customer list (admin only) |
| `netlify/functions/subscribe.js` | **New.** Customers signing up for offers (public) |
| `netlify/functions/broadcast.js` | **New.** Sending an offer (admin only) |
| `netlify/functions/migrate.js` | Four additions, appended. Run once, then deleted |

Not touched: `_utils.js`, `admin-login.js`, `settings.js`, `discounts.js`,
`giftcards.js`, `_push.js`, `push.js` — everything to do with logging in and
with the admin's own order alerts.

## Order of events

1. Code deployed. Every new feature checks whether the database update has run
   and carries on without it if not, so orders kept working throughout.
2. `/.netlify/functions/migrate` visited once. Adds `leads.email` and the
   tables `customers`, `customer_push_subscriptions`, `broadcasts`.
3. `migrate.js` deleted and deployed again. It has no password on it.

## If something looks wrong

Netlify → Deploys → the previous deploy → **Publish deploy**. About 30 seconds.
The database additions are harmless to leave in place: the older code simply
ignores them.

## How the pieces behave

**Shop search** — a box at the top of the shop. Matches name, department,
colour and size; every word must match. It searches the whole shop even when
opened from inside one department.

**Email at checkout** — required, with a ticked "Email me new arrivals and
offers" box the customer can untick. Their answer is stored. Gift card orders
are unchanged (`giftcards.js` is one of the files left alone).

**Customers** — Admin → More → Customers. Search, copy the addresses of people
who said yes to offers, download the whole list as a spreadsheet, switch one
person's offers off, or remove them.

**The prompt** — appears a few seconds after someone arrives:

- iPhone in Safari: three steps for adding to the home screen
- Android: an "Add to home screen" button
- Inside Instagram's browser: asks them to open the real browser first, because
  Instagram's can do neither
- Once opened from the home screen icon: "Turn on notifications"

"Not now" hides it for a week. "Don't show this again" hides it for good on
that device. It stays out of the way during checkout, story writing and the
admin. The menu has an "App & offer notifications" link for anyone who changes
their mind, and for switching notifications off again.

**Send an offer** — Admin → More → Send an offer. Title, message, where it
opens, a preview, "Send to this phone first", then a confirm step. Customers'
devices are kept in a separate table from the admin's, so a customer can never
receive an order alert.

## Tests

`tests/` holds 24 suites, about 820 checks. Two are new: `customers.js` (97,
the page) and `customers-db.js` (77, the server functions against a fake
database, including "the order still goes through if the update has not run"
and "an offer is never sent twice").

---

# Later on 16 November 2026

## The prompt

- Inside Instagram's browser the main action is one button, "Open in Safari"
  (or "Open in my browser" on Android). The menu route is the fallback.
- Ignoring the prompt counts as an answer: it stays away for a week, stops for
  good after being ignored three times, and slides away by itself after 20
  seconds (40 for the iPhone's written steps).
- After notifications are switched on, a thank-you stays up until tapped. It
  says a secret code will be sent, and that the code is how to enter the
  competition.

## Analytics

Admin -> More -> Analytics. Visits per day, people, screens opened, the split
between stories-only / shop-only / both / home page only, the shop step by
step (including baskets left behind), where visits came from, and the most
opened products and stories. 7, 30 or 90 days.

| File | Change |
|---|---|
| `public/index.html` | Counting, the Analytics tab, the thank-you |
| `netlify/functions/track.js` | **New.** Receives the anonymous counts (public) |
| `netlify/functions/analytics.js` | **New.** The totals for the tab (admin only) |
| `netlify/functions/migrate.js` | Adds `visits` and `view_counts`. Run once, then deleted again |

How it counts: each browser makes up a random id. The server stores one row
per browser per day with yes/no flags, and plain tallies of product and story
opens with no id on them. No IP address, name, number or email, and nothing
links a person to an order or to what they read. Phones that have logged into
the admin are left out. Counting starts from the day this went live; there is
no history before it.

`migrate.js` also had two statements in the wrong order (altering
`product_images` before creating it). Harmless on the live database, fatal on
a blank one. Fixed, and now tested against a real Postgres.

Tests: 26 suites. `analytics.js` (75) and `analytics-db.js` (59, real Postgres).

---

# 16 November 2026, late evening — colour picker

On a product that comes in a choice of colours, the customer now has to pick
one before adding it to her basket. The colour then shows in the basket, the
checkout summary, the order in the admin, the WhatsApp messages and the PDFs.

Nothing changes for any product until it is switched on. A product's colours
can mean "comes in Black or Blush" or "is black and white" (one zebra-stripe
piece), and the list alone cannot tell which. So:

- **Admin -> Shop -> Colour choices** lists every product with more than one
  colour ticked, each with a switch: "Customer picks" or "One piece".
- The product form has a tick box that does the same for one product.

| File | Change |
|---|---|
| `public/index.html` | The picker, the switches, colour on every order line |
| `netlify/functions/leads.js` | The one-line order summary includes the colour |

No database change: the list of switched-on products is stored as one more
row in the existing settings table.

Tests: 27 suites. `colour.js` is new (55 checks).
