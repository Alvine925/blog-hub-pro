import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import type { BlogPost, BlogPostSummary } from "./blog-types";
import { slugify, estimateReadingTime } from "./blog-types";

const SUMMARY_COLUMNS =
  "id, title, slug, excerpt, cover_image, category, tags, author_name, seo_title, meta_description, featured, status, published_at, scheduled_at, reading_time, views, created_at, updated_at, og_image, og_title, og_description, twitter_card, canonical_url, robots, focus_keyword";

function normalizeTags(tags: unknown): string[] {
  if (Array.isArray(tags)) return tags.map((t) => String(t));
  return [];
}

// ---------------------------------------------------------------------------
// PUBLIC READS (published only — no workspace filter needed; slugs are unique)
// ---------------------------------------------------------------------------

export const listPublishedPosts = createServerFn({ method: "GET" })
  .validator(
    (input: { search?: string; category?: string } | undefined) => input ?? {},
  )
  .handler(async ({ data }): Promise<BlogPostSummary[]> => {
    const { getAdminClient } = await import("./supabase.server");
    const supabase = await getAdminClient();

    let query = supabase
      .from("blog_posts")
      .select(SUMMARY_COLUMNS)
      .eq("status", "published")
      .order("published_at", { ascending: false });

    if (data.category && data.category !== "All") {
      query = query.eq("category", data.category);
    }

    const search = data.search?.trim();
    if (search) {
      query = query.or(
        `title.ilike.%${search}%,excerpt.ilike.%${search}%,content.ilike.%${search}%,category.ilike.%${search}%`,
      );
    }

    const { data: rows, error } = await query.limit(200);
    if (error) throw new Error(error.message);

    return (rows ?? []).map((r) => ({
      ...(r as BlogPostSummary),
      tags: normalizeTags((r as { tags: unknown }).tags),
    }));
  });

export const getPostBySlug = createServerFn({ method: "GET" })
  .validator((input: { slug: string }) =>
    z.object({ slug: z.string().min(1).max(120) }).parse(input),
  )
  .handler(async ({ data }): Promise<BlogPost | null> => {
    const { getAdminClient } = await import("./supabase.server");
    const supabase = await getAdminClient();

    const { data: row, error } = await supabase
      .from("blog_posts")
      .select("*")
      .eq("slug", data.slug)
      .eq("status", "published")
      .maybeSingle();

    if (error) throw new Error(error.message);
    if (!row) return null;

    await supabase
      .from("blog_posts")
      .update({ views: (row.views ?? 0) + 1 })
      .eq("id", row.id);

    return { ...(row as BlogPost), tags: normalizeTags(row.tags) };
  });

export const getRelatedPosts = createServerFn({ method: "GET" })
  .validator((input: { slug: string; category: string; tags: string[] }) =>
    z
      .object({
        slug: z.string().min(1),
        category: z.string(),
        tags: z.array(z.string()).default([]),
      })
      .parse(input),
  )
  .handler(async ({ data }): Promise<BlogPostSummary[]> => {
    const { getAdminClient } = await import("./supabase.server");
    const supabase = await getAdminClient();

    const { data: rows, error } = await supabase
      .from("blog_posts")
      .select(SUMMARY_COLUMNS)
      .eq("status", "published")
      .neq("slug", data.slug)
      .eq("category", data.category)
      .order("published_at", { ascending: false })
      .limit(3);

    if (error) throw new Error(error.message);

    let results = (rows ?? []) as BlogPostSummary[];

    if (results.length < 3) {
      const { data: extra } = await supabase
        .from("blog_posts")
        .select(SUMMARY_COLUMNS)
        .eq("status", "published")
        .neq("slug", data.slug)
        .order("published_at", { ascending: false })
        .limit(6);
      const seen = new Set(results.map((r) => r.id));
      for (const row of (extra ?? []) as BlogPostSummary[]) {
        if (results.length >= 3) break;
        if (!seen.has(row.id)) results.push(row);
      }
    }

    return results
      .slice(0, 3)
      .map((r) => ({ ...r, tags: normalizeTags((r as { tags: unknown }).tags) }));
  });

// ---------------------------------------------------------------------------
// ADMIN OPERATIONS
// ---------------------------------------------------------------------------

/**
 * List posts for the admin dashboard.
 * When workspaceId is provided, results are scoped to that workspace only.
 * Without workspaceId the query still runs but returns the global view (super-admin).
 * All admin routes SHOULD pass workspaceId to enforce workspace isolation.
 */
export const adminListPosts = createServerFn({ method: "GET" })
  .validator((input: { workspaceId?: string } | undefined) =>
    z.object({ workspaceId: z.string().uuid().optional() }).parse(input ?? {}),
  )
  .handler(async ({ data }): Promise<BlogPostSummary[]> => {
    const { getAdminClient } = await import("./supabase.server");
    const supabase = await getAdminClient();

    let query = supabase
      .from("blog_posts")
      .select(SUMMARY_COLUMNS + ", workspace_id, workspace:workspaces(name)")
      .order("updated_at", { ascending: false })
      .limit(500);

    // WORKSPACE ISOLATION: always filter by workspace when one is specified
    if (data.workspaceId) {
      query = query.eq("workspace_id", data.workspaceId);
    }

    const { data: rows, error } = await query;

    if (error) {
      // FK not yet in place — fall back without workspace join
      if (error.message.includes("relationship") || error.message.includes("schema cache")) {
        let fallbackQuery = supabase
          .from("blog_posts")
          .select(SUMMARY_COLUMNS)
          .order("updated_at", { ascending: false })
          .limit(500);
        if (data.workspaceId) {
          fallbackQuery = fallbackQuery.eq("workspace_id", data.workspaceId);
        }
        const { data: fallback, error: fallbackError } = await fallbackQuery;
        if (fallbackError) throw new Error(fallbackError.message);
        return (fallback ?? []).map((r) => ({
          ...(r as BlogPostSummary),
          tags: normalizeTags((r as { tags: unknown }).tags),
        }));
      }
      throw new Error(error.message);
    }

    return (rows ?? []).map((r) => ({
      ...(r as BlogPostSummary),
      tags: normalizeTags((r as { tags: unknown }).tags),
    }));
  });

export const adminGetPost = createServerFn({ method: "GET" })
  .validator((input: { id: string; workspaceId?: string }) =>
    z.object({
      id: z.string().uuid(),
      workspaceId: z.string().uuid().optional(),
    }).parse(input),
  )
  .handler(async ({ data }): Promise<BlogPost | null> => {
    const { getAdminClient } = await import("./supabase.server");
    const supabase = await getAdminClient();

    let query = supabase
      .from("blog_posts")
      .select("*")
      .eq("id", data.id);

    // WORKSPACE ISOLATION: scope reads to the workspace when specified
    if (data.workspaceId) {
      query = query.eq("workspace_id", data.workspaceId);
    }

    const { data: row, error } = await query.maybeSingle();

    if (error) throw new Error(error.message);
    if (!row) return null;
    return { ...(row as BlogPost), tags: normalizeTags(row.tags) };
  });

export const checkSlugAvailable = createServerFn({ method: "GET" })
  .validator((input: { slug: string; excludeId?: string }) =>
    z
      .object({ slug: z.string().min(1), excludeId: z.string().uuid().optional() })
      .parse(input),
  )
  .handler(async ({ data }): Promise<{ available: boolean }> => {
    const { getAdminClient } = await import("./supabase.server");
    const supabase = await getAdminClient();

    let query = supabase.from("blog_posts").select("id").eq("slug", data.slug);
    if (data.excludeId) query = query.neq("id", data.excludeId);
    const { data: rows, error } = await query.limit(1);
    if (error) throw new Error(error.message);
    return { available: (rows ?? []).length === 0 };
  });

const postInputSchema = z.object({
  id: z.string().uuid().optional(),
  workspaceId: z.string().uuid().optional(),
  title: z.string().trim().min(1, "Title is required").max(200),
  slug: z.string().trim().min(1).max(120),
  excerpt: z.string().trim().max(500).default(""),
  content: z.string().default(""),
  cover_image: z.string().trim().max(2000).nullable().default(null),
  category: z.string().trim().min(1).max(60).default("General"),
  tags: z.array(z.string().trim().min(1).max(40)).max(30).default([]),
  author_name: z.string().trim().min(1).max(120).default("Admin"),
  seo_title: z.string().trim().max(200).nullable().default(null),
  meta_description: z.string().trim().max(320).nullable().default(null),
  featured: z.boolean().default(false),
  status: z.enum(["draft", "published", "scheduled"]).default("draft"),
  scheduled_at: z.string().nullable().optional(),
  // Extended SEO
  og_image: z.string().trim().max(2000).nullable().default(null),
  og_title: z.string().trim().max(200).nullable().default(null),
  og_description: z.string().trim().max(320).nullable().default(null),
  twitter_card: z.string().trim().max(40).nullable().default("summary_large_image"),
  canonical_url: z.string().trim().max(500).nullable().default(null),
  robots: z.string().trim().max(100).nullable().default("index, follow"),
  focus_keyword: z.string().trim().max(100).nullable().default(null),
});

export const upsertPost = createServerFn({ method: "POST" })
  .validator((input: unknown) => postInputSchema.parse(input))
  .handler(async ({ data }): Promise<{ id: string; slug: string }> => {
    const { getAdminClient } = await import("./supabase.server");
    const supabase = await getAdminClient();

    let slug = slugify(data.slug || data.title);
    if (!slug) slug = `post-${Date.now()}`;

    let unique = slug;
    let attempt = 1;
    while (true) {
      let q = supabase.from("blog_posts").select("id").eq("slug", unique);
      if (data.id) q = q.neq("id", data.id);
      const { data: clash, error } = await q.limit(1);
      if (error) throw new Error(error.message);
      if (!clash || clash.length === 0) break;
      unique = `${slug}-${attempt++}`;
    }

    const record: Record<string, unknown> = {
      title: data.title,
      slug: unique,
      excerpt: data.excerpt,
      content: data.content,
      cover_image: data.cover_image,
      category: data.category,
      tags: data.tags,
      author_name: data.author_name,
      seo_title: data.seo_title,
      meta_description: data.meta_description,
      featured: data.featured,
      status: data.status,
      scheduled_at: data.status === "scheduled" ? (data.scheduled_at ?? null) : null,
      reading_time: estimateReadingTime(data.content),
      og_image: data.og_image,
      og_title: data.og_title,
      og_description: data.og_description,
      twitter_card: data.twitter_card,
      canonical_url: data.canonical_url,
      robots: data.robots,
      focus_keyword: data.focus_keyword,
    };

    if (data.id) {
      // Save version snapshot before updating
      const { data: existing } = await supabase
        .from("blog_posts")
        .select("*")
        .eq("id", data.id)
        .maybeSingle();

      if (existing) {
        await supabase.from("post_versions").insert({
          post_id: data.id,
          title: existing.title,
          excerpt: existing.excerpt,
          status: existing.status,
          author_name: existing.author_name,
          snapshot: existing,
        });
      }

      // WORKSPACE ISOLATION: when workspaceId is provided, scope the update
      // to that workspace so a user cannot modify posts belonging to another workspace.
      let updateQuery = supabase
        .from("blog_posts")
        .update(record)
        .eq("id", data.id);
      if (data.workspaceId) {
        updateQuery = updateQuery.eq("workspace_id", data.workspaceId);
      }

      const { data: row, error } = await updateQuery
        .select("id, slug, status, title, category, published_at, workspace_id")
        .single();
      if (error) throw new Error(error.message);
      if (data.status === "published") {
        import("./webhook.functions").then(({ dispatchWebhooks, fireCacheInvalidation }) => {
          const payload = {
            id: row.id, slug: row.slug, title: data.title,
            status: "published", category: data.category, author_name: data.author_name,
          };
          dispatchWebhooks("post.updated", payload).catch(() => {});
          dispatchWebhooks("cache.invalidate", { ...payload, reason: "post.updated" }).catch(() => {});
          if (row.workspace_id) {
            fireCacheInvalidation("blog.updated", row.workspace_id, row.slug).catch(() => {});
          }
        });
      }
      return { id: row.id, slug: row.slug };
    }

    // INSERT: set workspace_id from the provided context
    if (data.workspaceId) {
      record.workspace_id = data.workspaceId;
    }

    const { data: row, error } = await supabase
      .from("blog_posts")
      .insert(record)
      .select("id, slug, status, title, category, published_at, workspace_id")
      .single();
    if (error) throw new Error(error.message);
    if (data.status === "published") {
      import("./webhook.functions").then(({ dispatchWebhooks, fireCacheInvalidation }) => {
        const payload = {
          id: row.id, slug: row.slug, title: data.title,
          status: "published", category: data.category, author_name: data.author_name,
        };
        dispatchWebhooks("post.published", payload).catch(() => {});
        dispatchWebhooks("cache.invalidate", { ...payload, reason: "post.published" }).catch(() => {});
        if (row.workspace_id) {
          fireCacheInvalidation("blog.published", row.workspace_id, row.slug).catch(() => {});
        }
      });
    }
    return { id: row.id, slug: row.slug };
  });

export const setPostStatus = createServerFn({ method: "POST" })
  .validator((input: { id: string; status: "draft" | "published" | "scheduled"; workspaceId?: string }) =>
    z
      .object({
        id: z.string().uuid(),
        status: z.enum(["draft", "published", "scheduled"]),
        workspaceId: z.string().uuid().optional(),
      })
      .parse(input),
  )
  .handler(async ({ data }): Promise<{ ok: true }> => {
    const { getAdminClient } = await import("./supabase.server");
    const supabase = await getAdminClient();
    const update: Record<string, unknown> = { status: data.status };
    if (data.status !== "scheduled") update.scheduled_at = null;
    if (data.status === "published") update.published_at = new Date().toISOString();

    // WORKSPACE ISOLATION: scope the update to the workspace when provided
    let updateQuery = supabase.from("blog_posts").update(update).eq("id", data.id);
    if (data.workspaceId) {
      updateQuery = updateQuery.eq("workspace_id", data.workspaceId);
    }

    const { data: row, error } = await updateQuery
      .select("id, slug, title, category, author_name, workspace_id")
      .single();
    if (error) throw new Error(error.message);
    const webhookEvent =
      data.status === "published" ? "post.published" : "post.unpublished";
    import("./webhook.functions").then(({ dispatchWebhooks, fireCacheInvalidation }) => {
      const payload = {
        id: row.id, slug: row.slug, title: row.title,
        status: data.status, category: row.category, author_name: row.author_name,
      };
      dispatchWebhooks(webhookEvent, payload).catch(() => {});
      dispatchWebhooks("cache.invalidate", { ...payload, reason: webhookEvent }).catch(() => {});
      if (row.workspace_id) {
        const cacheEvent = data.status === "published" ? "blog.published" : "blog.updated";
        fireCacheInvalidation(cacheEvent, row.workspace_id, row.slug).catch(() => {});
      }
    });
    return { ok: true };
  });

export const deletePost = createServerFn({ method: "POST" })
  .validator((input: { id: string; workspaceId?: string }) =>
    z.object({
      id: z.string().uuid(),
      workspaceId: z.string().uuid().optional(),
    }).parse(input),
  )
  .handler(async ({ data }): Promise<{ ok: true }> => {
    const { getAdminClient } = await import("./supabase.server");
    const supabase = await getAdminClient();
    const { data: post } = await supabase
      .from("blog_posts")
      .select("id, slug, title, status, category, author_name, workspace_id")
      .eq("id", data.id)
      .maybeSingle();

    // WORKSPACE ISOLATION: verify the post belongs to the expected workspace
    if (data.workspaceId && post && post.workspace_id !== data.workspaceId) {
      throw new Error("Forbidden: this post does not belong to the specified workspace");
    }

    const { error } = await supabase.from("blog_posts").delete().eq("id", data.id);
    if (error) throw new Error(error.message);
    if (post) {
      import("./webhook.functions").then(({ dispatchWebhooks, fireCacheInvalidation }) => {
        const payload = {
          id: post.id, slug: post.slug, title: post.title,
          status: post.status, category: post.category, author_name: post.author_name,
        };
        dispatchWebhooks("post.deleted", payload).catch(() => {});
        dispatchWebhooks("cache.invalidate", { ...payload, reason: "post.deleted" }).catch(() => {});
        if (post.workspace_id) {
          fireCacheInvalidation("blog.deleted", post.workspace_id, post.slug).catch(() => {});
        }
      });
    }
    return { ok: true };
  });

export const uploadCoverImage = createServerFn({ method: "POST" })
  .validator((input: { fileBase64: string; fileName: string; contentType: string }) =>
    z
      .object({
        fileBase64: z.string().min(1),
        fileName: z.string().min(1).max(200),
        contentType: z.string().min(1).max(100),
      })
      .parse(input),
  )
  .handler(async ({ data }): Promise<{ url: string }> => {
    const { getAdminClient, BLOG_BUCKET } = await import("./supabase.server");
    const supabase = await getAdminClient();

    const base64 = data.fileBase64.includes(",")
      ? data.fileBase64.split(",")[1]
      : data.fileBase64;
    const buffer = Buffer.from(base64, "base64");

    if (buffer.length > 5 * 1024 * 1024) {
      throw new Error("Image must be smaller than 5MB.");
    }

    const ext = (data.fileName.split(".").pop() || "jpg").toLowerCase().slice(0, 5);
    const path = `covers/${Date.now()}-${Math.random().toString(36).slice(2, 8)}.${ext}`;

    const { error: uploadError } = await supabase.storage
      .from(BLOG_BUCKET)
      .upload(path, buffer, { contentType: data.contentType, upsert: false });
    if (uploadError) throw new Error(uploadError.message);

    const { data: signed, error: signError } = await supabase.storage
      .from(BLOG_BUCKET)
      .createSignedUrl(path, 60 * 60 * 24 * 365 * 10);
    if (signError || !signed) throw new Error(signError?.message || "Failed to sign URL");

    return { url: signed.signedUrl };
  });

export const publishScheduledPosts = createServerFn({ method: "POST" }).handler(
  async (): Promise<{ published: number }> => {
    const { getAdminClient } = await import("./supabase.server");
    const supabase = await getAdminClient();
    const now = new Date().toISOString();
    const { data: due, error } = await supabase
      .from("blog_posts")
      .select("id, slug, title, category, author_name, workspace_id")
      .eq("status", "scheduled")
      .lte("scheduled_at", now);
    if (error || !due || due.length === 0) return { published: 0 };
    const ids = due.map((p) => p.id);
    await supabase
      .from("blog_posts")
      .update({ status: "published", published_at: now, scheduled_at: null })
      .in("id", ids);
    for (const post of due) {
      import("./webhook.functions").then(({ dispatchWebhooks, fireCacheInvalidation }) => {
        const payload = {
          id: post.id, slug: post.slug, title: post.title,
          status: "published", category: post.category, author_name: post.author_name,
        };
        dispatchWebhooks("post.published", payload).catch(() => {});
        if (post.workspace_id) {
          fireCacheInvalidation("blog.published", post.workspace_id, post.slug).catch(() => {});
        }
      });
    }
    return { published: due.length };
  },
);
