import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { queryOptions, useSuspenseQuery } from "@tanstack/react-query";
import { useState, useEffect } from "react";
import { Search, Clock, Calendar, ArrowRight } from "lucide-react";

import { Input } from "@/components/ui/input";
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

function BlogRow({ post }: { post: BlogPostSummary }) {
  return (
    <Link
      to="/blogs/$slug"
      params={{ slug: post.slug }}
      className="group grid grid-cols-1 gap-5 py-8 sm:grid-cols-[220px_1fr]"
    >
      <div className="aspect-video overflow-hidden sm:aspect-[4/3]">
        {post.cover_image ? (
          <img
            src={post.cover_image}
            alt={post.title}
            loading="lazy"
            className="h-full w-full object-cover grayscale transition-all duration-300 group-hover:grayscale-0"
          />
        ) : (
          <div className="flex h-full items-center justify-center bg-accent text-sm text-accent-foreground">
            {post.category}
          </div>
        )}
      </div>
      <div className="flex flex-col justify-center gap-2">
        <span className="text-xs font-semibold uppercase tracking-widest text-primary">
          {post.category}
        </span>
        <h2 className="text-2xl font-bold leading-snug tracking-tight transition-colors group-hover:text-primary">
          {post.title}
        </h2>
        <p className="line-clamp-2 max-w-2xl text-muted-foreground">
          {post.excerpt}
        </p>
        <div className="mt-1 flex items-center gap-4 text-xs text-muted-foreground">
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
      <div className="mx-auto max-w-4xl px-4">
        <header className="pt-20 pb-10">
          <span className="text-sm font-semibold uppercase tracking-[0.3em] text-primary">
            The Blog
          </span>
          <h1 className="mt-3 text-5xl font-black tracking-tight sm:text-6xl">
            Ideas, guides &amp; inspiration.
          </h1>
          <p className="mt-4 max-w-xl text-lg text-muted-foreground">
            Stories and practical advice for every celebration.
          </p>
          <div className="mt-8 max-w-md">
            <div className="relative">
              <Search className="absolute left-0 top-1/2 h-5 w-5 -translate-y-1/2 text-primary" />
              <Input
                value={term}
                onChange={(e) => setTerm(e.target.value)}
                placeholder="Search articles, tags, categories…"
                className="border-0 border-b border-border bg-transparent pl-8 text-lg shadow-none focus-visible:border-primary focus-visible:ring-0"
              />
            </div>
          </div>
        </header>

        <div className="flex flex-wrap gap-x-5 gap-y-2 border-y border-border py-4">
          {["All", ...BLOG_CATEGORIES].map((cat) => (
            <button
              key={cat}
              onClick={() => selectCategory(cat)}
              className={
                activeCategory === cat
                  ? "text-sm font-semibold text-primary underline underline-offset-8"
                  : "text-sm text-muted-foreground transition-colors hover:text-foreground"
              }
            >
              {cat}
            </button>
          ))}
        </div>

        {posts.length === 0 ? (
          <div className="py-24 text-center text-muted-foreground">
            No posts found{search.q ? ` for “${search.q}”` : ""}.
          </div>
        ) : (
          <div className="divide-y divide-border">
            {posts.map((post) => (
              <BlogRow key={post.id} post={post} />
            ))}
          </div>
        )}

        <footer className="border-t border-border py-10 text-sm text-muted-foreground">
          <Link to="/" className="inline-flex items-center gap-1 hover:text-primary">
            Back home <ArrowRight className="h-3.5 w-3.5" />
          </Link>
        </footer>
      </div>
    </div>
  );
}
