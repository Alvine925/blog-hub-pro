-- ============================================================
-- API KEYS — table for external developer access
-- ============================================================

CREATE TABLE IF NOT EXISTS public.api_keys (
  id          UUID        NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  name        TEXT        NOT NULL,
  key_hash    TEXT        NOT NULL UNIQUE,
  key_prefix  TEXT        NOT NULL,
  created_at  TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  last_used_at TIMESTAMP WITH TIME ZONE,
  revoked_at  TIMESTAMP WITH TIME ZONE
);

CREATE INDEX IF NOT EXISTS idx_api_keys_key_hash ON public.api_keys (key_hash);
CREATE INDEX IF NOT EXISTS idx_api_keys_revoked ON public.api_keys (revoked_at) WHERE revoked_at IS NULL;

-- Grants
GRANT SELECT, INSERT, UPDATE, DELETE ON public.api_keys TO anon;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.api_keys TO authenticated;
GRANT ALL ON public.api_keys TO service_role;

ALTER TABLE public.api_keys ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Anon can manage api keys" ON public.api_keys;
CREATE POLICY "Anon can manage api keys" ON public.api_keys
  FOR ALL TO anon USING (true) WITH CHECK (true);
