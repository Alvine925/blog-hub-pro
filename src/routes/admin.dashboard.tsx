import { createFileRoute, Link } from "@tanstack/react-router";
import { queryOptions, useSuspenseQuery, useQuery } from "@tanstack/react-query";
import {
  FileText, Eye, Send, FilePen, ArrowRight, Clock, Plus, ImageIcon,
  Layers, Key, BarChart2, Settings, TrendingUp, Users,
  Activity, Globe, Target, Lightbulb, Building2,
} from "lucide-react";
import { Badge } from "@/components/ui/badge";
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

type StatConfig = {
  label: string;
  value: string | number;
  icon: React.ComponentType<{ className?: string }>;
  accent?: boolean;
  amber?: boolean;
  trend?: string;
};

function StatCard({ label, value, icon: Icon, accent, amber, trend }: StatConfig) {
  return (
    <div className="flex flex-col gap-3 rounded-xl border border-border bg-background p-5 shadow-sm transition-shadow hover:shadow-md">
      <div className="flex items-center justify-between">
        <span className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">{label}</span>
        <span className={cn(
          "flex h-8 w-8 items-center justify-center rounded-lg",
          accent ? "bg-primary/10 text-primary" : amber ? "bg-amber-50 text-amber-600" : "bg-muted text-muted-foreground",
        )}>
          <Icon className="h-4 w-4" />
        </span>
      </div>
      <div>
        <p className={cn(
          "text-3xl font-bold tabular-nums",
          accent ? "text-primary" : amber ? "text-amber-600" : "",
        )}>
          {value}
        </p>
        {trend && (
          <p className="mt-1 flex items-center gap-1 text-xs text-green-600">
            <TrendingUp className="h-3 w-3" /> {trend}
          </p>
        )}
      </div>
    </div>
  );
}

type QuickAction = {
  label: string;
  description: string;
  to: string;
  icon: React.ComponentType<{ className?: string }>;
  primary?: boolean;
};

const QUICK_ACTIONS: QuickAction[] = [
  { label: "New Post", description: "Write and publish a blog post", to: "/admin/blogs/new", icon: FileText, primary: true },
  { label: "Media Library", description: "Upload and manage images", to: "/admin/media", icon: ImageIcon },
  { label: "Collections", description: "Manage content types", to: "/admin/collections", icon: Layers },
  { label: "AI Assistant", description: "Generate content with AI", to: "/admin/ai-assistant", icon: Sparkles },
  { label: "API Keys", description: "Generate access tokens", to: "/admin/api-keys", icon: Key },
  { label: "Analytics", description: "View performance metrics", to: "/admin/analytics", icon: BarChart2 },
];

function QuickActionCard({ action }: { action: QuickAction }) {
  const Icon = action.icon;
  return (
    <Link
      to={action.to}
      className={cn(
        "group flex items-center gap-4 rounded-xl border p-4 transition-all hover:shadow-sm",
        action.primary
          ? "border-primary/30 bg-primary/5 hover:border-primary/60"
          : "border-border bg-background hover:border-border/80 hover:bg-accent/40",
      )}
    >
      <span className={cn(
        "flex h-10 w-10 shrink-0 items-center justify-center rounded-xl transition-transform group-hover:scale-110",
        action.primary ? "bg-primary text-primary-foreground" : "bg-muted text-muted-foreground",
      )}>
        <Icon className="h-5 w-5" />
      </span>
      <div className="min-w-0 flex-1">
        <p className={cn("text-sm font-semibold", action.primary && "text-primary")}>{action.label}</p>
        <p className="text-xs text-muted-foreground">{action.description}</p>
      </div>
      <ArrowRight className="h-4 w-4 shrink-0 text-muted-foreground/40 transition-transform group-hover:translate-x-0.5 group-hover:text-muted-foreground" />
    </Link>
  );
}

function StatusBadge({ status }: { status: string }) {
  const cfg: Record<string, { variant: "default" | "secondary" | "outline"; className?: string }> = {
    published: { variant: "default" },
    draft: { variant: "secondary" },
    scheduled: { variant: "outline", className: "border-amber-300 bg-amber-50 text-amber-700" },
  };
  const c = cfg[status] ?? { variant: "secondary" };
  return (
    <Badge variant={c.variant} className={cn("text-xs capitalize", c.className)}>
      {status}
    </Badge>
  );
}

// ── Workspace Intelligence Panel ──────────────────────────────────────────────

function WorkspaceIntelligencePanel() {
  const { data } = useQuery(intelligenceQuery);

  if (!data?.workspace) return null;

  const ws = data.workspace as Record<string, unknown>;
  const competitors = data.competitors as Array<{ id: string; name: string; website: string | null; description: string | null }>;
  const opportunities = data.opportunities as Array<{ id: string; title: string; type: string; priority: string }>;
  const keywords = data.keywords as Array<{ id: string; keyword: string }>;

  const hasIntelligence = ws.industry || ws.target_audience || competitors.length > 0 || opportunities.length > 0;
  if (!hasIntelligence) return null;

  return (
    <div className="space-y-6">
      {/* Workspace Overview */}
      <div className="rounded-xl border border-border bg-background p-5 shadow-sm">
        <div className="mb-4 flex items-center gap-2">
          <Globe className="h-4 w-4 text-primary" />
          <h2 className="text-sm font-semibold">Workspace Intelligence</h2>
          <span className="ml-auto rounded-full bg-violet-50 px-2 py-0.5 text-xs font-medium text-violet-700">AI-powered</span>
        </div>

        <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
          {ws.industry && (
            <div>
              <p className="text-xs text-muted-foreground">Industry</p>
              <p className="mt-0.5 text-sm font-medium text-foreground">{String(ws.industry)}</p>
            </div>
          )}
          {ws.target_audience && (
            <div>
              <p className="text-xs text-muted-foreground">Target Audience</p>
              <p className="mt-0.5 text-sm font-medium text-foreground line-clamp-2">{String(ws.target_audience)}</p>
            </div>
          )}
          {ws.brand_voice && (
            <div>
              <p className="text-xs text-muted-foreground">Brand Voice</p>
              <p className="mt-0.5 text-sm font-medium text-foreground">{String(ws.brand_voice)}</p>
            </div>
          )}
          {ws.business_model && (
            <div>
              <p className="text-xs text-muted-foreground">Business Model</p>
              <p className="mt-0.5 text-sm font-medium text-foreground">{String(ws.business_model)}</p>
            </div>
          )}
        </div>

        {/* Keywords */}
        {keywords.length > 0 && (
          <div className="mt-4 border-t border-border pt-4">
            <p className="mb-2 text-xs text-muted-foreground">Top Keywords</p>
            <div className="flex flex-wrap gap-1.5">
              {keywords.slice(0, 10).map((kw) => (
                <span key={kw.id} className="rounded-full bg-violet-50 px-2.5 py-0.5 text-xs font-medium text-violet-700">
                  {kw.keyword}
                </span>
              ))}
            </div>
          </div>
        )}
      </div>

      {/* Competitors + Opportunities */}
      <div className="grid gap-6 lg:grid-cols-2">
        {/* Competitors */}
        {competitors.length > 0 && (
          <div className="rounded-xl border border-border bg-background p-5 shadow-sm">
            <div className="mb-3 flex items-center gap-2">
              <Target className="h-4 w-4 text-muted-foreground" />
              <h2 className="text-sm font-semibold">Competitors</h2>
            </div>
            <div className="space-y-2.5">
              {competitors.slice(0, 4).map((c) => (
                <div key={c.id} className="flex items-start gap-3 rounded-lg bg-muted/30 px-3 py-2.5">
                  <div className="flex h-7 w-7 shrink-0 items-center justify-center rounded-md border border-border bg-background text-xs font-bold text-foreground">
                    {c.name.charAt(0)}
                  </div>
                  <div className="min-w-0">
                    <p className="text-sm font-medium text-foreground">{c.name}</p>
                    {c.website && (
                      <a href={c.website} target="_blank" rel="noopener noreferrer"
                        className="text-xs text-primary hover:underline truncate block max-w-[160px]">
                        {c.website.replace(/^https?:\/\//, "")}
                      </a>
                    )}
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Content Opportunities */}
        {opportunities.length > 0 && (
          <div className="rounded-xl border border-border bg-background p-5 shadow-sm">
            <div className="mb-3 flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Lightbulb className="h-4 w-4 text-amber-500" />
                <h2 className="text-sm font-semibold">Content Opportunities</h2>
              </div>
              <Link
                to="/admin/blogs/new"
                className="text-xs text-primary hover:underline"
              >
                Create post →
              </Link>
            </div>
            <div className="space-y-2">
              {opportunities.slice(0, 5).map((co) => (
                <div key={co.id} className="flex items-center gap-2.5 rounded-lg bg-muted/30 px-3 py-2">
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
          </div>
        )}
      </div>
    </div>
  );
}

function Dashboard() {
  const { data: stats } = useSuspenseQuery(statsQuery);

  const statCards: StatConfig[] = [
    { label: "Total Posts", value: stats.total, icon: FileText },
    { label: "Published", value: stats.published, icon: Send, accent: true },
    { label: "Drafts", value: stats.drafts, icon: FilePen },
    { label: "Scheduled", value: stats.scheduled, icon: Clock, amber: true },
    { label: "Total Views", value: stats.totalViews.toLocaleString(), icon: Eye, trend: "All time" },
  ];

  return (
    <div className="space-y-10">
      {/* Header */}
      <div className="flex items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold">Dashboard</h1>
          <p className="text-sm text-muted-foreground">Overview of your content and workspace</p>
        </div>
        <Link
          to="/admin/blogs/new"
          className="hidden items-center gap-2 rounded-xl bg-primary px-4 py-2.5 text-sm font-semibold text-primary-foreground shadow-sm transition-colors hover:bg-primary/90 sm:flex"
        >
          <Plus className="h-4 w-4" /> New Post
        </Link>
      </div>

      {/* Stats grid */}
      <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-5">
        {statCards.map((s) => <StatCard key={s.label} {...s} />)}
      </div>

      {/* Workspace Intelligence */}
      <WorkspaceIntelligencePanel />

      {/* Content + Actions */}
      <div className="grid gap-8 lg:grid-cols-[1fr_320px]">
        {/* Content tables */}
        <div className="space-y-8">
          {/* Top Posts */}
          <div className="rounded-xl border border-border bg-background shadow-sm">
            <div className="flex items-center justify-between border-b border-border px-5 py-4">
              <div className="flex items-center gap-2">
                <Eye className="h-4 w-4 text-primary" />
                <h2 className="text-sm font-semibold">Top Posts by Views</h2>
              </div>
              <Link
                to="/admin/blogs"
                className="flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground transition-colors"
              >
                View all <ArrowRight className="h-3.5 w-3.5" />
              </Link>
            </div>
            <div className="divide-y divide-border/60 px-5">
              {stats.topPosts.length === 0 ? (
                <div className="py-10 text-center">
                  <p className="text-sm text-muted-foreground">No published posts yet.</p>
                  <Link
                    to="/admin/blogs/new"
                    className="mt-3 inline-flex items-center gap-1.5 rounded-lg bg-primary px-4 py-2 text-xs font-semibold text-primary-foreground hover:bg-primary/90"
                  >
                    <Sparkles className="h-3.5 w-3.5" /> Generate First Post
                  </Link>
                </div>
              ) : (
                stats.topPosts.map((post, i) => (
                  <div key={post.id} className="flex items-center gap-3 py-3">
                    <span className="w-5 shrink-0 text-right text-xs font-bold text-muted-foreground/50 tabular-nums">
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
                    <span className="shrink-0 rounded-full bg-muted px-2 py-0.5 text-xs tabular-nums text-muted-foreground">
                      {post.views.toLocaleString()} views
                    </span>
                  </div>
                ))
              )}
            </div>
          </div>

          {/* Recent Posts */}
          <div className="rounded-xl border border-border bg-background shadow-sm">
            <div className="flex items-center justify-between border-b border-border px-5 py-4">
              <div className="flex items-center gap-2">
                <Activity className="h-4 w-4 text-primary" />
                <h2 className="text-sm font-semibold">Recently Updated</h2>
              </div>
              <Link
                to="/admin/blogs"
                className="flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground transition-colors"
              >
                View all <ArrowRight className="h-3.5 w-3.5" />
              </Link>
            </div>
            <div className="divide-y divide-border/60 px-5">
              {stats.recent.length === 0 ? (
                <p className="py-8 text-center text-sm text-muted-foreground">No posts yet.</p>
              ) : (
                stats.recent.map((post) => (
                  <div key={post.id} className="flex items-center gap-3 py-3">
                    <Link
                      to="/admin/blogs/$id"
                      params={{ id: post.id }}
                      className="min-w-0 flex-1 truncate text-sm font-medium hover:text-primary transition-colors"
                    >
                      {post.title || "Untitled"}
                    </Link>
                    <div className="flex shrink-0 items-center gap-2">
                      <StatusBadge status={post.status} />
                      <span className="text-xs text-muted-foreground">{formatBlogDate(post.updated_at)}</span>
                    </div>
                  </div>
                ))
              )}
            </div>
          </div>
        </div>

        {/* Right: Quick Actions */}
        <div className="space-y-4">
          <div className="flex items-center gap-2">
            <Settings className="h-4 w-4 text-muted-foreground" />
            <h2 className="text-sm font-semibold">Quick Actions</h2>
          </div>
          <div className="space-y-2">
            {QUICK_ACTIONS.map((action) => (
              <QuickActionCard key={action.to} action={action} />
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
