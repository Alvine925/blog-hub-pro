import { createFileRoute } from "@tanstack/react-router";
import { queryOptions, useSuspenseQuery } from "@tanstack/react-query";
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  Tooltip,
  ResponsiveContainer,
  Cell,
  PieChart,
  Pie,
  Legend,
} from "recharts";
import { getDashboardStats } from "@/lib/apikey.functions";
import { adminListPosts } from "@/lib/blog.functions";

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
  published: "#ef4444",
  draft: "#94a3b8",
  scheduled: "#f59e0b",
};

const CHART_COLORS = [
  "#ef4444", "#f97316", "#eab308", "#22c55e",
  "#06b6d4", "#8b5cf6", "#ec4899", "#14b8a6",
];

function AnalyticsPage() {
  const { data: stats } = useSuspenseQuery(statsQuery);
  const { data: allPosts } = useSuspenseQuery(postsQuery);

  const totalViews = allPosts.reduce((acc, p) => acc + (p.views ?? 0), 0);
  const avgViews = allPosts.length > 0 ? Math.round(totalViews / allPosts.length) : 0;

  const topPostsData = [...allPosts]
    .filter((p) => p.status === "published")
    .sort((a, b) => (b.views ?? 0) - (a.views ?? 0))
    .slice(0, 10)
    .map((p) => ({
      name: p.title.length > 30 ? p.title.slice(0, 28) + "…" : p.title,
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

  return (
    <div className="space-y-12">
      <div>
        <h1 className="text-2xl font-bold">Analytics</h1>
        <p className="text-sm text-muted-foreground">Content performance overview</p>
      </div>

      {/* Summary stats */}
      <div className="grid grid-cols-2 gap-x-12 gap-y-8 sm:grid-cols-4">
        {[
          { label: "Total Posts", value: stats.total },
          { label: "Published", value: stats.published },
          { label: "Total Views", value: totalViews.toLocaleString() },
          { label: "Avg Views / Post", value: avgViews.toLocaleString() },
        ].map((s) => (
          <div key={s.label}>
            <p className="text-3xl font-bold tabular-nums">{s.value}</p>
            <p className="mt-1 text-sm text-muted-foreground">{s.label}</p>
          </div>
        ))}
      </div>

      <div className="border-t border-border" />

      {/* Top posts by views */}
      <div className="space-y-4">
        <h2 className="text-sm font-semibold uppercase tracking-wide text-muted-foreground">
          Top Posts by Views
        </h2>
        {topPostsData.length === 0 ? (
          <p className="text-sm text-muted-foreground">No published posts with views yet.</p>
        ) : (
          <ResponsiveContainer width="100%" height={280}>
            <BarChart data={topPostsData} layout="vertical" margin={{ left: 8, right: 24 }}>
              <XAxis type="number" tick={{ fontSize: 12 }} />
              <YAxis
                type="category"
                dataKey="name"
                width={180}
                tick={{ fontSize: 12 }}
              />
              <Tooltip
                contentStyle={{ fontSize: 12 }}
                formatter={(v: number) => [`${v} views`, "Views"]}
              />
              <Bar dataKey="views" radius={[0, 4, 4, 0]}>
                {topPostsData.map((_, i) => (
                  <Cell key={i} fill={i === 0 ? "#ef4444" : "#fca5a5"} />
                ))}
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        )}
      </div>

      <div className="border-t border-border" />

      <div className="grid gap-12 lg:grid-cols-2">
        {/* Posts by category */}
        <div className="space-y-4">
          <h2 className="text-sm font-semibold uppercase tracking-wide text-muted-foreground">
            Posts by Category
          </h2>
          {categoryData.length === 0 ? (
            <p className="text-sm text-muted-foreground">No posts yet.</p>
          ) : (
            <ResponsiveContainer width="100%" height={220}>
              <BarChart data={categoryData} margin={{ left: 0, right: 16 }}>
                <XAxis dataKey="name" tick={{ fontSize: 12 }} />
                <YAxis tick={{ fontSize: 12 }} allowDecimals={false} />
                <Tooltip contentStyle={{ fontSize: 12 }} />
                <Bar dataKey="count" radius={[4, 4, 0, 0]}>
                  {categoryData.map((_, i) => (
                    <Cell key={i} fill={CHART_COLORS[i % CHART_COLORS.length]} />
                  ))}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          )}
        </div>

        {/* Posts by status */}
        <div className="space-y-4">
          <h2 className="text-sm font-semibold uppercase tracking-wide text-muted-foreground">
            Posts by Status
          </h2>
          {statusData.length === 0 ? (
            <p className="text-sm text-muted-foreground">No posts yet.</p>
          ) : (
            <ResponsiveContainer width="100%" height={220}>
              <PieChart>
                <Pie
                  data={statusData}
                  dataKey="value"
                  nameKey="name"
                  cx="50%"
                  cy="50%"
                  outerRadius={80}
                  label={({ name, value }) => `${name}: ${value}`}
                  labelLine={false}
                >
                  {statusData.map((entry) => (
                    <Cell
                      key={entry.name}
                      fill={STATUS_COLORS[entry.name.toLowerCase()] ?? "#94a3b8"}
                    />
                  ))}
                </Pie>
                <Legend />
                <Tooltip contentStyle={{ fontSize: 12 }} />
              </PieChart>
            </ResponsiveContainer>
          )}
        </div>
      </div>

      <div className="border-t border-border" />

      {/* Full post table */}
      <div className="space-y-4">
        <h2 className="text-sm font-semibold uppercase tracking-wide text-muted-foreground">
          All Posts Performance
        </h2>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-border text-left text-xs font-medium text-muted-foreground">
                <th className="pb-2 pr-6">Title</th>
                <th className="pb-2 pr-6">Status</th>
                <th className="pb-2 pr-6">Category</th>
                <th className="pb-2 text-right">Views</th>
              </tr>
            </thead>
            <tbody>
              {[...allPosts]
                .sort((a, b) => (b.views ?? 0) - (a.views ?? 0))
                .map((p) => (
                  <tr
                    key={p.id}
                    className="border-b border-border/50 last:border-0"
                  >
                    <td className="py-2 pr-6 font-medium">{p.title || "Untitled"}</td>
                    <td className="py-2 pr-6">
                      <span
                        className={`inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium ${
                          p.status === "published"
                            ? "bg-red-50 text-red-700"
                            : p.status === "scheduled"
                              ? "bg-amber-50 text-amber-700"
                              : "bg-slate-100 text-slate-600"
                        }`}
                      >
                        {p.status}
                      </span>
                    </td>
                    <td className="py-2 pr-6 text-muted-foreground">{p.category}</td>
                    <td className="py-2 text-right tabular-nums">{(p.views ?? 0).toLocaleString()}</td>
                  </tr>
                ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
