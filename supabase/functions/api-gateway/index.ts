/**
 * api-gateway — unified entry point for all public REST API requests.
 *
 * External callers:
 *   GET https://<project>.supabase.co/functions/v1/api-gateway/blogs
 *   Authorization: Bearer pk_live_xxxxxxxxxxxxxxxx
 *
 * Routes:
 *   GET /blogs              list published posts (workspace-scoped)
 *   GET /blogs/:slug        single post by slug
 *   GET /media              list media files
 *   GET /collections        list collections
 *   GET /collections/:slug  list published entries in a collection
 *
 * Query params (lists):  page, limit, search, category
 */

import { createClient } from "jsr:@supabase/supabase-js@2";
import { validateApiKey } from "../_shared/auth.ts";
import { checkRateLimit } from "../_shared/rate_limit.ts";
import { hasPermission } from "../_shared/permissions.ts";
import { logRequest } from "../_shared/logger.ts";
import { ok, fail, cors } from "../_shared/response.ts";
import { ERRORS } from "../_shared/errors.ts";

// ── helpers ────────────────────────────────────────────────────────────────

function parseSegments(url: URL): string[] {
  const parts = url.pathname.split("/").filter(Boolean);
  const gwIdx = parts.findIndex((p) => p === "api-gateway");
  return gwIdx >= 0 ? parts.slice(gwIdx + 1) : parts;
}

function parsePagination(url: URL): { page: number; limit: number; offset: number } {
  const page = Math.max(1, parseInt(url.searchParams.get("page") ?? "1", 10) || 1);
  const limit = Math.min(100, Math.max(1, parseInt(url.searchParams.get("limit") ?? "20", 10) || 20));
  return { page, limit, offset: (page - 1) * limit };
}

function stripInternals<T extends Record<string, unknown>>(
  row: T,
  ...keys: string[]
): Omit<T, (typeof keys)[number]> {
  const out = { ...row };
  for (const k of keys) delete out[k];
  return out as Omit<T, (typeof keys)[number]>;
}

// ── main handler ───────────────────────────────────────────────────────────

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") return cors();
  if (req.method !== "GET") {
    return fail(ERRORS.METHOD_NOT_ALLOWED.code, ERRORS.METHOD_NOT_ALLOWED.message, 405);
  }

  const startTime = Date.now();
  const url = new URL(req.url);
  const segments = parseSegments(url);
  const apiPath = "/" + segments.join("/");
  const ip = req.headers.get("x-forwarded-for")?.split(",")[0].trim() ?? null;
  const ua = req.headers.get("user-agent") ?? null;

  // Shared log helper — fire-and-forget
  function log(
    workspaceId: string | null,
    apiKeyId: string | null,
    statusCode: number,
    error: string | null = null,
  ) {
    logRequest({
      workspaceId,
      apiKeyId,
      method: req.method,
      path: apiPath,
      statusCode,
      durationMs: Date.now() - startTime,
      ipAddress: ip,
      userAgent: ua,
      error,
    });
  }

  // ── 1. Authenticate ──────────────────────────────────────────────────────

  const authResult = await validateApiKey(req.headers.get("authorization"));

  if (!authResult.ok) {
    log(null, null, 401, authResult.error);
    return fail(ERRORS.INVALID_KEY.code, ERRORS.INVALID_KEY.message, 401);
  }

  const { context } = authResult;

  // ── 2. Rate limit ────────────────────────────────────────────────────────

  const rate = await checkRateLimit(context.keyId, context.workspaceId);

  if (!rate.allowed) {
    log(context.workspaceId, context.keyId, 429, "Rate limit exceeded");
    const res = fail(ERRORS.RATE_LIMITED.code, ERRORS.RATE_LIMITED.message, 429);
    // Add rate limit headers
    res.headers.set("X-RateLimit-Limit", String(rate.limit));
    res.headers.set("X-RateLimit-Remaining", "0");
    res.headers.set("X-RateLimit-Reset", rate.resetAt);
    return res;
  }

  // ── 3. Route ─────────────────────────────────────────────────────────────

  const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
  const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
  const db = createClient(supabaseUrl, serviceKey);
  const { page, limit, offset } = parsePagination(url);

  let response: Response;

  try {
    const resource = segments[0] ?? "";

    // ── GET /blogs  or  GET /blogs/:slug ──────────────────────────────────
    if (resource === "blogs" || resource === "") {
      if (!hasPermission(context.permissions, "read:blogs")) {
        response = fail(ERRORS.FORBIDDEN.code, ERRORS.FORBIDDEN.message, 403);
      } else if (segments[1]) {
        // Single post by slug
        const { data, error } = await db
          .from("blog_posts")
          .select(
            "id, title, slug, excerpt, content, category, tags, author_name, " +
              "cover_image, published_at, reading_time, views, seo_title, meta_description, featured",
          )
          .eq("status", "published")
          .eq("workspace_id", context.workspaceId)
          .eq("slug", segments[1])
          .single();

        if (error || !data) {
          response = fail(ERRORS.NOT_FOUND.code, ERRORS.NOT_FOUND.message, 404);
        } else {
          response = ok(stripInternals(data as Record<string, unknown>));
        }
      } else {
        // List posts
        const search = url.searchParams.get("search");
        const category = url.searchParams.get("category");
        const featured = url.searchParams.get("featured");

        let query = db
          .from("blog_posts")
          .select(
            "id, title, slug, excerpt, category, tags, author_name, cover_image, " +
              "published_at, reading_time, views, featured",
            { count: "exact" },
          )
          .eq("status", "published")
          .eq("workspace_id", context.workspaceId)
          .order("published_at", { ascending: false })
          .range(offset, offset + limit - 1);

        if (category) query = query.eq("category", category);
        if (featured === "true") query = query.eq("featured", true);
        if (search) {
          query = query.or(
            `title.ilike.%${search}%,excerpt.ilike.%${search}%`,
          );
        }

        const { data, count, error } = await query;
        if (error) throw new Error(error.message);

        const total = count ?? 0;
        response = ok(data ?? [], {
          page,
          limit,
          total,
          totalPages: Math.ceil(total / limit),
        });
      }
    // ── GET /media ────────────────────────────────────────────────────────
    } else if (resource === "media") {
      if (!hasPermission(context.permissions, "read:media")) {
        response = fail(ERRORS.FORBIDDEN.code, ERRORS.FORBIDDEN.message, 403);
      } else {
        const { data, count, error } = await db
          .from("media_files")
          .select(
            "id, file_name, storage_path, mime_type, size_bytes, width_px, height_px, " +
              "alt_text, caption, folder, tags, created_at",
            { count: "exact" },
          )
          .eq("workspace_id", context.workspaceId)
          .order("created_at", { ascending: false })
          .range(offset, offset + limit - 1);

        if (error) {
          // Table may not exist yet — return empty list gracefully
          response = ok([], { page, limit, total: 0, totalPages: 0 });
        } else {
          const total = count ?? 0;
          response = ok(data ?? [], {
            page,
            limit,
            total,
            totalPages: Math.ceil(total / limit),
          });
        }
      }
    // ── GET /collections  or  GET /collections/:slug ──────────────────────
    } else if (resource === "collections") {
      if (!hasPermission(context.permissions, "read:collections")) {
        response = fail(ERRORS.FORBIDDEN.code, ERRORS.FORBIDDEN.message, 403);
      } else if (segments[1]) {
        // Entries for a specific collection
        const { data: col, error: colErr } = await db
          .from("collections")
          .select("id, name, slug")
          .eq("slug", segments[1])
          .single();

        if (colErr || !col) {
          response = fail(ERRORS.NOT_FOUND.code, ERRORS.NOT_FOUND.message, 404);
        } else {
          const { data, count, error } = await db
            .from("collection_entries")
            .select("id, data, status, created_at, updated_at", {
              count: "exact",
            })
            .eq("collection_id", col.id)
            .eq("status", "published")
            .order("created_at", { ascending: false })
            .range(offset, offset + limit - 1);

          if (error) throw new Error(error.message);
          const total = count ?? 0;
          response = ok(data ?? [], {
            page,
            limit,
            total,
            totalPages: Math.ceil(total / limit),
            collection: { id: col.id, name: col.name, slug: col.slug },
          });
        }
      } else {
        // List all collections
        const { data, count, error } = await db
          .from("collections")
          .select("id, name, slug, description, created_at", {
            count: "exact",
          })
          .order("name")
          .range(offset, offset + limit - 1);

        if (error) throw new Error(error.message);
        const total = count ?? 0;
        response = ok(data ?? [], {
          page,
          limit,
          total,
          totalPages: Math.ceil(total / limit),
        });
      }
    // ── Unknown route ─────────────────────────────────────────────────────
    } else {
      response = fail(
        ERRORS.NOT_FOUND.code,
        "Endpoint not found. Available routes: /blogs, /blogs/:slug, /media, /collections, /collections/:slug",
        404,
      );
    }
  } catch (_err) {
    log(context.workspaceId, context.keyId, 500, "Server error");
    return fail(ERRORS.SERVER_ERROR.code, ERRORS.SERVER_ERROR.message, 500);
  }

  // Add rate limit headers to successful responses
  response.headers.set("X-RateLimit-Limit", String(rate.limit));
  response.headers.set("X-RateLimit-Remaining", String(rate.remaining));
  response.headers.set("X-RateLimit-Reset", rate.resetAt);

  log(context.workspaceId, context.keyId, response.status);
  return response;
});
