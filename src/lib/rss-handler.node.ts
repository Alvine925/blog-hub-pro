/**
 * Node.js-only module: RSS feed handler used as a Vite dev-server middleware.
 * Serves a valid RSS 2.0 feed at /feed.xml for all published blog posts.
 */
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
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&apos;");
}

function toRfc822(iso: string | null): string {
  if (!iso) return new Date().toUTCString();
  return new Date(iso).toUTCString();
}

function deriveBaseUrl(req: IncomingMessage): string {
  const host = req.headers.host ?? "localhost:5000";
  const proto =
    (req.headers["x-forwarded-proto"] as string | undefined) ?? "http";
  return `${proto}://${host}`;
}

export function rssMiddleware() {
  return async function handler(
    req: IncomingMessage,
    res: ServerResponse,
    next: () => void,
  ) {
    if (req.url !== "/feed.xml") return next();

    try {
      const supabase = getSupabase();
      const { data: posts, error } = await supabase
        .from("blog_posts")
        .select(
          "id, title, slug, excerpt, author_name, category, tags, published_at",
        )
        .eq("status", "published")
        .order("published_at", { ascending: false })
        .limit(50);

      if (error) throw new Error(error.message);

      const base = deriveBaseUrl(req);
      const blogUrl = `${base}/blogs`;
      const feedUrl = `${base}/feed.xml`;

      const items = (posts ?? [])
        .map((post: {
          id: string;
          title: string;
          slug: string;
          excerpt: string;
          author_name: string;
          category: string;
          tags: string[];
          published_at: string | null;
        }) => {
          const url = `${base}/blogs/${post.slug}`;
          const tags = Array.isArray(post.tags) ? post.tags : [];
          const categoryTags = [post.category, ...tags]
            .filter(Boolean)
            .map((c: string) => `      <category>${escapeXml(c)}</category>`)
            .join("\n");
          return `  <item>
    <title>${escapeXml(post.title || "Untitled")}</title>
    <link>${escapeXml(url)}</link>
    <guid isPermaLink="true">${escapeXml(url)}</guid>
    <description>${escapeXml(post.excerpt || "")}</description>
    <pubDate>${toRfc822(post.published_at)}</pubDate>
    <dc:creator>${escapeXml(post.author_name || "Admin")}</dc:creator>
${categoryTags}
  </item>`;
        })
        .join("\n");

      const xml = `<?xml version="1.0" encoding="UTF-8"?>
<rss version="2.0"
  xmlns:atom="http://www.w3.org/2005/Atom"
  xmlns:dc="http://purl.org/dc/elements/1.1/"
  xmlns:content="http://purl.org/rss/1.0/modules/content/">
  <channel>
    <title>Lunar CMS Blog</title>
    <link>${escapeXml(blogUrl)}</link>
    <description>Ideas, guides and inspiration for every celebration.</description>
    <language>en-us</language>
    <ttl>60</ttl>
    <atom:link href="${escapeXml(feedUrl)}" rel="self" type="application/rss+xml"/>
${items}
  </channel>
</rss>`;

      const buf = Buffer.from(xml, "utf-8");
      res.writeHead(200, {
        "Content-Type": "application/rss+xml; charset=utf-8",
        "Content-Length": buf.byteLength,
        "Cache-Control": "public, max-age=600",
      });
      res.end(buf);
    } catch (err) {
      res.writeHead(500, { "Content-Type": "text/plain" });
      res.end(`RSS feed error: ${String(err)}`);
    }
  };
}
