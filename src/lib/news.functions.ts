import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";

function slugify(s: string): string {
  return s
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "");
}

export interface NewsItem {
  id: string;
  workspace_id: string | null;
  title: string;
  slug: string;
  excerpt: string;
  content: string;
  cover_image: string | null;
  category: string;
  source_name: string | null;
  source_url: string | null;
  breaking: boolean;
  featured: boolean;
  status: "draft" | "published" | "scheduled";
  published_at: string | null;
  expires_at: string | null;
  seo_title: string | null;
  meta_description: string | null;
  views: number;
  created_at: string;
  updated_at: string;
}

export const listPublishedNews = createServerFn({ method: "GET" })
  .validator((input: { workspaceId: string; category?: string } | undefined) =>
    z.object({ workspaceId: z.string().uuid(), category: z.string().optional() }).parse(input),
  )
  .handler(async ({ data }): Promise<NewsItem[]> => {
    const { getAdminClient } = await import("./supabase.server");
    const supabase = (await getAdminClient()) as any;

    let query = supabase
      .from("news")
      .select("*")
      .eq("workspace_id", data.workspaceId)
      .eq("status", "published")
      .order("published_at", { ascending: false });

    if (data.category && data.category !== "All") {
      query = query.eq("category", data.category);
    }

    const { data: rows, error } = await query.limit(200);
    if (error) throw new Error(error.message);
    return (rows ?? []) as NewsItem[];
  });

export const adminListNews = createServerFn({ method: "GET" })
  .validator((input: { workspaceId?: string } | undefined) =>
    z.object({ workspaceId: z.string().uuid().optional() }).parse(input ?? {}),
  )
  .handler(async ({ data }): Promise<NewsItem[]> => {
    const { getAdminClient } = await import("./supabase.server");
    const supabase = (await getAdminClient()) as any;

    let query = supabase
      .from("news")
      .select("*")
      .order("updated_at", { ascending: false })
      .limit(500);

    if (data.workspaceId) {
      query = query.eq("workspace_id", data.workspaceId);
    }

    const { data: rows, error } = await query;
    if (error) throw new Error(error.message);
    return (rows ?? []) as NewsItem[];
  });

const newsInputSchema = z.object({
  id: z.string().uuid().optional(),
  workspaceId: z.string().uuid(),
  title: z.string().trim().min(1, "Title is required").max(200),
  slug: z.string().trim().max(160).default(""),
  excerpt: z.string().trim().max(500).default(""),
  content: z.string().default(""),
  cover_image: z.string().trim().max(2000).nullable().default(null),
  category: z.string().trim().min(1).max(60).default("General"),
  source_name: z.string().trim().max(120).nullable().default(null),
  source_url: z.string().trim().max(1000).nullable().default(null),
  breaking: z.boolean().default(false),
  featured: z.boolean().default(false),
  status: z.enum(["draft", "published", "scheduled"]).default("draft"),
  seo_title: z.string().trim().max(200).nullable().default(null),
  meta_description: z.string().trim().max(320).nullable().default(null),
});

export const upsertNews = createServerFn({ method: "POST" })
  .validator((input: unknown) => newsInputSchema.parse(input))
  .handler(async ({ data }): Promise<{ id: string; slug: string }> => {
    const { getAdminClient } = await import("./supabase.server");
    const supabase = (await getAdminClient()) as any;

    let slug = slugify(data.slug || data.title);
    if (!slug) slug = `news-${Date.now()}`;

    let unique = slug;
    let attempt = 1;
    while (true) {
      let q = supabase
        .from("news")
        .select("id")
        .eq("workspace_id", data.workspaceId)
        .eq("slug", unique);
      if (data.id) q = q.neq("id", data.id);
      const { data: clash, error } = await q.limit(1);
      if (error) throw new Error(error.message);
      if (!clash || clash.length === 0) break;
      unique = `${slug}-${attempt++}`;
    }

    const record: Record<string, unknown> = {
      workspace_id: data.workspaceId,
      title: data.title,
      slug: unique,
      excerpt: data.excerpt,
      content: data.content,
      cover_image: data.cover_image,
      category: data.category,
      source_name: data.source_name,
      source_url: data.source_url,
      breaking: data.breaking,
      featured: data.featured,
      status: data.status,
      published_at: data.status === "published" ? new Date().toISOString() : null,
      seo_title: data.seo_title,
      meta_description: data.meta_description,
    };

    if (data.id) {
      const { error } = await supabase
        .from("news")
        .update(record)
        .eq("id", data.id)
        .eq("workspace_id", data.workspaceId);
      if (error) throw new Error(error.message);
      return { id: data.id, slug: unique };
    }

    const { data: inserted, error } = await supabase
      .from("news")
      .insert(record)
      .select("id")
      .single();
    if (error) throw new Error(error.message);
    return { id: (inserted as { id: string }).id, slug: unique };
  });

export const setNewsStatus = createServerFn({ method: "POST" })
  .validator((input: { id: string; workspaceId: string; status: "draft" | "published" | "scheduled" }) =>
    z
      .object({
        id: z.string().uuid(),
        workspaceId: z.string().uuid(),
        status: z.enum(["draft", "published", "scheduled"]),
      })
      .parse(input),
  )
  .handler(async ({ data }): Promise<{ success: true }> => {
    const { getAdminClient } = await import("./supabase.server");
    const supabase = (await getAdminClient()) as any;
    const { error } = await supabase
      .from("news")
      .update({
        status: data.status,
        published_at: data.status === "published" ? new Date().toISOString() : null,
      })
      .eq("id", data.id)
      .eq("workspace_id", data.workspaceId);
    if (error) throw new Error(error.message);
    return { success: true };
  });

export const deleteNews = createServerFn({ method: "POST" })
  .validator((input: { id: string; workspaceId: string }) =>
    z.object({ id: z.string().uuid(), workspaceId: z.string().uuid() }).parse(input),
  )
  .handler(async ({ data }): Promise<{ success: true }> => {
    const { getAdminClient } = await import("./supabase.server");
    const supabase = (await getAdminClient()) as any;
    const { error } = await supabase
      .from("news")
      .delete()
      .eq("id", data.id)
      .eq("workspace_id", data.workspaceId);
    if (error) throw new Error(error.message);
    return { success: true };
  });
