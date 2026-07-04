/**
 * PromptGeneratorService.ts
 *
 * Takes user selections from the Integration Center wizard and produces:
 * 1. A complete AI implementation prompt tailored to the chosen platform
 * 2. A documentation block (env vars, examples, engagement, troubleshooting)
 *
 * All logic lives here — React components only call generatePrompt().
 */

import {
  UNIVERSAL_TEMPLATE,
  PLATFORM_TEMPLATES,
  ENDPOINT_REFERENCE,
  ENGAGEMENT_ENDPOINT_REFERENCE,
  FRAMEWORKS,
  AI_PLATFORMS,
  CONTENT_TYPES,
  RENDER_STRATEGIES,
  STYLING_OPTIONS,
} from "./prompt-templates";

// ── Public types ──────────────────────────────────────────────────────────────

export interface GeneratorSelections {
  frameworkId: string;
  aiPlatformId: string;
  contentTypeIds: string[];
  renderStrategyId: string;
  stylingId: string;
  apiBaseUrl: string;
  siteName?: string;
  apiKeyPlaceholder?: string;
}

export interface GeneratedOutput {
  prompt: string;
  documentation: string;
  template_version: string;
  generated_at: string;
  selections: {
    framework: string;
    aiPlatform: string;
    contentTypes: string[];
    renderStrategy: string;
    styling: string;
    siteName: string;
  };
}

// ── Internal helpers ──────────────────────────────────────────────────────────

function renderInstructions(renderStrategyId: string, frameworkId: string): string {
  switch (renderStrategyId) {
    case "ssr":
      return `Use **Server-Side Rendering**. Fetch content on the server for every request.
- For Next.js: use async Server Components (App Router) or \`getServerSideProps\` (Pages Router)
- For Nuxt: use \`useFetch\` or \`useAsyncData\` with server context
- For SvelteKit: use the \`load\` function in \`+page.server.ts\`
- For Angular: use \`HttpClient\` in a resolver or server-side service
- For other frameworks: fetch in the server handler/controller before returning the view
- Set appropriate \`Cache-Control\` headers (e.g. \`s-maxage=60, stale-while-revalidate=300\`)`;

    case "ssg":
      return `Use **Static Site Generation**. Pre-fetch all content at build time.
- For Next.js: use \`generateStaticParams\` + async page components (App Router), or \`getStaticProps\` + \`getStaticPaths\` (Pages Router)
- For Nuxt: use \`useAsyncData\` with Nitro pre-rendering
- For Astro: fetch directly in frontmatter — Astro is static by default
- For SvelteKit: use \`+page.server.ts\` \`load\` with \`export const prerender = true\`
- Trigger a rebuild via webhook when CMS content changes`;

    case "isr":
      return `Use **Incremental Static Regeneration**. Revalidate pages on a schedule.
- For Next.js App Router: set \`revalidate\` in \`fetch()\` options or \`export const revalidate = 300\`
- For Next.js Pages Router: add \`revalidate: 300\` to \`getStaticProps\` return value
- Recommended interval: 300 seconds (5 minutes) to match the Lunar CMS API cache TTL
- Use \`next/cache\` \`revalidatePath()\` or \`revalidateTag()\` for on-demand revalidation`;

    case "csr":
      return `Use **Client-Side Rendering**. Fetch content in the browser after the page loads.
- Use \`useEffect\` + \`fetch\` (React), \`onMounted\` (Vue), or \`$effect\` (Svelte)
- Manage loading, error, and data states explicitly
- Consider SWR, TanStack Query, or Vue Query for caching and re-fetching
- For Next.js/Nuxt: the API key must NOT be sent to the browser. Proxy through an API route:
  \`/api/cms/[...path].ts\` → forwards request to Lunar CMS with the secret key server-side`;

    default:
      return "Fetch content using the most appropriate strategy for your framework.";
  }
}

function stylingInstructions(stylingId: string): string {
  switch (stylingId) {
    case "tailwind":
      return `Use **Tailwind CSS** for all styling.
- Utility classes only — no custom CSS unless absolutely unavoidable
- Use \`clsx\` or \`cn()\` for conditional class merging
- Responsive layouts using Tailwind prefixes (\`sm:\`, \`md:\`, \`lg:\`)
- Use Tailwind's spacing, colour, and typography scales`;

    case "bootstrap":
      return `Use **Bootstrap** for all styling.
- Bootstrap grid system (\`container\`, \`row\`, \`col-*\`)
- Bootstrap utility classes for spacing, colour, and typography
- Bootstrap components (cards, badges, pagination) where appropriate
- Avoid inline styles`;

    case "materialui":
      return `Use **Material UI (MUI)** for all components.
- MUI \`Grid\`, \`Card\`, \`Typography\`, \`Skeleton\`, \`Pagination\`, \`Chip\` components
- MUI's \`sx\` prop for custom styles
- MUI theme system for colour overrides
- MUI icons from \`@mui/icons-material\``;

    case "existingstyles":
      return `Match the **existing project's design system**.
- Inspect existing components and reuse them exactly
- Copy existing class naming conventions (BEM, CSS Modules, styled-components, etc.)
- Do not introduce any new styling library
- Maintain full visual consistency with the rest of the project`;

    case "none":
      return `Apply **no styling** — generate clean semantic HTML only.
- Use semantic tags (\`<article>\`, \`<section>\`, \`<nav>\`, \`<header>\`, \`<footer>\`)
- Add meaningful class names the consumer can style later
- No inline styles, no external class libraries`;

    default:
      return "Use the project's existing styling conventions.";
  }
}

function serviceCodeHint(frameworkId: string, renderStrategyId: string): string {
  const isBackend = ["nodejs", "express", "laravel", "php"].includes(frameworkId);
  const isMobile  = ["flutter", "reactnative"].includes(frameworkId);

  if (isMobile) {
    return `// Create: services/lunarCms.ts  (or lib/cms_service.dart for Flutter)
// Read API key from secure storage or build-time config (never hardcode)
// Set Authorization: Bearer <key> on every request
// Parse the JSON response envelope: { success, data, meta }
// getEnhancedPost(slug) → GET /api/v1/posts/:slug (stats + features + branding + share + related)`;
  }

  if (isBackend) {
    return `// Create: services/lunarCms.js (or .ts)
const LUNAR_CMS_URL     = process.env.LUNAR_CMS_URL;
const LUNAR_CMS_API_KEY = process.env.LUNAR_CMS_API_KEY;

async function cmsRequest(path, params = {}) {
  const url = new URL(path, LUNAR_CMS_URL);
  Object.entries(params).forEach(([k, v]) => v != null && url.searchParams.set(k, String(v)));
  const res = await fetch(url.toString(), {
    headers: { Authorization: \`Bearer \${LUNAR_CMS_API_KEY}\` },
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(err?.error?.message ?? \`Lunar CMS error \${res.status}\`);
  }
  return res.json();
}

// Enhanced single post (engagement + branding + share + related)
export async function getEnhancedPost(slug) {
  return cmsRequest(\`/api/v1/posts/\${slug}\`);
}`;
  }

  return `// Create: lib/lunarCms.ts  (adjust path to match your project)
const LUNAR_CMS_URL     = process.env.LUNAR_CMS_URL      // server-only (SSR/SSG)
const LUNAR_CMS_API_KEY = process.env.LUNAR_CMS_API_KEY  // server-only — never expose to browser

interface CmsEnvelope<T> {
  success: boolean;
  data: T;
  meta: { page: number; limit: number; total: number; totalPages: number };
}

async function cmsRequest<T>(path: string, params?: Record<string, string | number>): Promise<CmsEnvelope<T>> {
  const url = new URL(path, LUNAR_CMS_URL);
  if (params) Object.entries(params).forEach(([k, v]) => url.searchParams.set(k, String(v)));
  const res = await fetch(url.toString(), {
    headers: { Authorization: \`Bearer \${LUNAR_CMS_API_KEY}\` },
    next: { revalidate: 300 }, // Remove if not using Next.js ISR
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(err?.error?.message ?? \`Lunar CMS error \${res.status}\`);
  }
  return res.json() as Promise<CmsEnvelope<T>>;
}

// Enhanced single post — one call returns everything for a post page
export async function getEnhancedPost(slug: string) {
  const res = await fetch(\`\${LUNAR_CMS_URL}/api/v1/posts/\${slug}\`, {
    headers: { Authorization: \`Bearer \${LUNAR_CMS_API_KEY}\` },
    next: { revalidate: 60 },
  });
  if (!res.ok) return null;
  return res.json(); // { data, stats, features, branding, share, related }
}`;
}

function envVarBlock(frameworkId: string, apiBaseUrl: string): string {
  return `LUNAR_CMS_URL=${apiBaseUrl}
LUNAR_CMS_API_KEY=pk_live_your_key_here`;
}

function buildEndpointList(contentTypeIds: string[]): string {
  const all = contentTypeIds.includes("everything")
    ? CONTENT_TYPES
    : CONTENT_TYPES.filter((c) => contentTypeIds.includes(c.id));

  if (all.length === 0) return "- All available content types";

  return all
    .map((c) => `- **${c.label}** — \`${c.endpoint}\`\n  ${c.description}`)
    .join("\n");
}

// ── Proxy instructions (framework-specific) ────────────────────────────────────

function buildProxyInstructions(frameworkId: string): string {
  switch (frameworkId) {
    case "nextjs":
      return `**Next.js Route Handler** — create \`app/api/engagement/[...path]/route.ts\`:

\`\`\`ts
import { NextRequest, NextResponse } from "next/server";

const CMS = process.env.LUNAR_CMS_URL!;
const KEY = process.env.LUNAR_CMS_API_KEY!;

async function proxy(req: NextRequest, { params }: { params: { path: string[] } }) {
  const path = params.path.join("/");
  const url  = \`\${CMS}/api/v1/\${path}\${req.nextUrl.search}\`;
  const body = req.method !== "GET" && req.method !== "DELETE" ? await req.text() : undefined;

  const upstream = await fetch(url, {
    method:  req.method,
    headers: {
      "Authorization": \`Bearer \${KEY}\`,
      "Content-Type":  "application/json",
      "X-Visitor-Id":  req.headers.get("X-Visitor-Id") ?? "anonymous",
    },
    body,
  });
  const data = await upstream.json();
  return NextResponse.json(data, { status: upstream.status });
}

export const GET = proxy;
export const POST = proxy;
export const DELETE = proxy;
\`\`\`

All client engagement calls use relative URLs: \`/api/engagement/posts/:slug/likes\`.`;

    case "sveltekit":
      return `**SvelteKit Server Route** — create \`src/routes/api/engagement/[...path]/+server.ts\`:

\`\`\`ts
import type { RequestHandler } from "@sveltejs/kit";

const CMS = process.env.LUNAR_CMS_URL!;
const KEY = process.env.LUNAR_CMS_API_KEY!;

export const GET: RequestHandler = proxy;
export const POST: RequestHandler = proxy;
export const DELETE: RequestHandler = proxy;

async function proxy({ request, params, url }): Promise<Response> {
  const path     = (params as any).path;
  const upstream = await fetch(\`\${CMS}/api/v1/\${path}\${url.search}\`, {
    method:  request.method,
    headers: {
      "Authorization": \`Bearer \${KEY}\`,
      "Content-Type":  "application/json",
      "X-Visitor-Id":  request.headers.get("X-Visitor-Id") ?? "anonymous",
    },
    body: request.method !== "GET" && request.method !== "DELETE" ? await request.text() : undefined,
  });
  return upstream;
}
\`\`\``;

    case "nuxt":
      return `**Nuxt Server Route** — create \`server/api/engagement/[...path].ts\`:

\`\`\`ts
import { defineEventHandler, getRequestHeaders, readBody, getMethod } from "h3";

export default defineEventHandler(async (event) => {
  const config  = useRuntimeConfig();
  const path    = getRouterParam(event, "path");
  const method  = getMethod(event);
  const headers = getRequestHeaders(event);
  const body    = ["POST", "PUT"].includes(method) ? await readBody(event) : undefined;

  const res = await fetch(\`\${config.lunarCmsUrl}/api/v1/\${path}\`, {
    method,
    headers: {
      "Authorization": \`Bearer \${config.lunarCmsApiKey}\`,
      "Content-Type":  "application/json",
      "X-Visitor-Id":  headers["x-visitor-id"] ?? "anonymous",
    },
    body: body ? JSON.stringify(body) : undefined,
  });
  return res.json();
});
\`\`\``;

    default:
      return `Create a **server-side proxy endpoint** at \`/api/engagement/[...path]\` that:
1. Receives the request from the browser (client sends NO API key)
2. Reads \`LUNAR_CMS_API_KEY\` from environment variables (server-only)
3. Forwards the request to \`\${LUNAR_CMS_URL}/api/v1/...\` with \`Authorization: Bearer <key>\`
4. Forwards the \`X-Visitor-Id\` header from the client request
5. Returns the upstream response to the browser

This ensures the API key never reaches the client's JavaScript bundle.
All client engagement calls use the proxy's relative URL path (e.g. \`/api/engagement/posts/:slug/likes\`).`;
  }
}

// ── Engagement section builder ─────────────────────────────────────────────────

function buildEngagementSection(frameworkId: string, siteName: string): string {
  const proxyInstructions = buildProxyInstructions(frameworkId);

  return `### Overview

All engagement features are controlled by the CMS API response — the site never needs
its own config. The CMS admin enables/disables likes, comments, share, and the branded
attribution banner from the dashboard. The site simply respects the \`features\` flags.

---

### 1. Visitor Identity — \`lib/visitorId.ts\`

Every engagement call requires an \`X-Visitor-Id\` header. Create this client-only utility:

\`\`\`ts
// lib/visitorId.ts  (client-only — never import in server components)
export function getVisitorId(): string {
  if (typeof window === "undefined") return "server";
  let id = localStorage.getItem("lunar_vid");
  if (!id) {
    id = crypto.randomUUID();
    localStorage.setItem("lunar_vid", id);
  }
  return id;
}
\`\`\`

---

### 2. Engagement Proxy — protect the API key

All engagement write calls go through a server-side proxy so the API key never reaches
the browser. Clients call relative URLs (e.g. \`/api/engagement/posts/:slug/likes\`);
the proxy injects the Authorization header and forwards \`X-Visitor-Id\`.

${proxyInstructions}

---

### 3. Content Types Supported

All engagement features (likes, comments, views, shares, stats) work identically across four content types. Swap the path prefix to match the content you are building with:

| Content type | Path prefix | Example |
|---|---|---|
| Blog posts | \`/v1/blogs/:slug\` | \`GET /v1/blogs/hello-world/likes\` |
| News items | \`/v1/news/:slug\` | \`POST /v1/news/launch-2026/view\` |
| Articles | \`/v1/articles/:slug\` | \`GET /v1/articles/getting-started/stats\` |
| Products | \`/v1/products/:slug\` | \`POST /v1/products/headphones-pro/likes\` |

Engagement proxy paths follow the same pattern — e.g. \`/api/engagement/news/:slug/likes\`.
Build one generic \`ContentEngagement\` component that accepts a \`contentType\` prop and constructs the correct path.

---

### 4. Enhanced Single Post API

Use \`getEnhancedPost(slug)\` which calls \`GET /api/v1/blogs/:slug\` (or the equivalent for other content types).
This single API call returns everything needed for a post page:

\`\`\`json
{
  "data":     { ...all blog fields },
  "stats":    { "views": 142, "likes": 38, "comments": 12, "shares": 5 },
  "features": { "likes": true, "comments": true, "socialShare": true,
                "relatedPosts": true, "viewTracking": true, "poweredBy": true },
  "branding": { "enabled": true, "text": "Powered by Lunar CMS", "url": "https://..." },
  "share":    { "facebook": "https://...", "linkedin": "https://...",
                "x": "https://...", "whatsapp": "https://...", "email": "mailto:..." },
  "related":  [ { "slug": "...", "title": "...", "excerpt": "...",
                  "cover_image": "...", "category": "..." } ]
}
\`\`\`

---

### 4. PostEngagement Component (Client-side)

Create \`components/PostEngagement.tsx\` (or equivalent client component).
Mount it on every blog post detail page, below the content.

It receives \`initialData\` from the server fetch (eliminates layout shift) and a \`slug\` prop.

**Layout:**
\`\`\`
┌────────────────────────────────────────────────────┐
│  👁 views  ·  ♥ likes  ·  💬 comments  ·  ↗ Share  │
├────────────────────────────────────────────────────┤
│  [Like button]      [Share button → ShareModal]    │
├────────────────────────────────────────────────────┤
│  Comments section (threaded list + submit form)    │
└────────────────────────────────────────────────────┘
\`\`\`

**Implement these behaviours:**

**a) View tracking** — fires once on mount, never blocks rendering:
\`\`\`ts
useEffect(() => {
  fetch(\`/api/engagement/posts/\${slug}/view\`, {
    method: "POST",
    headers: { "X-Visitor-Id": getVisitorId(), "Content-Type": "application/json" },
    body: JSON.stringify({ referrer: document.referrer }),
  }).catch(() => {}); // silent fail
}, []);
\`\`\`

**b) Like button** — \`GET /api/engagement/posts/:slug/likes\` → \`{ likes, liked }\`
- On click: POST (like) or DELETE (unlike) to the same URL
- Optimistic UI: update count instantly, revert on error
- Heart icon: filled rose when liked, outlined when not
- Disabled while request is in flight

**c) Share button → ShareModal** — opens the ShareModal component (see section 5)
- On each platform button click: open URL in new tab + call \`POST /api/engagement/posts/:slug/share\` with \`{ channel: "facebook" }\`

**d) Comments section** — \`GET /api/engagement/posts/:slug/comments\`
- Threaded: replies indented under parent comment
- Each comment shows: \`author_name\`, formatted date, content
- "Reply" button sets the \`parentId\` for the form below
- Comment form fields: name (required), email (required, not displayed publicly), website (optional), message (required)
- On submit: \`POST /api/engagement/posts/:slug/comments\` with \`{ name, email, content, parent_id }\`
- If response has \`requiresApproval: true\`: show "Your comment is awaiting moderation — thank you!"
- Otherwise: show the new comment inline immediately

**Feature flag guards — only render if enabled:**
\`\`\`ts
if (!features.likes)       // hide like button
if (!features.comments)    // hide comments section
if (!features.socialShare) // hide share button
if (!features.viewTracking) // skip view tracking useEffect
\`\`\`

---

### 5. ShareModal Component

\`\`\`
Props: isOpen, onClose, shareLinks, slug
Backdrop: fixed inset-0 bg-black/50 z-50 — closes on backdrop click or Escape key
Modal: centred card, X close button in the top-right corner
Buttons (each opens URL in new tab AND tracks the share):
  • Facebook   — blue  (#1877F2)
  • LinkedIn   — blue  (#0A66C2)
  • X/Twitter  — black (#000000)
  • WhatsApp   — green (#25D366)
  • Email      — grey
"Copy link" button — copies window.location.href, shows "Copied!" for 2 seconds
\`\`\`

---

### 6. PoweredByBanner Component — AUTO-RENDERED, ZERO CONFIG

**Include this component at the bottom of every blog post page.**
The \`branding.enabled\` field in the API response controls whether it renders.
The site owner never needs to configure anything — the CMS admin controls it.

\`\`\`tsx
function PoweredByBanner({ branding }: { branding: { enabled: boolean; text: string; url: string } }) {
  if (!branding?.enabled) return null;
  return (
    <div className="fixed bottom-0 right-0 m-4 z-40">
      <a
        href={branding.url}
        target="_blank"
        rel="noopener noreferrer"
        className="flex items-center gap-1.5 rounded-full bg-black/80 px-3 py-1.5 text-xs text-white/80 hover:text-white transition-colors backdrop-blur"
      >
        <span>🌙</span>
        <span>{branding.text}</span>
      </a>
    </div>
  );
}
\`\`\`

Always render \`<PoweredByBanner branding={post.branding} />\` at the bottom of every post page.
When \`branding.enabled\` is false the component renders nothing — no stub, no placeholder.

---

### 7. Related Posts Component

Create \`components/RelatedPosts.tsx\`:
- Only render if \`features.relatedPosts\` is true and \`post.related.length > 0\`
- Show up to 3 posts in a grid: cover image, category badge, title, excerpt, link to \`/blog/:slug\`

---

### 8. Site Branding — **${siteName}**

Use **${siteName}** as the site name throughout:
- \`<Navbar>\` — site name in the top-left logo/wordmark
- \`<Footer>\` — copyright line: "© {year} ${siteName}"
- \`<title>\` tags — e.g. "My Post Title — ${siteName}"
- Hero headline on the homepage
- \`README.md\` — "Site: ${siteName}"

Do not hardcode "Lunar CMS" as the consumer site name — that is the CMS brand.
${siteName} is the name of the public-facing blog being built.`;
}

// ── Documentation generator ───────────────────────────────────────────────────

function buildDocumentation(sel: GeneratorSelections, framework: string, apiPlatform: string, siteName: string): string {
  const selectedContent =
    sel.contentTypeIds.includes("everything")
      ? CONTENT_TYPES
      : CONTENT_TYPES.filter((c) => sel.contentTypeIds.includes(c.id));

  return `# Lunar CMS — Integration Documentation
## ${framework} + ${apiPlatform}
## Site: **${siteName}**
Generated: ${new Date().toISOString().slice(0, 10)}

---

## Required Environment Variables

\`\`\`env
${envVarBlock(sel.frameworkId, sel.apiBaseUrl)}
\`\`\`

> **Never** commit your API key to version control.
> Add \`.env.local\` (or \`.env\`) to \`.gitignore\`.

---

## Authentication

Every request must include:
\`\`\`
Authorization: Bearer pk_live_your_api_key_here
\`\`\`

API keys are workspace-scoped. The key automatically determines which workspace's content is returned.
You never need to send a workspace ID or collection ID.

---

## Site Name

This integration builds the site **${siteName}**.
Use this name in the navbar, footer, \`<title>\` tags, hero, and README.

---

## Example API Request (Content)

\`\`\`bash
curl "${sel.apiBaseUrl}/v1/blogs?page=1&limit=10" \\
  -H "Authorization: Bearer pk_live_your_api_key_here"
\`\`\`

## Example Response

\`\`\`json
{
  "success": true,
  "data": [
    {
      "slug": "my-first-post",
      "title": "My First Post",
      "excerpt": "A short summary of the post.",
      "image": "https://...",
      "category": "General",
      "tags": ["news", "launch"],
      "author": "Admin",
      "featured": false,
      "reading_time": 3,
      "views": 142,
      "published_at": "2025-01-15T10:00:00Z",
      "updated_at": "2025-01-20T08:30:00Z"
    }
  ],
  "meta": { "page": 1, "limit": 10, "total": 45, "totalPages": 5 }
}
\`\`\`

---

## Example API Request (Enhanced Post — Engagement + Branding)

\`\`\`bash
curl "${sel.apiBaseUrl}/api/v1/posts/my-first-post" \\
  -H "Authorization: Bearer pk_live_your_api_key_here"
\`\`\`

\`\`\`json
{
  "data":     { "slug": "my-first-post", "title": "...", "...": "all blog fields" },
  "stats":    { "views": 142, "likes": 38, "comments": 12, "shares": 5 },
  "features": { "likes": true, "comments": true, "socialShare": true,
                "relatedPosts": true, "viewTracking": true, "poweredBy": true },
  "branding": { "enabled": true, "text": "Powered by Lunar CMS", "url": "https://..." },
  "share":    { "facebook": "https://...", "linkedin": "https://...",
                "x": "https://...", "whatsapp": "https://...", "email": "mailto:..." },
  "related":  [ { "slug": "...", "title": "...", "excerpt": "...", "cover_image": "...", "category": "..." } ]
}
\`\`\`

---

## Content Endpoints

${selectedContent.map((c) => `### ${c.label}\n\`${c.endpoint}\`\n${c.description}`).join("\n\n")}

---

## Engagement Endpoints

All engagement write operations must go through a server-side proxy endpoint
(e.g. \`/api/engagement/[...path]\`) that injects the Authorization header.
The API key must never be sent to the browser.

Engagement calls also require an \`X-Visitor-Id\` header — a UUID generated once per browser,
persisted in \`localStorage\`. See \`lib/visitorId.ts\` in the generated prompt.

${ENGAGEMENT_ENDPOINT_REFERENCE}

### View tracking
- Fires automatically on post page load (once per mount)
- Sends \`{ referrer: document.referrer }\`
- Silent fail — does not block content rendering

### Like button
- \`GET .../likes\` returns \`{ likes: number, liked: boolean }\`
- \`POST\` to like, \`DELETE\` to unlike — optimistic UI (revert on error)

### Share modal
- Show platform buttons from \`post.share\` (Facebook, LinkedIn, X, WhatsApp, Email)
- On click: open URL in new tab + \`POST .../share\` with \`{ channel: "facebook" }\`
- "Copy link" button copies \`window.location.href\`

### Comments
- Load with \`GET .../comments\` — threaded (replies nested under parent)
- Submit with \`POST .../comments\` — \`{ name, email, content, parent_id }\`
- If \`requiresApproval: true\`: show "Your comment is awaiting moderation"
- Otherwise: show new comment inline immediately

---

## "Powered by Lunar CMS" Banner

The banner is **automatically controlled by the CMS**. The developer does nothing except
render \`<PoweredByBanner branding={post.branding} />\` on every post page.

- \`branding.enabled: true\` → small pill renders in the bottom-right corner
- \`branding.enabled: false\` → component renders nothing (no placeholder)
- The CMS admin toggles this from the dashboard — no site-level configuration needed

---

## Installation Instructions

\`\`\`bash
# 1. Add environment variables to .env.local
echo "LUNAR_CMS_URL=${sel.apiBaseUrl}" >> .env.local
echo "LUNAR_CMS_API_KEY=pk_live_your_key_here" >> .env.local

# 2. Ensure .env.local is in .gitignore
echo ".env.local" >> .gitignore

# 3. Install no new packages — the Lunar CMS client uses native fetch
\`\`\`

---

## Common Errors

| Status | Code | Fix |
|--------|------|-----|
| 401 | INVALID_API_KEY | Check Authorization header — must be \`Bearer pk_live_...\` |
| 403 | FORBIDDEN | Use a key with the correct permission scopes |
| 404 | NOT_FOUND | Check the slug / endpoint spelling |
| 429 | RATE_LIMIT_EXCEEDED | Implement exponential backoff and retry |
| 500 | INTERNAL_SERVER_ERROR | Retry after a short delay |

---

## Troubleshooting

**Getting 401?**
- Ensure the \`Authorization\` header is exactly \`Bearer <key>\` (space after Bearer)
- Confirm \`LUNAR_CMS_API_KEY\` is set and loaded: \`console.log(!!process.env.LUNAR_CMS_API_KEY)\`
- Use a Publishable key (\`pk_live_\`), not a Secret key, for public endpoints

**Getting empty \`data: []\`?**
- Confirm the workspace has published content (check the Lunar CMS dashboard)
- Check the API key belongs to the correct workspace

**CORS errors?**
- The content-router allows all origins (\`Access-Control-Allow-Origin: *\`)
- CORS errors usually mean the base URL is wrong — double-check \`LUNAR_CMS_URL\`

**Rate limited?**
- Implement exponential backoff: wait 2^n seconds before retrying (max 32s)
- Use caching (SWR, TanStack Query, ISR) to reduce API call volume

**Engagement features not appearing?**
- Call \`GET /api/v1/posts/:slug\` (not \`/v1/blogs/:slug\`) — only the enhanced endpoint returns features, branding, and share links
- Check \`features.likes\`, \`features.comments\`, \`features.socialShare\` flags in the response
- Ensure the engagement proxy is running (check server logs for 401 or network errors)

**"Powered by" banner not showing?**
- Check \`branding.enabled\` in the enhanced post response
- The CMS admin controls this — contact your Lunar CMS workspace admin to enable it
`;
}

// ── Public API ────────────────────────────────────────────────────────────────

export function generatePrompt(sel: GeneratorSelections): GeneratedOutput {
  const framework   = FRAMEWORKS.find((f) => f.id === sel.frameworkId);
  const aiPlatform  = AI_PLATFORMS.find((p) => p.id === sel.aiPlatformId);
  const renderStrat = RENDER_STRATEGIES.find((r) => r.id === sel.renderStrategyId);
  const styling     = STYLING_OPTIONS.find((s) => s.id === sel.stylingId);

  const frameworkLabel  = framework?.label   ?? sel.frameworkId;
  const aiPlatformLabel = aiPlatform?.label  ?? sel.aiPlatformId;
  const renderLabel     = renderStrat?.badge ?? sel.renderStrategyId.toUpperCase();
  const stylingLabel    = styling?.label     ?? sel.stylingId;

  const keyPlaceholder = sel.apiKeyPlaceholder ?? "pk_live_your_api_key_here";
  const siteNameValue  = sel.siteName?.trim() || "My Blog";

  // Select platform-specific template, fall back to universal
  const template = PLATFORM_TEMPLATES[sel.aiPlatformId] ?? UNIVERSAL_TEMPLATE;

  const vars: Record<string, string> = {
    FRAMEWORK:                   frameworkLabel,
    AI_PLATFORM:                 aiPlatformLabel,
    API_BASE_URL:                sel.apiBaseUrl,
    API_KEY_PLACEHOLDER:         keyPlaceholder,
    RENDER_STRATEGY:             renderLabel,
    STYLING:                     stylingLabel,
    SITE_NAME:                   siteNameValue,
    ENDPOINT_LIST:               buildEndpointList(sel.contentTypeIds),
    ENDPOINT_REFERENCE:          ENDPOINT_REFERENCE,
    ENGAGEMENT_ENDPOINT_REFERENCE: ENGAGEMENT_ENDPOINT_REFERENCE,
    RENDER_INSTRUCTIONS:         renderInstructions(sel.renderStrategyId, sel.frameworkId),
    STYLING_INSTRUCTIONS:        stylingInstructions(sel.stylingId),
    SERVICE_CODE_HINT:           serviceCodeHint(sel.frameworkId, sel.renderStrategyId),
    ENV_VAR_BLOCK:               envVarBlock(sel.frameworkId, sel.apiBaseUrl),
    ENGAGEMENT_SECTION:          buildEngagementSection(sel.frameworkId, siteNameValue),
    AUTH_METHOD:                 "Bearer Token",
    PAGINATION:                  "page (1-based), limit (1–100, default 20)",
    SEARCH:                      "?search=query (searches title and excerpt)",
    ERROR_FORMAT:                '{ "success": false, "error": { "code": "...", "message": "..." } }',
    CACHE_STRATEGY:              "5-minute Cache-Control headers on all successful responses",
    WORKSPACE_NAME:              "your-workspace",
    PROJECT_NAME:                "your-project",
    SITE_URL:                    sel.apiBaseUrl.replace(/\/functions\/v1\/content-router.*/, ""),
  };

  let prompt = template.template_body;
  for (const [key, value] of Object.entries(vars)) {
    prompt = prompt.replaceAll(`{{${key}}}`, value);
  }

  const documentation = buildDocumentation(sel, frameworkLabel, aiPlatformLabel, siteNameValue);

  return {
    prompt,
    documentation,
    template_version: template.version,
    generated_at: new Date().toISOString(),
    selections: {
      framework:      frameworkLabel,
      aiPlatform:     aiPlatformLabel,
      contentTypes:   sel.contentTypeIds,
      renderStrategy: renderLabel,
      styling:        stylingLabel,
      siteName:       siteNameValue,
    },
  };
}
