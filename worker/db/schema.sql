-- Ambassador dashboard, D1 schema.
-- Rules the schema carries: question ids are permanent (answers are stored by id),
-- an approved post is never overwritten by its review link, and the review token
-- is the only credential an ambassador has.

CREATE TABLE IF NOT EXISTS personas (
  slug            TEXT PRIMARY KEY,
  name            TEXT NOT NULL,
  english_name    TEXT NOT NULL DEFAULT '',
  role            TEXT NOT NULL DEFAULT '',
  company         TEXT NOT NULL DEFAULT '',
  profile_md      TEXT NOT NULL,            -- full profile.md, frontmatter included
  training_status TEXT NOT NULL DEFAULT 'draft',
  origin          TEXT NOT NULL DEFAULT 'app', -- 'curated' (came from git) or 'app'
  candidate_slug  TEXT,
  image_key       TEXT,                     -- R2 key
  video_key       TEXT,                     -- R2 key
  created_at      TEXT NOT NULL,
  updated_at      TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS samples (
  id           INTEGER PRIMARY KEY AUTOINCREMENT,
  persona_slug TEXT NOT NULL REFERENCES personas(slug) ON DELETE CASCADE,
  filename     TEXT NOT NULL,
  content      TEXT NOT NULL,
  UNIQUE (persona_slug, filename)
);

CREATE TABLE IF NOT EXISTS candidates (
  slug           TEXT PRIMARY KEY,
  name           TEXT NOT NULL,
  english_name   TEXT NOT NULL DEFAULT '',
  role           TEXT NOT NULL DEFAULT '',
  company        TEXT NOT NULL DEFAULT '',
  email          TEXT NOT NULL DEFAULT '',  -- never sent to the AI
  answers_json   TEXT NOT NULL,             -- {"q1": "...", ...} keyed by permanent question id
  answered_count INTEGER NOT NULL DEFAULT 0,
  status         TEXT NOT NULL DEFAULT 'new', -- new | reviewed | persona-created | rejected
  submitted_at   TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS posts (
  id               INTEGER PRIMARY KEY AUTOINCREMENT,
  persona_slug     TEXT NOT NULL,
  filename         TEXT NOT NULL,           -- legacy file name, kept for traceability
  topic            TEXT NOT NULL DEFAULT '',
  platform         TEXT NOT NULL DEFAULT '',
  goal             TEXT NOT NULL DEFAULT '',
  body             TEXT NOT NULL,           -- current text (the approved one once approved)
  original_body    TEXT,                    -- the model's text, kept only when the ambassador edited it
  edited           INTEGER NOT NULL DEFAULT 0,
  status           TEXT NOT NULL DEFAULT 'draft', -- draft | pending | approved
  token            TEXT UNIQUE,
  token_expires_at TEXT,                    -- applies to pending links only
  sent_at          TEXT,
  approved_at      TEXT,
  scheduled_for    TEXT,                    -- YYYY-MM-DD
  published_at     TEXT,
  published_url    TEXT,
  voice_score      INTEGER,                 -- 1-10, how close to the samples
  voice_reason     TEXT,
  topic_id         INTEGER,
  created_at       TEXT NOT NULL,
  updated_at       TEXT NOT NULL,
  UNIQUE (persona_slug, filename)
);
CREATE INDEX IF NOT EXISTS posts_persona ON posts(persona_slug);
CREATE INDEX IF NOT EXISTS posts_scheduled ON posts(scheduled_for);

CREATE TABLE IF NOT EXISTS topics (
  id         INTEGER PRIMARY KEY AUTOINCREMENT,
  date       TEXT NOT NULL,                 -- YYYY-MM-DD
  title      TEXT NOT NULL,
  kind       TEXT NOT NULL DEFAULT 'event', -- holiday | event | campaign | other
  angle      TEXT NOT NULL DEFAULT '',
  notes      TEXT NOT NULL DEFAULT '',
  created_at TEXT NOT NULL
);
CREATE INDEX IF NOT EXISTS topics_date ON topics(date);

CREATE TABLE IF NOT EXISTS activity (
  id      INTEGER PRIMARY KEY AUTOINCREMENT,
  at      TEXT NOT NULL,
  kind    TEXT NOT NULL,
  message TEXT NOT NULL,
  link    TEXT
);

-- Login lockout and public rate limits, keyed by client IP (or IP + route).
CREATE TABLE IF NOT EXISTS throttle (
  key          TEXT PRIMARY KEY,
  count        INTEGER NOT NULL,
  window_start INTEGER NOT NULL,
  locked_until INTEGER NOT NULL DEFAULT 0
);
