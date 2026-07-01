import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { queryOptions, useSuspenseQuery } from "@tanstack/react-query";
import { useState, useEffect } from "react";
import { Search, Clock, Calendar, ArrowRight } from "lucide-react";

import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { listPublishedPosts } from "@/lib/blog.functions";
import {
  BLOG_CATEGORIES,
  formatBlogDate,
  type BlogPostSummary,
} from "@/lib/blog-types";

interface BlogSearch {
  q?: string;
  category?: string;
}

const postsQuery = (params: BlogSearch) =>
  queryOptions({
    queryKey: ["blog_posts", "published", params.q ?? "", params.category ?? "All"],
    queryFn: () =>
      listPublishedPosts({
        data: { search: params.q, category: params.category },
      }),
  });

export const Route = createFileRoute("/blogs/")({
  validateSearch: (search: Record<string, unknown>): BlogSearch => ({
    q: typeof search.q === "string" && search.q ? search.q : undefined,
    category:
      typeof search.category === "string" && search.category
        ? search.category
        : undefined,
  }),
  loaderDeps: ({ search }) => ({ q: search.q, category: search.category }),
  loader: ({ context, deps }) =>
    context.queryClient.ensureQueryData(postsQuery(deps)),
  head: () => ({
    meta: [
      { title: "Blog — Ideas, Guides & Inspiration" },
      {
        name: "description",
        content:
          "Read our latest articles and guides across weddings, birthdays, corporate events and more.",
      },
      { property: "og:title", content: "Blog — Ideas, Guides & Inspiration" },
      {
        property: "og:description",
        content: "Latest articles, guides and inspiration.",
      },
      { property: "og:type", content: "website" },
      { property: "og:url", content: "/blogs" },
    ],
    links: [{ rel: "canonical", href: "/blogs" }],
  }),
  component: BlogIndex,
  errorComponent: ({ error }) => (
    <div className="mx-auto max-w-2xl px-4 py-20 text-center">
      <p className="text-destructive">Failed to load posts: {error.message}</p>
    </div>
  ),
});

function BlogCard({ post }: { post: BlogPostSummary }) {
  return (
    <Link
      to="/blogs/$slug"
      params={{ slug: post.slug }}
      className="group flex flex-col overflow-hidden rounded-xl border border-border bg-card transition-shadow hover:shadow-lg"
    >
      <div className="aspect-video overflow-hidden bg-muted">
        {post.cover_image ? (
          <img
            src={post.cover_image}
            alt={post.title}
            loading="lazy"
            className="h-full w-full object-cover transition-transform duration-300 group-hover:scale-105"
          />
        ) : (
          <div className="flex h-full items-center justify-center text-muted-foreground">
            {post.category}
          </div>
        )}
      </div>
      <div className="flex flex-1 flex-col gap-3 p-5">
        <Badge variant="secondary" className="w-fit">
          {post.category}
        </Badge>
        <h2 className="text-lg font-semibold leading-snug group-hover:text-primary">
          {post.title}
        </h2>
        <p className="line-clamp-2 flex-1 text-sm text-muted-foreground">
          {post.excerpt}
        </p>
        <div className="flex items-center gap-4 text-xs text-muted-foreground">
          <span className="flex items-center gap-1">
            <Clock className="h-3.5 w-3.5" /> {post.reading_time} min read
          </span>
          <span className="flex items-center gap-1">
            <Calendar className="h-3.5 w-3.5" />
            {formatBlogDate(post.published_at)}
          </span>
        </div>
      </div>
    </Link>
  );
}

function BlogIndex() {
  const search = Route.useSearch();
  const navigate = useNavigate({ from: "/blogs" });
  const { data: posts } = useSuspenseQuery(postsQuery(search));
  const [term, setTerm] = useState(search.q ?? "");

  // Debounce the search input into the URL search param.
  useEffect(() => {
    const t = setTimeout(() => {
      const next = term.trim() || undefined;
      if (next !== search.q) {
        navigate({
          search: (prev: BlogSearch) => ({ ...prev, q: next }),
          replace: true,
        });
      }
    }, 350);
    return () => clearTimeout(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [term]);

  const activeCategory = search.category ?? "All";

  function selectCategory(cat: string) {
    navigate({
      search: (prev: BlogSearch) => ({
        ...prev,
        category: cat === "All" ? undefined : cat,
      }),
      replace: true,
    });
  }

  return (
    <div className="min-h-screen bg-background">
      <header className="border-b border-border bg-muted/30">
        <div className="mx-auto max-w-6xl px-4 py-14 text-center">
          <h1 className="text-4xl font-bold tracking-tight sm:text-5xl">
            The Blog
          </h1>
          <p className="mx-auto mt-3 max-w-xl text-muted-foreground">
            Ideas, guides and inspiration for every celebration.
          </p>
          <div className="mx-auto mt-6 max-w-md">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
              <Input
                value={term}
                onChange={(e) => setTerm(e.target.value)}
                placeholder="Search articles, tags, categories…"
                className="pl-9"
              />
            </div>
          </div>
        </div>
      </header>

      <div className="mx-auto max-w-6xl px-4 py-10">
        <div className="mb-8 flex flex-wrap justify-center gap-2">
          {["All", ...BLOG_CATEGORIES].map((cat) => (
            <Button
              key={cat}
              size="sm"
              variant={activeCategory === cat ? "default" : "outline"}
              onClick={() => selectCategory(cat)}
            >
              {cat}
            </Button>
          ))}
        </div>

        {posts.length === 0 ? (
          <div className="py-20 text-center text-muted-foreground">
            No posts found{search.q ? ` for “${search.q}”` : ""}.
          </div>
        ) : (
          <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
            {posts.map((post) => (
              <BlogCard key={post.id} post={post} />
            ))}
          </div>
        )}
      </div>

      <footer className="border-t border-border py-8 text-center text-sm text-muted-foreground">
        <Link to="/" className="inline-flex items-center gap-1 hover:text-foreground">
          Back home <ArrowRight className="h-3.5 w-3.5" />
        </Link>
      </footer>
    </div>
  );
}
