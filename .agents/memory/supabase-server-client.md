---
name: Supabase Server Client
description: How supabase.server.ts is set up and why it uses the anon key instead of service role.
---

## Rule
`src/lib/supabase.server.ts` exports `getAdminClient()` which uses `SUPABASE_URL` + `SUPABASE_PUBLISHABLE_KEY` (the anon/public key), NOT a service role key. Auth is deferred by design.

**Why:** The service-role key is not injected into the dev/preview runtime. All database operations go through the anon key with open RLS policies. This is intentional for the MVP — tighten RLS and add auth before production.

**How to apply:** All server functions and API handlers use `getAdminClient()`. The `BLOG_BUCKET = "blog-images"` constant is also exported from this file. The api_keys migration (`20260701130000_api_keys.sql`) uses open RLS policies for the same reason.
