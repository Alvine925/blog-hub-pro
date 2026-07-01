import { createFileRoute, Link } from "@tanstack/react-router";
import { queryOptions, useSuspenseQuery } from "@tanstack/react-query";
import { FileText, Eye, Send, FilePen, ArrowRight, Clock } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { getDashboardStats } from "@/lib/apikey.functions";
import { publishScheduledPosts } from "@/lib/schedule.functions";
import { formatBlogDate } from "@/lib/blog-types";

const statsQuery = queryOptions({
  queryKey: ["admin", "dashboard"],
  queryFn: () => getDashboardStats(),
});

export const Route = createFileRoute("/admin/dashboard")({
  head: () => ({ meta: [{ title: "Dashboard — Admin" }] }),
  loader: async ({ context }) => {
    await publishScheduledPosts().catch(() => {});
    return context.queryClient.ensureQueryData(statsQuery);
  },
  component: Dashboard,
  errorComponent: ({ error }) => (
    <p className="text-sm text-destructive">Failed to load stats: {error.message}</p>
  ),
});

function Dashboard() {
  const { data: stats } = useSuspenseQuery(statsQuery);

  return (
    <div className="space-y-10">
      <div>
        <h1 className="text-2xl font-bold">Dashboard</h1>
        <p className="text-sm text-muted-foreground">Overview of your content</p>
      </div>

      {/* Flat stat row — no card boxes */}
      <div className="grid grid-cols-2 gap-x-10 gap-y-8 sm:grid-cols-3 lg:grid-cols-5">
        {[
          { label: "Total Posts", value: stats.total, icon: FileText, accent: false },
          { label: "Published", value: stats.published, icon: Send, accent: true },
          { label: "Drafts", value: stats.drafts, icon: FilePen, accent: false },
          { label: "Scheduled", value: stats.scheduled, icon: Clock, amber: true },
          {
            label: "Total Views",
            value: stats.totalViews.toLocaleString(),
            icon: Eye,
            accent: false,
          },
        ].map((s) => (
          <div key={s.label} className="space-y-1.5">
            <div className="flex items-center gap-2">
              <s.icon
                className={`h-4 w-4 ${s.accent ? "text-primary" : s.amber ? "text-amber-500" : "text-muted-foreground"}`}
              />
              <span className="text-xs font-medium text-muted-foreground">{s.label}</span>
            </div>
            <p
              className={`text-3xl font-bold tabular-nums ${s.accent ? "text-primary" : s.amber ? "text-amber-600" : ""}`}
            >
              {s.value}
            </p>
          </div>
        ))}
      </div>

      <div className="border-t border-border" />

      <div className="grid gap-10 lg:grid-cols-2">
        {/* Top Posts */}
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <h2 className="text-sm font-semibold">Top Posts by Views</h2>
            <Link
              to="/admin/blogs"
              className="flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground"
            >
              View all <ArrowRight className="h-3.5 w-3.5" />
            </Link>
          </div>
          {stats.topPosts.length === 0 ? (
            <p className="text-sm text-muted-foreground">No published posts yet.</p>
          ) : (
            <div className="space-y-0">
              {stats.topPosts.map((post) => (
                <div
                  key={post.id}
                  className="flex items-center justify-between gap-3 border-b border-border/50 py-3 last:border-0"
                >
                  <Link
                    to="/blogs/$slug"
                    params={{ slug: post.slug }}
                    target="_blank"
                    className="min-w-0 flex-1 truncate text-sm font-medium hover:text-primary"
                  >
                    {post.title || "Untitled"}
                  </Link>
                  <span className="shrink-0 text-sm tabular-nums text-muted-foreground">
                    {post.views} views
                  </span>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Recently Updated */}
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <h2 className="text-sm font-semibold">Recently Updated</h2>
            <Link
              to="/admin/blogs"
              className="flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground"
            >
              View all <ArrowRight className="h-3.5 w-3.5" />
            </Link>
          </div>
          {stats.recent.length === 0 ? (
            <p className="text-sm text-muted-foreground">No posts yet.</p>
          ) : (
            <div className="space-y-0">
              {stats.recent.map((post) => (
                <div
                  key={post.id}
                  className="flex items-center justify-between gap-3 border-b border-border/50 py-3 last:border-0"
                >
                  <Link
                    to="/admin/blogs/$id"
                    params={{ id: post.id }}
                    className="min-w-0 flex-1 truncate text-sm font-medium hover:text-primary"
                  >
                    {post.title || "Untitled"}
                  </Link>
                  <div className="flex shrink-0 items-center gap-2">
                    <Badge
                      variant={post.status === "published" ? "default" : "secondary"}
                      className={`text-xs ${post.status === "scheduled" ? "bg-amber-500 text-white hover:bg-amber-500/90" : ""}`}
                    >
                      {post.status}
                    </Badge>
                    <span className="text-xs text-muted-foreground">
                      {formatBlogDate(post.updated_at)}
                    </span>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      <div className="border-t border-border" />

      {/* Quick Actions — flat button row */}
      <div className="space-y-3">
        <h2 className="text-sm font-semibold">Quick Actions</h2>
        <div className="flex flex-wrap gap-3">
          <Link
            to="/admin/blogs/new"
            className="inline-flex items-center gap-2 rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground hover:bg-primary/90"
          >
            <FileText className="h-4 w-4" /> New Post
          </Link>
          <Link
            to="/admin/media"
            className="inline-flex items-center gap-2 rounded-md border border-border bg-background px-4 py-2 text-sm font-medium text-foreground hover:bg-accent"
          >
            Media Library
          </Link>
          <Link
            to="/admin/api-explorer"
            className="inline-flex items-center gap-2 rounded-md border border-border bg-background px-4 py-2 text-sm font-medium text-foreground hover:bg-accent"
          >
            API Explorer
          </Link>
          <Link
            to="/admin/analytics"
            className="inline-flex items-center gap-2 rounded-md border border-border bg-background px-4 py-2 text-sm font-medium text-foreground hover:bg-accent"
          >
            Analytics
          </Link>
          <Link
            to="/admin/settings"
            className="inline-flex items-center gap-2 rounded-md border border-border bg-background px-4 py-2 text-sm font-medium text-foreground hover:bg-accent"
          >
            Settings
          </Link>
          <Link
            to="/blogs"
            target="_blank"
            className="inline-flex items-center gap-2 rounded-md border border-border bg-background px-4 py-2 text-sm font-medium text-foreground hover:bg-accent"
          >
            View Public Blog
          </Link>
        </div>
      </div>
    </div>
  );
}
