/**
 * GenericLookup.ts — resolve a content item by workspace + slug,
 * and fire-and-forget the daily engagement rollup bump.
 */
import { getDb } from "../db.ts";
import type { ContentTypeConfig } from "./ContentType.ts";

export interface ContentItem {
  id:          string;
  workspaceId: string;
  views:       number;
  category:    string;
}

export async function resolveContent(
  config: ContentTypeConfig,
  workspaceId: string,
  slug: string,
): Promise<ContentItem | null> {
  const db = getDb();
  const { data, error } = await (db as any)
    .from(config.contentTable)
    .select("id, workspace_id, views, category")
    .eq("workspace_id", workspaceId)
    .eq(config.slugCol, slug)
    .maybeSingle();

  if (error) throw new Error(error.message);
  if (!data) return null;

  const row = data as Record<string, unknown>;
  return {
    id:          row.id as string,
    workspaceId: row.workspace_id as string,
    views:       Number(row.views) || 0,
    category:    String(row.category ?? ""),
  };
}

/**
 * Fire-and-forget daily rollup bump. RPC param naming:
 *   news_id     → p_news_id
 *   article_id  → p_article_id
 *   product_id  → p_product_id
 */
export function bumpDaily(
  config: ContentTypeConfig,
  contentId: string,
  workspaceId: string,
  metric: "views" | "likes" | "comments" | "shares",
): void {
  const base = config.idCol.replace("_id", ""); // "news" | "article" | "product"
  (getDb() as any).rpc(config.bumpFn, {
    [`p_${base}_id`]: contentId,
    p_workspace_id:   workspaceId,
    p_metric:         metric,
  }).then(() => {}).catch(() => {});
}
