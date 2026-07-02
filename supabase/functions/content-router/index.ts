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
 *
 * Every request passes through the shared middleware pipeline:
 *   OPTIONS → method guard → auth → rate-limit → route → transform → respond
 */

import { runPipeline, finalize } from "../_shared/pipeline.ts";
import { hasPermission }         from "../_shared/permissions.ts";
import { ok, fail, buildPaginationLinks } from "../_shared/response.ts";
import { ERRORS }                from "../_shared/errors.ts";

import { listBlogs, getBlogBySlug, getRelatedBlogs, getFeaturedBlogs, getLatestBlogs } from "./services/BlogService.ts";
import { listPages, getPageBySlug } from "./services/PageService.ts";
import { listMedia } from "./services/MediaService.ts";
import { listCollections, getCollectionEntries } from "./services/CollectionService.ts";
import { listCategories } from "./services/CategoryService.ts";
import { listTags } from "./services/TagService.ts";
import { search } from "./services/SearchService.ts";

// ── Helpers ────────────────────────────────────────────────────────────────────

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

// ── Main handler ───────────────────────────────────────────────────────────────

Deno.serve(async (req: Request) => {
  // ── Shared pipeline: OPTIONS / method guard / auth / rate-limit ─────────────
  const pipeline = await runPipeline(req, "content-router");
  if (!pipeline.ok) return pipeline.response;

  const { ctx } = pipeline;
  const { keyContext: context } = ctx;

  const url  = new URL(req.url);
  const segs = segments(url);
  const ws   = context.workspaceId;
  const kt   = context.keyType;

  let response: Response;

  try {
    const resource = segs[0] ?? "";

    // ── GET /blogs/* ───────────────────────────────────────────────────────────
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
        const totalPages = Math.ceil(total / limit);
        const links = buildPaginationLinks(req.url, page, totalPages);
        response = cached(ok(rows, { page, limit, total, totalPages }, 200, links));
      }

    // ── GET /pages/* ───────────────────────────────────────────────────────────
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
        const totalPages = Math.ceil(total / limit);
        const links = buildPaginationLinks(req.url, page, totalPages);
        response = cached(ok(rows, { page, limit, total, totalPages }, 200, links));
      }

    // ── GET /collections/* ─────────────────────────────────────────────────────
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
          const totalPages = Math.ceil(result.total / limit);
          const links = buildPaginationLinks(req.url, page, totalPages);
          response = cached(ok(result.rows, {
            page, limit,
            total: result.total,
            totalPages,
            collection: result.collection,
          }, 200, links));
        }

      } else {
        // GET /collections
        const page  = intParam(url, "page", 1, 1, 10_000);
        const limit = intParam(url, "limit", 20, 1, 100);
        const { rows, total } = await listCollections(ws, { page, limit });
        const totalPages = Math.ceil(total / limit);
        const links = buildPaginationLinks(req.url, page, totalPages);
        response = cached(ok(rows, { page, limit, total, totalPages }, 200, links));
      }

    // ── GET /categories ────────────────────────────────────────────────────────
    } else if (resource === "categories") {
      if (!hasPermission(context.permissions, "read:blogs")) {
        response = fail(ERRORS.FORBIDDEN.code, ERRORS.FORBIDDEN.message, 403);
      } else {
        const page    = intParam(url, "page", 1, 1, 10_000);
        const limit   = intParam(url, "limit", 20, 1, 100);
        const rawSort = url.searchParams.get("sort") ?? "name";
        const sort    = rawSort === "post_count" ? "post_count" : "name";
        const { rows, total } = await listCategories(ws, {
          page, limit, sort,
          order:  orderParam(url),
          search: strParam(url, "search"),
        });
        const totalPages = Math.ceil(total / limit);
        const links = buildPaginationLinks(req.url, page, totalPages);
        response = cached(ok(rows, { page, limit, total, totalPages }, 200, links));
      }

    // ── GET /tags ──────────────────────────────────────────────────────────────
    } else if (resource === "tags") {
      if (!hasPermission(context.permissions, "read:blogs")) {
        response = fail(ERRORS.FORBIDDEN.code, ERRORS.FORBIDDEN.message, 403);
      } else {
        const page    = intParam(url, "page", 1, 1, 10_000);
        const limit   = intParam(url, "limit", 20, 1, 100);
        const rawSort = url.searchParams.get("sort") ?? "name";
        const sort    = rawSort === "post_count" ? "post_count" : "name";
        const { rows, total } = await listTags(ws, {
          page, limit, sort,
          order:  orderParam(url),
          search: strParam(url, "search"),
        });
        const totalPages = Math.ceil(total / limit);
        const links = buildPaginationLinks(req.url, page, totalPages);
        response = cached(ok(rows, { page, limit, total, totalPages }, 200, links));
      }

    // ── GET /media ─────────────────────────────────────────────────────────────
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
        const totalPages = Math.ceil(total / limit);
        const links = buildPaginationLinks(req.url, page, totalPages);
        response = cached(ok(rows, { page, limit, total, totalPages }, 200, links));
      }

    // ── GET /search ────────────────────────────────────────────────────────────
    } else if (resource === "search") {
      const q = strParam(url, "q") ?? "";
      if (!q) {
        response = fail(
          ERRORS.BAD_REQUEST.code,
          "The `q` parameter is required for search.",
          400,
        );
      } else {
        const page  = intParam(url, "page", 1, 1, 10_000);
        const limit = intParam(url, "limit", 20, 1, 100);
        const { rows, total, query } = await search(ws, { q, page, limit });
        const totalPages = Math.ceil(total / limit);
        const links = buildPaginationLinks(req.url, page, totalPages);
        response = cached(ok(rows, { page, limit, total, totalPages, query }, 200, links));
      }

    // ── Unknown resource ───────────────────────────────────────────────────────
    } else {
      response = fail(
        ERRORS.NOT_FOUND.code,
        "Endpoint not found. Available: /blogs, /blogs/:slug, /blogs/featured, /blogs/latest, /blogs/:slug/related, /pages, /pages/:slug, /collections, /collections/:slug, /categories, /tags, /media, /search",
        404,
      );
    }
  } catch (_err) {
    response = fail(ERRORS.SERVER_ERROR.code, ERRORS.SERVER_ERROR.message, 500);
  }

  return finalize(response, ctx);
});
