-- Onboarding & Workspace Intelligence Migration

-- Extend workspaces with intelligence fields
ALTER TABLE workspaces ADD COLUMN IF NOT EXISTS user_id uuid REFERENCES auth.users(id) ON DELETE SET NULL;
ALTER TABLE workspaces ADD COLUMN IF NOT EXISTS website_url text;
ALTER TABLE workspaces ADD COLUMN IF NOT EXISTS industry text;
ALTER TABLE workspaces ADD COLUMN IF NOT EXISTS target_audience text;
ALTER TABLE workspaces ADD COLUMN IF NOT EXISTS business_model text;
ALTER TABLE workspaces ADD COLUMN IF NOT EXISTS brand_voice text;
ALTER TABLE workspaces ADD COLUMN IF NOT EXISTS language text DEFAULT 'en';
ALTER TABLE workspaces ADD COLUMN IF NOT EXISTS location text;
ALTER TABLE workspaces ADD COLUMN IF NOT EXISTS social_links jsonb DEFAULT '{}';
ALTER TABLE workspaces ADD COLUMN IF NOT EXISTS ai_context jsonb DEFAULT '{}';
ALTER TABLE workspaces ADD COLUMN IF NOT EXISTS content_pillars text[] DEFAULT '{}';
ALTER TABLE workspaces ADD COLUMN IF NOT EXISTS selected_collections text[] DEFAULT '{}';

-- User onboarding state
CREATE TABLE IF NOT EXISTS user_onboarding (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id uuid REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL UNIQUE,
  step text NOT NULL DEFAULT 'welcome',
  -- steps: welcome, website, analyzing, collections, preparing, complete
  workspace_id uuid REFERENCES workspaces(id) ON DELETE SET NULL,
  website_url text,
  analysis_data jsonb,
  completed_at timestamptz,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

CREATE INDEX IF NOT EXISTS user_onboarding_user_id_idx ON user_onboarding(user_id);

-- Workspace competitors
CREATE TABLE IF NOT EXISTS workspace_competitors (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  workspace_id uuid REFERENCES workspaces(id) ON DELETE CASCADE NOT NULL,
  name text NOT NULL,
  website text,
  description text,
  strengths text[] DEFAULT '{}',
  weaknesses text[] DEFAULT '{}',
  content_strategy text,
  created_at timestamptz DEFAULT now()
);

CREATE INDEX IF NOT EXISTS workspace_competitors_workspace_id_idx ON workspace_competitors(workspace_id);

-- Workspace keywords
CREATE TABLE IF NOT EXISTS workspace_keywords (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  workspace_id uuid REFERENCES workspaces(id) ON DELETE CASCADE NOT NULL,
  keyword text NOT NULL,
  volume text,
  difficulty text,
  opportunity_type text DEFAULT 'general',
  created_at timestamptz DEFAULT now()
);

CREATE INDEX IF NOT EXISTS workspace_keywords_workspace_id_idx ON workspace_keywords(workspace_id);

-- Workspace content opportunities
CREATE TABLE IF NOT EXISTS workspace_content_opportunities (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  workspace_id uuid REFERENCES workspaces(id) ON DELETE CASCADE NOT NULL,
  title text NOT NULL,
  type text DEFAULT 'blog',
  topic text,
  reason text,
  priority text DEFAULT 'medium',
  created_at timestamptz DEFAULT now()
);

CREATE INDEX IF NOT EXISTS workspace_content_opportunities_workspace_id_idx ON workspace_content_opportunities(workspace_id);

-- RLS policies
ALTER TABLE user_onboarding ENABLE ROW LEVEL SECURITY;
CREATE POLICY "users_own_onboarding" ON user_onboarding
  FOR ALL USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

ALTER TABLE workspace_competitors ENABLE ROW LEVEL SECURITY;
CREATE POLICY "workspace_competitors_open" ON workspace_competitors FOR ALL USING (true) WITH CHECK (true);

ALTER TABLE workspace_keywords ENABLE ROW LEVEL SECURITY;
CREATE POLICY "workspace_keywords_open" ON workspace_keywords FOR ALL USING (true) WITH CHECK (true);

ALTER TABLE workspace_content_opportunities ENABLE ROW LEVEL SECURITY;
CREATE POLICY "workspace_content_opportunities_open" ON workspace_content_opportunities FOR ALL USING (true) WITH CHECK (true);
