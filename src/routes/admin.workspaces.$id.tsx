import { createFileRoute, Link } from "@tanstack/react-router";
import { createServerFn } from "@tanstack/react-start";
import { queryOptions, useSuspenseQuery } from "@tanstack/react-query";
import {
  ArrowLeft, LayoutDashboard, Cpu, Bell, FileText, Clock,
  Globe, Settings, FolderOpen, TrendingUp, CreditCard,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import type { Workspace } from "@/lib/workspace.functions";

interface WorkspaceDashboardData {
  workspace: Workspace;
  stats: {
    aiGenerations: number;
    notifications: number;
    billingUsageMonth: number; // api calls this period
    postsTotal: number;
  };
}

const getWorkspaceDashboard = createServerFn({ method: "GET" })
  .validator((input: { id: string }) => input)
  .handler(async ({ data }): Promise<WorkspaceDashboardData> => {
    const { getAdminClient } = await import("../lib/supabase.server");
    const supabase = await getAdminClient();
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const db = supabase as any;

    const { data: ws, error: wsError } = await supabase
      .from("workspaces")
      .select("*")
      .eq("id", data.id)
      .single();

    if (wsError || !ws) throw new Error("Workspace not found");

    // Run all counts in parallel — fall back to 0 if tables don't exist yet
    const [genRes, notifRes, usageRes, postsRes] = await Promise.all([
      db.from("ai_generations").select("id", { count: "exact", head: true }).eq("workspace_id", data.id),
      db.from("notifications").select("id", { count: "exact", head: true }).eq("workspace_id", data.id).is("dismissed_at", null),
      db.from("billing_usage").select("api_call_count").eq("workspace_id", data.id).order("period_start", { ascending: false }).limit(1).maybeSingle(),
      supabase.from("blog_posts").select("id", { count: "exact", head: true }),
    ]);

    return {
      workspace: ws as Workspace,
      stats: {
        aiGenerations:      genRes.count   ?? 0,
        notifications:      notifRes.count ?? 0,
        billingUsageMonth:  usageRes.data?.api_call_count ?? 0,
        postsTotal:         postsRes.count ?? 0,
      },
    };
  });

const workspaceDashboardQuery = (id: string) =>
  queryOptions({
    queryKey: ["admin", "workspace-dashboard", id],
    queryFn: () => getWorkspaceDashboard({ data: { id } }),
  });

export const Route = createFileRoute("/admin/workspaces/$id")({
  head: () => ({ meta: [{ title: "Workspace — Admin" }] }),
  loader: async ({ context, params }) => {
    await context.queryClient.ensureQueryData(workspaceDashboardQuery(params.id));
  },
  component: WorkspaceDashboardPage,
  errorComponent: ({ error }) => (
    <div className="flex flex-col items-center gap-3 py-24 text-center">
      <p className="text-destructive font-medium">{error.message}</p>
      <Link to="/admin/workspaces">
        <Button variant="outline" size="sm">
          <ArrowLeft className="mr-2 h-4 w-4" /> Back to workspaces
        </Button>
      </Link>
    </div>
  ),
});

function StatCard({
  label, value, icon: Icon, sub, accent,
}: {
  label: string; value: string | number; icon: React.ComponentType<{ className?: string }>; sub?: string; accent?: boolean;
}) {
  return (
    <div className="rounded-xl border border-border bg-background p-5 shadow-sm">
      <div className="flex items-center justify-between mb-3">
        <span className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">{label}</span>
        <span className={cn(
          "flex h-8 w-8 items-center justify-center rounded-lg",
          accent ? "bg-primary/10 text-primary" : "bg-muted text-muted-foreground",
        )}>
          <Icon className="h-4 w-4" />
        </span>
      </div>
      <p className={cn("text-3xl font-bold tabular-nums", accent && "text-primary")}>{value}</p>
      {sub && <p className="mt-1 text-xs text-muted-foreground">{sub}</p>}
    </div>
  );
}

const WORKSPACE_COLORS = [
  "from-red-500 to-rose-600",
  "from-orange-500 to-amber-600",
  "from-violet-500 to-purple-600",
  "from-blue-500 to-cyan-600",
  "from-emerald-500 to-teal-600",
  "from-pink-500 to-fuchsia-600",
];

function wsGradient(name: string) {
  let h = 0;
  for (const c of name) h = (h * 31 + c.charCodeAt(0)) & 0xffffffff;
  return WORKSPACE_COLORS[Math.abs(h) % WORKSPACE_COLORS.length];
}

function formatDate(d: string) {
  return new Date(d).toLocaleDateString("en-US", { month: "long", day: "numeric", year: "numeric" });
}

function WorkspaceDashboardPage() {
  const { id } = Route.useParams();
  const { data } = useSuspenseQuery(workspaceDashboardQuery(id));
  const { workspace: ws, stats } = data;
  const gradient = wsGradient(ws.name);

  return (
    <div className="space-y-10">
      {/* Nav breadcrumb */}
      <div className="flex items-center gap-3 flex-wrap">
        <Link
          to="/admin/dashboard"
          className="flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground transition-colors"
        >
          <LayoutDashboard className="h-3.5 w-3.5" />
          Main Dashboard
        </Link>
        <span className="text-muted-foreground/40">/</span>
        <Link
          to="/admin/workspaces"
          className="flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground transition-colors"
        >
          <FolderOpen className="h-3.5 w-3.5" />
          Workspaces
        </Link>
        <span className="text-muted-foreground/40">/</span>
        <span className="text-sm font-medium">{ws.name}</span>
      </div>

      {/* Workspace hero */}
      <div className="relative overflow-hidden rounded-2xl border border-border bg-background shadow-sm">
        {/* Gradient accent bar */}
        <div className={cn("absolute inset-x-0 top-0 h-1 bg-gradient-to-r", gradient)} />

        <div className="flex items-start gap-5 p-6 pt-7">
          {/* Avatar */}
          <div className={cn(
            "flex h-14 w-14 shrink-0 items-center justify-center rounded-xl bg-gradient-to-br text-xl font-bold text-white shadow-sm",
            gradient,
          )}>
            {ws.name.slice(0, 2).toUpperCase()}
          </div>

          <div className="flex-1 min-w-0">
            <div className="flex items-start justify-between gap-4 flex-wrap">
              <div>
                <h1 className="text-2xl font-bold">{ws.name}</h1>
                {ws.description && (
                  <p className="mt-0.5 text-sm text-muted-foreground">{ws.description}</p>
                )}
                <div className="mt-2 flex flex-wrap items-center gap-3 text-xs text-muted-foreground">
                  <span className="flex items-center gap-1">
                    <Globe className="h-3 w-3" />
                    <code className="font-mono">{ws.slug}</code>
                  </span>
                  <span className="flex items-center gap-1">
                    <Clock className="h-3 w-3" />
                    Created {formatDate(ws.created_at)}
                  </span>
                </div>
              </div>

              <div className="flex items-center gap-2 shrink-0">
                <Link to="/admin/dashboard">
                  <Button variant="outline" size="sm" className="gap-1.5">
                    <LayoutDashboard className="h-3.5 w-3.5" />
                    Main Dashboard
                  </Button>
                </Link>
                <Link to="/admin/workspaces">
                  <Button variant="outline" size="sm" className="gap-1.5">
                    <ArrowLeft className="h-3.5 w-3.5" />
                    All Workspaces
                  </Button>
                </Link>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
        <StatCard label="Total Posts" value={stats.postsTotal} icon={FileText} />
        <StatCard label="AI Generations" value={stats.aiGenerations} icon={Cpu} accent />
        <StatCard label="Notifications" value={stats.notifications} icon={Bell} sub="Unread" />
        <StatCard label="API Calls" value={stats.billingUsageMonth.toLocaleString()} icon={TrendingUp} sub="This period" />
      </div>

      {/* Quick actions */}
      <div>
        <h2 className="mb-4 text-sm font-semibold">Quick Actions</h2>
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {[
            { label: "Write a Blog Post", desc: "Create content for this workspace", icon: FileText, to: "/admin/blogs/new" },
            { label: "AI Assistant", desc: "Generate content with AI", icon: Cpu, to: "/admin/ai-assistant" },
            { label: "Notifications", desc: "View workspace notifications", icon: Bell, to: "/admin/notifications" },
            { label: "Analytics", desc: "Content performance overview", icon: TrendingUp, to: "/admin/analytics" },
            { label: "Billing & Plan", desc: "Usage and subscription", icon: CreditCard, to: "/admin/billing" },
            { label: "Settings", desc: "Workspace configuration", icon: Settings, to: "/admin/settings" },
          ].map((action) => (
            <Link key={action.to} to={action.to}>
              <div className="group flex items-start gap-4 rounded-xl border border-border bg-background p-4 shadow-sm transition-all hover:border-primary/30 hover:shadow-md cursor-pointer">
                <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-primary/10 text-primary group-hover:bg-primary group-hover:text-primary-foreground transition-colors">
                  <action.icon className="h-4 w-4" />
                </div>
                <div className="min-w-0">
                  <p className="text-sm font-semibold">{action.label}</p>
                  <p className="text-xs text-muted-foreground">{action.desc}</p>
                </div>
              </div>
            </Link>
          ))}
        </div>
      </div>
    </div>
  );
}
