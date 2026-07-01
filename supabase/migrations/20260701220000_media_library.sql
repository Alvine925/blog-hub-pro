-- ============================================================
-- MEDIA LIBRARY — persistent metadata table
-- ============================================================
-- Tracks metadata for files stored in Supabase Storage.
-- The storage bucket itself is managed separately; this table
-- provides search, tagging, folder organisation, and audit trails.
-- ============================================================

CREATE TABLE IF NOT EXISTS public.media_files (
  id            UUID        NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  workspace_id  UUID        REFERENCES public.workspaces(id) ON DELETE SET NULL,
  bucket        TEXT        NOT NULL DEFAULT 'blog-images',
  storage_path  TEXT        NOT NULL UNIQUE,
  file_name     TEXT        NOT NULL,
  mime_type     TEXT        NOT NULL DEFAULT 'application/octet-stream',
  size_bytes    BIGINT      NOT NULL DEFAULT 0,
  width_px      INTEGER,
  height_px     INTEGER,
  alt_text      TEXT,
  caption       TEXT,
  folder        TEXT        NOT NULL DEFAULT '/',
  tags          JSONB       NOT NULL DEFAULT '[]'::jsonb,
  metadata      JSONB       NOT NULL DEFAULT '{}'::jsonb,
  uploaded_by   TEXT,
  created_at    TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at    TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS media_files_workspace_idx   ON public.media_files (workspace_id);
CREATE INDEX IF NOT EXISTS media_files_folder_idx      ON public.media_files (folder);
CREATE INDEX IF NOT EXISTS media_files_mime_type_idx   ON public.media_files (mime_type);
CREATE INDEX IF NOT EXISTS media_files_created_at_idx  ON public.media_files (created_at DESC);
CREATE INDEX IF NOT EXISTS media_files_fts_idx         ON public.media_files
  USING gin(to_tsvector('english', coalesce(file_name,'') || ' ' || coalesce(alt_text,'') || ' ' || coalesce(caption,'')));

-- Folders are virtual (just a path prefix), but we track them explicitly
-- so users can create empty folders and rename them.
CREATE TABLE IF NOT EXISTS public.media_folders (
  id          UUID  NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  workspace_id UUID REFERENCES public.workspaces(id) ON DELETE CASCADE,
  name        TEXT  NOT NULL,
  path        TEXT  NOT NULL UNIQUE,
  parent_path TEXT  NOT NULL DEFAULT '/',
  created_at  TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS media_folders_workspace_idx    ON public.media_folders (workspace_id);
CREATE INDEX IF NOT EXISTS media_folders_parent_path_idx  ON public.media_folders (parent_path);

-- auto-update updated_at
DROP TRIGGER IF EXISTS update_media_files_updated_at ON public.media_files;
CREATE TRIGGER update_media_files_updated_at
  BEFORE UPDATE ON public.media_files
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
