import { createFileRoute, Link, notFound } from "@tanstack/react-router";
import { queryOptions, useQuery } from "@tanstack/react-query";
import { Clock, Calendar, User, ArrowLeft, Tag } from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { getPostBySlug, getRelatedPosts } from "@/lib/blog.functions";
import { formatBlogDate, type BlogPost } from "@/lib/blog-types";

const postQuery = (slug: string) =>
  queryOptions({
    queryKey: ["blog_post", slug],
    queryFn: () => getPostBySlug({ data: { slug } }),
  });

export const Route = createFileRoute("/blogs/$slug")({
  loader: async ({ params, context }) => {
    const post = await context.queryClient.ensureQueryData(postQuery(params.slug));
    if (!post) throw notFound();
    return { post };
  },
  head: ({ loaderData, params }) => {
    const post = loaderData?.post as BlogPost | undefined;
    if (!post) return {};
    const title = post.seo_title || post.title;
    const description = post.meta_description || post.excerpt;
    const url = `/blogs/${params.slug}`;
    const meta: Array<Record<string, string>> = [
      { title },
      { name: "description", content: description },
      { name: "author", content: post.author_name },
      {
        name: "robots",
        content: "index, follow, max-image-preview:large",
      },
      { property: "og:title", content: title },
      { property: "og:description", content: description },
      { property: "og:type", content: "article" },
      { property: "og:url", content: url },
      { property: "article:published_time", content: post.published_at ?? "" },
      { property: "article:section", content: post.category },
      { name: "twitter:card", content: "summary_large_image" },
      { name: "twitter:title", content: title },
      { name: "twitter:description", content: description },
    ];
    if (post.cover_image) {
      meta.push({ property: "og:image", content: post.cover_image });
      meta.push({ name: "twitter:image", content: post.cover_image });
    }
    return {
      meta,
      links: [{ rel: "canonical", href: url }],
      scripts: [
        {
          type: "application/ld+json",
          children: JSON.stringify({
            "@context": "https://schema.org",
            "@type": "BlogPosting",
            headline: post.title,
            description,
            image: post.cover_image ? [post.cover_image] : undefined,
            author: { "@type": "Person", name: post.author_name },
            datePublished: post.published_at,
            dateModified: post.updated_at,
            articleSection: post.category,
            keywords: post.tags.join(", "),
          }),
        },
      ],
    };
  },
  component: BlogDetail,
  errorComponent: ({ error }) => (
    <div className="mx-auto max-w-2xl px-4 py-20 text-center">
      <p className="text-destructive">Failed to load: {error.message}</p>
      <Button asChild variant="outline" className="mt-4">
        <Link to="/blogs">Back to blog</Link>
      </Button>
    </div>
  ),
  notFoundComponent: () => (
    <div className="mx-auto max-w-2xl px-4 py-20 text-center">
      <h1 className="text-2xl font-bold">Article not found</h1>
      <p className="mt-2 text-muted-foreground">
        This article may have been removed or unpublished.
      </p>
      <Button asChild className="mt-6">
        <Link to="/blogs">Back to blog</Link>
      </Button>
    </div>
  ),
});

function BlogDetail() {
  const { post } = Route.useLoaderData();

  const { data: related } = useQuery({
    queryKey: ["blog_related", post.slug],
    queryFn: () =>
      getRelatedPosts({
        data: { slug: post.slug, category: post.category, tags: post.tags },
      }),
  });

  return (
    <div className="min-h-screen bg-background">
      <div className="mx-auto max-w-3xl px-4 py-10">
        <Button asChild variant="ghost" size="sm" className="mb-6 -ml-2">
          <Link to="/blogs">
            <ArrowLeft className="mr-2 h-4 w-4" /> All articles
          </Link>
        </Button>

        <Badge variant="secondary" className="mb-4">
          {post.category}
        </Badge>
        <h1 className="text-3xl font-bold leading-tight tracking-tight sm:text-4xl">
          {post.title}
        </h1>

        <div className="mt-4 flex flex-wrap items-center gap-4 text-sm text-muted-foreground">
          <span className="flex items-center gap-1.5">
            <User className="h-4 w-4" /> {post.author_name}
          </span>
          <span className="flex items-center gap-1.5">
            <Calendar className="h-4 w-4" /> {formatBlogDate(post.published_at)}
          </span>
          <span className="flex items-center gap-1.5">
            <Clock className="h-4 w-4" /> {post.reading_time} min read
          </span>
        </div>
      </div>

      {post.cover_image && (
        <div className="mx-auto max-w-4xl px-4">
          <img
            src={post.cover_image}
            alt={post.title}
            className="aspect-video w-full rounded-xl object-cover"
          />
        </div>
      )}

      <article className="mx-auto max-w-3xl px-4 py-10">
        <div
          className="blog-content"
          dangerouslySetInnerHTML={{ __html: post.content }}
        />

        {post.tags.length > 0 && (
          <div className="mt-10 flex flex-wrap items-center gap-2 border-t border-border pt-6">
            <Tag className="h-4 w-4 text-muted-foreground" />
            {post.tags.map((tag) => (
              <Link
                key={tag}
                to="/blogs"
                search={{ q: tag }}
                className="rounded-full bg-muted px-3 py-1 text-sm text-muted-foreground transition-colors hover:bg-accent hover:text-foreground"
              >
                {tag}
              </Link>
            ))}
          </div>
        )}
      </article>

      {related && related.length > 0 && (
        <section className="border-t border-border bg-muted/30">
          <div className="mx-auto max-w-5xl px-4 py-12">
            <h2 className="mb-6 text-2xl font-bold">Related Articles</h2>
            <div className="grid gap-6 sm:grid-cols-3">
              {related.map((r) => (
                <Link
                  key={r.id}
                  to="/blogs/$slug"
                  params={{ slug: r.slug }}
                  className="group overflow-hidden rounded-xl border border-border bg-card transition-shadow hover:shadow-lg"
                >
                  <div className="aspect-video overflow-hidden bg-muted">
                    {r.cover_image ? (
                      <img
                        src={r.cover_image}
                        alt={r.title}
                        loading="lazy"
                        className="h-full w-full object-cover transition-transform group-hover:scale-105"
                      />
                    ) : (
                      <div className="flex h-full items-center justify-center text-muted-foreground">
                        {r.category}
                      </div>
                    )}
                  </div>
                  <div className="space-y-2 p-4">
                    <Badge variant="secondary" className="text-xs">
                      {r.category}
                    </Badge>
                    <h3 className="font-semibold leading-snug group-hover:text-primary">
                      {r.title}
                    </h3>
                    <p className="text-xs text-muted-foreground">
                      {r.reading_time} min read
                    </p>
                  </div>
                </Link>
              ))}
            </div>
          </div>
        </section>
      )}
    </div>
  );
}
