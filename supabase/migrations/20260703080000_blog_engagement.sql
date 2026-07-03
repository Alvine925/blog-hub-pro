-- =============================================================================
-- BLOG ENGAGEMENT — Likes, Comments, Views + Workspace Feature Flags
-- Safe to run against databases where some tables already exist.
-- =============================================================================

-- ── 1. blog_likes ─────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.blog_likes (
  id           UUID        NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  workspace_id UUID        NOT NULL REFERENCES public.workspaces(id)  ON DELETE CASCADE,
  post_id      UUID        NOT NULL REFERENCES public.blog_posts(id)  ON DELETE CASCADE,
  visitor_id   TEXT        NOT NULL,
  created_at   TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE UNIQUE INDEX IF NOT EXISTS idx_blog_likes_post_visitor
  ON public.blog_likes (post_id, visitor_id);

CREATE INDEX IF NOT EXISTS idx_blog_likes_workspace
  ON public.blog_likes (workspace_id);

CREATE INDEX IF NOT EXISTS idx_blog_likes_post
  ON public.blog_likes (post_id);

-- ── 2. blog_comments ──────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.blog_comments (
  id           UUID        NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  workspace_id UUID        NOT NULL REFERENCES public.workspaces(id)  ON DELETE CASCADE,
  post_id      UUID        NOT NULL REFERENCES public.blog_posts(id)  ON DELETE CASCADE,
  parent_id    UUID                 REFERENCES public.blog_comments(id) ON DELETE SET NULL,
  name         TEXT        NOT NULL,
  email        TEXT,
  website      TEXT,
  content      TEXT        NOT NULL,
  status       TEXT        NOT NULL DEFAULT 'pending'
    CHECK (status IN ('pending', 'approved', 'rejected', 'spam', 'trash')),
  ip_hash      TEXT,
  created_at   TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at   TIMESTAMPTZ NOT NULL DEFAULT now(),
  deleted_at   TIMESTAMPTZ
);

-- Ensure deleted_at exists even if the table was created by an earlier migration
ALTER TABLE public.blog_comments
  ADD COLUMN IF NOT EXISTS parent_id    UUID        REFERENCES public.blog_comments(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS email        TEXT,
  ADD COLUMN IF NOT EXISTS website      TEXT,
  ADD COLUMN IF NOT EXISTS status       TEXT        NOT NULL DEFAULT 'pending',
  ADD COLUMN IF NOT EXISTS ip_hash      TEXT,
  ADD COLUMN IF NOT EXISTS updated_at   TIMESTAMPTZ NOT NULL DEFAULT now(),
  ADD COLUMN IF NOT EXISTS deleted_at   TIMESTAMPTZ;

-- Partial indexes (require deleted_at to exist — safe now)
CREATE INDEX IF NOT EXISTS idx_blog_comments_post_status
  ON public.blog_comments (post_id, status)
  WHERE deleted_at IS NULL;

CREATE INDEX IF NOT EXISTS idx_blog_comments_workspace_status
  ON public.blog_comments (workspace_id, status)
  WHERE deleted_at IS NULL;

CREATE INDEX IF NOT EXISTS idx_blog_comments_parent
  ON public.blog_comments (parent_id)
  WHERE parent_id IS NOT NULL;

-- ── 3. blog_views ─────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.blog_views (
  id           UUID        NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  workspace_id UUID        NOT NULL REFERENCES public.workspaces(id)  ON DELETE CASCADE,
  post_id      UUID        NOT NULL REFERENCES public.blog_posts(id)  ON DELETE CASCADE,
  visitor_id   TEXT        NOT NULL,
  referrer     TEXT,
  device_type  TEXT        CHECK (device_type IN ('mobile', 'tablet', 'desktop')),
  created_at   TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_blog_views_post_visitor_time
  ON public.blog_views (post_id, visitor_id, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_blog_views_workspace_time
  ON public.blog_views (workspace_id, created_at DESC);

-- ── 4. blog_posts — add word_count + soft-delete ──────────────────────────────
-- NOTE: deleted_at is TIMESTAMPTZ (not INTEGER — the original had a typo)
ALTER TABLE public.blog_posts
  ADD COLUMN IF NOT EXISTS word_count INTEGER,
  ADD COLUMN IF NOT EXISTS deleted_at TIMESTAMPTZ;

-- ── 5. workspaces — engagement feature flags + branding ───────────────────────
ALTER TABLE public.workspaces
  ADD COLUMN IF NOT EXISTS engagement_features JSONB NOT NULL DEFAULT
    '{"likes":true,"comments":true,"socialShare":true,"relatedPosts":true,"poweredBy":false,"viewTracking":true}'::jsonb,
  ADD COLUMN IF NOT EXISTS show_branding BOOLEAN NOT NULL DEFAULT false;

-- ── 6. RLS ────────────────────────────────────────────────────────────────────

ALTER TABLE public.blog_likes    ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.blog_comments ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.blog_views    ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Service role full access blog_likes"    ON public.blog_likes;
DROP POLICY IF EXISTS "Public read blog_likes"                 ON public.blog_likes;
DROP POLICY IF EXISTS "Service role full access blog_comments" ON public.blog_comments;
DROP POLICY IF EXISTS "Public read approved blog_comments"     ON public.blog_comments;
DROP POLICY IF EXISTS "Service role full access blog_views"    ON public.blog_views;

CREATE POLICY "Service role full access blog_likes" ON public.blog_likes
  FOR ALL TO service_role USING (true) WITH CHECK (true);

CREATE POLICY "Public read blog_likes" ON public.blog_likes
  FOR SELECT TO anon, authenticated USING (true);

CREATE POLICY "Service role full access blog_comments" ON public.blog_comments
  FOR ALL TO service_role USING (true) WITH CHECK (true);

CREATE POLICY "Public read approved blog_comments" ON public.blog_comments
  FOR SELECT TO anon, authenticated
  USING (status = 'approved' AND deleted_at IS NULL);

CREATE POLICY "Service role full access blog_views" ON public.blog_views
  FOR ALL TO service_role USING (true) WITH CHECK (true);

-- ── 7. Grants ─────────────────────────────────────────────────────────────────
GRANT SELECT, INSERT, UPDATE, DELETE ON public.blog_likes    TO service_role;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.blog_comments TO service_role;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.blog_views    TO service_role;
GRANT SELECT ON public.blog_likes    TO anon, authenticated;
GRANT SELECT ON public.blog_comments TO anon, authenticated;
