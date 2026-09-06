# Bling Happiness — new look, gift cards, reviews, help

## STEP 1 — update on GitHub

  public/index.html                    (replaced)
  netlify/functions/reviews.js         (NEW)
  netlify/functions/help.js            (NEW)
  netlify/functions/giftcards.js       (NEW)
  netlify/functions/migrate.js         (run once, then delete)

Everything else stays as it is. If fix-images.js is still in the repo,
delete it.

## STEP 2 — run the database update ONCE

  https://blinghappiness.netlify.app/.netlify/functions/migrate

Then delete migrate.js. Safe to run more than once.

## The new landing page

Option B, in our colours. Announcement bar, dark header with the full
"Bling . Happiness" name, then a full-width hero with BLING. over it.

Below that, two carousels exactly like the mockup:

  Shop by mood     - one card per shop category, using a real product
                     photo where there is one. Tapping opens the shop
                     already filtered to that category.
  From the stories - the newest stories. Tapping opens the story.

Then a slim row of story-category chips with their counts, and the trust
badges. The old grid of plain white folder boxes is gone.

A slide-out menu behind the hamburger holds everything: Stories, Share
your story, Shop with its categories, Gift Cards, Help, and Admin.

## The Instagram link — this did not exist before

You asked where it was. It had never been built, and it needed something
else first: stories had no web address of their own.

Now every story has one. On the Post tab there is a **Copy link** button
beside the download. Download the picture, tap Copy link, and paste that
into Instagram's link sticker. Anyone tapping it lands directly on that
story, ready to read the replies and add their own.

## Gift cards

A proper Gift Cards page. Amounts from R300 in R100 steps, chosen from a
dropdown. The buyer enters their own name, the recipient's name and a
message; only the recipient's name appears on the card. A live preview
updates as they type.

**Admin -> Gift cards** lists every order with its own code. Two WhatsApp
buttons: one sends banking details, the other sends the finished card.
The card itself is generated automatically at credit-card proportions -
plum, BLING. in the middle, the value and recipient, and the code.

## Reviews

Customers can review any product with a star rating and a comment, either
anonymously or under a pseudonym. Reviews wait for approval like stories
do. Approved ones show on the product page and give it a star rating on
the shop grid. **Admin -> Reviews.**

## Help

A Help page where someone leaves their name, WhatsApp number and message.
**Admin -> Help** lists them with a "Reply on WhatsApp" button that opens
the chat with their question already quoted, and a New/Done status.

## Also

- "Made-up name" now reads **pseudonym** everywhere, including stories.
- **Announcement bar text is editable** in Settings.
- **Free shipping over R1500** by default, editable in Settings. Orders
  above it ship free automatically.
