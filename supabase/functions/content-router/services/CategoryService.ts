/**
 * CategoryService.ts
 *
 * Categories are derived from the `category` column on blog_posts
 * (no dedicated table). This service aggregates distinct values with
 * post counts, then paginates and filters in memory (datasets are small).
 */
import { getDb } from "../db.ts";
import { toCategory, type PublicCategory } from "../ContentTransformer.ts";

export interface CategoryListParams {
  page:   number;
  limit:  number;
  sort:   "name" | "post_count";
  order:  "asc" | "desc";
  search?: string;
}

export interface CategoryListResult {
  rows:  PublicCategory[];
  total: number;
}

export async function listCategories(
  workspaceId: string,
  params: CategoryListParams,
): Promise<CategoryListResult> {
  const db = getDb();

  // Aggregate distinct categories with counts from published posts
  const { data, error } = await db
    .from("blog_posts")
    .select("category")
    .eq("workspace_id", workspaceId)
    .eq("status", "published")
    .not("category", "is", null);

  if (error) throw new Error(error.message);

  // Count occurrences
  const counts: Record<string, number> = {};
  for (const row of data ?? []) {
    const cat = (row as Record<string, unknown>).category as string;
    if (cat) counts[cat] = (counts[cat] ?? 0) + 1;
  }

  let categories = Object.entries(counts).map(([name, count]) => toCategory(name, count));

  // Filter
  if (params.search) {
    const q = params.search.toLowerCase();
    categories = categories.filter((c) => c.name.toLowerCase().includes(q));
  }

  // Sort
  categories.sort((a, b) => {
    const field = params.sort === "post_count" ? "post_count" : "name";
    const cmp = field === "post_count"
      ? a.post_count - b.post_count
      : a.name.localeCompare(b.name);
    return params.order === "asc" ? cmp : -cmp;
  });

  const total = categories.length;
  const offset = (params.page - 1) * params.limit;
  return {
    rows:  categories.slice(offset, offset + params.limit),
    total,
  };
}
