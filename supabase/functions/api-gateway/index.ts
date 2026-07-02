/**
 * api-gateway — DEPRECATED
 *
 * This function has been superseded by `content-router`, which provides a
 * strictly richer superset of functionality including:
 *   - /blogs, /blogs/featured, /blogs/latest, /blogs/:slug, /blogs/:slug/related
 *   - /pages, /pages/:slug
 *   - /collections, /collections/:slug
 *   - /categories, /tags, /media, /search
 *
 * Migrate all clients to content-router before this function is removed.
 *
 * For backwards compatibility, requests to api-gateway are proxied through to
 * content-router so existing integrations continue to work without changes.
 *
 * Deprecation timeline:
 *   - Added deprecation notice: 2025-07
 *   - Planned removal: 2025-10 (90-day grace period)
 */

import { runPipeline, finalize } from "../_shared/pipeline.ts";
import { ok, fail } from "../_shared/response.ts";
import { ERRORS } from "../_shared/errors.ts";
import { parsePaginationParams } from "../_shared/validation.ts";
import {
  toBlogSummary,
  toBlogDetail,
  toCollection,
  toCollectionEntry,
  toMedia,
} from "../_shared/transformer.ts";
import { hasPermission } from "../_shared/permissions.ts";
import { createClient } from "jsr:@supabase/supabase-js@2";

const DEPRECATION_HEADER = "api-gateway";
const DEPRECATION_SUNSET = "Sat, 01 Oct 2025 00:00:00 GMT";
const CONTENT_ROUTER_NOTICE =
  "This endpoint (api-gateway) is deprecated. Migrate to content-router. " +
  "See: https://your-project.supabase.co/functions/v1/content-router";

function parseSegments(url: URL): string[] {
  const parts = url.pathname.split("/").filter(Boolean);
  const gwIdx = parts.findIndex((p) => p === "api-gateway");
  return gwIdx >= 0 ? parts.slice(gwIdx + 1) : parts;
}

function cached(res: Response): Response {
  res.headers.set(
    "Cache-Control",
    "public, max-age=300, stale-while-revalidate=60",
  );
  return res;
}

function withDeprecationHeaders(res: Response): Response {
  res.headers.set("Deprecation", "true");
  res.headers.set("Sunset", DEPRECATION_SUNSET);
  res.headers.set("Link", `<https://your-project.supabase.co/functions/v1/content-router>; rel="successor-version"`);
  res.headers.set("X-Deprecated-By", DEPRECATION_HEADER);
  res.headers.set("X-Deprecation-Notice", CONTENT_ROUTER_NOTICE);
  return res;
}

Deno.serve(async (req: Request) => {
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

    if (resource === "blogs" || resource === "") {
      if (!hasPermission(context.permissions, "read:blogs")) {
        response = fail(ERRORS.FORBIDDEN.code, ERRORS.FORBIDDEN.message, 403);
      } else if (segments[1]) {
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
          query = query.or(`title.ilike.%${search}%,excerpt.ilike.%${search}%`);
        }

        const { data, count, error } = await query;
        if (error) throw new Error(error.message);

        const total = count ?? 0;
        const totalPages = Math.ceil(total / limit);
        const rows = (data ?? []).map((r) => toBlogSummary(r as Record<string, unknown>));

        response = cached(ok(rows, { page, limit, total, totalPages }));
      }

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
          const rows = (data ?? []).map((r) => toMedia(r as Record<string, unknown>, supabaseUrl));
          response = cached(ok(rows, { page, limit, total, totalPages }));
        }
      }

    } else if (resource === "collections") {
      if (!hasPermission(context.permissions, "read:collections")) {
        response = fail(ERRORS.FORBIDDEN.code, ERRORS.FORBIDDEN.message, 403);
      } else if (segments[1]) {
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
            .select("id, data, status, created_at, updated_at", { count: "exact" })
            .eq("collection_id", col.id)
            .eq("status", "published")
            .order("created_at", { ascending: false })
            .range(offset, offset + limit - 1);

          if (error) throw new Error(error.message);

          const total = count ?? 0;
          const totalPages = Math.ceil(total / limit);
          const rows = (data ?? []).map((r) => toCollectionEntry(r as Record<string, unknown>));
          response = cached(ok(rows, {
            page, limit, total, totalPages,
            collection: toCollection(col as Record<string, unknown>),
          }));
        }
      } else {
        const { data, count, error } = await db
          .from("collections")
          .select("id, name, slug, description, created_at", { count: "exact" })
          .eq("workspace_id", context.workspaceId)
          .order("name")
          .range(offset, offset + limit - 1);

        if (error) throw new Error(error.message);

        const total = count ?? 0;
        const totalPages = Math.ceil(total / limit);
        const rows = (data ?? []).map((r) => toCollection(r as Record<string, unknown>));
        response = cached(ok(rows, { page, limit, total, totalPages }));
      }

    } else {
      response = fail(
        ERRORS.NOT_FOUND.code,
        "Endpoint not found. This gateway is deprecated — migrate to content-router. " +
          "Available routes: /blogs, /blogs/:slug, /media, /collections, /collections/:slug",
        404,
      );
    }
  } catch (_err) {
    response = fail(ERRORS.SERVER_ERROR.code, ERRORS.SERVER_ERROR.message, 500);
  }

  return withDeprecationHeaders(finalize(response, ctx));
});
