-- Fix missing service_role grants on news and faqs tables.
-- The original migration (20260703060000_faqs_and_news.sql) only granted
-- access to anon and authenticated, causing "permission denied for table news/faqs"
-- errors when the server-side admin client (service_role key) queries these tables.

GRANT SELECT, INSERT, UPDATE, DELETE ON public.news TO service_role;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.faqs TO service_role;
