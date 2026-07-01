/**
 * Node.js-only module: REST API handler used as a Vite dev-server middleware.
 * This module runs entirely in Node.js (not bundled for the browser).
 */
import type { IncomingMessage, ServerResponse } from "node:http";
import { createClient } from "@supabase/supabase-js";

const CORS_HEADERS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, Authorization",
  "Content-Type": "application/json",
};

function getSupabase() {
  const url = process.env["SUPABASE_URL"];
  const key = process.env["SUPABASE_PUBLISHABLE_KEY"];
  if (!url || !key) throw new Error("Missing Supabase env vars");
  return createClient(url, key, {
    auth: { storage: undefined, persistSession: false, autoRefreshToken: false },
  });
}

function send(res: ServerResponse, status: number, body: unknown) {
  const json = JSON.stringify(body);
  res.writeHead(status, { ...CORS_HEADERS, "Content-Length": Buffer.byteLength(json) });
  res.end(json);
}

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

    try {
      const supabase = getSupabase();

      // GET /api/v1/posts
      if (url.pathname === "/api/v1/posts") {
        const search = url.searchParams.get("search")?.trim() ?? "";
        const category = url.searchParams.get("category")?.trim() ?? "";
        const featured = url.searchParams.get("featured");
        const limit = Math.min(
          parseInt(url.searchParams.get("limit") ?? "20", 10) || 20,
          100,
        );
        const offset = parseInt(url.searchParams.get("offset") ?? "0", 10) || 0;

        const COLS =
          "id,title,slug,excerpt,cover_image,category,tags,author_name,featured,published_at,reading_time,views,created_at,updated_at";

        let query = supabase
          .from("blog_posts")
          .select(COLS, { count: "exact" })
          .eq("status", "published")
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
        if (error) return send(res, 500, { error: error.message });
        return send(res, 200, {
          data: data ?? [],
          meta: { total: count ?? 0, limit, offset },
        });
      }

      // GET /api/v1/posts/:slug
      const slugMatch = url.pathname.match(/^\/api\/v1\/posts\/([^/]+)$/);
      if (slugMatch) {
        const slug = slugMatch[1];
        const { data: post, error } = await supabase
          .from("blog_posts")
          .select("*")
          .eq("slug", slug)
          .eq("status", "published")
          .maybeSingle();

        if (error) return send(res, 500, { error: error.message });
        if (!post) return send(res, 404, { error: "Post not found" });

        // Increment view count
        await supabase
          .from("blog_posts")
          .update({ views: (post.views ?? 0) + 1 })
          .eq("id", post.id);

        return send(res, 200, { data: post });
      }

      return send(res, 404, { error: "Not found" });
    } catch (err) {
      return send(res, 500, { error: String(err) });
    }
  };
}
