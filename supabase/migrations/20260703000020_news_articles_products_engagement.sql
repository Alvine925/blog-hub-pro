-- ============================================================================
-- News / Articles / Products Engagement
--
-- Mirrors 20260703000010_blog_engagement.sql exactly, but as dedicated
-- per-content-type tables (news_*, articles_*, products_*) rather than a
-- shared/generic engagement schema. Reuses the existing
-- workspaces.engagement_settings JSONB column (already content-type agnostic)
-- for feature flags + branding across all content types.
--
-- Security note: identical to blog engagement — these tables are NOT opened
-- up to anon/authenticated directly for writes. All public writes
-- (likes/comments/views/shares) must go through the respective
-- `news-engagement` / `articles-engagement` / `products-engagement` edge
-- functions (service_role), which own dedup, rate limiting, sanitization and
-- moderation-status defaults. Only service_role and authenticated (admin
-- dashboard) can touch these tables.
-- ============================================================================

-- ── news_likes ───────────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS public.news_likes (
  id             UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  news_id        UUID NOT NULL REFERENCES public.news(id) ON DELETE CASCADE,
  workspace_id   UUID REFERENCES public.workspaces(id) ON DELETE CASCADE,
  visitor_id     TEXT NOT NULL,
  created_at     TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (news_id, visitor_id)
);

CREATE INDEX IF NOT EXISTS idx_news_likes_news ON public.news_likes(news_id);
CREATE INDEX IF NOT EXISTS idx_news_likes_workspace ON public.news_likes(workspace_id);

ALTER TABLE public.news_likes ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "news_likes_service_role_all" ON public.news_likes;
CREATE POLICY "news_likes_service_role_all" ON public.news_likes
  FOR ALL TO service_role USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS "news_likes_authenticated_read" ON public.news_likes;
CREATE POLICY "news_likes_authenticated_read" ON public.news_likes
  FOR SELECT TO authenticated USING (true);

GRANT ALL ON public.news_likes TO service_role;
GRANT SELECT ON public.news_likes TO authenticated;

-- ── news_comments ────────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS public.news_comments (
  id             UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  news_id        UUID NOT NULL REFERENCES public.news(id) ON DELETE CASCADE,
  workspace_id   UUID REFERENCES public.workspaces(id) ON DELETE CASCADE,
  parent_id      UUID REFERENCES public.news_comments(id) ON DELETE CASCADE,
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

CREATE INDEX IF NOT EXISTS idx_news_comments_news ON public.news_comments(news_id);
CREATE INDEX IF NOT EXISTS idx_news_comments_workspace ON public.news_comments(workspace_id);
CREATE INDEX IF NOT EXISTS idx_news_comments_status ON public.news_comments(status);
CREATE INDEX IF NOT EXISTS idx_news_comments_parent ON public.news_comments(parent_id);

ALTER TABLE public.news_comments ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "news_comments_service_role_all" ON public.news_comments;
CREATE POLICY "news_comments_service_role_all" ON public.news_comments
  FOR ALL TO service_role USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS "news_comments_authenticated_all" ON public.news_comments;
CREATE POLICY "news_comments_authenticated_all" ON public.news_comments
  FOR ALL TO authenticated USING (true) WITH CHECK (true);

GRANT ALL ON public.news_comments TO service_role;
GRANT ALL ON public.news_comments TO authenticated;

CREATE OR REPLACE FUNCTION public.set_news_comments_updated_at()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
BEGIN
  NEW.updated_at := now();
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_news_comments_updated_at ON public.news_comments;
CREATE TRIGGER trg_news_comments_updated_at
  BEFORE UPDATE ON public.news_comments
  FOR EACH ROW
  EXECUTE FUNCTION public.set_news_comments_updated_at();

-- ── news_views ───────────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS public.news_views (
  id             UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  news_id        UUID NOT NULL REFERENCES public.news(id) ON DELETE CASCADE,
  workspace_id   UUID REFERENCES public.workspaces(id) ON DELETE CASCADE,
  visitor_id     TEXT,
  referrer       TEXT,
  device_type    TEXT,
  user_agent     TEXT,
  created_at     TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_news_views_news ON public.news_views(news_id);
CREATE INDEX IF NOT EXISTS idx_news_views_workspace ON public.news_views(workspace_id);
CREATE INDEX IF NOT EXISTS idx_news_views_dedup ON public.news_views(news_id, visitor_id, created_at);

ALTER TABLE public.news_views ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "news_views_service_role_all" ON public.news_views;
CREATE POLICY "news_views_service_role_all" ON public.news_views
  FOR ALL TO service_role USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS "news_views_authenticated_read" ON public.news_views;
CREATE POLICY "news_views_authenticated_read" ON public.news_views
  FOR SELECT TO authenticated USING (true);

GRANT ALL ON public.news_views TO service_role;
GRANT SELECT ON public.news_views TO authenticated;

-- ── news_shares ──────────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS public.news_shares (
  id             UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  news_id        UUID NOT NULL REFERENCES public.news(id) ON DELETE CASCADE,
  workspace_id   UUID REFERENCES public.workspaces(id) ON DELETE CASCADE,
  channel        TEXT NOT NULL,
  visitor_id     TEXT,
  created_at     TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_news_shares_news ON public.news_shares(news_id);
CREATE INDEX IF NOT EXISTS idx_news_shares_workspace ON public.news_shares(workspace_id);

ALTER TABLE public.news_shares ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "news_shares_service_role_all" ON public.news_shares;
CREATE POLICY "news_shares_service_role_all" ON public.news_shares
  FOR ALL TO service_role USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS "news_shares_authenticated_read" ON public.news_shares;
CREATE POLICY "news_shares_authenticated_read" ON public.news_shares
  FOR SELECT TO authenticated USING (true);

GRANT ALL ON public.news_shares TO service_role;
GRANT SELECT ON public.news_shares TO authenticated;

-- ── news_engagement_daily ────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS public.news_engagement_daily (
  id             UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  news_id        UUID NOT NULL REFERENCES public.news(id) ON DELETE CASCADE,
  workspace_id   UUID REFERENCES public.workspaces(id) ON DELETE CASCADE,
  day            DATE NOT NULL,
  views          INTEGER NOT NULL DEFAULT 0,
  likes          INTEGER NOT NULL DEFAULT 0,
  comments       INTEGER NOT NULL DEFAULT 0,
  shares         INTEGER NOT NULL DEFAULT 0,
  UNIQUE (news_id, day)
);

CREATE INDEX IF NOT EXISTS idx_news_engagement_daily_news ON public.news_engagement_daily(news_id);
CREATE INDEX IF NOT EXISTS idx_news_engagement_daily_workspace ON public.news_engagement_daily(workspace_id, day);

ALTER TABLE public.news_engagement_daily ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "news_engagement_daily_service_role_all" ON public.news_engagement_daily;
CREATE POLICY "news_engagement_daily_service_role_all" ON public.news_engagement_daily
  FOR ALL TO service_role USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS "news_engagement_daily_authenticated_read" ON public.news_engagement_daily;
CREATE POLICY "news_engagement_daily_authenticated_read" ON public.news_engagement_daily
  FOR SELECT TO authenticated USING (true);

GRANT ALL ON public.news_engagement_daily TO service_role;
GRANT SELECT ON public.news_engagement_daily TO authenticated;

CREATE OR REPLACE FUNCTION public.bump_news_engagement_daily(
  p_news_id UUID,
  p_workspace_id UUID,
  p_metric TEXT -- 'views' | 'likes' | 'comments' | 'shares'
)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  INSERT INTO public.news_engagement_daily (news_id, workspace_id, day, views, likes, comments, shares)
  VALUES (
    p_news_id,
    p_workspace_id,
    CURRENT_DATE,
    CASE WHEN p_metric = 'views' THEN 1 ELSE 0 END,
    CASE WHEN p_metric = 'likes' THEN 1 ELSE 0 END,
    CASE WHEN p_metric = 'comments' THEN 1 ELSE 0 END,
    CASE WHEN p_metric = 'shares' THEN 1 ELSE 0 END
  )
  ON CONFLICT (news_id, day) DO UPDATE SET
    views    = public.news_engagement_daily.views    + CASE WHEN p_metric = 'views'    THEN 1 ELSE 0 END,
    likes    = public.news_engagement_daily.likes    + CASE WHEN p_metric = 'likes'    THEN 1 ELSE 0 END,
    comments = public.news_engagement_daily.comments + CASE WHEN p_metric = 'comments' THEN 1 ELSE 0 END,
    shares   = public.news_engagement_daily.shares   + CASE WHEN p_metric = 'shares'   THEN 1 ELSE 0 END;
END;
$$;

GRANT EXECUTE ON FUNCTION public.bump_news_engagement_daily(UUID, UUID, TEXT) TO service_role;

-- ============================================================================
-- ── articles_likes ───────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS public.articles_likes (
  id             UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  article_id     UUID NOT NULL REFERENCES public.articles(id) ON DELETE CASCADE,
  workspace_id   UUID REFERENCES public.workspaces(id) ON DELETE CASCADE,
  visitor_id     TEXT NOT NULL,
  created_at     TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (article_id, visitor_id)
);

CREATE INDEX IF NOT EXISTS idx_articles_likes_article ON public.articles_likes(article_id);
CREATE INDEX IF NOT EXISTS idx_articles_likes_workspace ON public.articles_likes(workspace_id);

ALTER TABLE public.articles_likes ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "articles_likes_service_role_all" ON public.articles_likes;
CREATE POLICY "articles_likes_service_role_all" ON public.articles_likes
  FOR ALL TO service_role USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS "articles_likes_authenticated_read" ON public.articles_likes;
CREATE POLICY "articles_likes_authenticated_read" ON public.articles_likes
  FOR SELECT TO authenticated USING (true);

GRANT ALL ON public.articles_likes TO service_role;
GRANT SELECT ON public.articles_likes TO authenticated;

-- ── articles_comments ────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS public.articles_comments (
  id             UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  article_id     UUID NOT NULL REFERENCES public.articles(id) ON DELETE CASCADE,
  workspace_id   UUID REFERENCES public.workspaces(id) ON DELETE CASCADE,
  parent_id      UUID REFERENCES public.articles_comments(id) ON DELETE CASCADE,
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

CREATE INDEX IF NOT EXISTS idx_articles_comments_article ON public.articles_comments(article_id);
CREATE INDEX IF NOT EXISTS idx_articles_comments_workspace ON public.articles_comments(workspace_id);
CREATE INDEX IF NOT EXISTS idx_articles_comments_status ON public.articles_comments(status);
CREATE INDEX IF NOT EXISTS idx_articles_comments_parent ON public.articles_comments(parent_id);

ALTER TABLE public.articles_comments ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "articles_comments_service_role_all" ON public.articles_comments;
CREATE POLICY "articles_comments_service_role_all" ON public.articles_comments
  FOR ALL TO service_role USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS "articles_comments_authenticated_all" ON public.articles_comments;
CREATE POLICY "articles_comments_authenticated_all" ON public.articles_comments
  FOR ALL TO authenticated USING (true) WITH CHECK (true);

GRANT ALL ON public.articles_comments TO service_role;
GRANT ALL ON public.articles_comments TO authenticated;

CREATE OR REPLACE FUNCTION public.set_articles_comments_updated_at()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
BEGIN
  NEW.updated_at := now();
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_articles_comments_updated_at ON public.articles_comments;
CREATE TRIGGER trg_articles_comments_updated_at
  BEFORE UPDATE ON public.articles_comments
  FOR EACH ROW
  EXECUTE FUNCTION public.set_articles_comments_updated_at();

-- ── articles_views ───────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS public.articles_views (
  id             UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  article_id     UUID NOT NULL REFERENCES public.articles(id) ON DELETE CASCADE,
  workspace_id   UUID REFERENCES public.workspaces(id) ON DELETE CASCADE,
  visitor_id     TEXT,
  referrer       TEXT,
  device_type    TEXT,
  user_agent     TEXT,
  created_at     TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_articles_views_article ON public.articles_views(article_id);
CREATE INDEX IF NOT EXISTS idx_articles_views_workspace ON public.articles_views(workspace_id);
CREATE INDEX IF NOT EXISTS idx_articles_views_dedup ON public.articles_views(article_id, visitor_id, created_at);

ALTER TABLE public.articles_views ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "articles_views_service_role_all" ON public.articles_views;
CREATE POLICY "articles_views_service_role_all" ON public.articles_views
  FOR ALL TO service_role USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS "articles_views_authenticated_read" ON public.articles_views;
CREATE POLICY "articles_views_authenticated_read" ON public.articles_views
  FOR SELECT TO authenticated USING (true);

GRANT ALL ON public.articles_views TO service_role;
GRANT SELECT ON public.articles_views TO authenticated;

-- ── articles_shares ──────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS public.articles_shares (
  id             UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  article_id     UUID NOT NULL REFERENCES public.articles(id) ON DELETE CASCADE,
  workspace_id   UUID REFERENCES public.workspaces(id) ON DELETE CASCADE,
  channel        TEXT NOT NULL,
  visitor_id     TEXT,
  created_at     TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_articles_shares_article ON public.articles_shares(article_id);
CREATE INDEX IF NOT EXISTS idx_articles_shares_workspace ON public.articles_shares(workspace_id);

ALTER TABLE public.articles_shares ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "articles_shares_service_role_all" ON public.articles_shares;
CREATE POLICY "articles_shares_service_role_all" ON public.articles_shares
  FOR ALL TO service_role USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS "articles_shares_authenticated_read" ON public.articles_shares;
CREATE POLICY "articles_shares_authenticated_read" ON public.articles_shares
  FOR SELECT TO authenticated USING (true);

GRANT ALL ON public.articles_shares TO service_role;
GRANT SELECT ON public.articles_shares TO authenticated;

-- ── articles_engagement_daily ────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS public.articles_engagement_daily (
  id             UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  article_id     UUID NOT NULL REFERENCES public.articles(id) ON DELETE CASCADE,
  workspace_id   UUID REFERENCES public.workspaces(id) ON DELETE CASCADE,
  day            DATE NOT NULL,
  views          INTEGER NOT NULL DEFAULT 0,
  likes          INTEGER NOT NULL DEFAULT 0,
  comments       INTEGER NOT NULL DEFAULT 0,
  shares         INTEGER NOT NULL DEFAULT 0,
  UNIQUE (article_id, day)
);

CREATE INDEX IF NOT EXISTS idx_articles_engagement_daily_article ON public.articles_engagement_daily(article_id);
CREATE INDEX IF NOT EXISTS idx_articles_engagement_daily_workspace ON public.articles_engagement_daily(workspace_id, day);

ALTER TABLE public.articles_engagement_daily ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "articles_engagement_daily_service_role_all" ON public.articles_engagement_daily;
CREATE POLICY "articles_engagement_daily_service_role_all" ON public.articles_engagement_daily
  FOR ALL TO service_role USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS "articles_engagement_daily_authenticated_read" ON public.articles_engagement_daily;
CREATE POLICY "articles_engagement_daily_authenticated_read" ON public.articles_engagement_daily
  FOR SELECT TO authenticated USING (true);

GRANT ALL ON public.articles_engagement_daily TO service_role;
GRANT SELECT ON public.articles_engagement_daily TO authenticated;

CREATE OR REPLACE FUNCTION public.bump_articles_engagement_daily(
  p_article_id UUID,
  p_workspace_id UUID,
  p_metric TEXT -- 'views' | 'likes' | 'comments' | 'shares'
)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  INSERT INTO public.articles_engagement_daily (article_id, workspace_id, day, views, likes, comments, shares)
  VALUES (
    p_article_id,
    p_workspace_id,
    CURRENT_DATE,
    CASE WHEN p_metric = 'views' THEN 1 ELSE 0 END,
    CASE WHEN p_metric = 'likes' THEN 1 ELSE 0 END,
    CASE WHEN p_metric = 'comments' THEN 1 ELSE 0 END,
    CASE WHEN p_metric = 'shares' THEN 1 ELSE 0 END
  )
  ON CONFLICT (article_id, day) DO UPDATE SET
    views    = public.articles_engagement_daily.views    + CASE WHEN p_metric = 'views'    THEN 1 ELSE 0 END,
    likes    = public.articles_engagement_daily.likes    + CASE WHEN p_metric = 'likes'    THEN 1 ELSE 0 END,
    comments = public.articles_engagement_daily.comments + CASE WHEN p_metric = 'comments' THEN 1 ELSE 0 END,
    shares   = public.articles_engagement_daily.shares   + CASE WHEN p_metric = 'shares'   THEN 1 ELSE 0 END;
END;
$$;

GRANT EXECUTE ON FUNCTION public.bump_articles_engagement_daily(UUID, UUID, TEXT) TO service_role;

-- ============================================================================
-- ── products_likes ───────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS public.products_likes (
  id             UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  product_id     UUID NOT NULL REFERENCES public.products(id) ON DELETE CASCADE,
  workspace_id   UUID REFERENCES public.workspaces(id) ON DELETE CASCADE,
  visitor_id     TEXT NOT NULL,
  created_at     TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (product_id, visitor_id)
);

CREATE INDEX IF NOT EXISTS idx_products_likes_product ON public.products_likes(product_id);
CREATE INDEX IF NOT EXISTS idx_products_likes_workspace ON public.products_likes(workspace_id);

ALTER TABLE public.products_likes ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "products_likes_service_role_all" ON public.products_likes;
CREATE POLICY "products_likes_service_role_all" ON public.products_likes
  FOR ALL TO service_role USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS "products_likes_authenticated_read" ON public.products_likes;
CREATE POLICY "products_likes_authenticated_read" ON public.products_likes
  FOR SELECT TO authenticated USING (true);

GRANT ALL ON public.products_likes TO service_role;
GRANT SELECT ON public.products_likes TO authenticated;

-- ── products_comments ────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS public.products_comments (
  id             UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  product_id     UUID NOT NULL REFERENCES public.products(id) ON DELETE CASCADE,
  workspace_id   UUID REFERENCES public.workspaces(id) ON DELETE CASCADE,
  parent_id      UUID REFERENCES public.products_comments(id) ON DELETE CASCADE,
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

CREATE INDEX IF NOT EXISTS idx_products_comments_product ON public.products_comments(product_id);
CREATE INDEX IF NOT EXISTS idx_products_comments_workspace ON public.products_comments(workspace_id);
CREATE INDEX IF NOT EXISTS idx_products_comments_status ON public.products_comments(status);
CREATE INDEX IF NOT EXISTS idx_products_comments_parent ON public.products_comments(parent_id);

ALTER TABLE public.products_comments ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "products_comments_service_role_all" ON public.products_comments;
CREATE POLICY "products_comments_service_role_all" ON public.products_comments
  FOR ALL TO service_role USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS "products_comments_authenticated_all" ON public.products_comments;
CREATE POLICY "products_comments_authenticated_all" ON public.products_comments
  FOR ALL TO authenticated USING (true) WITH CHECK (true);

GRANT ALL ON public.products_comments TO service_role;
GRANT ALL ON public.products_comments TO authenticated;

CREATE OR REPLACE FUNCTION public.set_products_comments_updated_at()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
BEGIN
  NEW.updated_at := now();
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_products_comments_updated_at ON public.products_comments;
CREATE TRIGGER trg_products_comments_updated_at
  BEFORE UPDATE ON public.products_comments
  FOR EACH ROW
  EXECUTE FUNCTION public.set_products_comments_updated_at();

-- ── products_views ───────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS public.products_views (
  id             UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  product_id     UUID NOT NULL REFERENCES public.products(id) ON DELETE CASCADE,
  workspace_id   UUID REFERENCES public.workspaces(id) ON DELETE CASCADE,
  visitor_id     TEXT,
  referrer       TEXT,
  device_type    TEXT,
  user_agent     TEXT,
  created_at     TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_products_views_product ON public.products_views(product_id);
CREATE INDEX IF NOT EXISTS idx_products_views_workspace ON public.products_views(workspace_id);
CREATE INDEX IF NOT EXISTS idx_products_views_dedup ON public.products_views(product_id, visitor_id, created_at);

ALTER TABLE public.products_views ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "products_views_service_role_all" ON public.products_views;
CREATE POLICY "products_views_service_role_all" ON public.products_views
  FOR ALL TO service_role USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS "products_views_authenticated_read" ON public.products_views;
CREATE POLICY "products_views_authenticated_read" ON public.products_views
  FOR SELECT TO authenticated USING (true);

GRANT ALL ON public.products_views TO service_role;
GRANT SELECT ON public.products_views TO authenticated;

-- ── products_shares ──────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS public.products_shares (
  id             UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  product_id     UUID NOT NULL REFERENCES public.products(id) ON DELETE CASCADE,
  workspace_id   UUID REFERENCES public.workspaces(id) ON DELETE CASCADE,
  channel        TEXT NOT NULL,
  visitor_id     TEXT,
  created_at     TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_products_shares_product ON public.products_shares(product_id);
CREATE INDEX IF NOT EXISTS idx_products_shares_workspace ON public.products_shares(workspace_id);

ALTER TABLE public.products_shares ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "products_shares_service_role_all" ON public.products_shares;
CREATE POLICY "products_shares_service_role_all" ON public.products_shares
  FOR ALL TO service_role USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS "products_shares_authenticated_read" ON public.products_shares;
CREATE POLICY "products_shares_authenticated_read" ON public.products_shares
  FOR SELECT TO authenticated USING (true);

GRANT ALL ON public.products_shares TO service_role;
GRANT SELECT ON public.products_shares TO authenticated;

-- ── products_engagement_daily ────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS public.products_engagement_daily (
  id             UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  product_id     UUID NOT NULL REFERENCES public.products(id) ON DELETE CASCADE,
  workspace_id   UUID REFERENCES public.workspaces(id) ON DELETE CASCADE,
  day            DATE NOT NULL,
  views          INTEGER NOT NULL DEFAULT 0,
  likes          INTEGER NOT NULL DEFAULT 0,
  comments       INTEGER NOT NULL DEFAULT 0,
  shares         INTEGER NOT NULL DEFAULT 0,
  UNIQUE (product_id, day)
);

CREATE INDEX IF NOT EXISTS idx_products_engagement_daily_product ON public.products_engagement_daily(product_id);
CREATE INDEX IF NOT EXISTS idx_products_engagement_daily_workspace ON public.products_engagement_daily(workspace_id, day);

ALTER TABLE public.products_engagement_daily ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "products_engagement_daily_service_role_all" ON public.products_engagement_daily;
CREATE POLICY "products_engagement_daily_service_role_all" ON public.products_engagement_daily
  FOR ALL TO service_role USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS "products_engagement_daily_authenticated_read" ON public.products_engagement_daily;
CREATE POLICY "products_engagement_daily_authenticated_read" ON public.products_engagement_daily
  FOR SELECT TO authenticated USING (true);

GRANT ALL ON public.products_engagement_daily TO service_role;
GRANT SELECT ON public.products_engagement_daily TO authenticated;

CREATE OR REPLACE FUNCTION public.bump_products_engagement_daily(
  p_product_id UUID,
  p_workspace_id UUID,
  p_metric TEXT -- 'views' | 'likes' | 'comments' | 'shares'
)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  INSERT INTO public.products_engagement_daily (product_id, workspace_id, day, views, likes, comments, shares)
  VALUES (
    p_product_id,
    p_workspace_id,
    CURRENT_DATE,
    CASE WHEN p_metric = 'views' THEN 1 ELSE 0 END,
    CASE WHEN p_metric = 'likes' THEN 1 ELSE 0 END,
    CASE WHEN p_metric = 'comments' THEN 1 ELSE 0 END,
    CASE WHEN p_metric = 'shares' THEN 1 ELSE 0 END
  )
  ON CONFLICT (product_id, day) DO UPDATE SET
    views    = public.products_engagement_daily.views    + CASE WHEN p_metric = 'views'    THEN 1 ELSE 0 END,
    likes    = public.products_engagement_daily.likes    + CASE WHEN p_metric = 'likes'    THEN 1 ELSE 0 END,
    comments = public.products_engagement_daily.comments + CASE WHEN p_metric = 'comments' THEN 1 ELSE 0 END,
    shares   = public.products_engagement_daily.shares   + CASE WHEN p_metric = 'shares'   THEN 1 ELSE 0 END;
END;
$$;

GRANT EXECUTE ON FUNCTION public.bump_products_engagement_daily(UUID, UUID, TEXT) TO service_role;
