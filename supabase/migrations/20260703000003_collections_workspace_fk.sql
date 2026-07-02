-- ============================================================
-- Add workspace_id to collections + collection_entries
-- Links collections to the workspace that owns them.
-- ============================================================

-- 1. Add workspace_id FK to collections
ALTER TABLE public.collections
  ADD COLUMN IF NOT EXISTS workspace_id UUID
    REFERENCES public.workspaces(id) ON DELETE CASCADE;

-- 2. Assign existing collections to the default workspace
UPDATE public.collections
  SET workspace_id = (
    SELECT id FROM public.workspaces WHERE slug = 'default' LIMIT 1
  )
  WHERE workspace_id IS NULL;

-- 3. Index for workspace-scoped lookups
CREATE INDEX IF NOT EXISTS idx_collections_workspace_id
  ON public.collections (workspace_id);

-- 4. Ensure service_role can manage collections
GRANT SELECT, INSERT, UPDATE, DELETE ON public.collections TO service_role;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.collection_entries TO service_role;
