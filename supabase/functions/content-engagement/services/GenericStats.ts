/**
 * GenericStats.ts — aggregated engagement stats + workspace feature flags.
 */
import { getDb } from "../db.ts";
import { countApprovedComments } from "./GenericComment.ts";
import type { ContentTypeConfig } from "./ContentType.ts";

export interface EngagementSettings {
  features: {
    likes:        boolean;
    comments:     boolean;
    socialShare:  boolean;
    relatedPosts: boolean;
    viewTracking: boolean;
    poweredBy:    boolean;
  };
  branding: {
    enabled: boolean;
    text:    string;
    url:     string;
  };
  commentSettings: {
    requireApproval: boolean;
    allowGuest:      boolean;
    maxDepth:        number;
  };
}

const DEFAULT_SETTINGS: EngagementSettings = {
  features: {
    likes: true, comments: true, socialShare: true,
    relatedPosts: true, viewTracking: true, poweredBy: true,
  },
  branding: { enabled: true, text: "Powered by Lunar CMS", url: "https://lunarcms.com" },
  commentSettings: { requireApproval: true, allowGuest: true, maxDepth: 3 },
};

export async function getEngagementSettings(workspaceId: string): Promise<EngagementSettings> {
  const { data, error } = await (getDb() as any)
    .from("workspaces")
    .select("engagement_settings")
    .eq("id", workspaceId)
    .maybeSingle();
  if (error) throw new Error(error.message);

  const raw = (data as Record<string, unknown> | null)?.engagement_settings as
    | Partial<EngagementSettings>
    | undefined;

  if (!raw) return DEFAULT_SETTINGS;
  return {
    features:        { ...DEFAULT_SETTINGS.features,        ...(raw.features ?? {}) },
    branding:        { ...DEFAULT_SETTINGS.branding,        ...(raw.branding ?? {}) },
    commentSettings: { ...DEFAULT_SETTINGS.commentSettings, ...(raw.commentSettings ?? {}) },
  };
}

export interface ContentStats {
  views:       number;
  likes:       number;
  comments:    number;
  shares:      number;
}

export async function getContentStats(
  config: ContentTypeConfig,
  contentId: string,
): Promise<ContentStats> {
  const db = getDb() as any;

  const [viewsRes, likesRes, commentsCount, sharesRes] = await Promise.all([
    db.from(config.viewsTable).select("id", { count: "exact", head: true }).eq(config.idCol, contentId),
    db.from(config.likesTable).select("id", { count: "exact", head: true }).eq(config.idCol, contentId),
    countApprovedComments(config, contentId),
    db.from(config.sharesTable).select("id", { count: "exact", head: true }).eq(config.idCol, contentId),
  ]);

  return {
    views:    viewsRes.count    ?? 0,
    likes:    likesRes.count    ?? 0,
    comments: commentsCount,
    shares:   sharesRes.count   ?? 0,
  };
}

export async function getRelatedContent(
  config: ContentTypeConfig,
  workspaceId: string,
  currentId: string,
  category: string,
  limit: number,
): Promise<Record<string, unknown>[]> {
  const db = getDb() as any;
  const selectCols = config.contentTable === "products"
    ? "id, name, slug, cover_image, category, price, currency, views"
    : `id, ${config.titleCol}, slug, cover_image, category, excerpt, views, published_at`;

  const { data, error } = await db
    .from(config.contentTable)
    .select(selectCols)
    .eq("workspace_id", workspaceId)
    .eq("status", "published")
    .eq("category", category)
    .neq("id", currentId)
    .order("views", { ascending: false })
    .limit(limit);

  if (error) throw new Error(error.message);
  return (data ?? []) as Record<string, unknown>[];
}
