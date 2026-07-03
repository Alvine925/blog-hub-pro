/**
 * PromptBuilder
 *
 * A wizard that asks the user what they are building, then generates a
 * comprehensive, copy-paste-ready prompt for vibe coding tools
 * (Bolt, Cursor, Replit, Lovable, v0, etc.).
 *
 * Covers: blogs, FAQs, articles, products, news, engagement.
 */

import { useState } from "react";
import { toast } from "sonner";
import {
  Sparkles, Copy, CheckCheck, ChevronRight, ChevronLeft,
  BookOpen, HelpCircle, FileText, ShoppingBag, Newspaper,
  Heart, Layers, Code2, Globe, Zap,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";

// ── Types ──────────────────────────────────────────────────────────────────────

type ContentKind = "blog" | "faq" | "articles" | "products" | "news" | "engagement";
type VibeToolId =
  | "bolt" | "cursor" | "replit" | "lovable" | "v0"
  | "windsurf" | "claudecode" | "copilot" | "other";
type FrameworkId =
  | "nextjs" | "react" | "vue" | "nuxt" | "astro"
  | "sveltekit" | "angular" | "html" | "other";

interface ContentOption {
  id: ContentKind;
  label: string;
  icon: React.ComponentType<{ className?: string }>;
  description: string;
  color: string;
}

interface VibeTool {
  id: VibeToolId;
  label: string;
  icon: string;
}

interface FrameworkOption {
  id: FrameworkId;
  label: string;
  icon: string;
}

// ── Data ───────────────────────────────────────────────────────────────────────

const CONTENT_OPTIONS: ContentOption[] = [
  { id: "blog",       label: "Blog / Posts",      icon: BookOpen,    description: "Blog posts with categories, tags, and full post pages",  color: "text-blue-500"   },
  { id: "faq",        label: "FAQ",                icon: HelpCircle,  description: "Structured Q&A sections with categories and search",      color: "text-purple-500" },
  { id: "articles",   label: "Articles",           icon: FileText,    description: "Long-form editorial articles with author profiles",        color: "text-green-500"  },
  { id: "products",   label: "Products",           icon: ShoppingBag, description: "Product catalog with details, pricing, and images",        color: "text-orange-500" },
  { id: "news",       label: "News / Press",       icon: Newspaper,   description: "News feed with breaking news and press releases",          color: "text-red-500"    },
  { id: "engagement", label: "Engagement",         icon: Heart,       description: "Likes, comments, shares, view tracking, and Powered by",   color: "text-pink-500"   },
];

const VIBE_TOOLS: VibeTool[] = [
  { id: "bolt",       label: "Bolt",                icon: "⚡" },
  { id: "lovable",    label: "Lovable",             icon: "❤️" },
  { id: "replit",     label: "Replit Agent",        icon: "🔄" },
  { id: "cursor",     label: "Cursor",              icon: "⬛" },
  { id: "windsurf",   label: "Windsurf",            icon: "🌊" },
  { id: "v0",         label: "v0 by Vercel",        icon: "▲" },
  { id: "claudecode", label: "Claude Code",         icon: "🤖" },
  { id: "copilot",    label: "GitHub Copilot",      icon: "🐙" },
  { id: "other",      label: "Other / Generic",     icon: "💡" },
];

const FRAMEWORKS: FrameworkOption[] = [
  { id: "nextjs",    label: "Next.js",      icon: "▲" },
  { id: "react",     label: "React",        icon: "⚛" },
  { id: "vue",       label: "Vue",          icon: "🟢" },
  { id: "nuxt",      label: "Nuxt",         icon: "💚" },
  { id: "astro",     label: "Astro",        icon: "🚀" },
  { id: "sveltekit", label: "SvelteKit",    icon: "🔥" },
  { id: "angular",   label: "Angular",      icon: "🔴" },
  { id: "html",      label: "HTML / Vanilla JS", icon: "🌐" },
  { id: "other",     label: "Other",        icon: "💡" },
];

// ── Prompt generation ──────────────────────────────────────────────────────────

function getEnvBlock(framework: FrameworkId): string {
  if (framework === "nextjs") {
    return `# .env.local (Next.js — never commit this file)
LUNAR_CMS_URL=YOUR_API_BASE_URL_HERE
LUNAR_CMS_API_KEY=pk_live_your_key_here`;
  }
  if (["nuxt"].includes(framework)) {
    return `# .env (Nuxt)
NUXT_LUNAR_CMS_URL=YOUR_API_BASE_URL_HERE
NUXT_LUNAR_CMS_API_KEY=pk_live_your_key_here`;
  }
  return `# .env (add to .gitignore!)
LUNAR_CMS_URL=YOUR_API_BASE_URL_HERE
LUNAR_CMS_API_KEY=pk_live_your_key_here`;
}

function getClientSection(framework: FrameworkId): string {
  const isNext = framework === "nextjs";
  const isVue  = ["vue", "nuxt"].includes(framework);
  const isSvelte = framework === "sveltekit";

  const fetchCall = isNext
    ? `fetch(url, { headers: { Authorization: \`Bearer \${LUNAR_CMS_API_KEY}\` }, next: { revalidate: 300 } })`
    : `fetch(url, { headers: { Authorization: \`Bearer \${LUNAR_CMS_API_KEY}\` } })`;

  return `## CMS Client Helper

Create the file \`lib/lunarCms.ts\` (or \`lib/lunarCms.js\`):

\`\`\`typescript
// lib/lunarCms.ts — server-only, never import in client components
const LUNAR_CMS_URL     = process.env.LUNAR_CMS_URL!;
const LUNAR_CMS_API_KEY = process.env.LUNAR_CMS_API_KEY!;

interface CmsEnvelope<T> {
  success: boolean;
  data: T;
  meta: { page: number; limit: number; total: number; totalPages: number };
}

async function cmsRequest<T>(
  path: string,
  params?: Record<string, string | number | boolean>
): Promise<CmsEnvelope<T>> {
  const url = new URL(path, LUNAR_CMS_URL);
  if (params) {
    Object.entries(params).forEach(([k, v]) => {
      if (v != null) url.searchParams.set(k, String(v));
    });
  }
  const res = await ${fetchCall};
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(err?.error?.message ?? \`Lunar CMS error \${res.status}\`);
  }
  return res.json();
}

// ── Content fetchers ──

export const cmsClient = {
  listBlogs: (params?: { page?: number; limit?: number; category?: string; tag?: string; featured?: boolean }) =>
    cmsRequest("/v1/blogs", params),

  getBlog: (slug: string) =>
    fetch(\`\${LUNAR_CMS_URL}/api/v1/posts/\${slug}\`, {
      headers: { Authorization: \`Bearer \${LUNAR_CMS_API_KEY}\` },
    }).then(r => r.json()), // returns { data, stats, features, branding, share, related }

  listFaqs: (params?: { page?: number; limit?: number; category?: string }) =>
    cmsRequest("/v1/faqs", params),

  listArticles: (params?: { page?: number; limit?: number }) =>
    cmsRequest("/v1/articles", params),

  listProducts: (params?: { page?: number; limit?: number; category?: string }) =>
    cmsRequest("/v1/products", params),

  listNews: (params?: { page?: number; limit?: number }) =>
    cmsRequest("/v1/news", params),

  search: (query: string) =>
    cmsRequest("/v1/search", { q: query }),

  listCategories: () => cmsRequest("/v1/categories", {}),
  listTags: ()       => cmsRequest("/v1/tags", {}),
};
\`\`\``;
}

function getEngagementProxySection(framework: FrameworkId): string {
  if (framework === "nextjs") {
    return `## Engagement Proxy (Next.js Route Handler)

Create \`app/api/engagement/[...path]/route.ts\`:

\`\`\`typescript
import { NextRequest, NextResponse } from "next/server";

const CMS = process.env.LUNAR_CMS_URL!;
const KEY = process.env.LUNAR_CMS_API_KEY!;

async function proxy(req: NextRequest, { params }: { params: { path: string[] } }) {
  const path = params.path.join("/");
  const url  = \`\${CMS}/api/v1/\${path}\${req.nextUrl.search}\`;
  const body = req.method !== "GET" && req.method !== "DELETE"
    ? await req.text() : undefined;

  const upstream = await fetch(url, {
    method:  req.method,
    headers: {
      Authorization:  \`Bearer \${KEY}\`,
      "Content-Type": "application/json",
      "X-Visitor-Id": req.headers.get("X-Visitor-Id") ?? "anonymous",
    },
    body,
  });
  const data = await upstream.json();
  return NextResponse.json(data, { status: upstream.status });
}

export const GET    = proxy;
export const POST   = proxy;
export const DELETE = proxy;
\`\`\`

Client engagement calls use relative paths: \`/api/engagement/posts/:slug/likes\``;
  }

  if (framework === "sveltekit") {
    return `## Engagement Proxy (SvelteKit)

Create \`src/routes/api/engagement/[...path]/+server.ts\`:

\`\`\`typescript
import type { RequestHandler } from "@sveltejs/kit";

const CMS = process.env.LUNAR_CMS_URL!;
const KEY = process.env.LUNAR_CMS_API_KEY!;

export const GET:    RequestHandler = proxy;
export const POST:   RequestHandler = proxy;
export const DELETE: RequestHandler = proxy;

async function proxy({ request, params, url }): Promise<Response> {
  const path = (params as { path: string }).path;
  return fetch(\`\${CMS}/api/v1/\${path}\${url.search}\`, {
    method: request.method,
    headers: {
      Authorization:  \`Bearer \${KEY}\`,
      "Content-Type": "application/json",
      "X-Visitor-Id": request.headers.get("X-Visitor-Id") ?? "anonymous",
    },
    body: request.method !== "GET" && request.method !== "DELETE"
      ? await request.text() : undefined,
  });
}
\`\`\``;
  }

  return `## Engagement Proxy (Server API Route)

Create a server-side proxy endpoint at \`/api/engagement/[...path]\` that:
1. Reads \`LUNAR_CMS_API_KEY\` from environment variables (never expose to the browser)
2. Forwards the request to \`\$\{LUNAR_CMS_URL\}/api/v1/...\` with \`Authorization: Bearer <key>\`
3. Passes through the \`X-Visitor-Id\` header from the client
4. Returns the upstream response unchanged

Client engagement calls use the proxy's relative URL path.

\`\`\`typescript
// Generic proxy pseudocode:
// POST /api/engagement/posts/:slug/likes
// → headers: { Authorization: Bearer <secret>, X-Visitor-Id: <uuid> }
// → forward to: LUNAR_CMS_URL/api/v1/posts/:slug/likes
\`\`\``;
}

function getEngagementComponents(): string {
  return `
## Visitor Identity Utility

Create \`lib/visitorId.ts\` (client-only):

\`\`\`typescript
// lib/visitorId.ts — client-only, never import in server code
export function getVisitorId(): string {
  if (typeof window === "undefined") return "server";
  let id = localStorage.getItem("lunar_vid");
  if (!id) {
    id = crypto.randomUUID();
    localStorage.setItem("lunar_vid", id);
  }
  return id;
}
\`\`\`

---

## PostEngagement Component

Create \`components/PostEngagement.tsx\` — mount below every post's content:

\`\`\`typescript
"use client"; // Next.js only

import { useState, useEffect } from "react";
import { getVisitorId } from "@/lib/visitorId";

interface EngagementProps {
  slug: string;
  initialStats: { views: number; likes: number; comments: number; shares: number };
  features: {
    likes: boolean; comments: boolean; socialShare: boolean;
    viewTracking: boolean; relatedPosts: boolean; poweredBy: boolean;
  };
  shareLinks: { facebook: string; linkedin: string; x: string; whatsapp: string; email: string };
}

export function PostEngagement({ slug, initialStats, features, shareLinks }: EngagementProps) {
  const [stats,  setStats]  = useState(initialStats);
  const [liked,  setLiked]  = useState(false);
  const [liking, setLiking] = useState(false);
  const [shareOpen, setShareOpen] = useState(false);

  // a) Track views on mount
  useEffect(() => {
    if (!features.viewTracking) return;
    fetch(\`/api/engagement/posts/\${slug}/view\`, {
      method: "POST",
      headers: { "X-Visitor-Id": getVisitorId(), "Content-Type": "application/json" },
      body: JSON.stringify({ referrer: document.referrer }),
    }).catch(() => {}); // silent fail — never block render
  }, [slug, features.viewTracking]);

  // b) Fetch initial like status
  useEffect(() => {
    if (!features.likes) return;
    fetch(\`/api/engagement/posts/\${slug}/likes\`, {
      headers: { "X-Visitor-Id": getVisitorId() },
    })
      .then(r => r.json())
      .then(d => { setStats(s => ({ ...s, likes: d.likes })); setLiked(d.liked); })
      .catch(() => {});
  }, [slug, features.likes]);

  async function toggleLike() {
    if (liking) return;
    setLiking(true);
    const method  = liked ? "DELETE" : "POST";
    const optimistic = liked ? stats.likes - 1 : stats.likes + 1;
    setStats(s => ({ ...s, likes: optimistic }));
    setLiked(!liked);
    try {
      const res = await fetch(\`/api/engagement/posts/\${slug}/likes\`, {
        method,
        headers: { "X-Visitor-Id": getVisitorId(), "Content-Type": "application/json" },
      });
      const d = await res.json();
      setStats(s => ({ ...s, likes: d.likes }));
      setLiked(d.liked);
    } catch {
      // revert optimistic update
      setStats(s => ({ ...s, likes: stats.likes }));
      setLiked(liked);
    } finally {
      setLiking(false);
    }
  }

  return (
    <div className="mt-8 space-y-4 border-t pt-6">
      {/* Stats bar */}
      <div className="flex items-center gap-4 text-sm text-gray-500">
        <span>👁 {stats.views} views</span>
        {features.likes    && <span>♥ {stats.likes} likes</span>}
        {features.comments && <span>💬 {stats.comments} comments</span>}
        {features.socialShare && <span>↗ {stats.shares} shares</span>}
      </div>

      {/* Action buttons */}
      <div className="flex items-center gap-3">
        {features.likes && (
          <button
            onClick={toggleLike}
            disabled={liking}
            className={\`flex items-center gap-1.5 rounded-full border px-4 py-2 text-sm font-medium transition-colors \${
              liked ? "border-rose-400 bg-rose-50 text-rose-600" : "border-gray-200 hover:border-gray-300"
            }\`}
          >
            {liked ? "♥ Liked" : "♡ Like"}
          </button>
        )}
        {features.socialShare && (
          <button
            onClick={() => setShareOpen(true)}
            className="flex items-center gap-1.5 rounded-full border border-gray-200 px-4 py-2 text-sm font-medium hover:border-gray-300 transition-colors"
          >
            ↗ Share
          </button>
        )}
      </div>

      {/* Comments section — implement GET/POST /api/engagement/posts/:slug/comments */}
      {/* See API guide for full threaded comment implementation */}

      {/* Share modal */}
      {shareOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50" onClick={() => setShareOpen(false)}>
          <div className="rounded-2xl bg-white p-6 shadow-2xl w-80" onClick={e => e.stopPropagation()}>
            <h3 className="font-semibold mb-4">Share this post</h3>
            <div className="grid grid-cols-2 gap-2">
              {[
                { label: "Facebook",  url: shareLinks.facebook,  color: "bg-[#1877F2] text-white" },
                { label: "LinkedIn",  url: shareLinks.linkedin,  color: "bg-[#0A66C2] text-white" },
                { label: "X",         url: shareLinks.x,         color: "bg-black text-white" },
                { label: "WhatsApp",  url: shareLinks.whatsapp,  color: "bg-[#25D366] text-white" },
              ].map(({ label, url, color }) => (
                <a
                  key={label}
                  href={url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className={\`\${color} rounded-lg px-3 py-2 text-sm font-medium text-center\`}
                  onClick={() => fetch(\`/api/engagement/posts/\${slug}/share\`, {
                    method: "POST",
                    headers: { "X-Visitor-Id": getVisitorId(), "Content-Type": "application/json" },
                    body: JSON.stringify({ channel: label.toLowerCase() }),
                  }).catch(() => {})}
                >
                  {label}
                </a>
              ))}
            </div>
            <button
              className="mt-3 w-full rounded-lg border py-2 text-sm text-gray-600 hover:bg-gray-50"
              onClick={() => { navigator.clipboard.writeText(window.location.href); }}
            >
              📋 Copy link
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
\`\`\`

---

## PoweredByBanner Component

Include at the bottom of every post page — it auto-hides when disabled by the CMS admin:

\`\`\`typescript
export function PoweredByBanner({
  branding,
}: {
  branding: { enabled: boolean; text: string; url: string };
}) {
  if (!branding?.enabled) return null;
  return (
    <div className="fixed bottom-0 right-0 m-4 z-40">
      <a
        href={branding.url}
        target="_blank"
        rel="noopener noreferrer"
        className="flex items-center gap-1.5 rounded-full bg-black/80 px-3 py-1.5 text-xs text-white/80 hover:text-white transition-colors backdrop-blur"
      >
        <span>🌙</span>
        <span>{branding.text}</span>
      </a>
    </div>
  );
}
\`\`\``;
}

function getContentSections(kinds: ContentKind[]): string {
  const sections: string[] = [];

  if (kinds.includes("blog")) {
    sections.push(`## Blog / Posts

### API Endpoints
- \`GET /v1/blogs\` — list posts (params: \`page\`, \`limit\`, \`category\`, \`tag\`, \`featured\`, \`status\`)
- \`GET /v1/blogs/:slug\` — single post by slug
- \`GET /api/v1/posts/:slug\` — **enhanced** (includes stats, features, branding, share links, related posts)

### Response shape (list)
\`\`\`json
{
  "success": true,
  "data": [{
    "slug": "my-post",
    "title": "My Post Title",
    "excerpt": "Short summary shown on cards",
    "image": "https://...",
    "category": "General",
    "tags": ["typescript", "react"],
    "author": "Admin",
    "featured": false,
    "reading_time": 4,
    "views": 142,
    "published_at": "2025-01-15T10:00:00Z"
  }],
  "meta": { "page": 1, "limit": 10, "total": 45, "totalPages": 5 }
}
\`\`\`

### Pages to build:
1. **Blog index** (\`/blog\`) — paginated grid of post cards with category filter sidebar
2. **Blog post** (\`/blog/:slug\`) — full post with Tiptap-rendered HTML content, cover image, author, date, tags
3. **Category page** (\`/blog/category/:category\`) — filtered posts for one category
4. **Tag page** (\`/blog/tag/:tag\`) — filtered posts for one tag

### Featured posts section (homepage)
\`\`\`typescript
const featured = await cmsClient.listBlogs({ featured: true, limit: 3 });
// Render as a hero section with large card + 2 secondary cards
\`\`\`

### Post card component
Each post card shows: cover image (aspect-video), category badge, title (2-line clamp), excerpt (3-line clamp), author avatar + name, date, reading time, view count.`);
  }

  if (kinds.includes("faq")) {
    sections.push(`## FAQ

### API Endpoints
- \`GET /v1/faqs\` — list FAQs (params: \`page\`, \`limit\`, \`category\`, \`status\`)
- \`GET /v1/faqs/:id\` — single FAQ

### Response shape
\`\`\`json
{
  "success": true,
  "data": [{
    "id": "uuid",
    "question": "How do I reset my password?",
    "answer": "<p>Click Forgot Password on the login page…</p>",
    "category": "Account",
    "order": 1,
    "published_at": "2025-01-10T10:00:00Z"
  }]
}
\`\`\`

### Pages to build:
1. **FAQ page** (\`/faq\`) — all FAQs in an accordion, grouped by category
2. **Category tabs** — tab bar across the top to filter by category
3. **Search box** — client-side search using \`GET /v1/search?q=...\`

### Accordion component
\`\`\`typescript
// Group FAQs by category, render each group with a section heading
const byCategory = faqs.reduce((acc, faq) => {
  const cat = faq.category ?? "General";
  acc[cat] = [...(acc[cat] ?? []), faq];
  return acc;
}, {} as Record<string, typeof faqs>);
// Render answer as HTML: <div dangerouslySetInnerHTML={{ __html: faq.answer }} />
\`\`\``);
  }

  if (kinds.includes("articles")) {
    sections.push(`## Articles

### API Endpoints
- \`GET /v1/articles\` — list articles (params: \`page\`, \`limit\`, \`status\`, \`category\`)
- \`GET /v1/articles/:slug\` — single article

### Response shape
\`\`\`json
{
  "success": true,
  "data": [{
    "slug": "deep-dive-into-typescript",
    "title": "A Deep Dive Into TypeScript Generics",
    "excerpt": "...",
    "content": "<p>Full HTML content...</p>",
    "cover_image": "https://...",
    "category": "Engineering",
    "author": "Jane Smith",
    "tags": ["typescript"],
    "reading_time": 8,
    "published_at": "2025-02-01T09:00:00Z"
  }]
}
\`\`\`

### Pages to build:
1. **Articles index** (\`/articles\`) — magazine-style grid with featured article hero
2. **Article detail** (\`/articles/:slug\`) — long-form layout with sticky TOC sidebar
3. Table of contents generated from \`<h2>\` and \`<h3>\` tags in content HTML`);
  }

  if (kinds.includes("products")) {
    sections.push(`## Products

### API Endpoints
- \`GET /v1/products\` — list products (params: \`page\`, \`limit\`, \`category\`, \`status\`)
- \`GET /v1/products/:slug\` — single product

### Response shape
\`\`\`json
{
  "success": true,
  "data": [{
    "slug": "my-product",
    "name": "Product Name",
    "description": "<p>Full HTML description</p>",
    "short_description": "Brief summary",
    "price": 29.99,
    "currency": "USD",
    "images": ["https://...", "https://..."],
    "category": "Software",
    "tags": ["saas", "productivity"],
    "status": "published",
    "published_at": "2025-01-05T10:00:00Z"
  }]
}
\`\`\`

### Pages to build:
1. **Products catalog** (\`/products\`) — grid with category filter, price sort
2. **Product detail** (\`/products/:slug\`) — image gallery, description, pricing, CTA button
3. **Category sidebar** — filter products by category using \`GET /v1/categories\`

### Price formatting helper
\`\`\`typescript
const formatPrice = (price: number, currency: string) =>
  new Intl.NumberFormat("en-US", { style: "currency", currency }).format(price);
\`\`\``);
  }

  if (kinds.includes("news")) {
    sections.push(`## News / Press

### API Endpoints
- \`GET /v1/news\` — list news items (params: \`page\`, \`limit\`, \`status\`, \`category\`)
- \`GET /v1/news/:slug\` — single news item

### Response shape
\`\`\`json
{
  "success": true,
  "data": [{
    "slug": "company-raises-series-a",
    "title": "Company Raises $10M Series A",
    "excerpt": "Funding will accelerate product expansion...",
    "content": "<p>Full article HTML...</p>",
    "cover_image": "https://...",
    "category": "Company News",
    "author": "Press Team",
    "published_at": "2025-03-01T14:00:00Z"
  }]
}
\`\`\`

### Pages to build:
1. **News feed** (\`/news\`) — reverse-chronological list with date separators
2. **News article** (\`/news/:slug\`) — clean reading view with publication date and author
3. **Breaking news banner** — show latest news item as a dismissible top banner
4. **Press kit page** — list \`category: "Press Release"\` items with download links`);
  }

  return sections.join("\n\n---\n\n");
}

function buildPrompt(
  contentKinds: ContentKind[],
  vibeTool: VibeToolId,
  framework: FrameworkId,
  siteName: string,
): string {
  const siteLabel = siteName.trim() || "My Site";
  const toolLabel = VIBE_TOOLS.find(t => t.id === vibeTool)?.label ?? "your AI tool";
  const fwLabel   = FRAMEWORKS.find(f => f.id === framework)?.label ?? "your framework";
  const includesEngagement = contentKinds.includes("engagement");

  const preamble = vibeTool === "bolt" || vibeTool === "lovable"
    ? `You are an expert ${fwLabel} developer. Build a complete, production-ready website using Lunar CMS as the headless CMS backend. Do not ask clarifying questions — implement everything described below exactly as specified.`
    : vibeTool === "cursor" || vibeTool === "windsurf" || vibeTool === "claudecode"
    ? `Implement the following Lunar CMS integration exactly as described. Create all files, install no extra packages beyond what's listed, and follow the code examples precisely.`
    : `Build this website using the specifications below. Follow every instruction completely.`;

  const contentSection = getContentSections(contentKinds.filter(k => k !== "engagement"));
  const clientSection  = getClientSection(framework);
  const engSection     = includesEngagement
    ? getEngagementProxySection(framework) + getEngagementComponents()
    : "";

  const structureNote = vibeTool === "bolt" || vibeTool === "lovable"
    ? `\n\n## Project Setup\nInitialise a new ${fwLabel} project (TypeScript). Install: \`clsx\`, \`tailwind-merge\`. Use Tailwind CSS for all styling.`
    : "";

  return `# Lunar CMS Integration — ${siteLabel}
## Target tool: ${toolLabel} | Framework: ${fwLabel}

---

${preamble}

---

## Overview

Build a **${siteLabel}** website that fetches all content from the **Lunar CMS API**. The site displays: ${contentKinds.map(k => CONTENT_OPTIONS.find(c => c.id === k)?.label).join(", ")}.

The site name is **${siteLabel}**. Use this name in:
- Navbar/header logo
- Footer copyright: "© ${new Date().getFullYear()} ${siteLabel}"
- \`<title>\` tags: e.g. "Post Title — ${siteLabel}"
- README.md

---

## Environment Variables

\`\`\`env
${getEnvBlock(framework)}
\`\`\`

> ⚠️ Add \`.env.local\` (or \`.env\`) to \`.gitignore\`. Never hardcode or expose the API key.
${structureNote}

---

## Authentication

Every API request must include:
\`\`\`
Authorization: Bearer pk_live_your_api_key_here
\`\`\`

API keys are workspace-scoped — you never need to send a workspace ID in the URL.

---

${clientSection}

---

${contentSection}

---
${engSection}

## Error Handling

| Status | Meaning | Action |
|--------|---------|--------|
| 401 | Invalid API key | Check Authorization header — must be \`Bearer pk_live_...\` (space after Bearer) |
| 403 | Forbidden | Confirm the key has the required permission scopes |
| 404 | Not found | Verify the slug/endpoint spelling |
| 429 | Rate limited | Implement exponential backoff (2^n seconds, max 32s) |
| 500 | Server error | Retry after a short delay |

**Empty data array?** Check that the workspace has published content and the API key belongs to the correct workspace.

**CORS errors?** The Lunar CMS content API allows all origins (\`Access-Control-Allow-Origin: *\`). A CORS error usually means the base URL is wrong.

---

## Checklist — do not ship without these

- [ ] \`.env.local\` / \`.env\` added to \`.gitignore\`
- [ ] API key never appears in client-side JavaScript bundle
- [ ] All pages have proper \`<title>\` and \`<meta name="description">\` tags
- [ ] Loading states (skeleton / spinner) on every fetch
- [ ] Error boundary or fallback UI for failed API calls
- [ ] Pagination on listing pages
- [ ] Mobile responsive layout
${includesEngagement ? "- [ ] Engagement proxy running and tested\n- [ ] `X-Visitor-Id` persisted in localStorage\n- [ ] `<PoweredByBanner>` rendered on every post page" : ""}

---

## Site Structure

Generate the following pages and components:

${contentKinds.filter(k => k !== "engagement").map(k => {
  switch (k) {
    case "blog":     return "- `/` — homepage with featured posts hero\n- `/blog` — paginated blog index\n- `/blog/:slug` — single post page\n- `/blog/category/:category` — category filter page";
    case "faq":      return "- `/faq` — accordion FAQ page with category tabs and search";
    case "articles": return "- `/articles` — magazine-style article index\n- `/articles/:slug` — full article with sticky TOC";
    case "products": return "- `/products` — product catalog with category filter\n- `/products/:slug` — product detail with image gallery";
    case "news":     return "- `/news` — news feed\n- `/news/:slug` — news article\n- Breaking news banner component";
    default: return "";
  }
}).join("\n")}
- Shared: \`<Navbar>\`, \`<Footer>\`, \`<SEOHead>\`, \`<Pagination>\`, \`<SkeletonCard>\`

---

*Generated by Lunar CMS Prompt Builder*`;
}

// ── Step components ────────────────────────────────────────────────────────────

function StepIndicator({ current, total }: { current: number; total: number }) {
  return (
    <div className="flex items-center gap-1.5">
      {Array.from({ length: total }).map((_, i) => (
        <div
          key={i}
          className={cn(
            "h-1.5 rounded-full transition-all",
            i < current ? "bg-primary w-6" : i === current ? "bg-primary w-4" : "bg-muted w-2",
          )}
        />
      ))}
    </div>
  );
}

// ── Main component ─────────────────────────────────────────────────────────────

export function PromptBuilder() {
  const [step, setStep] = useState(0);
  const [selectedKinds, setSelectedKinds] = useState<ContentKind[]>([]);
  const [selectedTool,  setSelectedTool]  = useState<VibeToolId | null>(null);
  const [selectedFw,    setSelectedFw]    = useState<FrameworkId | null>(null);
  const [siteName,      setSiteName]      = useState("");
  const [generated,     setGenerated]     = useState<string | null>(null);
  const [copied,        setCopied]        = useState(false);

  const TOTAL_STEPS = 4;

  function toggleKind(k: ContentKind) {
    setSelectedKinds(prev =>
      prev.includes(k) ? prev.filter(x => x !== k) : [...prev, k]
    );
  }

  function handleGenerate() {
    if (!selectedKinds.length || !selectedTool || !selectedFw) return;
    const prompt = buildPrompt(selectedKinds, selectedTool, selectedFw, siteName);
    setGenerated(prompt);
    setStep(4);
  }

  function handleCopy() {
    if (!generated) return;
    navigator.clipboard.writeText(generated).then(() => {
      setCopied(true);
      toast.success("Prompt copied — paste it into your vibe coding tool!");
      setTimeout(() => setCopied(false), 2500);
    });
  }

  function resetWizard() {
    setStep(0);
    setSelectedKinds([]);
    setSelectedTool(null);
    setSelectedFw(null);
    setSiteName("");
    setGenerated(null);
  }

  // Step 0 — content types
  if (step === 0) {
    return (
      <div className="space-y-6">
        <div className="space-y-1">
          <StepIndicator current={0} total={TOTAL_STEPS} />
          <h2 className="text-lg font-semibold mt-3">What are you building?</h2>
          <p className="text-sm text-muted-foreground">Select all content types your site will display. Your generated prompt will cover every one of them.</p>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          {CONTENT_OPTIONS.map((opt) => {
            const Icon = opt.icon;
            const selected = selectedKinds.includes(opt.id);
            return (
              <button
                key={opt.id}
                type="button"
                onClick={() => toggleKind(opt.id)}
                className={cn(
                  "flex items-start gap-3 rounded-xl border p-4 text-left transition-all",
                  selected
                    ? "border-primary bg-primary/5 shadow-sm"
                    : "border-border hover:border-primary/30 hover:bg-muted/30",
                )}
              >
                <Icon className={cn("h-5 w-5 mt-0.5 shrink-0", selected ? "text-primary" : opt.color)} />
                <div>
                  <p className={cn("text-sm font-semibold", selected && "text-primary")}>{opt.label}</p>
                  <p className="text-xs text-muted-foreground mt-0.5">{opt.description}</p>
                </div>
                {selected && (
                  <div className="ml-auto shrink-0 h-4 w-4 rounded-full bg-primary flex items-center justify-center">
                    <span className="text-[10px] text-primary-foreground font-bold">✓</span>
                  </div>
                )}
              </button>
            );
          })}
        </div>

        {selectedKinds.length > 0 && (
          <div className="flex flex-wrap gap-1.5">
            {selectedKinds.map(k => (
              <Badge key={k} variant="secondary" className="gap-1">
                {CONTENT_OPTIONS.find(o => o.id === k)?.label}
              </Badge>
            ))}
          </div>
        )}

        <Button
          onClick={() => setStep(1)}
          disabled={selectedKinds.length === 0}
          className="gap-2"
        >
          Continue <ChevronRight className="h-4 w-4" />
        </Button>
      </div>
    );
  }

  // Step 1 — vibe coding tool
  if (step === 1) {
    return (
      <div className="space-y-6">
        <div className="space-y-1">
          <StepIndicator current={1} total={TOTAL_STEPS} />
          <h2 className="text-lg font-semibold mt-3">Which AI tool will you use?</h2>
          <p className="text-sm text-muted-foreground">The prompt is tailored to give the best instructions for each tool.</p>
        </div>

        <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
          {VIBE_TOOLS.map((tool) => {
            const selected = selectedTool === tool.id;
            return (
              <button
                key={tool.id}
                type="button"
                onClick={() => setSelectedTool(tool.id)}
                className={cn(
                  "flex items-center gap-2 rounded-xl border p-3.5 text-sm font-medium transition-all",
                  selected
                    ? "border-primary bg-primary/5 text-primary shadow-sm"
                    : "border-border hover:border-primary/30",
                )}
              >
                <span className="text-base">{tool.icon}</span>
                <span>{tool.label}</span>
              </button>
            );
          })}
        </div>

        <div className="flex gap-2">
          <Button variant="outline" onClick={() => setStep(0)} className="gap-2">
            <ChevronLeft className="h-4 w-4" /> Back
          </Button>
          <Button onClick={() => setStep(2)} disabled={!selectedTool} className="gap-2">
            Continue <ChevronRight className="h-4 w-4" />
          </Button>
        </div>
      </div>
    );
  }

  // Step 2 — framework
  if (step === 2) {
    return (
      <div className="space-y-6">
        <div className="space-y-1">
          <StepIndicator current={2} total={TOTAL_STEPS} />
          <h2 className="text-lg font-semibold mt-3">What framework?</h2>
          <p className="text-sm text-muted-foreground">The generated code examples and proxy routes will match your framework exactly.</p>
        </div>

        <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
          {FRAMEWORKS.map((fw) => {
            const selected = selectedFw === fw.id;
            return (
              <button
                key={fw.id}
                type="button"
                onClick={() => setSelectedFw(fw.id)}
                className={cn(
                  "flex items-center gap-2 rounded-xl border p-3.5 text-sm font-medium transition-all",
                  selected
                    ? "border-primary bg-primary/5 text-primary shadow-sm"
                    : "border-border hover:border-primary/30",
                )}
              >
                <span className="text-base">{fw.icon}</span>
                <span>{fw.label}</span>
              </button>
            );
          })}
        </div>

        <div className="flex gap-2">
          <Button variant="outline" onClick={() => setStep(1)} className="gap-2">
            <ChevronLeft className="h-4 w-4" /> Back
          </Button>
          <Button onClick={() => setStep(3)} disabled={!selectedFw} className="gap-2">
            Continue <ChevronRight className="h-4 w-4" />
          </Button>
        </div>
      </div>
    );
  }

  // Step 3 — site name + generate
  if (step === 3) {
    return (
      <div className="space-y-6">
        <div className="space-y-1">
          <StepIndicator current={3} total={TOTAL_STEPS} />
          <h2 className="text-lg font-semibold mt-3">What's your site name?</h2>
          <p className="text-sm text-muted-foreground">Used in the navbar, footer, page titles, and README. You can change it later.</p>
        </div>

        <Input
          value={siteName}
          onChange={(e) => setSiteName(e.target.value)}
          placeholder="e.g. TechBlog, My Company, The Daily Digest…"
          className="text-base"
          onKeyDown={(e) => { if (e.key === "Enter" && siteName.trim()) handleGenerate(); }}
        />

        <div className="rounded-xl border border-border bg-muted/20 p-4 space-y-2">
          <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">Your prompt will cover</p>
          <div className="flex flex-wrap gap-1.5">
            {selectedKinds.map(k => (
              <Badge key={k} variant="secondary">
                {CONTENT_OPTIONS.find(o => o.id === k)?.label}
              </Badge>
            ))}
            <Badge variant="outline">{VIBE_TOOLS.find(t => t.id === selectedTool)?.label}</Badge>
            <Badge variant="outline">{FRAMEWORKS.find(f => f.id === selectedFw)?.label}</Badge>
          </div>
        </div>

        <div className="flex gap-2">
          <Button variant="outline" onClick={() => setStep(2)} className="gap-2">
            <ChevronLeft className="h-4 w-4" /> Back
          </Button>
          <Button onClick={handleGenerate} className="gap-2 flex-1">
            <Sparkles className="h-4 w-4" />
            Generate prompt
          </Button>
        </div>
      </div>
    );
  }

  // Step 4 — result
  if (step === 4 && generated) {
    return (
      <div className="space-y-4">
        <div className="flex items-center justify-between">
          <div className="space-y-0.5">
            <p className="text-sm font-semibold">Your prompt is ready</p>
            <p className="text-xs text-muted-foreground">Copy and paste into {VIBE_TOOLS.find(t => t.id === selectedTool)?.label ?? "your AI tool"}</p>
          </div>
          <div className="flex gap-2">
            <Button variant="outline" size="sm" onClick={resetWizard} className="gap-1.5">
              Build another
            </Button>
            <Button size="sm" onClick={handleCopy} className="gap-1.5">
              {copied
                ? <><CheckCheck className="h-3.5 w-3.5 text-green-400" /> Copied!</>
                : <><Copy className="h-3.5 w-3.5" /> Copy prompt</>}
            </Button>
          </div>
        </div>

        <div className="rounded-xl border border-border bg-muted/10 overflow-hidden">
          <div className="flex items-center justify-between px-4 py-2 border-b border-border bg-muted/30">
            <div className="flex items-center gap-2">
              <Code2 className="h-3.5 w-3.5 text-muted-foreground" />
              <span className="text-xs text-muted-foreground font-mono">prompt.md</span>
            </div>
            <span className="text-[10px] text-muted-foreground">{generated.length.toLocaleString()} chars</span>
          </div>
          <pre className="p-4 text-xs leading-relaxed whitespace-pre-wrap font-mono text-foreground max-h-[500px] overflow-y-auto">
            {generated}
          </pre>
        </div>

        <Button onClick={handleCopy} className="w-full gap-2" size="lg">
          {copied
            ? <><CheckCheck className="h-4 w-4 text-green-400" /> Copied to clipboard!</>
            : <><Copy className="h-4 w-4" /> Copy prompt</>}
        </Button>
      </div>
    );
  }

  return null;
}

// ── Quick Action Cards ──────────────────────────────────────────────────────────

interface QuickActionCard {
  id: string;
  label: string;
  description: string;
  icon: React.ComponentType<{ className?: string }>;
  kinds: ContentKind[];
  framework: FrameworkId;
  tool: VibeToolId;
  siteName: string;
}

const QUICK_ACTIONS: QuickActionCard[] = [
  {
    id: "blog-nextjs-bolt",
    label: "Blog site with Bolt",
    description: "Full Next.js blog with pagination, categories, and post pages",
    icon: BookOpen,
    kinds: ["blog"],
    framework: "nextjs",
    tool: "bolt",
    siteName: "My Blog",
  },
  {
    id: "faq-react-cursor",
    label: "FAQ page with Cursor",
    description: "Accordion FAQ with category tabs and search — React",
    icon: HelpCircle,
    kinds: ["faq"],
    framework: "react",
    tool: "cursor",
    siteName: "Help Center",
  },
  {
    id: "full-site-lovable",
    label: "Full site with Lovable",
    description: "Blog + FAQs + News + Engagement, all in one prompt",
    icon: Globe,
    kinds: ["blog", "faq", "news", "engagement"],
    framework: "nextjs",
    tool: "lovable",
    siteName: "My Site",
  },
  {
    id: "products-nextjs-replit",
    label: "Product catalog — Replit",
    description: "Product listing and detail pages in Next.js",
    icon: ShoppingBag,
    kinds: ["products"],
    framework: "nextjs",
    tool: "replit",
    siteName: "My Store",
  },
  {
    id: "engagement-nextjs",
    label: "Add engagement to Next.js",
    description: "Likes, comments, shares, view tracking + Powered By banner",
    icon: Heart,
    kinds: ["engagement"],
    framework: "nextjs",
    tool: "cursor",
    siteName: "My Blog",
  },
  {
    id: "news-astro",
    label: "News feed — Astro",
    description: "Static news site with breaking news banner",
    icon: Newspaper,
    kinds: ["news"],
    framework: "astro",
    tool: "other",
    siteName: "The Daily",
  },
  {
    id: "all-content-vue",
    label: "All content — Vue + Nuxt",
    description: "Blog + Articles + Products + FAQs in a Nuxt app",
    icon: Layers,
    kinds: ["blog", "articles", "products", "faq"],
    framework: "nuxt",
    tool: "windsurf",
    siteName: "My Platform",
  },
  {
    id: "quick-bolt-start",
    label: "Quick start — Bolt",
    description: "Paste into Bolt to build a blog site in 60 seconds",
    icon: Zap,
    kinds: ["blog", "engagement"],
    framework: "react",
    tool: "bolt",
    siteName: "My Blog",
  },
];

export function QuickActionButtons({ onSelect }: { onSelect: (prompt: string, label: string) => void }) {
  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
      {QUICK_ACTIONS.map((action) => {
        const Icon = action.icon;
        return (
          <button
            key={action.id}
            type="button"
            onClick={() => {
              const prompt = buildPrompt(action.kinds, action.tool, action.framework, action.siteName);
              onSelect(prompt, action.label);
            }}
            className="flex items-start gap-3 rounded-xl border border-border p-4 text-left transition-all hover:border-primary/40 hover:bg-muted/30 group"
          >
            <div className="mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-muted group-hover:bg-primary/10 transition-colors">
              <Icon className="h-4 w-4 text-muted-foreground group-hover:text-primary transition-colors" />
            </div>
            <div className="min-w-0">
              <p className="text-sm font-semibold group-hover:text-primary transition-colors">{action.label}</p>
              <p className="text-xs text-muted-foreground mt-0.5 line-clamp-2">{action.description}</p>
              <div className="flex flex-wrap gap-1 mt-2">
                {action.kinds.map(k => (
                  <span key={k} className="inline-block rounded-full bg-muted px-2 py-0.5 text-[10px] text-muted-foreground">
                    {CONTENT_OPTIONS.find(o => o.id === k)?.label}
                  </span>
                ))}
              </div>
            </div>
          </button>
        );
      })}
    </div>
  );
}
