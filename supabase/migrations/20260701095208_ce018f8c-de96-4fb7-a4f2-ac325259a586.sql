
GRANT SELECT, INSERT, UPDATE, DELETE ON public.blog_posts TO anon;

DROP POLICY IF EXISTS "Anon can read all posts" ON public.blog_posts;
CREATE POLICY "Anon can read all posts" ON public.blog_posts
  FOR SELECT TO anon USING (true);

DROP POLICY IF EXISTS "Anon can insert posts" ON public.blog_posts;
CREATE POLICY "Anon can insert posts" ON public.blog_posts
  FOR INSERT TO anon WITH CHECK (true);

DROP POLICY IF EXISTS "Anon can update posts" ON public.blog_posts;
CREATE POLICY "Anon can update posts" ON public.blog_posts
  FOR UPDATE TO anon USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS "Anon can delete posts" ON public.blog_posts;
CREATE POLICY "Anon can delete posts" ON public.blog_posts
  FOR DELETE TO anon USING (true);

DROP POLICY IF EXISTS "Public read blog images" ON storage.objects;
CREATE POLICY "Public read blog images" ON storage.objects
  FOR SELECT USING (bucket_id = 'blog-images');

DROP POLICY IF EXISTS "Anon manage blog images" ON storage.objects;
CREATE POLICY "Anon manage blog images" ON storage.objects
  FOR ALL TO anon USING (bucket_id = 'blog-images') WITH CHECK (bucket_id = 'blog-images');
