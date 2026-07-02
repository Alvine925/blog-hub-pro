/**
 * prompt-templates.ts
 *
 * Structured prompt template data for the Integration Center.
 * Templates use {{VARIABLE}} placeholders replaced at generation time.
 * Add new frameworks/platforms here — no component changes needed.
 */

export interface PromptTemplate {
  id: string;
  name: string;
  version: string;
  description: string;
  template_body: string;
  created_at: string;
  updated_at: string;
}

export interface Framework {
  id: string;
  label: string;
  icon: string;
  category: "frontend" | "fullstack" | "backend" | "mobile" | "cms";
  supportsISR: boolean;
  supportsSSR: boolean;
}

export interface AiPlatform {
  id: string;
  label: string;
  icon: string;
  description: string;
}

export interface ContentType {
  id: string;
  label: string;
  endpoint: string;
  description: string;
}

export interface RenderStrategy {
  id: string;
  label: string;
  description: string;
  badge: string;
}

export interface StylingOption {
  id: string;
  label: string;
  description: string;
}

// ── Frameworks ────────────────────────────────────────────────────────────────

export const FRAMEWORKS: Framework[] = [
  { id: "nextjs",       label: "Next.js",        icon: "▲", category: "fullstack", supportsISR: true,  supportsSSR: true  },
  { id: "react",        label: "React",           icon: "⚛", category: "frontend",  supportsISR: false, supportsSSR: false },
  { id: "vue",          label: "Vue",             icon: "🟢", category: "frontend",  supportsISR: false, supportsSSR: false },
  { id: "nuxt",         label: "Nuxt",            icon: "💚", category: "fullstack", supportsISR: false, supportsSSR: true  },
  { id: "angular",      label: "Angular",         icon: "🔴", category: "frontend",  supportsISR: false, supportsSSR: true  },
  { id: "astro",        label: "Astro",           icon: "🚀", category: "fullstack", supportsISR: false, supportsSSR: true  },
  { id: "sveltekit",    label: "SvelteKit",       icon: "🔥", category: "fullstack", supportsISR: false, supportsSSR: true  },
  { id: "laravel",      label: "Laravel",         icon: "🐘", category: "backend",   supportsISR: false, supportsSSR: true  },
  { id: "php",          label: "PHP",             icon: "🐘", category: "backend",   supportsISR: false, supportsSSR: true  },
  { id: "nodejs",       label: "Node.js",         icon: "🟩", category: "backend",   supportsISR: false, supportsSSR: true  },
  { id: "express",      label: "Express",         icon: "🚂", category: "backend",   supportsISR: false, supportsSSR: true  },
  { id: "flutter",      label: "Flutter",         icon: "🦋", category: "mobile",    supportsISR: false, supportsSSR: false },
  { id: "reactnative",  label: "React Native",    icon: "📱", category: "mobile",    supportsISR: false, supportsSSR: false },
  { id: "wordpress",    label: "WordPress",       icon: "📝", category: "cms",       supportsISR: false, supportsSSR: true  },
  { id: "html",         label: "HTML/CSS/JS",     icon: "🌐", category: "frontend",  supportsISR: false, supportsSSR: false },
];

// ── AI Platforms ──────────────────────────────────────────────────────────────

export const AI_PLATFORMS: AiPlatform[] = [
  { id: "cursor",      label: "Cursor",               icon: "⬛", description: "AI-first code editor"      },
  { id: "lovable",     label: "Lovable",              icon: "❤️", description: "AI full-stack app builder"  },
  { id: "windsurf",    label: "Windsurf",             icon: "🌊", description: "Agentic IDE by Codeium"     },
  { id: "bolt",        label: "Bolt",                 icon: "⚡", description: "AI full-stack builder"      },
  { id: "replit",      label: "Replit",               icon: "🔄", description: "Replit AI Agent"            },
  { id: "claudecode",  label: "Claude Code",          icon: "🤖", description: "Anthropic's CLI agent"      },
  { id: "copilot",     label: "GitHub Copilot Agent", icon: "🐙", description: "GitHub Copilot Agent mode"  },
  { id: "vscodeagent", label: "VS Code Agent Mode",   icon: "💙", description: "VS Code built-in agent"     },
];

// ── Content Types ─────────────────────────────────────────────────────────────

export const CONTENT_TYPES: ContentType[] = [
  { id: "blogs",       label: "Blogs",       endpoint: "GET /v1/blogs",       description: "Published blog posts with pagination and filtering" },
  { id: "pages",       label: "Pages",       endpoint: "GET /v1/pages",       description: "Published CMS pages" },
  { id: "categories",  label: "Categories",  endpoint: "GET /v1/categories",  description: "Blog post categories with counts" },
  { id: "tags",        label: "Tags",        endpoint: "GET /v1/tags",        description: "Blog post tags with counts" },
  { id: "media",       label: "Media",       endpoint: "GET /v1/media",       description: "Public media library files" },
  { id: "search",      label: "Search",      endpoint: "GET /v1/search",      description: "Unified full-text search across all content" },
];

// ── Render Strategies ─────────────────────────────────────────────────────────

export const RENDER_STRATEGIES: RenderStrategy[] = [
  { id: "ssr", label: "SSR",  badge: "Server-Side Rendering",    description: "Fetch at request time. Best for personalised or frequently updated content." },
  { id: "ssg", label: "SSG",  badge: "Static Site Generation",   description: "Pre-fetch at build time. Best for performance and SEO with infrequent updates." },
  { id: "isr", label: "ISR",  badge: "Incremental Static Regen", description: "Revalidate static pages on a schedule. Best of SSG + SSR." },
  { id: "csr", label: "CSR",  badge: "Client-Side Rendering",    description: "Fetch in the browser after load. Best for dashboards or auth-gated content." },
];

// ── Styling Options ───────────────────────────────────────────────────────────

export const STYLING_OPTIONS: StylingOption[] = [
  { id: "tailwind",       label: "Tailwind CSS",            description: "Utility-first CSS classes" },
  { id: "bootstrap",      label: "Bootstrap",               description: "Component-based CSS framework" },
  { id: "materialui",     label: "Material UI",             description: "Google Material Design components" },
  { id: "existingstyles", label: "Existing Project Styles", description: "Match the current project's design system" },
  { id: "none",           label: "No Styling",              description: "Plain HTML/markup, style yourself" },
];

// ── Shared endpoint reference block (content) ──────────────────────────────────

export const ENDPOINT_REFERENCE = `| Method | Endpoint | Query params |
|--------|----------|--------------|
| GET | /v1/blogs | page, limit, sort, order, search, category, tag, author, featured, from, to |
| GET | /v1/blogs/:slug | — |
| GET | /v1/blogs/featured | limit |
| GET | /v1/blogs/latest | limit |
| GET | /v1/blogs/:slug/related | limit |
| GET | /v1/pages | page, limit |
| GET | /v1/pages/:slug | — |
| GET | /v1/collections | — |
| GET | /v1/collections/:slug | page, limit |
| GET | /v1/categories | — |
| GET | /v1/tags | — |
| GET | /v1/media | page, limit |
| GET | /v1/search | q, page, limit |`;

// ── Engagement endpoint reference block ────────────────────────────────────────

export const ENGAGEMENT_ENDPOINT_REFERENCE = `| Method | Endpoint | Purpose |
|--------|----------|---------|
| GET | /api/v1/posts/:slug | Enhanced post (includes stats, features, branding, share links, related) |
| POST | /api/v1/posts/:slug/view | Track a page view (fires on load) |
| GET | /api/v1/posts/:slug/likes | Get like count + whether visitor has liked |
| POST | /api/v1/posts/:slug/likes | Like the post |
| DELETE | /api/v1/posts/:slug/likes | Unlike the post |
| GET | /api/v1/posts/:slug/comments | Load threaded comments |
| POST | /api/v1/posts/:slug/comments | Submit a comment |
| POST | /api/v1/posts/:slug/share | Track a share click (channel: facebook/linkedin/x/whatsapp/email) |
| GET | /api/v1/posts/:slug/stats | Get live stats (views, likes, comments, shares) |`;

// ── Per-platform prompt templates ─────────────────────────────────────────────

export const PLATFORM_TEMPLATES: Record<string, PromptTemplate> = {

  // ── CURSOR ────────────────────────────────────────────────────────────────
  cursor: {
    id: "cursor-v2",
    name: "Cursor Integration Prompt",
    version: "v2.0",
    description: "Optimised for Cursor's agent composer and @-file context",
    created_at: "2025-01-01T00:00:00Z",
    updated_at: "2025-07-01T00:00:00Z",
    template_body: `# Lunar CMS Integration — {{FRAMEWORK}}
> Generated for **Cursor** · {{RENDER_STRATEGY}} · {{STYLING}}
> Site name: **{{SITE_NAME}}**

---

## Role
You are an expert senior {{FRAMEWORK}} engineer working inside **Cursor**.
Use the **Agent** tab (Composer) for this task. Do not use inline Chat for file creation.

---

## Objective
Build a fully functional external blog website called **{{SITE_NAME}}** that integrates with the **Lunar CMS REST API**.
The site fetches all content and engagement data from the API. No local database. No hardcoded posts.

Use **{{SITE_NAME}}** throughout: page titles, navbar, footer, meta tags, hero headlines, README.

---

## Before You Write a Single Line

Open the **Cursor file tree** and inspect:
- Existing folder structure (pages/, app/, components/, lib/, services/, hooks/, utils/)
- How data fetching is currently done (fetch, axios, SWR, TanStack Query, etc.)
- Existing environment variable patterns (.env.local, .env)
- Existing routing approach
- Current styling system: **{{STYLING}}**

Use \`@Codebase\` to search before creating any new file.
If a similar file already exists, **extend it — do not duplicate it**.

---

## Step 1 — Environment Variables

Add the following to your \`.env.local\` (never commit this file):

\`\`\`env
{{ENV_VAR_BLOCK}}
\`\`\`

Reference them in code — never hardcode values.

---

## Step 2 — Create a Centralised Lunar CMS Client

Ask Cursor to create **one** reusable API client. Suggested path based on your project:

\`\`\`
lib/lunar-cms.ts   (Next.js / React)
services/cms.ts    (Vue / Nuxt / Angular)
src/api/cms.ts     (SvelteKit)
utils/lunarCms.ts  (other)
\`\`\`

The file must:
- Read \`LUNAR_CMS_API_KEY\` from environment (never expose to the browser directly for SSR)
- Set \`Authorization: Bearer \${key}\` on every request
- Target base URL: \`{{API_BASE_URL}}\`
- Export typed async functions for each selected content endpoint
- Export \`getEnhancedPost(slug)\` that calls \`GET /api/v1/posts/:slug\` (returns stats, features, branding, share links, related)
- Support \`page\` and \`limit\` pagination params
- Throw descriptive errors on non-2xx responses
- Parse the standard response envelope: \`{ success, data, meta }\`

{{SERVICE_CODE_HINT}}

---

## Step 3 — Implement Selected Content Modules

{{ENDPOINT_LIST}}

### Rendering Strategy: {{RENDER_STRATEGY}}
{{RENDER_INSTRUCTIONS}}

### For each module implement:
- [ ] Data fetching via the Lunar CMS client (no inline fetch calls in components)
- [ ] **Loading state** — skeleton or spinner
- [ ] **Error state** — user-friendly message with retry option
- [ ] **Empty state** — clear "no content" message
- [ ] **Pagination** — Previous / Next / page numbers using \`meta.page\` / \`meta.totalPages\`
- [ ] **SEO** — \`<title>\`, \`<meta description>\`, Open Graph tags where the framework supports it

---

## Step 4 — Styling: {{STYLING}}
{{STYLING_INSTRUCTIONS}}

---

## Step 5 — Engagement Features (Likes, Comments, Share, "Powered by")

{{ENGAGEMENT_SECTION}}

---

## Step 6 — Cursor-Specific Checklist

Use Cursor's agent to verify each item:
- [ ] \`@\` reference the env file and confirm variables load
- [ ] Run a test fetch in the terminal: \`curl "{{API_BASE_URL}}/v1/blogs?limit=1" -H "Authorization: Bearer \$LUNAR_CMS_API_KEY"\`
- [ ] Confirm no existing pages are broken
- [ ] Confirm TypeScript types are generated for all API responses
- [ ] Confirm the API key is never logged or exposed in client bundles
- [ ] Like button toggles correctly with optimistic UI
- [ ] Share modal opens with correct platform links and tracks clicks
- [ ] Comments load threaded and comment submission works
- [ ] "Powered by Lunar CMS" banner appears automatically when \`branding.enabled\` is true
- [ ] Site name **{{SITE_NAME}}** appears in navbar, footer, and page titles

---

## API Reference

Base URL: \`{{API_BASE_URL}}\`
Authentication: \`Authorization: Bearer pk_live_your_key_here\`

The API key resolves the workspace automatically. Never send workspace IDs.

### Content Endpoints
{{ENDPOINT_REFERENCE}}

### Engagement Endpoints
{{ENGAGEMENT_ENDPOINT_REFERENCE}}

### Response envelope
\`\`\`json
{ "success": true, "data": [...], "meta": { "page": 1, "limit": 20, "total": 100, "totalPages": 5 } }
\`\`\`

### Error envelope
\`\`\`json
{ "success": false, "error": { "code": "NOT_FOUND", "message": "..." } }
\`\`\`

---

Begin with project inspection using \`@Codebase\`, then implement step by step.
Do not modify unrelated files. Ask before making any structural change.
`,
  },

  // ── LOVABLE ───────────────────────────────────────────────────────────────
  lovable: {
    id: "lovable-v2",
    name: "Lovable Integration Prompt",
    version: "v2.0",
    description: "Optimised for Lovable's full-stack app generation workflow",
    created_at: "2025-01-01T00:00:00Z",
    updated_at: "2025-07-01T00:00:00Z",
    template_body: `# Lunar CMS Integration — {{FRAMEWORK}}
> Generated for **Lovable** · {{RENDER_STRATEGY}} · {{STYLING}}
> Site name: **{{SITE_NAME}}**

---

## Role
You are an expert full-stack engineer working inside **Lovable**.
Lovable will generate and update files directly. Follow these instructions precisely.

---

## Objective
Build a fully functional external blog website called **{{SITE_NAME}}** that integrates with the **Lunar CMS REST API**.

**Critical rules:**
- Analyse the existing codebase before generating anything
- Reuse existing components, layouts, hooks, and services
- Never rebuild functionality that already exists
- Never create parallel architecture alongside existing code
- Use **{{SITE_NAME}}** in the navbar, footer, page titles, hero, and README

---

## Section 1 — Project Analysis

Before generating any code, inspect:
- All existing routes and pages
- All existing components (especially layouts, cards, lists)
- All existing services and API clients
- All existing hooks
- Current styling system: **{{STYLING}}**
- Environment variable naming conventions already used

Extend what exists. Do not start from scratch.

---

## Section 2 — Environment Variables

Add to your project environment (Lovable Secrets or .env):

\`\`\`env
{{ENV_VAR_BLOCK}}
\`\`\`

---

## Section 3 — Lunar CMS API Service

Create (or extend existing) \`src/services/lunarCms.ts\`:

**Requirements:**
- Base URL: \`{{API_BASE_URL}}\`
- Authentication: \`Authorization: Bearer \${LUNAR_CMS_API_KEY}\`
- The API key automatically resolves the correct workspace — never send workspace IDs
- All responses follow: \`{ success: boolean, data: T, meta: PaginationMeta }\`
- Typed interfaces for every content type
- Centralised error handling
- Export \`getEnhancedPost(slug)\` → calls \`GET /api/v1/posts/:slug\` (returns stats, features, branding, share links, related posts)

{{SERVICE_CODE_HINT}}

---

## Section 4 — Required Content Features

Implement the following based on selected content:

{{ENDPOINT_LIST}}

### Rendering: {{RENDER_STRATEGY}}
{{RENDER_INSTRUCTIONS}}

---

## Section 5 — For Every Page/Component

Lovable must implement:

**Blog Listing** (if blogs selected)
- Grid layout of blog cards
- Each card: title, excerpt, featured image, category, published date, read time
- Category filter bar (from \`/v1/categories\`)
- Search input with debounced requests
- Pagination (Previous / Next / page numbers)
- Loading skeleton, error state, empty state

**Blog Detail** (if blogs selected)
- Slug-based route (e.g. \`/blog/[slug]\`)
- Full post content rendering
- SEO metadata: title, description, Open Graph, canonical URL
- Author name and published date
- \`<PostEngagement>\` client component mounted below content (see Section 6)
- \`<PoweredByBanner>\` at the very bottom of every post page (see Section 6)

**Pages** (if pages selected)
- Dynamic slug-based routes
- Full page content rendering
- SEO metadata

**Categories & Tags** (if selected)
- Category/tag index pages
- Filter blog posts by category or tag

**Search** (if selected)
- Search bar with URL query parameter sync
- Debounced API requests (300ms)
- Results list with loading and empty states

---

## Section 6 — Engagement Features (Likes, Comments, Share, "Powered by")

{{ENGAGEMENT_SECTION}}

---

## Section 7 — Styling: {{STYLING}}
{{STYLING_INSTRUCTIONS}}

---

## Section 8 — SEO Requirements

For every public-facing page:
- Dynamic \`<title>\` using CMS content title + **{{SITE_NAME}}**
- \`<meta name="description">\` using excerpt or summary
- Open Graph: \`og:title\`, \`og:description\`, \`og:image\`, \`og:url\`
- Canonical URL tag
- Structured data (Article schema for blog posts)

---

## Section 9 — Error Handling

Handle all these states:
- **Loading** — skeleton UI while fetching
- **Error** — friendly message, retry button
- **Empty** — clear "no content found" message
- **401** — "Authentication failed — check your API key"
- **404** — redirect or friendly 404 page
- **429** — "Too many requests — please wait a moment"
- **500** — "Something went wrong — try again shortly"

Failed engagement calls (likes, comments, view tracking) must fail silently — never block content display.

---

## Section 10 — Acceptance Criteria

Lovable must confirm before finishing:
- [ ] Site name **{{SITE_NAME}}** appears in navbar, footer, and page titles
- [ ] All selected content types are fetching from \`{{API_BASE_URL}}\`
- [ ] Authorization header is set on every request using the env variable
- [ ] No API key appears in client-side JavaScript bundles (for SSR routes)
- [ ] All pages have loading, error, and empty states
- [ ] Pagination works correctly
- [ ] SEO metadata renders correctly in \`<head>\`
- [ ] Like button toggles with optimistic UI
- [ ] Share modal opens and tracks share clicks
- [ ] Comments load threaded and submission shows confirmation or moderation message
- [ ] "Powered by Lunar CMS" banner appears automatically from \`branding.enabled\`
- [ ] Existing pages and features are unaffected
- [ ] No TypeScript errors

---

## API Reference

Base URL: \`{{API_BASE_URL}}\`

### Content Endpoints
{{ENDPOINT_REFERENCE}}

### Engagement Endpoints
{{ENGAGEMENT_ENDPOINT_REFERENCE}}
`,
  },

  // ── WINDSURF ──────────────────────────────────────────────────────────────
  windsurf: {
    id: "windsurf-v2",
    name: "Windsurf Integration Prompt",
    version: "v2.0",
    description: "Optimised for Windsurf's Cascade agent plan-execute workflow",
    created_at: "2025-01-01T00:00:00Z",
    updated_at: "2025-07-01T00:00:00Z",
    template_body: `# Lunar CMS Integration — {{FRAMEWORK}}
> Generated for **Windsurf (Cascade)** · {{RENDER_STRATEGY}} · {{STYLING}}
> Site name: **{{SITE_NAME}}**

---

## Role
You are an expert {{FRAMEWORK}} engineer using **Windsurf's Cascade agent**.

Cascade must follow the plan-inspect-implement-validate cycle:
1. **Inspect** — read the project before touching anything
2. **Plan** — produce an explicit implementation plan
3. **Implement** — make changes incrementally
4. **Validate** — verify every item on the checklist before finishing

Do not skip the planning phase. Do not write code without first reading the project.

---

## Objective
Build a fully functional external blog website called **{{SITE_NAME}}** that integrates with the **Lunar CMS REST API**.
Use **{{SITE_NAME}}** in the navbar, footer, page titles, and meta tags throughout.

---

## Phase 1 — Project Inspection

Cascade must read and document:

\`\`\`
[ ] Project folder structure
[ ] Existing routing (pages-based, app-based, file-based, etc.)
[ ] Existing data-fetching approach (fetch, axios, SWR, TanStack Query, etc.)
[ ] Existing service and API layer files
[ ] Existing hooks and composables
[ ] Existing UI components and layout files
[ ] Existing environment variable patterns
[ ] Styling system: {{STYLING}}
[ ] TypeScript configuration
[ ] Package.json dependencies already installed
\`\`\`

After inspection, output a summary before proceeding.

---

## Phase 2 — Implementation Plan

Before writing code, Cascade must produce a plan containing:

\`\`\`
Files to READ (identify before modifying):


Files to CREATE (only if equivalent does not already exist):


Files to MODIFY (extend, do not replace):


Dependencies to verify are installed:


Potential breaking changes to avoid:
\`\`\`

Only proceed to Phase 3 after the plan is complete.

---

## Phase 3 — Environment Variables

Add to \`.env.local\` (or framework equivalent):

\`\`\`env
{{ENV_VAR_BLOCK}}
\`\`\`

Never hardcode credentials. Never commit env files.

---

## Phase 4 — Lunar CMS API Client

Create or extend a centralised client. Location based on project structure:

\`\`\`
lib/lunar-cms.ts
services/lunarCms.ts
utils/cms.ts
\`\`\`

Requirements:
- Base URL: \`{{API_BASE_URL}}\`
- Auth: \`Authorization: Bearer \${LUNAR_CMS_API_KEY}\` on every request
- The API key resolves the workspace automatically — never send workspace IDs
- Typed response parsing with \`{ success, data, meta }\` envelope
- Reusable pagination support (\`page\`, \`limit\`)
- Export \`getEnhancedPost(slug)\` → \`GET /api/v1/posts/:slug\` (engagement + branding + share + related)
- Centralised error handling (throw on non-2xx)

{{SERVICE_CODE_HINT}}

---

## Phase 5 — Content Implementation

### Rendering Strategy: {{RENDER_STRATEGY}}
{{RENDER_INSTRUCTIONS}}

### Selected content to implement:
{{ENDPOINT_LIST}}

### Requirements for each module:
- [ ] Data fetched exclusively via the Lunar CMS client (no inline fetch in components)
- [ ] **Loading state** — skeleton cards or spinner
- [ ] **Error state** — message + retry button
- [ ] **Empty state** — "No content available" message
- [ ] **Pagination** — page/limit params, Previous/Next/page number controls
- [ ] **SEO** — title, meta description, Open Graph for all public pages
- [ ] Blog post pages must include \`<PostEngagement>\` and \`<PoweredByBanner>\` (see Phase 6)

### Styling: {{STYLING}}
{{STYLING_INSTRUCTIONS}}

---

## Phase 6 — Engagement Features (Likes, Comments, Share, "Powered by")

{{ENGAGEMENT_SECTION}}

---

## Phase 7 — Validation Checklist

Cascade must verify each item before declaring the task complete:

\`\`\`
[ ] curl "{{API_BASE_URL}}/v1/blogs?limit=1" succeeds with Authorization header
[ ] curl "{{API_BASE_URL}}/api/v1/posts/<slug>" returns stats + features + branding
[ ] Environment variables load in all environments (dev + build)
[ ] LUNAR_CMS_API_KEY is NOT exposed in client-side JavaScript
[ ] All selected content types render real CMS data
[ ] Site name "{{SITE_NAME}}" appears in navbar, footer, and page <title>
[ ] Pagination increments and decrements correctly
[ ] Loading, error, and empty states render correctly
[ ] SEO metadata appears in <head> for public pages
[ ] Like button toggles optimistically and calls the API
[ ] Share modal opens, platform buttons open correct URLs, share is tracked
[ ] Comments load threaded; new submission shows confirmation or moderation message
[ ] "Powered by Lunar CMS" banner renders on post pages when branding.enabled is true
[ ] Banner is invisible when branding.enabled is false
[ ] TypeScript compiles with no errors (npx tsc --noEmit)
[ ] Production build succeeds (npm run build or equivalent)
[ ] No existing pages or features are broken
[ ] No new console errors or warnings in the browser
\`\`\`

---

## API Reference

Base URL: \`{{API_BASE_URL}}\`
Authentication: \`Authorization: Bearer pk_live_your_key_here\`

### Content Endpoints
{{ENDPOINT_REFERENCE}}

### Engagement Endpoints
{{ENGAGEMENT_ENDPOINT_REFERENCE}}

### Response envelope
\`\`\`json
{ "success": true, "data": [...], "meta": { "page": 1, "limit": 20, "total": 100, "totalPages": 5 } }
\`\`\`

---

Begin with Phase 1. Output the inspection summary, then present the Phase 2 plan before writing any code.
`,
  },

  // ── BOLT ──────────────────────────────────────────────────────────────────
  bolt: {
    id: "bolt-v2",
    name: "Bolt Integration Prompt",
    version: "v2.0",
    description: "Optimised for Bolt's WebContainer full-stack generation",
    created_at: "2025-01-01T00:00:00Z",
    updated_at: "2025-07-01T00:00:00Z",
    template_body: `# Lunar CMS Integration — {{FRAMEWORK}}
> Generated for **Bolt** · {{RENDER_STRATEGY}} · {{STYLING}}
> Site name: **{{SITE_NAME}}**

---

## Role
You are an expert {{FRAMEWORK}} developer working inside **Bolt**.
Bolt runs in a WebContainer — all files are created and executed in-browser.

---

## Objective
Build a fully functional external blog website called **{{SITE_NAME}}** that integrates with the **Lunar CMS REST API**.
Read the current file structure first. Reuse what exists. Do not rebuild from scratch.
Use **{{SITE_NAME}}** in the navbar, footer, page titles, hero, and README.

---

## Project Inspection

Before generating files, read:
- \`package.json\` — identify installed packages and framework version
- Existing routes/pages folder
- Existing components folder
- Existing API or service files (lib/, services/, api/, utils/)
- Existing env variable usage

**Bolt action:** Use the file explorer panel to inspect before generating.

---

## Environment Variables

In Bolt, create or update \`.env\` with:

\`\`\`env
{{ENV_VAR_BLOCK}}
\`\`\`

> Bolt's WebContainer supports env files. Reference variables via \`import.meta.env\` (Vite) or \`process.env\` (Node.js).

---

## Lunar CMS API Client

Create \`src/lib/lunarCms.ts\` (or equivalent path for this project):

- Base URL: \`{{API_BASE_URL}}\`
- Every request must include: \`Authorization: Bearer \${LUNAR_CMS_API_KEY}\`
- Workspace is auto-resolved from the API key — never send workspace IDs
- Standard response shape: \`{ success: boolean, data: T[], meta: { page, limit, total, totalPages } }\`
- Export \`getEnhancedPost(slug)\` → \`GET /api/v1/posts/:slug\` returns engagement stats, features, branding, share links, related posts

{{SERVICE_CODE_HINT}}

---

## Rendering Strategy: {{RENDER_STRATEGY}}
{{RENDER_INSTRUCTIONS}}

---

## Content to Implement

{{ENDPOINT_LIST}}

### For each content type, generate:

**List page**
- Grid or list layout of content cards
- Pagination (page / limit query params)
- Loading state (skeleton cards)
- Error state (friendly message)
- Empty state (no results message)

**Detail page** (for blogs and pages)
- Slug-based route
- Full content display
- SEO: title, description, Open Graph tags
- Mount \`<PostEngagement>\` client component below content
- Include \`<PoweredByBanner>\` at the bottom of every post page

**Search** (if selected)
- Debounced search input (300ms)
- URL query param sync (\`?q=\`)
- Results list with loading and empty states

---

## Styling: {{STYLING}}
{{STYLING_INSTRUCTIONS}}

---

## Engagement Features (Likes, Comments, Share, "Powered by")

{{ENGAGEMENT_SECTION}}

---

## Bolt-Specific Notes

- Use Bolt's **terminal panel** to run \`npm install\` if any new packages are needed
- Do not add packages that are already installed — check \`package.json\` first
- Use Bolt's **preview panel** to verify each page renders correctly
- Keep all API calls inside service functions — no fetch calls inside JSX/templates
- If Bolt shows a terminal error, fix it before proceeding to the next file

---

## Final Checklist

- [ ] Site name **{{SITE_NAME}}** appears in navbar, footer, and page titles
- [ ] All selected content types display real Lunar CMS data
- [ ] Like button toggles with optimistic UI
- [ ] Share modal opens and tracks clicks
- [ ] Comments load and submission works
- [ ] "Powered by Lunar CMS" banner shows/hides based on \`branding.enabled\`
- [ ] No API key visible in client-side JavaScript

---

## API Reference

Base URL: \`{{API_BASE_URL}}\`

### Content Endpoints
{{ENDPOINT_REFERENCE}}

### Engagement Endpoints
{{ENGAGEMENT_ENDPOINT_REFERENCE}}

---

Start by reading the existing files. Then generate the Lunar CMS client. Then implement each content module one at a time, previewing in Bolt after each module.
`,
  },

  // ── REPLIT ────────────────────────────────────────────────────────────────
  replit: {
    id: "replit-v2",
    name: "Replit Agent Integration Prompt",
    version: "v2.0",
    description: "Optimised for Replit AI Agent in the cloud IDE",
    created_at: "2025-01-01T00:00:00Z",
    updated_at: "2025-07-01T00:00:00Z",
    template_body: `# Lunar CMS Integration — {{FRAMEWORK}}
> Generated for **Replit Agent** · {{RENDER_STRATEGY}} · {{STYLING}}
> Site name: **{{SITE_NAME}}**

---

## Role
You are an expert {{FRAMEWORK}} engineer working in the **Replit AI Agent**.
You have access to the full Replit workspace: file editor, shell, package manager, and secrets.

---

## Objective
Build a fully functional external blog website called **{{SITE_NAME}}** that integrates with the **Lunar CMS REST API**.
This site is standalone. All content and engagement data comes from Lunar CMS. No local database.
Use **{{SITE_NAME}}** in the navbar, footer, page titles, and hero section.

---

## Before Starting

Use the Replit file tree and shell to inspect:

\`\`\`bash
# Read project structure
ls -la

# Check installed packages
cat package.json

# Look for existing API/service files
find . -name "*.ts" -path "*/lib/*" -o -name "*.ts" -path "*/services/*" | head -20

# Check existing env vars
cat .env 2>/dev/null || echo "No .env file found"
\`\`\`

Do not create duplicate files. Extend what already exists.

---

## Secrets Setup

In Replit, add secrets via the **Secrets** panel (lock icon in the sidebar):

| Key | Value |
|-----|-------|
| \`LUNAR_CMS_URL\` | \`{{API_BASE_URL}}\` |
| \`LUNAR_CMS_API_KEY\` | Your Lunar CMS publishable key (\`pk_live_...\`) |

Access in code:
\`\`\`
process.env.LUNAR_CMS_URL
process.env.LUNAR_CMS_API_KEY
\`\`\`

> Replit Secrets are securely injected as environment variables. Never hardcode keys in source files.

---

## Lunar CMS API Client

Create \`lib/lunarCms.ts\` (or the appropriate path for this project):

- Base URL: read from \`process.env.LUNAR_CMS_URL\` (set to \`{{API_BASE_URL}}\`)
- Auth: \`Authorization: Bearer \${process.env.LUNAR_CMS_API_KEY}\`
- API key resolves the workspace automatically — never send workspace IDs
- Handle \`{ success, data, meta }\` response envelope
- Export \`getEnhancedPost(slug)\` → \`GET /api/v1/posts/:slug\` (returns stats, features, branding, share links, related)

{{SERVICE_CODE_HINT}}

---

## Rendering Strategy: {{RENDER_STRATEGY}}
{{RENDER_INSTRUCTIONS}}

---

## Content Modules to Implement

{{ENDPOINT_LIST}}

### For each module:

1. **Service function** in the Lunar CMS client (typed, reusable)
2. **Page/route** fetching from the service
3. **Components** for list, card, and detail views
4. **States:** loading (skeleton), error (message + retry), empty (no content)
5. **Pagination:** Previous / Next controls using \`meta.page\` and \`meta.totalPages\`
6. **SEO metadata** on public pages (title, description, Open Graph)
7. Blog post detail pages must include the \`<PostEngagement>\` and \`<PoweredByBanner>\` components (see next section)

---

## Engagement Features (Likes, Comments, Share, "Powered by")

{{ENGAGEMENT_SECTION}}

---

## Styling: {{STYLING}}
{{STYLING_INSTRUCTIONS}}

---

## Replit Agent Tasks

Ask the Replit Agent to run these shell commands after implementation:

\`\`\`bash
# Test content API connectivity
curl "{{API_BASE_URL}}/v1/blogs?limit=1" \\
  -H "Authorization: Bearer $LUNAR_CMS_API_KEY"

# Test enhanced post API
curl "{{API_BASE_URL}}/api/v1/posts/<your-slug>" \\
  -H "Authorization: Bearer $LUNAR_CMS_API_KEY"

# Type check (if TypeScript)
npx tsc --noEmit

# Start the dev server
npm run dev
\`\`\`

Use the Replit **Webview** to preview and verify each page.

---

## Checklist

- [ ] Secrets are set in Replit Secrets panel (not in .env file in source)
- [ ] Site name **{{SITE_NAME}}** appears in navbar, footer, and page titles
- [ ] Lunar CMS client reads URL and key from environment
- [ ] All selected content types render real data
- [ ] Pagination works correctly
- [ ] Loading, error, and empty states are implemented
- [ ] Like button toggles with optimistic UI; API call succeeds
- [ ] Share modal opens and tracks clicks per platform
- [ ] Comments load threaded; new comments show confirmation or moderation message
- [ ] "Powered by Lunar CMS" banner auto-renders based on \`branding.enabled\`
- [ ] TypeScript compiles without errors
- [ ] Dev server starts successfully (\`npm run dev\`)
- [ ] Existing functionality is not broken

---

## API Reference

Base URL: \`{{API_BASE_URL}}\`
Authentication: \`Authorization: Bearer pk_live_your_key_here\`

### Content Endpoints
{{ENDPOINT_REFERENCE}}

### Engagement Endpoints
{{ENGAGEMENT_ENDPOINT_REFERENCE}}

---

Start by reading the project structure using shell commands. Then implement the Lunar CMS client. Then build each content module, using the Replit Webview to verify after each one.
`,
  },

  // ── CLAUDE CODE ───────────────────────────────────────────────────────────
  claudecode: {
    id: "claudecode-v2",
    name: "Claude Code Integration Prompt",
    version: "v2.0",
    description: "Optimised for Claude Code CLI agent with direct file access",
    created_at: "2025-01-01T00:00:00Z",
    updated_at: "2025-07-01T00:00:00Z",
    template_body: `# Lunar CMS Integration — {{FRAMEWORK}}
> Generated for **Claude Code** · {{RENDER_STRATEGY}} · {{STYLING}}
> Site name: **{{SITE_NAME}}**

---

## Role
You are an expert {{FRAMEWORK}} engineer using **Claude Code** (Anthropic's CLI agent).
You have direct access to the file system. Read files before editing them.

---

## Objective
Build a fully functional external blog website called **{{SITE_NAME}}** that integrates with the **Lunar CMS REST API**.
No local database. No hardcoded posts. Use **{{SITE_NAME}}** throughout (navbar, footer, page titles, README).

---

## Mandatory First Step — Read the Project

Before writing any code:

\`\`\`bash
# Understand the project
cat package.json
ls -R src/ | head -60

# Find existing API or service patterns
grep -r "fetch\|axios\|useQuery" src/ --include="*.ts" --include="*.tsx" -l

# Find existing env variable usage
grep -r "process.env\|import.meta.env" src/ --include="*.ts" --include="*.tsx" -l
\`\`\`

Read the top-3 most relevant existing files before creating anything new.
If a service file already exists, extend it — do not create a parallel one.

---

## Environment Variables

Add to \`.env.local\`:

\`\`\`env
{{ENV_VAR_BLOCK}}
\`\`\`

Confirm they load correctly:
\`\`\`bash
node -e "require('dotenv').config({path:'.env.local'}); console.log(!!process.env.LUNAR_CMS_API_KEY)"
\`\`\`

---

## Lunar CMS API Client

Create a single centralised client. Read existing lib/services files first, then create in the right location:

- Base URL: \`{{API_BASE_URL}}\`
- Authentication: \`Authorization: Bearer \${LUNAR_CMS_API_KEY}\`
- The API key resolves the workspace — never send workspace IDs or collection IDs
- Parse \`{ success, data, meta }\` response envelope
- Export \`getEnhancedPost(slug)\` → \`GET /api/v1/posts/:slug\` — single call returns post data, stats, features, branding, share links, and related posts
- Throw typed errors on non-2xx with status code and message

{{SERVICE_CODE_HINT}}

---

## Rendering Strategy: {{RENDER_STRATEGY}}
{{RENDER_INSTRUCTIONS}}

---

## Content to Implement

{{ENDPOINT_LIST}}

### Per-module requirements:
- Service functions with full TypeScript types
- Page/route component fetching via the CMS client
- Loading state (skeleton or spinner)
- Error state (message + retry)
- Empty state (no content message)
- Pagination using \`page\` / \`limit\` / \`meta.totalPages\`
- SEO: \`<head>\` metadata for all public pages
- Blog post detail pages: mount \`<PostEngagement>\` and \`<PoweredByBanner>\` (see next section)

---

## Engagement Features (Likes, Comments, Share, "Powered by")

{{ENGAGEMENT_SECTION}}

---

## Styling: {{STYLING}}
{{STYLING_INSTRUCTIONS}}

---

## Claude Code Workflow

Use Claude Code's diff-based editing to minimise risk:

1. **Read** each file before editing it (\`cat\` or \`read_file\`)
2. **Edit** using precise targeted changes (not full rewrites)
3. **Test** each change: \`npx tsc --noEmit && npm run build\`
4. **Verify** API calls with curl:

\`\`\`bash
curl "{{API_BASE_URL}}/v1/blogs?limit=1" \\
  -H "Authorization: Bearer $LUNAR_CMS_API_KEY" | jq .

curl "{{API_BASE_URL}}/api/v1/posts/<your-slug>" \\
  -H "Authorization: Bearer $LUNAR_CMS_API_KEY" | jq .stats,.features,.branding
\`\`\`

---

## Completion Checklist

\`\`\`bash
# TypeScript
npx tsc --noEmit

# Build
npm run build

# API connectivity
curl "{{API_BASE_URL}}/v1/blogs?limit=1" -H "Authorization: Bearer $LUNAR_CMS_API_KEY"

# Check no key in client bundle (Next.js example)
grep -r "LUNAR_CMS_API_KEY" .next/static 2>/dev/null && echo "KEY EXPOSED - FIX IMMEDIATELY" || echo "Key safe"
\`\`\`

Manual verify:
- [ ] Site name **{{SITE_NAME}}** appears in navbar, footer, and \`<title>\`
- [ ] Like button toggles optimistically
- [ ] Share modal opens, platform links work, clicks tracked
- [ ] Comments load threaded; submission confirmed or moderated
- [ ] "Powered by Lunar CMS" pill auto-renders based on API \`branding.enabled\`

All checks must pass before the task is complete.

---

## API Reference

Base URL: \`{{API_BASE_URL}}\`

### Content Endpoints
{{ENDPOINT_REFERENCE}}

### Engagement Endpoints
{{ENGAGEMENT_ENDPOINT_REFERENCE}}

### Standard response shape
\`\`\`json
{ "success": true, "data": [...], "meta": { "page": 1, "limit": 20, "total": 100, "totalPages": 5 } }
\`\`\`

---

Begin by reading the project with the shell commands above. Then implement step by step, running the TypeScript check after every file.
`,
  },

  // ── GITHUB COPILOT AGENT ─────────────────────────────────────────────────
  copilot: {
    id: "copilot-v2",
    name: "GitHub Copilot Agent Integration Prompt",
    version: "v2.0",
    description: "Optimised for GitHub Copilot Agent mode in VS Code",
    created_at: "2025-01-01T00:00:00Z",
    updated_at: "2025-07-01T00:00:00Z",
    template_body: `# Lunar CMS Integration — {{FRAMEWORK}}
> Generated for **GitHub Copilot Agent** · {{RENDER_STRATEGY}} · {{STYLING}}
> Site name: **{{SITE_NAME}}**

---

## Role
You are an expert {{FRAMEWORK}} engineer using **GitHub Copilot in Agent mode** (VS Code).
Use the **Chat panel** with \`@workspace\` context and **Agent mode** enabled.

---

## Objective
Build a fully functional external blog website called **{{SITE_NAME}}** that integrates with the **Lunar CMS REST API**.
Use **{{SITE_NAME}}** in the navbar, footer, page titles, and meta tags throughout the project.

---

## How to Use This Prompt in Copilot

1. Open **VS Code**
2. Open **GitHub Copilot Chat** (sidebar)
3. Switch to **Agent mode** using the dropdown in the chat input
4. Type \`@workspace\` before pasting this prompt so Copilot indexes your project
5. Paste the full prompt and press Enter

Copilot Agent will read your workspace, plan changes, and propose file edits.
**Review each proposed change** before accepting.

---

## Project Context

\`@workspace\` — Copilot must read the project and identify:

- Framework version (check \`package.json\`)
- Existing routing structure
- Existing data-fetching patterns
- Existing service / API client files
- Existing environment variable patterns
- Styling system: **{{STYLING}}**

Do not create files that duplicate existing ones. Extend what exists.

---

## Environment Variables

Add to \`.env.local\` (already in .gitignore for Next.js/Vite projects):

\`\`\`env
{{ENV_VAR_BLOCK}}
\`\`\`

Copilot: update any existing env type declarations (\`env.d.ts\` or similar) to include these keys.

---

## Lunar CMS API Client

Ask Copilot to create a centralised API client. Read existing lib/services files first.

\`\`\`
Copilot prompt: "@workspace Create a Lunar CMS API client in the appropriate lib or services folder.
It must read LUNAR_CMS_API_KEY from env, target {{API_BASE_URL}}, set Authorization: Bearer on every
request, export typed functions for each endpoint, and export getEnhancedPost(slug) that calls
GET /api/v1/posts/:slug to return stats, features, branding, share links, and related posts."
\`\`\`

Requirements:
- Base URL: \`{{API_BASE_URL}}\`
- Auth header on every request
- API key resolves workspace — never send workspace IDs
- Typed interfaces for all response shapes
- Pagination support (page, limit params)
- Error handling on non-2xx responses

{{SERVICE_CODE_HINT}}

---

## Rendering Strategy: {{RENDER_STRATEGY}}
{{RENDER_INSTRUCTIONS}}

---

## Content Modules

{{ENDPOINT_LIST}}

### Copilot prompts for each module:

\`\`\`
@workspace Implement [content type] listing page using the lunarCms service.
Include loading skeleton, error state, empty state, and pagination.
Use {{STYLING}} for styling and follow {{FRAMEWORK}} conventions.
\`\`\`

\`\`\`
@workspace Implement [content type] detail page using slug-based routing.
Include SEO metadata in <head> using CMS content fields.
Mount <PostEngagement> client component below post content.
Include <PoweredByBanner branding={post.branding} /> at the bottom of the page.
\`\`\`

---

## Engagement Features (Likes, Comments, Share, "Powered by")

{{ENGAGEMENT_SECTION}}

---

## Styling: {{STYLING}}
{{STYLING_INSTRUCTIONS}}

---

## Copilot Review Checklist

After Copilot proposes each change, verify:
- [ ] File is in the correct location for this project's structure
- [ ] No existing file is being replaced (only extended)
- [ ] Environment variable names match your \`.env.local\`
- [ ] API key is NOT referenced in client-side component files (use server-side for SSR)
- [ ] TypeScript types are correct (\`npx tsc --noEmit\`)
- [ ] Pagination controls work with \`meta.totalPages\`
- [ ] Site name **{{SITE_NAME}}** appears in navbar, footer, and page titles
- [ ] Like, comment, and share features work on post detail pages
- [ ] "Powered by Lunar CMS" banner appears automatically from \`branding.enabled\`

---

## API Reference

Base URL: \`{{API_BASE_URL}}\`
Auth: \`Authorization: Bearer pk_live_your_key_here\`

### Content Endpoints
{{ENDPOINT_REFERENCE}}

### Engagement Endpoints
{{ENGAGEMENT_ENDPOINT_REFERENCE}}

---

Start with: \`@workspace Read this project's structure and tell me: (1) where API clients are stored, (2) how data fetching is done, (3) what styling system is used.\` Then proceed with implementation.
`,
  },

  // ── VS CODE AGENT MODE ────────────────────────────────────────────────────
  vscodeagent: {
    id: "vscodeagent-v2",
    name: "VS Code Agent Mode Integration Prompt",
    version: "v2.0",
    description: "Optimised for VS Code built-in agent mode (Copilot-independent)",
    created_at: "2025-01-01T00:00:00Z",
    updated_at: "2025-07-01T00:00:00Z",
    template_body: `# Lunar CMS Integration — {{FRAMEWORK}}
> Generated for **VS Code Agent Mode** · {{RENDER_STRATEGY}} · {{STYLING}}
> Site name: **{{SITE_NAME}}**

---

## Role
You are an expert {{FRAMEWORK}} engineer using **VS Code Agent Mode**.
You have access to the workspace file system, integrated terminal, and editor.

---

## Objective
Build a fully functional external blog website called **{{SITE_NAME}}** that integrates with the **Lunar CMS REST API**.
Work incrementally. Validate after each step.
Use **{{SITE_NAME}}** in the navbar, footer, page titles, and meta tags.

---

## Step 0 — Workspace Inspection

Use VS Code Agent's file access to read:

- \`package.json\` — framework, version, installed deps
- Root folder structure — identify pages/, src/, app/, components/, lib/, services/
- Any existing API client or service files
- Any existing environment variable usage (\`.env\`, \`.env.local\`)
- Current styling conventions: **{{STYLING}}**

Output a brief summary of findings before proceeding.

---

## Step 1 — Environment Variables

Create or update \`.env.local\` in the workspace root:

\`\`\`env
{{ENV_VAR_BLOCK}}
\`\`\`

Use VS Code Agent to verify the file was created:
\`\`\`bash
cat .env.local
\`\`\`

---

## Step 2 — Lunar CMS API Client

Create a centralised service. Use the terminal to verify the path makes sense for this project:

\`\`\`bash
ls src/lib 2>/dev/null || ls src/services 2>/dev/null || ls lib 2>/dev/null
\`\`\`

Place the client where other API services live. If none exist, create \`src/lib/lunarCms.ts\`.

Client requirements:
- Base URL: \`{{API_BASE_URL}}\`
- Every request: \`Authorization: Bearer \${LUNAR_CMS_API_KEY}\`
- Workspace resolved by API key — never send workspace or collection IDs
- Full TypeScript types for all response shapes
- Standard envelope: \`{ success, data, meta }\`
- Pagination: \`page\` and \`limit\` params
- Export \`getEnhancedPost(slug)\` → \`GET /api/v1/posts/:slug\` (engagement stats + features + branding + share + related)

{{SERVICE_CODE_HINT}}

Test the client from the VS Code terminal:
\`\`\`bash
curl "{{API_BASE_URL}}/v1/blogs?limit=1" \\
  -H "Authorization: Bearer $LUNAR_CMS_API_KEY"
\`\`\`

---

## Step 3 — Rendering Strategy: {{RENDER_STRATEGY}}
{{RENDER_INSTRUCTIONS}}

---

## Step 4 — Implement Content Modules

{{ENDPOINT_LIST}}

### For each module use this pattern:
1. Add a typed function to the Lunar CMS client
2. Create a page/route that calls the client function
3. Create a list component and detail component
4. Implement loading, error, and empty states
5. Implement pagination controls
6. Add SEO \`<head>\` metadata for public pages
7. For blog post detail pages: mount \`<PostEngagement>\` and \`<PoweredByBanner>\` (see Step 5)
8. Run \`npx tsc --noEmit\` after each file — fix errors before moving on

---

## Step 5 — Engagement Features (Likes, Comments, Share, "Powered by")

{{ENGAGEMENT_SECTION}}

---

## Step 6 — Styling: {{STYLING}}
{{STYLING_INSTRUCTIONS}}

---

## Step 7 — Terminal Verification

Run these checks in the VS Code integrated terminal:

\`\`\`bash
# TypeScript
npx tsc --noEmit

# Build
npm run build

# Dev server (verify in browser)
npm run dev
\`\`\`

---

## Acceptance Checklist

- [ ] \`LUNAR_CMS_URL\` and \`LUNAR_CMS_API_KEY\` load from env
- [ ] Site name **{{SITE_NAME}}** appears in navbar, footer, and \`<title>\` tags
- [ ] All selected content types display real Lunar CMS data
- [ ] Loading, error, and empty states visible in browser
- [ ] Pagination navigates between pages correctly
- [ ] SEO metadata in \`<head>\` for public pages
- [ ] Like button toggles with optimistic UI
- [ ] Share modal opens; share clicks are tracked per platform
- [ ] Comments load threaded; submission shows confirmation or moderation message
- [ ] "Powered by Lunar CMS" banner auto-renders from \`branding.enabled\`
- [ ] TypeScript compiles without errors
- [ ] Production build succeeds
- [ ] No existing features broken
- [ ] API key not visible in client-side JavaScript bundle

---

## API Reference

Base URL: \`{{API_BASE_URL}}\`

### Content Endpoints
{{ENDPOINT_REFERENCE}}

### Engagement Endpoints
{{ENGAGEMENT_ENDPOINT_REFERENCE}}

---

Begin with Step 0. Read the workspace. Output a summary. Then proceed step by step using the VS Code terminal to verify each stage.
`,
  },
};

// ── Universal Fallback Template ────────────────────────────────────────────────

export const UNIVERSAL_TEMPLATE: PromptTemplate = {
  id: "universal-v2",
  name: "Universal Integration Prompt",
  version: "v2.0",
  description: "Works with any framework and AI coding platform",
  created_at: "2025-01-01T00:00:00Z",
  updated_at: "2025-07-01T00:00:00Z",
  template_body: `# Lunar CMS Integration — {{FRAMEWORK}} + {{AI_PLATFORM}}
> Site name: **{{SITE_NAME}}**

## Your Task
You are building a fully functional external blog website called **{{SITE_NAME}}** that integrates with the **Lunar CMS REST API**.
No local database. No hardcoded posts. Use **{{SITE_NAME}}** throughout (navbar, footer, page titles, README).

---

## Step 1 — Inspect the Project First
Before writing any code:
1. Read the existing project structure.
2. Identify the folder conventions (pages/, components/, lib/, utils/, services/, etc.).
3. Identify the existing styling system ({{STYLING}}).
4. Note any existing API service patterns already used in the project.
5. Do NOT break any existing functionality.

---

## Step 2 — API Configuration

### Base URL
\`\`\`
{{API_BASE_URL}}
\`\`\`

### Authentication
All requests require a Bearer token in the Authorization header:
\`\`\`
Authorization: Bearer {{API_KEY_PLACEHOLDER}}
\`\`\`

### Environment Variable
Store the API key securely as an environment variable. Never hardcode it.
\`\`\`
{{ENV_VAR_BLOCK}}
\`\`\`

---

## Step 3 — Create a Centralised API Service

Create a single reusable API client in a sensible location for the project (e.g. \`lib/lunar-cms.ts\`, \`services/cms.js\`, or equivalent for {{FRAMEWORK}}).

The service must:
- Read the API key from the environment variable
- Set the Authorization header on every request
- Export typed functions for each content endpoint
- Export \`getEnhancedPost(slug)\` → \`GET /api/v1/posts/:slug\` (returns stats, features, branding, share links, related)
- Handle HTTP errors (non-2xx) and throw descriptive errors
- Support pagination parameters (page, limit)
- Never expose the API key to the client-side (for SSR/SSG frameworks)

\`\`\`
{{SERVICE_CODE_HINT}}
\`\`\`

---

## Step 4 — Endpoints to Implement

{{ENDPOINT_LIST}}

### Response Contract
Every successful response has the shape:
\`\`\`json
{
  "success": true,
  "data": [...],
  "meta": { "page": 1, "limit": 20, "total": 100, "totalPages": 5 }
}
\`\`\`

Every error response has the shape:
\`\`\`json
{
  "success": false,
  "error": { "code": "NOT_FOUND", "message": "The requested resource was not found." }
}
\`\`\`

---

## Step 5 — Rendering Strategy: {{RENDER_STRATEGY}}

{{RENDER_INSTRUCTIONS}}

---

## Step 6 — Engagement Features (Likes, Comments, Share, "Powered by")

{{ENGAGEMENT_SECTION}}

---

## Step 7 — Styling: {{STYLING}}

{{STYLING_INSTRUCTIONS}}

---

## Step 8 — Implementation Requirements

For every page/component you create:
- [ ] Implement **loading states**
- [ ] Implement **error states**
- [ ] Implement **empty states**
- [ ] Support **pagination** using \`page\` and \`limit\` query parameters
- [ ] Build **SEO-friendly** markup with title, meta description, and Open Graph tags
- [ ] Keep components **modular**
- [ ] Follow **{{FRAMEWORK}}** best practices
- [ ] Use site name **{{SITE_NAME}}** in navbar, footer, and \`<title>\` tags

---

## Available Endpoints Reference

### Content Endpoints
{{ENDPOINT_REFERENCE}}

### Engagement Endpoints
{{ENGAGEMENT_ENDPOINT_REFERENCE}}

---

Begin by inspecting the project. Then implement the integration step by step.
Do not modify any existing pages, routes, or components unless explicitly needed.
`,
};
