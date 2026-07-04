/**
 * ai-docs-context.ts
 *
 * Builds a compact developer-docs knowledge string from the EndpointRegistry.
 * Injected server-side into every AI assistant request so the model always
 * knows the full Lunar CMS API surface without the user having to ask.
 */

import { ENDPOINT_REGISTRY } from "./EndpointRegistry";

const SUPABASE_PROJECT_ID = "pzhsjhprnqfhixjkekxr";
const BASE_URL = `https://${SUPABASE_PROJECT_ID}.supabase.co/functions/v1/content-router`;

/** Returns a concise but complete Lunar CMS API reference for the system prompt. */
export function buildAiDocsContext(): string {
  const categories = Array.from(new Set(ENDPOINT_REGISTRY.map((e) => e.category)));

  const endpointLines = ENDPOINT_REGISTRY.map((ep) => {
    const params = ep.queryParams.length
      ? ` | params: ${ep.queryParams.map((p) => `${p.name}${p.required ? "*" : ""}`).join(", ")}`
      : "";
    return `  ${ep.method} ${ep.path} — ${ep.description}${params}`;
  }).join("\n");

  return `
LUNAR CMS — DEVELOPER KNOWLEDGE BASE
======================================
Base URL: ${BASE_URL}
Authentication: Authorization: Bearer <api_key>  (required for all endpoints)
Key types: pk_live_ (publishable, read-only, client-safe) | sk_live_ (secret, full access, server-only)
Response shape: { success: true, data: [...], meta: { page, limit, total, totalPages }, links: { first, previous, next, last } }
Error shape:    { success: false, error: { code: string, message: string } }
Pagination: ?page=1&limit=20 (max 100)
Filtering: ?status=published&sort=created_at&order=desc
Rate limits: pk_live_ → 60 req/min · 10 000/day | sk_live_ → 120 req/min · 50 000/day

ENDPOINT CATEGORIES: ${categories.join(", ")}

ALL ENDPOINTS (${ENDPOINT_REGISTRY.length} total):
${endpointLines}

ENGAGEMENT (likes, comments, views, shares):
  POST   /blogs/:slug/likes    — like a post (body: { user_id? })
  DELETE /blogs/:slug/likes    — unlike a post
  POST   /blogs/:slug/comments — submit a comment (body: { author_name, author_email, content })
  GET    /blogs/:slug/comments — list approved comments
  POST   /blogs/:slug/views    — record a page view
  GET    /blogs/:slug/stats    — { likes, comments, views, shares }
  (Same pattern applies for /news/:slug, /articles/:slug, /products/:slug)

COMMON ERRORS:
  401 INVALID_API_KEY — missing or invalid Bearer token
  403 FORBIDDEN       — key lacks permissions for this resource
  404 NOT_FOUND       — slug or resource doesn't exist / unpublished
  429 RATE_LIMIT_EXCEEDED — slow down; check Retry-After header
  500 INTERNAL_SERVER_ERROR — retry after delay

QUICK CODE EXAMPLE (fetch blog posts):
  const res = await fetch(\`${BASE_URL}/blogs?page=1&limit=20\`, {
    headers: { Authorization: \`Bearer \${process.env.LUNAR_API_KEY}\` }
  });
  const { data: posts, meta } = await res.json();

NEXT.JS SETUP:
  LUNAR_CMS_URL=${BASE_URL}
  LUNAR_CMS_API_KEY=pk_live_your_key_here
`.trim();
}
