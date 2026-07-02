-- ============================================================
-- Link blog_posts to workspaces
-- ============================================================
-- 1. Add workspace_id FK column
-- 2. Assign existing posts to the default workspace
-- 3. Fix status constraint to include 'scheduled'
-- ============================================================

-- 1. Add workspace_id column with FK to workspaces
ALTER TABLE public.blog_posts
  ADD COLUMN IF NOT EXISTS workspace_id UUID
    REFERENCES public.workspaces(id)
    ON DELETE SET NULL;

-- 2. Assign any un-linked posts to the default workspace
UPDATE public.blog_posts
SET workspace_id = (
  SELECT id FROM public.workspaces WHERE slug = 'default' LIMIT 1
)
WHERE workspace_id IS NULL;

-- 3. Index for fast workspace-scoped queries
CREATE INDEX IF NOT EXISTS idx_blog_posts_workspace_id
  ON public.blog_posts (workspace_id);

-- 4. Fix status constraint — original migration omitted 'scheduled'
ALTER TABLE public.blog_posts
  DROP CONSTRAINT IF EXISTS blog_posts_status_check;

ALTER TABLE public.blog_posts
  ADD CONSTRAINT blog_posts_status_check
  CHECK (status IN ('draft', 'published', 'scheduled'));
