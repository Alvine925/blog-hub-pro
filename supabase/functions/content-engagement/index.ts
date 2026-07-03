/**
 * content-engagement — Likes, comments, view tracking, shares, related content
 * and per-item stats for News, Articles, and Products in Lunar CMS.
 *
 * Base URL (external):
 *   https://<project>.supabase.co/functions/v1/content-engagement
 *
 * Endpoints (same pattern for news / articles / products):
 *   GET    /:type/:slug/likes       — like count + visitor's like status
 *   POST   /:type/:slug/likes       — like an item (idempotent per visitor)
 *   DELETE /:type/:slug/likes       — unlike an item
 *   GET    /:type/:slug/comments    — approved comments (threaded)
 *   POST   /:type/:slug/comments    — submit a comment (pending moderation)
 *   PUT    /comments/:type/:id      — moderate a comment (secret + manage:comments)
 *   DELETE /comments/:type/:id      — delete a comment  (secret + manage:comments)
 *   POST   /:type/:slug/view        — record a page view (30-min dedup per visitor)
 *   GET    /:type/:slug/share       — Open Graph share metadata + channel URLs
 *   POST   /:type/:slug/share       — record a share-button click
 *   GET    /:type/:slug/stats       — aggregated stats + feature flags + branding
 *   GET    /:type/:slug/related     — related content by category
 *
 * :type = news | articles | products
 *
 * Auth: Bearer API key (pk_live_* for public read/write; sk_live_* required
 * for comment moderation). Visitor identity: X-Visitor-Id header (falls back
 * to IP+UA hash when absent).
 */

import { runPipeline, finalize } from "../_shared/pipeline.ts";
import { hasPermission } from "../_shared/permissions.ts";
import { ok, fail } from "../_shared/response.ts";
import { ERRORS } from "../_shared/errors.ts";
import { getVisitorId } from "../_shared/visitor.ts";

import { resolveType } from "./services/ContentType.ts";
import { resolveContent } from "./services/GenericLookup.ts";
import { likeContent, unlikeContent, getLikeStatus } from "./services/GenericLike.ts";
import {
  listApprovedComments, submitComment,
  moderateComment, deleteComment,
} from "./services/GenericComment.ts";
import { recordView } from "./services/GenericView.ts";
import { recordShare, buildShareMetadata } from "./services/GenericShare.ts";
import { getContentStats, getEngagementSettings, getRelatedContent } from "./services/GenericStats.ts";
import { getDb } from "./db.ts";

const ALLOWED_METHODS = ["GET", "POST", "PUT", "DELETE"] as const;

function segments(url: URL): string[] {
  const parts = url.pathname.split("/").filter(Boolean);
  const idx = parts.findIndex((p) => p === "content-engagement");
  return idx >= 0 ? parts.slice(idx + 1) : parts;
}

function intParam(url: URL, key: string, def: number, min = 1, max = 100): number {
  const v = parseInt(url.searchParams.get(key) ?? "", 10);
  return isNaN(v) ? def : Math.min(max, Math.max(min, v));
}

async function readJson(req: Request): Promise<Record<string, unknown>> {
  try {
    const body = await req.json();
    return body && typeof body === "object" ? (body as Record<string, unknown>) : {};
  } catch {
    return {};
  }
}

Deno.serve(async (req: Request) => {
  const pipeline = await runPipeline(req, "content-engagement", ALLOWED_METHODS);
  if (!pipeline.ok) return pipeline.response;

  const { ctx } = pipeline;
  const { keyContext: context } = ctx;

  const url    = new URL(req.url);
  const segs   = segments(url);
  const ws     = context.workspaceId;
  const kt     = context.keyType;
  const method = req.method;

  let response: Response;

  try {
    const first = segs[0] ?? "";

    // ── /comments/:type/:id — moderation (secret key + manage:comments only) ──
    if (first === "comments" && segs[1] && segs[2]) {
      const typeName  = segs[1];
      const commentId = segs[2];
      const config    = resolveType(typeName);

      if (!config) {
        response = fail(ERRORS.NOT_FOUND.code, `Unknown content type: ${typeName}`, 404);
      } else if (kt !== "secret" || !hasPermission(context.permissions, "manage:comments")) {
        response = fail(
          ERRORS.FORBIDDEN.code,
          "Comment moderation requires a secret key with manage:comments permission.",
          403,
        );
      } else if (method === "PUT") {
        const body   = await readJson(req);
        const status = (body.status as string) || "";
        const result = await moderateComment(config, commentId, ws, status);
        response = result.ok
          ? ok({ id: commentId, status })
          : fail(
              ERRORS.BAD_REQUEST.code,
              result.error ?? "Unable to moderate comment.",
              result.error === "Comment not found." ? 404 : 400,
            );
      } else if (method === "DELETE") {
        const result = await deleteComment(config, commentId, ws);
        response = result.ok
          ? ok({ id: commentId, deleted: true })
          : fail(ERRORS.BAD_REQUEST.code, result.error ?? "Unable to delete comment.", 400);
      } else {
        response = fail(ERRORS.METHOD_NOT_ALLOWED.code, ERRORS.METHOD_NOT_ALLOWED.message, 405);
      }

    // ── /:type/:slug/* — content-type-scoped engagement ─────────────────────
    } else if (resolveType(first) && segs[1]) {
      const config   = resolveType(first)!;
      const slug     = segs[1];
      const sub      = segs[2] ?? "";

      // -- Likes --
      if (sub === "likes") {
        if (!hasPermission(context.permissions, "read:blogs")) {
          response = fail(ERRORS.FORBIDDEN.code, ERRORS.FORBIDDEN.message, 403);
        } else {
          const item = await resolveContent(config, ws, slug);
          if (!item) {
            response = fail(ERRORS.NOT_FOUND.code, ERRORS.NOT_FOUND.message, 404);
          } else if (method === "GET") {
            const visitor = await getVisitorId(req);
            response = ok(await getLikeStatus(config, item.id, visitor.visitorId));
          } else if (method === "POST" || method === "DELETE") {
            if (!hasPermission(context.permissions, "write:engagement")) {
              response = fail(ERRORS.FORBIDDEN.code, ERRORS.FORBIDDEN.message, 403);
            } else {
              const visitor = await getVisitorId(req);
              response = ok(
                method === "POST"
                  ? await likeContent(config, item.id, ws, visitor.visitorId)
                  : await unlikeContent(config, item.id, visitor.visitorId),
              );
            }
          } else {
            response = fail(ERRORS.METHOD_NOT_ALLOWED.code, ERRORS.METHOD_NOT_ALLOWED.message, 405);
          }
        }

      // -- Comments --
      } else if (sub === "comments") {
        if (!hasPermission(context.permissions, "read:blogs")) {
          response = fail(ERRORS.FORBIDDEN.code, ERRORS.FORBIDDEN.message, 403);
        } else {
          const item = await resolveContent(config, ws, slug);
          if (!item) {
            response = fail(ERRORS.NOT_FOUND.code, ERRORS.NOT_FOUND.message, 404);
          } else if (method === "GET") {
            const page  = intParam(url, "page", 1, 1, 10_000);
            const limit = intParam(url, "limit", 20, 1, 100);
            const { rows, total } = await listApprovedComments(config, item.id, page, limit);
            response = ok(rows, { page, limit, total });
          } else if (method === "POST") {
            if (!hasPermission(context.permissions, "write:engagement")) {
              response = fail(ERRORS.FORBIDDEN.code, ERRORS.FORBIDDEN.message, 403);
            } else {
              const settings = await getEngagementSettings(ws);
              if (!settings.features.comments) {
                response = fail(ERRORS.FORBIDDEN.code, "Comments are disabled for this workspace.", 403);
              } else {
                const body    = await readJson(req);
                const visitor = await getVisitorId(req);
                const result  = await submitComment(config, {
                  contentId:       item.id,
                  workspaceId:     ws,
                  parentId:        (body.parent_id as string) || null,
                  name:            (body.name as string) || "",
                  email:           (body.email as string) || "",
                  website:         (body.website as string) || null,
                  content:         (body.content as string) || "",
                  visitorId:       visitor.visitorId,
                  ip:              visitor.ip,
                  userAgent:       visitor.userAgent,
                  requireApproval: settings.commentSettings.requireApproval,
                  maxDepth:        settings.commentSettings.maxDepth,
                });
                response = result.ok
                  ? ok(result.comment, {}, 201)
                  : fail(ERRORS.UNPROCESSABLE_ENTITY.code, result.error!, 422);
              }
            }
          } else {
            response = fail(ERRORS.METHOD_NOT_ALLOWED.code, ERRORS.METHOD_NOT_ALLOWED.message, 405);
          }
        }

      // -- View tracking --
      } else if (sub === "view") {
        if (method !== "POST") {
          response = fail(ERRORS.METHOD_NOT_ALLOWED.code, ERRORS.METHOD_NOT_ALLOWED.message, 405);
        } else if (!hasPermission(context.permissions, "write:engagement")) {
          response = fail(ERRORS.FORBIDDEN.code, ERRORS.FORBIDDEN.message, 403);
        } else {
          const item = await resolveContent(config, ws, slug);
          if (!item) {
            response = fail(ERRORS.NOT_FOUND.code, ERRORS.NOT_FOUND.message, 404);
          } else {
            const settings = await getEngagementSettings(ws);
            if (!settings.features.viewTracking) {
              response = ok({ counted: false, totalViews: item.views });
            } else {
              const visitor = await getVisitorId(req);
              const body    = await readJson(req);
              response = ok(
                await recordView(config, {
                  contentId:   item.id,
                  workspaceId: ws,
                  visitorId:   visitor.visitorId,
                  referrer:    (body.referrer as string) || req.headers.get("referer"),
                  userAgent:   visitor.userAgent,
                }),
              );
            }
          }
        }

      // -- Shares --
      } else if (sub === "share") {
        const item = await resolveContent(config, ws, slug);
        if (!item) {
          response = fail(ERRORS.NOT_FOUND.code, ERRORS.NOT_FOUND.message, 404);
        } else if (method === "GET") {
          if (!hasPermission(context.permissions, "read:blogs")) {
            response = fail(ERRORS.FORBIDDEN.code, ERRORS.FORBIDDEN.message, 403);
          } else {
            const titleCol   = config.titleCol;
            const selectCols = `${titleCol}, excerpt, meta_description, cover_image, slug` +
              (config.contentTable === "products" ? ", description" : "");
            const { data: full } = await (getDb() as any)
              .from(config.contentTable)
              .select(selectCols)
              .eq("id", item.id)
              .maybeSingle();
            const supabaseUrl = Deno.env.get("SUPABASE_URL") ?? "";
            response = ok(
              buildShareMetadata(
                (full as Record<string, unknown>) ?? { slug },
                config,
                supabaseUrl,
                "Lunar CMS",
              ),
            );
          }
        } else if (method === "POST") {
          if (!hasPermission(context.permissions, "write:engagement")) {
            response = fail(ERRORS.FORBIDDEN.code, ERRORS.FORBIDDEN.message, 403);
          } else {
            const body    = await readJson(req);
            const visitor = await getVisitorId(req);
            response = ok(
              await recordShare(
                config,
                item.id,
                ws,
                (body.channel as string) || "other",
                visitor.visitorId,
              ),
            );
          }
        } else {
          response = fail(ERRORS.METHOD_NOT_ALLOWED.code, ERRORS.METHOD_NOT_ALLOWED.message, 405);
        }

      // -- Stats --
      } else if (sub === "stats") {
        if (!hasPermission(context.permissions, "read:blogs")) {
          response = fail(ERRORS.FORBIDDEN.code, ERRORS.FORBIDDEN.message, 403);
        } else {
          const item = await resolveContent(config, ws, slug);
          if (!item) {
            response = fail(ERRORS.NOT_FOUND.code, ERRORS.NOT_FOUND.message, 404);
          } else {
            const [stats, settings] = await Promise.all([
              getContentStats(config, item.id),
              getEngagementSettings(ws),
            ]);
            response = ok({ stats, features: settings.features, branding: settings.branding });
          }
        }

      // -- Related --
      } else if (sub === "related") {
        if (!hasPermission(context.permissions, "read:blogs")) {
          response = fail(ERRORS.FORBIDDEN.code, ERRORS.FORBIDDEN.message, 403);
        } else {
          const limit = intParam(url, "limit", 5, 1, 20);
          const item  = await resolveContent(config, ws, slug);
          if (!item) {
            response = fail(ERRORS.NOT_FOUND.code, ERRORS.NOT_FOUND.message, 404);
          } else {
            const related = await getRelatedContent(config, ws, item.id, item.category, limit);
            response = ok(related, { total: related.length });
          }
        }

      } else {
        response = fail(
          ERRORS.NOT_FOUND.code,
          `Endpoint not found. Available sub-resources: /likes /comments /view /share /stats /related`,
          404,
        );
      }

    } else {
      response = fail(
        ERRORS.NOT_FOUND.code,
        "Endpoint not found. Pattern: /{news|articles|products}/:slug/{likes|comments|view|share|stats|related} or /comments/{news|articles|products}/:id",
        404,
      );
    }
  } catch (_err) {
    response = fail(ERRORS.SERVER_ERROR.code, ERRORS.SERVER_ERROR.message, 500);
  }

  return finalize(response, ctx);
});
