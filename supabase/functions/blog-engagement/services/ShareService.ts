/**
 * ShareService.ts — records a share-button click and builds share metadata
 * (title/description/image/URL) for external social integrations.
 */
import { getDb } from "../db.ts";
import { bumpDaily } from "./PostLookup.ts";

const ALLOWED_CHANNELS = new Set(["twitter", "facebook", "linkedin", "whatsapp", "email", "copy_link", "other"]);

export async function recordShare(
  postId: string,
  workspaceId: string | null,
  channel: string,
  visitorId: string | null,
): Promise<{ recorded: boolean }> {
  const ch = ALLOWED_CHANNELS.has(channel) ? channel : "other";
  const { error } = await getDb().from("blog_shares").insert({
    blog_post_id: postId,
    workspace_id: workspaceId,
    channel: ch,
    visitor_id: visitorId,
  });
  if (error) throw new Error(error.message);

  bumpDaily(postId, workspaceId, "shares");
  return { recorded: true };
}

export interface ShareMetadata {
  title: string;
  description: string;
  image: string | null;
  url: string;
  siteName: string;
}

export function buildShareMetadata(
  post: Record<string, unknown>,
  siteUrl: string,
  siteName: string,
): ShareMetadata {
  return {
    title: (post.title as string) || "",
    description: (post.meta_description as string) || (post.excerpt as string) || "",
    image: (post.cover_image as string | null) ?? null,
    url: `${siteUrl.replace(/\/$/, "")}/${post.slug}`,
    siteName,
  };
}
