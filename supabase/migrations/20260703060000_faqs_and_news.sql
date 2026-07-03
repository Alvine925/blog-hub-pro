-- ============================================================
-- FAQs and News content types
-- ============================================================
-- Extends Lunar CMS beyond Blogs, following the exact same
-- pattern established by blog_posts (workspace_id FK, status
-- lifecycle, timestamps, RLS via anon policies gated by the
-- app's own auth layer — consistent with blog_posts today).
-- ============================================================

-- ------------------------------------------------------------
-- 1. faqs TABLE
-- ------------------------------------------------------------

CREATE TABLE IF NOT EXISTS public.faqs (
  id            UUID        NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  workspace_id  UUID        REFERENCES public.workspaces(id) ON DELETE CASCADE,
  question      TEXT        NOT NULL DEFAULT '',
  answer        TEXT        NOT NULL DEFAULT '',
  category      TEXT        NOT NULL DEFAULT 'General',
  sort_order    INTEGER     NOT NULL DEFAULT 0,
  featured      BOOLEAN     NOT NULL DEFAULT FALSE,
  status        TEXT        NOT NULL DEFAULT 'draft',
  seo_title     TEXT,
  meta_description TEXT,
  created_at    TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at    TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  CONSTRAINT faqs_status_check CHECK (status IN ('draft', 'published'))
);

CREATE INDEX IF NOT EXISTS idx_faqs_workspace_id ON public.faqs (workspace_id);
CREATE INDEX IF NOT EXISTS idx_faqs_status_sort ON public.faqs (status, sort_order);
CREATE INDEX IF NOT EXISTS idx_faqs_category ON public.faqs (category);
CREATE INDEX IF NOT EXISTS idx_faqs_fts
  ON public.faqs
  USING gin(to_tsvector('english', coalesce(question,'') || ' ' || coalesce(answer,'')));

DROP TRIGGER IF EXISTS trg_faqs_updated_at ON public.faqs;
CREATE TRIGGER trg_faqs_updated_at
  BEFORE UPDATE ON public.faqs
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

ALTER TABLE public.faqs ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Anon can read all faqs"   ON public.faqs;
DROP POLICY IF EXISTS "Anon can insert faqs"     ON public.faqs;
DROP POLICY IF EXISTS "Anon can update faqs"     ON public.faqs;
DROP POLICY IF EXISTS "Anon can delete faqs"     ON public.faqs;

CREATE POLICY "Anon can read all faqs" ON public.faqs
  FOR SELECT TO anon, authenticated USING (true);
CREATE POLICY "Anon can insert faqs" ON public.faqs
  FOR INSERT TO anon, authenticated WITH CHECK (true);
CREATE POLICY "Anon can update faqs" ON public.faqs
  FOR UPDATE TO anon, authenticated USING (true) WITH CHECK (true);
CREATE POLICY "Anon can delete faqs" ON public.faqs
  FOR DELETE TO anon, authenticated USING (true);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.faqs TO anon, authenticated, service_role;

-- ------------------------------------------------------------
-- 2. news TABLE
-- ------------------------------------------------------------

CREATE TABLE IF NOT EXISTS public.news (
  id            UUID        NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  workspace_id  UUID        REFERENCES public.workspaces(id) ON DELETE CASCADE,
  title         TEXT        NOT NULL DEFAULT '',
  slug          TEXT        NOT NULL,
  excerpt       TEXT        NOT NULL DEFAULT '',
  content       TEXT        NOT NULL DEFAULT '',
  cover_image   TEXT,
  category      TEXT        NOT NULL DEFAULT 'General',
  source_name   TEXT,
  source_url    TEXT,
  breaking      BOOLEAN     NOT NULL DEFAULT FALSE,
  featured      BOOLEAN     NOT NULL DEFAULT FALSE,
  status        TEXT        NOT NULL DEFAULT 'draft',
  published_at  TIMESTAMP WITH TIME ZONE,
  expires_at    TIMESTAMP WITH TIME ZONE,
  seo_title     TEXT,
  meta_description TEXT,
  views         INTEGER     NOT NULL DEFAULT 0,
  created_at    TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at    TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  CONSTRAINT news_status_check CHECK (status IN ('draft', 'published', 'scheduled')),
  CONSTRAINT news_slug_workspace_unique UNIQUE (workspace_id, slug)
);

CREATE INDEX IF NOT EXISTS idx_news_workspace_id ON public.news (workspace_id);
CREATE INDEX IF NOT EXISTS idx_news_status_published_at ON public.news (status, published_at DESC);
CREATE INDEX IF NOT EXISTS idx_news_category ON public.news (category);
CREATE INDEX IF NOT EXISTS idx_news_fts
  ON public.news
  USING gin(to_tsvector('english', coalesce(title,'') || ' ' || coalesce(excerpt,'') || ' ' || coalesce(content,'')));

DROP TRIGGER IF EXISTS trg_news_updated_at ON public.news;
CREATE TRIGGER trg_news_updated_at
  BEFORE UPDATE ON public.news
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

ALTER TABLE public.news ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Anon can read all news"   ON public.news;
DROP POLICY IF EXISTS "Anon can insert news"     ON public.news;
DROP POLICY IF EXISTS "Anon can update news"     ON public.news;
DROP POLICY IF EXISTS "Anon can delete news"     ON public.news;

CREATE POLICY "Anon can read all news" ON public.news
  FOR SELECT TO anon, authenticated USING (true);
CREATE POLICY "Anon can insert news" ON public.news
  FOR INSERT TO anon, authenticated WITH CHECK (true);
CREATE POLICY "Anon can update news" ON public.news
  FOR UPDATE TO anon, authenticated USING (true) WITH CHECK (true);
CREATE POLICY "Anon can delete news" ON public.news
  FOR DELETE TO anon, authenticated USING (true);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.news TO anon, authenticated, service_role;

-- ------------------------------------------------------------
-- 3. workspace_content_opportunities — track generation lifecycle
-- ------------------------------------------------------------
-- The `type` column is already free-text, so 'faq' and 'news' rows fit
-- without a schema change. Add a status so onboarding can distinguish
-- opportunities it has already turned into draft content from the ones
-- that remain as suggestions.

ALTER TABLE public.workspace_content_opportunities
  ADD COLUMN IF NOT EXISTS status TEXT NOT NULL DEFAULT 'suggested';

ALTER TABLE public.workspace_content_opportunities
  DROP CONSTRAINT IF EXISTS workspace_content_opportunities_status_check;

ALTER TABLE public.workspace_content_opportunities
  ADD CONSTRAINT workspace_content_opportunities_status_check
  CHECK (status IN ('suggested', 'generated'));

ALTER TABLE public.workspace_content_opportunities
  ADD COLUMN IF NOT EXISTS content_id UUID;

CREATE INDEX IF NOT EXISTS idx_workspace_content_opportunities_status
  ON public.workspace_content_opportunities (workspace_id, type, status);
