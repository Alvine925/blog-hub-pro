import type { IncomingMessage, ServerResponse } from "node:http";
import { createClient } from "@supabase/supabase-js";

function getSupabase() {
  const url = process.env["SUPABASE_URL"];
  const key = process.env["SUPABASE_PUBLISHABLE_KEY"];
  if (!url || !key) throw new Error("Missing Supabase env vars");
  return createClient(url, key, {
    auth: { storage: undefined, persistSession: false, autoRefreshToken: false },
  });
}

function escapeXml(str: string): string {
  return str
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

function deriveBaseUrl(req: IncomingMessage): string {
  const host = req.headers.host ?? "localhost:5000";
  const proto = (req.headers["x-forwarded-proto"] as string | undefined) ?? "http";
  return `${proto}://${host}`;
}

export function sitemapMiddleware() {
  return async function handler(
    req: IncomingMessage,
    res: ServerResponse,
    next: () => void,
  ) {
    if (req.url !== "/sitemap.xml") return next();

    try {
      const supabase = getSupabase();
      const { data: posts, error } = await supabase
        .from("blog_posts")
        .select("slug, updated_at, published_at, featured")
        .eq("status", "published")
        .order("published_at", { ascending: false })
        .limit(1000);

      if (error) throw new Error(error.message);

      const base = deriveBaseUrl(req);

      const staticUrls = [
        { loc: `${base}/`, priority: "1.0", changefreq: "daily" },
        { loc: `${base}/blogs`, priority: "0.9", changefreq: "daily" },
      ];

      const postUrls = (posts ?? []).map((p) => ({
        loc: `${base}/blogs/${p.slug}`,
        lastmod: (p.updated_at ?? p.published_at ?? "").slice(0, 10),
        priority: p.featured ? "0.8" : "0.6",
        changefreq: "weekly",
      }));

      const allUrls = [...staticUrls, ...postUrls];

      const xml = `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
${allUrls
  .map(
    (u) => `  <url>
    <loc>${escapeXml(u.loc)}</loc>${u.lastmod ? `\n    <lastmod>${u.lastmod}</lastmod>` : ""}
    <changefreq>${u.changefreq ?? "monthly"}</changefreq>
    <priority>${u.priority ?? "0.5"}</priority>
  </url>`,
  )
  .join("\n")}
</urlset>`;

      const buf = Buffer.from(xml, "utf-8");
      res.writeHead(200, {
        "Content-Type": "application/xml; charset=utf-8",
        "Content-Length": buf.byteLength,
        "Cache-Control": "public, max-age=3600",
      });
      res.end(buf);
    } catch (err) {
      res.writeHead(500, { "Content-Type": "text/plain" });
      res.end(`Sitemap error: ${String(err)}`);
    }
  };
}
