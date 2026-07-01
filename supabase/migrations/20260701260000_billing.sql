-- ============================================================
-- BILLING — plans, subscriptions, usage snapshots
-- ============================================================

-- Plan catalogue (static reference data)
CREATE TABLE IF NOT EXISTS public.billing_plans (
  id           UUID    NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  slug         TEXT    NOT NULL UNIQUE,
  name         TEXT    NOT NULL,
  description  TEXT,
  price_usd    NUMERIC(10,2) NOT NULL DEFAULT 0,
  interval     TEXT    NOT NULL DEFAULT 'month' CHECK (interval IN ('month','year','once')),
  -- Feature limits (null = unlimited)
  max_posts    INTEGER,
  max_workspaces INTEGER,
  max_storage_gb NUMERIC(10,2),
  max_api_calls  INTEGER,
  max_team_members INTEGER,
  max_webhooks INTEGER,
  features     JSONB   NOT NULL DEFAULT '[]'::jsonb,
  is_active    BOOLEAN NOT NULL DEFAULT TRUE,
  created_at   TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

INSERT INTO public.billing_plans (slug, name, description, price_usd, interval, max_posts, max_workspaces, max_storage_gb, max_api_calls, max_team_members, max_webhooks, features) VALUES
  ('free', 'Free', 'Free forever — ideal for personal projects', 0, 'month',
    100, 1, 1, 10000, 1, 3,
    '["Up to 100 blog posts","1 workspace","1 GB storage","REST API","3 webhooks","30-day analytics","10 version history"]'::jsonb),
  ('pro', 'Pro', 'Unlimited content for growing teams', 29, 'month',
    NULL, NULL, 50, NULL, 10, NULL,
    '["Unlimited posts","Unlimited workspaces","50 GB storage","REST + GraphQL","Unlimited webhooks","All-time analytics","Full version history","Custom domain","Up to 10 members","Priority support"]'::jsonb),
  ('enterprise', 'Enterprise', 'Custom limits and SLA for large organisations', 0, 'month',
    NULL, NULL, NULL, NULL, NULL, NULL,
    '["Everything in Pro","Unlimited team members","Custom storage","SSO / SAML","SLA guarantee","Dedicated support","Custom integrations"]'::jsonb)
ON CONFLICT (slug) DO NOTHING;

-- Per-workspace subscription
CREATE TABLE IF NOT EXISTS public.billing_subscriptions (
  id              UUID   NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  workspace_id    UUID   NOT NULL REFERENCES public.workspaces(id) ON DELETE CASCADE,
  plan_id         UUID   NOT NULL REFERENCES public.billing_plans(id),
  status          TEXT   NOT NULL DEFAULT 'active'
                         CHECK (status IN ('active','trialing','past_due','canceled','paused')),
  -- External payment processor IDs
  stripe_customer_id      TEXT,
  stripe_subscription_id  TEXT,
  -- Billing period
  current_period_start TIMESTAMP WITH TIME ZONE,
  current_period_end   TIMESTAMP WITH TIME ZONE,
  trial_end            TIMESTAMP WITH TIME ZONE,
  canceled_at          TIMESTAMP WITH TIME ZONE,
  created_at           TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at           TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  UNIQUE (workspace_id)
);

CREATE INDEX IF NOT EXISTS billing_subscriptions_workspace_idx ON public.billing_subscriptions (workspace_id);
CREATE INDEX IF NOT EXISTS billing_subscriptions_plan_idx      ON public.billing_subscriptions (plan_id);

DROP TRIGGER IF EXISTS update_billing_subscriptions_updated_at ON public.billing_subscriptions;
CREATE TRIGGER update_billing_subscriptions_updated_at
  BEFORE UPDATE ON public.billing_subscriptions
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- Seed default workspace onto the free plan
INSERT INTO public.billing_subscriptions (workspace_id, plan_id, status)
SELECT w.id, p.id, 'active'
FROM public.workspaces w
CROSS JOIN public.billing_plans p
WHERE w.slug = 'default' AND p.slug = 'free'
ON CONFLICT (workspace_id) DO NOTHING;

-- Monthly usage snapshots
CREATE TABLE IF NOT EXISTS public.billing_usage (
  id              UUID   NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  workspace_id    UUID   NOT NULL REFERENCES public.workspaces(id) ON DELETE CASCADE,
  period_start    DATE   NOT NULL,
  period_end      DATE   NOT NULL,
  post_count      INTEGER NOT NULL DEFAULT 0,
  storage_bytes   BIGINT  NOT NULL DEFAULT 0,
  api_call_count  INTEGER NOT NULL DEFAULT 0,
  bandwidth_bytes BIGINT  NOT NULL DEFAULT 0,
  member_count    INTEGER NOT NULL DEFAULT 0,
  recorded_at     TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  UNIQUE (workspace_id, period_start)
);

CREATE INDEX IF NOT EXISTS billing_usage_workspace_period_idx ON public.billing_usage (workspace_id, period_start DESC);

-- Invoice / payment event log
CREATE TABLE IF NOT EXISTS public.billing_invoices (
  id                UUID   NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  workspace_id      UUID   NOT NULL REFERENCES public.workspaces(id) ON DELETE CASCADE,
  stripe_invoice_id TEXT,
  amount_usd        NUMERIC(10,2) NOT NULL,
  status            TEXT   NOT NULL DEFAULT 'draft'
                           CHECK (status IN ('draft','open','paid','void','uncollectible')),
  description       TEXT,
  invoice_pdf_url   TEXT,
  period_start      DATE,
  period_end        DATE,
  paid_at           TIMESTAMP WITH TIME ZONE,
  created_at        TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS billing_invoices_workspace_idx ON public.billing_invoices (workspace_id, created_at DESC);
