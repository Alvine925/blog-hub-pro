# REPLIT AGENT PROMPT — EXTERNAL DEMO BLOG (Lunar CMS Consumer)

## Overview

Build a fully functional **external blog website** that fetches all its content
and engagement data from the **Lunar CMS REST API**. This site represents exactly
how a real external customer would integrate Lunar CMS into their own product.

The site must work as a standalone Replit project (separate from the CMS itself).
The site name is **{{SITE_NAME}}** — use it throughout (page titles, nav, footer, meta tags).

---

## What You Are Building

A clean, modern public-facing blog website with:

* A **homepage** showing the latest and featured blog posts
* A **blog listing page** with pagination, search, and category filtering
* A **single blog post page** with full content, engagement bar (likes, comments, shares), comment thread, and related posts
* A **categories page** showing all categories with post counts
* A **search page** with real-time results
* An auto-injected **"Powered by Lunar CMS"** attribution banner (controlled by the CMS, not the site config)

All data comes exclusively from the Lunar CMS REST API.
There is no local database. There are no hardcoded posts.

---

## Tech Stack

Use **Next.js 14+ (App Router)** with:

* TypeScript
* Tailwind CSS
* `next/image` for optimised images
* `next/link` for navigation

Do not use any CMS SDK. Use plain `fetch()` calls against the REST API.

---

## Environment Variables

The user will provide:

```
LUNAR_API_KEY=pk_live_xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx
LUNAR_API_URL=https://<your-lunar-cms-deployment>.repl.co
```

Store them in `.env.local`.

The `LUNAR_API_KEY` is a Lunar CMS publishable key.
It is safe to use server-side only (in Server Components and Route Handlers).
Never expose it to the browser directly — for engagement write operations (likes, comments)
use a Next.js Route Handler as a proxy.

---

## API Reference

### Standard headers (server-side calls)

```
Authorization: Bearer <LUNAR_API_KEY>
Content-Type: application/json
```

### Visitor identity header (engagement calls)

All engagement API calls must include an `X-Visitor-Id` header.
Generate a UUID once per browser, persist in `localStorage`, and send it on every engagement request.

```ts
// lib/visitorId.ts  (client-only utility)
export function getVisitorId(): string {
  if (typeof window === "undefined") return "server";
  let id = localStorage.getItem("lunar_vid");
  if (!id) {
    id = crypto.randomUUID();
    localStorage.setItem("lunar_vid", id);
  }
  return id;
}
```

---

### Content Endpoints (server-side, with Authorization header)

#### List blog posts
```
GET /v1/blogs
  ?page=1 &limit=20 &category=Technology &tag=nextjs
  &search=keyword &featured=true &sort=published_at &order=desc
```

#### Single blog post (enhanced — includes engagement data)
```
GET /api/v1/posts/:slug
```
Returns:
```json
{
  "data": { "title": "...", "content": "...", "slug": "...", "...": "all blog fields" },
  "stats":    { "views": 142, "likes": 38, "comments": 12, "shares": 5 },
  "features": { "likes": true, "comments": true, "socialShare": true,
                "relatedPosts": true, "viewTracking": true, "poweredBy": true },
  "branding": { "enabled": true, "text": "Powered by Lunar CMS", "url": "https://..." },
  "share":    { "facebook": "https://...", "linkedin": "https://...",
                "x": "https://...", "whatsapp": "https://...", "email": "mailto:..." },
  "related":  [ { "slug": "...", "title": "...", "excerpt": "...", "cover_image": "...", "category": "..." } ]
}
```

#### Featured blogs
```
GET /v1/blogs/featured?limit=6
```

#### Latest blogs
```
GET /v1/blogs/latest?limit=10
```

#### Categories (with post counts)
```
GET /v1/categories?sort=post_count&order=desc
```

#### Tags
```
GET /v1/tags
```

#### Search
```
GET /v1/search?q=keyword&page=1&limit=10
```

---

### Engagement Endpoints (via Route Handler proxy — includes X-Visitor-Id)

**Important:** All engagement write endpoints must go through a Next.js Route Handler
(`app/api/engagement/[...path]/route.ts`) that injects the `Authorization` header server-side
and forwards the `X-Visitor-Id` from the client request.

#### View tracking (POST — fires automatically on every post page load)
```
POST /api/v1/posts/:slug/view
Body: { "referrer": "https://..." }
```

#### Likes
```
GET    /api/v1/posts/:slug/likes     → { data: { likes: 38, liked: true } }
POST   /api/v1/posts/:slug/likes     → like the post
DELETE /api/v1/posts/:slug/likes     → unlike the post
```

#### Comments
```
GET  /api/v1/posts/:slug/comments
  → { data: [{ id, author_name, author_website, content, created_at, replies: [...] }] }

POST /api/v1/posts/:slug/comments
  Body: { "name": "Jane", "email": "j@example.com", "content": "Great post!", "parent_id": null }
  → { data: { requiresApproval: true } } or { data: { id: "..." } }
```

#### Share tracking (optional — call after user clicks a share button)
```
POST /api/v1/posts/:slug/share
Body: { "channel": "x" }  // channel: facebook | linkedin | x | whatsapp | email
```

#### Post stats
```
GET /api/v1/posts/:slug/stats
→ { data: { views, likes, comments, shares }, features: {...}, branding: {...} }
```

#### Related posts
```
GET /api/v1/posts/:slug/related?limit=4
```

---

### Response format

All content endpoints return:
```json
{
  "success": true,
  "data": [],
  "meta": { "page": 1, "limit": 20, "total": 42, "totalPages": 3 }
}
```

Error responses:
```json
{
  "success": false,
  "error": { "code": "NOT_FOUND", "message": "The requested resource was not found." }
}
```

---

## Project Structure

```
src/
  app/
    page.tsx                        — Homepage (featured + latest posts)
    blog/
      page.tsx                      — Blog listing with pagination + filters
      [slug]/
        page.tsx                    — Single post page (Server Component)
        PostEngagement.tsx          — Client Component: likes, comments, share modal
    categories/
      page.tsx                      — All categories list
    search/
      page.tsx                      — Search results
    api/
      engagement/
        [...path]/
          route.ts                  — Proxy Route Handler for all engagement writes
  lib/
    lunar.ts                        — API client (server-side content calls)
    types.ts                        — TypeScript interfaces
    visitorId.ts                    — Client-side visitor UUID helper
  components/
    PostCard.tsx                    — Reusable blog post card
    PostGrid.tsx                    — Grid of PostCards
    Pagination.tsx                  — Pagination controls
    SearchBar.tsx                   — Search input
    CategoryBadge.tsx               — Category pill/badge
    FeaturedPost.tsx                — Hero card for featured posts
    Navbar.tsx                      — Site navigation (shows site name: {{SITE_NAME}})
    Footer.tsx                      — Site footer
    LikeButton.tsx                  — Like/unlike toggle button (Client Component)
    CommentThread.tsx               — Comment list + reply tree (Client Component)
    CommentForm.tsx                 — Submit comment / reply form (Client Component)
    ShareModal.tsx                  — Social share modal with share URL buttons (Client Component)
    PoweredByBanner.tsx             — "Powered by" attribution banner (auto-rendered)
    RelatedPosts.tsx                — Related posts grid
```

---

## Detailed Requirements

### `src/lib/types.ts`

Define TypeScript interfaces:

* `BlogSummary` — list view fields
* `BlogDetail extends BlogSummary` — plus `content`, `seo_title`, `meta_description`
* `EnhancedBlogDetail` — `BlogDetail` plus `stats`, `features`, `branding`, `share`, `related`
* `EngagementStats` — `{ views, likes, comments, shares }`
* `EngagementFeatures` — `{ likes, comments, socialShare, relatedPosts, viewTracking, poweredBy }`
* `BrandingConfig` — `{ enabled, text, url }`
* `ShareLinks` — `{ facebook, linkedin, x, whatsapp, email }`
* `Comment` — `{ id, author_name, author_website?, content, created_at, replies: Comment[] }`
* `Category`, `Tag`, `ApiResponse<T>`, `PaginatedResponse<T>`

### `src/lib/lunar.ts`

Server-side API client (no `"use client"`, never exposed to browser):

```typescript
const BASE = process.env.LUNAR_API_URL!;
const KEY  = process.env.LUNAR_API_KEY!;

function headers() {
  return { Authorization: `Bearer ${KEY}`, "Content-Type": "application/json" };
}

export async function getEnhancedPost(slug: string): Promise<EnhancedBlogDetail | null>
export async function getFeaturedPosts(limit?: number): Promise<BlogSummary[]>
export async function getLatestPosts(limit?: number): Promise<BlogSummary[]>
export async function listPosts(params: ListPostsParams): Promise<PaginatedResponse<BlogSummary>>
export async function listCategories(): Promise<Category[]>
export async function searchPosts(query: string, page?: number): Promise<PaginatedResponse<BlogSummary>>
```

Rules:
* Use `fetch()` with `next: { revalidate: 300 }` for ISR caching.
* Throw on non-2xx responses with the API's error message.

### `app/api/engagement/[...path]/route.ts` — Proxy Route Handler

This is the single server-side proxy for all engagement operations.
It injects the Authorization header so the API key never leaves the server.
Clients send `X-Visitor-Id`; this proxy forwards it along with Authorization.

```typescript
import { NextRequest, NextResponse } from "next/server";

const CMS = process.env.LUNAR_API_URL!;
const KEY = process.env.LUNAR_API_KEY!;

async function proxy(req: NextRequest, { params }: { params: { path: string[] } }) {
  const path    = params.path.join("/");
  const url     = `${CMS}/api/v1/${path}${req.nextUrl.search}`;
  const body    = req.method !== "GET" && req.method !== "DELETE"
    ? await req.text() : undefined;

  const upstream = await fetch(url, {
    method:  req.method,
    headers: {
      "Authorization":  `Bearer ${KEY}`,
      "Content-Type":   "application/json",
      "X-Visitor-Id":   req.headers.get("X-Visitor-Id") ?? "anonymous",
    },
    body,
  });

  const data = await upstream.json();
  return NextResponse.json(data, { status: upstream.status });
}

export const GET    = proxy;
export const POST   = proxy;
export const DELETE = proxy;
```

All client-side engagement components call `/api/engagement/posts/:slug/likes` etc.
(relative URL — no API key needed on the client).

---

### Homepage (`app/page.tsx`)

* Server Component
* Hero section with one featured post
* "Featured Posts" grid (up to 5 more)
* "Latest Posts" section (6 posts)
* Site name `{{SITE_NAME}}` in the `<h1>` or hero headline

### Blog Listing Page (`app/blog/page.tsx`)

* Server Component
* `searchParams`: `page`, `category`, `search`
* Category filter bar (fetch from `/v1/categories`)
* Search bar
* 3-column desktop, 2 tablet, 1 mobile grid
* Pagination from `meta`

### Single Post Page (`app/blog/[slug]/page.tsx`)

* Server Component — call `getEnhancedPost(slug)` (one API call returns everything)
* Full content rendered — detect HTML (`<p>`, `<h2>`) and use `dangerouslySetInnerHTML`
* Post metadata: category, tags, author, date, reading time
* SEO with `generateMetadata` using `seo_title`, `meta_description`, Open Graph
* **Below the content, mount `<PostEngagement slug={slug} initialData={post} />`** — this is a Client Component that handles all interactive engagement UI
* At the very bottom: `<PoweredByBanner branding={post.branding} />`

### `components/PostEngagement.tsx` — Client Component

This is the single Client Component that handles all engagement for a post.
It receives `initialData` (from the server fetch) so there is no layout shift.

**Structure (tabbed or stacked):**

```
┌─────────────────────────────────────────────────────┐
│  👁 142 views  ·  ♥ 38 likes  ·  💬 12 comments  ·  ↗ Share  │
├─────────────────────────────────────────────────────┤
│  [Like button]   [Share button → opens ShareModal]  │
├────────────────┬────────────────────────────────────┤
│   Comments     │   (tab or section below)           │
└────────────────┴────────────────────────────────────┘
```

**Behaviour:**

1. **View tracking** — fire `POST /api/engagement/posts/:slug/view` once on mount (useEffect, runs once)
   ```ts
   useEffect(() => {
     fetch(`/api/engagement/posts/${slug}/view`, {
       method: "POST",
       headers: { "X-Visitor-Id": getVisitorId(), "Content-Type": "application/json" },
       body: JSON.stringify({ referrer: document.referrer }),
     });
   }, []);
   ```

2. **Like button**
   - Initial state from `initialData.stats.likes` and a separate client fetch for `liked` status
   - `GET /api/engagement/posts/:slug/likes` → `{ likes, liked }`
   - On click: `POST` (to like) or `DELETE` (to unlike) to same URL
   - Optimistic UI — update count and state instantly, revert on error
   - Show heart icon: filled (rose) when liked, outlined when not

3. **Share button → ShareModal**
   - Button opens a modal overlay
   - Modal shows share links from `initialData.share`:
     - Facebook, LinkedIn, X (Twitter), WhatsApp, Email — each as an icon + labelled button
     - "Copy link" button copies `window.location.href`
   - On each share button click: open URL in new tab + call `POST /api/engagement/posts/:slug/share` with `{ channel: "facebook" }` etc.
   - Modal closes on backdrop click or Escape key

4. **Comments section**
   - Load comments: `GET /api/engagement/posts/:slug/comments` (includes threaded replies)
   - Render as a threaded list: each comment shows `author_name`, formatted date, content
   - Replies are indented under parent comments
   - "Reply" button on each comment sets the `parentId` for the submit form
   - **CommentForm**: name (required), email (required, not displayed), website (optional), message (required)
   - On submit: `POST /api/engagement/posts/:slug/comments`
   - If response contains `requiresApproval: true`, show: *"Your comment is awaiting moderation — thank you!"*
   - Otherwise show the new comment inline immediately
   - Show comment count in the tab/section header

**Only show sections that are enabled in `initialData.features`:**
```ts
if (!features.likes) // hide like button
if (!features.comments) // hide comments section
if (!features.socialShare) // hide share button
```

### `components/ShareModal.tsx`

```tsx
// Props: isOpen, onClose, shareLinks: ShareLinks, slug: string
// Backdrop: fixed inset-0 bg-black/50 z-50
// Modal: centered card with X close button
// Buttons: Facebook (blue), LinkedIn (blue), X (black), WhatsApp (green), Email (gray)
// "Copy link" button with clipboard icon — shows "Copied!" for 2 seconds after click
```

### `components/LikeButton.tsx`

```tsx
// Props: slug, initialLikes, initialLiked
// Shows: ♥ [count] — filled rose when liked, outlined when not
// On click: optimistic update then API call
// Disabled state while request in flight
```

### `components/CommentThread.tsx`

```tsx
// Props: comments: Comment[], slug: string, onNewComment: (c: Comment) => void
// Renders threaded comments recursively
// "Reply" button sets active parentId in parent state
```

### `components/PoweredByBanner.tsx` — AUTO-RENDERED, NO CONFIGURATION NEEDED

```tsx
// Props: branding: BrandingConfig
// If branding.enabled is false, render null (nothing shown)
// If branding.enabled is true:
//   Render a small fixed or static footer-level banner:
//   "<branding.text>" linking to "<branding.url>"
//   Suggested: sticky bottom bar, small text, subtle styling
//   Example: "Powered by Lunar CMS" → links to the CMS URL

export function PoweredByBanner({ branding }: { branding: BrandingConfig }) {
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
```

**This component is always included in every blog post page.**
The `branding.enabled` flag in the API response controls whether it renders.
The site owner never needs to configure anything — the CMS admin controls it from the dashboard.

### `components/RelatedPosts.tsx`

```tsx
// Props: posts: BlogSummary[], heading?: string
// Only render if features.relatedPosts is true and posts.length > 0
// Show up to 3 posts in a grid (title, excerpt, category, cover image)
```

---

## Styling

* Tailwind CSS throughout
* Clean, minimal, dark-text-on-white design
* Post cards: cover image (16/9), category badge, title, excerpt (2-line clamp), author, date, reading time
* Stats bar on post page: subtle row of icon+number for views, likes, comments
* Share modal: clean overlay with platform-coloured buttons
* Comment thread: left-border indent for replies, soft backgrounds per level
* PoweredByBanner: pill in bottom-right corner, semi-transparent dark background
* `prose` class from `@tailwindcss/typography` for rendered post content

---

## Error Handling

* Missing env vars → throw at startup
* 404 from API → `notFound()`
* Non-2xx → user-friendly error UI
* Failed engagement calls → silent fail (don't block content display)
* Comment submission failure → show inline error message, keep form data

---

## README

Include `README.md` with:

1. What this project is — external blog powered by Lunar CMS
2. Site name: **{{SITE_NAME}}**
3. How to get an API key from Lunar CMS dashboard
4. Required environment variables
5. How to run locally (`npm run dev`)
6. How engagement features work (automatic — no extra config)

---

## Success Criteria

- [ ] Homepage loads real posts from Lunar CMS
- [ ] Blog listing paginates and filters correctly
- [ ] Single post shows full content
- [ ] View is tracked automatically on post page load (no user action needed)
- [ ] Like button toggles correctly with optimistic UI
- [ ] Share modal opens and share links work
- [ ] Share clicks are tracked via the API
- [ ] Comments load in threaded view
- [ ] Comment submission shows confirmation or moderation message
- [ ] "Powered by Lunar CMS" banner appears automatically when `branding.enabled` is true
- [ ] Banner is invisible when `branding.enabled` is false
- [ ] Related posts appear at the bottom of each post
- [ ] All feature flags from `features.*` are respected
- [ ] No API key visible in client-side bundles
- [ ] `npm run build` succeeds with no TypeScript errors
- [ ] Site name `{{SITE_NAME}}` appears in navbar and page titles
