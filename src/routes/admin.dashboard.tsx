import { createFileRoute, Link } from "@tanstack/react-router";
import { AiAssistant } from "@/components/dashboard/AiAssistant";
import { queryOptions, useSuspenseQuery, useQuery } from "@tanstack/react-query";
import {
  FileText, Eye, ArrowRight, Clock,
  BarChart2, Activity, Globe, Target, Lightbulb,
  Key, Zap, FolderOpen,
} from "lucide-react";
import { getDashboardStats } from "@/lib/apikey.functions";
import { publishScheduledPosts } from "@/lib/schedule.functions";
import { formatBlogDate } from "@/lib/blog-types";
import { getWorkspaceIntelligence } from "@/lib/onboarding.functions";
import { supabase } from "@/integrations/supabase/client";
import { cn } from "@/lib/utils";

const statsQuery = queryOptions({
  queryKey: ["admin", "dashboard"],
  queryFn: () => getDashboardStats(),
});

const intelligenceQuery = queryOptions({
  queryKey: ["workspace", "intelligence"],
  queryFn: async () => {
    const { data: { session } } = await supabase.auth.getSession();
    if (!session?.user?.id || !session?.access_token) return { workspace: null, competitors: [], keywords: [], opportunities: [] };
    return getWorkspaceIntelligence({ data: { userId: session.user.id, accessToken: session.access_token } });
  },
  staleTime: 5 * 60 * 1000,
});

export const Route = createFileRoute("/admin/dashboard")({
  head: () => ({ meta: [{ title: "Dashboard — Lunar CMS" }] }),
  loader: async ({ context }) => {
    await publishScheduledPosts().catch(() => {});
    return context.queryClient.ensureQueryData(statsQuery);
  },
  component: Dashboard,
  errorComponent: ({ error }) => (
    <p className="text-sm text-destructive">Failed to load stats: {error.message}</p>
  ),
});

function StatusDot({ status }: { status: string }) {
  return (
    <span className={cn(
      "inline-block h-1.5 w-1.5 rounded-full mr-1.5",
      status === "published" ? "bg-emerald-500" :
      status === "scheduled" ? "bg-amber-500" : "bg-zinc-300",
    )} />
  );
}

function WorkspaceIntelligencePanel() {
  const { data } = useQuery(intelligenceQuery);
  if (!data?.workspace) return null;

  const ws = data.workspace as Record<string, unknown>;
  const competitors = data.competitors as Array<{ id: string; name: string; website: string | null }>;
  const opportunities = data.opportunities as Array<{ id: string; title: string; priority: string }>;
  const keywords = data.keywords as Array<{ id: string; keyword: string }>;

  const hasContent = ws.industry || ws.target_audience || competitors.length > 0 || opportunities.length > 0;
  if (!hasContent) return null;

  return (
    <section className="space-y-8">
      {/* Workspace overview */}
      <div>
        <div className="flex items-center gap-2 border-b border-border pb-3 mb-0">
          <Globe className="h-3.5 w-3.5 text-muted-foreground" />
          <h2 className="text-[11px] font-semibold uppercase tracking-widest text-muted-foreground">
            Workspace Intelligence
          </h2>
          <span className="ml-auto rounded-full bg-violet-50 px-2 py-0.5 text-[10px] font-medium text-violet-700">
            AI-powered
          </span>
        </div>

        <div className="flex flex-wrap gap-8 py-4 border-b border-border">
          {ws.industry && (
            <div>
              <p className="text-[10px] uppercase tracking-wide text-muted-foreground/60 mb-0.5">Industry</p>
              <p className="text-sm font-medium">{String(ws.industry)}</p>
            </div>
          )}
          {ws.target_audience && (
            <div>
              <p className="text-[10px] uppercase tracking-wide text-muted-foreground/60 mb-0.5">Audience</p>
              <p className="text-sm font-medium">{String(ws.target_audience)}</p>
            </div>
          )}
          {ws.brand_voice && (
            <div>
              <p className="text-[10px] uppercase tracking-wide text-muted-foreground/60 mb-0.5">Brand Voice</p>
              <p className="text-sm font-medium">{String(ws.brand_voice)}</p>
            </div>
          )}
        </div>

        {keywords.length > 0 && (
          <div className="flex flex-wrap gap-1.5 py-3 border-b border-border">
            {keywords.slice(0, 10).map((kw) => (
              <span key={kw.id} className="rounded-full bg-violet-50 px-2.5 py-0.5 text-xs font-medium text-violet-700">
                {kw.keyword}
              </span>
            ))}
          </div>
        )}
      </div>

      {/* Competitors + Opportunities */}
      <div className="grid gap-8 lg:grid-cols-2">
        {competitors.length > 0 && (
          <div>
            <div className="flex items-center gap-2 border-b border-border pb-3">
              <Target className="h-3.5 w-3.5 text-muted-foreground" />
              <h3 className="text-[11px] font-semibold uppercase tracking-widest text-muted-foreground">Competitors</h3>
            </div>
            {competitors.slice(0, 4).map((c) => (
              <div key={c.id} className="flex items-center gap-3 border-b border-border py-3 last:border-0">
                <div className="flex h-7 w-7 shrink-0 items-center justify-center rounded text-xs font-bold border border-border">
                  {c.name.charAt(0)}
                </div>
                <div>
                  <p className="text-sm font-medium">{c.name}</p>
                  {c.website && (
                    <a href={c.website} target="_blank" rel="noopener noreferrer"
                      className="text-xs text-primary hover:underline">
                      {c.website.replace(/^https?:\/\//, "")}
                    </a>
                  )}
                </div>
              </div>
            ))}
          </div>
        )}

        {opportunities.length > 0 && (
          <div>
            <div className="flex items-center justify-between border-b border-border pb-3">
              <div className="flex items-center gap-2">
                <Lightbulb className="h-3.5 w-3.5 text-amber-500" />
                <h3 className="text-[11px] font-semibold uppercase tracking-widest text-muted-foreground">Opportunities</h3>
              </div>
              <Link to="/admin/blogs/new" className="text-xs text-primary hover:underline">Create post →</Link>
            </div>
            {opportunities.slice(0, 5).map((co) => (
              <div key={co.id} className="flex items-center gap-2.5 border-b border-border py-3 last:border-0">
                <span className={cn(
                  "shrink-0 rounded-full px-2 py-0.5 text-[10px] font-semibold uppercase",
                  co.priority === "high" ? "bg-green-100 text-green-700" :
                  co.priority === "medium" ? "bg-amber-100 text-amber-700" : "bg-muted text-muted-foreground",
                )}>
                  {co.priority}
                </span>
                <p className="text-xs text-foreground line-clamp-1">{co.title}</p>
              </div>
            ))}
          </div>
        )}
      </div>
    </section>
  );
}

function Dashboard() {
  const { data: stats } = useSuspenseQuery(statsQuery);

  return (
    <div className="space-y-10">
      {/* Header */}
      <div className="flex items-start justify-between gap-4">
        <div>
          <h1 className="text-xl font-semibold">Dashboard</h1>
          <p className="mt-0.5 text-sm text-muted-foreground">Overview of your content and workspace.</p>
        </div>
        <Link
          to="/admin/workspaces"
          className="flex items-center gap-1.5 rounded-md border border-border bg-background px-3 py-1.5 text-sm font-medium hover:bg-muted transition-colors"
        >
          <FolderOpen className="h-3.5 w-3.5" /> Workspaces
        </Link>
      </div>

      {/* Stats bar — flat, no cards */}
      <div className="flex divide-x divide-border border-y border-border">
        {[
          { label: "Total Posts",  value: stats.total },
          { label: "Published",    value: stats.published, green: true },
          { label: "Drafts",       value: stats.drafts },
          { label: "Scheduled",    value: stats.scheduled, amber: true },
          { label: "Total Views",  value: stats.totalViews.toLocaleString() },
        ].map(({ label, value, green, amber }) => (
          <div key={label} className="flex-1 px-5 py-5">
            <p className={cn(
              "text-2xl font-bold tabular-nums",
              green && "text-emerald-600",
              amber && "text-amber-600",
            )}>
              {value}
            </p>
            <p className="mt-0.5 text-[11px] uppercase tracking-wide text-muted-foreground">{label}</p>
          </div>
        ))}
      </div>

      {/* API usage strip */}
      {"apiRequestsToday" in stats && (
        <div className="flex items-center gap-6 rounded-lg border border-border bg-muted/20 px-5 py-4">
          <div className="flex items-center gap-2">
            <Zap className="h-3.5 w-3.5 text-primary" />
            <span className="text-[11px] font-semibold uppercase tracking-widest text-muted-foreground">API Today</span>
          </div>
          <div className="flex divide-x divide-border">
            <div className="pr-6">
              <p className="text-lg font-bold tabular-nums">{(stats.apiRequestsToday as number).toLocaleString()}</p>
              <p className="text-[10px] uppercase tracking-wide text-muted-foreground">Requests</p>
            </div>
            <div className="px-6">
              <p className={cn(
                "text-lg font-bold tabular-nums",
                (stats.apiErrorsToday as number) > 0 && "text-destructive",
              )}>
                {(stats.apiErrorsToday as number).toLocaleString()}
              </p>
              <p className="text-[10px] uppercase tracking-wide text-muted-foreground">Errors</p>
            </div>
            <div className="pl-6">
              <p className="text-lg font-bold tabular-nums text-emerald-600">{(stats.activeKeys as number)}</p>
              <p className="text-[10px] uppercase tracking-wide text-muted-foreground">Active Keys</p>
            </div>
          </div>
          <Link
            to="/admin/api-keys"
            className="ml-auto flex items-center gap-1 text-xs text-primary hover:underline"
          >
            <Key className="h-3.5 w-3.5" /> Manage keys
          </Link>
        </div>
      )}

      {/* Intelligence */}
      <WorkspaceIntelligencePanel />

      {/* Content + Actions */}
      <div className="grid gap-10 lg:grid-cols-[1fr_280px]">
        <div className="space-y-10">
          {/* Top Posts */}
          <section>
            <div className="flex items-center justify-between border-b border-border pb-3">
              <div className="flex items-center gap-2">
                <Eye className="h-3.5 w-3.5 text-muted-foreground" />
                <h2 className="text-[11px] font-semibold uppercase tracking-widest text-muted-foreground">
                  Top Posts by Views
                </h2>
              </div>
              <Link to="/admin/blogs" className="flex items-center gap-1 text-xs text-primary hover:underline">
                View all <ArrowRight className="h-3 w-3" />
              </Link>
            </div>
            {stats.topPosts.length === 0 ? (
              <div className="py-12 text-center">
                <p className="text-sm text-muted-foreground">No published posts yet.</p>
                <Link
                  to="/admin/workspaces"
                  className="mt-3 inline-flex items-center gap-1.5 text-sm font-medium text-primary hover:underline"
                >
                  <FolderOpen className="h-3.5 w-3.5" /> Open a workspace to start writing
                </Link>
              </div>
            ) : (
              stats.topPosts.map((post, i) => (
                <div key={post.id} className="flex items-center gap-3 border-b border-border py-3 last:border-0">
                  <span className="w-4 shrink-0 text-right text-xs font-bold text-muted-foreground/40 tabular-nums">
                    {i + 1}
                  </span>
                  <Link
                    to="/blogs/$slug"
                    params={{ slug: post.slug }}
                    target="_blank"
                    className="min-w-0 flex-1 truncate text-sm font-medium hover:text-primary transition-colors"
                  >
                    {post.title || "Untitled"}
                  </Link>
                  <Link
                    to="/admin/blog-stats/$postId"
                    params={{ postId: post.id }}
                    className="shrink-0 text-xs text-primary hover:underline"
                    title="View analytics"
                  >
                    <BarChart2 className="h-3.5 w-3.5" />
                  </Link>
                  <span className="shrink-0 rounded-full bg-muted px-2 py-0.5 text-xs tabular-nums text-muted-foreground">
                    {post.views.toLocaleString()} views
                  </span>
                </div>
              ))
            )}
          </section>

          {/* Recent Posts */}
          <section>
            <div className="flex items-center justify-between border-b border-border pb-3">
              <div className="flex items-center gap-2">
                <Activity className="h-3.5 w-3.5 text-muted-foreground" />
                <h2 className="text-[11px] font-semibold uppercase tracking-widest text-muted-foreground">
                  Recently Updated
                </h2>
              </div>
              <Link to="/admin/blogs" className="flex items-center gap-1 text-xs text-primary hover:underline">
                View all <ArrowRight className="h-3 w-3" />
              </Link>
            </div>
            {stats.recent.length === 0 ? (
              <p className="py-8 text-center text-sm text-muted-foreground">No posts yet.</p>
            ) : (
              stats.recent.map((post) => (
                <div key={post.id} className="flex items-center gap-3 border-b border-border py-3 last:border-0">
                  <StatusDot status={post.status} />
                  {/* Title links to the workspace editor if we have a workspace_id */}
                  {post.workspace_id ? (
                    <Link
                      to="/admin/workspaces/$id/blogs/$postId/edit"
                      params={{ id: post.workspace_id, postId: post.id }}
                      className="min-w-0 flex-1 truncate text-sm font-medium hover:text-primary transition-colors"
                    >
                      {post.title || "Untitled"}
                    </Link>
                  ) : (
                    <span className="min-w-0 flex-1 truncate text-sm font-medium text-muted-foreground">
                      {post.title || "Untitled"}
                    </span>
                  )}
                  <Link
                    to="/admin/blog-stats/$postId"
                    params={{ postId: post.id }}
                    className="shrink-0 text-xs text-muted-foreground hover:text-primary transition-colors"
                    title="View analytics"
                  >
                    <BarChart2 className="h-3.5 w-3.5" />
                  </Link>
                  <span className={cn(
                    "shrink-0 text-xs",
                    post.status === "published" ? "text-emerald-600" :
                    post.status === "scheduled" ? "text-amber-600" : "text-muted-foreground",
                  )}>
                    {post.status}
                  </span>
                  <span className="shrink-0 text-xs text-muted-foreground">{formatBlogDate(post.updated_at)}</span>
                </div>
              ))
            )}
          </section>
        </div>

        {/* AI Assistant */}
        <div className="flex flex-col rounded-xl border border-border bg-card p-4" style={{ minHeight: "520px" }}>
          <AiAssistant />
        </div>
      </div>
    </div>
  );
}
