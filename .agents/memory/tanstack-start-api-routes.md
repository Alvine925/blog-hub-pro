---
name: TanStack Start API routes
description: How to add REST API routes in this TanStack Start + Vite project
---

`createAPIFileRoute` is NOT auto-discovered in this project (uses @lovable.dev/vite-tanstack-config).
**Why:** The Vite config does not scan for API file routes.
**How to apply:** Use a Vite `configureServer` middleware plugin instead. REST API lives in `src/lib/api-handler.node.ts`, wired via a plugin in `vite.config.ts`.
