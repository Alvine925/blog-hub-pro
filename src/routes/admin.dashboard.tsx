import { createFileRoute, Link } from "@tanstack/react-router";
import { queryOptions, useSuspenseQuery } from "@tanstack/react-query";
import { FileText, Eye, Send, FilePen, ArrowRight, Clock } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { getDashboardStats } from "@/lib/apikey.functions";
import { formatBlogDate } from "@/lib/blog-types";

const statsQuery = queryOptions({
  queryKey: ["admin", "dashboard"],
  queryFn: () => getDashboardStats(),
});

export const Route = createFileRoute("/admin/dashboard")({
  head: () => ({ meta: [{ title: "Dashboard — Admin" }] }),
  loader: ({ context }) => context.queryClient.ensureQueryData(statsQuery),
  component: Dashboard,
  errorComponent: ({ error }) => (
    <p className="text-sm text-destructive">Failed to load stats: {error.message}</p>
  ),
});

function StatCard({
  label,
  value,
  icon: Icon,
  accent,
}: {
  label: string;
  value: number | string;
  icon: React.ElementType;
  accent?: boolean;
}) {
  return (
    <Card>
      <CardContent className="flex items-center gap-4 pt-6">
        <div
          className={`flex h-11 w-11 shrink-0 items-center justify-center rounded-lg ${
            accent ? "bg-primary text-primary-foreground" : "bg-muted text-muted-foreground"
          }`}
        >
          <Icon className="h-5 w-5" />
        </div>
        <div>
          <p className="text-2xl font-bold tabular-nums">{value}</p>
          <p className="text-sm text-muted-foreground">{label}</p>
        </div>
      </CardContent>
    </Card>
  );
}

function Dashboard() {
  const { data: stats } = useSuspenseQuery(statsQuery);

  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-2xl font-bold">Dashboard</h1>
        <p className="text-sm text-muted-foreground">Overview of your content</p>
      </div>

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <StatCard label="Total Posts" value={stats.total} icon={FileText} />
        <StatCard label="Published" value={stats.published} icon={Send} accent />
        <StatCard label="Drafts" value={stats.drafts} icon={FilePen} />
        <StatCard label="Total Views" value={stats.totalViews.toLocaleString()} icon={Eye} />
      </div>

      <div className="grid gap-6 lg:grid-cols-2">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0">
            <CardTitle className="text-base">Top Posts by Views</CardTitle>
            <Link
              to="/admin/blogs"
              className="flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground"
            >
              View all <ArrowRight className="h-3.5 w-3.5" />
            </Link>
          </CardHeader>
          <CardContent>
            {stats.topPosts.length === 0 ? (
              <p className="text-sm text-muted-foreground">No published posts yet.</p>
            ) : (
              <div className="space-y-3">
                {stats.topPosts.map((post) => (
                  <div key={post.id} className="flex items-center justify-between gap-3">
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
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0">
            <CardTitle className="text-base">Recently Updated</CardTitle>
            <Link
              to="/admin/blogs"
              className="flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground"
            >
              View all <ArrowRight className="h-3.5 w-3.5" />
            </Link>
          </CardHeader>
          <CardContent>
            {stats.recent.length === 0 ? (
              <p className="text-sm text-muted-foreground">No posts yet.</p>
            ) : (
              <div className="space-y-3">
                {stats.recent.map((post) => (
                  <div key={post.id} className="flex items-center justify-between gap-3">
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
                        className="text-xs"
                      >
                        {post.status}
                      </Badge>
                      <span className="flex items-center gap-1 text-xs text-muted-foreground">
                        <Clock className="h-3 w-3" />
                        {formatBlogDate(post.updated_at)}
                      </span>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Quick Actions</CardTitle>
        </CardHeader>
        <CardContent className="flex flex-wrap gap-3">
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
            to="/admin/api-keys"
            className="inline-flex items-center gap-2 rounded-md border border-border bg-background px-4 py-2 text-sm font-medium text-foreground hover:bg-accent"
          >
            API Keys
          </Link>
          <Link
            to="/blogs"
            target="_blank"
            className="inline-flex items-center gap-2 rounded-md border border-border bg-background px-4 py-2 text-sm font-medium text-foreground hover:bg-accent"
          >
            View Public Blog
          </Link>
        </CardContent>
      </Card>
    </div>
  );
}
