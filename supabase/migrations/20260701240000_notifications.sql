-- ============================================================
-- NOTIFICATIONS — in-app notification centre
-- ============================================================

CREATE TABLE IF NOT EXISTS public.notifications (
  id           UUID    NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  workspace_id UUID    REFERENCES public.workspaces(id) ON DELETE CASCADE,
  -- null = broadcast to all users in workspace
  user_id      TEXT,
  type         TEXT    NOT NULL DEFAULT 'info'
                       CHECK (type IN ('info','success','warning','error','post_published',
                                       'post_scheduled','media_uploaded','member_invited',
                                       'api_key_created','webhook_failed','billing','system')),
  title        TEXT    NOT NULL,
  body         TEXT,
  -- optional deep-link inside the CMS
  action_url   TEXT,
  action_label TEXT,
  -- JSONB bag for extra type-specific data
  metadata     JSONB   NOT NULL DEFAULT '{}'::jsonb,
  read_at      TIMESTAMP WITH TIME ZONE,
  dismissed_at TIMESTAMP WITH TIME ZONE,
  created_at   TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS notifications_workspace_idx ON public.notifications (workspace_id, created_at DESC);
CREATE INDEX IF NOT EXISTS notifications_user_idx      ON public.notifications (user_id, created_at DESC);
CREATE INDEX IF NOT EXISTS notifications_unread_idx    ON public.notifications (workspace_id, user_id)
  WHERE read_at IS NULL AND dismissed_at IS NULL;

-- Seed a few system notifications so the UI isn't empty on first load
INSERT INTO public.notifications (type, title, body, action_url, action_label) VALUES
  ('system',   'Welcome to Lunar CMS',      'Your workspace is ready. Start by creating your first blog post.', '/admin/blogs/new', 'Create post'),
  ('info',     'API Keys available',         'Generate API keys to fetch content from any frontend.', '/admin/api-keys', 'View keys'),
  ('success',  'Webhooks ready',             'Connect external services by adding webhook endpoints.', '/admin/webhooks', 'Add webhook')
ON CONFLICT DO NOTHING;
