/**
 * content-router — versioned REST API gateway for Lunar CMS content.
 *
 * Base URL (external):
 *   https://<project>.supabase.co/functions/v1/content-router
 *
 * ── Content endpoints ──────────────────────────────────────────────────────
 *   GET /blogs                      — paginated list of published blogs
 *   GET /blogs/featured             — featured published blogs
 *   GET /blogs/latest               — latest N published blogs
 *   GET /blogs/:slug                — single blog by slug
 *   GET /blogs/:slug/related        — related blogs (by category + tags)
 *   GET /pages                      — published pages
 *   GET /pages/:slug                — single page by slug
 *   GET /faqs                       — published FAQs (sorted by sort_order)
 *   GET /news                       — paginated list of published news
 *   GET /news/breaking              — breaking news items
 *   GET /news/latest                — latest N published news items
 *   GET /news/:slug                 — single news item by slug
 *   GET /articles                   — paginated list of articles
 *   GET /articles/featured          — featured articles
 *   GET /articles/latest            — latest N articles
 *   GET /articles/:slug             — single article by slug
 *   GET /products                   — paginated list of products
 *   GET /products/featured          — featured products
 *   GET /products/:slug             — single product by slug
 *   GET /collections                — all visible collections
 *   GET /collections/:slug          — entries for a specific collection
 *   GET /categories                 — distinct categories with post counts
 *   GET /tags                       — distinct tags with post counts
 *   GET /media                      — public media files
 *   GET /search?q=...               — unified search across all content types
 *
 * ── Blog engagement ─────────────────────────────────────────────────────────
 *   GET    /blogs/:slug/likes       — like count + visitor like status
 *   POST   /blogs/:slug/likes       — like a post (idempotent per visitor)
 *   DELETE /blogs/:slug/likes       — unlike a post
 *   GET    /blogs/:slug/comments    — approved comments (paginated)
 *   POST   /blogs/:slug/comments    — submit a comment
 *   POST   /blogs/:slug/view        — record a page view (30-min dedup)
 *   GET    /blogs/:slug/share       — share metadata (OG title/image/URLs)
 *   POST   /blogs/:slug/share       — record a share-button click
 *   GET    /blogs/:slug/stats       — aggregated stats + feature flags
 *   PUT    /comments/:id            — moderate a blog comment (sk_live_ + manage:comments)
 *   DELETE /comments/:id            — delete a blog comment  (sk_live_ + manage:comments)
 *
 * ── Content engagement (news | articles | products) ─────────────────────────
 *   GET    /:type/:slug/likes       — like count + visitor like status
 *   POST   /:type/:slug/likes       — like an item (idempotent per visitor)
 *   DELETE /:type/:slug/likes       — unlike an item
 *   GET    /:type/:slug/comments    — approved comments (paginated)
 *   POST   /:type/:slug/comments    — submit a comment
 *   POST   /:type/:slug/view        — record a page view (30-min dedup)
 *   GET    /:type/:slug/share       — share metadata
 *   POST   /:type/:slug/share       — record a share-button click
 *   GET    /:type/:slug/stats       — aggregated stats + feature flags
 *   GET    /:type/:slug/related     — related content by category
 *   PUT    /comments/:type/:id      — moderate a comment (sk_live_ + manage:comments)
 *   DELETE /comments/:type/:id      — delete a comment   (sk_live_ + manage:comments)
 *
 * Auth: Bearer API key (pk_live_* or sk_live_*)
 * Visitor identity: X-Visitor-Id header (falls back to IP+UA hash)
 *
 * Every request passes through the shared middleware pipeline:
 *   OPTIONS → method guard → auth → rate-limit → route → transform → respond
 */

import { runPipeline, finalize } from "../_shared/pipeline.ts";
import { hasPermission }         from "../_shared/permissions.ts";
import { ok, fail, buildPaginationLinks } from "../_shared/response.ts";
import { ERRORS }                from "../_shared/errors.ts";
import { getVisitorId }          from "../_shared/visitor.ts";

import { listBlogs, getBlogBySlug, getRelatedBlogs, getFeaturedBlogs, getLatestBlogs } from "./services/BlogService.ts";
import { getEngagementForSlug, getCommentsForSlug } from "./services/EngagementService.ts";
import { listPages, getPageBySlug } from "./services/PageService.ts";
import { listFaqs } from "./services/FaqService.ts";
import { listNews, getNewsBySlug, getBreakingNews, getLatestNews } from "./services/NewsService.ts";
import { listMedia } from "./services/MediaService.ts";
import { listCollections, getCollectionEntries } from "./services/CollectionService.ts";
import { listCategories } from "./services/CategoryService.ts";
import { listTags } from "./services/TagService.ts";
import { search } from "./services/SearchService.ts";
import { listProducts, getProductBySlug, getFeaturedProducts } from "./services/ProductService.ts";
import { listArticles, getArticleBySlug, getFeaturedArticles, getLatestArticles } from "./services/ArticleService.ts";

// ── Blog engagement services ───────────────────────────────────────────────
import { resolvePost } from "../blog-engagement/services/PostLookup.ts";
import { likePost, unlikePost, getLikeStatus as getBlogLikeStatus } from "../blog-engagement/services/LikeService.ts";
import {
  listApprovedComments as listBlogComments,
  submitComment as submitBlogComment,
  moderateComment as moderateBlogComment,
  deleteComment as deleteBlogComment,
} from "../blog-engagement/services/CommentService.ts";
import { recordView as recordBlogView } from "../blog-engagement/services/ViewService.ts";
import { recordShare as recordBlogShare, buildShareMetadata as buildBlogShareMeta } from "../blog-engagement/services/ShareService.ts";
import { getPostStats, getEngagementSettings } from "../blog-engagement/services/StatsService.ts";

// ── Content engagement services (news / articles / products) ──────────────
import { resolveType } from "../content-engagement/services/ContentType.ts";
import { resolveContent } from "../content-engagement/services/GenericLookup.ts";
import { likeContent, unlikeContent, getLikeStatus as getContentLikeStatus } from "../content-engagement/services/GenericLike.ts";
import {
  listApprovedComments as listContentComments,
  submitComment as submitContentComment,
  moderateComment as moderateContentComment,
  deleteComment as deleteContentComment,
} from "../content-engagement/services/GenericComment.ts";
import { recordView as recordContentView } from "../content-engagement/services/GenericView.ts";
import { recordShare as recordContentShare, buildShareMetadata as buildContentShareMeta } from "../content-engagement/services/GenericShare.ts";
import { getContentStats, getEngagementSettings as getContentEngagementSettings, getRelatedContent } from "../content-engagement/services/GenericStats.ts";
import { getDb as getContentDb } from "../content-engagement/db.ts";
import { getDb as getBlogDb } from "../blog-engagement/db.ts";

// ── Allowed HTTP methods ───────────────────────────────────────────────────
const ALLOWED_METHODS = ["GET", "POST", "PUT", "DELETE"] as const;

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

async function readJson(req: Request): Promise<Record<string, unknown>> {
  try {
    const body = await req.json();
    return body && typeof body === "object" ? (body as Record<string, unknown>) : {};
  } catch {
    return {};
  }
}

/** Add 5-minute public cache headers to a successful response. */
function cached(res: Response): Response {
  res.headers.set("Cache-Control", "public, max-age=300, stale-while-revalidate=60");
  return res;
}

// ── Main handler ───────────────────────────────────────────────────────────────

Deno.serve(async (req: Request) => {
  // ── Shared pipeline: OPTIONS / method guard / auth / rate-limit ─────────────
  const pipeline = await runPipeline(req, "content-router", ALLOWED_METHODS);
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
    const resource = segs[0] ?? "";

    // ── GET /blogs/* + blog engagement ────────────────────────────────────────
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

      } else if (segs[1] && segs[2] === "likes") {
        // GET|POST|DELETE /blogs/:slug/likes
        const post = await resolvePost(ws, segs[1], kt);
        if (!post) {
          response = fail(ERRORS.NOT_FOUND.code, ERRORS.NOT_FOUND.message, 404);
        } else if (method === "GET") {
          const visitor = await getVisitorId(req);
          response = cached(ok(await getBlogLikeStatus(post.id, visitor.visitorId)));
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

      } else if (segs[1] && segs[2] === "stats") {
        // GET /blogs/:slug/stats
        const post = await resolvePost(ws, segs[1], kt);
        if (!post) {
          response = fail(ERRORS.NOT_FOUND.code, ERRORS.NOT_FOUND.message, 404);
        } else {
          const [stats, settings] = await Promise.all([
            getPostStats(post.id),
            getEngagementSettings(ws),
          ]);
          response = cached(ok({ stats, features: settings.features, branding: settings.branding }));
        }

      } else if (segs[1] && segs[2] === "comments") {
        // GET|POST /blogs/:slug/comments
        const post = await resolvePost(ws, segs[1], kt);
        if (!post) {
          response = fail(ERRORS.NOT_FOUND.code, ERRORS.NOT_FOUND.message, 404);
        } else if (method === "GET") {
          const page  = intParam(url, "page", 1, 1, 10_000);
          const limit = intParam(url, "limit", 20, 1, 100);
          const { rows, total } = await listBlogComments(post.id, page, limit);
          response = cached(ok(rows, { page, limit, total }));
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
              const result  = await submitBlogComment({
                postId:          post.id,
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
                : fail(ERRORS.UNPROCESSABLE_ENTITY.code, result.error, 422);
            }
          }
        } else {
          response = fail(ERRORS.METHOD_NOT_ALLOWED.code, ERRORS.METHOD_NOT_ALLOWED.message, 405);
        }

      } else if (segs[1] && segs[2] === "view") {
        // POST /blogs/:slug/view
        if (method !== "POST") {
          response = fail(ERRORS.METHOD_NOT_ALLOWED.code, ERRORS.METHOD_NOT_ALLOWED.message, 405);
        } else if (!hasPermission(context.permissions, "write:engagement")) {
          response = fail(ERRORS.FORBIDDEN.code, ERRORS.FORBIDDEN.message, 403);
        } else {
          const post = await resolvePost(ws, segs[1], kt);
          if (!post) {
            response = fail(ERRORS.NOT_FOUND.code, ERRORS.NOT_FOUND.message, 404);
          } else {
            const settings = await getEngagementSettings(ws);
            if (!settings.features.viewTracking) {
              response = ok({ counted: false, totalViews: post.views });
            } else {
              const visitor = await getVisitorId(req);
              const body    = await readJson(req);
              response = ok(await recordBlogView({
                postId:      post.id,
                workspaceId: ws,
                visitorId:   visitor.visitorId,
                referrer:    (body.referrer as string) || req.headers.get("referer"),
                userAgent:   visitor.userAgent,
              }));
            }
          }
        }

      } else if (segs[1] && segs[2] === "share") {
        // GET|POST /blogs/:slug/share
        const post = await resolvePost(ws, segs[1], kt);
        if (!post) {
          response = fail(ERRORS.NOT_FOUND.code, ERRORS.NOT_FOUND.message, 404);
        } else if (method === "GET") {
          const { data: full } = await getBlogDb()
            .from("blog_posts")
            .select("title, excerpt, meta_description, cover_image, slug")
            .eq("id", post.id)
            .maybeSingle();
          const supabaseUrl = Deno.env.get("SUPABASE_URL") ?? "";
          response = cached(ok(buildBlogShareMeta((full as Record<string, unknown>) ?? { slug: segs[1] }, supabaseUrl, "Lunar CMS")));
        } else if (method === "POST") {
          if (!hasPermission(context.permissions, "write:engagement")) {
            response = fail(ERRORS.FORBIDDEN.code, ERRORS.FORBIDDEN.message, 403);
          } else {
            const body    = await readJson(req);
            const visitor = await getVisitorId(req);
            response = ok(await recordBlogShare(post.id, ws, (body.channel as string) || "other", visitor.visitorId));
          }
        } else {
          response = fail(ERRORS.METHOD_NOT_ALLOWED.code, ERRORS.METHOD_NOT_ALLOWED.message, 405);
        }

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

    // ── Blog comment moderation (/comments/:id) ────────────────────────────────
    } else if (resource === "comments" && segs[1] && !segs[2]) {
      const commentId = segs[1];
      if (kt !== "secret" || !hasPermission(context.permissions, "manage:comments")) {
        response = fail(ERRORS.FORBIDDEN.code, "Comment moderation requires a secret key with manage:comments permission.", 403);
      } else if (method === "PUT") {
        const body   = await readJson(req);
        const result = await moderateBlogComment(commentId, ws, (body.status as string) || "");
        response = result.ok
          ? ok({ id: commentId, status: body.status })
          : fail(ERRORS.BAD_REQUEST.code, result.error ?? "Unable to moderate comment.", result.error === "Comment not found." ? 404 : 400);
      } else if (method === "DELETE") {
        const result = await deleteBlogComment(commentId, ws);
        response = result.ok
          ? ok({ id: commentId, deleted: true })
          : fail(ERRORS.BAD_REQUEST.code, result.error ?? "Unable to delete comment.", 400);
      } else {
        response = fail(ERRORS.METHOD_NOT_ALLOWED.code, ERRORS.METHOD_NOT_ALLOWED.message, 405);
      }

    // ── Content comment moderation (/comments/:type/:id) ─────────────────────
    } else if (resource === "comments" && segs[1] && segs[2]) {
      const typeName  = segs[1];
      const commentId = segs[2];
      const config    = resolveType(typeName);
      if (!config) {
        response = fail(ERRORS.NOT_FOUND.code, `Unknown content type: ${typeName}`, 404);
      } else if (kt !== "secret" || !hasPermission(context.permissions, "manage:comments")) {
        response = fail(ERRORS.FORBIDDEN.code, "Comment moderation requires a secret key with manage:comments permission.", 403);
      } else if (method === "PUT") {
        const body   = await readJson(req);
        const result = await moderateContentComment(config, commentId, ws, (body.status as string) || "");
        response = result.ok
          ? ok({ id: commentId, status: body.status })
          : fail(ERRORS.BAD_REQUEST.code, result.error ?? "Unable to moderate comment.", result.error === "Comment not found." ? 404 : 400);
      } else if (method === "DELETE") {
        const result = await deleteContentComment(config, commentId, ws);
        response = result.ok
          ? ok({ id: commentId, deleted: true })
          : fail(ERRORS.BAD_REQUEST.code, result.error ?? "Unable to delete comment.", 400);
      } else {
        response = fail(ERRORS.METHOD_NOT_ALLOWED.code, ERRORS.METHOD_NOT_ALLOWED.message, 405);
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

    // ── GET /faqs ──────────────────────────────────────────────────────────────
    } else if (resource === "faqs") {
      if (!hasPermission(context.permissions, "read:faqs")) {
        response = fail(ERRORS.FORBIDDEN.code, ERRORS.FORBIDDEN.message, 403);
      } else {
        const page  = intParam(url, "page", 1, 1, 10_000);
        const limit = intParam(url, "limit", 50, 1, 100);
        const { rows, total } = await listFaqs(ws, {
          page, limit,
          category: strParam(url, "category"),
          search:   strParam(url, "search"),
          featured: boolParam(url, "featured"),
        });
        const totalPages = Math.ceil(total / limit);
        const links = buildPaginationLinks(req.url, page, totalPages);
        response = cached(ok(rows, { page, limit, total, totalPages }, 200, links));
      }

    // ── GET /news/* + news engagement ─────────────────────────────────────────
    } else if (resource === "news") {
      if (!hasPermission(context.permissions, "read:news")) {
        response = fail(ERRORS.FORBIDDEN.code, ERRORS.FORBIDDEN.message, 403);

      } else if (segs[1] === "breaking") {
        const limit = intParam(url, "limit", 10, 1, 50);
        const data  = await getBreakingNews(ws, limit);
        response = cached(ok(data, { total: data.length }));

      } else if (segs[1] === "latest") {
        const limit = intParam(url, "limit", 10, 1, 50);
        const data  = await getLatestNews(ws, limit);
        response = cached(ok(data, { total: data.length }));

      } else if (segs[1] && segs[2]) {
        // Engagement sub-routes for news
        response = await handleContentEngagement(req, method, url, ws, kt, "news", segs[1], segs[2], context.permissions);

      } else if (segs[1]) {
        // GET /news/:slug
        const item = await getNewsBySlug(ws, segs[1]);
        if (!item) {
          response = fail(ERRORS.NOT_FOUND.code, ERRORS.NOT_FOUND.message, 404);
        } else {
          response = cached(ok(item));
        }

      } else {
        // GET /news
        const page  = intParam(url, "page", 1, 1, 10_000);
        const limit = intParam(url, "limit", 20, 1, 100);
        const sort  = sortParam(url, ["created_at", "updated_at", "published_at", "title", "views"], "published_at");
        const { rows, total } = await listNews(ws, {
          page, limit, sort,
          order:    orderParam(url),
          search:   strParam(url, "search"),
          category: strParam(url, "category"),
          breaking: boolParam(url, "breaking"),
          featured: boolParam(url, "featured"),
          from:     dateParam(url, "from"),
          to:       dateParam(url, "to"),
        });
        const totalPages = Math.ceil(total / limit);
        const links = buildPaginationLinks(req.url, page, totalPages);
        response = cached(ok(rows, { page, limit, total, totalPages }, 200, links));
      }

    // ── GET /collections/* ─────────────────────────────────────────────────────
    } else if (resource === "collections") {
      if (!hasPermission(context.permissions, "read:collections")) {
        response = fail(ERRORS.FORBIDDEN.code, ERRORS.FORBIDDEN.message, 403);

      } else if (segs[1]) {
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

    // ── /products/* + product engagement ──────────────────────────────────────
    } else if (resource === "products") {
      if (!hasPermission(context.permissions, "read:products")) {
        response = fail(ERRORS.FORBIDDEN.code, ERRORS.FORBIDDEN.message, 403);

      } else if (segs[1] === "featured") {
        const limit = intParam(url, "limit", 10, 1, 50);
        const data  = await getFeaturedProducts(ws, limit);
        response = cached(ok(data, { total: data.length }));

      } else if (segs[1] && segs[2]) {
        response = await handleContentEngagement(req, method, url, ws, kt, "products", segs[1], segs[2], context.permissions);

      } else if (segs[1]) {
        const product = await getProductBySlug(ws, segs[1], kt);
        if (!product) {
          response = fail(ERRORS.NOT_FOUND.code, ERRORS.NOT_FOUND.message, 404);
        } else {
          response = cached(ok(product));
        }

      } else {
        const page  = intParam(url, "page", 1, 1, 10_000);
        const limit = intParam(url, "limit", 20, 1, 100);
        const sort  = sortParam(url, ["name", "price", "created_at", "updated_at", "views", "sort_order"], "sort_order");
        const { rows, total } = await listProducts(ws, {
          page, limit, sort,
          order:    orderParam(url),
          search:   strParam(url, "search"),
          category: strParam(url, "category"),
          brand:    strParam(url, "brand"),
          featured: boolParam(url, "featured"),
          status:   strParam(url, "status"),
          keyType:  kt,
        });
        const totalPages = Math.ceil(total / limit);
        const links = buildPaginationLinks(req.url, page, totalPages);
        response = cached(ok(rows, { page, limit, total, totalPages }, 200, links));
      }

    // ── /articles/* + article engagement ──────────────────────────────────────
    } else if (resource === "articles") {
      if (!hasPermission(context.permissions, "read:articles")) {
        response = fail(ERRORS.FORBIDDEN.code, ERRORS.FORBIDDEN.message, 403);

      } else if (segs[1] === "featured") {
        const limit = intParam(url, "limit", 10, 1, 50);
        const data  = await getFeaturedArticles(ws, limit);
        response = cached(ok(data, { total: data.length }));

      } else if (segs[1] === "latest") {
        const limit = intParam(url, "limit", 10, 1, 50);
        const data  = await getLatestArticles(ws, limit);
        response = cached(ok(data, { total: data.length }));

      } else if (segs[1] && segs[2]) {
        response = await handleContentEngagement(req, method, url, ws, kt, "articles", segs[1], segs[2], context.permissions);

      } else if (segs[1]) {
        const article = await getArticleBySlug(ws, segs[1], kt);
        if (!article) {
          response = fail(ERRORS.NOT_FOUND.code, ERRORS.NOT_FOUND.message, 404);
        } else {
          response = cached(ok(article));
        }

      } else {
        const page  = intParam(url, "page", 1, 1, 10_000);
        const limit = intParam(url, "limit", 20, 1, 100);
        const sort  = sortParam(url, ["title", "published_at", "created_at", "updated_at", "views", "reading_time"], "published_at");
        const { rows, total } = await listArticles(ws, {
          page, limit, sort,
          order:        orderParam(url),
          search:       strParam(url, "search"),
          category:     strParam(url, "category"),
          tag:          strParam(url, "tag"),
          author:       strParam(url, "author"),
          featured:     boolParam(url, "featured"),
          article_type: strParam(url, "article_type"),
          from:         dateParam(url, "from"),
          to:           dateParam(url, "to"),
          status:       strParam(url, "status"),
          keyType:      kt,
        });
        const totalPages = Math.ceil(total / limit);
        const links = buildPaginationLinks(req.url, page, totalPages);
        response = cached(ok(rows, { page, limit, total, totalPages }, 200, links));
      }

    // ── GET /search ────────────────────────────────────────────────────────────
    } else if (resource === "search") {
      const q = strParam(url, "q") ?? "";
      if (!q) {
        response = fail(ERRORS.BAD_REQUEST.code, "The `q` parameter is required for search.", 400);
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
        "Endpoint not found. See documentation for available endpoints.",
        404,
      );
    }
  } catch (_err) {
    response = fail(ERRORS.SERVER_ERROR.code, ERRORS.SERVER_ERROR.message, 500);
  }

  return finalize(response, ctx);
});

// ── Content engagement handler (news / articles / products) ─────────────────
//
// Shared handler for /:type/:slug/:sub engagement routes. Called from the
// news, articles, and products branches above.

async function handleContentEngagement(
  req: Request,
  method: string,
  url: URL,
  ws: string,
  kt: string,
  typeName: string,
  slug: string,
  sub: string,
  permissions: readonly string[],
): Promise<Response> {
  const config = resolveType(typeName);
  if (!config) {
    return fail(ERRORS.NOT_FOUND.code, `Unknown content type: ${typeName}`, 404);
  }

  // -- Likes --
  if (sub === "likes") {
    if (!hasPermission(permissions, "read:blogs")) {
      return fail(ERRORS.FORBIDDEN.code, ERRORS.FORBIDDEN.message, 403);
    }
    const item = await resolveContent(config, ws, slug);
    if (!item) return fail(ERRORS.NOT_FOUND.code, ERRORS.NOT_FOUND.message, 404);

    if (method === "GET") {
      const visitor = await getVisitorId(req);
      return cached(ok(await getContentLikeStatus(config, item.id, visitor.visitorId)));
    } else if (method === "POST" || method === "DELETE") {
      if (!hasPermission(permissions, "write:engagement")) {
        return fail(ERRORS.FORBIDDEN.code, ERRORS.FORBIDDEN.message, 403);
      }
      const visitor = await getVisitorId(req);
      return ok(
        method === "POST"
          ? await likeContent(config, item.id, ws, visitor.visitorId)
          : await unlikeContent(config, item.id, visitor.visitorId),
      );
    }
    return fail(ERRORS.METHOD_NOT_ALLOWED.code, ERRORS.METHOD_NOT_ALLOWED.message, 405);
  }

  // -- Comments --
  if (sub === "comments") {
    if (!hasPermission(permissions, "read:blogs")) {
      return fail(ERRORS.FORBIDDEN.code, ERRORS.FORBIDDEN.message, 403);
    }
    const item = await resolveContent(config, ws, slug);
    if (!item) return fail(ERRORS.NOT_FOUND.code, ERRORS.NOT_FOUND.message, 404);

    if (method === "GET") {
      const page  = intParam(url, "page", 1, 1, 10_000);
      const limit = intParam(url, "limit", 20, 1, 100);
      const { rows, total } = await listContentComments(config, item.id, page, limit);
      return cached(ok(rows, { page, limit, total }));
    } else if (method === "POST") {
      if (!hasPermission(permissions, "write:engagement")) {
        return fail(ERRORS.FORBIDDEN.code, ERRORS.FORBIDDEN.message, 403);
      }
      const settings = await getContentEngagementSettings(ws);
      if (!settings.features.comments) {
        return fail(ERRORS.FORBIDDEN.code, "Comments are disabled for this workspace.", 403);
      }
      const body    = await readJson(req);
      const visitor = await getVisitorId(req);
      const result  = await submitContentComment(config, {
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
      return result.ok
        ? ok(result.comment, {}, 201)
        : fail(ERRORS.UNPROCESSABLE_ENTITY.code, result.error!, 422);
    }
    return fail(ERRORS.METHOD_NOT_ALLOWED.code, ERRORS.METHOD_NOT_ALLOWED.message, 405);
  }

  // -- View tracking --
  if (sub === "view") {
    if (method !== "POST") {
      return fail(ERRORS.METHOD_NOT_ALLOWED.code, ERRORS.METHOD_NOT_ALLOWED.message, 405);
    }
    if (!hasPermission(permissions, "write:engagement")) {
      return fail(ERRORS.FORBIDDEN.code, ERRORS.FORBIDDEN.message, 403);
    }
    const item = await resolveContent(config, ws, slug);
    if (!item) return fail(ERRORS.NOT_FOUND.code, ERRORS.NOT_FOUND.message, 404);

    const settings = await getContentEngagementSettings(ws);
    if (!settings.features.viewTracking) {
      return ok({ counted: false, totalViews: (item as Record<string, unknown>).views ?? 0 });
    }
    const visitor = await getVisitorId(req);
    const body    = await readJson(req);
    return ok(await recordContentView(config, {
      contentId:   item.id,
      workspaceId: ws,
      visitorId:   visitor.visitorId,
      referrer:    (body.referrer as string) || req.headers.get("referer"),
      userAgent:   visitor.userAgent,
    }));
  }

  // -- Shares --
  if (sub === "share") {
    const item = await resolveContent(config, ws, slug);
    if (!item) return fail(ERRORS.NOT_FOUND.code, ERRORS.NOT_FOUND.message, 404);

    if (method === "GET") {
      if (!hasPermission(permissions, "read:blogs")) {
        return fail(ERRORS.FORBIDDEN.code, ERRORS.FORBIDDEN.message, 403);
      }
      const titleCol   = config.titleCol;
      const selectCols = `${titleCol}, excerpt, meta_description, cover_image, slug` +
        (config.contentTable === "products" ? ", description" : "");
      const { data: full } = await (getContentDb() as any)
        .from(config.contentTable)
        .select(selectCols)
        .eq("id", item.id)
        .maybeSingle();
      const supabaseUrl = Deno.env.get("SUPABASE_URL") ?? "";
      return cached(ok(buildContentShareMeta(
        (full as Record<string, unknown>) ?? { slug },
        config,
        supabaseUrl,
        "Lunar CMS",
      )));
    } else if (method === "POST") {
      if (!hasPermission(permissions, "write:engagement")) {
        return fail(ERRORS.FORBIDDEN.code, ERRORS.FORBIDDEN.message, 403);
      }
      const body    = await readJson(req);
      const visitor = await getVisitorId(req);
      return ok(await recordContentShare(config, item.id, ws, (body.channel as string) || "other", visitor.visitorId));
    }
    return fail(ERRORS.METHOD_NOT_ALLOWED.code, ERRORS.METHOD_NOT_ALLOWED.message, 405);
  }

  // -- Stats --
  if (sub === "stats") {
    if (!hasPermission(permissions, "read:blogs")) {
      return fail(ERRORS.FORBIDDEN.code, ERRORS.FORBIDDEN.message, 403);
    }
    const item = await resolveContent(config, ws, slug);
    if (!item) return fail(ERRORS.NOT_FOUND.code, ERRORS.NOT_FOUND.message, 404);

    const [stats, settings] = await Promise.all([
      getContentStats(config, item.id),
      getContentEngagementSettings(ws),
    ]);
    return cached(ok({ stats, features: settings.features, branding: settings.branding }));
  }

  // -- Related --
  if (sub === "related") {
    if (!hasPermission(permissions, "read:blogs")) {
      return fail(ERRORS.FORBIDDEN.code, ERRORS.FORBIDDEN.message, 403);
    }
    const limit = intParam(url, "limit", 5, 1, 20);
    const item  = await resolveContent(config, ws, slug);
    if (!item) return fail(ERRORS.NOT_FOUND.code, ERRORS.NOT_FOUND.message, 404);

    const related = await getRelatedContent(config, ws, item.id, (item as Record<string, unknown>).category as string, limit);
    return cached(ok(related, { total: related.length }));
  }

  return fail(
    ERRORS.NOT_FOUND.code,
    `Endpoint not found. Available: /${typeName}/:slug/{likes|comments|view|share|stats|related}`,
    404,
  );
}
