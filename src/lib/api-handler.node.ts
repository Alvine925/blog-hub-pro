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

// ── Constants ─────────────────────────────────────────────────────────────────

const CORS_HEADERS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, Authorization",
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

// ── Fields exposed on list vs detail ─────────────────────────────────────────

const LIST_COLS =
  "title,slug,excerpt,cover_image,category,tags,author_name,featured,published_at,reading_time,views,updated_at";

const DETAIL_COLS =
  "title,slug,excerpt,content,cover_image,category,tags,author_name,featured," +
  "published_at,reading_time,views,seo_title,meta_description,updated_at";

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
    .select("id, workspace_id, permissions, status, expires_at")
    .eq("key_hash", hash)
    .single();

  if (error || !key) {
    return {
      ok: false,
      status: 401,
      code: "INVALID_API_KEY",
      message: "The supplied API key is invalid or has been revoked.",
    };
  }

  if (key.status !== "active") {
    return {
      ok: false,
      status: 401,
      code: "INVALID_API_KEY",
      message: "The supplied API key is invalid or has been revoked.",
    };
  }

  if (key.expires_at && new Date(key.expires_at) <= new Date()) {
    return {
      ok: false,
      status: 401,
      code: "INVALID_API_KEY",
      message: "The supplied API key is invalid or has been revoked.",
    };
  }

  if (!key.workspace_id) {
    return {
      ok: false,
      status: 401,
      code: "INVALID_API_KEY",
      message: "The supplied API key is invalid or has been revoked.",
    };
  }

  // Fire-and-forget: update last_used_at
  db.from("api_keys")
    .update({ last_used_at: new Date().toISOString() })
    .eq("id", key.id)
    .then(() => {})
    .catch(() => {});

  return {
    ok: true,
    context: {
      keyId: key.id,
      workspaceId: key.workspace_id,
      permissions: Array.isArray(key.permissions)
        ? (key.permissions as string[])
        : ["read:blogs", "read:pages", "read:media", "read:collections"],
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

    if (req.method !== "GET" || !rawUrl.startsWith("/api/v1/")) {
      return next();
    }

    const url = new URL(rawUrl, "http://localhost");

    // ── 1. Authenticate ────────────────────────────────────────────────────────
    const authResult = await validateApiKey(
      req.headers["authorization"] as string | undefined,
    );

    if (!authResult.ok) {
      return sendFail(res, authResult.status, authResult.code, authResult.message);
    }

    const { context } = authResult;

    try {
      const db = getServiceClient();

      // ── GET /api/v1/posts ────────────────────────────────────────────────────
      if (url.pathname === "/api/v1/posts") {
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
          .eq("workspace_id", context.workspaceId)        // ← workspace-scoped
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
          (data ?? []).map((r) => sanitize(r as Record<string, unknown>)),
          { page, limit, total, totalPages },
          links,
        );
      }

      // ── GET /api/v1/posts/:slug ──────────────────────────────────────────────
      const slugMatch = url.pathname.match(/^\/api\/v1\/posts\/([^/]+)$/);
      if (slugMatch) {
        if (!hasPermission(context.permissions, "read:blogs")) {
          return sendFail(res, 403, "FORBIDDEN", "This API key does not have permission to access this resource.");
        }

        const slug = slugMatch[1];
        const { data: post, error } = await db
          .from("blog_posts")
          .select(DETAIL_COLS)
          .eq("slug", slug)
          .eq("status", "published")
          .eq("workspace_id", context.workspaceId)        // ← workspace-scoped
          .maybeSingle();

        if (error) return sendFail(res, 500, "INTERNAL_SERVER_ERROR", error.message);
        if (!post)  return sendFail(res, 404, "NOT_FOUND", "Post not found.");

        // Increment view count (fire-and-forget)
        db.from("blog_posts")
          .update({ views: ((post as Record<string, unknown>).views as number ?? 0) + 1 })
          .eq("slug", slug)
          .eq("workspace_id", context.workspaceId)
          .then(() => {})
          .catch(() => {});

        return sendOk(
          res,
          sanitize(post as Record<string, unknown>),
        );
      }

      return sendFail(res, 404, "NOT_FOUND", "Endpoint not found.");
    } catch (err) {
      return sendFail(res, 500, "INTERNAL_SERVER_ERROR", String(err));
    }
  };
}
