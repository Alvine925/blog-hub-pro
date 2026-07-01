-- ============================================================
-- ACTIVITY LOG — audit trail for all CMS actions
-- ============================================================

CREATE TABLE IF NOT EXISTS public.activity_log (
  id           UUID  NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  workspace_id UUID  REFERENCES public.workspaces(id) ON DELETE SET NULL,
  -- actor: either an internal user ID or an API key prefix
  actor_id     TEXT,
  actor_name   TEXT  NOT NULL DEFAULT 'System',
  actor_type   TEXT  NOT NULL DEFAULT 'user'
                     CHECK (actor_type IN ('user','api_key','system','webhook')),
  -- what happened
  action       TEXT  NOT NULL,
  -- entity that was affected
  entity_type  TEXT  NOT NULL DEFAULT 'post'
                     CHECK (entity_type IN ('post','collection','collection_entry','media',
                                            'workspace','api_key','webhook','user','settings',
                                            'billing','ai_generation','system')),
  entity_id    TEXT,
  entity_label TEXT,
  -- before/after snapshots (optional, for diffing)
  before_data  JSONB,
  after_data   JSONB,
  -- IP / user-agent for security audit
  ip_address   TEXT,
  user_agent   TEXT,
  occurred_at  TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS activity_log_workspace_idx     ON public.activity_log (workspace_id, occurred_at DESC);
CREATE INDEX IF NOT EXISTS activity_log_actor_idx         ON public.activity_log (actor_id, occurred_at DESC);
CREATE INDEX IF NOT EXISTS activity_log_entity_type_idx   ON public.activity_log (entity_type, occurred_at DESC);
CREATE INDEX IF NOT EXISTS activity_log_occurred_at_idx   ON public.activity_log (occurred_at DESC);

-- Seed a few example entries so the dashboard timeline isn't empty
INSERT INTO public.activity_log (actor_name, action, entity_type, entity_label) VALUES
  ('System', 'workspace.created',    'workspace',  'Default'),
  ('System', 'settings.initialized', 'settings',   'Site settings'),
  ('System', 'cms.ready',            'system',     'Lunar CMS initialised')
ON CONFLICT DO NOTHING;
