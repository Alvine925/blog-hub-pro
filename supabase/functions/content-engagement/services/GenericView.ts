/**
 * GenericView.ts — view tracking with per-visitor 30-minute deduplication.
 * The engagement *_views table is the authoritative view count; the content
 * table's own `views` column is left to the content-router to maintain.
 */
import { getDb } from "../db.ts";
import { bumpDaily } from "./GenericLookup.ts";
import type { ContentTypeConfig } from "./ContentType.ts";

export interface ViewResult {
  counted:    boolean;
  totalViews: number;
}

async function countViews(config: ContentTypeConfig, contentId: string): Promise<number> {
  const { count, error } = await (getDb() as any)
    .from(config.viewsTable)
    .select("id", { count: "exact", head: true })
    .eq(config.idCol, contentId);
  if (error) throw new Error(error.message);
  return count ?? 0;
}

export async function recordView(
  config: ContentTypeConfig,
  opts: {
    contentId:   string;
    workspaceId: string;
    visitorId:   string;
    referrer:    string | null;
    userAgent:   string | null;
    deviceType?: string;
  },
): Promise<ViewResult> {
  const db = getDb() as any;

  const thirtyMinsAgo = new Date(Date.now() - 30 * 60 * 1000).toISOString();
  const { count: recentCount } = await db
    .from(config.viewsTable)
    .select("id", { count: "exact", head: true })
    .eq(config.idCol, opts.contentId)
    .eq("visitor_id", opts.visitorId)
    .gte("created_at", thirtyMinsAgo);

  if ((recentCount ?? 0) > 0) {
    return { counted: false, totalViews: await countViews(config, opts.contentId) };
  }

  const { error } = await db.from(config.viewsTable).insert({
    [config.idCol]: opts.contentId,
    workspace_id:   opts.workspaceId,
    visitor_id:     opts.visitorId,
    referrer:       opts.referrer,
    user_agent:     opts.userAgent,
    device_type:    opts.deviceType ?? null,
  });
  if (error) throw new Error(error.message);

  bumpDaily(config, opts.contentId, opts.workspaceId, "views");

  return { counted: true, totalViews: await countViews(config, opts.contentId) };
}
