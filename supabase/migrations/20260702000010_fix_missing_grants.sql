-- Fix missing table-level grants for all tables created without them.
-- Run this in the Supabase SQL editor for your project.
-- service_role  → full access (server-side admin, bypasses RLS)
-- authenticated → full CRUD (logged-in CMS users)
-- anon          → read-only on public-facing tables only

-- ── Workspaces ────────────────────────────────────────────────────────────────
GRANT ALL                            ON public.workspaces              TO service_role;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.workspaces              TO authenticated;

-- ── Collections ───────────────────────────────────────────────────────────────
GRANT ALL                            ON public.collections             TO service_role;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.collections             TO authenticated;

GRANT ALL                            ON public.collection_entries      TO service_role;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.collection_entries      TO authenticated;

-- ── CMS Users & Invites ───────────────────────────────────────────────────────
GRANT ALL                            ON public.cms_users               TO service_role;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.cms_users               TO authenticated;

GRANT ALL                            ON public.cms_user_invites        TO service_role;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.cms_user_invites        TO authenticated;

-- ── Media Library ─────────────────────────────────────────────────────────────
GRANT ALL                            ON public.media_files             TO service_role;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.media_files             TO authenticated;

GRANT ALL                            ON public.media_folders           TO service_role;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.media_folders           TO authenticated;

-- ── Analytics ─────────────────────────────────────────────────────────────────
GRANT ALL                            ON public.page_views              TO service_role;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.page_views              TO authenticated;

GRANT ALL                            ON public.api_request_logs        TO service_role;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.api_request_logs        TO authenticated;

GRANT ALL                            ON public.analytics_daily         TO service_role;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.analytics_daily         TO authenticated;

GRANT ALL                            ON public.storage_usage           TO service_role;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.storage_usage           TO authenticated;

-- ── Notifications ─────────────────────────────────────────────────────────────
GRANT ALL                            ON public.notifications           TO service_role;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.notifications           TO authenticated;

-- ── Activity Log ──────────────────────────────────────────────────────────────
GRANT ALL                            ON public.activity_log            TO service_role;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.activity_log            TO authenticated;

-- ── Billing ───────────────────────────────────────────────────────────────────
GRANT ALL                            ON public.billing_plans           TO service_role;
GRANT SELECT                         ON public.billing_plans           TO authenticated;
GRANT SELECT                         ON public.billing_plans           TO anon;

GRANT ALL                            ON public.billing_subscriptions   TO service_role;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.billing_subscriptions   TO authenticated;

GRANT ALL                            ON public.billing_usage           TO service_role;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.billing_usage           TO authenticated;

GRANT ALL                            ON public.billing_invoices        TO service_role;
GRANT SELECT                         ON public.billing_invoices        TO authenticated;

-- ── AI Assistant ──────────────────────────────────────────────────────────────
GRANT ALL                            ON public.ai_generations          TO service_role;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.ai_generations          TO authenticated;

GRANT ALL                            ON public.ai_prompt_templates     TO service_role;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.ai_prompt_templates     TO authenticated;

-- ── Search ────────────────────────────────────────────────────────────────────
GRANT ALL                            ON public.search_history          TO service_role;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.search_history          TO authenticated;

GRANT ALL                            ON public.search_suggestions      TO service_role;
GRANT SELECT                         ON public.search_suggestions      TO authenticated;
GRANT SELECT                         ON public.search_suggestions      TO anon;

GRANT ALL                            ON public.search_index            TO service_role;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.search_index            TO authenticated;

-- ── Onboarding (fill in service_role which was missing from earlier grant file)
GRANT ALL                            ON public.user_onboarding                   TO service_role;
GRANT ALL                            ON public.workspace_competitors             TO service_role;
GRANT ALL                            ON public.workspace_keywords                TO service_role;
GRANT ALL                            ON public.workspace_content_opportunities   TO service_role;

-- ── Scheduled posts (if table exists) ────────────────────────────────────────
DO $$ BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'scheduled_posts') THEN
    GRANT ALL                            ON public.scheduled_posts TO service_role;
    GRANT SELECT, INSERT, UPDATE, DELETE ON public.scheduled_posts TO authenticated;
  END IF;
END $$;
