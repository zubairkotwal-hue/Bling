# Bling Happiness — menu categories, shop carousels, sorting, discount codes

## STEP 1 — update on GitHub

  public/index.html                    (replaced)
  netlify/functions/leads.js           (replaced)
  netlify/functions/discounts.js       (NEW)
  netlify/functions/reviews.js         (NEW, if not up yet)
  netlify/functions/help.js            (NEW, if not up yet)
  netlify/functions/giftcards.js       (NEW, if not up yet)
  netlify/functions/migrate.js         (run once, then delete)

All of these must go up together. If index.html is deployed without the
others, the new sections simply won't work.

## STEP 2 — run the database update ONCE

  https://blinghappiness.netlify.app/.netlify/functions/migrate

Then delete migrate.js.

## The menu

Tapping the arrow next to **Shop** now opens all the shop departments,
and the arrow next to **Stories** opens the story categories. Picking a
department opens the shop at that department.

The departments are the fixed list (Bride, Date Night, Sleepwear, and so
on) - they show whether or not there are products in them yet, so the
menu looks complete from day one.

## The shop

Instead of one long grid, the shop is now a carousel per department, each
with a **See all** button showing how many pieces are in it. See all opens
the full grid for that department, with a way back.

**Sorting** - the default is now **Recently sold**, worked out from real
orders, so what is actually moving rises to the top. The others are:
In stock first, By size, Price low to high, Price high to low, Newest.

**Filtering** by colour and size is on every view.

## Discount codes

New **Discounts** tab in admin. Create a code, choose percentage or rand
amount off, and set how many people may use it - for example, first 10.
Leave it empty for no limit.

At checkout there is a code box with an Apply button, showing the saving
before the order is placed. The discount appears on the order summary and
against the order in Leads.

**The limit cannot be got around.** The code is re-checked on the server
when the order is actually placed, not in the customer's browser, and the
use is counted at the same moment. This was tested with a code capped at
two: the first two orders got the discount, the third was refused, and
the code showed "Used 2 of 2 - finished".

Codes can be switched off and back on, or deleted.

## Free shipping

Already working, and editable in Settings - "Free shipping over (R)",
R1500 by default. Any order above it ships free automatically. Set it to
0 to always charge.
