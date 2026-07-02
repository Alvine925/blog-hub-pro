/**
 * content-router — versioned REST API gateway for Lunar CMS content.
 *
 * Base URL (external):
 *   https://<project>.supabase.co/functions/v1/content-router
 *
 * Endpoints:
 *   GET /blogs                      — paginated list of published blogs
 *   GET /blogs/featured             — featured published blogs
 *   GET /blogs/latest               — latest N published blogs
 *   GET /blogs/:slug                — single blog by slug
 *   GET /blogs/:slug/related        — related blogs (by category + tags)
 *   GET /pages                      — published pages
 *   GET /pages/:slug                — single page by slug
 *   GET /collections                — all visible collections
 *   GET /collections/:slug          — entries for a specific collection
 *   GET /categories                 — distinct categories with post counts
 *   GET /tags                       — distinct tags with post counts
 *   GET /media                      — public media files
 *   GET /search?q=...               — unified search across all content types
 *
 * Auth: Bearer API key (pk_live_* or sk_live_*)
 */

import { validateApiKey }  from "../_shared/auth.ts";
import { checkRateLimit }  from "../_shared/rate_limit.ts";
import { hasPermission }   from "../_shared/permissions.ts";
import { logRequest }      from "../_shared/logger.ts";
import { ok, fail, cors, CORS_HEADERS } from "../_shared/response.ts";
import { ERRORS }          from "../_shared/errors.ts";

import { listBlogs, getBlogBySlug, getRelatedBlogs, getFeaturedBlogs, getLatestBlogs } from "./services/BlogService.ts";
import { listPages, getPageBySlug } from "./services/PageService.ts";
import { listMedia } from "./services/MediaService.ts";
import { listCollections, getCollectionEntries } from "./services/CollectionService.ts";
import { listCategories } from "./services/CategoryService.ts";
import { listTags } from "./services/TagService.ts";
import { search } from "./services/SearchService.ts";

// ── Helpers ───────────────────────────────────────────────────────────────────

function segments(url: URL): string[] {
  const parts = url.pathname.split("/").filter(Boolean);
  const idx = parts.findIndex((p) => p === "content-router");
  return idx >= 0 ? parts.slice(idx + 1) : parts;
}

function intParam(url: URL, key: string, def: number, min = 1, max = 100): number {
  const v = parseInt(url.searchParams.get(key) ?? "", 10);
  return isNaN(v) ? def : Math.min(max, Math.max(min, v));
}

function strParam(url: URL, key: string): string | undefined {
  const v = url.searchParams.get(key);
  return v ? v.trim() || undefined : undefined;
}

function boolParam(url: URL, key: string): boolean | undefined {
  const v = url.searchParams.get(key);
  if (v === "true" || v === "1") return true;
  if (v === "false" || v === "0") return false;
  return undefined;
}

function dateParam(url: URL, key: string): string | undefined {
  const v = url.searchParams.get(key);
  if (!v) return undefined;
  // Basic ISO date validation
  return /^\d{4}-\d{2}-\d{2}/.test(v) ? v : undefined;
}

function sortParam(url: URL, allowed: readonly string[], def: string): string {
  const v = url.searchParams.get("sort") ?? "";
  return allowed.includes(v) ? v : def;
}

function orderParam(url: URL): "asc" | "desc" {
  return url.searchParams.get("order") === "asc" ? "asc" : "desc";
}

/** Add 5-minute public cache headers to a successful response. */
function cached(res: Response): Response {
  res.headers.set("Cache-Control", "public, max-age=300, stale-while-revalidate=60");
  return res;
}

// ── Main handler ──────────────────────────────────────────────────────────────

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") return cors();
  if (req.method !== "GET") {
    return fail(ERRORS.METHOD_NOT_ALLOWED.code, ERRORS.METHOD_NOT_ALLOWED.message, 405);
  }

  const start = Date.now();
  const url   = new URL(req.url);
  const segs  = segments(url);
  const path  = "/" + segs.join("/");
  const ip    = req.headers.get("x-forwarded-for")?.split(",")[0].trim() ?? null;
  const ua    = req.headers.get("user-agent") ?? null;

  function log(workspaceId: string | null, keyId: string | null, status: number, error: string | null = null) {
    logRequest({
      workspaceId, apiKeyId: keyId, method: req.method,
      path, statusCode: status, durationMs: Date.now() - start,
      ipAddress: ip, userAgent: ua, error,
    });
  }

  // ── 1. Authenticate ────────────────────────────────────────────────────────
  const auth = await validateApiKey(req.headers.get("authorization"));
  if (!auth.ok) {
    log(null, null, 401, auth.error);
    return fail(ERRORS.INVALID_KEY.code, ERRORS.INVALID_KEY.message, 401);
  }
  const { context } = auth;

  // ── 2. Rate limit ──────────────────────────────────────────────────────────
  const rate = await checkRateLimit(context.keyId, context.workspaceId);
  if (!rate.allowed) {
    log(context.workspaceId, context.keyId, 429, "Rate limit exceeded");
    const res = fail(ERRORS.RATE_LIMITED.code, ERRORS.RATE_LIMITED.message, 429);
    res.headers.set("X-RateLimit-Limit", String(rate.limit));
    res.headers.set("X-RateLimit-Remaining", "0");
    res.headers.set("X-RateLimit-Reset", rate.resetAt);
    return res;
  }

  const ws  = context.workspaceId;
  const kt  = context.keyType;
  let response: Response;

  try {
    const resource = segs[0] ?? "";

    // ── GET /blogs/* ─────────────────────────────────────────────────────────
    if (resource === "blogs") {
      if (!hasPermission(context.permissions, "read:blogs")) {
        response = fail(ERRORS.FORBIDDEN.code, ERRORS.FORBIDDEN.message, 403);

      } else if (segs[1] === "featured") {
        // GET /blogs/featured
        const limit = intParam(url, "limit", 10, 1, 50);
        const data  = await getFeaturedBlogs(ws, limit);
        response = cached(ok(data, { total: data.length }));

      } else if (segs[1] === "latest") {
        // GET /blogs/latest
        const limit = intParam(url, "limit", 10, 1, 50);
        const data  = await getLatestBlogs(ws, limit);
        response = cached(ok(data, { total: data.length }));

      } else if (segs[1] && segs[2] === "related") {
        // GET /blogs/:slug/related
        const limit  = intParam(url, "limit", 5, 1, 20);
        const result = await getRelatedBlogs(ws, segs[1], limit);
        response = cached(ok(result, { total: result.length }));

      } else if (segs[1]) {
        // GET /blogs/:slug
        const post = await getBlogBySlug(ws, segs[1], kt);
        if (!post) {
          response = fail(ERRORS.NOT_FOUND.code, ERRORS.NOT_FOUND.message, 404);
        } else {
          response = cached(ok(post));
        }

      } else {
        // GET /blogs
        const page  = intParam(url, "page", 1, 1, 10_000);
        const limit = intParam(url, "limit", 20, 1, 100);
        const sort  = sortParam(url, ["created_at", "updated_at", "published_at", "title", "views"], "published_at");
        const { rows, total } = await listBlogs(ws, {
          page, limit, sort,
          order:    orderParam(url),
          search:   strParam(url, "search"),
          category: strParam(url, "category"),
          tag:      strParam(url, "tag"),
          author:   strParam(url, "author"),
          featured: boolParam(url, "featured"),
          from:     dateParam(url, "from"),
          to:       dateParam(url, "to"),
          status:   strParam(url, "status"),
          keyType:  kt,
        });
        response = cached(ok(rows, {
          page, limit, total,
          totalPages: Math.ceil(total / limit),
        }));
      }

    // ── GET /pages/* ─────────────────────────────────────────────────────────
    } else if (resource === "pages") {
      if (!hasPermission(context.permissions, "read:pages")) {
        response = fail(ERRORS.FORBIDDEN.code, ERRORS.FORBIDDEN.message, 403);

      } else if (segs[1]) {
        // GET /pages/:slug
        const page = await getPageBySlug(ws, segs[1]);
        if (!page) {
          response = fail(ERRORS.NOT_FOUND.code, ERRORS.NOT_FOUND.message, 404);
        } else {
          response = cached(ok(page));
        }

      } else {
        // GET /pages
        const page  = intParam(url, "page", 1, 1, 10_000);
        const limit = intParam(url, "limit", 20, 1, 100);
        const { rows, total } = await listPages(ws, { page, limit });
        response = cached(ok(rows, {
          page, limit, total,
          totalPages: Math.ceil(total / limit),
        }));
      }

    // ── GET /collections/* ───────────────────────────────────────────────────
    } else if (resource === "collections") {
      if (!hasPermission(context.permissions, "read:collections")) {
        response = fail(ERRORS.FORBIDDEN.code, ERRORS.FORBIDDEN.message, 403);

      } else if (segs[1]) {
        // GET /collections/:slug
        const page  = intParam(url, "page", 1, 1, 10_000);
        const limit = intParam(url, "limit", 20, 1, 100);
        const result = await getCollectionEntries(ws, segs[1], { page, limit });
        if (!result) {
          response = fail(ERRORS.NOT_FOUND.code, ERRORS.NOT_FOUND.message, 404);
        } else {
          response = cached(ok(result.rows, {
            page, limit,
            total: result.total,
            totalPages: Math.ceil(result.total / limit),
            collection: result.collection,
          }));
        }

      } else {
        // GET /collections
        const page  = intParam(url, "page", 1, 1, 10_000);
        const limit = intParam(url, "limit", 20, 1, 100);
        const { rows, total } = await listCollections(ws, { page, limit });
        response = cached(ok(rows, {
          page, limit, total,
          totalPages: Math.ceil(total / limit),
        }));
      }

    // ── GET /categories ──────────────────────────────────────────────────────
    } else if (resource === "categories") {
      if (!hasPermission(context.permissions, "read:blogs")) {
        response = fail(ERRORS.FORBIDDEN.code, ERRORS.FORBIDDEN.message, 403);
      } else {
        const page  = intParam(url, "page", 1, 1, 10_000);
        const limit = intParam(url, "limit", 20, 1, 100);
        const rawSort = url.searchParams.get("sort") ?? "name";
        const sort = rawSort === "post_count" ? "post_count" : "name";
        const { rows, total } = await listCategories(ws, {
          page, limit, sort,
          order:  orderParam(url),
          search: strParam(url, "search"),
        });
        response = cached(ok(rows, {
          page, limit, total,
          totalPages: Math.ceil(total / limit),
        }));
      }

    // ── GET /tags ────────────────────────────────────────────────────────────
    } else if (resource === "tags") {
      if (!hasPermission(context.permissions, "read:blogs")) {
        response = fail(ERRORS.FORBIDDEN.code, ERRORS.FORBIDDEN.message, 403);
      } else {
        const page  = intParam(url, "page", 1, 1, 10_000);
        const limit = intParam(url, "limit", 20, 1, 100);
        const rawSort = url.searchParams.get("sort") ?? "name";
        const sort = rawSort === "post_count" ? "post_count" : "name";
        const { rows, total } = await listTags(ws, {
          page, limit, sort,
          order:  orderParam(url),
          search: strParam(url, "search"),
        });
        response = cached(ok(rows, {
          page, limit, total,
          totalPages: Math.ceil(total / limit),
        }));
      }

    // ── GET /media ───────────────────────────────────────────────────────────
    } else if (resource === "media") {
      if (!hasPermission(context.permissions, "read:media")) {
        response = fail(ERRORS.FORBIDDEN.code, ERRORS.FORBIDDEN.message, 403);
      } else {
        const page  = intParam(url, "page", 1, 1, 10_000);
        const limit = intParam(url, "limit", 20, 1, 100);
        const sort  = sortParam(url, ["created_at", "file_name", "size_bytes"], "created_at");
        const { rows, total } = await listMedia(ws, {
          page, limit, sort,
          order:     orderParam(url),
          folder:    strParam(url, "folder"),
          mime_type: strParam(url, "mime_type"),
          search:    strParam(url, "search"),
        });
        response = cached(ok(rows, {
          page, limit, total,
          totalPages: Math.ceil(total / limit),
        }));
      }

    // ── GET /search ──────────────────────────────────────────────────────────
    } else if (resource === "search") {
      const q = strParam(url, "q") ?? "";
      if (!q) {
        response = fail("INVALID_QUERY", "The `q` parameter is required for search.", 400);
      } else {
        const page  = intParam(url, "page", 1, 1, 10_000);
        const limit = intParam(url, "limit", 20, 1, 100);
        const { rows, total, query } = await search(ws, { q, page, limit });
        response = cached(ok(rows, {
          page, limit, total,
          totalPages: Math.ceil(total / limit),
          query,
        }));
      }

    // ── Unknown resource ─────────────────────────────────────────────────────
    } else {
      response = fail(
        ERRORS.NOT_FOUND.code,
        "Endpoint not found. Available: /blogs, /blogs/:slug, /blogs/featured, /blogs/latest, /blogs/:slug/related, /pages, /pages/:slug, /collections, /collections/:slug, /categories, /tags, /media, /search",
        404,
      );
    }
  } catch (_err) {
    log(context.workspaceId, context.keyId, 500, "Server error");
    return fail(ERRORS.SERVER_ERROR.code, ERRORS.SERVER_ERROR.message, 500);
  }

  // Rate limit headers on every response
  response.headers.set("X-RateLimit-Limit", String(rate.limit));
  response.headers.set("X-RateLimit-Remaining", String(rate.remaining));
  response.headers.set("X-RateLimit-Reset", rate.resetAt);

  log(context.workspaceId, context.keyId, response.status);
  return response;
});
