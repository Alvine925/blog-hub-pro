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

    // Fetch comments without a relationship join — PostgREST relationship joins
    // require a fresh schema cache after migrations and fail silently in the UI.
    // We do a separate batch lookup for post titles instead.
    const { data: rows, error, count } = await db
      .from("blog_comments")
      .select(
        "id, blog_post_id, parent_id, author_name, author_email, author_website, content, status, created_at, moderated_at",
        { count: "exact" },
      )
      .eq("workspace_id", workspaceId)
      .eq("status", status)
      .order("created_at", { ascending: false })
      .range(offset, offset + limit - 1);

    if (error) throw new Error(error.message);

    // Batch-fetch post slug + title for the returned comments
    const postIds = [...new Set(
      (rows ?? []).map((r: any) => r.blog_post_id as string).filter(Boolean),
    )];
    const postMap: Record<string, { slug: string; title: string }> = {};
    if (postIds.length > 0) {
      const { data: posts } = await db
        .from("blog_posts")
        .select("id, slug, title")
        .in("id", postIds);
      for (const p of (posts ?? []) as any[]) {
        postMap[p.id] = { slug: p.slug, title: p.title };
      }
    }

    return {
      rows: (rows ?? []).map((r: any) => ({
        id:             r.id,
        blog_post_id:   r.blog_post_id,
        parent_id:      r.parent_id ?? null,
        author_name:    r.author_name ?? "Anonymous",
        author_email:   r.author_email ?? "",
        author_website: r.author_website ?? null,
        content:        r.content ?? "",
        status:         r.status,
        created_at:     r.created_at,
        moderated_at:   r.moderated_at ?? null,
        post_slug:      postMap[r.blog_post_id]?.slug ?? null,
        post_title:     postMap[r.blog_post_id]?.title ?? null,
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

// ── Content engagement (news / articles / products) ────────────────────────────

type ContentEngagementType = "news" | "articles" | "products";

/** Maps content type → engagement table names and FK column */
const CONTENT_ENGAGEMENT_CONFIG: Record<ContentEngagementType, {
  likesTable:    string;
  commentsTable: string;
  viewsTable:    string;
  sharesTable:   string;
  idCol:         string;
  contentTable:  string;
  titleCol:      string;
}> = {
  news: {
    likesTable:    "news_likes",
    commentsTable: "news_comments",
    viewsTable:    "news_views",
    sharesTable:   "news_shares",
    idCol:         "news_id",
    contentTable:  "news",
    titleCol:      "title",
  },
  articles: {
    likesTable:    "articles_likes",
    commentsTable: "articles_comments",
    viewsTable:    "articles_views",
    sharesTable:   "articles_shares",
    idCol:         "article_id",
    contentTable:  "articles",
    titleCol:      "title",
  },
  products: {
    likesTable:    "products_likes",
    commentsTable: "products_comments",
    viewsTable:    "products_views",
    sharesTable:   "products_shares",
    idCol:         "product_id",
    contentTable:  "products",
    titleCol:      "name",
  },
};

export interface ContentEngagementStats {
  likes:    number;
  comments: number;
  views:    number;
  shares:   number;
}

/** Aggregated engagement stats for a single news / article / product item. */
export const getContentEngagementStats = createServerFn({ method: "GET" })
  .validator((d: { workspaceId: string; contentType: ContentEngagementType; contentId: string }) => d)
  .handler(async ({ data }): Promise<ContentEngagementStats> => {
    const { getAdminClient } = await import("./supabase.server");
    const db  = getAdminClient() as any;
    const cfg = CONTENT_ENGAGEMENT_CONFIG[data.contentType];

    const [likes, comments, views, shares] = await Promise.all([
      db.from(cfg.likesTable)
        .select("id", { count: "exact", head: true })
        .eq(cfg.idCol, data.contentId),
      db.from(cfg.commentsTable)
        .select("id", { count: "exact", head: true })
        .eq(cfg.idCol, data.contentId)
        .eq("status", "approved"),
      db.from(cfg.viewsTable)
        .select("id", { count: "exact", head: true })
        .eq(cfg.idCol, data.contentId),
      db.from(cfg.sharesTable)
        .select("id", { count: "exact", head: true })
        .eq(cfg.idCol, data.contentId),
    ]);

    return {
      likes:    likes.count    ?? 0,
      comments: comments.count ?? 0,
      views:    views.count    ?? 0,
      shares:   shares.count   ?? 0,
    };
  });

export interface ContentAdminComment {
  id:            string;
  content_id:    string;
  content_type:  ContentEngagementType;
  parent_id:     string | null;
  author_name:   string;
  author_email:  string;
  author_website: string | null;
  content:       string;
  status:        string;
  created_at:    string;
  moderated_at:  string | null;
  post_title:    string | null;
}

/** List comments across news / articles / products for the moderation UI. */
export const getAdminContentComments = createServerFn({ method: "GET" })
  .validator((d: {
    workspaceId:  string;
    contentType:  ContentEngagementType;
    status:       string;
    page:         number;
    limit:        number;
  }) => d)
  .handler(async ({ data }): Promise<{ rows: ContentAdminComment[]; total: number }> => {
    const { getAdminClient } = await import("./supabase.server");
    const db  = getAdminClient() as any;
    const cfg = CONTENT_ENGAGEMENT_CONFIG[data.contentType];
    if (!cfg) return { rows: [], total: 0 };          // guard against null/invalid contentType
    const offset = (data.page - 1) * data.limit;

    // Fetch comments without a relationship join — do a separate batch title lookup instead.
    const plainSelect = `id, ${cfg.idCol}, parent_id, author_name, author_email, author_website, content, status, created_at, moderated_at`;

    const { data: rows, count, error } = await db
      .from(cfg.commentsTable)
      .select(plainSelect, { count: "exact" })
      .eq("workspace_id", data.workspaceId)
      .eq("status", data.status)
      .order("created_at", { ascending: false })
      .range(offset, offset + data.limit - 1);

    if (error) throw new Error(error.message);

    // Batch-fetch content titles
    const contentIds = [...new Set(
      (rows ?? []).map((r: any) => r[cfg.idCol] as string).filter(Boolean),
    )];
    const titleMap: Record<string, string> = {};
    if (contentIds.length > 0) {
      const { data: items } = await db
        .from(cfg.contentTable)
        .select(`id, ${cfg.titleCol}`)
        .in("id", contentIds);
      for (const item of (items ?? []) as any[]) {
        titleMap[item.id] = item[cfg.titleCol] ?? null;
      }
    }

    return {
      rows: (rows ?? []).map((r: any) => ({
        id:             r.id as string,
        content_id:     r[cfg.idCol] as string,
        content_type:   data.contentType,
        parent_id:      (r.parent_id as string | null) ?? null,
        author_name:    r.author_name as string,
        author_email:   r.author_email as string,
        author_website: (r.author_website as string | null) ?? null,
        content:        r.content as string,
        status:         r.status as string,
        created_at:     r.created_at as string,
        moderated_at:   (r.moderated_at as string | null) ?? null,
        post_title:     titleMap[r[cfg.idCol]] ?? null,
      })),
      total: count ?? 0,
    };
  });

const contentModerateSchema = z.object({
  commentId:   z.string().uuid(),
  workspaceId: z.string().uuid(),
  contentType: z.enum(["news", "articles", "products"]),
  status:      z.enum(["approved", "rejected", "spam", "trash", "pending"]),
});

export const moderateContentCommentFn = createServerFn({ method: "POST" })
  .validator((d: unknown) => contentModerateSchema.parse(d))
  .handler(async ({ data }): Promise<{ ok: true }> => {
    const { getAdminClient } = await import("./supabase.server");
    const db  = getAdminClient() as any;
    const cfg = CONTENT_ENGAGEMENT_CONFIG[data.contentType];
    const { error } = await db
      .from(cfg.commentsTable)
      .update({ status: data.status, moderated_at: new Date().toISOString() })
      .eq("id", data.commentId)
      .eq("workspace_id", data.workspaceId);
    if (error) throw new Error(error.message);
    return { ok: true };
  });

const contentDeleteSchema = z.object({
  commentId:   z.string().uuid(),
  workspaceId: z.string().uuid(),
  contentType: z.enum(["news", "articles", "products"]),
});

export const deleteContentCommentFn = createServerFn({ method: "POST" })
  .validator((d: unknown) => contentDeleteSchema.parse(d))
  .handler(async ({ data }): Promise<{ ok: true }> => {
    const { getAdminClient } = await import("./supabase.server");
    const db  = getAdminClient() as any;
    const cfg = CONTENT_ENGAGEMENT_CONFIG[data.contentType];
    const { error } = await db
      .from(cfg.commentsTable)
      .delete()
      .eq("id", data.commentId)
      .eq("workspace_id", data.workspaceId);
    if (error) throw new Error(error.message);
    return { ok: true };
  });

// ── Batch engagement stats for list pages ─────────────────────────────────────

/**
 * Fetch engagement stats for multiple content items in a single batch.
 * Returns a map of contentId → { likes, comments, views, shares }.
 * Uses 4 queries total regardless of item count — avoids N+1 problem.
 */
export const getBatchContentEngagementStats = createServerFn({ method: "GET" })
  .validator((d: { workspaceId: string; contentType: ContentEngagementType; ids: string[] }) => d)
  .handler(async ({ data }): Promise<Record<string, ContentEngagementStats>> => {
    if (data.ids.length === 0) return {};
    const { getAdminClient } = await import("./supabase.server");
    const db  = getAdminClient() as any;
    const cfg = CONTENT_ENGAGEMENT_CONFIG[data.contentType];

    const [likesRes, commentsRes, viewsRes, sharesRes] = await Promise.all([
      db.from(cfg.likesTable)   .select(cfg.idCol).eq("workspace_id", data.workspaceId).in(cfg.idCol, data.ids),
      db.from(cfg.commentsTable).select(cfg.idCol).eq("workspace_id", data.workspaceId).in(cfg.idCol, data.ids).eq("status", "approved"),
      db.from(cfg.viewsTable)   .select(cfg.idCol).eq("workspace_id", data.workspaceId).in(cfg.idCol, data.ids),
      db.from(cfg.sharesTable)  .select(cfg.idCol).eq("workspace_id", data.workspaceId).in(cfg.idCol, data.ids),
    ]);

    function tally(rows: Record<string, string>[] | null): Record<string, number> {
      const map: Record<string, number> = {};
      for (const r of (rows ?? [])) {
        const id = r[cfg.idCol];
        map[id] = (map[id] ?? 0) + 1;
      }
      return map;
    }

    const likes    = tally(likesRes.data);
    const comments = tally(commentsRes.data);
    const views    = tally(viewsRes.data);
    const shares   = tally(sharesRes.data);

    const result: Record<string, ContentEngagementStats> = {};
    for (const id of data.ids) {
      result[id] = {
        likes:    likes[id]    ?? 0,
        comments: comments[id] ?? 0,
        views:    views[id]    ?? 0,
        shares:   shares[id]   ?? 0,
      };
    }
    return result;
  });

// ── Global content comments (cross-workspace, for admin moderation panel) ─────

export interface ContentAdminCommentGlobal extends ContentAdminComment {
  workspace_id: string;
}

/** List content-type comments across ALL workspaces — for the global admin moderation page. */
export const listAdminContentCommentsGlobal = createServerFn({ method: "GET" })
  .validator((d: { contentType: ContentEngagementType; status: string; page: number; limit: number }) => d)
  .handler(async ({ data }): Promise<{ rows: ContentAdminCommentGlobal[]; total: number }> => {
    const { getAdminClient } = await import("./supabase.server");
    const db  = getAdminClient() as any;
    const cfg = CONTENT_ENGAGEMENT_CONFIG[data.contentType];
    const offset = (data.page - 1) * data.limit;

    const joinSelect = `id, workspace_id, ${cfg.idCol}, parent_id, author_name, author_email, author_website, content, status, created_at, moderated_at, ${cfg.contentTable}(${cfg.titleCol})`;

    const { data: rows, count, error } = await db
      .from(cfg.commentsTable)
      .select(joinSelect, { count: "exact" })
      .eq("status", data.status)
      .order("created_at", { ascending: false })
      .range(offset, offset + data.limit - 1);

    if (error) throw new Error(error.message);

    return {
      rows: (rows ?? []).map((r: Record<string, unknown>) => ({
        id:             r.id          as string,
        workspace_id:   r.workspace_id as string,
        blog_post_id:   r[cfg.idCol]  as string, // satisfies ContentAdminComment shape; semantically = content_id
        content_id:     r[cfg.idCol]  as string,
        content_type:   data.contentType as "news" | "articles" | "products",
        parent_id:      (r.parent_id   as string | null) ?? null,
        author_name:    r.author_name  as string,
        author_email:   r.author_email as string,
        author_website: (r.author_website as string | null) ?? null,
        content:        r.content      as string,
        status:         r.status       as string,
        created_at:     r.created_at   as string,
        moderated_at:   (r.moderated_at as string | null) ?? null,
        post_slug:      null,
        post_title:     (r[cfg.contentTable] as Record<string, string> | null)?.[cfg.titleCol] ?? null,
      })),
      total: count ?? 0,
    };
  });
