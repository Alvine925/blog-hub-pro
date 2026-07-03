import { createServerFn } from "@tanstack/react-start";

export interface Article {
  id: string;
  workspace_id: string;
  title: string;
  slug: string;
  excerpt: string;
  content: string;
  cover_image: string | null;
  category: string;
  tags: string[];
  author_name: string;
  article_type: "guide" | "tutorial" | "case-study" | "documentation" | "educational";
  status: "draft" | "published" | "scheduled";
  featured: boolean;
  reading_time: number;
  word_count: number | null;
  published_at: string | null;
  scheduled_at: string | null;
  seo_title: string | null;
  meta_description: string | null;
  views: number;
  created_at: string;
  updated_at: string;
}

export type ArticleSummary = Pick<
  Article,
  "id" | "title" | "slug" | "excerpt" | "cover_image" | "category" | "tags" |
  "author_name" | "article_type" | "status" | "featured" | "reading_time" |
  "views" | "published_at" | "created_at" | "updated_at"
>;

export const adminListArticles = createServerFn({ method: "GET" })
  .validator((input: { workspaceId: string }) => input)
  .handler(async ({ data }): Promise<ArticleSummary[]> => {
    const { getAdminClient } = await import("../lib/supabase.server");
    const db = getAdminClient() as any;
    const { data: rows, error } = await db
      .from("articles")
      .select("id,title,slug,excerpt,cover_image,category,tags,author_name,article_type,status,featured,reading_time,views,published_at,created_at,updated_at")
      .eq("workspace_id", data.workspaceId)
      .order("created_at", { ascending: false });
    if (error) throw new Error(error.message);
    return rows ?? [];
  });

export const adminGetArticle = createServerFn({ method: "GET" })
  .validator((input: { id: string; workspaceId: string }) => input)
  .handler(async ({ data }): Promise<Article> => {
    const { getAdminClient } = await import("../lib/supabase.server");
    const db = getAdminClient() as any;
    const { data: row, error } = await db
      .from("articles")
      .select("*")
      .eq("id", data.id)
      .eq("workspace_id", data.workspaceId)
      .single();
    if (error || !row) throw new Error("Article not found");
    return row as Article;
  });

export const upsertArticle = createServerFn({ method: "POST" })
  .validator((input: { article: Partial<Article> & { workspace_id: string } }) => input)
  .handler(async ({ data }): Promise<Article> => {
    const { getAdminClient } = await import("../lib/supabase.server");
    const db = getAdminClient() as any;
    const { article } = data;

    if (!article.slug && article.title) {
      article.slug = article.title
        .toLowerCase()
        .replace(/[^\w\s-]/g, "")
        .replace(/[\s_-]+/g, "-")
        .replace(/^-+|-+$/g, "")
        .slice(0, 100);
    }

    const { id, ...fields } = article;

    if (id) {
      // Update — enforce workspace scoping
      const { data: row, error } = await db
        .from("articles")
        .update({ ...fields, updated_at: new Date().toISOString() })
        .eq("id", id)
        .eq("workspace_id", article.workspace_id)
        .select("*")
        .single();
      if (error) throw new Error(error.message);
      return row as Article;
    } else {
      const { data: row, error } = await db
        .from("articles")
        .insert(fields)
        .select("*")
        .single();
      if (error) throw new Error(error.message);
      return row as Article;
    }
  });

export const setArticleStatus = createServerFn({ method: "POST" })
  .validator((input: { id: string; workspaceId: string; status: Article["status"] }) => input)
  .handler(async ({ data }) => {
    const { getAdminClient } = await import("../lib/supabase.server");
    const db = getAdminClient() as any;
    const update: Record<string, unknown> = {
      status: data.status,
      updated_at: new Date().toISOString(),
    };
    if (data.status === "published") update.published_at = new Date().toISOString();
    const { error } = await db
      .from("articles")
      .update(update)
      .eq("id", data.id)
      .eq("workspace_id", data.workspaceId);
    if (error) throw new Error(error.message);
    return { ok: true };
  });

export const deleteArticle = createServerFn({ method: "POST" })
  .validator((input: { id: string; workspaceId: string }) => input)
  .handler(async ({ data }) => {
    const { getAdminClient } = await import("../lib/supabase.server");
    const db = getAdminClient() as any;
    const { error } = await db
      .from("articles")
      .delete()
      .eq("id", data.id)
      .eq("workspace_id", data.workspaceId);
    if (error) throw new Error(error.message);
    return { ok: true };
  });
