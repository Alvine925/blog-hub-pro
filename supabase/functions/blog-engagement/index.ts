/**
 * blog-engagement — Likes, comments, view tracking, shares, related posts
 * and per-post stats for the Lunar CMS public content API.
 *
 * Base URL (external):
 *   https://<project>.supabase.co/functions/v1/blog-engagement
 *
 * Endpoints:
 *   GET    /blogs/:slug/likes           — current like count + whether this visitor liked it
 *   POST   /blogs/:slug/likes           — like a post (idempotent per visitor)
 *   DELETE /blogs/:slug/likes           — unlike a post
 *   GET    /blogs/:slug/comments        — approved comments (threaded)
 *   POST   /blogs/:slug/comments        — submit a comment (pending moderation by default)
 *   PUT    /comments/:id                — moderate a comment (secret key + manage:comments)
 *   DELETE /comments/:id                — permanently delete a comment (secret key + manage:comments)
 *   POST   /blogs/:slug/view            — record a page view (deduped per visitor/30min)
 *   POST   /blogs/:slug/share           — record a share-button click
 *   GET    /blogs/:slug/share           — share metadata (title/description/image/url)
 *   GET    /blogs/:slug/stats           — aggregated stats + feature flags + branding
 *
 * Auth: Bearer API key (pk_live_* for public read/write, sk_live_* required
 * for comment moderation). Visitor identity: `X-Visitor-Id` header (falls
 * back to an IP+UA hash when absent).
 *
 * Every request passes through the shared middleware pipeline:
 *   OPTIONS → method guard → auth → rate-limit → route → respond
 */

import { runPipeline, finalize } from "../_shared/pipeline.ts";
import { hasPermission } from "../_shared/permissions.ts";
import { ok, fail } from "../_shared/response.ts";
import { ERRORS } from "../_shared/errors.ts";
import { getVisitorId } from "../_shared/visitor.ts";

import { resolvePost } from "./services/PostLookup.ts";
import { likePost, unlikePost, getLikeStatus } from "./services/LikeService.ts";
import { listApprovedComments, submitComment, moderateComment, deleteComment } from "./services/CommentService.ts";
import { recordView } from "./services/ViewService.ts";
import { recordShare, buildShareMetadata } from "./services/ShareService.ts";
import { getPostStats, getEngagementSettings } from "./services/StatsService.ts";
import { getRelatedBlogs } from "../content-router/services/BlogService.ts";
import { getDb } from "./db.ts";

const ALLOWED_METHODS = ["GET", "POST", "PUT", "DELETE"] as const;

function segments(url: URL): string[] {
  const parts = url.pathname.split("/").filter(Boolean);
  const idx = parts.findIndex((p) => p === "blog-engagement");
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
  const pipeline = await runPipeline(req, "blog-engagement", ALLOWED_METHODS);
  if (!pipeline.ok) return pipeline.response;

  const { ctx } = pipeline;
  const { keyContext: context } = ctx;

  const url = new URL(req.url);
  const segs = segments(url);
  const ws = context.workspaceId;
  const kt = context.keyType;
  const method = req.method;

  let response: Response;

  try {
    const resource = segs[0] ?? "";

    // ── /blogs/:slug/* ─────────────────────────────────────────────────────────
    if (resource === "blogs" && segs[1]) {
      const slug = segs[1];
      const sub = segs[2] ?? "";

      // -- Likes --
      if (sub === "likes") {
        if (!hasPermission(context.permissions, "read:blogs")) {
          response = fail(ERRORS.FORBIDDEN.code, ERRORS.FORBIDDEN.message, 403);
        } else {
          const post = await resolvePost(ws, slug, kt);
          if (!post) {
            response = fail(ERRORS.NOT_FOUND.code, ERRORS.NOT_FOUND.message, 404);
          } else if (method === "GET") {
            const visitor = await getVisitorId(req);
            response = ok(await getLikeStatus(post.id, visitor.visitorId));
          } else if (method === "POST" || method === "DELETE") {
            if (!hasPermission(context.permissions, "write:engagement")) {
              response = fail(ERRORS.FORBIDDEN.code, ERRORS.FORBIDDEN.message, 403);
            } else {
              const visitor = await getVisitorId(req);
              response = ok(
                method === "POST"
                  ? await likePost(post.id, ws, visitor.visitorId)
                  : await unlikePost(post.id, visitor.visitorId),
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
          const post = await resolvePost(ws, slug, kt);
          if (!post) {
            response = fail(ERRORS.NOT_FOUND.code, ERRORS.NOT_FOUND.message, 404);
          } else if (method === "GET") {
            const page = intParam(url, "page", 1, 1, 10_000);
            const limit = intParam(url, "limit", 20, 1, 100);
            const { rows, total } = await listApprovedComments(post.id, page, limit);
            response = ok(rows, { page, limit, total });
          } else if (method === "POST") {
            if (!hasPermission(context.permissions, "write:engagement")) {
              response = fail(ERRORS.FORBIDDEN.code, ERRORS.FORBIDDEN.message, 403);
            } else {
              const settings = await getEngagementSettings(ws);
              if (!settings.features.comments) {
                response = fail(ERRORS.FORBIDDEN.code, "Comments are disabled for this workspace.", 403);
              } else {
                const body = await readJson(req);
                const visitor = await getVisitorId(req);
                const result = await submitComment({
                  postId: post.id,
                  workspaceId: ws,
                  parentId: (body.parent_id as string) || null,
                  name: (body.name as string) || "",
                  email: (body.email as string) || "",
                  website: (body.website as string) || null,
                  content: (body.content as string) || "",
                  visitorId: visitor.visitorId,
                  ip: visitor.ip,
                  userAgent: visitor.userAgent,
                  requireApproval: settings.commentSettings.requireApproval,
                  maxDepth: settings.commentSettings.maxDepth,
                });
                response = result.ok
                  ? ok(result.comment, {}, 201)
                  : fail(ERRORS.UNPROCESSABLE_ENTITY.code, result.error, 422);
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
          const post = await resolvePost(ws, slug, kt);
          if (!post) {
            response = fail(ERRORS.NOT_FOUND.code, ERRORS.NOT_FOUND.message, 404);
          } else {
            const settings = await getEngagementSettings(ws);
            if (!settings.features.viewTracking) {
              response = ok({ counted: false, totalViews: post.views });
            } else {
              const visitor = await getVisitorId(req);
              const body = await readJson(req);
              response = ok(
                await recordView({
                  postId: post.id,
                  workspaceId: ws,
                  visitorId: visitor.visitorId,
                  referrer: (body.referrer as string) || req.headers.get("referer"),
                  userAgent: visitor.userAgent,
                }),
              );
            }
          }
        }

      // -- Shares --
      } else if (sub === "share") {
        const post = await resolvePost(ws, slug, kt);
        if (!post) {
          response = fail(ERRORS.NOT_FOUND.code, ERRORS.NOT_FOUND.message, 404);
        } else if (method === "GET") {
          if (!hasPermission(context.permissions, "read:blogs")) {
            response = fail(ERRORS.FORBIDDEN.code, ERRORS.FORBIDDEN.message, 403);
          } else {
            const { data: full } = await getDb()
              .from("blog_posts")
              .select("title, excerpt, meta_description, cover_image, slug")
              .eq("id", post.id)
              .maybeSingle();
            const supabaseUrl = Deno.env.get("SUPABASE_URL") ?? "";
            response = ok(buildShareMetadata((full as Record<string, unknown>) ?? { slug }, supabaseUrl, "Lunar CMS"));
          }
        } else if (method === "POST") {
          if (!hasPermission(context.permissions, "write:engagement")) {
            response = fail(ERRORS.FORBIDDEN.code, ERRORS.FORBIDDEN.message, 403);
          } else {
            const body = await readJson(req);
            const visitor = await getVisitorId(req);
            response = ok(await recordShare(post.id, ws, (body.channel as string) || "other", visitor.visitorId));
          }
        } else {
          response = fail(ERRORS.METHOD_NOT_ALLOWED.code, ERRORS.METHOD_NOT_ALLOWED.message, 405);
        }

      // -- Stats (aggregated: views/likes/comments/shares + feature flags + branding) --
      } else if (sub === "stats") {
        if (!hasPermission(context.permissions, "read:blogs")) {
          response = fail(ERRORS.FORBIDDEN.code, ERRORS.FORBIDDEN.message, 403);
        } else {
          const post = await resolvePost(ws, slug, kt);
          if (!post) {
            response = fail(ERRORS.NOT_FOUND.code, ERRORS.NOT_FOUND.message, 404);
          } else {
            const [stats, settings] = await Promise.all([
              getPostStats(post.id),
              getEngagementSettings(ws),
            ]);
            response = ok({
              stats,
              features: settings.features,
              branding: settings.branding,
            });
          }
        }

      // -- Related (mirrors content-router for parity when using this function alone) --
      } else if (sub === "related") {
        if (!hasPermission(context.permissions, "read:blogs")) {
          response = fail(ERRORS.FORBIDDEN.code, ERRORS.FORBIDDEN.message, 403);
        } else {
          const limit = intParam(url, "limit", 5, 1, 20);
          const result = await getRelatedBlogs(ws, slug, limit);
          response = ok(result, { total: result.length });
        }

      } else {
        response = fail(
          ERRORS.NOT_FOUND.code,
          "Endpoint not found. Available: /blogs/:slug/likes, /comments, /view, /share, /stats, /related",
          404,
        );
      }

    // ── /comments/:id — moderation (secret key + manage:comments only) ─────────
    } else if (resource === "comments" && segs[1]) {
      const commentId = segs[1];

      if (kt !== "secret" || !hasPermission(context.permissions, "manage:comments")) {
        response = fail(ERRORS.FORBIDDEN.code, "Comment moderation requires a secret key with manage:comments permission.", 403);
      } else if (method === "PUT") {
        const body = await readJson(req);
        const result = await moderateComment(commentId, ws, (body.status as string) || "");
        response = result.ok ? ok({ id: commentId, status: (body.status as string) }) : fail(ERRORS.BAD_REQUEST.code, result.error ?? "Unable to moderate comment.", result.error === "Comment not found." ? 404 : 400);
      } else if (method === "DELETE") {
        const result = await deleteComment(commentId, ws);
        response = result.ok ? ok({ id: commentId, deleted: true }) : fail(ERRORS.BAD_REQUEST.code, result.error ?? "Unable to delete comment.", 400);
      } else {
        response = fail(ERRORS.METHOD_NOT_ALLOWED.code, ERRORS.METHOD_NOT_ALLOWED.message, 405);
      }

    } else {
      response = fail(
        ERRORS.NOT_FOUND.code,
        "Endpoint not found. Available: /blogs/:slug/likes, /blogs/:slug/comments, /comments/:id, /blogs/:slug/view, /blogs/:slug/share, /blogs/:slug/stats, /blogs/:slug/related",
        404,
      );
    }
  } catch (_err) {
    response = fail(ERRORS.SERVER_ERROR.code, ERRORS.SERVER_ERROR.message, 500);
  }

  return finalize(response, ctx);
});
