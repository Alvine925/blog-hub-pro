---
name: Dual REST API gateway implementations
description: Two separate REST gateways exist for the public content API — must stay in sync when adding content types.
---

Lunar CMS has two independent implementations of the public REST API that must be updated together (or deliberately scoped differently):

1. `supabase/functions/content-router/index.ts` (+ `services/*Service.ts`, `_shared/transformer.ts`, `_shared/permissions.ts`) — the production edge-function gateway. Full-featured: blogs, pages (stub), collections, media, categories, tags, search, and (as of this session) faqs/news.
2. `src/lib/api-handler.node.ts` — a Node/Vite dev-server middleware version. This one is intentionally **blog-only** (posts + engagement: likes/comments/shares/views) — it does not and should not mirror pages/collections/media/faqs/news. Confirmed by grep: no `/api/v1/pages|collections|media|faqs|news` routes exist there by design.

**Why:** api-handler.node.ts exists specifically to power the live blog engagement widgets in dev; it is not a full gateway mirror. Assuming it needs every content-router endpoint would be scope creep.

**How to apply:** When adding a new content type's public read endpoints, update content-router + its services + `_shared/permissions.ts` (PUBLISHABLE/SECRET_PERMISSIONS) + `_shared/transformer.ts` + `src/lib/EndpointRegistry.ts` (for docs) + `src/lib/apikey.functions.ts` and `src/routes/admin.api-keys.tsx` (permission label/default maps). Do NOT touch api-handler.node.ts unless the new type also needs engagement features.
