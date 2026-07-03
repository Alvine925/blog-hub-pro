/**
 * NewsService.ts — queries news for the content-router.
 *
 * All queries are workspace-scoped, published-only by default.
 */
import { getDb } from "../db.ts";
import { toNewsSummary, toNewsDetail, type PublicNewsSummary, type PublicNewsDetail } from "../ContentTransformer.ts";

const SORT_COLS = new Set(["created_at", "updated_at", "published_at", "title", "views"]);

export interface NewsListParams {
  page:      number;
  limit:     number;
  sort:      string;
  order:     "asc" | "desc";
  search?:   string;
  category?: string;
  breaking?: boolean;
  featured?: boolean;
  from?:     string;
  to?:       string;
}

export interface NewsListResult {
  rows:  PublicNewsSummary[];
  total: number;
}

const NEWS_SUMMARY_COLS =
  "slug, title, excerpt, cover_image, category, source_name, source_url, breaking, featured, views, published_at, updated_at, " +
  "seo_title, meta_description, social_title, social_description, social_image, social_image_alt, social_hashtags, open_graph_type, twitter_card";

const NEWS_DETAIL_COLS =
  NEWS_SUMMARY_COLS + ", content";

export async function listNews(
  workspaceId: string,
  params: NewsListParams,
): Promise<NewsListResult> {
  const db = getDb();
  const sort = SORT_COLS.has(params.sort) ? params.sort : "published_at";
  const order = params.order === "asc" ? true : false;
  const offset = (params.page - 1) * params.limit;

  let query = db
    .from("news")
    .select(NEWS_SUMMARY_COLS, { count: "exact" })
    .eq("workspace_id", workspaceId)
    .eq("status", "published")
    .order(sort, { ascending: order })
    .range(offset, offset + params.limit - 1);

  if (params.category) query = query.ilike("category", params.category);
  if (params.breaking !== undefined) query = query.eq("breaking", params.breaking);
  if (params.featured !== undefined) query = query.eq("featured", params.featured);
  if (params.from) query = query.gte("published_at", params.from);
  if (params.to) query = query.lte("published_at", params.to);

  if (params.search) {
    const term = params.search.replace(/[%_\\]/g, "").slice(0, 200);
    query = query.or(`title.ilike.%${term}%,excerpt.ilike.%${term}%`);
  }

  const { data, count, error } = await query;
  if (error) throw new Error(error.message);

  return {
    rows:  (data ?? []).map((r) => toNewsSummary(r as Record<string, unknown>)),
    total: count ?? 0,
  };
}

export async function getNewsBySlug(
  workspaceId: string,
  slug: string,
): Promise<PublicNewsDetail | null> {
  const db = getDb();

  const { data, error } = await db
    .from("news")
    .select(NEWS_DETAIL_COLS)
    .eq("workspace_id", workspaceId)
    .eq("slug", slug)
    .eq("status", "published")
    .maybeSingle();

  if (error) throw new Error(error.message);
  if (!data) return null;

  getDb()
    .from("news")
    .update({ views: (Number((data as Record<string, unknown>).views) || 0) + 1 })
    .eq("slug", slug)
    .eq("workspace_id", workspaceId)
    .then(() => {})
    .catch(() => {});

  return toNewsDetail(data as Record<string, unknown>);
}

export async function getBreakingNews(
  workspaceId: string,
  limit: number,
): Promise<PublicNewsSummary[]> {
  const db = getDb();
  const { data, error } = await db
    .from("news")
    .select(NEWS_SUMMARY_COLS)
    .eq("workspace_id", workspaceId)
    .eq("status", "published")
    .eq("breaking", true)
    .order("published_at", { ascending: false })
    .limit(limit);

  if (error) throw new Error(error.message);
  return (data ?? []).map((r) => toNewsSummary(r as Record<string, unknown>));
}

export async function getLatestNews(
  workspaceId: string,
  limit: number,
): Promise<PublicNewsSummary[]> {
  const db = getDb();
  const { data, error } = await db
    .from("news")
    .select(NEWS_SUMMARY_COLS)
    .eq("workspace_id", workspaceId)
    .eq("status", "published")
    .order("published_at", { ascending: false })
    .limit(limit);

  if (error) throw new Error(error.message);
  return (data ?? []).map((r) => toNewsSummary(r as Record<string, unknown>));
}
