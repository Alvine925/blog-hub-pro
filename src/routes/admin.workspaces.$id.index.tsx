import { createFileRoute, Link } from "@tanstack/react-router";
import { createServerFn } from "@tanstack/react-start";
import { queryOptions, useSuspenseQuery } from "@tanstack/react-query";
import {
  FileText, Layers, ImageIcon, Sparkles, Key, Clock, Activity,
  Plus, Eye, Send, FilePen, ArrowRight, Zap, TrendingUp,
} from "lucide-react";
import { cn } from "@/lib/utils";

// ── Types ─────────────────────────────────────────────────────────────────────
interface RecentPost {
  id: string; title: string; status: string;
  updated_at: string; views: number; slug: string;
}
interface ActivityEntry {
  id: string; actor_name: string; action: string;
  entity_label: string | null; occurred_at: string; entity_type: string;
}
interface Overview {
  stats: {
    postsTotal: number; postsPublished: number; postsDraft: number;
    postsScheduled: number; collections: number; mediaFiles: number; aiGenerations: number;
  };
  recentPosts: RecentPost[];
  recentActivity: ActivityEntry[];
}

// ── Server fn ─────────────────────────────────────────────────────────────────
const getOverview = createServerFn({ method: "GET" })
  .validator((input: { id: string }) => input)
  .handler(async ({ data }): Promise<Overview> => {
    const { getAdminClient } = await import("../../lib/supabase.server");
    const db = getAdminClient() as any;

    const [pubRes, draftRes, schedRes, collRes, mediaRes, aiRes, postsRes, actRes] = await Promise.all([
      db.from("blog_posts").select("id", { count: "exact", head: true }).eq("status", "published"),
      db.from("blog_posts").select("id", { count: "exact", head: true }).eq("status", "draft"),
      db.from("blog_posts").select("id", { count: "exact", head: true }).eq("status", "scheduled"),
      db.from("collections").select("id", { count: "exact", head: true }),
      db.from("media_files").select("id", { count: "exact", head: true }).eq("workspace_id", data.id),
      db.from("ai_generations").select("id", { count: "exact", head: true }).eq("workspace_id", data.id),
      db.from("blog_posts")
        .select("id,title,status,updated_at,views,slug")
        .order("updated_at", { ascending: false })
        .limit(8),
      db.from("activity_log")
        .select("id,actor_name,action,entity_label,occurred_at,entity_type")
        .order("occurred_at", { ascending: false })
        .limit(8),
    ]);

    const pub   = pubRes.count   ?? 0;
    const draft = draftRes.count ?? 0;
    const sched = schedRes.count ?? 0;

    return {
      stats: {
        postsTotal:     pub + draft + sched,
        postsPublished: pub,
        postsDraft:     draft,
        postsScheduled: sched,
        collections:    collRes.count  ?? 0,
        mediaFiles:     mediaRes.count ?? 0,
        aiGenerations:  aiRes.count    ?? 0,
      },
      recentPosts:    postsRes.data ?? [],
      recentActivity: actRes.data   ?? [],
    };
  });

// ── Route ─────────────────────────────────────────────────────────────────────
const overviewQuery = (id: string) =>
  queryOptions({
    queryKey: ["workspace-overview", id],
    queryFn:  () => getOverview({ data: { id } }),
  });

export const Route = createFileRoute("/admin/workspaces/$id/")({
  loader:         ({ context, params }) => context.queryClient.ensureQueryData(overviewQuery(params.id)),
  component:      WorkspaceOverview,
  errorComponent: ({ error }) => <p className="p-8 text-sm text-red-600">{error.message}</p>,
});

// ── Helpers ───────────────────────────────────────────────────────────────────
function fmtDate(d: string) {
  return new Date(d).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" });
}
function fmtRelative(d: string) {
  const ms = Date.now() - new Date(d).getTime();
  const m  = Math.floor(ms / 60000);
  if (m < 1)  return "just now";
  if (m < 60) return `${m}m ago`;
  const h = Math.floor(m / 60);
  if (h < 24) return `${h}h ago`;
  return `${Math.floor(h / 24)}d ago`;
}
function fmtAction(action: string) {
  return action.replace(/[._]/g, " ").replace(/\b\w/g, (c) => c.toUpperCase());
}

const STATUS_CFG: Record<string, { label: string; class: string; dot: string }> = {
  published: { label: "Published", class: "text-emerald-700 bg-emerald-50 border-emerald-200", dot: "bg-emerald-500" },
  draft:     { label: "Draft",     class: "text-gray-600   bg-gray-50   border-gray-200",     dot: "bg-gray-400"   },
  scheduled: { label: "Scheduled", class: "text-amber-700  bg-amber-50  border-amber-200",    dot: "bg-amber-500"  },
};

// ── Sub-components ─────────────────────────────────────────────────────────────
function StatCard({
  label, value, icon: Icon, accent, amber, green,
}: {
  label: string; value: number;
  icon: React.ComponentType<{ className?: string }>;
  accent?: boolean; amber?: boolean; green?: boolean;
}) {
  return (
    <div className={cn(
      "flex flex-col gap-3 rounded-xl border p-5 shadow-sm transition-shadow hover:shadow-md",
      accent ? "border-primary/20 bg-primary/5"
             : amber ? "border-amber-200 bg-amber-50"
             : green ? "border-emerald-200 bg-emerald-50"
             : "border-border bg-white",
    )}>
      <div className="flex items-center justify-between">
        <span className={cn(
          "flex h-8 w-8 items-center justify-center rounded-lg text-xs",
          accent ? "bg-primary text-white"
                 : amber ? "bg-amber-500 text-white"
                 : green ? "bg-emerald-500 text-white"
                 : "bg-muted text-muted-foreground",
        )}>
          <Icon className="h-3.5 w-3.5" />
        </span>
      </div>
      <div>
        <p className={cn(
          "text-2xl font-bold tabular-nums",
          accent ? "text-primary" : amber ? "text-amber-700" : green ? "text-emerald-700" : "text-foreground",
        )}>
          {value.toLocaleString()}
        </p>
        <p className="mt-0.5 text-xs text-muted-foreground">{label}</p>
      </div>
    </div>
  );
}

function StatusBadge({ status }: { status: string }) {
  const cfg = STATUS_CFG[status] ?? STATUS_CFG.draft;
  return (
    <span className={cn("inline-flex items-center gap-1 rounded-full border px-2 py-0.5 text-[11px] font-medium", cfg.class)}>
      <span className={cn("h-1.5 w-1.5 rounded-full", cfg.dot)} />
      {cfg.label}
    </span>
  );
}

// ── Page ──────────────────────────────────────────────────────────────────────
function WorkspaceOverview() {
  const { id } = Route.useParams();
  const { data } = useSuspenseQuery(overviewQuery(id));
  const { stats, recentPosts, recentActivity } = data;

  const base  = `/admin/workspaces/${id}`;
  const total = Math.max(stats.postsTotal, 1);

  const QUICK_ACTIONS = [
    { label: "New Blog Post",   desc: "Write and publish content",   to: "/admin/blogs/new",     icon: FileText,  primary: true },
    { label: "New Collection",  desc: "Define a content type",       to: `${base}/collections`,  icon: Layers     },
    { label: "Upload Media",    desc: "Add images and files",        to: `${base}/media`,        icon: ImageIcon  },
    { label: "AI Assistant",    desc: "Generate content with AI",    to: `${base}/ai-assistant`, icon: Sparkles   },
    { label: "API Keys",        desc: "Manage access tokens",        to: `${base}/api-keys`,     icon: Key        },
    { label: "Analytics",       desc: "View performance metrics",    to: `${base}/analytics`,    icon: TrendingUp },
  ];

  return (
    <div className="min-h-full space-y-8 px-8 py-8">

      {/* ── Header ── */}
      <div className="flex items-start justify-between gap-4">
        <div>
          <h1 className="text-xl font-bold tracking-tight">Overview</h1>
          <p className="mt-0.5 text-sm text-muted-foreground">Content and activity summary for this workspace.</p>
        </div>
        <Link
          to="/admin/blogs/new"
          className="flex items-center gap-2 rounded-lg bg-primary px-4 py-2 text-sm font-semibold text-white shadow-sm hover:bg-primary/90 transition-colors shrink-0"
        >
          <Plus className="h-4 w-4" /> New Post
        </Link>
      </div>

      {/* ── Stat Cards ── */}
      <div className="grid grid-cols-2 gap-4 sm:grid-cols-4 lg:grid-cols-7">
        <StatCard label="Total Posts"  value={stats.postsTotal}     icon={FileText}  />
        <StatCard label="Published"    value={stats.postsPublished} icon={Send}      green   />
        <StatCard label="Drafts"       value={stats.postsDraft}     icon={FilePen}   />
        <StatCard label="Scheduled"    value={stats.postsScheduled} icon={Clock}     amber   />
        <StatCard label="Collections"  value={stats.collections}    icon={Layers}    accent  />
        <StatCard label="Media Files"  value={stats.mediaFiles}     icon={ImageIcon} />
        <StatCard label="AI Gens"      value={stats.aiGenerations}  icon={Sparkles}  />
      </div>

      {/* ── Content Status ── */}
      {stats.postsTotal > 0 && (
        <div className="rounded-xl border border-border bg-white p-5 shadow-sm">
          <div className="mb-4 flex items-center gap-2">
            <Activity className="h-4 w-4 text-muted-foreground" />
            <h2 className="text-sm font-semibold">Content Status</h2>
          </div>
          <div className="flex h-2 overflow-hidden rounded-full bg-muted">
            <div className="h-full bg-emerald-500 transition-all" style={{ width: `${(stats.postsPublished / total) * 100}%` }} />
            <div className="h-full bg-amber-400  transition-all" style={{ width: `${(stats.postsScheduled / total) * 100}%` }} />
            <div className="h-full bg-zinc-300   transition-all" style={{ width: `${(stats.postsDraft     / total) * 100}%` }} />
          </div>
          <div className="mt-3 flex flex-wrap items-center gap-5 text-xs text-muted-foreground">
            <span className="flex items-center gap-1.5"><span className="h-2 w-2 rounded-full bg-emerald-500" />{stats.postsPublished} published</span>
            <span className="flex items-center gap-1.5"><span className="h-2 w-2 rounded-full bg-amber-400"  />{stats.postsScheduled} scheduled</span>
            <span className="flex items-center gap-1.5"><span className="h-2 w-2 rounded-full bg-zinc-300"   />{stats.postsDraft} drafts</span>
          </div>
        </div>
      )}

      {/* ── Main Grid ── */}
      <div className="grid gap-8 lg:grid-cols-[1fr_280px]">

        {/* Left: Posts table + Quick Actions */}
        <div className="space-y-8">

          {/* Recent Posts */}
          <div className="rounded-xl border border-border bg-white shadow-sm">
            <div className="flex items-center justify-between border-b border-border px-5 py-4">
              <div className="flex items-center gap-2">
                <Eye className="h-4 w-4 text-primary" />
                <h2 className="text-sm font-semibold">Recent Posts</h2>
              </div>
              <Link to={`${base}/blogs`} className="flex items-center gap-1 text-xs text-primary font-medium hover:underline">
                View all <ArrowRight className="h-3 w-3" />
              </Link>
            </div>

            {recentPosts.length === 0 ? (
              <div className="flex flex-col items-center gap-3 py-16 text-center px-8">
                <FileText className="h-8 w-8 text-muted-foreground/30" />
                <p className="text-sm font-medium">No posts yet</p>
                <p className="text-xs text-muted-foreground">Create your first post to get started.</p>
                <Link
                  to="/admin/blogs/new"
                  className="mt-1 flex items-center gap-1.5 rounded-lg bg-primary px-3 py-1.5 text-xs font-semibold text-white hover:bg-primary/90 transition-colors"
                >
                  <Plus className="h-3 w-3" /> Write first post
                </Link>
              </div>
            ) : (
              <div className="divide-y divide-border">
                {recentPosts.map((post) => (
                  <div key={post.id} className="flex items-center gap-3 px-5 py-3 hover:bg-muted/30 transition-colors">
                    <Link
                      to="/admin/blogs/$id"
                      params={{ id: post.id }}
                      className="min-w-0 flex-1 truncate text-sm font-medium hover:text-primary transition-colors"
                    >
                      {post.title || "Untitled"}
                    </Link>
                    <StatusBadge status={post.status} />
                    <span className="shrink-0 text-xs text-muted-foreground hidden sm:block">
                      {fmtDate(post.updated_at)}
                    </span>
                    <span className="shrink-0 text-xs tabular-nums text-muted-foreground hidden md:flex items-center gap-1">
                      <Eye className="h-3 w-3" /> {post.views.toLocaleString()}
                    </span>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Quick Actions */}
          <div>
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
                      "flex h-8 w-8 shrink-0 items-center justify-center rounded-lg transition-transform group-hover:scale-110",
                      a.primary ? "bg-primary text-white" : "bg-muted text-muted-foreground",
                    )}>
                      <a.icon className="h-3.5 w-3.5" />
                    </span>
                    <div className="min-w-0">
                      <p className={cn("text-sm font-semibold leading-tight", a.primary && "text-primary")}>{a.label}</p>
                      <p className="text-xs text-muted-foreground truncate">{a.desc}</p>
                    </div>
                  </div>
                </Link>
              ))}
            </div>
          </div>
        </div>

        {/* Right: Activity */}
        <div>
          <div className="rounded-xl border border-border bg-white shadow-sm">
            <div className="flex items-center gap-2 border-b border-border px-5 py-4">
              <Activity className="h-4 w-4 text-muted-foreground" />
              <h2 className="text-sm font-semibold">Activity</h2>
            </div>

            {recentActivity.length === 0 ? (
              <p className="px-5 py-8 text-center text-sm text-muted-foreground">No activity yet.</p>
            ) : (
              <div className="divide-y divide-border">
                {recentActivity.map((entry) => (
                  <div key={entry.id} className="flex items-start gap-3 px-5 py-3">
                    <div className="mt-1 flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-muted">
                      <Activity className="h-3 w-3 text-muted-foreground" />
                    </div>
                    <div className="min-w-0 flex-1">
                      <p className="text-xs leading-snug text-foreground">
                        <span className="font-medium">{entry.actor_name}</span>{" "}
                        <span className="text-muted-foreground">{fmtAction(entry.action)}</span>
                        {entry.entity_label && (
                          <> — <span className="font-medium">{entry.entity_label}</span></>
                        )}
                      </p>
                      <p className="mt-0.5 flex items-center gap-1 text-[10px] text-muted-foreground/60">
                        <Clock className="h-2.5 w-2.5" />
                        {fmtRelative(entry.occurred_at)}
                      </p>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
