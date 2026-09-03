# Bling Happiness — deploying the real, shared version

This replaces the earlier demo (which only saved data on one device) with a
real shared backend: a proper database everyone reads from and writes to,
and real secure login instead of a password baked into the file.

I've written and tested all the code. The steps below are the ones only
you can do, since they need your logged-in Netlify account — I have no
access to that from my side.

## What's in this folder

- `public/index.html` — the actual app (same design, same features you've
  already reviewed)
- `netlify/functions/` — the backend: four small serverless functions that
  talk to the database (stories, replies, products, leads)
- `schema.sql` — the database structure to set up once
- `netlify.toml`, `package.json` — configuration Netlify reads automatically

## Setup steps, in order

**1. Deploy this folder to Netlify**
Drag this whole folder into Netlify (or connect it via GitHub, if you'd
rather). Unlike the single-file version from before, this one needs its
full folder structure — functions included — so drag the folder itself,
not just the HTML file.

**2. Enable Netlify DB for this site**
In the site's dashboard: Site configuration → Database → enable it.
Netlify provisions a Postgres database automatically and sets a
`NETLIFY_DATABASE_URL` environment variable — you don't need to create
or configure anything yourself.

**3. Run the schema once**
Open `schema.sql` in this folder, copy its contents, and paste it into the
SQL console Netlify DB gives you in that same dashboard screen. This
creates the four tables the app needs. You only do this once, ever.

**4. Enable Identity for this site**
Site configuration → Identity → enable it.

**5. Set registration to "Invite only"**
Still in Identity settings — this is important: it stops anyone else from
signing themselves up as an admin. Only people you specifically invite can
log in.

**6. Invite her email address**
Identity → Invite users → enter her email. She'll get an email from
Netlify to set her own password — you never see or handle her password at
any point, which is exactly how real login should work.

**7. Re-deploy**
If you enabled DB/Identity after the first deploy, trigger a re-deploy so
the site picks up the new environment variables.

**8. Test it yourself first**
Visit the live link, log in with your own invited account, and run through
submitting a story, approving it, adding a product, and placing a test
order — before sending the link to her.

## What I already tested, and how

I can't reach real Netlify infrastructure from where I work, so I built a
stand-in version of the database and login system and ran the actual app
against it — not just a read-through of the code. Confirmed working:

- Submitting a story, and it appearing correctly in the admin review queue
- Approving a story, and it automatically filing into the right folder
- Posting a reply, and it appearing in the admin queue and, once approved,
  on the story's page
- Adding a shop product with a picture and price
- Placing a real order from the storefront, and it landing in Leads
  with a working "Send WhatsApp" button
- Downloading a real, correctly-sized (1080×1920) Stories picture
- That non-admins genuinely cannot read the Leads list (it holds phone
  numbers and addresses), reject/approve stories, or manage products —
  every one of those correctly requires being logged in
- I also found and fixed a real bug during this testing: reopening the
  admin panel wasn't refreshing the data, so a new submission could be
  missed if you'd stepped away and come back. Fixed and re-verified.

What I could not test, because it needs your real, live account: the
actual Netlify DB connection, the actual Identity login screen, and the
actual invite-only email flow. These are standard, well-documented Netlify
features — but "should work" isn't the same as "verified," so please do
step 8 above before treating this as final.

## One placeholder to update

The order-confirmation picture and the WhatsApp message both use a
placeholder for banking details:

```
Bank: [Bank name] · Acc: [Account number] · Ref: use your order number
```

Search for `BANK_DETAILS` near the top of `public/index.html` and replace
it with her real details before this goes live — customers will see this
exact text on their order confirmations.
