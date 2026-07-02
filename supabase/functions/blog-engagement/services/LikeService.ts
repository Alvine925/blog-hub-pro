/**
 * LikeService.ts — like/unlike a blog post, deduplicated by visitor id.
 */
import { getDb } from "../db.ts";
import { bumpDaily } from "./PostLookup.ts";

export interface LikeResult {
  liked: boolean;
  totalLikes: number;
}

async function countLikes(postId: string): Promise<number> {
  const { count, error } = await getDb()
    .from("blog_likes")
    .select("id", { count: "exact", head: true })
    .eq("blog_post_id", postId);
  if (error) throw new Error(error.message);
  return count ?? 0;
}

export async function likePost(
  postId: string,
  workspaceId: string,
  visitorId: string,
): Promise<LikeResult> {
  const db = getDb();
  const { error } = await db
    .from("blog_likes")
    .upsert(
      { blog_post_id: postId, workspace_id: workspaceId, visitor_id: visitorId },
      { onConflict: "blog_post_id,visitor_id", ignoreDuplicates: true },
    );
  if (error) throw new Error(error.message);

  bumpDaily(postId, workspaceId, "likes");

  return { liked: true, totalLikes: await countLikes(postId) };
}

export async function unlikePost(
  postId: string,
  visitorId: string,
): Promise<LikeResult> {
  const db = getDb();
  const { error } = await db
    .from("blog_likes")
    .delete()
    .eq("blog_post_id", postId)
    .eq("visitor_id", visitorId);
  if (error) throw new Error(error.message);

  return { liked: false, totalLikes: await countLikes(postId) };
}

export async function getLikeStatus(
  postId: string,
  visitorId: string,
): Promise<LikeResult> {
  const db = getDb();
  const { data, error } = await db
    .from("blog_likes")
    .select("id")
    .eq("blog_post_id", postId)
    .eq("visitor_id", visitorId)
    .maybeSingle();
  if (error) throw new Error(error.message);

  return { liked: Boolean(data), totalLikes: await countLikes(postId) };
}
