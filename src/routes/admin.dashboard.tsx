import { createFileRoute, Link } from "@tanstack/react-router";
import { createServerFn } from "@tanstack/react-start";
import { queryOptions, useSuspenseQuery } from "@tanstack/react-query";
import {
  FileText, ImageIcon, Sparkles, Key, BarChart2, Plus,
  ArrowRight, Clock, Activity, FolderOpen, Globe, Zap,
  Users, TrendingUp, BookOpen, HelpCircle,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { publishScheduledPosts } from "@/lib/schedule.functions";

// ── Types ─────────────────────────────────────────────────────────────────────
interface WorkspaceRow {
  id: string; name: string; slug: string; description: string | null;
  created_at: string; updated_at: string;
}
interface ActivityRow {
  id: string; actor_name: string; action: string;
  entity_type: string; entity_label: string | null; occurred_at: string;
}
interface GlobalStats {
  workspaceCount: number;
  postCount: number;
  mediaCount: number;
  aiCount: number;
  apiKeyCount: number;
  workspaces: WorkspaceRow[];
  recentActivity: ActivityRow[];
  postsByStatus: { published: number; draft: number; scheduled: number };
}

// ── Server fn ─────────────────────────────────────────────────────────────────
const getGlobalStats = createServerFn({ method: "GET" }).handler(
  async (): Promise<GlobalStats> => {
    const { getAdminClient } = await import("@/lib/supabase.server");
    const db = getAdminClient() as any;

    const [wsRes, postsRes, pubRes, draftRes, schedRes, mediaRes, aiRes, keysRes, actRes] =
      await Promise.all([
        db.from("workspaces").select("id,name,slug,description,created_at,updated_at").order("created_at", { ascending: false }),
        db.from("blog_posts").select("id", { count: "exact", head: true }),
        db.from("blog_posts").select("id", { count: "exact", head: true }).eq("status", "published"),
        db.from("blog_posts").select("id", { count: "exact", head: true }).eq("status", "draft"),
        db.from("blog_posts").select("id", { count: "exact", head: true }).eq("status", "scheduled"),
        db.from("media_files").select("id", { count: "exact", head: true }),
        db.from("ai_generations").select("id", { count: "exact", head: true }),
        db.from("api_keys").select("id", { count: "exact", head: true }).is("revoked_at", null),
        db.from("activity_log").select("id,actor_name,action,entity_type,entity_label,occurred_at")
          .order("occurred_at", { ascending: false }).limit(10),
      ]);

    return {
      workspaceCount: wsRes.data?.length ?? 0,
      postCount: postsRes.count ?? 0,
      mediaCount: mediaRes.count ?? 0,
      aiCount: aiRes.count ?? 0,
      apiKeyCount: keysRes.count ?? 0,
      workspaces: wsRes.data ?? [],
      recentActivity: actRes.data ?? [],
      postsByStatus: {
        published: pubRes.count ?? 0,
        draft: draftRes.count ?? 0,
        scheduled: schedRes.count ?? 0,
      },
    };
  }
);

// ── Route ─────────────────────────────────────────────────────────────────────
const globalStatsQuery = queryOptions({
  queryKey: ["global", "dashboard"],
  queryFn: () => getGlobalStats(),
});

export const Route = createFileRoute("/admin/dashboard")({
  head: () => ({ meta: [{ title: "Dashboard — Lunar CMS" }] }),
  loader: async ({ context }) => {
    await publishScheduledPosts().catch(() => {});
    return context.queryClient.ensureQueryData(globalStatsQuery);
  },
  component: GlobalDashboard,
  errorComponent: ({ error }) => (
    <p className="p-8 text-sm text-red-600">{error.message}</p>
  ),
});

// ── Helpers ───────────────────────────────────────────────────────────────────
const WS_GRADIENTS = [
  "from-red-500 to-rose-600",
  "from-violet-500 to-purple-600",
  "from-blue-500 to-cyan-600",
  "from-emerald-500 to-teal-600",
  "from-orange-500 to-amber-600",
  "from-pink-500 to-fuchsia-600",
  "from-indigo-500 to-blue-600",
  "from-green-500 to-emerald-600",
];
function wsGradient(name: string) {
  let h = 0;
  for (const c of name) h = (h * 31 + c.charCodeAt(0)) & 0xffffffff;
  return WS_GRADIENTS[Math.abs(h) % WS_GRADIENTS.length];
}
function fmtRelative(d: string) {
  const ms = Date.now() - new Date(d).getTime();
  const m = Math.floor(ms / 60000);
  if (m < 1) return "just now";
  if (m < 60) return `${m}m ago`;
  const h = Math.floor(m / 60);
  if (h < 24) return `${h}h ago`;
  const days = Math.floor(h / 24);
  if (days < 7) return `${days}d ago`;
  return new Date(d).toLocaleDateString("en-US", { month: "short", day: "numeric" });
}
function fmtAction(action: string) {
  return action.replace(/[._]/g, " ").replace(/\b\w/g, (c) => c.toUpperCase());
}
const ENTITY_COLORS: Record<string, string> = {
  post: "bg-blue-100 text-blue-700",
  collection: "bg-violet-100 text-violet-700",
  media: "bg-emerald-100 text-emerald-700",
  workspace: "bg-orange-100 text-orange-700",
  api_key: "bg-red-100 text-red-700",
  webhook: "bg-amber-100 text-amber-700",
  system: "bg-gray-100 text-gray-600",
  settings: "bg-gray-100 text-gray-600",
  ai_generation: "bg-purple-100 text-purple-700",
};

// ── Sub-components ─────────────────────────────────────────────────────────────
function StatCard({
  label, value, icon: Icon, sub, accent,
}: {
  label: string; value: string | number;
  icon: React.ComponentType<{ className?: string }>;
  sub?: string; accent?: boolean;
}) {
  return (
    <div className={cn(
      "flex flex-col gap-4 rounded-xl border p-5 transition-shadow hover:shadow-md",
      accent ? "border-primary/20 bg-primary/5" : "border-border bg-white",
    )}>
      <div className="flex items-center justify-between">
        <span className={cn(
          "flex h-9 w-9 items-center justify-center rounded-lg",
          accent ? "bg-primary text-white" : "bg-muted text-muted-foreground",
        )}>
          <Icon className="h-4 w-4" />
        </span>
        {sub && (
          <span className="flex items-center gap-1 text-xs text-emerald-600 font-medium">
            <TrendingUp className="h-3 w-3" /> {sub}
          </span>
        )}
      </div>
      <div>
        <p className={cn(
          "text-3xl font-bold tabular-nums tracking-tight",
          accent ? "text-primary" : "text-foreground",
        )}>
          {typeof value === "number" ? value.toLocaleString() : value}
        </p>
        <p className="mt-0.5 text-sm text-muted-foreground">{label}</p>
      </div>
    </div>
  );
}

function WorkspaceCard({ ws }: { ws: WorkspaceRow }) {
  const gradient = wsGradient(ws.name);
  const initials = ws.name.slice(0, 2).toUpperCase();

  return (
    <Link to="/admin/workspaces/$id" params={{ id: ws.id }}>
      <div className="group relative overflow-hidden rounded-xl border border-border bg-white p-5 shadow-sm transition-all hover:shadow-md hover:border-primary/30 cursor-pointer">
        {/* Top gradient bar */}
        <div className={cn("absolute inset-x-0 top-0 h-0.5 bg-gradient-to-r", gradient)} />

        <div className="flex items-start gap-3">
          {/* Avatar */}
          <div className={cn(
            "flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-gradient-to-br text-sm font-bold text-white shadow-sm",
            gradient,
          )}>
            {initials}
          </div>

          <div className="min-w-0 flex-1">
            <div className="flex items-center gap-2">
              <p className="truncate text-sm font-semibold text-foreground group-hover:text-primary transition-colors">
                {ws.name}
              </p>
              {ws.slug === "default" && (
                <span className="shrink-0 rounded-full bg-muted px-1.5 py-0.5 text-[10px] font-medium text-muted-foreground">
                  default
                </span>
              )}
            </div>
            {ws.description ? (
              <p className="mt-0.5 line-clamp-2 text-xs text-muted-foreground">{ws.description}</p>
            ) : (
              <p className="mt-0.5 text-xs text-muted-foreground/50 italic">No description</p>
            )}
            <div className="mt-3 flex items-center gap-1 text-[11px] text-muted-foreground">
              <Clock className="h-3 w-3 shrink-0" />
              <span>Updated {fmtRelative(ws.updated_at)}</span>
            </div>
          </div>

          <ArrowRight className="h-4 w-4 shrink-0 text-muted-foreground/30 transition-all group-hover:translate-x-0.5 group-hover:text-primary mt-0.5" />
        </div>
      </div>
    </Link>
  );
}

function ActivityItem({ entry }: { entry: ActivityRow }) {
  const dot = ENTITY_COLORS[entry.entity_type] ?? "bg-gray-100 text-gray-600";
  return (
    <div className="flex items-start gap-3 py-3 border-b border-border last:border-0">
      <div className={cn("mt-0.5 shrink-0 rounded-full px-2 py-0.5 text-[10px] font-semibold", dot)}>
        {entry.entity_type.replace(/_/g, " ")}
      </div>
      <div className="min-w-0 flex-1">
        <p className="text-sm text-foreground">
          <span className="font-medium">{entry.actor_name}</span>{" "}
          <span className="text-muted-foreground">{fmtAction(entry.action)}</span>
          {entry.entity_label && (
            <> — <span className="font-medium text-foreground">{entry.entity_label}</span></>
          )}
        </p>
        <p className="mt-0.5 text-[11px] text-muted-foreground">{fmtRelative(entry.occurred_at)}</p>
      </div>
    </div>
  );
}

// ── Main component ─────────────────────────────────────────────────────────────
function GlobalDashboard() {
  const { data } = useSuspenseQuery(globalStatsQuery);
  const { workspaceCount, postCount, mediaCount, aiCount, apiKeyCount, workspaces, recentActivity, postsByStatus } = data;

  const QUICK_ACTIONS = [
    { label: "New Workspace", desc: "Create an isolated content project", to: "/admin/workspaces", icon: FolderOpen, primary: true },
    { label: "Write Post", desc: "Publish to your blog", to: "/admin/blogs/new", icon: FileText },
    { label: "Upload Media", desc: "Add images to the library", to: "/admin/media", icon: ImageIcon },
    { label: "AI Assistant", desc: "Generate content with AI", to: "/admin/ai-assistant", icon: Sparkles },
    { label: "Analytics", desc: "View traffic and usage", to: "/admin/analytics", icon: BarChart2 },
    { label: "API Keys", desc: "Manage access tokens", to: "/admin/api-keys", icon: Key },
  ];

  return (
    <div className="min-h-full space-y-10 px-8 py-8">

      {/* ── Header ── */}
      <div className="flex items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Dashboard</h1>
          <p className="mt-0.5 text-sm text-muted-foreground">
            Manage all your workspaces and content from one place.
          </p>
        </div>
        <Link
          to="/admin/workspaces"
          className="flex items-center gap-2 rounded-lg bg-primary px-4 py-2 text-sm font-semibold text-white shadow-sm hover:bg-primary/90 transition-colors"
        >
          <Plus className="h-4 w-4" /> New Workspace
        </Link>
      </div>

      {/* ── Stats ── */}
      <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-5">
        <StatCard label="Workspaces" value={workspaceCount} icon={FolderOpen} accent />
        <StatCard label="Total Posts" value={postCount} icon={FileText} />
        <StatCard label="Media Files" value={mediaCount} icon={ImageIcon} />
        <StatCard label="AI Generations" value={aiCount} icon={Sparkles} />
        <StatCard label="Active API Keys" value={apiKeyCount} icon={Key} />
      </div>

      {/* ── Content Status Bar ── */}
      {postCount > 0 && (
        <div className="rounded-xl border border-border bg-white p-5 shadow-sm">
          <div className="mb-4 flex items-center gap-2">
            <Activity className="h-4 w-4 text-muted-foreground" />
            <h2 className="text-sm font-semibold">Content Status</h2>
            <span className="ml-auto text-xs text-muted-foreground">{postCount} total posts</span>
          </div>
          <div className="flex h-2 overflow-hidden rounded-full bg-muted">
            {postsByStatus.published > 0 && (
              <div
                className="h-full bg-emerald-500 transition-all"
                style={{ width: `${(postsByStatus.published / postCount) * 100}%` }}
              />
            )}
            {postsByStatus.scheduled > 0 && (
              <div
                className="h-full bg-amber-400 transition-all"
                style={{ width: `${(postsByStatus.scheduled / postCount) * 100}%` }}
              />
            )}
            {postsByStatus.draft > 0 && (
              <div
                className="h-full bg-zinc-300 transition-all"
                style={{ width: `${(postsByStatus.draft / postCount) * 100}%` }}
              />
            )}
          </div>
          <div className="mt-3 flex items-center gap-6 text-xs text-muted-foreground">
            <span className="flex items-center gap-1.5"><span className="h-2 w-2 rounded-full bg-emerald-500 inline-block" />{postsByStatus.published} published</span>
            <span className="flex items-center gap-1.5"><span className="h-2 w-2 rounded-full bg-amber-400 inline-block" />{postsByStatus.scheduled} scheduled</span>
            <span className="flex items-center gap-1.5"><span className="h-2 w-2 rounded-full bg-zinc-300 inline-block" />{postsByStatus.draft} drafts</span>
          </div>
        </div>
      )}

      {/* ── Main Grid ── */}
      <div className="grid gap-8 lg:grid-cols-[1fr_300px]">
        <div className="space-y-8">

          {/* Workspaces */}
          <section>
            <div className="mb-4 flex items-center justify-between">
              <div className="flex items-center gap-2">
                <FolderOpen className="h-4 w-4 text-muted-foreground" />
                <h2 className="text-sm font-semibold">Your Workspaces</h2>
                <span className="rounded-full bg-muted px-2 py-0.5 text-[11px] font-medium text-muted-foreground">
                  {workspaceCount}
                </span>
              </div>
              <Link
                to="/admin/workspaces"
                className="flex items-center gap-1 text-xs text-primary hover:underline font-medium"
              >
                Manage all <ArrowRight className="h-3 w-3" />
              </Link>
            </div>

            {workspaces.length === 0 ? (
              <div className="flex flex-col items-center gap-3 rounded-xl border border-dashed border-border py-16 text-center">
                <FolderOpen className="h-8 w-8 text-muted-foreground/30" />
                <p className="text-sm font-medium">No workspaces yet</p>
                <p className="text-xs text-muted-foreground">Create your first workspace to organize your content.</p>
                <Link
                  to="/admin/workspaces"
                  className="mt-1 flex items-center gap-1.5 rounded-lg bg-primary px-3 py-1.5 text-xs font-semibold text-white hover:bg-primary/90 transition-colors"
                >
                  <Plus className="h-3 w-3" /> Create Workspace
                </Link>
              </div>
            ) : (
              <div className="grid gap-3 sm:grid-cols-2">
                {workspaces.map((ws) => (
                  <WorkspaceCard key={ws.id} ws={ws} />
                ))}
                {/* Add new card */}
                <Link to="/admin/workspaces">
                  <div className="flex items-center gap-3 rounded-xl border border-dashed border-border bg-white p-5 text-sm text-muted-foreground hover:border-primary/40 hover:text-primary transition-colors cursor-pointer h-full min-h-[88px]">
                    <Plus className="h-5 w-5 shrink-0" />
                    <span>New Workspace</span>
                  </div>
                </Link>
              </div>
            )}
          </section>

          {/* Quick Actions */}
          <section>
            <div className="mb-4 flex items-center gap-2">
              <Zap className="h-4 w-4 text-muted-foreground" />
              <h2 className="text-sm font-semibold">Quick Actions</h2>
            </div>
            <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
              {QUICK_ACTIONS.map((a) => (
                <Link key={a.to} to={a.to}>
                  <div className={cn(
                    "group flex items-center gap-3 rounded-xl border p-4 transition-all hover:shadow-sm cursor-pointer",
                    a.primary
                      ? "border-primary/20 bg-primary/5 hover:bg-primary/10"
                      : "border-border bg-white hover:border-primary/20",
                  )}>
                    <span className={cn(
                      "flex h-9 w-9 shrink-0 items-center justify-center rounded-lg transition-transform group-hover:scale-110",
                      a.primary ? "bg-primary text-white" : "bg-muted text-muted-foreground",
                    )}>
                      <a.icon className="h-4 w-4" />
                    </span>
                    <div className="min-w-0">
                      <p className={cn("text-sm font-semibold", a.primary && "text-primary")}>{a.label}</p>
                      <p className="text-xs text-muted-foreground truncate">{a.desc}</p>
                    </div>
                  </div>
                </Link>
              ))}
            </div>
          </section>
        </div>

        {/* ── Right: Activity Feed ── */}
        <div className="space-y-6">
          {/* Help links */}
          <div className="rounded-xl border border-border bg-white p-4 shadow-sm space-y-1">
            <p className="mb-3 text-[11px] font-semibold uppercase tracking-widest text-muted-foreground">Resources</p>
            {[
              { label: "Documentation", icon: BookOpen, to: "/admin/api-explorer" },
              { label: "API Explorer", icon: Globe, to: "/admin/api-explorer" },
              { label: "Billing & Plans", icon: Key, to: "/admin/billing" },
              { label: "Support", icon: HelpCircle, to: "/admin/settings" },
              { label: "Team & Users", icon: Users, to: "/admin/users" },
            ].map((l) => (
              <Link
                key={l.label}
                to={l.to}
                className="flex items-center gap-2.5 rounded-lg px-2 py-2 text-sm text-muted-foreground hover:bg-muted/50 hover:text-foreground transition-colors"
              >
                <l.icon className="h-3.5 w-3.5 shrink-0" />
                {l.label}
              </Link>
            ))}
          </div>

          {/* Recent Activity */}
          <div className="rounded-xl border border-border bg-white p-5 shadow-sm">
            <div className="mb-1 flex items-center gap-2">
              <Activity className="h-4 w-4 text-muted-foreground" />
              <h2 className="text-sm font-semibold">Recent Activity</h2>
            </div>
            {recentActivity.length === 0 ? (
              <p className="py-8 text-center text-sm text-muted-foreground">No activity yet.</p>
            ) : (
              <div>
                {recentActivity.map((entry) => (
                  <ActivityItem key={entry.id} entry={entry} />
                ))}
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
