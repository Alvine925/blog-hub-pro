/**
 * PostLookup.ts — resolves a workspace-scoped published blog post by slug.
 *
 * Shared by every engagement service so likes/comments/views/shares always
 * validate the target post exists (and is published, for publishable keys)
 * before writing anything.
 */
import { getDb } from "../db.ts";

export interface ResolvedPost {
  id: string;
  slug: string;
  status: string;
  views: number;
}

export async function resolvePost(
  workspaceId: string,
  slug: string,
  keyType: "publishable" | "secret",
): Promise<ResolvedPost | null> {
  const db = getDb();
  let query = db
    .from("blog_posts")
    .select("id, slug, status, views")
    .eq("workspace_id", workspaceId)
    .eq("slug", slug);

  if (keyType === "publishable") {
    query = query.eq("status", "published");
  }

  const { data, error } = await query.maybeSingle();
  if (error) throw new Error(error.message);
  if (!data) return null;
  return data as unknown as ResolvedPost;
}

/** Fire-and-forget bump of the daily engagement rollup. Never throws. */
export function bumpDaily(
  postId: string,
  workspaceId: string | null,
  metric: "views" | "likes" | "comments" | "shares",
): void {
  getDb()
    .rpc("bump_blog_engagement_daily", {
      p_blog_post_id: postId,
      p_workspace_id: workspaceId,
      p_metric: metric,
    })
    .then(() => {})
    .catch(() => {});
}
