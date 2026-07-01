---
name: TanStack Start API Routes
description: How REST API endpoints are served in this project, and why createAPIFileRoute doesn't work with the lovable.dev vite config.
---

## Rule
Do NOT use `createAPIFileRoute` from `@tanstack/react-start/api` for REST endpoints in this project. The `@lovable.dev/vite-tanstack-config` does not configure the TanStack router plugin to auto-discover API routes, so those files are silently ignored and the React 404 handler takes over.

**Why:** The router plugin auto-generates `routeTree.gen.ts` for page routes (exporting `Route`) but has no API route section. Requests to `/api/v1/*` hit the React SSR handler and return the 404 React component instead of JSON.

**How to apply:** Use a Vite plugin with `configureServer` + `server.middlewares.use()` for development. The actual handler logic lives in `src/lib/api-handler.node.ts` (a plain Node.js module importing `@supabase/supabase-js` directly). The plugin is added via `vite.plugins` in `vite.config.ts` using `defineConfig` from `@lovable.dev/vite-tanstack-config`.

For production builds (Nitro), a separate Nitro server route would be needed — this has not been set up yet.
