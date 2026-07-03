/**
 * GenericLike.ts — like / unlike / status for any content type.
 */
import { getDb } from "../db.ts";
import { bumpDaily } from "./GenericLookup.ts";
import type { ContentTypeConfig } from "./ContentType.ts";

export interface LikeResult {
  liked:      boolean;
  totalLikes: number;
}

async function countLikes(config: ContentTypeConfig, contentId: string): Promise<number> {
  const { count, error } = await (getDb() as any)
    .from(config.likesTable)
    .select("id", { count: "exact", head: true })
    .eq(config.idCol, contentId);
  if (error) throw new Error(error.message);
  return count ?? 0;
}

export async function likeContent(
  config: ContentTypeConfig,
  contentId: string,
  workspaceId: string,
  visitorId: string,
): Promise<LikeResult> {
  const db = getDb() as any;
  const { error } = await db
    .from(config.likesTable)
    .upsert(
      { [config.idCol]: contentId, workspace_id: workspaceId, visitor_id: visitorId },
      { onConflict: `${config.idCol},visitor_id`, ignoreDuplicates: true },
    );
  if (error) throw new Error(error.message);

  bumpDaily(config, contentId, workspaceId, "likes");

  return { liked: true, totalLikes: await countLikes(config, contentId) };
}

export async function unlikeContent(
  config: ContentTypeConfig,
  contentId: string,
  visitorId: string,
): Promise<LikeResult> {
  const { error } = await (getDb() as any)
    .from(config.likesTable)
    .delete()
    .eq(config.idCol, contentId)
    .eq("visitor_id", visitorId);
  if (error) throw new Error(error.message);

  return { liked: false, totalLikes: await countLikes(config, contentId) };
}

export async function getLikeStatus(
  config: ContentTypeConfig,
  contentId: string,
  visitorId: string,
): Promise<LikeResult> {
  const { data, error } = await (getDb() as any)
    .from(config.likesTable)
    .select("id")
    .eq(config.idCol, contentId)
    .eq("visitor_id", visitorId)
    .maybeSingle();
  if (error) throw new Error(error.message);
  return { liked: Boolean(data), totalLikes: await countLikes(config, contentId) };
}
