-- Second round (10 November 2026): safety check, stories, WhatsApp, tracking links, image bank,
-- feedback, edit rate, settings, languages. Run once on a database created from schema.sql v1.

ALTER TABLE personas ADD COLUMN phone TEXT;
ALTER TABLE personas ADD COLUMN language TEXT NOT NULL DEFAULT 'he';
ALTER TABLE personas ADD COLUMN story_token TEXT;
CREATE UNIQUE INDEX IF NOT EXISTS personas_story_token ON personas(story_token);

ALTER TABLE candidates ADD COLUMN language TEXT NOT NULL DEFAULT 'he';

ALTER TABLE posts ADD COLUMN language TEXT NOT NULL DEFAULT 'he';
ALTER TABLE posts ADD COLUMN safety_json TEXT;        -- [{kind, quote, why}] from the last check
ALTER TABLE posts ADD COLUMN safety_at TEXT;
ALTER TABLE posts ADD COLUMN confirm_json TEXT;       -- details the ambassador should confirm: ["..."]
ALTER TABLE posts ADD COLUMN medical INTEGER NOT NULL DEFAULT 0;
ALTER TABLE posts ADD COLUMN image_id INTEGER;
ALTER TABLE posts ADD COLUMN link_code TEXT;
ALTER TABLE posts ADD COLUMN story_id INTEGER;
ALTER TABLE posts ADD COLUMN edit_ratio REAL;         -- 0 = approved as written, 1 = rewritten
ALTER TABLE posts ADD COLUMN overdue_notified TEXT;
ALTER TABLE posts ADD COLUMN reminded_at TEXT;
ALTER TABLE posts ADD COLUMN reactions INTEGER;
ALTER TABLE posts ADD COLUMN comments INTEGER;
ALTER TABLE posts ADD COLUMN feedback_note TEXT;

CREATE TABLE IF NOT EXISTS stories (
  id           INTEGER PRIMARY KEY AUTOINCREMENT,
  persona_slug TEXT NOT NULL,
  text         TEXT NOT NULL,
  status       TEXT NOT NULL DEFAULT 'new', -- new | used | archived
  created_at   TEXT NOT NULL
);
CREATE INDEX IF NOT EXISTS stories_persona ON stories(persona_slug);

CREATE TABLE IF NOT EXISTS links (
  code         TEXT PRIMARY KEY,
  post_id      INTEGER NOT NULL,
  persona_slug TEXT NOT NULL,
  target_url   TEXT NOT NULL,
  clicks       INTEGER NOT NULL DEFAULT 0,
  created_at   TEXT NOT NULL
);
CREATE TABLE IF NOT EXISTS clicks (
  id   INTEGER PRIMARY KEY AUTOINCREMENT,
  code TEXT NOT NULL,
  at   TEXT NOT NULL
);
CREATE INDEX IF NOT EXISTS clicks_code ON clicks(code);

CREATE TABLE IF NOT EXISTS assets (
  id         INTEGER PRIMARY KEY AUTOINCREMENT,
  key        TEXT NOT NULL,
  title      TEXT NOT NULL DEFAULT '',
  notes      TEXT NOT NULL DEFAULT '',
  consent    INTEGER NOT NULL DEFAULT 0, -- 1 = approved for use, consent on file, no patients
  created_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS settings (
  key   TEXT PRIMARY KEY,
  value TEXT NOT NULL
);
