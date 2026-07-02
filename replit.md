# Lunar CMS

A full-featured headless CMS admin dashboard built with TanStack Start, React 19, Tailwind CSS v4, and Supabase.

## Stack

- **Framework**: TanStack Start (Vite + TanStack Router)
- **UI**: React 19, Tailwind CSS v4, Radix UI, shadcn/ui components
- **Backend**: Supabase (PostgreSQL + Auth + Edge Functions)
- **Rich text**: Tiptap
- **Package manager**: npm

## Running the app

```bash
npm run dev
```

The dev server starts on port 5000.

## Architecture

- `src/routes/` — TanStack file-based routes (admin, workspace, blog, onboarding)
- `src/lib/` — Server functions, services, and utilities
- `src/components/` — Shared React components
- `src/integrations/supabase/` — Supabase client (browser + server)
- `supabase/` — Database migrations and edge functions

## Key features

- Multi-workspace admin dashboard
- Blog post editor (Tiptap rich text)
- Custom collections (flexible content types)
- Media library
- API Keys management (pk_live_ / sk_live_)
- Webhooks
- Analytics
- AI Assistant
- Integration Center with prompt generator
- **Developer Documentation Engine** (dynamic, auto-generated from EndpointRegistry)

## Developer Documentation Engine

Files added in this project:

| File | Purpose |
|------|---------|
| `src/lib/EndpointRegistry.ts` | Single source of truth for all REST endpoints |
| `src/lib/ParameterParser.ts` | Parameter list building and formatting |
| `src/lib/ExampleGenerator.ts` | Code snippets in 8 languages |
| `src/lib/DocumentationService.ts` | Orchestrates doc generation from registry |
| `src/lib/DocumentationSearch.ts` | Client-side search index |
| `src/lib/DocumentationRenderer.ts` | Convenience re-exports for UI |
| `src/routes/admin.workspaces.$id.developer.tsx` | Full documentation UI route |

Access via: **Workspace → Developer Docs** in the workspace sidebar.

To add a new endpoint: append a definition to `ENDPOINT_REGISTRY` in `EndpointRegistry.ts`. All docs, examples, parameters, and search update automatically.

## Environment variables

Set in `.env` (Supabase credentials already present):

- `SUPABASE_URL`
- `SUPABASE_PUBLISHABLE_KEY`
- `SUPABASE_PROJECT_ID`
- `SESSION_SECRET`

## User preferences

- Keep existing project structure — do not restructure or migrate the stack.
