import { createFileRoute } from "@tanstack/react-router";
import { queryOptions, useSuspenseQuery } from "@tanstack/react-query";
import {
  BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer,
  Cell, PieChart, Pie, Legend, LineChart, Line, CartesianGrid,
} from "recharts";
import { TrendingUp, Eye, FileText, BarChart2, Users } from "lucide-react";
import { getDashboardStats } from "@/lib/apikey.functions";
import { adminListPosts } from "@/lib/blog.functions";
import { cn } from "@/lib/utils";

const statsQuery = queryOptions({
  queryKey: ["admin", "analytics", "stats"],
  queryFn: () => getDashboardStats(),
});

const postsQuery = queryOptions({
  queryKey: ["admin", "analytics", "posts"],
  queryFn: () => adminListPosts(),
});

export const Route = createFileRoute("/admin/analytics")({
  head: () => ({ meta: [{ title: "Analytics — Admin" }] }),
  loader: async ({ context }) => {
    await Promise.all([
      context.queryClient.ensureQueryData(statsQuery),
      context.queryClient.ensureQueryData(postsQuery),
    ]);
  },
  component: AnalyticsPage,
  errorComponent: ({ error }) => (
    <p className="text-sm text-destructive">Failed to load analytics: {error.message}</p>
  ),
});

const STATUS_COLORS: Record<string, string> = {
  published: "#DC2626",
  draft: "#94a3b8",
  scheduled: "#f59e0b",
};

const CHART_COLORS = [
  "#DC2626", "#f97316", "#eab308", "#22c55e",
  "#06b6d4", "#8b5cf6", "#ec4899", "#14b8a6",
];

function MetricCard({
  label, value, icon: Icon, accent, sub,
}: {
  label: string; value: string | number; icon: React.ComponentType<{ className?: string }>; accent?: boolean; sub?: string;
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

// Generate synthetic monthly content growth from posts data
function buildGrowthData(posts: { created_at: string }[]) {
  const counts: Record<string, number> = {};
  for (const p of posts) {
    const month = new Date(p.created_at).toLocaleString("en-US", { month: "short", year: "2-digit" });
    counts[month] = (counts[month] ?? 0) + 1;
  }
  const entries = Object.entries(counts).slice(-6);
  let cumulative = 0;
  return entries.map(([month, count]) => {
    cumulative += count;
    return { month, new: count, total: cumulative };
  });
}

function AnalyticsPage() {
  const { data: stats } = useSuspenseQuery(statsQuery);
  const { data: allPosts } = useSuspenseQuery(postsQuery);

  const totalViews = allPosts.reduce((acc, p) => acc + (p.views ?? 0), 0);
  const avgViews = allPosts.length > 0 ? Math.round(totalViews / allPosts.length) : 0;

  const topPostsData = [...allPosts]
    .filter((p) => p.status === "published")
    .sort((a, b) => (b.views ?? 0) - (a.views ?? 0))
    .slice(0, 8)
    .map((p) => ({
      name: p.title.length > 28 ? p.title.slice(0, 26) + "…" : p.title,
      views: p.views ?? 0,
    }));

  const categoryMap: Record<string, number> = {};
  for (const p of allPosts) {
    categoryMap[p.category] = (categoryMap[p.category] ?? 0) + 1;
  }
  const categoryData = Object.entries(categoryMap)
    .sort((a, b) => b[1] - a[1])
    .map(([name, count]) => ({ name, count }));

  const statusData = [
    { name: "Published", value: stats.published },
    { name: "Draft", value: stats.drafts },
    { name: "Scheduled", value: stats.scheduled },
  ].filter((s) => s.value > 0);

  const growthData = buildGrowthData(allPosts);

  return (
    <div className="space-y-10">
      <div>
        <h1 className="text-2xl font-bold">Analytics</h1>
        <p className="text-sm text-muted-foreground">Content performance and growth overview</p>
      </div>

      {/* Summary cards */}
      <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
        <MetricCard label="Total Posts" value={stats.total} icon={FileText} />
        <MetricCard label="Published" value={stats.published} icon={BarChart2} accent />
        <MetricCard label="Total Views" value={totalViews.toLocaleString()} icon={Eye} accent sub="All time" />
        <MetricCard label="Avg Views / Post" value={avgViews.toLocaleString()} icon={TrendingUp} />
      </div>

      {/* Charts row 1 */}
      <div className="grid gap-6 lg:grid-cols-2">
        {/* Top posts by views */}
        <div className="rounded-xl border border-border bg-background p-6 shadow-sm">
          <h2 className="mb-5 text-sm font-semibold">Top Posts by Views</h2>
          {topPostsData.length === 0 ? (
            <p className="text-sm text-muted-foreground py-8 text-center">No published posts with views yet.</p>
          ) : (
            <ResponsiveContainer width="100%" height={260}>
              <BarChart data={topPostsData} layout="vertical" margin={{ left: 0, right: 20, top: 0, bottom: 0 }}>
                <XAxis type="number" tick={{ fontSize: 11 }} axisLine={false} tickLine={false} />
                <YAxis type="category" dataKey="name" width={160} tick={{ fontSize: 11 }} axisLine={false} tickLine={false} />
                <Tooltip
                  contentStyle={{ fontSize: 12, borderRadius: 8, border: "1px solid hsl(var(--border))" }}
                  formatter={(v: number) => [`${v} views`, ""]}
                  cursor={{ fill: "hsl(var(--muted))" }}
                />
                <Bar dataKey="views" radius={[0, 6, 6, 0]}>
                  {topPostsData.map((_, i) => (
                    <Cell key={i} fill={i === 0 ? "#DC2626" : `rgba(220,38,38,${0.3 + (topPostsData.length - i) * 0.07})`} />
                  ))}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          )}
        </div>

        {/* Posts by status */}
        <div className="rounded-xl border border-border bg-background p-6 shadow-sm">
          <h2 className="mb-5 text-sm font-semibold">Content Status Distribution</h2>
          {statusData.length === 0 ? (
            <p className="text-sm text-muted-foreground py-8 text-center">No posts yet.</p>
          ) : (
            <ResponsiveContainer width="100%" height={260}>
              <PieChart>
                <Pie
                  data={statusData}
                  dataKey="value"
                  nameKey="name"
                  cx="50%"
                  cy="45%"
                  innerRadius={60}
                  outerRadius={90}
                  paddingAngle={3}
                  label={({ name, percent }) => `${name} ${(percent * 100).toFixed(0)}%`}
                  labelLine={false}
                >
                  {statusData.map((entry) => (
                    <Cell key={entry.name} fill={STATUS_COLORS[entry.name.toLowerCase()] ?? "#94a3b8"} />
                  ))}
                </Pie>
                <Legend wrapperStyle={{ fontSize: 12 }} />
                <Tooltip
                  contentStyle={{ fontSize: 12, borderRadius: 8, border: "1px solid hsl(var(--border))" }}
                />
              </PieChart>
            </ResponsiveContainer>
          )}
        </div>
      </div>

      {/* Charts row 2 */}
      <div className="grid gap-6 lg:grid-cols-2">
        {/* Content growth over time */}
        <div className="rounded-xl border border-border bg-background p-6 shadow-sm">
          <h2 className="mb-5 text-sm font-semibold">Content Growth</h2>
          {growthData.length === 0 ? (
            <p className="text-sm text-muted-foreground py-8 text-center">No data yet.</p>
          ) : (
            <ResponsiveContainer width="100%" height={220}>
              <LineChart data={growthData} margin={{ left: 0, right: 16, top: 4, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                <XAxis dataKey="month" tick={{ fontSize: 11 }} axisLine={false} tickLine={false} />
                <YAxis tick={{ fontSize: 11 }} allowDecimals={false} axisLine={false} tickLine={false} />
                <Tooltip
                  contentStyle={{ fontSize: 12, borderRadius: 8, border: "1px solid hsl(var(--border))" }}
                />
                <Line type="monotone" dataKey="total" name="Total posts" stroke="#DC2626" strokeWidth={2} dot={{ r: 4, fill: "#DC2626" }} />
                <Line type="monotone" dataKey="new" name="New this month" stroke="#fca5a5" strokeWidth={2} strokeDasharray="4 4" dot={false} />
              </LineChart>
            </ResponsiveContainer>
          )}
        </div>

        {/* Posts by category */}
        <div className="rounded-xl border border-border bg-background p-6 shadow-sm">
          <h2 className="mb-5 text-sm font-semibold">Posts by Category</h2>
          {categoryData.length === 0 ? (
            <p className="text-sm text-muted-foreground py-8 text-center">No posts yet.</p>
          ) : (
            <ResponsiveContainer width="100%" height={220}>
              <BarChart data={categoryData} margin={{ left: 0, right: 16, top: 4, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" vertical={false} />
                <XAxis dataKey="name" tick={{ fontSize: 11 }} axisLine={false} tickLine={false} />
                <YAxis tick={{ fontSize: 11 }} allowDecimals={false} axisLine={false} tickLine={false} />
                <Tooltip
                  contentStyle={{ fontSize: 12, borderRadius: 8, border: "1px solid hsl(var(--border))" }}
                />
                <Bar dataKey="count" name="Posts" radius={[6, 6, 0, 0]}>
                  {categoryData.map((_, i) => (
                    <Cell key={i} fill={CHART_COLORS[i % CHART_COLORS.length]} />
                  ))}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          )}
        </div>
      </div>

      {/* Full post table */}
      <div className="rounded-xl border border-border bg-background shadow-sm">
        <div className="flex items-center gap-2 border-b border-border px-5 py-4">
          <Users className="h-4 w-4 text-primary" />
          <h2 className="text-sm font-semibold">All Posts Performance</h2>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-border text-left text-xs font-semibold text-muted-foreground">
                <th className="px-5 py-3">Title</th>
                <th className="px-5 py-3">Status</th>
                <th className="px-5 py-3">Category</th>
                <th className="px-5 py-3 text-right">Views</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border/60">
              {[...allPosts]
                .sort((a, b) => (b.views ?? 0) - (a.views ?? 0))
                .map((p) => (
                  <tr key={p.id} className="hover:bg-muted/30 transition-colors">
                    <td className="px-5 py-3 font-medium">{p.title || "Untitled"}</td>
                    <td className="px-5 py-3">
                      <span
                        className={cn(
                          "inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium",
                          p.status === "published" ? "bg-primary/10 text-primary"
                            : p.status === "scheduled" ? "bg-amber-50 text-amber-700"
                            : "bg-muted text-muted-foreground",
                        )}
                      >
                        {p.status}
                      </span>
                    </td>
                    <td className="px-5 py-3 text-muted-foreground">{p.category}</td>
                    <td className="px-5 py-3 text-right tabular-nums font-medium">
                      {(p.views ?? 0).toLocaleString()}
                    </td>
                  </tr>
                ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
