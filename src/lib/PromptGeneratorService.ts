/**
 * PromptGeneratorService.ts
 *
 * Takes user selections from the Integration Center wizard and produces:
 * 1. A complete AI implementation prompt tailored to the chosen platform
 * 2. A documentation block (env vars, examples, troubleshooting)
 *
 * All logic lives here — React components only call generatePrompt().
 */

import {
  UNIVERSAL_TEMPLATE,
  PLATFORM_TEMPLATES,
  ENDPOINT_REFERENCE,
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
// Parse the JSON response envelope: { success, data, meta }`;
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
}`;
}

function envVarBlock(frameworkId: string, apiBaseUrl: string): string {
  const isVite = ["react", "vue", "svelte"].includes(frameworkId);

  if (isVite) {
    // Vite exposes vars with VITE_ prefix to the browser — but API key must stay server-side.
    // For pure CSR apps, they'll need a proxy; show the server-safe var name.
    return `LUNAR_CMS_URL=${apiBaseUrl}
LUNAR_CMS_API_KEY=pk_live_your_key_here`;
  }

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

// ── Documentation generator ───────────────────────────────────────────────────

function buildDocumentation(sel: GeneratorSelections, framework: string, apiPlatform: string): string {
  const selectedContent =
    sel.contentTypeIds.includes("everything")
      ? CONTENT_TYPES
      : CONTENT_TYPES.filter((c) => sel.contentTypeIds.includes(c.id));

  return `# Lunar CMS — Integration Documentation
## ${framework} + ${apiPlatform}
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

## Example API Request

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
  "meta": {
    "page": 1,
    "limit": 10,
    "total": 45,
    "totalPages": 5
  }
}
\`\`\`

---

## Supported Endpoints

${selectedContent.map((c) => `### ${c.label}\n\`${c.endpoint}\`\n${c.description}`).join("\n\n")}

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

  // Select platform-specific template, fall back to universal
  const template = PLATFORM_TEMPLATES[sel.aiPlatformId] ?? UNIVERSAL_TEMPLATE;

  const vars: Record<string, string> = {
    FRAMEWORK:            frameworkLabel,
    AI_PLATFORM:          aiPlatformLabel,
    API_BASE_URL:         sel.apiBaseUrl,
    API_KEY_PLACEHOLDER:  keyPlaceholder,
    RENDER_STRATEGY:      renderLabel,
    STYLING:              stylingLabel,
    ENDPOINT_LIST:        buildEndpointList(sel.contentTypeIds),
    ENDPOINT_REFERENCE:   ENDPOINT_REFERENCE,
    RENDER_INSTRUCTIONS:  renderInstructions(sel.renderStrategyId, sel.frameworkId),
    STYLING_INSTRUCTIONS: stylingInstructions(sel.stylingId),
    SERVICE_CODE_HINT:    serviceCodeHint(sel.frameworkId, sel.renderStrategyId),
    ENV_VAR_BLOCK:        envVarBlock(sel.frameworkId, sel.apiBaseUrl),
    AUTH_METHOD:          "Bearer Token",
    PAGINATION:           "page (1-based), limit (1–100, default 20)",
    SEARCH:               "?search=query (searches title and excerpt)",
    ERROR_FORMAT:         '{ "success": false, "error": { "code": "...", "message": "..." } }',
    CACHE_STRATEGY:       "5-minute Cache-Control headers on all successful responses",
    WORKSPACE_NAME:       "your-workspace",
    PROJECT_NAME:         "your-project",
    SITE_URL:             sel.apiBaseUrl.replace(/\/functions\/v1\/content-router.*/, ""),
  };

  let prompt = template.template_body;
  for (const [key, value] of Object.entries(vars)) {
    prompt = prompt.replaceAll(`{{${key}}}`, value);
  }

  const documentation = buildDocumentation(sel, frameworkLabel, aiPlatformLabel);

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
    },
  };
}
