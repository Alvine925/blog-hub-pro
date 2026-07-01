-- Grant table-level privileges so RLS policies can actually fire.
-- Without these, Postgres returns "permission denied" before RLS is checked.

GRANT SELECT, INSERT, UPDATE, DELETE ON user_onboarding               TO authenticated, anon;
GRANT SELECT, INSERT, UPDATE, DELETE ON workspace_competitors          TO authenticated, anon;
GRANT SELECT, INSERT, UPDATE, DELETE ON workspace_keywords             TO authenticated, anon;
GRANT SELECT, INSERT, UPDATE, DELETE ON workspace_content_opportunities TO authenticated, anon;
