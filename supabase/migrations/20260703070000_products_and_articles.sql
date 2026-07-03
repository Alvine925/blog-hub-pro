-- ============================================================
-- Products & Articles tables
-- ============================================================

-- ── products ──────────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.products (
  id               UUID         NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  workspace_id     UUID         REFERENCES public.workspaces(id) ON DELETE CASCADE,
  name             TEXT         NOT NULL DEFAULT '',
  slug             TEXT         NOT NULL,
  description      TEXT         DEFAULT '',
  content          TEXT         DEFAULT '',
  cover_image      TEXT,
  gallery          JSONB        DEFAULT '[]',
  category         TEXT         DEFAULT '',
  brand            TEXT         DEFAULT '',
  sku              TEXT         DEFAULT '',
  price            NUMERIC(12,2),
  compare_price    NUMERIC(12,2),
  currency         TEXT         DEFAULT 'USD',
  status           TEXT         DEFAULT 'draft'
                   CHECK (status IN ('draft','published','archived')),
  featured         BOOLEAN      DEFAULT FALSE,
  specifications   JSONB        DEFAULT '[]',
  features         JSONB        DEFAULT '[]',
  tags             TEXT[]       DEFAULT '{}',
  seo_title        TEXT,
  meta_description TEXT,
  views            INTEGER      DEFAULT 0,
  sort_order       INTEGER      DEFAULT 0,
  created_at       TIMESTAMPTZ  NOT NULL DEFAULT now(),
  updated_at       TIMESTAMPTZ  NOT NULL DEFAULT now(),
  CONSTRAINT products_slug_workspace_unique UNIQUE (workspace_id, slug)
);

CREATE INDEX IF NOT EXISTS idx_products_workspace   ON public.products (workspace_id);
CREATE INDEX IF NOT EXISTS idx_products_status      ON public.products (status);
CREATE INDEX IF NOT EXISTS idx_products_category    ON public.products (category);
CREATE INDEX IF NOT EXISTS idx_products_featured    ON public.products (featured);
CREATE INDEX IF NOT EXISTS idx_products_fts ON public.products
  USING GIN (to_tsvector('english',
    coalesce(name,'') || ' ' || coalesce(description,'') || ' ' || coalesce(brand,'')
  ));

ALTER TABLE public.products ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "products_service_role_all" ON public.products;
CREATE POLICY "products_service_role_all" ON public.products
  FOR ALL TO service_role USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS "products_authenticated_all" ON public.products;
CREATE POLICY "products_authenticated_all" ON public.products
  FOR ALL TO authenticated USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS "products_anon_read" ON public.products;
CREATE POLICY "products_anon_read" ON public.products
  FOR SELECT TO anon USING (status = 'published');

GRANT ALL    ON public.products TO service_role;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.products TO authenticated;
GRANT SELECT ON public.products TO anon;

-- ── articles ──────────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.articles (
  id               UUID         NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  workspace_id     UUID         REFERENCES public.workspaces(id) ON DELETE CASCADE,
  title            TEXT         DEFAULT '',
  slug             TEXT         NOT NULL,
  excerpt          TEXT         DEFAULT '',
  content          TEXT         DEFAULT '',
  cover_image      TEXT,
  category         TEXT         DEFAULT '',
  tags             TEXT[]       DEFAULT '{}',
  author_name      TEXT         DEFAULT 'AI Assistant',
  article_type     TEXT         DEFAULT 'guide'
                   CHECK (article_type IN ('guide','tutorial','case-study','documentation','educational')),
  status           TEXT         DEFAULT 'draft'
                   CHECK (status IN ('draft','published','scheduled')),
  featured         BOOLEAN      DEFAULT FALSE,
  reading_time     INTEGER      DEFAULT 0,
  word_count       INTEGER,
  published_at     TIMESTAMPTZ,
  scheduled_at     TIMESTAMPTZ,
  seo_title        TEXT,
  meta_description TEXT,
  views            INTEGER      DEFAULT 0,
  created_at       TIMESTAMPTZ  NOT NULL DEFAULT now(),
  updated_at       TIMESTAMPTZ  NOT NULL DEFAULT now(),
  CONSTRAINT articles_slug_workspace_unique UNIQUE (workspace_id, slug)
);

CREATE INDEX IF NOT EXISTS idx_articles_workspace   ON public.articles (workspace_id);
CREATE INDEX IF NOT EXISTS idx_articles_status      ON public.articles (status, published_at DESC);
CREATE INDEX IF NOT EXISTS idx_articles_category    ON public.articles (category);
CREATE INDEX IF NOT EXISTS idx_articles_featured    ON public.articles (featured);
CREATE INDEX IF NOT EXISTS idx_articles_type        ON public.articles (article_type);
CREATE INDEX IF NOT EXISTS idx_articles_fts ON public.articles
  USING GIN (to_tsvector('english',
    coalesce(title,'') || ' ' || coalesce(excerpt,'') || ' ' || coalesce(content,'')
  ));

ALTER TABLE public.articles ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "articles_service_role_all" ON public.articles;
CREATE POLICY "articles_service_role_all" ON public.articles
  FOR ALL TO service_role USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS "articles_authenticated_all" ON public.articles;
CREATE POLICY "articles_authenticated_all" ON public.articles
  FOR ALL TO authenticated USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS "articles_anon_read" ON public.articles;
CREATE POLICY "articles_anon_read" ON public.articles
  FOR SELECT TO anon USING (status = 'published');

GRANT ALL    ON public.articles TO service_role;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.articles TO authenticated;
GRANT SELECT ON public.articles TO anon;

-- ── updated_at triggers ───────────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION public.set_updated_at()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
BEGIN NEW.updated_at = now(); RETURN NEW; END;
$$;

DROP TRIGGER IF EXISTS products_updated_at ON public.products;
CREATE TRIGGER products_updated_at
  BEFORE UPDATE ON public.products
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

DROP TRIGGER IF EXISTS articles_updated_at ON public.articles;
CREATE TRIGGER articles_updated_at
  BEFORE UPDATE ON public.articles
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();
