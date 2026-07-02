-- ============================================================
-- API PLATFORM — Upgrade api_keys + add api_rate_limits
-- Run this after: 20260701130000_api_keys.sql
-- ============================================================

-- ── 1. Extend api_keys with platform columns ────────────────

ALTER TABLE public.api_keys
  ADD COLUMN IF NOT EXISTS workspace_id UUID
    REFERENCES public.workspaces(id) ON DELETE CASCADE,
  ADD COLUMN IF NOT EXISTS description TEXT,
  ADD COLUMN IF NOT EXISTS key_type TEXT NOT NULL DEFAULT 'publishable'
    CHECK (key_type IN ('publishable', 'secret')),
  ADD COLUMN IF NOT EXISTS permissions JSONB NOT NULL
    DEFAULT '["read:blogs","read:pages","read:media","read:collections"]'::jsonb,
  ADD COLUMN IF NOT EXISTS status TEXT NOT NULL DEFAULT 'active'
    CHECK (status IN ('active', 'revoked', 'expired')),
  ADD COLUMN IF NOT EXISTS expires_at TIMESTAMP WITH TIME ZONE,
  ADD COLUMN IF NOT EXISTS created_by UUID
    REFERENCES auth.users(id) ON DELETE SET NULL;

-- ── 2. Migrate legacy revoked_at → status ────────────────────

UPDATE public.api_keys
  SET status = 'revoked'
  WHERE revoked_at IS NOT NULL AND status = 'active';

-- ── 3. Assign existing keys to the default workspace ─────────

UPDATE public.api_keys
  SET workspace_id = (
    SELECT id FROM public.workspaces WHERE slug = 'default' LIMIT 1
  )
  WHERE workspace_id IS NULL;

-- ── 4. Additional indexes ─────────────────────────────────────

CREATE INDEX IF NOT EXISTS idx_api_keys_workspace_id
  ON public.api_keys (workspace_id);

CREATE INDEX IF NOT EXISTS idx_api_keys_status_active
  ON public.api_keys (status)
  WHERE status = 'active';

-- ── 5. api_rate_limits ────────────────────────────────────────

CREATE TABLE IF NOT EXISTS public.api_rate_limits (
  id            UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  workspace_id  UUID REFERENCES public.workspaces(id) ON DELETE CASCADE,
  api_key_id    UUID NOT NULL REFERENCES public.api_keys(id) ON DELETE CASCADE,
  window_start  TIMESTAMP WITH TIME ZONE NOT NULL,
  request_count INTEGER NOT NULL DEFAULT 0,
  limit_count   INTEGER NOT NULL DEFAULT 1000,
  created_at    TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at    TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Unique window per key (enables upsert)
CREATE UNIQUE INDEX IF NOT EXISTS idx_rate_limits_key_window
  ON public.api_rate_limits (api_key_id, window_start);

CREATE INDEX IF NOT EXISTS idx_rate_limits_workspace
  ON public.api_rate_limits (workspace_id);

-- Grants
GRANT SELECT, INSERT, UPDATE, DELETE ON public.api_rate_limits TO service_role;
GRANT SELECT ON public.api_rate_limits TO authenticated;

ALTER TABLE public.api_rate_limits ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Service role full access rate limits" ON public.api_rate_limits;
CREATE POLICY "Service role full access rate limits" ON public.api_rate_limits
  FOR ALL TO service_role USING (true) WITH CHECK (true);

-- ── 6. Ensure service_role can write api_request_logs ─────────

GRANT SELECT, INSERT ON public.api_request_logs TO service_role;

-- ── 7. Service role policy on api_keys ───────────────────────

DROP POLICY IF EXISTS "Service role full access api_keys" ON public.api_keys;
CREATE POLICY "Service role full access api_keys" ON public.api_keys
  FOR ALL TO service_role USING (true) WITH CHECK (true);
