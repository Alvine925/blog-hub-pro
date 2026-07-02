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
  { id: "cursor",      label: "Cursor",               icon: "⬛", description: "AI-first code editor" },
  { id: "lovable",     label: "Lovable",              icon: "❤️", description: "AI product builder"   },
  { id: "windsurf",    label: "Windsurf",             icon: "🌊", description: "Agentic IDE by Codeium" },
  { id: "bolt",        label: "Bolt",                 icon: "⚡", description: "AI full-stack builder" },
  { id: "replit",      label: "Replit",               icon: "🔄", description: "Replit AI Agent"       },
  { id: "claudecode",  label: "Claude Code",          icon: "🤖", description: "Anthropic's CLI agent" },
  { id: "copilot",     label: "GitHub Copilot Agent", icon: "🐙", description: "GitHub Copilot Agent mode" },
  { id: "vscodeagent", label: "VS Code Agent Mode",   icon: "💙", description: "VS Code built-in agent" },
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
  { id: "tailwind",      label: "Tailwind CSS",          description: "Utility-first CSS classes" },
  { id: "bootstrap",     label: "Bootstrap",             description: "Component-based CSS framework" },
  { id: "materialui",    label: "Material UI",           description: "Google Material Design components" },
  { id: "existingstyles", label: "Existing Project Styles", description: "Match the current project's design system" },
  { id: "none",          label: "No Styling",            description: "Plain HTML/markup, style yourself" },
];

// ── Universal Prompt Template ─────────────────────────────────────────────────

export const UNIVERSAL_TEMPLATE: PromptTemplate = {
  id: "universal-v1",
  name: "Universal Integration Prompt",
  version: "v1.0",
  description: "Works with any framework and AI coding platform",
  created_at: "2025-01-01T00:00:00Z",
  updated_at: "2025-01-01T00:00:00Z",
  template_body: `# Lunar CMS Integration — {{FRAMEWORK}} + {{AI_PLATFORM}}

## Your Task
You are integrating an existing **{{FRAMEWORK}}** project with the **Lunar CMS REST API**.
This is a read-only integration. Do NOT modify the CMS itself.

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
- Handle HTTP errors (non-2xx) and throw descriptive errors
- Support pagination parameters (page, limit)
- Support filtering parameters where applicable
- Never expose the API key to the client-side (for SSR/SSG frameworks)

\`\`\`
{{SERVICE_CODE_HINT}}
\`\`\`

---

## Step 4 — Endpoints to Implement

Implement integration for the following content types:
{{ENDPOINT_LIST}}

### Response Contract
Every successful response has the shape:
\`\`\`json
{
  "success": true,
  "data": [...],
  "meta": {
    "page": 1,
    "limit": 20,
    "total": 100,
    "totalPages": 5
  }
}
\`\`\`

Every error response has the shape:
\`\`\`json
{
  "success": false,
  "error": {
    "code": "NOT_FOUND",
    "message": "The requested resource was not found."
  }
}
\`\`\`

---

## Step 5 — Rendering Strategy: {{RENDER_STRATEGY}}

{{RENDER_INSTRUCTIONS}}

---

## Step 6 — Styling: {{STYLING}}

{{STYLING_INSTRUCTIONS}}

---

## Step 7 — Implementation Requirements

For every page/component you create:
- [ ] Implement **loading states** (skeleton or spinner while fetching)
- [ ] Implement **error states** (user-friendly error message on failure)
- [ ] Implement **empty states** (when no content is returned)
- [ ] Support **pagination** using the \`page\` and \`limit\` query parameters
- [ ] Show **total results** and **page navigation** controls
- [ ] Build **SEO-friendly** markup with \`<title>\`, \`<meta description>\`, and Open Graph tags where applicable
- [ ] Keep components **modular** — one component per concern
- [ ] Follow **{{FRAMEWORK}}** best practices and conventions

---

## Step 8 — Code Quality Rules

- Reuse existing architecture; do not introduce redundant abstraction layers
- Store all API configuration in one central place
- Use TypeScript types for all API responses where the project uses TypeScript
- Do not add unnecessary dependencies — use what is already installed
- Keep API calls in service functions, not inline inside components
- Handle rate limit errors (HTTP 429) gracefully — show a message and retry
- Handle network errors gracefully — never crash the page

---

## Available Endpoints Reference

| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | /v1/blogs | List published blogs (page, limit, sort, order, search, category, tag, author, featured, from, to) |
| GET | /v1/blogs/:slug | Single blog by slug |
| GET | /v1/blogs/featured | Featured published blogs |
| GET | /v1/blogs/latest | Latest N blogs (limit) |
| GET | /v1/blogs/:slug/related | Related blogs by category + tags |
| GET | /v1/pages | List published pages |
| GET | /v1/pages/:slug | Single page by slug |
| GET | /v1/collections | List visible collections |
| GET | /v1/collections/:slug | Entries in a specific collection |
| GET | /v1/categories | Blog categories with post counts |
| GET | /v1/tags | Blog tags with post counts |
| GET | /v1/media | Public media files |
| GET | /v1/search?q= | Full-text search across all content |

---

## Common Errors & Troubleshooting

| Status | Code | Cause | Fix |
|--------|------|-------|-----|
| 401 | INVALID_API_KEY | Missing or wrong API key | Check the Authorization header and env var |
| 403 | FORBIDDEN | Key lacks permission | Use a key with the correct scopes |
| 404 | NOT_FOUND | Wrong slug or endpoint | Double-check the slug and URL |
| 429 | RATE_LIMIT_EXCEEDED | Too many requests | Implement exponential backoff |
| 500 | INTERNAL_SERVER_ERROR | CMS server error | Retry after a short delay |

---

Begin by inspecting the project. Then implement the integration step by step.
Do not modify any existing pages, routes, or components unless explicitly needed.
Ask for clarification before making any destructive change.
`,
};
