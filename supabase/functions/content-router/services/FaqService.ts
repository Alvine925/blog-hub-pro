/**
 * FaqService.ts — queries faqs for the content-router.
 *
 * All queries are workspace-scoped, published-only, ordered by sort_order.
 */
import { getDb } from "../db.ts";
import { toFaq, type PublicFaq } from "../ContentTransformer.ts";

export interface FaqListParams {
  page:      number;
  limit:     number;
  category?: string;
  search?:   string;
  featured?: boolean;
}

export interface FaqListResult {
  rows:  PublicFaq[];
  total: number;
}

const FAQ_COLS =
  "id, question, answer, category, featured, sort_order, updated_at, " +
  "social_title, social_description, social_image, social_image_alt, social_hashtags, open_graph_type, twitter_card";

export async function listFaqs(
  workspaceId: string,
  params: FaqListParams,
): Promise<FaqListResult> {
  const db = getDb();
  const offset = (params.page - 1) * params.limit;

  let query = db
    .from("faqs")
    .select(FAQ_COLS, { count: "exact" })
    .eq("workspace_id", workspaceId)
    .eq("status", "published")
    .order("sort_order", { ascending: true })
    .range(offset, offset + params.limit - 1);

  if (params.category) query = query.ilike("category", params.category);
  if (params.featured !== undefined) query = query.eq("featured", params.featured);

  if (params.search) {
    const term = params.search.replace(/[%_\\]/g, "").slice(0, 200);
    query = query.or(`question.ilike.%${term}%,answer.ilike.%${term}%`);
  }

  const { data, count, error } = await query;
  if (error) throw new Error(error.message);

  return {
    rows:  (data ?? []).map((r) => toFaq(r as Record<string, unknown>)),
    total: count ?? 0,
  };
}
