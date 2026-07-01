CREATE TABLE IF NOT EXISTS public.post_versions (
  id        UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  post_id   UUID NOT NULL REFERENCES public.blog_posts(id) ON DELETE CASCADE,
  title     TEXT NOT NULL DEFAULT '',
  excerpt   TEXT NOT NULL DEFAULT '',
  status    TEXT NOT NULL DEFAULT 'draft',
  author_name TEXT NOT NULL DEFAULT '',
  snapshot  JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_post_versions_post
  ON public.post_versions (post_id, created_at DESC);

GRANT SELECT, INSERT, DELETE ON public.post_versions TO anon;
GRANT ALL ON public.post_versions TO service_role;
ALTER TABLE public.post_versions ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Anon manage post_versions" ON public.post_versions
  FOR ALL TO anon USING (true) WITH CHECK (true);
