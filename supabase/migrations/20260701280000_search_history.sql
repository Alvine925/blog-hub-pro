-- ============================================================
-- SEARCH — query history, suggestions, global search index
-- ============================================================

-- Log of all search queries made inside the CMS
CREATE TABLE IF NOT EXISTS public.search_history (
  id            UUID  NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  workspace_id  UUID  REFERENCES public.workspaces(id) ON DELETE CASCADE,
  user_id       TEXT,
  query         TEXT  NOT NULL,
  result_count  INTEGER,
  -- which result was clicked, if any
  clicked_type  TEXT,
  clicked_id    TEXT,
  searched_at   TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS search_history_workspace_idx ON public.search_history (workspace_id, searched_at DESC);
CREATE INDEX IF NOT EXISTS search_history_query_idx     ON public.search_history (query);

-- Popular searches (materialised from search_history by a background job)
CREATE TABLE IF NOT EXISTS public.search_suggestions (
  id            UUID  NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  workspace_id  UUID  REFERENCES public.workspaces(id) ON DELETE CASCADE,
  query         TEXT  NOT NULL,
  hit_count     INTEGER NOT NULL DEFAULT 1,
  last_searched TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  UNIQUE (workspace_id, query)
);

CREATE INDEX IF NOT EXISTS search_suggestions_workspace_hits_idx ON public.search_suggestions (workspace_id, hit_count DESC);

-- Global search index — denormalised for fast cross-entity search
-- Updated via triggers on blog_posts, collections, media_files, cms_users
CREATE TABLE IF NOT EXISTS public.search_index (
  id            UUID  NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  workspace_id  UUID  REFERENCES public.workspaces(id) ON DELETE CASCADE,
  entity_type   TEXT  NOT NULL CHECK (entity_type IN ('post','collection','media','user','setting')),
  entity_id     TEXT  NOT NULL,
  title         TEXT  NOT NULL,
  subtitle      TEXT,
  url           TEXT,
  icon          TEXT,
  status        TEXT,
  fts_vector    tsvector,
  updated_at    TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  UNIQUE (entity_type, entity_id)
);

CREATE INDEX IF NOT EXISTS search_index_fts_idx           ON public.search_index USING gin(fts_vector);
CREATE INDEX IF NOT EXISTS search_index_workspace_type_idx ON public.search_index (workspace_id, entity_type);

-- Function to update the search index for a blog post
CREATE OR REPLACE FUNCTION public.upsert_search_index_post()
RETURNS TRIGGER LANGUAGE plpgsql SET search_path = public AS $$
BEGIN
  INSERT INTO public.search_index (entity_type, entity_id, title, subtitle, url, status, fts_vector)
  VALUES (
    'post',
    NEW.id::text,
    NEW.title,
    NEW.excerpt,
    '/admin/blogs/' || NEW.id,
    NEW.status,
    to_tsvector('english', coalesce(NEW.title,'') || ' ' || coalesce(NEW.excerpt,'') || ' ' || coalesce(NEW.category,''))
  )
  ON CONFLICT (entity_type, entity_id) DO UPDATE SET
    title      = EXCLUDED.title,
    subtitle   = EXCLUDED.subtitle,
    status     = EXCLUDED.status,
    fts_vector = EXCLUDED.fts_vector,
    updated_at = now();
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS sync_search_index_posts ON public.blog_posts;
CREATE TRIGGER sync_search_index_posts
  AFTER INSERT OR UPDATE ON public.blog_posts
  FOR EACH ROW EXECUTE FUNCTION public.upsert_search_index_post();
