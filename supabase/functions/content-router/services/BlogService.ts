/**
 * BlogService.ts — queries blog_posts for the content-router.
 *
 * All queries are workspace-scoped, published-only by default.
 * Secret keys may pass status="draft" | "scheduled" to see unpublished content.
 */
import { getDb } from "../db.ts";
import { toBlogSummary, toBlogDetail, type PublicBlogSummary, type PublicBlogDetail } from "../ContentTransformer.ts";

// Whitelisted sort columns
const SORT_COLS = new Set(["created_at", "updated_at", "published_at", "title", "views"]);

export interface BlogListParams {
  page:      number;
  limit:     number;
  sort:      string;
  order:     "asc" | "desc";
  search?:   string;
  category?: string;
  tag?:      string;
  author?:   string;
  featured?: boolean;
  from?:     string;
  to?:       string;
  /** Only honoured when keyType === "secret" */
  status?:   string;
  keyType:   "publishable" | "secret";
}

export interface BlogListResult {
  rows:  PublicBlogSummary[];
  total: number;
}

const BLOG_SUMMARY_COLS =
  "slug, title, excerpt, cover_image, category, tags, author_name, featured, reading_time, views, published_at, updated_at";

const BLOG_DETAIL_COLS =
  BLOG_SUMMARY_COLS + ", content, seo_title, meta_description";

export async function listBlogs(
  workspaceId: string,
  params: BlogListParams,
): Promise<BlogListResult> {
  const db = getDb();
  const sort = SORT_COLS.has(params.sort) ? params.sort : "published_at";
  const order = params.order === "asc" ? true : false;
  const offset = (params.page - 1) * params.limit;

  let query = db
    .from("blog_posts")
    .select(BLOG_SUMMARY_COLS, { count: "exact" })
    .eq("workspace_id", workspaceId)
    .order(sort, { ascending: order })
    .range(offset, offset + params.limit - 1);

  // Status: publishable keys always see only published
  if (params.keyType === "secret" && params.status && ["draft", "published", "scheduled"].includes(params.status)) {
    query = query.eq("status", params.status);
  } else {
    query = query.eq("status", "published");
  }

  if (params.category) query = query.ilike("category", params.category);
  if (params.author)   query = query.ilike("author_name", `%${params.author}%`);
  if (params.featured !== undefined) query = query.eq("featured", params.featured);
  if (params.from)     query = query.gte("published_at", params.from);
  if (params.to)       query = query.lte("published_at", params.to);

  // Tag filter: JSONB array contains (pass native array, not JSON string)
  if (params.tag) {
    query = query.contains("tags", [params.tag]);
  }

  // Full-text search: match against title + excerpt
  if (params.search) {
    const term = params.search.replace(/[%_\\]/g, "").slice(0, 200);
    query = query.or(`title.ilike.%${term}%,excerpt.ilike.%${term}%`);
  }

  const { data, count, error } = await query;
  if (error) throw new Error(error.message);

  return {
    rows:  (data ?? []).map((r) => toBlogSummary(r as Record<string, unknown>)),
    total: count ?? 0,
  };
}

export async function getBlogBySlug(
  workspaceId: string,
  slug: string,
  keyType: "publishable" | "secret",
): Promise<PublicBlogDetail | null> {
  const db = getDb();

  let query = db
    .from("blog_posts")
    .select(BLOG_DETAIL_COLS)
    .eq("workspace_id", workspaceId)
    .eq("slug", slug);

  if (keyType === "publishable") {
    query = query.eq("status", "published");
  }

  const { data, error } = await query.maybeSingle();
  if (error) throw new Error(error.message);
  if (!data) return null;

  // Increment view count fire-and-forget (workspace-scoped to avoid cross-tenant mutation)
  getDb()
    .from("blog_posts")
    .update({ views: (Number((data as Record<string, unknown>).views) || 0) + 1 })
    .eq("slug", slug)
    .eq("workspace_id", workspaceId)
    .then(() => {})
    .catch(() => {});

  return toBlogDetail(data as Record<string, unknown>);
}

export async function getRelatedBlogs(
  workspaceId: string,
  slug: string,
  limit: number,
): Promise<PublicBlogSummary[]> {
  const db = getDb();

  // Get the source post to extract category + tags
  const { data: source } = await db
    .from("blog_posts")
    .select("category, tags")
    .eq("workspace_id", workspaceId)
    .eq("slug", slug)
    .maybeSingle();

  if (!source) return [];

  const category = (source as Record<string, unknown>).category as string;
  const tags     = (source as Record<string, unknown>).tags;
  const tagList  = Array.isArray(tags) ? (tags as string[]) : [];

  // Find published posts in same category, excluding the source
  let query = db
    .from("blog_posts")
    .select(BLOG_SUMMARY_COLS)
    .eq("workspace_id", workspaceId)
    .eq("status", "published")
    .neq("slug", slug)
    .order("published_at", { ascending: false })
    .limit(limit);

  if (category) {
    query = query.eq("category", category);
  }

  const { data: byCat } = await query;
  const results = (byCat ?? []).map((r) => toBlogSummary(r as Record<string, unknown>));

  // If not enough, fill from tag matches
  if (results.length < limit && tagList.length > 0) {
    const seenSlugs = new Set([slug, ...results.map((r) => r.slug)]);
    const { data: byTag } = await db
      .from("blog_posts")
      .select(BLOG_SUMMARY_COLS)
      .eq("workspace_id", workspaceId)
      .eq("status", "published")
      .neq("slug", slug)
      .contains("tags", JSON.stringify([tagList[0]]))
      .order("published_at", { ascending: false })
      .limit(limit);

    for (const row of byTag ?? []) {
      const t = toBlogSummary(row as Record<string, unknown>);
      if (!seenSlugs.has(t.slug)) {
        results.push(t);
        seenSlugs.add(t.slug);
        if (results.length >= limit) break;
      }
    }
  }

  return results.slice(0, limit);
}

export async function getFeaturedBlogs(
  workspaceId: string,
  limit: number,
): Promise<PublicBlogSummary[]> {
  const db = getDb();
  const { data, error } = await db
    .from("blog_posts")
    .select(BLOG_SUMMARY_COLS)
    .eq("workspace_id", workspaceId)
    .eq("status", "published")
    .eq("featured", true)
    .order("published_at", { ascending: false })
    .limit(limit);

  if (error) throw new Error(error.message);
  return (data ?? []).map((r) => toBlogSummary(r as Record<string, unknown>));
}

export async function getLatestBlogs(
  workspaceId: string,
  limit: number,
): Promise<PublicBlogSummary[]> {
  const db = getDb();
  const { data, error } = await db
    .from("blog_posts")
    .select(BLOG_SUMMARY_COLS)
    .eq("workspace_id", workspaceId)
    .eq("status", "published")
    .order("published_at", { ascending: false })
    .limit(limit);

  if (error) throw new Error(error.message);
  return (data ?? []).map((r) => toBlogSummary(r as Record<string, unknown>));
}
