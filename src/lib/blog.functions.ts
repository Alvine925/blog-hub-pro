import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import type { BlogPost, BlogPostSummary } from "./blog-types";
import { slugify, estimateReadingTime } from "./blog-types";

const SUMMARY_COLUMNS =
  "id, title, slug, excerpt, cover_image, category, tags, author_name, seo_title, meta_description, featured, status, published_at, reading_time, views, created_at, updated_at";

function normalizeTags(tags: unknown): string[] {
  if (Array.isArray(tags)) return tags.map((t) => String(t));
  return [];
}

// ---------------------------------------------------------------------------
// PUBLIC READS (published only)
// ---------------------------------------------------------------------------

export const listPublishedPosts = createServerFn({ method: "GET" })
  .inputValidator(
    (input: { search?: string; category?: string } | undefined) => input ?? {},
  )
  .handler(async ({ data }): Promise<BlogPostSummary[]> => {
    const { getAdminClient } = await import("./supabase.server");
    const supabase = getAdminClient();

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
      // Match title, excerpt, content or category. Tags handled below.
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
  .inputValidator((input: { slug: string }) =>
    z.object({ slug: z.string().min(1).max(120) }).parse(input),
  )
  .handler(async ({ data }): Promise<BlogPost | null> => {
    const { getAdminClient } = await import("./supabase.server");
    const supabase = getAdminClient();

    const { data: row, error } = await supabase
      .from("blog_posts")
      .select("*")
      .eq("slug", data.slug)
      .eq("status", "published")
      .maybeSingle();

    if (error) throw new Error(error.message);
    if (!row) return null;

    // Fire-and-forget view increment.
    await supabase
      .from("blog_posts")
      .update({ views: (row.views ?? 0) + 1 })
      .eq("id", row.id);

    return { ...(row as BlogPost), tags: normalizeTags(row.tags) };
  });

export const getRelatedPosts = createServerFn({ method: "GET" })
  .inputValidator((input: { slug: string; category: string; tags: string[] }) =>
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
    const supabase = getAdminClient();

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

    // Fallback: if not enough same-category matches, fill with recent posts.
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
// ADMIN OPERATIONS (service role — no public exposure of drafts via UI gate)
// ---------------------------------------------------------------------------

export const adminListPosts = createServerFn({ method: "GET" }).handler(
  async (): Promise<BlogPostSummary[]> => {
    const { getAdminClient } = await import("./supabase.server");
    const supabase = getAdminClient();

    const { data: rows, error } = await supabase
      .from("blog_posts")
      .select(SUMMARY_COLUMNS)
      .order("updated_at", { ascending: false })
      .limit(500);

    if (error) throw new Error(error.message);
    return (rows ?? []).map((r) => ({
      ...(r as BlogPostSummary),
      tags: normalizeTags((r as { tags: unknown }).tags),
    }));
  },
);

export const adminGetPost = createServerFn({ method: "GET" })
  .inputValidator((input: { id: string }) =>
    z.object({ id: z.string().uuid() }).parse(input),
  )
  .handler(async ({ data }): Promise<BlogPost | null> => {
    const { getAdminClient } = await import("./supabase.server");
    const supabase = getAdminClient();

    const { data: row, error } = await supabase
      .from("blog_posts")
      .select("*")
      .eq("id", data.id)
      .maybeSingle();

    if (error) throw new Error(error.message);
    if (!row) return null;
    return { ...(row as BlogPost), tags: normalizeTags(row.tags) };
  });

export const checkSlugAvailable = createServerFn({ method: "GET" })
  .inputValidator((input: { slug: string; excludeId?: string }) =>
    z
      .object({ slug: z.string().min(1), excludeId: z.string().uuid().optional() })
      .parse(input),
  )
  .handler(async ({ data }): Promise<{ available: boolean }> => {
    const { getAdminClient } = await import("./supabase.server");
    const supabase = getAdminClient();

    let query = supabase.from("blog_posts").select("id").eq("slug", data.slug);
    if (data.excludeId) query = query.neq("id", data.excludeId);
    const { data: rows, error } = await query.limit(1);
    if (error) throw new Error(error.message);
    return { available: (rows ?? []).length === 0 };
  });

const postInputSchema = z.object({
  id: z.string().uuid().optional(),
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
  status: z.enum(["draft", "published"]).default("draft"),
});

export const upsertPost = createServerFn({ method: "POST" })
  .inputValidator((input: unknown) => postInputSchema.parse(input))
  .handler(async ({ data }): Promise<{ id: string; slug: string }> => {
    const { getAdminClient } = await import("./supabase.server");
    const supabase = getAdminClient();

    let slug = slugify(data.slug || data.title);
    if (!slug) slug = `post-${Date.now()}`;

    // Ensure slug uniqueness (excluding self).
    let unique = slug;
    let attempt = 1;
    // eslint-disable-next-line no-constant-condition
    while (true) {
      let q = supabase.from("blog_posts").select("id").eq("slug", unique);
      if (data.id) q = q.neq("id", data.id);
      const { data: clash, error } = await q.limit(1);
      if (error) throw new Error(error.message);
      if (!clash || clash.length === 0) break;
      unique = `${slug}-${attempt++}`;
    }

    const record = {
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
      reading_time: estimateReadingTime(data.content),
    };

    if (data.id) {
      const { data: row, error } = await supabase
        .from("blog_posts")
        .update(record)
        .eq("id", data.id)
        .select("id, slug")
        .single();
      if (error) throw new Error(error.message);
      return { id: row.id, slug: row.slug };
    }

    const { data: row, error } = await supabase
      .from("blog_posts")
      .insert(record)
      .select("id, slug")
      .single();
    if (error) throw new Error(error.message);
    return { id: row.id, slug: row.slug };
  });

export const setPostStatus = createServerFn({ method: "POST" })
  .inputValidator((input: { id: string; status: "draft" | "published" }) =>
    z
      .object({ id: z.string().uuid(), status: z.enum(["draft", "published"]) })
      .parse(input),
  )
  .handler(async ({ data }): Promise<{ ok: true }> => {
    const { getAdminClient } = await import("./supabase.server");
    const supabase = getAdminClient();
    const { error } = await supabase
      .from("blog_posts")
      .update({ status: data.status })
      .eq("id", data.id);
    if (error) throw new Error(error.message);
    return { ok: true };
  });

export const deletePost = createServerFn({ method: "POST" })
  .inputValidator((input: { id: string }) =>
    z.object({ id: z.string().uuid() }).parse(input),
  )
  .handler(async ({ data }): Promise<{ ok: true }> => {
    const { getAdminClient } = await import("./supabase.server");
    const supabase = getAdminClient();
    const { error } = await supabase.from("blog_posts").delete().eq("id", data.id);
    if (error) throw new Error(error.message);
    return { ok: true };
  });

export const uploadCoverImage = createServerFn({ method: "POST" })
  .inputValidator((input: { fileBase64: string; fileName: string; contentType: string }) =>
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
    const supabase = getAdminClient();

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

    // Private bucket -> long-lived signed URL (10 years).
    const { data: signed, error: signError } = await supabase.storage
      .from(BLOG_BUCKET)
      .createSignedUrl(path, 60 * 60 * 24 * 365 * 10);
    if (signError || !signed) throw new Error(signError?.message || "Failed to sign URL");

    return { url: signed.signedUrl };
  });
