/**
 * EngagementService.ts — read-only engagement queries for the content-router.
 *
 * These are GET-only reads exposed via content-router. Write operations
 * (POST likes, POST comments, POST views, DELETE) live in blog-engagement.
 */
import { getDb } from "../db.ts";

async function resolvePostId(workspaceId: string, slug: string): Promise<string | null> {
  const { data } = await getDb()
    .from("blog_posts")
    .select("id, views")
    .eq("workspace_id", workspaceId)
    .eq("slug", slug)
    .eq("status", "published")
    .maybeSingle();
  return data ? (data as Record<string, unknown>).id as string : null;
}

/** Returns like count + optionally whether the visitor has liked the post. */
export async function getEngagementForSlug(
  workspaceId: string,
  slug: string,
  visitorId: string | null,
  type: "likes" | "stats",
): Promise<Record<string, unknown> | null> {
  const db     = getDb();
  const postId = await resolvePostId(workspaceId, slug);
  if (!postId) return null;

  if (type === "likes") {
    const [countRes, likedRes] = await Promise.all([
      db.from("blog_likes" as never)
        .select("id", { count: "exact", head: true })
        .eq("post_id" as never, postId),
      visitorId
        ? db.from("blog_likes" as never)
            .select("id")
            .eq("post_id" as never, postId)
            .eq("visitor_id" as never, visitorId)
            .maybeSingle()
        : Promise.resolve({ data: null }),
    ]);
    return { likes: countRes.count ?? 0, liked: (likedRes as { data: unknown }).data !== null };
  }

  // stats
  const [viewsRes, likesRes, commentsRes] = await Promise.all([
    db.from("blog_posts").select("views").eq("id", postId).maybeSingle(),
    db.from("blog_likes" as never)
      .select("id", { count: "exact", head: true })
      .eq("post_id" as never, postId),
    db.from("blog_comments" as never)
      .select("id", { count: "exact", head: true })
      .eq("post_id" as never, postId)
      .eq("status" as never, "approved")
      .is("deleted_at" as never, null),
  ]);

  return {
    views:         Number((viewsRes.data as Record<string, unknown>)?.views ?? 0),
    likes:         likesRes.count ?? 0,
    comment_count: commentsRes.count ?? 0,
  };
}

/** Returns paginated approved comments for a post. */
export async function getCommentsForSlug(
  workspaceId: string,
  slug: string,
  page: number,
  limit: number,
): Promise<{ comments: unknown[]; total: number } | null> {
  const postId = await resolvePostId(workspaceId, slug);
  if (!postId) return null;

  const offset = (page - 1) * limit;
  const { data, count, error } = await getDb()
    .from("blog_comments" as never)
    .select("id, parent_id, name, website, content, created_at, updated_at", { count: "exact" })
    .eq("post_id" as never, postId)
    .eq("status" as never, "approved")
    .is("deleted_at" as never, null)
    .order("created_at" as never, { ascending: true })
    .range(offset, offset + limit - 1);

  if (error) throw new Error((error as { message: string }).message);
  return { comments: (data as unknown[]) ?? [], total: count ?? 0 };
}
