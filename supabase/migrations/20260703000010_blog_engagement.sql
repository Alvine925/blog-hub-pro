-- ============================================================================
-- Blog Engagement & External Website Integration
--
-- Adds: likes, comments (with moderation), view tracking, share tracking,
-- daily analytics rollups, reading-time/word-count auto-computation, and
-- per-workspace engagement feature flags + "Powered by" branding settings.
--
-- Security note: unlike most public content tables in this schema, the new
-- engagement tables are NOT opened up to anon/authenticated directly.
-- All public writes (likes/comments/views/shares) must go through the
-- `blog-engagement` edge function (service_role), which owns dedup, rate
-- limiting, sanitization and moderation-status defaults. Only service_role
-- and authenticated (admin dashboard) can touch these tables.
-- ============================================================================

-- ── blog_posts additions ────────────────────────────────────────────────────

ALTER TABLE public.blog_posts
  ADD COLUMN IF NOT EXISTS word_count INTEGER NOT NULL DEFAULT 0;

-- Auto-compute word_count + reading_time from content on insert/update.
CREATE OR REPLACE FUNCTION public.compute_blog_reading_stats()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
DECLARE
  plain TEXT;
  wc INTEGER;
BEGIN
  plain := regexp_replace(COALESCE(NEW.content, ''), '<[^>]*>', ' ', 'g');
  plain := trim(regexp_replace(plain, '\s+', ' ', 'g'));

  IF plain = '' THEN
    wc := 0;
  ELSE
    wc := array_length(regexp_split_to_array(plain, ' '), 1);
  END IF;

  NEW.word_count := COALESCE(wc, 0);
  NEW.reading_time := GREATEST(1, CEIL(COALESCE(wc, 0)::NUMERIC / 200));

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_blog_reading_stats ON public.blog_posts;
CREATE TRIGGER trg_blog_reading_stats
  BEFORE INSERT OR UPDATE OF content ON public.blog_posts
  FOR EACH ROW
  EXECUTE FUNCTION public.compute_blog_reading_stats();

-- Backfill word_count/reading_time for existing rows.
UPDATE public.blog_posts SET content = content;

-- ── workspaces additions: feature flags + branding ──────────────────────────

ALTER TABLE public.workspaces
  ADD COLUMN IF NOT EXISTS engagement_settings JSONB NOT NULL DEFAULT jsonb_build_object(
    'features', jsonb_build_object(
      'likes', true,
      'comments', true,
      'socialShare', true,
      'relatedPosts', true,
      'viewTracking', true,
      'poweredBy', true
    ),
    'branding', jsonb_build_object(
      'enabled', true,
      'text', 'Powered by Lunar CMS',
      'url', 'https://lunarcms.com'
    ),
    'commentSettings', jsonb_build_object(
      'requireApproval', true,
      'allowGuest', true,
      'maxDepth', 3
    )
  );

-- ── blog_likes ───────────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS public.blog_likes (
  id             UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  blog_post_id   UUID NOT NULL REFERENCES public.blog_posts(id) ON DELETE CASCADE,
  workspace_id   UUID REFERENCES public.workspaces(id) ON DELETE CASCADE,
  visitor_id     TEXT NOT NULL,
  created_at     TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (blog_post_id, visitor_id)
);

CREATE INDEX IF NOT EXISTS idx_blog_likes_post ON public.blog_likes(blog_post_id);
CREATE INDEX IF NOT EXISTS idx_blog_likes_workspace ON public.blog_likes(workspace_id);

ALTER TABLE public.blog_likes ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "blog_likes_service_role_all" ON public.blog_likes;
CREATE POLICY "blog_likes_service_role_all" ON public.blog_likes
  FOR ALL TO service_role USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS "blog_likes_authenticated_read" ON public.blog_likes;
CREATE POLICY "blog_likes_authenticated_read" ON public.blog_likes
  FOR SELECT TO authenticated USING (true);

GRANT ALL ON public.blog_likes TO service_role;
GRANT SELECT ON public.blog_likes TO authenticated;

-- ── blog_comments ────────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS public.blog_comments (
  id             UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  blog_post_id   UUID NOT NULL REFERENCES public.blog_posts(id) ON DELETE CASCADE,
  workspace_id   UUID REFERENCES public.workspaces(id) ON DELETE CASCADE,
  parent_id      UUID REFERENCES public.blog_comments(id) ON DELETE CASCADE,
  author_name    TEXT NOT NULL,
  author_email   TEXT NOT NULL,
  author_website TEXT,
  content        TEXT NOT NULL,
  status         TEXT NOT NULL DEFAULT 'pending'
                   CHECK (status IN ('pending', 'approved', 'rejected', 'spam', 'trash')),
  visitor_id     TEXT,
  ip_hash        TEXT,
  user_agent     TEXT,
  created_at     TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at     TIMESTAMPTZ NOT NULL DEFAULT now(),
  moderated_at   TIMESTAMPTZ,
  moderated_by   UUID
);

CREATE INDEX IF NOT EXISTS idx_blog_comments_post ON public.blog_comments(blog_post_id);
CREATE INDEX IF NOT EXISTS idx_blog_comments_workspace ON public.blog_comments(workspace_id);
CREATE INDEX IF NOT EXISTS idx_blog_comments_status ON public.blog_comments(status);
CREATE INDEX IF NOT EXISTS idx_blog_comments_parent ON public.blog_comments(parent_id);

ALTER TABLE public.blog_comments ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "blog_comments_service_role_all" ON public.blog_comments;
CREATE POLICY "blog_comments_service_role_all" ON public.blog_comments
  FOR ALL TO service_role USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS "blog_comments_authenticated_all" ON public.blog_comments;
CREATE POLICY "blog_comments_authenticated_all" ON public.blog_comments
  FOR ALL TO authenticated USING (true) WITH CHECK (true);

GRANT ALL ON public.blog_comments TO service_role;
GRANT ALL ON public.blog_comments TO authenticated;

CREATE OR REPLACE FUNCTION public.set_blog_comments_updated_at()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
BEGIN
  NEW.updated_at := now();
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_blog_comments_updated_at ON public.blog_comments;
CREATE TRIGGER trg_blog_comments_updated_at
  BEFORE UPDATE ON public.blog_comments
  FOR EACH ROW
  EXECUTE FUNCTION public.set_blog_comments_updated_at();

-- ── blog_views ───────────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS public.blog_views (
  id             UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  blog_post_id   UUID NOT NULL REFERENCES public.blog_posts(id) ON DELETE CASCADE,
  workspace_id   UUID REFERENCES public.workspaces(id) ON DELETE CASCADE,
  visitor_id     TEXT,
  referrer       TEXT,
  device_type    TEXT,
  user_agent     TEXT,
  created_at     TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_blog_views_post ON public.blog_views(blog_post_id);
CREATE INDEX IF NOT EXISTS idx_blog_views_workspace ON public.blog_views(workspace_id);
CREATE INDEX IF NOT EXISTS idx_blog_views_dedup ON public.blog_views(blog_post_id, visitor_id, created_at);

ALTER TABLE public.blog_views ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "blog_views_service_role_all" ON public.blog_views;
CREATE POLICY "blog_views_service_role_all" ON public.blog_views
  FOR ALL TO service_role USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS "blog_views_authenticated_read" ON public.blog_views;
CREATE POLICY "blog_views_authenticated_read" ON public.blog_views
  FOR SELECT TO authenticated USING (true);

GRANT ALL ON public.blog_views TO service_role;
GRANT SELECT ON public.blog_views TO authenticated;

-- ── blog_shares ──────────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS public.blog_shares (
  id             UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  blog_post_id   UUID NOT NULL REFERENCES public.blog_posts(id) ON DELETE CASCADE,
  workspace_id   UUID REFERENCES public.workspaces(id) ON DELETE CASCADE,
  channel        TEXT NOT NULL,
  visitor_id     TEXT,
  created_at     TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_blog_shares_post ON public.blog_shares(blog_post_id);
CREATE INDEX IF NOT EXISTS idx_blog_shares_workspace ON public.blog_shares(workspace_id);

ALTER TABLE public.blog_shares ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "blog_shares_service_role_all" ON public.blog_shares;
CREATE POLICY "blog_shares_service_role_all" ON public.blog_shares
  FOR ALL TO service_role USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS "blog_shares_authenticated_read" ON public.blog_shares;
CREATE POLICY "blog_shares_authenticated_read" ON public.blog_shares
  FOR SELECT TO authenticated USING (true);

GRANT ALL ON public.blog_shares TO service_role;
GRANT SELECT ON public.blog_shares TO authenticated;

-- ── blog_engagement_daily (analytics rollup) ────────────────────────────────

CREATE TABLE IF NOT EXISTS public.blog_engagement_daily (
  id             UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  blog_post_id   UUID NOT NULL REFERENCES public.blog_posts(id) ON DELETE CASCADE,
  workspace_id   UUID REFERENCES public.workspaces(id) ON DELETE CASCADE,
  day            DATE NOT NULL,
  views          INTEGER NOT NULL DEFAULT 0,
  likes          INTEGER NOT NULL DEFAULT 0,
  comments       INTEGER NOT NULL DEFAULT 0,
  shares         INTEGER NOT NULL DEFAULT 0,
  UNIQUE (blog_post_id, day)
);

CREATE INDEX IF NOT EXISTS idx_blog_engagement_daily_post ON public.blog_engagement_daily(blog_post_id);
CREATE INDEX IF NOT EXISTS idx_blog_engagement_daily_workspace ON public.blog_engagement_daily(workspace_id, day);

ALTER TABLE public.blog_engagement_daily ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "blog_engagement_daily_service_role_all" ON public.blog_engagement_daily;
CREATE POLICY "blog_engagement_daily_service_role_all" ON public.blog_engagement_daily
  FOR ALL TO service_role USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS "blog_engagement_daily_authenticated_read" ON public.blog_engagement_daily;
CREATE POLICY "blog_engagement_daily_authenticated_read" ON public.blog_engagement_daily
  FOR SELECT TO authenticated USING (true);

GRANT ALL ON public.blog_engagement_daily TO service_role;
GRANT SELECT ON public.blog_engagement_daily TO authenticated;

-- Atomic upsert helper for the daily rollup (called from edge functions).
CREATE OR REPLACE FUNCTION public.bump_blog_engagement_daily(
  p_blog_post_id UUID,
  p_workspace_id UUID,
  p_metric TEXT -- 'views' | 'likes' | 'comments' | 'shares'
)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  INSERT INTO public.blog_engagement_daily (blog_post_id, workspace_id, day, views, likes, comments, shares)
  VALUES (
    p_blog_post_id,
    p_workspace_id,
    CURRENT_DATE,
    CASE WHEN p_metric = 'views' THEN 1 ELSE 0 END,
    CASE WHEN p_metric = 'likes' THEN 1 ELSE 0 END,
    CASE WHEN p_metric = 'comments' THEN 1 ELSE 0 END,
    CASE WHEN p_metric = 'shares' THEN 1 ELSE 0 END
  )
  ON CONFLICT (blog_post_id, day) DO UPDATE SET
    views    = public.blog_engagement_daily.views    + CASE WHEN p_metric = 'views'    THEN 1 ELSE 0 END,
    likes    = public.blog_engagement_daily.likes    + CASE WHEN p_metric = 'likes'    THEN 1 ELSE 0 END,
    comments = public.blog_engagement_daily.comments + CASE WHEN p_metric = 'comments' THEN 1 ELSE 0 END,
    shares   = public.blog_engagement_daily.shares   + CASE WHEN p_metric = 'shares'   THEN 1 ELSE 0 END;
END;
$$;

GRANT EXECUTE ON FUNCTION public.bump_blog_engagement_daily(UUID, UUID, TEXT) TO service_role;
