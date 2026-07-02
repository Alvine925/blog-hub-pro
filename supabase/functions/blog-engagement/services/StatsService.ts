/**
 * StatsService.ts — aggregated engagement stats + workspace feature
 * flags/branding for a single post. Powers the "stats" and "features"
 * blocks external integrators use to render like/comment/share widgets.
 */
import { getDb } from "../db.ts";
import { countApprovedComments } from "./CommentService.ts";

export interface EngagementSettings {
  features: {
    likes: boolean;
    comments: boolean;
    socialShare: boolean;
    relatedPosts: boolean;
    viewTracking: boolean;
    poweredBy: boolean;
  };
  branding: {
    enabled: boolean;
    text: string;
    url: string;
  };
  commentSettings: {
    requireApproval: boolean;
    allowGuest: boolean;
    maxDepth: number;
  };
}

const DEFAULT_SETTINGS: EngagementSettings = {
  features: {
    likes: true,
    comments: true,
    socialShare: true,
    relatedPosts: true,
    viewTracking: true,
    poweredBy: true,
  },
  branding: {
    enabled: true,
    text: "Powered by Lunar CMS",
    url: "https://lunarcms.com",
  },
  commentSettings: {
    requireApproval: true,
    allowGuest: true,
    maxDepth: 3,
  },
};

export async function getEngagementSettings(workspaceId: string): Promise<EngagementSettings> {
  const { data, error } = await getDb()
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
    features: { ...DEFAULT_SETTINGS.features, ...(raw.features ?? {}) },
    branding: { ...DEFAULT_SETTINGS.branding, ...(raw.branding ?? {}) },
    commentSettings: { ...DEFAULT_SETTINGS.commentSettings, ...(raw.commentSettings ?? {}) },
  };
}

export interface PostStats {
  views: number;
  likes: number;
  comments: number;
  shares: number;
  readingTime: number;
  wordCount: number;
}

export async function getPostStats(postId: string): Promise<PostStats> {
  const db = getDb();

  const [{ data: post, error: postErr }, likesCount, commentsCount, sharesCount] = await Promise.all([
    db.from("blog_posts").select("views, reading_time, word_count").eq("id", postId).maybeSingle(),
    db.from("blog_likes").select("id", { count: "exact", head: true }).eq("blog_post_id", postId),
    countApprovedComments(postId),
    db.from("blog_shares").select("id", { count: "exact", head: true }).eq("blog_post_id", postId),
  ]);

  if (postErr) throw new Error(postErr.message);

  const row = (post as Record<string, unknown> | null) ?? {};

  return {
    views: Number(row.views) || 0,
    likes: (likesCount as { count: number | null }).count ?? 0,
    comments: commentsCount,
    shares: (sharesCount as { count: number | null }).count ?? 0,
    readingTime: Number(row.reading_time) || 1,
    wordCount: Number(row.word_count) || 0,
  };
}
