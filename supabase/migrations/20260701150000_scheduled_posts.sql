-- ============================================================
-- SCHEDULED POSTS — add scheduled_at column to blog_posts
-- ============================================================

ALTER TABLE public.blog_posts
  ADD COLUMN IF NOT EXISTS scheduled_at TIMESTAMP WITH TIME ZONE;

CREATE INDEX IF NOT EXISTS idx_blog_posts_scheduled
  ON public.blog_posts (scheduled_at)
  WHERE status = 'scheduled' AND scheduled_at IS NOT NULL;

COMMENT ON COLUMN public.blog_posts.scheduled_at IS
  'When status=scheduled, this is the UTC time the post will auto-publish.';
