-- Bling Happiness — database schema
-- Run this once against your Netlify DB (Postgres) before the site goes live.
-- In the Netlify dashboard: Site configuration → Database → open the built-in
-- SQL console (or connect with any Postgres client using the connection
-- string Netlify gives you) and paste this whole file in.

CREATE TABLE IF NOT EXISTS stories (
  id           TEXT PRIMARY KEY,
  text         TEXT NOT NULL,
  category     TEXT NOT NULL,
  status       TEXT NOT NULL DEFAULT 'pending',   -- pending | approved | rejected
  posted       BOOLEAN NOT NULL DEFAULT FALSE,     -- true once downloaded as a Stories picture
  created_at   TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS replies (
  id           TEXT PRIMARY KEY,
  story_id     TEXT NOT NULL REFERENCES stories(id) ON DELETE CASCADE,
  text         TEXT NOT NULL,
  status       TEXT NOT NULL DEFAULT 'pending',   -- pending | approved | rejected
  created_at   TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS products (
  id           TEXT PRIMARY KEY,
  name         TEXT NOT NULL,
  price        TEXT NOT NULL,
  image        TEXT,                               -- picture, stored directly for now (see chat notes)
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
  status           TEXT NOT NULL DEFAULT 'Enquired', -- Enquired | Paid | Ready | Sent
  created_at       TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_replies_story_id ON replies(story_id);
CREATE INDEX IF NOT EXISTS idx_stories_status ON stories(status);
CREATE INDEX IF NOT EXISTS idx_replies_status ON replies(status);
