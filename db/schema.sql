-- HiddenTimes database (PostgreSQL)
-- Applied automatically when the server starts. Safe to run more than once.

-- Stories: one row per story.
CREATE TABLE IF NOT EXISTS stories (
  id            uuid PRIMARY KEY,
  slug          text NOT NULL UNIQUE,                 -- address: /story/<slug>
  title         text NOT NULL,
  category      text NOT NULL DEFAULT 'Stories',      -- section on the home page
  author        text NOT NULL DEFAULT '',
  excerpt       text NOT NULL DEFAULT '',             -- short summary (cards, search results)
  body          text NOT NULL DEFAULT '',             -- the story, in Markdown
  link          text NOT NULL DEFAULT '',             -- YouTube or other link
  youtube_id    text NOT NULL DEFAULT '',
  cover_url     text NOT NULL DEFAULT '',             -- public address of the cover image
  cover_key     text,                                 -- storage key when the image was uploaded (NULL for pasted URLs)
  cover_alt     text NOT NULL DEFAULT '',             -- image description for search engines and screen readers
  featured      boolean NOT NULL DEFAULT false,
  published     boolean NOT NULL DEFAULT true,
  created_at    timestamptz NOT NULL DEFAULT now(),
  updated_at    timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS stories_published_created_idx ON stories (published, created_at DESC);
CREATE INDEX IF NOT EXISTS stories_category_idx ON stories (category);

-- Resources: the links listed at the end of a story, in order.
CREATE TABLE IF NOT EXISTS story_resources (
  id          bigserial PRIMARY KEY,
  story_id    uuid NOT NULL REFERENCES stories(id) ON DELETE CASCADE,
  position    integer NOT NULL,
  title       text NOT NULL,
  url         text NOT NULL
);

CREATE INDEX IF NOT EXISTS story_resources_story_idx ON story_resources (story_id, position);

-- Media: every uploaded file, so nothing in online storage is ever lost track of.
CREATE TABLE IF NOT EXISTS media (
  key           text PRIMARY KEY,                     -- path inside the storage bucket
  url           text NOT NULL,
  content_type  text NOT NULL,
  size_bytes    integer NOT NULL,
  story_id      uuid REFERENCES stories(id) ON DELETE SET NULL,
  created_at    timestamptz NOT NULL DEFAULT now()
);

-- Estimated reading time, kept with the story (shown on cards and pages, used by analytics).
ALTER TABLE stories ADD COLUMN IF NOT EXISTS read_minutes integer NOT NULL DEFAULT 0;

-- Analytics: one row per page visit. No IP addresses and no cookies:
-- "visitor" is an anonymous code that changes every day, so a person can't be followed over time.
CREATE TABLE IF NOT EXISTS page_views (
  id              uuid PRIMARY KEY,
  visitor         text NOT NULL,
  path            text NOT NULL,
  story_id        uuid REFERENCES stories(id) ON DELETE SET NULL,
  country         text NOT NULL DEFAULT '',     -- two-letter code, e.g. RW, US
  region          text NOT NULL DEFAULT '',
  city            text NOT NULL DEFAULT '',
  referrer        text NOT NULL DEFAULT '',     -- the site the visitor came from (host only)
  device          text NOT NULL DEFAULT '',     -- mobile | tablet | desktop
  started_at      timestamptz NOT NULL DEFAULT now(),
  updated_at      timestamptz NOT NULL DEFAULT now(),
  active_seconds  integer NOT NULL DEFAULT 0,   -- time actually reading (tab visible, reader active)
  max_scroll      smallint NOT NULL DEFAULT 0   -- how far down the story they got, in %
);

CREATE INDEX IF NOT EXISTS page_views_started_idx ON page_views (started_at);
CREATE INDEX IF NOT EXISTS page_views_story_idx ON page_views (story_id, started_at);

-- Site settings, e.g. the admin password (stored only as a scrypt hash, never readable).
CREATE TABLE IF NOT EXISTS settings (
  key         text PRIMARY KEY,
  value       text NOT NULL,
  updated_at  timestamptz NOT NULL DEFAULT now()
);
