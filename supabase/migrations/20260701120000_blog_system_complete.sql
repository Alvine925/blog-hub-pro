-- ============================================================
-- BLOG SYSTEM — Complete migration (run once on a fresh DB)
-- ============================================================
-- This single file replaces the four incremental migrations and
-- represents the authoritative final state of the blog schema.
-- Safe to run on a fresh Supabase project before any prior
-- migration has been applied.
-- ============================================================

-- ------------------------------------------------------------
-- 1. blog_posts TABLE
-- ------------------------------------------------------------

CREATE TABLE IF NOT EXISTS public.blog_posts (
  id              UUID        NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  title           TEXT        NOT NULL DEFAULT '',
  slug            TEXT        NOT NULL UNIQUE,
  excerpt         TEXT        NOT NULL DEFAULT '',
  content         TEXT        NOT NULL DEFAULT '',
  cover_image     TEXT,
  category        TEXT        NOT NULL DEFAULT 'General',
  tags            JSONB       NOT NULL DEFAULT '[]'::jsonb,
  author_name     TEXT        NOT NULL DEFAULT 'Admin',
  seo_title       TEXT,
  meta_description TEXT,
  featured        BOOLEAN     NOT NULL DEFAULT FALSE,
  status          TEXT        NOT NULL DEFAULT 'draft',
  published_at    TIMESTAMP WITH TIME ZONE,
  reading_time    INTEGER     NOT NULL DEFAULT 1,
  views           INTEGER     NOT NULL DEFAULT 0,
  created_at      TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at      TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  CONSTRAINT blog_posts_status_check CHECK (status IN ('draft', 'published'))
);

-- Performance indexes
CREATE INDEX IF NOT EXISTS idx_blog_posts_status_published_at
  ON public.blog_posts (status, published_at DESC);

CREATE INDEX IF NOT EXISTS idx_blog_posts_category
  ON public.blog_posts (category);

CREATE INDEX IF NOT EXISTS idx_blog_posts_slug
  ON public.blog_posts (slug);

-- Full-text search index on title + excerpt + content
CREATE INDEX IF NOT EXISTS idx_blog_posts_fts
  ON public.blog_posts
  USING gin(to_tsvector('english', coalesce(title,'') || ' ' || coalesce(excerpt,'') || ' ' || coalesce(content,'')));

-- ------------------------------------------------------------
-- 2. TRIGGERS
-- ------------------------------------------------------------

-- Auto-update updated_at on every row change
CREATE OR REPLACE FUNCTION public.update_updated_at_column()
RETURNS TRIGGER
LANGUAGE plpgsql
SET search_path = public
AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS update_blog_posts_updated_at ON public.blog_posts;
CREATE TRIGGER update_blog_posts_updated_at
  BEFORE UPDATE ON public.blog_posts
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- Auto-set published_at when status flips to 'published';
-- clear it when flipping back to 'draft'
CREATE OR REPLACE FUNCTION public.set_blog_published_at()
RETURNS TRIGGER
LANGUAGE plpgsql
SET search_path = public
AS $$
BEGIN
  IF NEW.status = 'published' AND NEW.published_at IS NULL THEN
    NEW.published_at = now();
  END IF;
  IF NEW.status = 'draft' THEN
    NEW.published_at = NULL;
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS set_blog_published_at_trigger ON public.blog_posts;
CREATE TRIGGER set_blog_published_at_trigger
  BEFORE INSERT OR UPDATE ON public.blog_posts
  FOR EACH ROW EXECUTE FUNCTION public.set_blog_published_at();

-- ------------------------------------------------------------
-- 3. ROW-LEVEL SECURITY
-- ------------------------------------------------------------

ALTER TABLE public.blog_posts ENABLE ROW LEVEL SECURITY;

-- Grant table-level privileges
GRANT SELECT, INSERT, UPDATE, DELETE ON public.blog_posts TO anon;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.blog_posts TO authenticated;
GRANT ALL ON public.blog_posts TO service_role;

-- NOTE: These policies are intentionally permissive so that the
-- app can operate without authentication while auth is being built.
-- Tighten these policies once authentication is in place:
--   • anon SELECT → USING (status = 'published')
--   • anon INSERT/UPDATE/DELETE → remove entirely
--   • authenticated → restrict to the owning user if needed

DROP POLICY IF EXISTS "Anon can read all posts"   ON public.blog_posts;
DROP POLICY IF EXISTS "Anon can insert posts"     ON public.blog_posts;
DROP POLICY IF EXISTS "Anon can update posts"     ON public.blog_posts;
DROP POLICY IF EXISTS "Anon can delete posts"     ON public.blog_posts;

CREATE POLICY "Anon can read all posts" ON public.blog_posts
  FOR SELECT TO anon USING (true);

CREATE POLICY "Anon can insert posts" ON public.blog_posts
  FOR INSERT TO anon WITH CHECK (true);

CREATE POLICY "Anon can update posts" ON public.blog_posts
  FOR UPDATE TO anon USING (true) WITH CHECK (true);

CREATE POLICY "Anon can delete posts" ON public.blog_posts
  FOR DELETE TO anon USING (true);

-- ------------------------------------------------------------
-- 4. STORAGE — blog-images BUCKET
-- ------------------------------------------------------------

INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
  'blog-images',
  'blog-images',
  false,                       -- private bucket; access via signed URLs
  5242880,                     -- 5 MB per file
  ARRAY['image/jpeg','image/png','image/webp','image/gif','image/avif','image/svg+xml']
)
ON CONFLICT (id) DO NOTHING;

-- Storage RLS
ALTER TABLE storage.objects ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Public read blog images"  ON storage.objects;
DROP POLICY IF EXISTS "Anon manage blog images"  ON storage.objects;

CREATE POLICY "Public read blog images" ON storage.objects
  FOR SELECT USING (bucket_id = 'blog-images');

CREATE POLICY "Anon manage blog images" ON storage.objects
  FOR ALL TO anon
  USING (bucket_id = 'blog-images')
  WITH CHECK (bucket_id = 'blog-images');
