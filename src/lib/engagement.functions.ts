import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";

// ── Types ─────────────────────────────────────────────────────────────────────

export interface EngagementFeatures {
  likes: boolean;
  comments: boolean;
  socialShare: boolean;
  relatedPosts: boolean;
  viewTracking: boolean;
  poweredBy: boolean;
}

export interface EngagementBranding {
  enabled: boolean;
  text: string;
  url: string;
}

export interface EngagementCommentSettings {
  requireApproval: boolean;
  allowGuest: boolean;
  maxDepth: number;
}

export interface EngagementSettings {
  features: EngagementFeatures;
  branding: EngagementBranding;
  commentSettings: EngagementCommentSettings;
}

export interface AdminComment {
  id: string;
  blog_post_id: string;
  parent_id: string | null;
  author_name: string;
  author_email: string;
  author_website: string | null;
  content: string;
  status: string;
  created_at: string;
  moderated_at: string | null;
  post_slug: string | null;
  post_title: string | null;
}

// ── Defaults ──────────────────────────────────────────────────────────────────

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

// ── Server functions ──────────────────────────────────────────────────────────

export const getEngagementSettings = createServerFn({ method: "GET" })
  .validator((input: { workspaceId: string }) => input)
  .handler(async ({ data }): Promise<EngagementSettings> => {
    const { getAdminClient } = await import("./supabase.server");
    const db = getAdminClient() as any;
    const { data: ws } = await db
      .from("workspaces")
      .select("engagement_settings")
      .eq("id", data.workspaceId)
      .single();
    if (!ws?.engagement_settings) return DEFAULT_SETTINGS;
    const s = ws.engagement_settings as any;
    return {
      features: { ...DEFAULT_SETTINGS.features, ...(s.features ?? {}) },
      branding: { ...DEFAULT_SETTINGS.branding, ...(s.branding ?? {}) },
      commentSettings: { ...DEFAULT_SETTINGS.commentSettings, ...(s.commentSettings ?? {}) },
    };
  });

const engagementSchema = z.object({
  workspaceId: z.string().uuid(),
  features: z.object({
    likes: z.boolean(),
    comments: z.boolean(),
    socialShare: z.boolean(),
    relatedPosts: z.boolean(),
    viewTracking: z.boolean(),
    poweredBy: z.boolean(),
  }),
  branding: z.object({
    enabled: z.boolean(),
    text: z.string().trim().max(200),
    url: z.string().trim().max(200),
  }),
  commentSettings: z.object({
    requireApproval: z.boolean(),
    allowGuest: z.boolean(),
    maxDepth: z.number().int().min(1).max(10),
  }),
});

export const saveEngagementSettings = createServerFn({ method: "POST" })
  .validator((input: unknown) => engagementSchema.parse(input))
  .handler(async ({ data }): Promise<{ ok: true }> => {
    const { getAdminClient } = await import("./supabase.server");
    const db = getAdminClient() as any;
    const { workspaceId, ...settings } = data;
    const { error } = await db
      .from("workspaces")
      .update({ engagement_settings: settings })
      .eq("id", workspaceId);
    if (error) throw new Error(error.message);
    return { ok: true };
  });

export const getAdminComments = createServerFn({ method: "GET" })
  .validator((input: { workspaceId: string; status: string; page: number; limit: number }) => input)
  .handler(async ({ data }): Promise<{ rows: AdminComment[]; total: number }> => {
    const { getAdminClient } = await import("./supabase.server");
    const db = getAdminClient() as any;
    const { workspaceId, status, page, limit } = data;
    const offset = (page - 1) * limit;

    const { data: rows, error, count } = await db
      .from("blog_comments")
      .select(
        "id, blog_post_id, parent_id, author_name, author_email, author_website, content, status, created_at, moderated_at, blog_posts(slug,title)",
        { count: "exact" },
      )
      .eq("workspace_id", workspaceId)
      .eq("status", status)
      .order("created_at", { ascending: false })
      .range(offset, offset + limit - 1);

    if (error) throw new Error(error.message);

    return {
      rows: (rows ?? []).map((r: any) => ({
        id: r.id,
        blog_post_id: r.blog_post_id,
        parent_id: r.parent_id ?? null,
        author_name: r.author_name ?? "Anonymous",
        author_email: r.author_email ?? "",
        author_website: r.author_website ?? null,
        content: r.content ?? "",
        status: r.status,
        created_at: r.created_at,
        moderated_at: r.moderated_at ?? null,
        post_slug: r.blog_posts?.slug ?? null,
        post_title: r.blog_posts?.title ?? null,
      })),
      total: count ?? 0,
    };
  });

const moderateSchema = z.object({
  commentId: z.string().uuid(),
  workspaceId: z.string().uuid(),
  status: z.enum(["approved", "rejected", "spam", "trash", "pending"]),
});

export const moderateCommentFn = createServerFn({ method: "POST" })
  .validator((input: unknown) => moderateSchema.parse(input))
  .handler(async ({ data }): Promise<{ ok: true }> => {
    const { getAdminClient } = await import("./supabase.server");
    const db = getAdminClient() as any;
    const { error } = await db
      .from("blog_comments")
      .update({ status: data.status, moderated_at: new Date().toISOString() })
      .eq("id", data.commentId)
      .eq("workspace_id", data.workspaceId);
    if (error) throw new Error(error.message);
    return { ok: true };
  });

const deleteCommentSchema = z.object({
  commentId: z.string().uuid(),
  workspaceId: z.string().uuid(),
});

export const deleteCommentFn = createServerFn({ method: "POST" })
  .validator((input: unknown) => deleteCommentSchema.parse(input))
  .handler(async ({ data }): Promise<{ ok: true }> => {
    const { getAdminClient } = await import("./supabase.server");
    const db = getAdminClient() as any;
    const { error } = await db
      .from("blog_comments")
      .delete()
      .eq("id", data.commentId)
      .eq("workspace_id", data.workspaceId);
    if (error) throw new Error(error.message);
    return { ok: true };
  });
