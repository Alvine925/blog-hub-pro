/**
 * Node.js-only module: REST API handler used as a Vite dev-server middleware.
 *
 * Every request follows the same lifecycle as the Supabase edge functions:
 *   OPTIONS preflight → method guard → auth (API key) → workspace resolution
 *   → permission check → request validation → DB query (service role key)
 *   → response transformation → standardized JSON response
 *
 * The SUPABASE_SERVICE_ROLE_KEY is used for all server-side DB queries.
 * The raw API key is never stored — only a SHA-256 hash is compared.
 */
import type { IncomingMessage, ServerResponse } from "node:http";
import { createClient } from "@supabase/supabase-js";
import { createHash } from "node:crypto";
import { buildSocialMetadata, SOCIAL_DB_COLS } from "./SocialMetadata.js";

// ── Constants ─────────────────────────────────────────────────────────────────

const CORS_HEADERS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, POST, PUT, DELETE, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, Authorization, X-Visitor-Id",
  "Content-Type": "application/json",
};

const VALID_PREFIXES = ["pk_live_", "sk_live_"];

// ── Helpers ───────────────────────────────────────────────────────────────────

function sha256hex(str: string): string {
  return createHash("sha256").update(str).digest("hex");
}

function isValidTokenFormat(token: string): boolean {
  if (!token || typeof token !== "string") return false;
  const hasPrefix = VALID_PREFIXES.some((p) => token.startsWith(p));
  if (!hasPrefix) return false;
  const payload = token.slice(token.indexOf("_", 3) + 1);
  return payload.length >= 16;
}

function extractBearerToken(authHeader: string | undefined): string | null {
  if (!authHeader) return null;
  const parts = authHeader.trim().split(/\s+/);
  if (parts.length !== 2 || parts[0]?.toLowerCase() !== "bearer") return null;
  const token = parts[1] ?? "";
  return isValidTokenFormat(token) ? token : null;
}

function send(res: ServerResponse, status: number, body: unknown) {
  const json = JSON.stringify(body);
  res.writeHead(status, {
    ...CORS_HEADERS,
    "Content-Length": Buffer.byteLength(json),
  });
  res.end(json);
}

function sendOk(
  res: ServerResponse,
  data: unknown,
  meta: Record<string, unknown> = {},
  links: Record<string, unknown> = {},
) {
  send(res, 200, { success: true, data, meta, links });
}

function sendCreated(res: ServerResponse, data: unknown) {
  const json = JSON.stringify({ success: true, data });
  res.writeHead(201, { ...CORS_HEADERS, "Content-Length": Buffer.byteLength(json) });
  res.end(json);
}

function sendFail(
  res: ServerResponse,
  status: number,
  code: string,
  message: string,
) {
  send(res, status, { success: false, error: { code, message } });
}

function getServiceClient() {
  const url = process.env["SUPABASE_URL"];
  const key = process.env["SUPABASE_SERVICE_ROLE_KEY"];
  if (!url || !key) {
    throw new Error(
      "Missing SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY env vars",
    );
  }
  return createClient(url, key, {
    auth: { storage: undefined, persistSession: false, autoRefreshToken: false },
  });
}

async function readBody(req: IncomingMessage): Promise<Record<string, unknown>> {
  return new Promise((resolve) => {
    let raw = "";
    req.on("data", (chunk) => { raw += chunk; });
    req.on("end", () => {
      try { resolve(JSON.parse(raw)); }
      catch { resolve({}); }
    });
    req.on("error", () => resolve({}));
  });
}

function getVisitorId(req: IncomingMessage): string {
  const header = req.headers["x-visitor-id"];
  if (typeof header === "string" && header.length > 0) return header;
  const ip = (req.headers["x-forwarded-for"] as string)?.split(",")[0]?.trim()
    ?? req.socket?.remoteAddress
    ?? "unknown";
  const ua = (req.headers["user-agent"] as string) ?? "";
  return sha256hex(`${ip}|${ua}`).slice(0, 32);
}

// ── Fields exposed on list vs detail ─────────────────────────────────────────

const SOCIAL_COLS =
  "social_title,social_description,social_image,social_image_alt,social_hashtags,open_graph_type,twitter_card";

const LIST_COLS =
  "title,slug,excerpt,cover_image,category,tags,author_name,featured,published_at,reading_time,views,updated_at," +
  "seo_title,meta_description," + SOCIAL_COLS;

const DETAIL_COLS =
  "title,slug,excerpt,content,cover_image,category,tags,author_name,featured," +
  "published_at,reading_time,views,word_count,seo_title,meta_description,updated_at," + SOCIAL_COLS;

// Internal fields that must never be returned to the client
const STRIP_FIELDS = new Set([
  "id",
  "workspace_id",
  "user_id",
  "owner_id",
  "storage_path",
  "deleted_at",
  "internal_notes",
  "internal_status",
  "private_metadata",
  "draft_content",
  "created_by",
  "updated_by",
  // Social DB columns — exposed via the derived `social` object instead
  ...SOCIAL_DB_COLS,
]);

function sanitize(row: Record<string, unknown>): Record<string, unknown> {
  return Object.fromEntries(
    Object.entries(row).filter(([k]) => !STRIP_FIELDS.has(k)),
  );
}

// ── API key validation ────────────────────────────────────────────────────────

interface ApiKeyContext {
  keyId: string;
  workspaceId: string;
  keyType: "publishable" | "secret";
  permissions: string[];
}

async function validateApiKey(
  authHeader: string | undefined,
): Promise<{ ok: true; context: ApiKeyContext } | { ok: false; status: number; code: string; message: string }> {
  const token = extractBearerToken(authHeader);

  if (!token) {
    return {
      ok: false,
      status: 401,
      code: "MISSING_AUTHORIZATION",
      message:
        "Authorization header is required. Use: Authorization: Bearer <your-api-key>",
    };
  }

  const hash = sha256hex(token);
  const db = getServiceClient();

  const { data: key, error } = await db
    .from("api_keys")
    .select("id, workspace_id, permissions, status, expires_at, key_type")
    .eq("key_hash", hash)
    .single();

  if (error || !key) {
    return { ok: false, status: 401, code: "INVALID_API_KEY", message: "The supplied API key is invalid or has been revoked." };
  }

  if (key.status !== "active") {
    return { ok: false, status: 401, code: "INVALID_API_KEY", message: "The supplied API key is invalid or has been revoked." };
  }

  if (key.expires_at && new Date(key.expires_at) <= new Date()) {
    return { ok: false, status: 401, code: "INVALID_API_KEY", message: "The supplied API key is invalid or has been revoked." };
  }

  if (!key.workspace_id) {
    return { ok: false, status: 401, code: "INVALID_API_KEY", message: "The supplied API key is invalid or has been revoked." };
  }

  // Fire-and-forget: update last_used_at
  db.from("api_keys")
    .update({ last_used_at: new Date().toISOString() })
    .eq("id", key.id)
    .then(() => {}).catch(() => {});

  return {
    ok: true,
    context: {
      keyId: key.id,
      workspaceId: key.workspace_id,
      keyType: token.startsWith("sk_live_") ? "secret" : "publishable",
      permissions: Array.isArray(key.permissions)
        ? (key.permissions as string[])
        : ["read:blogs", "read:pages", "read:media", "read:collections", "read:news", "read:articles", "read:products", "read:faqs"],
    },
  };
}

function hasPermission(permissions: string[], required: string): boolean {
  return permissions.includes("*") || permissions.includes(required);
}

function buildPaginationLinks(
  baseUrl: string,
  page: number,
  totalPages: number,
): Record<string, string | null> {
  function pageUrl(p: number): string {
    const u = new URL(baseUrl, "http://localhost");
    u.searchParams.set("page", String(p));
    return u.pathname + u.search;
  }
  return {
    first:    pageUrl(1),
    previous: page > 1 ? pageUrl(page - 1) : null,
    next:     page < totalPages ? pageUrl(page + 1) : null,
    last:     pageUrl(Math.max(1, totalPages)),
  };
}

// ── Engagement helpers ────────────────────────────────────────────────────────

async function getEngagementSettings(db: ReturnType<typeof getServiceClient>, workspaceId: string) {
  const { data } = await (db as any)
    .from("workspaces")
    .select("engagement_settings")
    .eq("id", workspaceId)
    .single();

  const s = data?.engagement_settings ?? {};
  return {
    features: {
      likes: s.features?.likes ?? true,
      comments: s.features?.comments ?? true,
      socialShare: s.features?.socialShare ?? true,
      relatedPosts: s.features?.relatedPosts ?? true,
      viewTracking: s.features?.viewTracking ?? true,
      poweredBy: s.features?.poweredBy ?? true,
    },
    branding: {
      enabled: s.branding?.enabled ?? true,
      text: s.branding?.text ?? "Powered by Lunar CMS",
      url: s.branding?.url ?? "https://lunarcms.com",
    },
    commentSettings: {
      requireApproval: s.commentSettings?.requireApproval ?? true,
      allowGuest: s.commentSettings?.allowGuest ?? true,
      maxDepth: s.commentSettings?.maxDepth ?? 3,
    },
  };
}

function buildShareUrls(post: Record<string, unknown>, siteUrl: string) {
  const title = encodeURIComponent((post.title as string) ?? "");
  const slug = (post.slug as string) ?? "";
  const postUrl = `${siteUrl}/blogs/${slug}`;
  const encodedUrl = encodeURIComponent(postUrl);
  const description = encodeURIComponent((post.excerpt as string) ?? "");

  return {
    url: postUrl,
    facebook:  `https://www.facebook.com/sharer/sharer.php?u=${encodedUrl}`,
    linkedin:  `https://www.linkedin.com/sharing/share-offsite/?url=${encodedUrl}`,
    x:         `https://twitter.com/intent/tweet?url=${encodedUrl}&text=${title}`,
    whatsapp:  `https://wa.me/?text=${title}%20${encodedUrl}`,
    email:     `mailto:?subject=${title}&body=${description}%0A%0A${encodedUrl}`,
  };
}

function stripHtml(html: string): string {
  return html.replace(/<[^>]*>/g, " ").replace(/\s+/g, " ").trim();
}

function calculateWordCount(content: string): number {
  const text = stripHtml(content);
  if (!text) return 0;
  return text.split(/\s+/).filter(Boolean).length;
}

// ── VIEW DEDUP: 30-minute window per visitor per post ─────────────────────────
const VIEW_DEDUP = new Map<string, number>();

function shouldCountView(postId: string, visitorId: string): boolean {
  const key = `${postId}:${visitorId}`;
  const now = Date.now();
  const last = VIEW_DEDUP.get(key);
  if (last && now - last < 30 * 60 * 1000) return false;
  VIEW_DEDUP.set(key, now);
  return true;
}

// ── Middleware ────────────────────────────────────────────────────────────────

export function lunarApiMiddleware() {
  return async function middleware(
    req: IncomingMessage,
    res: ServerResponse,
    next: () => void,
  ) {
    const rawUrl = req.url ?? "/";

    // CORS preflight
    if (req.method === "OPTIONS" && rawUrl.startsWith("/api/v1/")) {
      res.writeHead(204, CORS_HEADERS);
      res.end();
      return;
    }

    if (!rawUrl.startsWith("/api/v1/")) return next();

    const url = new URL(rawUrl, "http://localhost");
    const method = req.method ?? "GET";

    // Only handle supported methods
    if (!["GET", "POST", "PUT", "DELETE"].includes(method)) return next();

    // ── 1. Authenticate ──────────────────────────────────────────────────────
    const authResult = await validateApiKey(
      req.headers["authorization"] as string | undefined,
    );

    if (!authResult.ok) {
      return sendFail(res, authResult.status, authResult.code, authResult.message);
    }

    const { context } = authResult;
    const visitorId = getVisitorId(req);

    try {
      const db = getServiceClient();
      const ws = context.workspaceId;

      // ════════════════════════════════════════════════════════════════════════
      // GET /api/v1/posts
      // ════════════════════════════════════════════════════════════════════════
      if (url.pathname === "/api/v1/posts" && method === "GET") {
        if (!hasPermission(context.permissions, "read:blogs")) {
          return sendFail(res, 403, "FORBIDDEN", "This API key does not have permission to access this resource.");
        }

        const search   = url.searchParams.get("search")?.trim() ?? "";
        const category = url.searchParams.get("category")?.trim() ?? "";
        const featured = url.searchParams.get("featured");
        const page     = Math.max(1, parseInt(url.searchParams.get("page") ?? "1", 10) || 1);
        const limit    = Math.min(100, Math.max(1, parseInt(url.searchParams.get("limit") ?? "20", 10) || 20));
        const offset   = (page - 1) * limit;

        let query = db
          .from("blog_posts")
          .select(LIST_COLS, { count: "exact" })
          .eq("status", "published")
          .eq("workspace_id", ws)
          .order("published_at", { ascending: false })
          .range(offset, offset + limit - 1);

        if (category && category !== "All") query = query.eq("category", category);
        if (featured === "true") query = query.eq("featured", true);
        if (search) {
          query = query.or(
            `title.ilike.%${search}%,excerpt.ilike.%${search}%,category.ilike.%${search}%`,
          );
        }

        const { data, error, count } = await query;
        if (error) return sendFail(res, 500, "INTERNAL_SERVER_ERROR", error.message);

        const total      = count ?? 0;
        const totalPages = Math.ceil(total / limit);
        const links      = buildPaginationLinks(rawUrl, page, totalPages);

        return sendOk(
          res,
          (data ?? []).map((r) => {
            const row = r as Record<string, unknown>;
            return { ...sanitize(row), social: buildSocialMetadata(row, "article") };
          }),
          { page, limit, total, totalPages },
          links,
        );
      }

      // ════════════════════════════════════════════════════════════════════════
      // Engagement: /api/v1/posts/:slug/*  and  /api/v1/comments/:id
      // ════════════════════════════════════════════════════════════════════════

      // /api/v1/comments/:id  — moderation (secret key only)
      const commentIdMatch = url.pathname.match(/^\/api\/v1\/comments\/([^/]+)$/);
      if (commentIdMatch) {
        const commentId = commentIdMatch[1];
        if (context.keyType !== "secret" || !hasPermission(context.permissions, "manage:comments")) {
          return sendFail(res, 403, "FORBIDDEN", "Comment moderation requires a secret key with manage:comments permission.");
        }

        if (method === "PUT") {
          const body = await readBody(req);
          const newStatus = (body.status as string) ?? "";
          const allowed = ["approved", "rejected", "spam", "trash", "pending"];
          if (!allowed.includes(newStatus)) {
            return sendFail(res, 422, "UNPROCESSABLE_ENTITY", `status must be one of: ${allowed.join(", ")}`);
          }
          const { error } = await (db as any)
            .from("blog_comments")
            .update({ status: newStatus, moderated_at: new Date().toISOString() })
            .eq("id", commentId)
            .eq("workspace_id", ws);
          if (error) return sendFail(res, 500, "INTERNAL_SERVER_ERROR", error.message);
          return sendOk(res, { id: commentId, status: newStatus });

        } else if (method === "DELETE") {
          const { error } = await (db as any)
            .from("blog_comments")
            .delete()
            .eq("id", commentId)
            .eq("workspace_id", ws);
          if (error) return sendFail(res, 500, "INTERNAL_SERVER_ERROR", error.message);
          return sendOk(res, { id: commentId, deleted: true });

        } else {
          return sendFail(res, 405, "METHOD_NOT_ALLOWED", "Method not allowed.");
        }
      }

      // ════════════════════════════════════════════════════════════════════════
      // GET /api/v1/news  |  GET /api/v1/news/:slug
      // ════════════════════════════════════════════════════════════════════════
      if (url.pathname === "/api/v1/news" && method === "GET") {
        if (!hasPermission(context.permissions, "read:news")) {
          return sendFail(res, 403, "FORBIDDEN", "This API key does not have permission to access this resource.");
        }
        const page  = Math.max(1, parseInt(url.searchParams.get("page") ?? "1", 10) || 1);
        const limit = Math.min(100, Math.max(1, parseInt(url.searchParams.get("limit") ?? "20", 10) || 20));
        const offset = (page - 1) * limit;
        const category = url.searchParams.get("category")?.trim() ?? "";
        const search   = url.searchParams.get("search")?.trim() ?? "";
        const breaking = url.searchParams.get("breaking");
        const featured = url.searchParams.get("featured");
        const NEWS_LIST_COLS = "slug,title,excerpt,cover_image,category,source_name,source_url,breaking,featured,views,published_at,updated_at," + SOCIAL_COLS + ",seo_title,meta_description";
        let query = (db as any).from("news").select(NEWS_LIST_COLS, { count: "exact" })
          .eq("workspace_id", ws).eq("status", "published")
          .order("published_at", { ascending: false })
          .range(offset, offset + limit - 1);
        if (category) query = query.ilike("category", category);
        if (breaking === "true") query = query.eq("breaking", true);
        if (featured === "true") query = query.eq("featured", true);
        if (search) query = query.or(`title.ilike.%${search}%,excerpt.ilike.%${search}%`);
        const { data: newsData, error: newsErr, count: newsCount } = await query;
        if (newsErr) return sendFail(res, 500, "INTERNAL_SERVER_ERROR", newsErr.message);
        const total = newsCount ?? 0;
        const totalPages = Math.ceil(total / limit);
        return sendOk(res,
          (newsData ?? []).map((r: Record<string, unknown>) => ({ ...sanitize(r), social: buildSocialMetadata(r, "article") })),
          { page, limit, total, totalPages },
          buildPaginationLinks(rawUrl, page, totalPages),
        );
      }

      const newsSlugMatch = url.pathname.match(/^\/api\/v1\/news\/([^/]+)$/);
      if (newsSlugMatch && method === "GET") {
        if (!hasPermission(context.permissions, "read:news")) {
          return sendFail(res, 403, "FORBIDDEN", "This API key does not have permission to access this resource.");
        }
        const NEWS_DETAIL_COLS = "slug,title,content,excerpt,cover_image,category,source_name,source_url,breaking,featured,views,published_at,updated_at,seo_title,meta_description," + SOCIAL_COLS;
        const { data: newsItem, error: niErr } = await (db as any).from("news")
          .select(NEWS_DETAIL_COLS).eq("slug", newsSlugMatch[1])
          .eq("workspace_id", ws).eq("status", "published").maybeSingle();
        if (niErr) return sendFail(res, 500, "INTERNAL_SERVER_ERROR", niErr.message);
        if (!newsItem) return sendFail(res, 404, "NOT_FOUND", "News item not found.");
        const niRow = newsItem as Record<string, unknown>;
        (db as any).from("news").update({ views: (Number(niRow.views) || 0) + 1 }).eq("slug", newsSlugMatch[1]).eq("workspace_id", ws).then(() => {}).catch(() => {});
        return sendOk(res, { ...sanitize(niRow), social: buildSocialMetadata(niRow, "article") });
      }

      // ════════════════════════════════════════════════════════════════════════
      // GET /api/v1/articles  |  GET /api/v1/articles/:slug
      // ════════════════════════════════════════════════════════════════════════
      if (url.pathname === "/api/v1/articles" && method === "GET") {
        if (!hasPermission(context.permissions, "read:articles")) {
          return sendFail(res, 403, "FORBIDDEN", "This API key does not have permission to access this resource.");
        }
        const page  = Math.max(1, parseInt(url.searchParams.get("page") ?? "1", 10) || 1);
        const limit = Math.min(100, Math.max(1, parseInt(url.searchParams.get("limit") ?? "20", 10) || 20));
        const offset = (page - 1) * limit;
        const category = url.searchParams.get("category")?.trim() ?? "";
        const search   = url.searchParams.get("search")?.trim() ?? "";
        const featured = url.searchParams.get("featured");
        const ART_LIST_COLS = "id,slug,title,excerpt,cover_image,category,tags,author_name,article_type,status,featured,reading_time,word_count,views,published_at,updated_at,seo_title,meta_description," + SOCIAL_COLS;
        let query = (db as any).from("articles").select(ART_LIST_COLS, { count: "exact" })
          .eq("workspace_id", ws).eq("status", "published")
          .order("published_at", { ascending: false })
          .range(offset, offset + limit - 1);
        if (category) query = query.ilike("category", category);
        if (featured === "true") query = query.eq("featured", true);
        if (search) query = query.or(`title.ilike.%${search}%,excerpt.ilike.%${search}%`);
        const { data: artData, error: artErr, count: artCount } = await query;
        if (artErr) return sendFail(res, 500, "INTERNAL_SERVER_ERROR", artErr.message);
        const total = artCount ?? 0;
        const totalPages = Math.ceil(total / limit);
        return sendOk(res,
          (artData ?? []).map((r: Record<string, unknown>) => ({ ...sanitize(r), social: buildSocialMetadata(r, "article") })),
          { page, limit, total, totalPages },
          buildPaginationLinks(rawUrl, page, totalPages),
        );
      }

      const articleSlugMatch = url.pathname.match(/^\/api\/v1\/articles\/([^/]+)$/);
      if (articleSlugMatch && method === "GET") {
        if (!hasPermission(context.permissions, "read:articles")) {
          return sendFail(res, 403, "FORBIDDEN", "This API key does not have permission to access this resource.");
        }
        const ART_DETAIL_COLS = "id,slug,title,content,excerpt,cover_image,category,tags,author_name,article_type,status,featured,reading_time,word_count,views,published_at,updated_at,seo_title,meta_description," + SOCIAL_COLS;
        const { data: article, error: aErr } = await (db as any).from("articles")
          .select(ART_DETAIL_COLS).eq("slug", articleSlugMatch[1])
          .eq("workspace_id", ws).eq("status", "published").maybeSingle();
        if (aErr) return sendFail(res, 500, "INTERNAL_SERVER_ERROR", aErr.message);
        if (!article) return sendFail(res, 404, "NOT_FOUND", "Article not found.");
        const aRow = article as Record<string, unknown>;
        (db as any).from("articles").update({ views: (Number(aRow.views) || 0) + 1 }).eq("slug", articleSlugMatch[1]).eq("workspace_id", ws).then(() => {}).catch(() => {});
        return sendOk(res, { ...sanitize(aRow), social: buildSocialMetadata(aRow, "article") });
      }

      // ════════════════════════════════════════════════════════════════════════
      // GET /api/v1/products  |  GET /api/v1/products/:slug
      // ════════════════════════════════════════════════════════════════════════
      if (url.pathname === "/api/v1/products" && method === "GET") {
        if (!hasPermission(context.permissions, "read:products")) {
          return sendFail(res, 403, "FORBIDDEN", "This API key does not have permission to access this resource.");
        }
        const page  = Math.max(1, parseInt(url.searchParams.get("page") ?? "1", 10) || 1);
        const limit = Math.min(100, Math.max(1, parseInt(url.searchParams.get("limit") ?? "20", 10) || 20));
        const offset = (page - 1) * limit;
        const category = url.searchParams.get("category")?.trim() ?? "";
        const search   = url.searchParams.get("search")?.trim() ?? "";
        const featured = url.searchParams.get("featured");
        const PROD_LIST_COLS = "id,slug,name,description,cover_image,category,brand,sku,price,compare_price,currency,status,featured,tags,views,sort_order,updated_at,seo_title,meta_description," + SOCIAL_COLS;
        let query = (db as any).from("products").select(PROD_LIST_COLS, { count: "exact" })
          .eq("workspace_id", ws).eq("status", "published")
          .order("sort_order", { ascending: true })
          .range(offset, offset + limit - 1);
        if (category) query = query.ilike("category", category);
        if (featured === "true") query = query.eq("featured", true);
        if (search) query = query.or(`name.ilike.%${search}%,description.ilike.%${search}%`);
        const { data: prodData, error: prodErr, count: prodCount } = await query;
        if (prodErr) return sendFail(res, 500, "INTERNAL_SERVER_ERROR", prodErr.message);
        const total = prodCount ?? 0;
        const totalPages = Math.ceil(total / limit);
        return sendOk(res,
          (prodData ?? []).map((r: Record<string, unknown>) => ({ ...sanitize(r), social: buildSocialMetadata(r, "product") })),
          { page, limit, total, totalPages },
          buildPaginationLinks(rawUrl, page, totalPages),
        );
      }

      const productSlugMatch = url.pathname.match(/^\/api\/v1\/products\/([^/]+)$/);
      if (productSlugMatch && method === "GET") {
        if (!hasPermission(context.permissions, "read:products")) {
          return sendFail(res, 403, "FORBIDDEN", "This API key does not have permission to access this resource.");
        }
        const PROD_DETAIL_COLS = "id,slug,name,description,content,cover_image,gallery,specifications,features,category,brand,sku,price,compare_price,currency,status,featured,tags,views,sort_order,updated_at,seo_title,meta_description," + SOCIAL_COLS;
        const { data: product, error: pErr } = await (db as any).from("products")
          .select(PROD_DETAIL_COLS).eq("slug", productSlugMatch[1])
          .eq("workspace_id", ws).eq("status", "published").maybeSingle();
        if (pErr) return sendFail(res, 500, "INTERNAL_SERVER_ERROR", pErr.message);
        if (!product) return sendFail(res, 404, "NOT_FOUND", "Product not found.");
        const pRow = product as Record<string, unknown>;
        (db as any).from("products").update({ views: (Number(pRow.views) || 0) + 1 }).eq("slug", productSlugMatch[1]).eq("workspace_id", ws).then(() => {}).catch(() => {});
        return sendOk(res, { ...sanitize(pRow), social: buildSocialMetadata(pRow, "product") });
      }

      // ════════════════════════════════════════════════════════════════════════
      // GET /api/v1/faqs
      // ════════════════════════════════════════════════════════════════════════
      if (url.pathname === "/api/v1/faqs" && method === "GET") {
        if (!hasPermission(context.permissions, "read:faqs")) {
          return sendFail(res, 403, "FORBIDDEN", "This API key does not have permission to access this resource.");
        }
        const page  = Math.max(1, parseInt(url.searchParams.get("page") ?? "1", 10) || 1);
        const limit = Math.min(100, Math.max(1, parseInt(url.searchParams.get("limit") ?? "50", 10) || 50));
        const offset = (page - 1) * limit;
        const category = url.searchParams.get("category")?.trim() ?? "";
        const search   = url.searchParams.get("search")?.trim() ?? "";
        const featured = url.searchParams.get("featured");
        const FAQ_LIST_COLS = "id,question,answer,category,featured,sort_order,updated_at," + SOCIAL_COLS;
        let query = (db as any).from("faqs").select(FAQ_LIST_COLS, { count: "exact" })
          .eq("workspace_id", ws).eq("status", "published")
          .order("sort_order", { ascending: true })
          .range(offset, offset + limit - 1);
        if (category) query = query.ilike("category", category);
        if (featured === "true") query = query.eq("featured", true);
        if (search) query = query.or(`question.ilike.%${search}%,answer.ilike.%${search}%`);
        const { data: faqData, error: faqErr, count: faqCount } = await query;
        if (faqErr) return sendFail(res, 500, "INTERNAL_SERVER_ERROR", faqErr.message);
        const total = faqCount ?? 0;
        const totalPages = Math.ceil(total / limit);
        return sendOk(res,
          (faqData ?? []).map((r: Record<string, unknown>) => ({ ...sanitize(r), social: buildSocialMetadata(r, "website") })),
          { page, limit, total, totalPages },
          buildPaginationLinks(rawUrl, page, totalPages),
        );
      }

      // ════════════════════════════════════════════════════════════════════════
      // All /api/v1/posts/:slug* routes — resolve post first
      // ════════════════════════════════════════════════════════════════════════
      const slugBase = url.pathname.match(/^\/api\/v1\/posts\/([^/]+)/);
      if (!slugBase) {
        return sendFail(res, 404, "NOT_FOUND", "Endpoint not found. Check the API documentation for available routes.");
      }

      const slug = slugBase[1];
      const subPath = url.pathname.slice(`/api/v1/posts/${slug}`.length).replace(/^\//, "");

      // ── Resolve post ──────────────────────────────────────────────────────
      if (!hasPermission(context.permissions, "read:blogs")) {
        return sendFail(res, 403, "FORBIDDEN", "This API key does not have permission to access this resource.");
      }

      const { data: post, error: postErr } = await (db as any)
        .from("blog_posts")
        .select("id, " + DETAIL_COLS + ", word_count")
        .eq("slug", slug)
        .eq("status", "published")
        .eq("workspace_id", ws)
        .maybeSingle();

      if (postErr) return sendFail(res, 500, "INTERNAL_SERVER_ERROR", postErr.message);
      if (!post)   return sendFail(res, 404, "NOT_FOUND", "Post not found.");

      const postId = post.id as string;

      // ════════════════════════════════════════════════════════════════════════
      // GET /api/v1/posts/:slug  (detail + enhanced response)
      // ════════════════════════════════════════════════════════════════════════
      if (!subPath && method === "GET") {
        // Fire-and-forget view increment on the blog_posts.views counter
        db.from("blog_posts")
          .update({ views: ((post.views as number) ?? 0) + 1 })
          .eq("id", postId)
          .then(() => {}).catch(() => {});

        const settings = await getEngagementSettings(db, ws);

        // Counts
        const [{ count: likeCount }, { count: commentCount }, { count: viewCount }] = await Promise.all([
          (db as any).from("blog_likes").select("*", { count: "exact", head: true }).eq("blog_post_id", postId),
          (db as any).from("blog_comments").select("*", { count: "exact", head: true }).eq("blog_post_id", postId).eq("status", "approved"),
          (db as any).from("blog_views").select("*", { count: "exact", head: true }).eq("blog_post_id", postId),
        ]);

        // Related posts (same category or shared tags, limit 5)
        const { data: related } = await (db as any)
          .from("blog_posts")
          .select("title,slug,excerpt,cover_image,category,published_at,reading_time")
          .eq("status", "published")
          .eq("workspace_id", ws)
          .neq("id", postId)
          .eq("category", post.category)
          .limit(5);

        // Site URL for share links
        const { data: wsData } = await (db as any).from("workspaces").select("site_url").eq("id", ws).single();
        const siteUrl = wsData?.site_url ?? process.env["SUPABASE_URL"] ?? "";

        const content = (post.content as string) ?? "";
        const wc = (post.word_count as number) || calculateWordCount(content);

        return sendOk(res, {
          ...sanitize(post as Record<string, unknown>),
          wordCount: wc,
          social: buildSocialMetadata(post as Record<string, unknown>, "article"),
          stats: {
            views: viewCount ?? (post.views as number) ?? 0,
            likes: likeCount ?? 0,
            comments: commentCount ?? 0,
          },
          features: settings.features,
          branding: settings.branding.enabled ? settings.branding : { enabled: false },
          share: buildShareUrls(post as Record<string, unknown>, siteUrl),
          related: (related ?? []).map((r: Record<string, unknown>) => sanitize(r)),
        });
      }

      // ════════════════════════════════════════════════════════════════════════
      // LIKES
      // ════════════════════════════════════════════════════════════════════════
      if (subPath === "likes") {
        if (method === "GET") {
          const [{ count: total }, { count: liked }] = await Promise.all([
            (db as any).from("blog_likes").select("*", { count: "exact", head: true }).eq("blog_post_id", postId),
            (db as any).from("blog_likes").select("*", { count: "exact", head: true }).eq("blog_post_id", postId).eq("visitor_id", visitorId),
          ]);
          return sendOk(res, { likes: total ?? 0, liked: (liked ?? 0) > 0 });

        } else if (method === "POST") {
          if (!hasPermission(context.permissions, "write:engagement")) {
            return sendFail(res, 403, "FORBIDDEN", "write:engagement permission required.");
          }
          await (db as any)
            .from("blog_likes")
            .upsert({ blog_post_id: postId, workspace_id: ws, visitor_id: visitorId }, { onConflict: "blog_post_id,visitor_id", ignoreDuplicates: true });
          // Daily rollup
          (db as any).rpc("bump_blog_engagement_daily", { p_blog_post_id: postId, p_workspace_id: ws, p_metric: "likes" }).then(() => {}).catch(() => {});
          const { count } = await (db as any).from("blog_likes").select("*", { count: "exact", head: true }).eq("blog_post_id", postId);
          return sendOk(res, { likes: count ?? 0, liked: true });

        } else if (method === "DELETE") {
          if (!hasPermission(context.permissions, "write:engagement")) {
            return sendFail(res, 403, "FORBIDDEN", "write:engagement permission required.");
          }
          await (db as any).from("blog_likes").delete().eq("blog_post_id", postId).eq("visitor_id", visitorId);
          const { count } = await (db as any).from("blog_likes").select("*", { count: "exact", head: true }).eq("blog_post_id", postId);
          return sendOk(res, { likes: count ?? 0, liked: false });

        } else {
          return sendFail(res, 405, "METHOD_NOT_ALLOWED", "Method not allowed.");
        }
      }

      // ════════════════════════════════════════════════════════════════════════
      // COMMENTS
      // ════════════════════════════════════════════════════════════════════════
      if (subPath === "comments") {
        if (method === "GET") {
          const page  = Math.max(1, parseInt(url.searchParams.get("page") ?? "1", 10) || 1);
          const limit = Math.min(100, Math.max(1, parseInt(url.searchParams.get("limit") ?? "20", 10) || 20));
          const offset = (page - 1) * limit;

          const { data: rows, count } = await (db as any)
            .from("blog_comments")
            .select("id,parent_id,author_name,author_website,content,created_at", { count: "exact" })
            .eq("blog_post_id", postId)
            .eq("status", "approved")
            .order("created_at", { ascending: true })
            .range(offset, offset + limit - 1);

          // Build threaded tree
          const comments = (rows ?? []) as Array<{ id: string; parent_id: string | null; replies?: unknown[] }>;
          const byId = new Map(comments.map((c) => [c.id, { ...c, replies: [] as unknown[] }]));
          const roots: unknown[] = [];
          for (const c of byId.values()) {
            if (c.parent_id && byId.has(c.parent_id)) {
              byId.get(c.parent_id)!.replies.push(c);
            } else {
              roots.push(c);
            }
          }

          return sendOk(res, roots, { page, limit, total: count ?? 0 });

        } else if (method === "POST") {
          if (!hasPermission(context.permissions, "write:engagement")) {
            return sendFail(res, 403, "FORBIDDEN", "write:engagement permission required.");
          }
          const settings = await getEngagementSettings(db, ws);
          if (!settings.features.comments) {
            return sendFail(res, 403, "FORBIDDEN", "Comments are disabled for this workspace.");
          }

          const body = await readBody(req);
          const name    = ((body.name as string) ?? "").trim();
          const email   = ((body.email as string) ?? "").trim();
          const content = ((body.content as string) ?? "").trim();

          if (!name)    return sendFail(res, 422, "UNPROCESSABLE_ENTITY", "name is required.");
          if (!email || !email.includes("@")) return sendFail(res, 422, "UNPROCESSABLE_ENTITY", "A valid email is required.");
          if (!content) return sendFail(res, 422, "UNPROCESSABLE_ENTITY", "content is required.");
          if (content.length > 5000) return sendFail(res, 422, "UNPROCESSABLE_ENTITY", "content must be 5000 characters or fewer.");

          const status = settings.commentSettings.requireApproval ? "pending" : "approved";

          const { data: comment, error: insertErr } = await (db as any)
            .from("blog_comments")
            .insert({
              blog_post_id: postId,
              workspace_id: ws,
              parent_id: (body.parent_id as string) || null,
              author_name: name,
              author_email: email,
              author_website: (body.website as string) || null,
              content,
              status,
              visitor_id: visitorId,
            })
            .select("id,parent_id,author_name,author_website,content,created_at,status")
            .single();

          if (insertErr) return sendFail(res, 500, "INTERNAL_SERVER_ERROR", insertErr.message);

          if (status === "approved") {
            (db as any).rpc("bump_blog_engagement_daily", { p_blog_post_id: postId, p_workspace_id: ws, p_metric: "comments" }).then(() => {}).catch(() => {});
          }

          return sendCreated(res, { ...comment, requiresApproval: status === "pending" });

        } else {
          return sendFail(res, 405, "METHOD_NOT_ALLOWED", "Method not allowed.");
        }
      }

      // ════════════════════════════════════════════════════════════════════════
      // VIEW TRACKING
      // ════════════════════════════════════════════════════════════════════════
      if (subPath === "view") {
        if (method !== "POST") return sendFail(res, 405, "METHOD_NOT_ALLOWED", "Use POST to record a view.");
        if (!hasPermission(context.permissions, "write:engagement")) {
          return sendFail(res, 403, "FORBIDDEN", "write:engagement permission required.");
        }

        const settings = await getEngagementSettings(db, ws);
        const body = await readBody(req);
        const ua = (req.headers["user-agent"] as string) ?? "";

        // Bot detection (basic)
        const isBot = /bot|crawl|spider|slurp|curl|wget|python|java|go-http|libwww/i.test(ua);
        if (isBot) {
          return sendOk(res, { counted: false, reason: "bot" });
        }

        if (!settings.features.viewTracking) {
          const { count } = await (db as any).from("blog_views").select("*", { count: "exact", head: true }).eq("blog_post_id", postId);
          return sendOk(res, { counted: false, totalViews: count ?? (post.views as number) ?? 0 });
        }

        const counted = shouldCountView(postId, visitorId);
        if (counted) {
          await (db as any).from("blog_views").insert({
            blog_post_id: postId,
            workspace_id: ws,
            visitor_id: visitorId,
            referrer: (body.referrer as string) || (req.headers["referer"] as string) || null,
            device_type: (body.deviceType as string) || null,
            user_agent: ua || null,
          });
          (db as any).rpc("bump_blog_engagement_daily", { p_blog_post_id: postId, p_workspace_id: ws, p_metric: "views" }).then(() => {}).catch(() => {});
        }

        const { count: totalViews } = await (db as any).from("blog_views").select("*", { count: "exact", head: true }).eq("blog_post_id", postId);
        return sendOk(res, { counted, totalViews: totalViews ?? 0 });
      }

      // ════════════════════════════════════════════════════════════════════════
      // SHARE METADATA
      // ════════════════════════════════════════════════════════════════════════
      if (subPath === "share") {
        const { data: wsData } = await (db as any).from("workspaces").select("site_url").eq("id", ws).single();
        const siteUrl = wsData?.site_url ?? "";

        if (method === "GET") {
          if (!hasPermission(context.permissions, "read:blogs")) {
            return sendFail(res, 403, "FORBIDDEN", "read:blogs permission required.");
          }
          return sendOk(res, buildShareUrls(post as Record<string, unknown>, siteUrl));

        } else if (method === "POST") {
          if (!hasPermission(context.permissions, "write:engagement")) {
            return sendFail(res, 403, "FORBIDDEN", "write:engagement permission required.");
          }
          const body = await readBody(req);
          const channel = ((body.channel as string) ?? "other").trim();
          await (db as any).from("blog_shares").insert({ blog_post_id: postId, workspace_id: ws, channel, visitor_id: visitorId });
          (db as any).rpc("bump_blog_engagement_daily", { p_blog_post_id: postId, p_workspace_id: ws, p_metric: "shares" }).then(() => {}).catch(() => {});
          return sendOk(res, { recorded: true, channel });

        } else {
          return sendFail(res, 405, "METHOD_NOT_ALLOWED", "Method not allowed.");
        }
      }

      // ════════════════════════════════════════════════════════════════════════
      // STATS
      // ════════════════════════════════════════════════════════════════════════
      if (subPath === "stats" && method === "GET") {
        const [{ count: views }, { count: likes }, { count: comments }, { count: shares }] = await Promise.all([
          (db as any).from("blog_views").select("*", { count: "exact", head: true }).eq("blog_post_id", postId),
          (db as any).from("blog_likes").select("*", { count: "exact", head: true }).eq("blog_post_id", postId),
          (db as any).from("blog_comments").select("*", { count: "exact", head: true }).eq("blog_post_id", postId).eq("status", "approved"),
          (db as any).from("blog_shares").select("*", { count: "exact", head: true }).eq("blog_post_id", postId),
        ]);
        const settings = await getEngagementSettings(db, ws);
        return sendOk(res, {
          stats: { views: views ?? 0, likes: likes ?? 0, comments: comments ?? 0, shares: shares ?? 0 },
          readingTime: (post.reading_time as number) ?? 1,
          wordCount: (post.word_count as number) ?? 0,
          features: settings.features,
          branding: settings.branding.enabled ? settings.branding : { enabled: false },
        });
      }

      // ════════════════════════════════════════════════════════════════════════
      // RELATED POSTS
      // ════════════════════════════════════════════════════════════════════════
      if (subPath === "related" && method === "GET") {
        const limit = Math.min(20, Math.max(1, parseInt(url.searchParams.get("limit") ?? "5", 10) || 5));

        // Same category first, then fallback to same tag
        const { data: sameCat } = await (db as any)
          .from("blog_posts")
          .select("title,slug,excerpt,cover_image,category,tags,published_at,reading_time")
          .eq("status", "published")
          .eq("workspace_id", ws)
          .neq("id", postId)
          .eq("category", post.category)
          .order("published_at", { ascending: false })
          .limit(limit);

        let related = sameCat ?? [];

        if (related.length < limit) {
          const tags = (post.tags as string[]) ?? [];
          if (tags.length > 0) {
            const { data: tagPosts } = await (db as any)
              .from("blog_posts")
              .select("title,slug,excerpt,cover_image,category,tags,published_at,reading_time")
              .eq("status", "published")
              .eq("workspace_id", ws)
              .neq("id", postId)
              .contains("tags", tags.slice(0, 3))
              .order("published_at", { ascending: false })
              .limit(limit - related.length);
            if (tagPosts) {
              const existingSlugs = new Set(related.map((r: Record<string, unknown>) => r.slug));
              related = [...related, ...tagPosts.filter((r: Record<string, unknown>) => !existingSlugs.has(r.slug))];
            }
          }
        }

        return sendOk(res, related.map((r: Record<string, unknown>) => sanitize(r)), { total: related.length });
      }

      // Fallback 404
      return sendFail(res, 404, "NOT_FOUND", "Endpoint not found. Check the API documentation for available routes.");

    } catch (err) {
      return sendFail(res, 500, "INTERNAL_SERVER_ERROR", String(err));
    }
  };
}
