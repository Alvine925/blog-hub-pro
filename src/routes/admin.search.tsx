import { createFileRoute, Link } from "@tanstack/react-router";
import { createServerFn } from "@tanstack/react-start";
import { useServerFn } from "@tanstack/react-start";
import { useState, useTransition } from "react";
import { Search, Loader2, Pencil } from "lucide-react";
import { z } from "zod";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { formatBlogDate, type BlogPostSummary } from "@/lib/blog-types";

const searchAdminPosts = createServerFn({ method: "GET" })
  .validator((input: { q: string }) =>
    z.object({ q: z.string().max(200) }).parse(input),
  )
  .handler(async ({ data }): Promise<BlogPostSummary[]> => {
    const { getAdminClient } = await import("../lib/supabase.server");
    const supabase = await getAdminClient();
    const q = data.q.trim();
    if (!q) return [];
    const COLS =
      "id, title, slug, excerpt, cover_image, category, tags, author_name, seo_title, meta_description, featured, status, published_at, scheduled_at, reading_time, views, created_at, updated_at";
    const { data: rows, error } = await supabase
      .from("blog_posts")
      .select(COLS)
      .or(
        `title.ilike.%${q}%,excerpt.ilike.%${q}%,content.ilike.%${q}%,category.ilike.%${q}%`,
      )
      .order("updated_at", { ascending: false })
      .limit(50);
    if (error) throw new Error(error.message);
    return (rows ?? []) as BlogPostSummary[];
  });

export const Route = createFileRoute("/admin/search")({
  head: () => ({ meta: [{ title: "Search — Admin" }] }),
  component: SearchPage,
});

function SearchPage() {
  const doSearch = useServerFn(searchAdminPosts);
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<BlogPostSummary[] | null>(null);
  const [isPending, startTransition] = useTransition();

  function handleChange(e: React.ChangeEvent<HTMLInputElement>) {
    const val = e.target.value;
    setQuery(val);
    if (!val.trim()) {
      setResults(null);
      return;
    }
    startTransition(async () => {
      const rows = await doSearch({ data: { q: val } });
      setResults(rows);
    });
  }

  return (
    <div className="space-y-8 max-w-2xl">
      <div>
        <h1 className="text-2xl font-bold">Search</h1>
        <p className="text-sm text-muted-foreground">Search across all posts in every status</p>
      </div>

      <div className="relative">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
        <Input
          value={query}
          onChange={handleChange}
          placeholder="Search posts…"
          className="pl-9"
          autoFocus
        />
        {isPending && (
          <Loader2 className="absolute right-3 top-1/2 -translate-y-1/2 h-4 w-4 animate-spin text-muted-foreground" />
        )}
      </div>

      {results === null && !query && (
        <p className="text-sm text-muted-foreground">
          Type to search across post titles, excerpts, categories, and content.
        </p>
      )}

      {results !== null && results.length === 0 && (
        <p className="text-sm text-muted-foreground">No posts found for "{query}".</p>
      )}

      {results && results.length > 0 && (
        <div className="space-y-0">
          <p className="text-xs text-muted-foreground mb-3">
            {results.length} result{results.length !== 1 ? "s" : ""}
          </p>
          {results.map((post) => (
            <div
              key={post.id}
              className="flex items-start justify-between gap-4 border-b border-border py-4 last:border-0"
            >
              <div className="min-w-0 flex-1 space-y-1">
                <div className="flex items-center gap-2 flex-wrap">
                  <span className="font-medium text-sm">{post.title || "Untitled"}</span>
                  <Badge
                    variant={post.status === "published" ? "default" : "secondary"}
                    className={`text-xs ${post.status === "scheduled" ? "bg-amber-500 text-white" : ""}`}
                  >
                    {post.status}
                  </Badge>
                </div>
                {post.excerpt && (
                  <p className="text-xs text-muted-foreground line-clamp-1">{post.excerpt}</p>
                )}
                <div className="flex items-center gap-3 text-xs text-muted-foreground">
                  <span>{post.category}</span>
                  <span>·</span>
                  <span>Updated {formatBlogDate(post.updated_at)}</span>
                  {post.views > 0 && (
                    <>
                      <span>·</span>
                      <span>{post.views} views</span>
                    </>
                  )}
                </div>
              </div>
              <Link
                to="/admin/blogs/$id"
                params={{ id: post.id }}
                className="shrink-0 flex items-center gap-1.5 rounded-md border border-border px-3 py-1.5 text-xs font-medium hover:bg-accent transition-colors"
              >
                <Pencil className="h-3 w-3" /> Edit
              </Link>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
