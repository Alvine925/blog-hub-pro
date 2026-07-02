/**
 * cache-invalidation — intelligent cache invalidation for the Lunar CMS API.
 *
 * This function is called internally by the CMS whenever published content
 * changes. It determines which cache entries are affected, logs the
 * invalidation event, and returns a list of purged cache tags so that
 * CDN providers (Cloudflare, Fastly, etc.) can purge matching surrogate keys.
 *
 * Authentication:
 *   POST /cache-invalidation
 *   Authorization: Bearer <SUPABASE_SERVICE_ROLE_KEY>
 *
 * Request body:
 *   {
 *     "event":       "blog.published" | "blog.updated" | "blog.deleted"
 *                  | "page.published" | "page.updated"
 *                  | "collection.updated" | "media.updated",
 *     "workspaceId": "<uuid>",
 *     "slug":        "<resource-slug>"   // optional for list-level events
 *   }
 *
 * Response body:
 *   {
 *     "success": true,
 *     "data": {
 *       "invalidated": ["tag1", "tag2", ...],
 *       "event": "blog.published",
 *       "timestamp": "ISO8601"
 *     }
 *   }
 *
 * Cache tags follow the pattern: "<workspace>:<resource>[:<slug>]"
 * e.g. "ws_abc123:blogs", "ws_abc123:blog:my-post-slug"
 */

import { createClient } from "jsr:@supabase/supabase-js@2";
import { cors, fail, ok, CORS_HEADERS } from "../_shared/response.ts";
import { ERRORS } from "../_shared/errors.ts";

// ── Types ─────────────────────────────────────────────────────────────────────

type CacheEvent =
  | "blog.published"
  | "blog.updated"
  | "blog.deleted"
  | "page.published"
  | "page.updated"
  | "collection.updated"
  | "media.updated";

interface InvalidationRequest {
  event: CacheEvent;
  workspaceId: string;
  slug?: string;
}

// ── Cache tag resolver ────────────────────────────────────────────────────────

function resolveCacheTags(
  event: CacheEvent,
  workspaceId: string,
  slug?: string,
): string[] {
  const ws = `ws_${workspaceId.replace(/-/g, "").slice(0, 12)}`;
  const tags: string[] = [];

  switch (event) {
    case "blog.published":
    case "blog.updated":
    case "blog.deleted":
      // Always invalidate the list
      tags.push(`${ws}:blogs`);
      tags.push(`${ws}:blogs:featured`);
      tags.push(`${ws}:blogs:latest`);
      tags.push(`${ws}:search`);
      tags.push(`${ws}:categories`);
      tags.push(`${ws}:tags`);
      // Invalidate the specific post if slug is known
      if (slug) {
        tags.push(`${ws}:blog:${slug}`);
        tags.push(`${ws}:blog:${slug}:related`);
      }
      break;

    case "page.published":
    case "page.updated":
      tags.push(`${ws}:pages`);
      tags.push(`${ws}:search`);
      if (slug) {
        tags.push(`${ws}:page:${slug}`);
      }
      break;

    case "collection.updated":
      tags.push(`${ws}:collections`);
      tags.push(`${ws}:search`);
      if (slug) {
        tags.push(`${ws}:collection:${slug}`);
      }
      break;

    case "media.updated":
      tags.push(`${ws}:media`);
      break;
  }

  return tags;
}

// ── Log invalidation event ────────────────────────────────────────────────────

async function logInvalidation(
  event: CacheEvent,
  workspaceId: string,
  slug: string | undefined,
  tags: string[],
): Promise<void> {
  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const serviceKey  = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const db = createClient(supabaseUrl, serviceKey);

    await db.from("cache_invalidation_logs").insert({
      workspace_id:   workspaceId,
      event,
      resource_slug:  slug ?? null,
      invalidated_tags: tags,
      invalidated_at: new Date().toISOString(),
    });
  } catch {
    // Logging must never fail the response
  }
}

// ── Main handler ──────────────────────────────────────────────────────────────

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") return cors();

  if (req.method !== "POST") {
    return fail(ERRORS.METHOD_NOT_ALLOWED.code, "Only POST requests are accepted.", 405);
  }

  // ── 1. Authenticate with service-role key ──────────────────────────────────
  const authHeader = req.headers.get("authorization");
  const token      = authHeader?.startsWith("Bearer ")
    ? authHeader.slice(7).trim()
    : null;

  const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
  if (!token || !serviceKey || token !== serviceKey) {
    return fail(ERRORS.INVALID_KEY.code, "Internal endpoint: invalid credentials.", 401);
  }

  // ── 2. Parse and validate request body ────────────────────────────────────
  let body: InvalidationRequest;
  try {
    body = await req.json() as InvalidationRequest;
  } catch {
    return fail(ERRORS.BAD_REQUEST.code, "Request body must be valid JSON.", 400);
  }

  const { event, workspaceId, slug } = body;

  if (!event || !workspaceId) {
    return fail(
      ERRORS.BAD_REQUEST.code,
      "Request body must include `event` and `workspaceId`.",
      400,
    );
  }

  const validEvents: CacheEvent[] = [
    "blog.published", "blog.updated", "blog.deleted",
    "page.published", "page.updated",
    "collection.updated", "media.updated",
  ];

  if (!validEvents.includes(event)) {
    return fail(
      ERRORS.UNPROCESSABLE_ENTITY.code,
      `Unknown event type. Valid values: ${validEvents.join(", ")}`,
      422,
    );
  }

  // ── 3. Resolve affected cache tags ─────────────────────────────────────────
  const tags = resolveCacheTags(event, workspaceId, slug);

  // ── 4. Log the invalidation (fire-and-forget) ─────────────────────────────
  logInvalidation(event, workspaceId, slug, tags);

  // ── 5. Return the list of invalidated tags ────────────────────────────────
  // Callers can use these tags with their CDN provider's purge API.
  // Example Cloudflare usage:
  //   POST https://api.cloudflare.com/client/v4/zones/{zone_id}/purge_cache
  //   { "tags": ["ws_abc123:blogs", "ws_abc123:blog:my-slug"] }
  const response = ok(
    {
      invalidated: tags,
      event,
      timestamp: new Date().toISOString(),
    },
    {},
    200,
  );

  // Return cache tags in Surrogate-Key / Cache-Tag headers for CDN integration
  response.headers.set("Surrogate-Key", tags.join(" "));
  response.headers.set("Cache-Tag", tags.join(","));

  return response;
});
