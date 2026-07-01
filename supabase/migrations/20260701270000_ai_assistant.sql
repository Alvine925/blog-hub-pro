-- ============================================================
-- AI ASSISTANT — generation jobs and prompt history
-- ============================================================

CREATE TABLE IF NOT EXISTS public.ai_generations (
  id             UUID   NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  workspace_id   UUID   REFERENCES public.workspaces(id) ON DELETE SET NULL,
  -- linked post (if result was applied to a post)
  post_id        UUID   REFERENCES public.blog_posts(id) ON DELETE SET NULL,
  -- who triggered the generation
  actor_id       TEXT,
  actor_name     TEXT   NOT NULL DEFAULT 'Admin',
  -- generation type
  task           TEXT   NOT NULL
                        CHECK (task IN (
                          'generate_article','rewrite','translate','summarize',
                          'generate_seo','generate_faqs','generate_metadata',
                          'generate_categories','generate_tags',
                          'generate_image_prompt','custom'
                        )),
  -- model used
  model          TEXT   NOT NULL DEFAULT 'gpt-4o-mini',
  -- parameters passed to the model
  prompt         TEXT   NOT NULL,
  system_prompt  TEXT,
  parameters     JSONB  NOT NULL DEFAULT '{}'::jsonb,
  -- output
  result         TEXT,
  result_tokens  INTEGER,
  prompt_tokens  INTEGER,
  -- cost in USD (calculated from token counts)
  cost_usd       NUMERIC(10,6),
  status         TEXT   NOT NULL DEFAULT 'pending'
                        CHECK (status IN ('pending','running','completed','failed')),
  error          TEXT,
  duration_ms    INTEGER,
  -- whether the output was applied / accepted by the user
  accepted       BOOLEAN,
  created_at     TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  completed_at   TIMESTAMP WITH TIME ZONE
);

CREATE INDEX IF NOT EXISTS ai_generations_workspace_idx  ON public.ai_generations (workspace_id, created_at DESC);
CREATE INDEX IF NOT EXISTS ai_generations_post_idx       ON public.ai_generations (post_id);
CREATE INDEX IF NOT EXISTS ai_generations_task_idx       ON public.ai_generations (task);
CREATE INDEX IF NOT EXISTS ai_generations_status_idx     ON public.ai_generations (status);

-- Reusable prompt templates
CREATE TABLE IF NOT EXISTS public.ai_prompt_templates (
  id           UUID  NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  workspace_id UUID  REFERENCES public.workspaces(id) ON DELETE CASCADE,
  name         TEXT  NOT NULL,
  task         TEXT  NOT NULL,
  system_prompt TEXT,
  user_prompt  TEXT  NOT NULL,
  variables    JSONB NOT NULL DEFAULT '[]'::jsonb,
  is_default   BOOLEAN NOT NULL DEFAULT FALSE,
  created_at   TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at   TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS ai_prompt_templates_workspace_idx ON public.ai_prompt_templates (workspace_id);

DROP TRIGGER IF EXISTS update_ai_prompt_templates_updated_at ON public.ai_prompt_templates;
CREATE TRIGGER update_ai_prompt_templates_updated_at
  BEFORE UPDATE ON public.ai_prompt_templates
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- Default prompt templates
INSERT INTO public.ai_prompt_templates (name, task, system_prompt, user_prompt, is_default) VALUES
  ('Article Generator', 'generate_article',
    'You are an expert content writer. Write professional, SEO-friendly blog articles.',
    'Write a complete blog article about: {{topic}}\n\nTone: {{tone}}\nTarget audience: {{audience}}\nTarget length: {{length}} words',
    TRUE),
  ('SEO Optimizer', 'generate_seo',
    'You are an SEO specialist. Generate optimized meta titles and descriptions.',
    'Generate an SEO title and meta description for this article:\n\nTitle: {{title}}\nExcerpt: {{excerpt}}',
    TRUE),
  ('Content Rewriter', 'rewrite',
    'You are a professional editor. Rewrite content to improve clarity and engagement.',
    'Rewrite the following content. Tone: {{tone}}.\n\n{{content}}',
    TRUE),
  ('FAQ Generator', 'generate_faqs',
    'You are a content strategist. Generate helpful FAQ sections.',
    'Generate {{count}} frequently asked questions and answers for this topic: {{topic}}',
    TRUE),
  ('Translator', 'translate',
    'You are a professional translator. Preserve tone and formatting.',
    'Translate the following content to {{language}}:\n\n{{content}}',
    TRUE)
ON CONFLICT DO NOTHING;
