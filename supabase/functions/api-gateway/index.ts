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
 * Query params (lists):  page, limit, search, category, featured
 *
 * Every request passes through the shared middleware pipeline:
 *   OPTIONS → method guard → auth → rate-limit → route → transform → respond
 */

import { createClient } from "jsr:@supabase/supabase-js@2";
import { runPipeline, finalize } from "../_shared/pipeline.ts";
import { hasPermission } from "../_shared/permissions.ts";
import { ok, fail, buildPaginationLinks } from "../_shared/response.ts";
import { ERRORS } from "../_shared/errors.ts";
import { parsePaginationParams } from "../_shared/validation.ts";
import {
  toBlogSummary,
  toBlogDetail,
  toCollection,
  toCollectionEntry,
  toMedia,
} from "../_shared/transformer.ts";

// ── helpers ────────────────────────────────────────────────────────────────

function parseSegments(url: URL): string[] {
  const parts = url.pathname.split("/").filter(Boolean);
  const gwIdx = parts.findIndex((p) => p === "api-gateway");
  return gwIdx >= 0 ? parts.slice(gwIdx + 1) : parts;
}

/** Add 5-minute public cache headers to a successful response. */
function cached(res: Response): Response {
  res.headers.set(
    "Cache-Control",
    "public, max-age=300, stale-while-revalidate=60",
  );
  return res;
}

// ── main handler ───────────────────────────────────────────────────────────

Deno.serve(async (req: Request) => {
  // ── Shared pipeline: OPTIONS / method guard / auth / rate-limit ───────────
  const pipeline = await runPipeline(req, "api-gateway");
  if (!pipeline.ok) return pipeline.response;

  const { ctx } = pipeline;
  const { keyContext: context } = ctx;

  const url = new URL(req.url);
  const segments = parseSegments(url);
  const { page, limit, offset } = parsePaginationParams(url);

  const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
  const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
  const db = createClient(supabaseUrl, serviceKey);

  let response: Response;

  try {
    const resource = segments[0] ?? "";

    // ── GET /blogs  or  GET /blogs/:slug ────────────────────────────────────
    if (resource === "blogs" || resource === "") {
      if (!hasPermission(context.permissions, "read:blogs")) {
        response = fail(ERRORS.FORBIDDEN.code, ERRORS.FORBIDDEN.message, 403);
      } else if (segments[1]) {
        // Single post by slug
        const { data, error } = await db
          .from("blog_posts")
          .select(
            "id, title, slug, excerpt, content, category, tags, author_name, " +
              "cover_image, published_at, updated_at, reading_time, views, seo_title, meta_description, featured",
          )
          .eq("status", "published")
          .eq("workspace_id", context.workspaceId)
          .eq("slug", segments[1])
          .single();

        if (error || !data) {
          response = fail(ERRORS.NOT_FOUND.code, ERRORS.NOT_FOUND.message, 404);
        } else {
          response = cached(ok(toBlogDetail(data as Record<string, unknown>)));
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
              "published_at, updated_at, reading_time, views, featured",
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
        const totalPages = Math.ceil(total / limit);
        const links = buildPaginationLinks(req.url, page, totalPages);
        const rows = (data ?? []).map((r) =>
          toBlogSummary(r as Record<string, unknown>)
        );

        response = cached(ok(rows, { page, limit, total, totalPages }, 200, links));
      }

    // ── GET /media ──────────────────────────────────────────────────────────
    } else if (resource === "media") {
      if (!hasPermission(context.permissions, "read:media")) {
        response = fail(ERRORS.FORBIDDEN.code, ERRORS.FORBIDDEN.message, 403);
      } else {
        const { data, count, error } = await db
          .from("media_files")
          .select(
            "id, file_name, storage_path, bucket, mime_type, size_bytes, width_px, height_px, " +
              "alt_text, caption, folder, tags, created_at",
            { count: "exact" },
          )
          .eq("workspace_id", context.workspaceId)
          .order("created_at", { ascending: false })
          .range(offset, offset + limit - 1);

        if (error) {
          response = ok([], { page, limit, total: 0, totalPages: 0 });
        } else {
          const total = count ?? 0;
          const totalPages = Math.ceil(total / limit);
          const links = buildPaginationLinks(req.url, page, totalPages);
          const rows = (data ?? []).map((r) =>
            toMedia(r as Record<string, unknown>, supabaseUrl)
          );
          response = cached(ok(rows, { page, limit, total, totalPages }, 200, links));
        }
      }

    // ── GET /collections  or  GET /collections/:slug ────────────────────────
    } else if (resource === "collections") {
      if (!hasPermission(context.permissions, "read:collections")) {
        response = fail(ERRORS.FORBIDDEN.code, ERRORS.FORBIDDEN.message, 403);
      } else if (segments[1]) {
        // Entries for a specific collection — resolve by workspace too
        const { data: col, error: colErr } = await db
          .from("collections")
          .select("id, name, slug")
          .eq("slug", segments[1])
          .eq("workspace_id", context.workspaceId)
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
          const totalPages = Math.ceil(total / limit);
          const links = buildPaginationLinks(req.url, page, totalPages);
          const rows = (data ?? []).map((r) =>
            toCollectionEntry(r as Record<string, unknown>)
          );

          response = cached(ok(rows, {
            page, limit, total, totalPages,
            collection: toCollection(col as Record<string, unknown>),
          }, 200, links));
        }
      } else {
        // List all collections for this workspace
        const { data, count, error } = await db
          .from("collections")
          .select("id, name, slug, description, created_at", {
            count: "exact",
          })
          .eq("workspace_id", context.workspaceId)
          .order("name")
          .range(offset, offset + limit - 1);

        if (error) throw new Error(error.message);

        const total = count ?? 0;
        const totalPages = Math.ceil(total / limit);
        const links = buildPaginationLinks(req.url, page, totalPages);
        const rows = (data ?? []).map((r) =>
          toCollection(r as Record<string, unknown>)
        );

        response = cached(ok(rows, { page, limit, total, totalPages }, 200, links));
      }

    // ── Unknown route ───────────────────────────────────────────────────────
    } else {
      response = fail(
        ERRORS.NOT_FOUND.code,
        "Endpoint not found. Available routes: /blogs, /blogs/:slug, /media, /collections, /collections/:slug",
        404,
      );
    }
  } catch (_err) {
    response = fail(
      ERRORS.SERVER_ERROR.code,
      ERRORS.SERVER_ERROR.message,
      500,
    );
  }

  return finalize(response, ctx);
});
