/**
 * BlogService.ts — queries blog_posts for the content-router.
 *
 * All queries are workspace-scoped, published-only by default.
 * Secret keys may pass status="draft" | "scheduled" to see unpublished content.
 */
import { getDb } from "../db.ts";
import { toBlogSummary, toBlogDetail, type PublicBlogSummary, type PublicBlogDetail } from "../ContentTransformer.ts";

// ── Word count ────────────────────────────────────────────────────────────────

function countWords(html: string): number {
  const text = html.replace(/<[^>]*>/g, "").trim();
  return text ? text.split(/\s+/).length : 0;
}

// ── Social share URL builder ──────────────────────────────────────────────────

function buildShareUrls(
  slug: string,
  title: string,
  excerpt: string,
): Record<string, string> {
  // We use a relative post path; external sites prepend their own domain.
  const postPath = `/blog/${slug}`;
  const u = encodeURIComponent(postPath);
  const t = encodeURIComponent(title);
  const e = encodeURIComponent((excerpt ?? "").slice(0, 200));
  return {
    facebook: `https://www.facebook.com/sharer/sharer.php?u=${u}`,
    linkedin:  `https://www.linkedin.com/shareArticle?mini=true&url=${u}&title=${t}`,
    x:         `https://x.com/intent/tweet?url=${u}&text=${t}`,
    whatsapp:  `https://wa.me/?text=${t}%20${u}`,
    email:     `mailto:?subject=${t}&body=${e}%0A%0A${u}`,
  };
}

// ── Engagement data queries ───────────────────────────────────────────────────

async function fetchEngagementData(postId: string, workspaceId: string) {
  const db = getDb();

  const [likesRes, commentsRes, wsRes] = await Promise.all([
    db.from("blog_likes" as never)
      .select("id", { count: "exact", head: true })
      .eq("post_id" as never, postId),
    db.from("blog_comments" as never)
      .select("id", { count: "exact", head: true })
      .eq("post_id" as never, postId)
      .eq("status" as never, "approved")
      .is("deleted_at" as never, null),
    db.from("workspaces")
      .select("engagement_features, show_branding")
      .eq("id", workspaceId)
      .maybeSingle(),
  ]);

  const wsRow = wsRes.data as Record<string, unknown> | null;

  const defaultFeatures = {
    likes: true, comments: true, socialShare: true,
    relatedPosts: true, poweredBy: false, viewTracking: true,
  };
  const features = {
    ...defaultFeatures,
    ...(typeof wsRow?.engagement_features === "object" && wsRow.engagement_features !== null
      ? wsRow.engagement_features as Record<string, boolean>
      : {}),
  };

  const showBranding = Boolean(wsRow?.show_branding);
  const branding = showBranding
    ? { enabled: true, text: "Powered by Lunar CMS", url: "https://lunarcms.com" }
    : { enabled: false };

  return {
    stats:    { likes: likesRes.count ?? 0, comment_count: commentsRes.count ?? 0 },
    features,
    branding,
  };
}

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

export interface EnrichedBlogDetail extends PublicBlogDetail {
  word_count:   number;
  stats:        { views: number; likes: number; comment_count: number };
  features:     Record<string, boolean>;
  branding:     { enabled: boolean; text?: string; url?: string };
  share:        Record<string, string>;
  related:      PublicBlogSummary[];
}

export async function getBlogBySlug(
  workspaceId: string,
  slug: string,
  keyType: "publishable" | "secret",
): Promise<EnrichedBlogDetail | null> {
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

  const row       = data as Record<string, unknown>;
  const postId    = row.id as string;
  const detail    = toBlogDetail(row);
  const wordCount = countWords(detail.content);

  // Fetch engagement data + related posts in parallel; update view count fire-and-forget
  const [engagement, related] = await Promise.all([
    fetchEngagementData(postId, workspaceId),
    getRelatedBlogs(workspaceId, slug, 5),
  ]);

  // Increment view count fire-and-forget
  getDb()
    .from("blog_posts")
    .update({ views: (Number(row.views) || 0) + 1 })
    .eq("slug", slug)
    .eq("workspace_id", workspaceId)
    .then(() => {})
    .catch(() => {});

  return {
    ...detail,
    word_count: wordCount,
    stats:    { views: Number(row.views) || 0, ...engagement.stats },
    features:  engagement.features,
    branding:  engagement.branding,
    share:     buildShareUrls(slug, detail.title, detail.excerpt),
    related,
  };
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
