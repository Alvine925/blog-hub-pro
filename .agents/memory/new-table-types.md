---
name: Supabase new-table access pattern
description: How to query tables not yet in the generated TypeScript types
---

When a server function queries a table that was added in a migration but types haven't been regenerated yet, cast the admin client:

```ts
const supabase = (await getAdminClient()) as any;
```

**Why:** `src/integrations/supabase/types.ts` is generated from the live schema at a point in time. Migrations applied after the last type-gen cause compile errors on `.from("new_table")`.

**How to apply:** Add the cast in each server function that needs it. Once migrations are applied to the live Supabase project and `supabase gen types typescript` is re-run, the casts can be removed.
