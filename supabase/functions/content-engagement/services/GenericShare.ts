/**
 * GenericShare.ts — share-button click tracking + Open Graph metadata.
 */
import { getDb } from "../db.ts";
import { bumpDaily } from "./GenericLookup.ts";
import type { ContentTypeConfig } from "./ContentType.ts";

export interface ShareResult {
  recorded: boolean;
  channel:  string;
  total:    number;
}

const VALID_CHANNELS = new Set([
  "twitter", "facebook", "linkedin", "whatsapp",
  "telegram", "email", "copy", "other",
]);

async function countShares(config: ContentTypeConfig, contentId: string): Promise<number> {
  const { count, error } = await (getDb() as any)
    .from(config.sharesTable)
    .select("id", { count: "exact", head: true })
    .eq(config.idCol, contentId);
  if (error) throw new Error(error.message);
  return count ?? 0;
}

export async function recordShare(
  config: ContentTypeConfig,
  contentId: string,
  workspaceId: string,
  channel: string,
  visitorId: string,
): Promise<ShareResult> {
  const safeChannel = VALID_CHANNELS.has(channel) ? channel : "other";
  const db = getDb() as any;

  const { error } = await db.from(config.sharesTable).insert({
    [config.idCol]: contentId,
    workspace_id:   workspaceId,
    channel:        safeChannel,
    visitor_id:     visitorId,
  });
  if (error) throw new Error(error.message);

  bumpDaily(config, contentId, workspaceId, "shares");

  return { recorded: true, channel: safeChannel, total: await countShares(config, contentId) };
}

export interface ShareMetadata {
  title:       string;
  description: string;
  image:       string | null;
  url:         string;
  type:        string;
  siteName:    string;
  channels:    { id: string; label: string; shareUrl: string }[];
}

export function buildShareMetadata(
  row: Record<string, unknown>,
  config: ContentTypeConfig,
  supabaseUrl: string,
  siteName: string,
): ShareMetadata {
  const title = String(row[config.titleCol] ?? "");
  const description = String(row.excerpt ?? row.description ?? row.meta_description ?? "");
  const slug = String(row.slug ?? "");
  const image = row.cover_image ? String(row.cover_image) : null;
  const canonical = `${supabaseUrl.replace(".supabase.co", "")}.app/${config.contentTable}/${slug}`;

  const enc = encodeURIComponent;
  return {
    title,
    description,
    image,
    url: canonical,
    type: "article",
    siteName,
    channels: [
      { id: "twitter",  label: "X / Twitter", shareUrl: `https://twitter.com/intent/tweet?text=${enc(title)}&url=${enc(canonical)}` },
      { id: "facebook", label: "Facebook",     shareUrl: `https://www.facebook.com/sharer/sharer.php?u=${enc(canonical)}` },
      { id: "linkedin", label: "LinkedIn",     shareUrl: `https://www.linkedin.com/sharing/share-offsite/?url=${enc(canonical)}` },
      { id: "whatsapp", label: "WhatsApp",     shareUrl: `https://wa.me/?text=${enc(`${title} ${canonical}`)}` },
    ],
  };
}
