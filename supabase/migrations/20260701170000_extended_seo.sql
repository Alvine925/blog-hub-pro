ALTER TABLE public.blog_posts
  ADD COLUMN IF NOT EXISTS og_image        TEXT,
  ADD COLUMN IF NOT EXISTS og_title        TEXT,
  ADD COLUMN IF NOT EXISTS og_description  TEXT,
  ADD COLUMN IF NOT EXISTS twitter_card    TEXT DEFAULT 'summary_large_image',
  ADD COLUMN IF NOT EXISTS canonical_url   TEXT,
  ADD COLUMN IF NOT EXISTS robots          TEXT DEFAULT 'index, follow',
  ADD COLUMN IF NOT EXISTS focus_keyword   TEXT;
