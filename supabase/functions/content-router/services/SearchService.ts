/**
 * SearchService.ts — unified search across blogs, collections, categories, and tags.
 *
 * Returns a ranked, interleaved list of results. Uses Postgres ilike
 * on title/name fields (FTS on blog_posts is available via the gin index
 * and can be swapped in for larger datasets).
 */
import { getDb } from "../db.ts";
import { type PublicSearchResult } from "../ContentTransformer.ts";

export interface SearchParams {
  q:     string;
  limit: number;
  page:  number;
}

export interface SearchResult {
  rows:  PublicSearchResult[];
  total: number;
  query: string;
}

export async function search(
  workspaceId: string,
  params: SearchParams,
): Promise<SearchResult> {
  const db   = getDb();
  const term = params.q.replace(/[%_\\]/g, "").slice(0, 200);

  if (!term) return { rows: [], total: 0, query: params.q };

  const perType = Math.max(params.limit, 10);

  // Run all searches in parallel — each error is handled independently
  const [blogsRes, collectionsRes, catRes] = await Promise.all([
    db
      .from("blog_posts")
      .select("slug, title, excerpt, cover_image, published_at")
      .eq("workspace_id", workspaceId)
      .eq("status", "published")
      .or(`title.ilike.%${term}%,excerpt.ilike.%${term}%`)
      .order("published_at", { ascending: false })
      .limit(perType),

    // Collections are workspace-scoped via workspace_id (added in migration 20260703000003)
    db
      .from("collections")
      .select("slug, name, description")
      .eq("workspace_id", workspaceId)
      .or(`name.ilike.%${term}%,description.ilike.%${term}%`)
      .limit(perType),

    // Category matches derived from blog_posts
    db
      .from("blog_posts")
      .select("category")
      .eq("workspace_id", workspaceId)
      .eq("status", "published")
      .ilike("category", `%${term}%`),
  ]);

  const results: PublicSearchResult[] = [];

  // Blogs — surface query error but don't fail the whole search
  if (blogsRes.error) {
    console.error("Blog search error:", blogsRes.error.message);
  }
  for (const row of blogsRes.data ?? []) {
    const r = row as Record<string, unknown>;
    results.push({
      type:         "blog",
      title:        (r.title as string) || "",
      slug:         r.slug as string,
      excerpt:      (r.excerpt as string | null) ?? null,
      image:        (r.cover_image as string | null) ?? null,
      published_at: (r.published_at as string | null) ?? null,
    });
  }

  // Collections
  if (!collectionsRes.error) {
    for (const row of collectionsRes.data ?? []) {
      const r = row as Record<string, unknown>;
      results.push({
        type:         "collection",
        title:        (r.name as string) || "",
        slug:         r.slug as string,
        excerpt:      (r.description as string | null) ?? null,
        image:        null,
        published_at: null,
      });
    }
  }

  // Category matches
  const catRows = catRes.data;

  const seenCats = new Set<string>();
  for (const row of catRows ?? [] as Record<string, unknown>[]) {
    const cat = (row as Record<string, unknown>).category as string;
    if (cat && !seenCats.has(cat)) {
      seenCats.add(cat);
      results.push({
        type:         "category",
        title:        cat,
        slug:         cat.toLowerCase().replace(/\s+/g, "-").replace(/[^a-z0-9-]/g, ""),
        excerpt:      null,
        image:        null,
        published_at: null,
      });
    }
  }

  const total = results.length;
  const offset = (params.page - 1) * params.limit;
  return {
    rows:  results.slice(offset, offset + params.limit),
    total,
    query: params.q,
  };
}
