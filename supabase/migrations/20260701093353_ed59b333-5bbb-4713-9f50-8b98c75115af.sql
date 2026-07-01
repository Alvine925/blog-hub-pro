DROP POLICY IF EXISTS "Authenticated users can insert posts" ON public.blog_posts;
DROP POLICY IF EXISTS "Authenticated users can update posts" ON public.blog_posts;
DROP POLICY IF EXISTS "Authenticated users can delete posts" ON public.blog_posts;

REVOKE EXECUTE ON FUNCTION public.increment_blog_views(TEXT) FROM anon, authenticated;