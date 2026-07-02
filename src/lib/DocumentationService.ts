/**
 * DocumentationService.ts
 *
 * Orchestrates all documentation generation for a workspace.
 * Reads from EndpointRegistry — never hardcodes endpoint details.
 * Consumed by the Developer Documentation route.
 */

import {
  ENDPOINT_REGISTRY,
  CATEGORY_LABELS,
  CURRENT_VERSION,
  type EndpointDefinition,
  type ApiVersionString,
} from "./EndpointRegistry";
import { generateAllSnippets, type CodeLanguage } from "./ExampleGenerator";
import { buildParamList, buildExampleUrl } from "./ParameterParser";

// ── Types ─────────────────────────────────────────────────────────────────────

export interface DocSection {
  id: string;
  title: string;
  group: string;
}

export interface EndpointDoc {
  endpoint: EndpointDefinition;
  exampleUrl: string;
  params: ReturnType<typeof buildParamList>;
  snippets: Record<CodeLanguage, string>;
  responseJson: string;
}

export interface ChangelogEntry {
  version: string;
  date: string;
  changes: { type: "added" | "updated" | "deprecated" | "breaking"; description: string }[];
}

// ── Documentation navigation sections ────────────────────────────────────────

export const DOC_SECTIONS: DocSection[] = [
  { id: "overview",          title: "Getting Started",        group: "Introduction"  },
  { id: "authentication",    title: "Authentication",         group: "Introduction"  },
  { id: "api-keys",          title: "API Keys",               group: "Introduction"  },
  { id: "first-request",     title: "First Request",          group: "Introduction"  },
  { id: "pagination",        title: "Pagination",             group: "Reference"     },
  { id: "filtering",         title: "Filtering",              group: "Reference"     },
  { id: "search",            title: "Search",                 group: "Reference"     },
  { id: "errors",            title: "Error Codes",            group: "Reference"     },
  { id: "rate-limits",       title: "Rate Limits",            group: "Reference"     },
  { id: "versioning",        title: "Versioning",             group: "Reference"     },
  { id: "code-examples",     title: "Code Examples",          group: "Guides"        },
  { id: "frameworks",        title: "Framework Guides",       group: "Guides"        },
  { id: "ai-prompts",        title: "AI Prompts",             group: "Guides"        },
  { id: "endpoints",         title: "REST Endpoints",         group: "Endpoints"     },
  { id: "changelog",         title: "Changelog",              group: "Resources"     },
];

// ── Error documentation ───────────────────────────────────────────────────────

export interface ErrorDoc {
  code: number;
  name: string;
  description: string;
  example: object;
  resolution: string;
}

export const ERROR_DOCS: ErrorDoc[] = [
  {
    code: 400,
    name: "Bad Request",
    description: "The request was malformed or missing required parameters.",
    example: { success: false, error: { code: "BAD_REQUEST", message: "Missing required parameter: q" } },
    resolution: "Check the query parameters against the endpoint documentation.",
  },
  {
    code: 401,
    name: "Unauthorized",
    description: "No API key was provided, or the key is invalid.",
    example: { success: false, error: { code: "INVALID_API_KEY", message: "Invalid or missing API key." } },
    resolution: 'Include the Authorization header: "Bearer YOUR_API_KEY". Verify the key is active in the API Keys section.',
  },
  {
    code: 403,
    name: "Forbidden",
    description: "The API key does not have permission for this resource.",
    example: { success: false, error: { code: "FORBIDDEN", message: "This key does not have access to this resource." } },
    resolution: "Use a key with the correct permission scope (publishable vs secret).",
  },
  {
    code: 404,
    name: "Not Found",
    description: "The requested resource does not exist or has been unpublished.",
    example: { success: false, error: { code: "NOT_FOUND", message: 'Blog post "missing-slug" not found.' } },
    resolution: "Verify the slug or ID. Ensure the resource is published.",
  },
  {
    code: 429,
    name: "Too Many Requests",
    description: "You have exceeded the rate limit for your API key.",
    example: { success: false, error: { code: "RATE_LIMIT_EXCEEDED", message: "Rate limit exceeded. Retry after 60 seconds.", retryAfter: 60 } },
    resolution: "Implement exponential backoff. The Retry-After header indicates when to retry.",
  },
  {
    code: 500,
    name: "Internal Server Error",
    description: "An unexpected error occurred on the server.",
    example: { success: false, error: { code: "INTERNAL_SERVER_ERROR", message: "An unexpected error occurred." } },
    resolution: "Retry the request after a short delay. If the error persists, contact support.",
  },
];

// ── Rate limit documentation ──────────────────────────────────────────────────

export interface RateLimitTier {
  keyType: string;
  requestsPerMinute: number;
  requestsPerDay: number;
}

export const RATE_LIMIT_TIERS: RateLimitTier[] = [
  { keyType: "Publishable (pk_live_)", requestsPerMinute: 60, requestsPerDay: 10000 },
  { keyType: "Secret (sk_live_)",      requestsPerMinute: 120, requestsPerDay: 50000 },
];

// ── Changelog ─────────────────────────────────────────────────────────────────

export const CHANGELOG: ChangelogEntry[] = [
  {
    version: "v1.0",
    date: "2025-01-15",
    changes: [
      { type: "added", description: "Initial release of the Lunar CMS REST API." },
      { type: "added", description: "GET /v1/blogs — list published blog posts." },
      { type: "added", description: "GET /v1/blogs/:slug — retrieve a single blog post." },
      { type: "added", description: "GET /v1/collections — list all collection schemas." },
      { type: "added", description: "GET /v1/collections/:slug/entries — list collection entries." },
    ],
  },
  {
    version: "v1.1",
    date: "2025-03-01",
    changes: [
      { type: "added", description: "GET /v1/media — media asset library endpoint." },
      { type: "added", description: "GET /v1/search — global full-text search across all content." },
      { type: "added", description: "GET /v1/collections/:slug/entries/:id — single entry retrieval." },
      { type: "updated", description: "Pagination now returns totalPages in the meta object." },
    ],
  },
];

// ── Framework guides ──────────────────────────────────────────────────────────

export interface FrameworkGuide {
  id: string;
  name: string;
  icon: string;
  envSetup: string;
  fetchExample: string;
  notes: string;
}

export const FRAMEWORK_GUIDES: FrameworkGuide[] = [
  {
    id: "nextjs",
    name: "Next.js",
    icon: "▲",
    envSetup: `# .env.local
LUNAR_CMS_URL=https://your-domain.com/api
LUNAR_CMS_API_KEY=pk_live_your_key_here`,
    fetchExample: `// app/page.tsx (App Router)
export default async function Page() {
  const res = await fetch(\`\${process.env.LUNAR_CMS_URL}/v1/blogs\`, {
    headers: { Authorization: \`Bearer \${process.env.LUNAR_CMS_API_KEY}\` },
    next: { revalidate: 300 },
  });
  const { data } = await res.json();
  return <ul>{data.map(p => <li key={p.slug}>{p.title}</li>)}</ul>;
}`,
    notes: "Use Server Components for automatic ISR. The API key never reaches the browser.",
  },
  {
    id: "react",
    name: "React (Vite)",
    icon: "⚛",
    envSetup: `# .env
# Proxy API calls through your own backend to protect the API key
VITE_API_PROXY_URL=http://localhost:3001/api`,
    fetchExample: `// src/hooks/useBlogs.ts
import { useEffect, useState } from "react";

export function useBlogs() {
  const [blogs, setBlogs] = useState([]);
  useEffect(() => {
    fetch("/api/v1/blogs")  // proxied through your backend
      .then(r => r.json())
      .then(({ data }) => setBlogs(data));
  }, []);
  return blogs;
}`,
    notes: "Never expose your API key in client-side code. Proxy requests through a backend or serverless function.",
  },
  {
    id: "astro",
    name: "Astro",
    icon: "🚀",
    envSetup: `# .env
LUNAR_CMS_URL=https://your-domain.com/api
LUNAR_CMS_API_KEY=pk_live_your_key_here`,
    fetchExample: `---
// src/pages/blog/index.astro
const res = await fetch(\`\${import.meta.env.LUNAR_CMS_URL}/v1/blogs\`, {
  headers: { Authorization: \`Bearer \${import.meta.env.LUNAR_CMS_API_KEY}\` },
});
const { data: posts } = await res.json();
---
<ul>
  {posts.map(p => <li><a href={\`/blog/\${p.slug}\`}>{p.title}</a></li>)}
</ul>`,
    notes: "Fetches at build time by default. Add export const prerender = false for SSR.",
  },
  {
    id: "sveltekit",
    name: "SvelteKit",
    icon: "🔥",
    envSetup: `# .env
LUNAR_CMS_URL=https://your-domain.com/api
LUNAR_CMS_API_KEY=pk_live_your_key_here`,
    fetchExample: `// src/routes/blog/+page.server.ts
import type { PageServerLoad } from "./$types";

export const load: PageServerLoad = async ({ fetch }) => {
  const res = await fetch(\`\${process.env.LUNAR_CMS_URL}/v1/blogs\`, {
    headers: { Authorization: \`Bearer \${process.env.LUNAR_CMS_API_KEY}\` },
  });
  const { data } = await res.json();
  return { posts: data };
};`,
    notes: "Use +page.server.ts to keep the API key server-side.",
  },
];

// ── Main DocumentationService ─────────────────────────────────────────────────

export class DocumentationService {
  private baseUrl: string;
  private apiKey: string;
  private version: ApiVersionString;

  constructor(baseUrl: string, apiKey = "YOUR_API_KEY", version: ApiVersionString = CURRENT_VERSION) {
    this.baseUrl = baseUrl;
    this.apiKey = apiKey;
    this.version = version;
  }

  /** All endpoints for the current version */
  getEndpoints(): EndpointDefinition[] {
    return ENDPOINT_REGISTRY.filter((e) =>
      e.versions.some((v) => v.version === this.version),
    );
  }

  /** Endpoints grouped by category */
  getEndpointsByCategory(): Record<string, EndpointDefinition[]> {
    const eps = this.getEndpoints();
    return eps.reduce<Record<string, EndpointDefinition[]>>((acc, ep) => {
      const label = CATEGORY_LABELS[ep.category];
      acc[label] = [...(acc[label] ?? []), ep];
      return acc;
    }, {});
  }

  /** Full documentation for a single endpoint */
  getEndpointDoc(id: string): EndpointDoc | null {
    const endpoint = this.getEndpoints().find((e) => e.id === id);
    if (!endpoint) return null;

    return {
      endpoint,
      exampleUrl: buildExampleUrl(`${this.baseUrl}`, endpoint),
      params: buildParamList(endpoint),
      snippets: generateAllSnippets(endpoint, this.baseUrl, this.apiKey),
      responseJson: JSON.stringify(endpoint.exampleResponse, null, 2),
    };
  }

  /** Base URL with version */
  getVersionedBaseUrl(): string {
    return `${this.baseUrl}/${this.version}`;
  }

  /** Overview / getting-started content */
  getOverview() {
    const epCount = this.getEndpoints().length;
    const categories = [...new Set(this.getEndpoints().map((e) => CATEGORY_LABELS[e.category]))];

    return {
      baseUrl: this.getVersionedBaseUrl(),
      version: this.version,
      endpointCount: epCount,
      categories,
      exampleRequest: `curl "${this.getVersionedBaseUrl()}/blogs" \\
  -H "Authorization: Bearer ${this.apiKey}"`,
      exampleResponse: JSON.stringify(
        {
          success: true,
          data: [{ slug: "hello-world", title: "Hello World", excerpt: "..." }],
          meta: { page: 1, limit: 20, total: 1, totalPages: 1 },
        },
        null,
        2,
      ),
    };
  }

  getErrorDocs(): ErrorDoc[] { return ERROR_DOCS; }
  getRateLimits(): RateLimitTier[] { return RATE_LIMIT_TIERS; }
  getChangelog(): ChangelogEntry[] { return CHANGELOG; }
  getFrameworkGuides(): FrameworkGuide[] { return FRAMEWORK_GUIDES; }
}
