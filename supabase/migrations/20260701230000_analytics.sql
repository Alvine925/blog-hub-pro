-- ============================================================
-- ANALYTICS — page views, API requests, content growth
-- ============================================================

-- Page-level view events (one row per visitor/session/page combination)
CREATE TABLE IF NOT EXISTS public.page_views (
  id           UUID   NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  workspace_id UUID   REFERENCES public.workspaces(id) ON DELETE SET NULL,
  post_id      UUID   REFERENCES public.blog_posts(id) ON DELETE SET NULL,
  -- raw path stored so we can track non-post pages too
  path         TEXT   NOT NULL,
  referrer     TEXT,
  country      TEXT,
  device       TEXT   CHECK (device IN ('desktop','tablet','mobile','bot','unknown')),
  browser      TEXT,
  session_id   TEXT,
  -- duration in seconds (updated when user leaves)
  duration_sec INTEGER,
  viewed_at    TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS page_views_post_id_idx      ON public.page_views (post_id, viewed_at DESC);
CREATE INDEX IF NOT EXISTS page_views_workspace_idx    ON public.page_views (workspace_id, viewed_at DESC);
CREATE INDEX IF NOT EXISTS page_views_viewed_at_idx    ON public.page_views (viewed_at DESC);
CREATE INDEX IF NOT EXISTS page_views_path_idx         ON public.page_views (path);

-- API request logs — one row per inbound API call
CREATE TABLE IF NOT EXISTS public.api_request_logs (
  id           UUID   NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  workspace_id UUID   REFERENCES public.workspaces(id) ON DELETE SET NULL,
  api_key_id   UUID   REFERENCES public.api_keys(id) ON DELETE SET NULL,
  method       TEXT   NOT NULL DEFAULT 'GET',
  path         TEXT   NOT NULL,
  status_code  INTEGER,
  -- response time in milliseconds
  duration_ms  INTEGER,
  ip_address   TEXT,
  user_agent   TEXT,
  error        TEXT,
  requested_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS api_logs_workspace_idx      ON public.api_request_logs (workspace_id, requested_at DESC);
CREATE INDEX IF NOT EXISTS api_logs_key_idx            ON public.api_request_logs (api_key_id, requested_at DESC);
CREATE INDEX IF NOT EXISTS api_logs_requested_at_idx   ON public.api_request_logs (requested_at DESC);
CREATE INDEX IF NOT EXISTS api_logs_status_code_idx    ON public.api_request_logs (status_code);

-- Aggregated daily stats — populated by a scheduled function or trigger
-- to avoid scanning millions of rows on every dashboard load
CREATE TABLE IF NOT EXISTS public.analytics_daily (
  id             UUID  NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  workspace_id   UUID  REFERENCES public.workspaces(id) ON DELETE CASCADE,
  stat_date      DATE  NOT NULL,
  total_views    INTEGER NOT NULL DEFAULT 0,
  unique_visitors INTEGER NOT NULL DEFAULT 0,
  api_requests   INTEGER NOT NULL DEFAULT 0,
  api_errors     INTEGER NOT NULL DEFAULT 0,
  -- bytes transferred via API responses
  bytes_out      BIGINT  NOT NULL DEFAULT 0,
  created_at     TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  UNIQUE (workspace_id, stat_date)
);

CREATE INDEX IF NOT EXISTS analytics_daily_workspace_date_idx ON public.analytics_daily (workspace_id, stat_date DESC);

-- Bandwidth usage snapshots (storage + egress)
CREATE TABLE IF NOT EXISTS public.storage_usage (
  id           UUID  NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  workspace_id UUID  REFERENCES public.workspaces(id) ON DELETE CASCADE,
  snapshot_at  TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  file_count   INTEGER NOT NULL DEFAULT 0,
  total_bytes  BIGINT  NOT NULL DEFAULT 0
);

CREATE INDEX IF NOT EXISTS storage_usage_workspace_idx ON public.storage_usage (workspace_id, snapshot_at DESC);
