---
name: Supabase edge function verification without Deno/DB access
description: How to sanity-check new Supabase edge functions and migrations when there is no Deno CLI, no supabase CLI auth, and no direct Postgres/Management API access to the target project.
---

This environment has no `deno` binary, no authenticated `supabase` CLI, and no
password/connection for the actual Supabase Postgres instance (only a local
Replit Postgres via `DATABASE_URL`, which is a *different* database and can't
be used to test migrations that reference the app's real tables via FKs).

**How to apply:** when adding/editing `supabase/functions/**` or
`supabase/migrations/**`:
- You cannot `tsc`/`deno check` the edge function TypeScript — it isn't part
  of the root `tsconfig.json` project and Deno isn't installed. Verify by
  careful manual read-through (brace/paren balance, import paths, control
  flow across every branch) instead.
- `npx tsc --noEmit -p .` still typechecks the rest of the app; use it to
  confirm you haven't broken anything under `src/`, and to confirm zero new
  errors reference your new files (pre-existing unrelated errors are fine —
  see `new-table-types.md`).
- You cannot execute migrations against the real project. If asked to "just
  create the migration + edge functions, I'll run them manually," treat SQL
  review (constraint syntax, trigger definitions, RLS policy names/targets)
  as the final verification step — there is no automated way to confirm the
  migration applies cleanly before the user runs it themselves.
