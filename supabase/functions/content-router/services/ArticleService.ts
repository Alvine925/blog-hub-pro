import { getDb } from "../db.ts";
import { toArticleSummary, toArticleDetail, type PublicArticleSummary } from "../ContentTransformer.ts";

export interface ListArticlesParams {
  page: number;
  limit: number;
  sort: string;
  order: "asc" | "desc";
  search?: string;
  category?: string;
  tag?: string;
  featured?: boolean;
  article_type?: string;
  author?: string;
  from?: string;
  to?: string;
  status?: string;
  keyType?: string;
}

const ARTICLE_SUMMARY_COLS =
  "id,title,slug,excerpt,cover_image,category,tags,author_name,article_type,status,featured,reading_time,word_count,published_at,views,created_at,updated_at," +
  "seo_title,meta_description,social_title,social_description,social_image,social_image_alt,social_hashtags,open_graph_type,twitter_card";

const ARTICLE_DETAIL_COLS = ARTICLE_SUMMARY_COLS + ",content";

export async function listArticles(
  workspaceId: string,
  params: ListArticlesParams,
): Promise<{ rows: unknown[]; total: number }> {
  const db = getDb() as any;
  const { page, limit, sort, order, search, category, tag, featured, article_type, author, from, to, keyType } = params;
  const offset = (page - 1) * limit;

  const allowedStatuses = keyType === "secret"
    ? ["published", "draft", "scheduled"]
    : ["published"];
  const statusFilter = params.status && allowedStatuses.includes(params.status)
    ? params.status : null;

  let q = db
    .from("articles")
    .select(ARTICLE_SUMMARY_COLS, { count: "exact" })
    .eq("workspace_id", workspaceId)
    .in("status", allowedStatuses);

  if (statusFilter)   q = q.eq("status", statusFilter);
  if (search)         q = q.ilike("title", `%${search}%`);
  if (category)       q = q.eq("category", category);
  if (featured !== undefined) q = q.eq("featured", featured);
  if (article_type)   q = q.eq("article_type", article_type);
  if (author)         q = q.ilike("author_name", `%${author}%`);
  if (tag)            q = q.contains("tags", [tag]);
  if (from)           q = q.gte("published_at", from);
  if (to)             q = q.lte("published_at", to);

  const allowedSort = ["title", "published_at", "created_at", "updated_at", "views", "reading_time"];
  const safeSort = allowedSort.includes(sort) ? sort : "published_at";
  q = q.order(safeSort, { ascending: order === "asc" }).range(offset, offset + limit - 1);

  const { data, count, error } = await q;
  if (error) throw new Error(error.message);
  return {
    rows:  (data ?? []).map((r) => toArticleSummary(r as Record<string, unknown>)),
    total: count ?? 0,
  };
}

export async function getArticleBySlug(
  workspaceId: string,
  slug: string,
  keyType?: string,
): Promise<unknown | null> {
  const db = getDb() as any;
  const allowedStatuses = keyType === "secret"
    ? ["published", "draft", "scheduled"]
    : ["published"];

  const { data, error } = await db
    .from("articles")
    .select(ARTICLE_DETAIL_COLS)
    .eq("workspace_id", workspaceId)
    .eq("slug", slug)
    .in("status", allowedStatuses)
    .maybeSingle();

  if (error || !data) return null;

  // Increment views best-effort
  db.from("articles").update({ views: (data.views ?? 0) + 1 }).eq("id", data.id);
  const row = { ...data, views: (data.views ?? 0) + 1 } as Record<string, unknown>;
  return toArticleDetail(row);
}

export async function getFeaturedArticles(
  workspaceId: string,
  limit: number,
): Promise<PublicArticleSummary[]> {
  const db = getDb() as any;
  const { data } = await db
    .from("articles")
    .select(ARTICLE_SUMMARY_COLS)
    .eq("workspace_id", workspaceId)
    .eq("status", "published")
    .eq("featured", true)
    .order("published_at", { ascending: false })
    .limit(limit);
  return (data ?? []).map((r: Record<string, unknown>) => toArticleSummary(r));
}

export async function getLatestArticles(
  workspaceId: string,
  limit: number,
): Promise<PublicArticleSummary[]> {
  const db = getDb() as any;
  const { data } = await db
    .from("articles")
    .select(ARTICLE_SUMMARY_COLS)
    .eq("workspace_id", workspaceId)
    .eq("status", "published")
    .order("published_at", { ascending: false })
    .limit(limit);
  return (data ?? []).map((r: Record<string, unknown>) => toArticleSummary(r));
}
