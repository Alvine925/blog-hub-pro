-- ── Social Metadata Migration ──────────────────────────────────────────────────
-- Adds social sharing metadata columns to all content tables.
-- All columns are optional; when empty the API derives values using fallback rules.
--
-- Fallback hierarchy (enforced in the SocialMetadata service layer):
--   title       : social_title → seo_title → title/name/question
--   description : social_description → meta_description → excerpt/description/answer
--   image       : social_image → cover_image
--   alt         : social_image_alt
--   hashtags    : social_hashtags → derived from tags
--   twitterCard : twitter_card → 'summary_large_image'
--   type        : open_graph_type → per-content-type default

-- ── blog_posts ─────────────────────────────────────────────────────────────────
ALTER TABLE public.blog_posts
  ADD COLUMN IF NOT EXISTS social_title        TEXT,
  ADD COLUMN IF NOT EXISTS social_description  TEXT,
  ADD COLUMN IF NOT EXISTS social_image        TEXT,
  ADD COLUMN IF NOT EXISTS social_image_alt    TEXT,
  ADD COLUMN IF NOT EXISTS social_hashtags     TEXT[]  DEFAULT '{}',
  ADD COLUMN IF NOT EXISTS open_graph_type     TEXT    DEFAULT 'article';
  -- twitter_card already exists from 20260701170000_extended_seo.sql

-- ── news ───────────────────────────────────────────────────────────────────────
ALTER TABLE public.news
  ADD COLUMN IF NOT EXISTS social_title        TEXT,
  ADD COLUMN IF NOT EXISTS social_description  TEXT,
  ADD COLUMN IF NOT EXISTS social_image        TEXT,
  ADD COLUMN IF NOT EXISTS social_image_alt    TEXT,
  ADD COLUMN IF NOT EXISTS social_hashtags     TEXT[]  DEFAULT '{}',
  ADD COLUMN IF NOT EXISTS open_graph_type     TEXT    DEFAULT 'article',
  ADD COLUMN IF NOT EXISTS twitter_card        TEXT    DEFAULT 'summary_large_image';

-- ── articles ───────────────────────────────────────────────────────────────────
ALTER TABLE public.articles
  ADD COLUMN IF NOT EXISTS social_title        TEXT,
  ADD COLUMN IF NOT EXISTS social_description  TEXT,
  ADD COLUMN IF NOT EXISTS social_image        TEXT,
  ADD COLUMN IF NOT EXISTS social_image_alt    TEXT,
  ADD COLUMN IF NOT EXISTS social_hashtags     TEXT[]  DEFAULT '{}',
  ADD COLUMN IF NOT EXISTS open_graph_type     TEXT    DEFAULT 'article',
  ADD COLUMN IF NOT EXISTS twitter_card        TEXT    DEFAULT 'summary_large_image';

-- ── products ───────────────────────────────────────────────────────────────────
ALTER TABLE public.products
  ADD COLUMN IF NOT EXISTS social_title        TEXT,
  ADD COLUMN IF NOT EXISTS social_description  TEXT,
  ADD COLUMN IF NOT EXISTS social_image        TEXT,
  ADD COLUMN IF NOT EXISTS social_image_alt    TEXT,
  ADD COLUMN IF NOT EXISTS social_hashtags     TEXT[]  DEFAULT '{}',
  ADD COLUMN IF NOT EXISTS open_graph_type     TEXT    DEFAULT 'product',
  ADD COLUMN IF NOT EXISTS twitter_card        TEXT    DEFAULT 'summary_large_image';

-- ── faqs ───────────────────────────────────────────────────────────────────────
ALTER TABLE public.faqs
  ADD COLUMN IF NOT EXISTS social_title        TEXT,
  ADD COLUMN IF NOT EXISTS social_description  TEXT,
  ADD COLUMN IF NOT EXISTS social_image        TEXT,
  ADD COLUMN IF NOT EXISTS social_image_alt    TEXT,
  ADD COLUMN IF NOT EXISTS social_hashtags     TEXT[]  DEFAULT '{}',
  ADD COLUMN IF NOT EXISTS open_graph_type     TEXT    DEFAULT 'website',
  ADD COLUMN IF NOT EXISTS twitter_card        TEXT    DEFAULT 'summary_large_image';

-- ── Comments ───────────────────────────────────────────────────────────────────
COMMENT ON COLUMN public.blog_posts.social_title       IS 'Override title for social sharing (falls back to seo_title → title)';
COMMENT ON COLUMN public.blog_posts.social_description IS 'Override description for social sharing (falls back to meta_description → excerpt)';
COMMENT ON COLUMN public.blog_posts.social_image       IS 'Override image URL for social sharing (falls back to cover_image)';
COMMENT ON COLUMN public.blog_posts.social_image_alt   IS 'Alt text for the social share image';
COMMENT ON COLUMN public.blog_posts.social_hashtags    IS 'Suggested hashtags for social sharing (e.g. {tech,ai,cms})';
COMMENT ON COLUMN public.blog_posts.open_graph_type    IS 'Open Graph og:type value (article, product, website)';
