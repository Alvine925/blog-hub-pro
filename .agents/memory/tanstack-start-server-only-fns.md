---
name: TanStack Start server-only plain functions
description: Why plain async helper functions can silently break client pages via import-protection
---

Files like `apikey.functions.ts` and `webhook.functions.ts` mix `createServerFn(...)` exports (client-safe RPC boundary) with plain `export async function foo() { ... }` helpers that internally do `const { getAdminClient } = await import("./supabase.server")`.

If that same file is statically imported by any route component that's part of the client bundle (e.g. an admin route imports the file for its `createServerFn` exports), Vite's TanStack Start `import-protection` plugin denies the dynamic `*.server.*` import for the whole file — even though the plain helper is only ever called from server-side code paths (a Node API handler, a dynamic `import()` from another server function). The result is a silent client-side error that can leave pages stuck on a loading spinner.

**Why:** the plugin scans the file graph, not per-export usage; tree-shaking doesn't happen before the check runs in dev.

**How to apply:** wrap the plain helper with `createServerOnlyFn` from `@tanstack/react-start`:
```ts
export const validateApiKey = createServerOnlyFn(async (raw: string) => { ... });
```
This keeps the function in the same file (no need to split into a separate `.server.ts` module) while satisfying the import-protection plugin. Apply this pattern whenever a plain async function with a `supabase.server` import lives in a file that's also imported by a client route.
