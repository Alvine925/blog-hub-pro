import { getDb } from "../db.ts";
import { toProductSummary, toProductDetail, type PublicProductSummary } from "../ContentTransformer.ts";

export interface ListProductsParams {
  page: number;
  limit: number;
  sort: string;
  order: "asc" | "desc";
  search?: string;
  category?: string;
  featured?: boolean;
  brand?: string;
  minPrice?: number;
  maxPrice?: number;
  status?: string;
  keyType?: string;
}

const PRODUCT_SUMMARY_COLS =
  "id,name,slug,description,cover_image,category,brand,sku,price,compare_price,currency,status,featured,tags,views,sort_order,created_at,updated_at," +
  "seo_title,meta_description,social_title,social_description,social_image,social_image_alt,social_hashtags,open_graph_type,twitter_card";

const PRODUCT_DETAIL_COLS = PRODUCT_SUMMARY_COLS + ",content,gallery,specifications,features";

export async function listProducts(
  workspaceId: string,
  params: ListProductsParams,
): Promise<{ rows: unknown[]; total: number }> {
  const db = getDb() as any;
  const { page, limit, sort, order, search, category, featured, brand, keyType } = params;
  const offset = (page - 1) * limit;

  const allowedStatuses = keyType === "secret" ? ["published", "draft", "archived"] : ["published"];
  const statusFilter = params.status && allowedStatuses.includes(params.status)
    ? params.status : null;

  let q = db
    .from("products")
    .select(PRODUCT_SUMMARY_COLS, { count: "exact" })
    .eq("workspace_id", workspaceId)
    .in("status", allowedStatuses);

  if (statusFilter) q = q.eq("status", statusFilter);
  if (search)   q = q.ilike("name", `%${search}%`);
  if (category) q = q.eq("category", category);
  if (featured !== undefined) q = q.eq("featured", featured);
  if (brand)    q = q.ilike("brand", `%${brand}%`);
  if (params.minPrice !== undefined) q = q.gte("price", params.minPrice);
  if (params.maxPrice !== undefined) q = q.lte("price", params.maxPrice);

  const allowedSort = ["name", "price", "created_at", "updated_at", "views", "sort_order"];
  const safeSort = allowedSort.includes(sort) ? sort : "sort_order";
  q = q.order(safeSort, { ascending: order === "asc" }).range(offset, offset + limit - 1);

  const { data, count, error } = await q;
  if (error) throw new Error(error.message);
  return {
    rows:  (data ?? []).map((r) => toProductSummary(r as Record<string, unknown>)),
    total: count ?? 0,
  };
}

export async function getProductBySlug(
  workspaceId: string,
  slug: string,
  keyType?: string,
): Promise<unknown | null> {
  const db = getDb() as any;
  const allowedStatuses = keyType === "secret" ? ["published", "draft", "archived"] : ["published"];

  const { data, error } = await db
    .from("products")
    .select(PRODUCT_DETAIL_COLS)
    .eq("workspace_id", workspaceId)
    .eq("slug", slug)
    .in("status", allowedStatuses)
    .maybeSingle();

  if (error || !data) return null;

  // Increment views best-effort
  db.from("products").update({ views: (data.views ?? 0) + 1 }).eq("id", data.id);
  const row = { ...data, views: (data.views ?? 0) + 1 } as Record<string, unknown>;
  return toProductDetail(row);
}

export async function getFeaturedProducts(
  workspaceId: string,
  limit: number,
): Promise<PublicProductSummary[]> {
  const db = getDb() as any;
  const { data } = await db
    .from("products")
    .select(PRODUCT_SUMMARY_COLS)
    .eq("workspace_id", workspaceId)
    .eq("status", "published")
    .eq("featured", true)
    .order("sort_order", { ascending: true })
    .limit(limit);
  return (data ?? []).map((r: Record<string, unknown>) => toProductSummary(r));
}
