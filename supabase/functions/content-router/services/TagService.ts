/**
 * TagService.ts
 *
 * Tags are stored as JSONB arrays inside blog_posts.tags.
 * This service flattens and aggregates all tag values with post counts.
 */
import { getDb } from "../db.ts";
import { toTag, type PublicTag } from "../ContentTransformer.ts";

export interface TagListParams {
  page:   number;
  limit:  number;
  sort:   "name" | "post_count";
  order:  "asc" | "desc";
  search?: string;
}

export interface TagListResult {
  rows:  PublicTag[];
  total: number;
}

export async function listTags(
  workspaceId: string,
  params: TagListParams,
): Promise<TagListResult> {
  const db = getDb();

  const { data, error } = await db
    .from("blog_posts")
    .select("tags")
    .eq("workspace_id", workspaceId)
    .eq("status", "published")
    .not("tags", "is", null);

  if (error) throw new Error(error.message);

  // Flatten JSONB arrays and count
  const counts: Record<string, number> = {};
  for (const row of data ?? []) {
    const tags = (row as Record<string, unknown>).tags;
    if (Array.isArray(tags)) {
      for (const tag of tags as string[]) {
        if (tag && typeof tag === "string") {
          counts[tag] = (counts[tag] ?? 0) + 1;
        }
      }
    }
  }

  let tags = Object.entries(counts).map(([name, count]) => toTag(name, count));

  // Filter
  if (params.search) {
    const q = params.search.toLowerCase();
    tags = tags.filter((t) => t.name.toLowerCase().includes(q));
  }

  // Sort
  tags.sort((a, b) => {
    const cmp = params.sort === "post_count"
      ? a.post_count - b.post_count
      : a.name.localeCompare(b.name);
    return params.order === "asc" ? cmp : -cmp;
  });

  const total = tags.length;
  const offset = (params.page - 1) * params.limit;
  return {
    rows:  tags.slice(offset, offset + params.limit),
    total,
  };
}
