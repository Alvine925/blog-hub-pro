CREATE TABLE IF NOT EXISTS public.cms_settings (
  key   TEXT NOT NULL PRIMARY KEY,
  value TEXT NOT NULL DEFAULT '',
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

INSERT INTO public.cms_settings (key, value) VALUES
  ('site_name',          'Lunar CMS'),
  ('site_description',   'A modern, AI-powered headless CMS'),
  ('site_url',           ''),
  ('blog_title',         'Blog'),
  ('blog_description',   'Ideas, guides and inspiration for every celebration.'),
  ('social_twitter',     ''),
  ('social_github',      ''),
  ('social_linkedin',    ''),
  ('default_author',     'Admin'),
  ('default_category',   'General')
ON CONFLICT (key) DO NOTHING;

GRANT SELECT, INSERT, UPDATE, DELETE ON public.cms_settings TO anon;
GRANT ALL ON public.cms_settings TO service_role;
ALTER TABLE public.cms_settings ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Anon manage settings" ON public.cms_settings
  FOR ALL TO anon USING (true) WITH CHECK (true);

CREATE OR REPLACE FUNCTION public.update_cms_settings_updated_at()
RETURNS TRIGGER LANGUAGE plpgsql SET search_path = public AS $$
BEGIN NEW.updated_at = now(); RETURN NEW; END; $$;

DROP TRIGGER IF EXISTS update_cms_settings_updated_at ON public.cms_settings;
CREATE TRIGGER update_cms_settings_updated_at
  BEFORE UPDATE ON public.cms_settings
  FOR EACH ROW EXECUTE FUNCTION public.update_cms_settings_updated_at();
