# REPLIT AGENT PROMPT — EXTERNAL DEMO BLOG (Lunar CMS Consumer)

## Overview

Build a fully functional **external blog website** that fetches all its content
from the **Lunar CMS REST API**. This site represents exactly how a real external
customer would integrate Lunar CMS into their own product.

The site must work as a standalone Replit project (separate from the CMS itself).

---

## What You Are Building

A clean, modern public-facing blog website with:

* A **homepage** showing the latest and featured blog posts
* A **blog listing page** with pagination, search, and category filtering
* A **single blog post page** with full content rendering
* A **categories page** showing all categories with post counts
* A **search page** with real-time results

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
LUNAR_API_URL=https://<project-ref>.supabase.co/functions/v1/content-router
```

Store them in `.env.local`.

The `LUNAR_API_KEY` is a Lunar CMS publishable key.
It is safe to use server-side only (in Server Components and Route Handlers).
Never expose it to the browser.

---

## API Reference

All requests must include:

```
Authorization: Bearer <LUNAR_API_KEY>
Content-Type: application/json
```

### Endpoints

#### List blogs
```
GET /blogs
  ?page=1
  &limit=20
  &category=Technology
  &tag=nextjs
  &search=keyword
  &featured=true
  &sort=published_at
  &order=desc
```

#### Single blog post
```
GET /blogs/:slug
```

#### Featured blogs
```
GET /blogs/featured?limit=6
```

#### Latest blogs
```
GET /blogs/latest?limit=10
```

#### Related blogs
```
GET /blogs/:slug/related?limit=4
```

#### Categories (with post counts)
```
GET /categories?sort=post_count&order=desc
```

#### Tags
```
GET /tags
```

#### Search
```
GET /search?q=keyword&page=1&limit=10
```

### Response format

All endpoints return:

```json
{
  "success": true,
  "data": [],
  "meta": {
    "page": 1,
    "limit": 20,
    "total": 42,
    "totalPages": 3
  },
  "links": {
    "first": "https://...?page=1",
    "previous": null,
    "next": "https://...?page=2",
    "last": "https://...?page=3"
  }
}
```

A blog summary (list view) contains:

```json
{
  "slug": "my-post",
  "title": "My Post Title",
  "excerpt": "Short description...",
  "image": "https://...supabase.co/storage/v1/object/public/...",
  "category": "Technology",
  "tags": ["nextjs", "react"],
  "author": "Jane Smith",
  "featured": true,
  "reading_time": 5,
  "views": 142,
  "published_at": "2025-01-15T10:00:00.000Z",
  "updated_at": "2025-01-16T08:30:00.000Z"
}
```

A blog detail (single post) additionally contains:

```json
{
  "content": "<full HTML or markdown content>",
  "seo_title": "SEO Page Title",
  "meta_description": "SEO meta description"
}
```

Error responses:

```json
{
  "success": false,
  "error": {
    "code": "NOT_FOUND",
    "message": "The requested resource was not found."
  }
}
```

---

## Project Structure

```
src/
  app/
    page.tsx                  — Homepage (featured + latest posts)
    blog/
      page.tsx                — Blog listing with pagination + filters
      [slug]/
        page.tsx              — Single post page
    categories/
      page.tsx                — All categories list
    search/
      page.tsx                — Search results
  lib/
    lunar.ts                  — API client (all fetch calls live here)
    types.ts                  — TypeScript interfaces
  components/
    PostCard.tsx              — Reusable blog post card
    PostGrid.tsx              — Grid of PostCards
    Pagination.tsx            — Pagination controls using links from API
    SearchBar.tsx             — Search input
    CategoryBadge.tsx         — Category pill/badge
    FeaturedPost.tsx          — Hero card for featured posts
    Navbar.tsx                — Site navigation
    Footer.tsx                — Site footer
```

---

## Detailed Requirements

### `src/lib/types.ts`

Define TypeScript interfaces matching the API response shapes:

* `BlogSummary`
* `BlogDetail extends BlogSummary`
* `Category`
* `Tag`
* `ApiResponse<T>`
* `PaginatedResponse<T>`

### `src/lib/lunar.ts`

Build a typed API client:

```typescript
export async function getFeaturedPosts(limit?: number): Promise<BlogSummary[]>
export async function getLatestPosts(limit?: number): Promise<BlogSummary[]>
export async function listPosts(params: ListPostsParams): Promise<PaginatedResponse<BlogSummary>>
export async function getPost(slug: string): Promise<BlogDetail | null>
export async function getRelatedPosts(slug: string, limit?: number): Promise<BlogSummary[]>
export async function listCategories(): Promise<Category[]>
export async function searchPosts(query: string, page?: number): Promise<PaginatedResponse<BlogSummary>>
```

Rules:
* All functions run server-side only (no `"use client"` directive).
* Use `fetch()` with `next: { revalidate: 300 }` for ISR (5-minute cache).
* On non-2xx responses, throw an error with the API error code and message.
* Never expose `LUNAR_API_KEY` to the client bundle.

### Homepage (`app/page.tsx`)

* Server Component
* Hero section with a large featured post (use `getFeaturedPosts(1)`)
* "Featured Posts" section showing up to 5 more featured posts
* "Latest Posts" section showing 6 latest posts
* Links to the blog listing page

### Blog Listing Page (`app/blog/page.tsx`)

* Server Component
* Accepts `searchParams`: `page`, `category`, `search`
* Shows posts in a responsive grid (3 columns desktop, 2 tablet, 1 mobile)
* Category filter buttons at the top (fetch from `/categories`)
* Search bar that submits to `?search=`
* Pagination at the bottom using the `links` from the API response
* Shows total post count: "Showing 1–20 of 42 posts"

### Single Post Page (`app/blog/[slug]/page.tsx`)

* Server Component
* Generate static params with `generateStaticParams` (fetch first page of posts)
* Full post content rendered — detect if it is HTML (`<p>`, `<h2>`, etc.) and use
  `dangerouslySetInnerHTML`, otherwise render as plain text with whitespace preserved
* Post metadata: category badge, tags, author, date, reading time, view count
* SEO: use `generateMetadata` with `seo_title` and `meta_description`
* "Related Posts" section at the bottom (call `getRelatedPosts`)
* Back link to the blog listing

### Categories Page (`app/categories/page.tsx`)

* Server Component
* Grid of category cards showing name and post count
* Each card links to `/blog?category=<name>`

### Search Page (`app/search/page.tsx`)

* Server Component
* Accepts `searchParams.q`
* If `q` is empty, show a search prompt
* Otherwise fetch results and display them as a grid
* Show "No results for 'keyword'" when empty

---

## Styling

* Use Tailwind CSS throughout
* Clean, minimal design — dark text on white backgrounds
* Post cards should show: cover image (with aspect-ratio 16/9), category badge,
  title, excerpt (2-line clamp), author, date, reading time
* The homepage hero should be visually distinct from the card grid
* Responsive at all breakpoints (mobile-first)
* Typography: use `font-serif` for post titles, `font-sans` for body
* Use `prose` class from `@tailwindcss/typography` for rendered post content

---

## Error Handling

* If `LUNAR_API_KEY` or `LUNAR_API_URL` are missing, throw a clear error at startup
* If a post is not found (404 from API), call Next.js `notFound()`
* If the API returns an error, show a user-friendly error UI — not a stack trace
* Wrap fetches in try/catch and fall back gracefully (empty array, etc.)

---

## README

Include a `README.md` with:

1. What this project is (external consumer of Lunar CMS)
2. How to get an API key (log in to Lunar CMS → API Keys → Create key)
3. The required environment variables
4. How to run locally (`npm run dev`)
5. Example API calls with `curl`

---

## Success Criteria

The site is complete when:

* The homepage loads and shows real posts from the CMS
* The blog listing page paginates correctly
* Clicking a post shows the full content
* Category filtering works
* Search returns real results
* No API key is visible in the browser bundle
* All pages are Server Components (no client-side data fetching)
* The site compiles and runs without TypeScript errors
* `npm run build` succeeds
