import { createFileRoute } from "@tanstack/react-router";
import { createServerFn } from "@tanstack/react-start";
import { queryOptions, useSuspenseQuery } from "@tanstack/react-query";
import { TrendingUp, Eye, Activity, HardDrive } from "lucide-react";

interface AnalyticsData {
  totalViews: number;
  apiRequests: number;
  storageBytes: number;
  topPosts: Array<{ id: string; title: string; views: number; slug: string }>;
  daily: Array<{ date: string; views: number; requests: number }>;
}

const getAnalytics = createServerFn({ method: "GET" })
  .validator((input: { workspaceId: string }) => input)
  .handler(async ({ data }): Promise<AnalyticsData> => {
    const { getAdminClient } = await import("../../lib/supabase.server");
    const db = getAdminClient() as any;

    const [viewsRes, apiRes, storageRes, topPostsRes, dailyRes] = await Promise.all([
      db.from("blog_posts").select("views").eq("status", "published"),
      db.from("api_request_logs")
        .select("id", { count: "exact", head: true })
        .eq("workspace_id", data.workspaceId),
      db.from("storage_usage")
        .select("total_bytes")
        .eq("workspace_id", data.workspaceId)
        .order("recorded_at", { ascending: false })
        .limit(1)
        .maybeSingle(),
      db.from("blog_posts")
        .select("id,title,views,slug")
        .eq("status", "published")
        .order("views", { ascending: false })
        .limit(10),
      db.from("analytics_daily")
        .select("date,page_views,api_calls")
        .eq("workspace_id", data.workspaceId)
        .order("date", { ascending: false })
        .limit(14),
    ]);

    const totalViews = (viewsRes.data ?? []).reduce((s: number, p: any) => s + (p.views ?? 0), 0);

    return {
      totalViews,
      apiRequests: apiRes.count ?? 0,
      storageBytes: storageRes.data?.total_bytes ?? 0,
      topPosts: topPostsRes.data ?? [],
      daily: (dailyRes.data ?? []).reverse().map((d: any) => ({
        date: d.date,
        views: d.page_views ?? 0,
        requests: d.api_calls ?? 0,
      })),
    };
  });

const analyticsQuery = (id: string) =>
  queryOptions({ queryKey: ["workspace-analytics", id], queryFn: () => getAnalytics({ data: { workspaceId: id } }) });

export const Route = createFileRoute("/admin/workspaces/$id/analytics")({
  loader: ({ context, params }) => context.queryClient.ensureQueryData(analyticsQuery(params.id)),
  component: WorkspaceAnalytics,
  errorComponent: ({ error }) => <p className="p-8 text-sm text-red-600">{error.message}</p>,
});

function fmtBytes(b: number) {
  if (b < 1024) return `${b} B`;
  if (b < 1024 ** 2) return `${(b / 1024).toFixed(1)} KB`;
  if (b < 1024 ** 3) return `${(b / 1024 ** 2).toFixed(1)} MB`;
  return `${(b / 1024 ** 3).toFixed(2)} GB`;
}

function fmtDate(d: string) {
  return new Date(d).toLocaleDateString("en-US", { month: "short", day: "numeric" });
}

function SparkBar({ value, max }: { value: number; max: number }) {
  const pct = max > 0 ? Math.round((value / max) * 100) : 0;
  return (
    <div className="flex items-center gap-2">
      <div className="h-1 flex-1 overflow-hidden rounded-full bg-border">
        <div className="h-full rounded-full bg-primary" style={{ width: `${pct}%` }} />
      </div>
      <span className="w-8 text-right text-xs tabular-nums text-muted-foreground">{value.toLocaleString()}</span>
    </div>
  );
}

function WorkspaceAnalytics() {
  const { id } = Route.useParams();
  const { data } = useSuspenseQuery(analyticsQuery(id));

  const maxViews = Math.max(...data.daily.map((d) => d.views), 1);
  const maxTopViews = Math.max(...data.topPosts.map((p) => p.views), 1);

  return (
    <div className="min-h-full px-8 py-8">
      <div className="mb-8">
        <h1 className="text-xl font-semibold">Analytics</h1>
        <p className="mt-0.5 text-sm text-muted-foreground">Content performance and API usage overview.</p>
      </div>

      {/* Summary stats */}
      <div className="mb-10 flex divide-x divide-border border-y border-border">
        {[
          { label: "Total Views", value: data.totalViews.toLocaleString(), icon: Eye },
          { label: "API Requests", value: data.apiRequests.toLocaleString(), icon: Activity },
          { label: "Storage Used", value: fmtBytes(data.storageBytes), icon: HardDrive },
        ].map(({ label, value, icon: Icon }) => (
          <div key={label} className="flex-1 px-6 py-5">
            <div className="flex items-center gap-2 mb-1">
              <Icon className="h-3.5 w-3.5 text-muted-foreground" />
              <p className="text-[11px] uppercase tracking-wide text-muted-foreground">{label}</p>
            </div>
            <p className="text-2xl font-bold tabular-nums">{value}</p>
          </div>
        ))}
      </div>

      <div className="grid gap-12 lg:grid-cols-2">
        {/* Daily chart */}
        <section>
          <div className="mb-4 border-b border-border pb-3">
            <h2 className="text-[11px] font-semibold uppercase tracking-widest text-muted-foreground">
              Views — Last 14 Days
            </h2>
          </div>
          {data.daily.length === 0 ? (
            <p className="py-6 text-sm text-muted-foreground">No data yet.</p>
          ) : (
            <div className="flex items-end gap-1 h-20">
              {data.daily.map((d) => {
                const pct = maxViews > 0 ? (d.views / maxViews) * 100 : 0;
                return (
                  <div key={d.date} className="group relative flex-1 flex flex-col items-center justify-end h-full">
                    <div
                      className="w-full rounded-sm bg-primary/20 group-hover:bg-primary transition-colors"
                      style={{ height: `${Math.max(pct, 2)}%` }}
                    />
                    <span className="mt-1 text-[9px] text-muted-foreground/60 hidden group-hover:block absolute -bottom-4 text-center whitespace-nowrap">
                      {fmtDate(d.date)}: {d.views}
                    </span>
                  </div>
                );
              })}
            </div>
          )}
        </section>

        {/* Top posts */}
        <section>
          <div className="mb-0 border-b border-border pb-3">
            <h2 className="text-[11px] font-semibold uppercase tracking-widest text-muted-foreground">
              Top Posts by Views
            </h2>
          </div>
          {data.topPosts.length === 0 ? (
            <p className="py-6 text-sm text-muted-foreground">No published posts yet.</p>
          ) : (
            <div>
              {data.topPosts.map((post) => (
                <div key={post.id} className="border-b border-border py-3 last:border-0">
                  <p className="mb-1.5 truncate text-sm font-medium">{post.title || "Untitled"}</p>
                  <SparkBar value={post.views} max={maxTopViews} />
                </div>
              ))}
            </div>
          )}
        </section>
      </div>
    </div>
  );
}
