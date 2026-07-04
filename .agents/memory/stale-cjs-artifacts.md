---
name: Stale CJS compiled artifacts
description: Compiled .js files co-located with TypeScript source cause 'exports is not defined' in Vite SSR; how to detect and fix.
---

## Rule
Never leave compiled CJS `.js` files alongside `.ts` source files in `src/routes/` or `src/lib/`.

## Why
Vite SSR loads files as ESM. A CJS-compiled file using `Object.defineProperty(exports, ...)` throws `ReferenceError: exports is not defined` at runtime. Because TanStack `useQuery` silently swallows server-function errors (no `isError` handler in most components), the UI just shows an empty state with no visible clue.

## How to detect
- Workflow warns: "Route file ... does not export a Route" — points to a stale compiled route file.
- Search: `find src/ -name "*.js" ! -name "*.config.js"` — any hits are likely stale artifacts.
- Adding a visible error banner to the UI surfaces the hidden error message.

## How to fix
```bash
find src/ -name "*.js" ! -name "*.config.js" -delete
```
Then restart the workflow.
