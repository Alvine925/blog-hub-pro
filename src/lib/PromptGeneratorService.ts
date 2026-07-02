/**
 * PromptGeneratorService.ts
 *
 * Takes user selections from the Integration Center wizard and produces:
 * 1. A complete AI implementation prompt (ready to paste into any AI tool)
 * 2. A documentation block (env vars, examples, troubleshooting)
 *
 * All logic lives here — React components only call generatePrompt().
 */

import {
  UNIVERSAL_TEMPLATE,
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
- For Next.js: use \`getServerSideProps\` (Pages Router) or async Server Components (App Router)
- For Nuxt: use \`useFetch\` or \`useAsyncData\` with server context
- For SvelteKit: use the \`load\` function in \`+page.server.ts\`
- For other frameworks: fetch in the server handler/controller before returning the view
- Set appropriate \`Cache-Control\` headers (e.g. \`s-maxage=60, stale-while-revalidate=300\`)`;

    case "ssg":
      return `Use **Static Site Generation**. Pre-fetch all content at build time.
- For Next.js: use \`getStaticProps\` + \`getStaticPaths\` (Pages Router), or \`generateStaticParams\` (App Router)
- For Nuxt: use \`useAsyncData\` with Nitro pre-rendering
- For Astro: fetch directly in frontmatter (default static behaviour)
- For SvelteKit: use \`+page.server.ts\` \`load\` with \`prerender = true\`
- Regenerate pages when content changes by triggering a rebuild via webhook`;

    case "isr":
      return `Use **Incremental Static Regeneration**. Revalidate pages on a schedule.
- For Next.js App Router: set \`revalidate\` in \`fetch()\` options or export \`const revalidate = 300\`
- For Next.js Pages Router: add \`revalidate: 300\` to \`getStaticProps\` return value
- Recommend a revalidation interval of 300 seconds (5 minutes) to match the CMS API cache TTL
- Use \`next/cache\` \`revalidatePath()\` or \`revalidateTag()\` for on-demand revalidation via webhook`;

    case "csr":
      return `Use **Client-Side Rendering**. Fetch content in the browser after the page loads.
- Use \`useEffect\` + \`fetch\` (React), \`onMounted\` (Vue), or \`$effect\` (Svelte)
- Manage loading, error, and data states
- Consider using SWR, TanStack Query, or Vue Query for caching and re-fetching
- For Next.js/Nuxt: ensure the API key is NOT exposed to the client. Proxy through an API route instead:
  \`/api/cms/[...path].ts\` → forwards request to CMS with the secret key server-side`;

    default:
      return "Fetch content using the most appropriate strategy for your framework.";
  }
}

function stylingInstructions(stylingId: string): string {
  switch (stylingId) {
    case "tailwind":
      return `Use **Tailwind CSS** for all styling.
- Use utility classes only — do not write custom CSS unless unavoidable
- Use \`clsx\` or \`cn()\` for conditional class merging
- Build responsive layouts using Tailwind's responsive prefixes (\`sm:\`, \`md:\`, \`lg:\`)
- Use Tailwind's built-in spacing, colour, and typography scales`;

    case "bootstrap":
      return `Use **Bootstrap** for all styling.
- Use Bootstrap grid system (\`container\`, \`row\`, \`col-*\`)
- Use Bootstrap utility classes for spacing, colour, and typography
- Use Bootstrap components (cards, badges, pagination) where appropriate
- Avoid inline styles`;

    case "materialui":
      return `Use **Material UI (MUI)** for all components.
- Use MUI \`Grid\`, \`Card\`, \`Typography\`, \`Skeleton\`, \`Pagination\`, \`Chip\` components
- Use MUI's \`sx\` prop for custom styles
- Use MUI's theme system for colour overrides
- Use MUI icons from \`@mui/icons-material\``;

    case "existingstyles":
      return `Match the **existing project's design system**.
- Inspect existing components and reuse them
- Copy the existing class naming conventions (BEM, CSS Modules, etc.)
- Do not introduce any new styling library
- Maintain visual consistency with the rest of the project`;

    case "none":
      return `Apply **no styling** — generate clean semantic HTML markup only.
- Use semantic tags (\`<article>\`, \`<section>\`, \`<nav>\`, \`<header>\`, \`<footer>\`)
- Add meaningful class names so the consumer can style later
- No inline styles, no class libraries`;

    default:
      return "Use the project's existing styling conventions.";
  }
}

function serviceCodeHint(frameworkId: string, renderStrategyId: string): string {
  const isBackend = ["nodejs", "express", "laravel", "php"].includes(frameworkId);
  const isMobile = ["flutter", "reactnative"].includes(frameworkId);

  if (isMobile) {
    return `// Create a CMS service file (e.g. services/lunarCms.ts or lib/cms_service.dart)
// Read API_KEY from your secure storage or build-time config
// Set Authorization: Bearer <key> on every request
// Parse the JSON response envelope: { success, data, meta }`;
  }

  if (isBackend) {
    return `// Create a CMS service module (e.g. services/lunarCms.js)
const CMS_BASE_URL = process.env.LUNAR_CMS_URL;
const CMS_API_KEY  = process.env.LUNAR_CMS_API_KEY;

async function cmsRequest(path, params = {}) {
  const url = new URL(path, CMS_BASE_URL);
  Object.entries(params).forEach(([k, v]) => v != null && url.searchParams.set(k, v));
  const res = await fetch(url, {
    headers: { Authorization: \`Bearer \${CMS_API_KEY}\` },
  });
  if (!res.ok) throw new Error(\`CMS error \${res.status}\`);
  return res.json();
}`;
  }

  return `// lib/lunar-cms.ts  (or .js)
const CMS_BASE_URL  = process.env.NEXT_PUBLIC_LUNAR_CMS_URL  // or VITE_LUNAR_CMS_URL etc.
const CMS_API_KEY   = process.env.LUNAR_CMS_API_KEY           // server-only

async function cmsRequest<T>(path: string, params?: Record<string, string>): Promise<T> {
  const url = new URL(path, CMS_BASE_URL);
  if (params) Object.entries(params).forEach(([k,v]) => url.searchParams.set(k,v));
  const res = await fetch(url.toString(), {
    headers: { Authorization: \`Bearer \${CMS_API_KEY}\` },
    next: { revalidate: 300 }, // Next.js ISR — remove if not using ISR
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(err?.error?.message ?? \`CMS error \${res.status}\`);
  }
  const json = await res.json();
  return json.data as T;
}`;
}

function envVarBlock(frameworkId: string, apiBaseUrl: string): string {
  const isVite  = ["react", "vue", "svelte"].includes(frameworkId);
  const prefix  = isVite ? "VITE_" : "NEXT_PUBLIC_";
  const urlVar  = isVite ? `VITE_LUNAR_CMS_URL` : `LUNAR_CMS_URL`;
  const keyVar  = `LUNAR_CMS_API_KEY`;

  return `${urlVar}=${apiBaseUrl}
${keyVar}=pk_live_your_key_here`;
}

function buildEndpointList(contentTypeIds: string[]): string {
  const all = contentTypeIds.includes("everything")
    ? CONTENT_TYPES
    : CONTENT_TYPES.filter((c) => contentTypeIds.includes(c.id));

  if (all.length === 0) return "- All content types";

  return all
    .map((c) => `- **${c.label}** — \`${c.endpoint}\`\n  ${c.description}`)
    .join("\n");
}

// ── Documentation generator ───────────────────────────────────────────────────

function buildDocumentation(sel: GeneratorSelections, framework: string, apiPlatform: string): string {
  const isVite = ["react", "vue", "svelte"].includes(sel.frameworkId);
  const urlVar = isVite ? "VITE_LUNAR_CMS_URL" : "LUNAR_CMS_URL";

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
${urlVar}=${sel.apiBaseUrl}
LUNAR_CMS_API_KEY=pk_live_your_api_key_here
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

## Common Errors

| Status | Code | Fix |
|--------|------|-----|
| 401 | INVALID_API_KEY | Check Authorization header and env var |
| 403 | FORBIDDEN | Use a key with the correct scopes |
| 404 | NOT_FOUND | Check the slug/endpoint spelling |
| 429 | RATE_LIMIT_EXCEEDED | Implement backoff and retry |
| 500 | INTERNAL_SERVER_ERROR | Retry after a short delay |

---

## Troubleshooting

**Getting 401?**
- Ensure the \`Authorization\` header is \`Bearer <key>\` (note the space after Bearer)
- Confirm \`LUNAR_CMS_API_KEY\` is loaded correctly by logging \`process.env.LUNAR_CMS_API_KEY\`

**Getting empty \`data: []\`?**
- Confirm the workspace has published content
- Check the API key belongs to the correct workspace

**CORS errors?**
- The content-router edge function allows all origins (\`Access-Control-Allow-Origin: *\`)
- CORS errors usually mean the URL is wrong — double-check the base URL

**Rate limited?**
- Implement exponential backoff: wait 2^n seconds before retrying
- Use caching (SWR, TanStack Query, ISR) to reduce API calls
`;
}

// ── Public API ────────────────────────────────────────────────────────────────

export function generatePrompt(sel: GeneratorSelections): GeneratedOutput {
  const framework    = FRAMEWORKS.find((f) => f.id === sel.frameworkId);
  const aiPlatform   = AI_PLATFORMS.find((p) => p.id === sel.aiPlatformId);
  const renderStrat  = RENDER_STRATEGIES.find((r) => r.id === sel.renderStrategyId);
  const styling      = STYLING_OPTIONS.find((s) => s.id === sel.stylingId);

  const frameworkLabel   = framework?.label    ?? sel.frameworkId;
  const aiPlatformLabel  = aiPlatform?.label   ?? sel.aiPlatformId;
  const renderLabel      = renderStrat?.badge  ?? sel.renderStrategyId.toUpperCase();
  const stylingLabel     = styling?.label      ?? sel.stylingId;

  const keyPlaceholder   = sel.apiKeyPlaceholder ?? "pk_live_your_api_key_here";

  const vars: Record<string, string> = {
    FRAMEWORK:           frameworkLabel,
    AI_PLATFORM:         aiPlatformLabel,
    API_BASE_URL:        sel.apiBaseUrl,
    API_KEY_PLACEHOLDER: keyPlaceholder,
    RENDER_STRATEGY:     renderLabel,
    STYLING:             stylingLabel,
    ENDPOINT_LIST:       buildEndpointList(sel.contentTypeIds),
    RENDER_INSTRUCTIONS: renderInstructions(sel.renderStrategyId, sel.frameworkId),
    STYLING_INSTRUCTIONS: stylingInstructions(sel.stylingId),
    SERVICE_CODE_HINT:   serviceCodeHint(sel.frameworkId, sel.renderStrategyId),
    ENV_VAR_BLOCK:       envVarBlock(sel.frameworkId, sel.apiBaseUrl),
    AUTH_METHOD:         "Bearer Token",
    PAGINATION:          "page (1-based), limit (1–100, default 20)",
    SEARCH:              "?search=query (search across title and excerpt)",
    ERROR_FORMAT:        '{ "success": false, "error": { "code": "...", "message": "..." } }',
    CACHE_STRATEGY:      "5-minute Cache-Control headers on all successful responses",
  };

  let prompt = UNIVERSAL_TEMPLATE.template_body;
  for (const [key, value] of Object.entries(vars)) {
    prompt = prompt.replaceAll(`{{${key}}}`, value);
  }

  const documentation = buildDocumentation(sel, frameworkLabel, aiPlatformLabel);

  return {
    prompt,
    documentation,
    template_version: UNIVERSAL_TEMPLATE.version,
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
