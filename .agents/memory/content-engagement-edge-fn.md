---
name: Content engagement edge function
description: Architecture and gotchas for the content-engagement Supabase edge function covering news/articles/products.
---

## Rule
The `supabase/functions/content-engagement/` edge function handles likes, comments, view tracking, shares, stats, and related content for News, Articles, and Products in one unified function.

## How it works
- URL routing: `/{news|articles|products}/:slug/{likes|comments|view|share|stats|related}` and `/comments/{news|articles|products}/:id` for moderation
- `services/ContentType.ts` is the single config map: maps URL segment → table names, id column, bump RPC name, etc.
- `services/GenericLookup.ts` resolves content by workspace_id + slug; also fires the daily rollup bump (fire-and-forget).
- `bumpFn` naming: `bump_news_engagement_daily`, `bump_articles_engagement_daily`, `bump_products_engagement_daily`. Param naming is `p_${idCol.replace("_id","")}_id` (e.g. `news_id` → `p_news_id`).
- View dedup: 30-minute per-visitor window using `created_at >= now - 30min` check before inserting.
- Comment moderation requires secret key + `manage:comments` permission.

## EndpointRegistry gotcha
`QueryParam.type` is a union of `"string" | "boolean" | "integer" | "enum"` — do NOT use `"number"`. Also need to add `functionName?: string` and `requestBody?: object` as optional fields to `EndpointDefinition` interface if adding edge-fn-backed endpoints; they were added during content-engagement work.

**Why:** The type constraint isn't obvious from reading the entries, causing TS errors when adding new entries.
