-- ============================================================
-- WEBHOOKS — registered endpoints + delivery log
-- ============================================================

CREATE TABLE IF NOT EXISTS public.webhooks (
  id          UUID    NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  name        TEXT    NOT NULL,
  url         TEXT    NOT NULL,
  secret      TEXT    NOT NULL DEFAULT '',
  events      TEXT[]  NOT NULL DEFAULT ARRAY['post.published','post.updated','post.deleted'],
  active      BOOLEAN NOT NULL DEFAULT true,
  created_at  TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.webhook_logs (
  id            UUID    NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  webhook_id    UUID    REFERENCES public.webhooks(id) ON DELETE CASCADE,
  event         TEXT    NOT NULL,
  response_status INTEGER,
  duration_ms   INTEGER,
  error         TEXT,
  delivered_at  TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_webhook_logs_webhook ON public.webhook_logs (webhook_id, delivered_at DESC);
CREATE INDEX IF NOT EXISTS idx_webhooks_active ON public.webhooks (active) WHERE active = true;

GRANT SELECT, INSERT, UPDATE, DELETE ON public.webhooks TO anon;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.webhooks TO authenticated;
GRANT ALL ON public.webhooks TO service_role;

GRANT SELECT, INSERT, UPDATE, DELETE ON public.webhook_logs TO anon;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.webhook_logs TO authenticated;
GRANT ALL ON public.webhook_logs TO service_role;

ALTER TABLE public.webhooks ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.webhook_logs ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Anon manage webhooks" ON public.webhooks
  FOR ALL TO anon USING (true) WITH CHECK (true);
CREATE POLICY "Anon manage webhook_logs" ON public.webhook_logs
  FOR ALL TO anon USING (true) WITH CHECK (true);
