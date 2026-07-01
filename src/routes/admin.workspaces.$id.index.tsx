import { createFileRoute, Link } from "@tanstack/react-router";
import { createServerFn } from "@tanstack/react-start";
import { queryOptions, useSuspenseQuery } from "@tanstack/react-query";
import { FileText, Layers, ImageIcon, Sparkles, Key, Clock, Activity, Plus } from "lucide-react";
import { cn } from "@/lib/utils";

// ── Types ─────────────────────────────────────────────────────────────────────
interface RecentPost { id: string; title: string; status: string; updated_at: string; views: number; slug: string; }
interface ActivityEntry { id: string; actor_name: string; action: string; entity_label: string | null; occurred_at: string; }
interface Overview {
  stats: {
    postsTotal: number; postsPublished: number; postsDraft: number; postsScheduled: number;
    collections: number; mediaFiles: number; aiGenerations: number;
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
      db.from("blog_posts").select("id,title,status,updated_at,views,slug").order("updated_at", { ascending: false }).limit(6),
      db.from("activity_log").select("id,actor_name,action,entity_label,occurred_at").order("occurred_at", { ascending: false }).limit(8),
    ]);

    const pub = pubRes.count ?? 0;
    const draft = draftRes.count ?? 0;
    const sched = schedRes.count ?? 0;

    return {
      stats: {
        postsTotal: pub + draft + sched,
        postsPublished: pub,
        postsDraft: draft,
        postsScheduled: sched,
        collections: collRes.count ?? 0,
        mediaFiles: mediaRes.count ?? 0,
        aiGenerations: aiRes.count ?? 0,
      },
      recentPosts: postsRes.data ?? [],
      recentActivity: actRes.data ?? [],
    };
  });

// ── Route ─────────────────────────────────────────────────────────────────────
const overviewQuery = (id: string) =>
  queryOptions({ queryKey: ["workspace-overview", id], queryFn: () => getOverview({ data: { id } }) });

export const Route = createFileRoute("/admin/workspaces/$id/")({
  loader: ({ context, params }) => context.queryClient.ensureQueryData(overviewQuery(params.id)),
  component: WorkspaceOverview,
  errorComponent: ({ error }) => <p className="p-8 text-sm text-red-600">{error.message}</p>,
});

// ── Helpers ───────────────────────────────────────────────────────────────────
function fmtDate(d: string) {
  return new Date(d).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" });
}

function fmtAction(action: string) {
  return action.replace(/[._]/g, " ").replace(/\b\w/g, (c) => c.toUpperCase());
}

const STATUS_COLORS: Record<string, string> = {
  published: "text-emerald-600",
  draft: "text-muted-foreground",
  scheduled: "text-amber-600",
};

// ── Page ──────────────────────────────────────────────────────────────────────
function WorkspaceOverview() {
  const { id } = Route.useParams();
  const { data } = useSuspenseQuery(overviewQuery(id));
  const { stats, recentPosts, recentActivity } = data;

  const base = `/admin/workspaces/${id}`;
  const total = Math.max(stats.postsTotal, 1);
  const pubPct = Math.round((stats.postsPublished / total) * 100);
  const draftPct = Math.round((stats.postsDraft / total) * 100);
  const schedPct = Math.round((stats.postsScheduled / total) * 100);

  return (
    <div className="min-h-full px-8 py-8">
      {/* Page title */}
      <div className="mb-8">
        <h1 className="text-xl font-semibold">Overview</h1>
        <p className="mt-0.5 text-sm text-muted-foreground">Content and activity summary for this workspace.</p>
      </div>

      {/* ── Stats row ── */}
      <div className="mb-10 flex divide-x divide-border border-y border-border">
        {[
          { label: "Total Posts", value: stats.postsTotal },
          { label: "Published", value: stats.postsPublished, green: true },
          { label: "Drafts", value: stats.postsDraft },
          { label: "Scheduled", value: stats.postsScheduled, amber: true },
          { label: "Collections", value: stats.collections },
          { label: "Media Files", value: stats.mediaFiles },
          { label: "AI Generations", value: stats.aiGenerations },
        ].map(({ label, value, green, amber }) => (
          <div key={label} className="flex-1 px-5 py-5">
            <p className={cn(
              "text-2xl font-bold tabular-nums",
              green && "text-emerald-600",
              amber && "text-amber-600",
            )}>
              {value.toLocaleString()}
            </p>
            <p className="mt-0.5 text-[11px] uppercase tracking-wide text-muted-foreground">{label}</p>
          </div>
        ))}
      </div>

      <div className="grid gap-12 lg:grid-cols-[1fr_280px]">
        <div className="space-y-10">
          {/* ── Content status ── */}
          <section>
            <div className="mb-4 flex items-center justify-between border-b border-border pb-3">
              <h2 className="text-[11px] font-semibold uppercase tracking-widest text-muted-foreground">Content Status</h2>
            </div>
            {stats.postsTotal > 0 ? (
              <div className="space-y-2.5">
                {[
                  { label: "Published", pct: pubPct, count: stats.postsPublished, color: "bg-emerald-500" },
                  { label: "Draft", pct: draftPct, count: stats.postsDraft, color: "bg-zinc-300" },
                  { label: "Scheduled", pct: schedPct, count: stats.postsScheduled, color: "bg-amber-400" },
                ].map(({ label, pct, count, color }) => (
                  <div key={label} className="flex items-center gap-3">
                    <span className="w-20 text-right text-xs text-muted-foreground shrink-0">{label}</span>
                    <div className="h-1.5 flex-1 overflow-hidden rounded-full bg-border">
                      <div className={cn("h-full rounded-full", color)} style={{ width: `${pct}%` }} />
                    </div>
                    <span className="w-6 text-xs tabular-nums text-muted-foreground shrink-0">{count}</span>
                  </div>
                ))}
              </div>
            ) : (
              <p className="text-sm text-muted-foreground">No posts yet.</p>
            )}
          </section>

          {/* ── Recent posts ── */}
          <section>
            <div className="mb-0 flex items-center justify-between border-b border-border pb-3">
              <h2 className="text-[11px] font-semibold uppercase tracking-widest text-muted-foreground">Recent Posts</h2>
              <Link to={`${base}/blogs`} className="text-xs text-primary hover:underline">View all →</Link>
            </div>
            {recentPosts.length === 0 ? (
              <div className="flex flex-col items-center gap-3 py-12">
                <FileText className="h-8 w-8 text-muted-foreground/30" />
                <p className="text-sm text-muted-foreground">No posts yet.</p>
                <Link
                  to="/admin/blogs/new"
                  className="flex items-center gap-1.5 text-sm font-medium text-primary hover:underline"
                >
                  <Plus className="h-3.5 w-3.5" /> Write first post
                </Link>
              </div>
            ) : (
              <div>
                {recentPosts.map((post) => (
                  <div key={post.id} className="flex items-center gap-3 border-b border-border py-3 last:border-0">
                    <Link
                      to="/admin/blogs/$id"
                      params={{ id: post.id }}
                      className="min-w-0 flex-1 truncate text-sm font-medium hover:text-primary transition-colors"
                    >
                      {post.title || "Untitled"}
                    </Link>
                    <span className={cn("shrink-0 text-xs", STATUS_COLORS[post.status])}>
                      {post.status}
                    </span>
                    <span className="shrink-0 text-xs text-muted-foreground">{fmtDate(post.updated_at)}</span>
                    <span className="shrink-0 text-xs tabular-nums text-muted-foreground">
                      {post.views.toLocaleString()} views
                    </span>
                  </div>
                ))}
              </div>
            )}
          </section>
        </div>

        {/* Right column */}
        <div className="space-y-10">
          {/* ── Quick actions ── */}
          <section>
            <div className="mb-0 flex items-center border-b border-border pb-3">
              <h2 className="text-[11px] font-semibold uppercase tracking-widest text-muted-foreground">Quick Actions</h2>
            </div>
            {[
              { label: "New Blog Post", desc: "Write and publish content", to: "/admin/blogs/new", icon: FileText },
              { label: "New Collection", desc: "Define a content type", to: `${base}/collections`, icon: Layers },
              { label: "Upload Media", desc: "Add images and files", to: `${base}/media`, icon: ImageIcon },
              { label: "AI Assistant", desc: "Generate content with AI", to: `${base}/ai-assistant`, icon: Sparkles },
              { label: "API Keys", desc: "Manage access tokens", to: `${base}/api-keys`, icon: Key },
            ].map((a) => (
              <Link
                key={a.to}
                to={a.to}
                className="flex items-center gap-3 border-b border-border py-3 last:border-0 hover:bg-muted/30 -mx-2 px-2 rounded transition-colors"
              >
                <a.icon className="h-4 w-4 shrink-0 text-muted-foreground" />
                <div className="min-w-0 flex-1">
                  <p className="text-sm font-medium">{a.label}</p>
                  <p className="text-xs text-muted-foreground">{a.desc}</p>
                </div>
              </Link>
            ))}
          </section>

          {/* ── Recent activity ── */}
          <section>
            <div className="mb-0 flex items-center border-b border-border pb-3">
              <h2 className="text-[11px] font-semibold uppercase tracking-widest text-muted-foreground">Activity</h2>
            </div>
            {recentActivity.length === 0 ? (
              <p className="py-6 text-sm text-muted-foreground">No activity yet.</p>
            ) : (
              <div>
                {recentActivity.map((entry) => (
                  <div key={entry.id} className="flex items-start gap-2.5 border-b border-border py-3 last:border-0">
                    <Activity className="mt-0.5 h-3.5 w-3.5 shrink-0 text-muted-foreground/60" />
                    <div className="min-w-0 flex-1">
                      <p className="text-xs text-foreground">
                        <span className="font-medium">{entry.actor_name}</span>{" "}
                        <span className="text-muted-foreground">{fmtAction(entry.action)}</span>
                        {entry.entity_label && (
                          <> — <span className="font-medium">{entry.entity_label}</span></>
                        )}
                      </p>
                      <p className="mt-0.5 text-[10px] text-muted-foreground/60">
                        <Clock className="inline h-2.5 w-2.5 mr-0.5" />
                        {fmtDate(entry.occurred_at)}
                      </p>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </section>
        </div>
      </div>
    </div>
  );
}
