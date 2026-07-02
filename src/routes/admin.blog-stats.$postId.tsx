import { createFileRoute, Link } from "@tanstack/react-router";
import { createServerFn } from "@tanstack/react-start";
import { queryOptions, useSuspenseQuery } from "@tanstack/react-query";
import {
  ArrowLeft, Eye, Clock, BarChart2, Globe, Smartphone, Monitor, Tablet,
  Activity, ExternalLink, Pencil, Tag, User, Calendar, BookOpen, TrendingUp,
} from "lucide-react";
import { cn } from "@/lib/utils";

// ── Types ─────────────────────────────────────────────────────────────────────
interface PostDetails {
  id: string;
  title: string;
  slug: string;
  excerpt: string;
  content: string;
  cover_image: string | null;
  category: string;
  tags: string[];
  author_name: string;
  status: string;
  featured: boolean;
  published_at: string | null;
  reading_time: number;
  views: number;
  created_at: string;
  updated_at: string;
  seo_title: string | null;
  meta_description: string | null;
}

interface PageViewRow {
  id: string;
  referrer: string | null;
  country: string | null;
  device: string | null;
  browser: string | null;
  duration_sec: number | null;
  viewed_at: string;
}

interface ApiRequestRow {
  id: string;
  method: string;
  path: string;
  status_code: number | null;
  duration_ms: number | null;
  ip_address: string | null;
  requested_at: string;
}

interface ActivityRow {
  id: string;
  actor_name: string;
  action: string;
  entity_label: string | null;
  occurred_at: string;
}

interface BlogStatsData {
  post: PostDetails;
  pageViews: {
    total: number;
    byDevice: Record<string, number>;
    byCountry: Array<{ country: string; count: number }>;
    byReferrer: Array<{ referrer: string; count: number }>;
    recent: PageViewRow[];
    avgDuration: number;
  };
  apiRequests: {
    total: number;
    recent: ApiRequestRow[];
    byStatus: Record<string, number>;
  };
  activity: ActivityRow[];
}

// ── Server fn ─────────────────────────────────────────────────────────────────
const getBlogStats = createServerFn({ method: "GET" })
  .validator((input: { postId: string }) => input)
  .handler(async ({ data }): Promise<BlogStatsData> => {
    const { getAdminClient } = await import("../lib/supabase.server");
    const db = getAdminClient() as any;

    // Fetch post
    const { data: post, error: postError } = await db
      .from("blog_posts")
      .select("*")
      .eq("id", data.postId)
      .single();
    if (postError || !post) throw new Error("Post not found");

    // Fetch page views, API requests, and activity in parallel
    const [pvRes, apiRes, actRes] = await Promise.all([
      db.from("page_views")
        .select("id,referrer,country,device,browser,duration_sec,viewed_at")
        .eq("post_id", data.postId)
        .order("viewed_at", { ascending: false })
        .limit(200),
      db.from("api_request_logs")
        .select("id,method,path,status_code,duration_ms,ip_address,requested_at")
        .ilike("path", `%${post.slug}%`)
        .order("requested_at", { ascending: false })
        .limit(50),
      db.from("activity_log")
        .select("id,actor_name,action,entity_label,occurred_at")
        .eq("entity_id", data.postId)
        .order("occurred_at", { ascending: false })
        .limit(20),
    ]);

    const views: PageViewRow[] = pvRes.data ?? [];
    const apiRows: ApiRequestRow[] = apiRes.data ?? [];
    const actRows: ActivityRow[] = actRes.data ?? [];

    // Aggregate page views
    const deviceCount: Record<string, number> = {};
    const countryCount: Record<string, number> = {};
    const referrerCount: Record<string, number> = {};
    let totalDuration = 0, durationCount = 0;

    for (const v of views) {
      const d = v.device ?? "unknown";
      deviceCount[d] = (deviceCount[d] ?? 0) + 1;
      if (v.country) {
        countryCount[v.country] = (countryCount[v.country] ?? 0) + 1;
      }
      let ref = "Direct";
      if (v.referrer) {
        try { ref = new URL(v.referrer).hostname; } catch { ref = v.referrer.slice(0, 40); }
      }
      referrerCount[ref] = (referrerCount[ref] ?? 0) + 1;
      if (v.duration_sec) { totalDuration += v.duration_sec; durationCount++; }
    }

    const byCountry = Object.entries(countryCount)
      .map(([country, count]) => ({ country, count }))
      .sort((a, b) => b.count - a.count)
      .slice(0, 8);

    const byReferrer = Object.entries(referrerCount)
      .map(([referrer, count]) => ({ referrer, count }))
      .sort((a, b) => b.count - a.count)
      .slice(0, 8);

    // API by status
    const byStatus: Record<string, number> = {};
    for (const r of apiRows) {
      const s = String(r.status_code ?? "unknown");
      byStatus[s] = (byStatus[s] ?? 0) + 1;
    }

    return {
      post: {
        ...post,
        tags: Array.isArray(post.tags) ? post.tags : [],
      } as PostDetails,
      pageViews: {
        total: views.length,
        byDevice: deviceCount,
        byCountry,
        byReferrer,
        recent: views.slice(0, 20),
        avgDuration: durationCount > 0 ? Math.round(totalDuration / durationCount) : 0,
      },
      apiRequests: {
        total: apiRows.length,
        recent: apiRows.slice(0, 20),
        byStatus,
      },
      activity: actRows,
    };
  });

// ── Query + Route ──────────────────────────────────────────────────────────────
const statsQuery = (postId: string) =>
  queryOptions({
    queryKey: ["blog-stats", postId],
    queryFn: () => getBlogStats({ data: { postId } }),
  });

export const Route = createFileRoute("/admin/blog-stats/$postId")({
  loader: ({ context, params }) =>
    context.queryClient.ensureQueryData(statsQuery(params.postId)),
  component: BlogStatsPage,
  errorComponent: ({ error }) => (
    <div className="px-8 py-8">
      <p className="text-sm text-red-600">{error.message}</p>
      <Link to="/admin/dashboard" className="mt-4 block text-sm text-primary hover:underline">
        ← Back to dashboard
      </Link>
    </div>
  ),
});

// ── Helpers ───────────────────────────────────────────────────────────────────
function fmtDate(d: string) {
  return new Date(d).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" });
}
function fmtDateTime(d: string) {
  return new Date(d).toLocaleString("en-US", { month: "short", day: "numeric", hour: "2-digit", minute: "2-digit" });
}
function fmtDuration(sec: number) {
  if (sec < 60) return `${sec}s`;
  return `${Math.floor(sec / 60)}m ${sec % 60}s`;
}

const DEVICE_ICONS: Record<string, React.ReactNode> = {
  desktop: <Monitor className="h-3.5 w-3.5" />,
  mobile:  <Smartphone className="h-3.5 w-3.5" />,
  tablet:  <Tablet className="h-3.5 w-3.5" />,
};

const STATUS_STYLE: Record<string, string> = {
  published: "text-emerald-600",
  draft: "text-muted-foreground",
  scheduled: "text-amber-600",
};

// ── Page ──────────────────────────────────────────────────────────────────────
function BlogStatsPage() {
  const { postId } = Route.useParams();
  const { data } = useSuspenseQuery(statsQuery(postId));
  const { post, pageViews, apiRequests, activity } = data;

  const totalPageViews = pageViews.total;
  const maxDevice = Math.max(...Object.values(pageViews.byDevice), 1);
  const maxCountry = Math.max(...pageViews.byCountry.map((c) => c.count), 1);
  const maxReferrer = Math.max(...pageViews.byReferrer.map((r) => r.count), 1);

  return (
    <div className="min-h-full px-8 py-8">
      {/* Back + Edit */}
      <div className="mb-6 flex items-center justify-between">
        <Link
          to="/admin/blogs"
          className="flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground transition-colors"
        >
          <ArrowLeft className="h-3.5 w-3.5" /> All Posts
        </Link>
        <div className="flex items-center gap-2">
          {post.status === "published" && (
            <Link
              to="/blogs/$slug"
              params={{ slug: post.slug }}
              target="_blank"
              className="flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground transition-colors"
            >
              <ExternalLink className="h-3.5 w-3.5" /> View live
            </Link>
          )}
          <Link
            to="/admin/blogs/$id"
            params={{ id: post.id }}
            className="flex items-center gap-1.5 rounded-md bg-primary px-3 py-1.5 text-sm font-medium text-primary-foreground hover:bg-primary/90 transition-colors"
          >
            <Pencil className="h-3.5 w-3.5" /> Edit post
          </Link>
        </div>
      </div>

      {/* Post header */}
      <div className="mb-8 border-b border-border pb-8">
        <div className="flex items-start gap-5">
          {post.cover_image && (
            <img
              src={post.cover_image}
              alt={post.title}
              className="h-20 w-32 shrink-0 object-cover border border-border"
            />
          )}
          <div className="min-w-0 flex-1">
            <div className="flex items-center gap-2 mb-1">
              <span className={cn("text-xs font-medium", STATUS_STYLE[post.status])}>
                {post.status}
              </span>
              {post.featured && (
                <span className="text-[10px] bg-amber-50 text-amber-700 font-medium px-1.5 py-0.5 rounded">
                  Featured
                </span>
              )}
            </div>
            <h1 className="text-2xl font-semibold leading-tight">{post.title || "Untitled"}</h1>
            {post.excerpt && (
              <p className="mt-1.5 text-sm text-muted-foreground line-clamp-2">{post.excerpt}</p>
            )}
            <div className="mt-3 flex flex-wrap gap-4 text-xs text-muted-foreground">
              <span className="flex items-center gap-1">
                <User className="h-3 w-3" /> {post.author_name}
              </span>
              <span className="flex items-center gap-1">
                <Tag className="h-3 w-3" /> {post.category}
              </span>
              <span className="flex items-center gap-1">
                <BookOpen className="h-3 w-3" /> {post.reading_time} min read
              </span>
              {post.published_at && (
                <span className="flex items-center gap-1">
                  <Calendar className="h-3 w-3" /> Published {fmtDate(post.published_at)}
                </span>
              )}
              <span className="flex items-center gap-1">
                <Clock className="h-3 w-3" /> Updated {fmtDate(post.updated_at)}
              </span>
            </div>
            {post.tags.length > 0 && (
              <div className="mt-2 flex flex-wrap gap-1.5">
                {post.tags.map((tag) => (
                  <span key={tag} className="text-[10px] bg-muted px-2 py-0.5 rounded-full text-muted-foreground">
                    {tag}
                  </span>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Stats bar */}
      <div className="mb-10 flex divide-x divide-border border-y border-border">
        {[
          { label: "Total Views", value: post.views.toLocaleString(), icon: Eye },
          { label: "Tracked Page Views", value: totalPageViews.toLocaleString(), icon: TrendingUp },
          { label: "Avg. Read Time", value: pageViews.avgDuration > 0 ? fmtDuration(pageViews.avgDuration) : "—", icon: Clock },
          { label: "API Requests", value: apiRequests.total.toLocaleString(), icon: Activity },
          { label: "Slug", value: `/${post.slug}`, icon: Globe, isSlug: true },
        ].map(({ label, value, icon: Icon, isSlug }) => (
          <div key={label} className="flex-1 px-5 py-5 min-w-0">
            <div className="flex items-center gap-1.5 mb-1">
              <Icon className="h-3.5 w-3.5 text-muted-foreground shrink-0" />
              <p className="text-[10px] uppercase tracking-wide text-muted-foreground">{label}</p>
            </div>
            {isSlug ? (
              <p className="text-sm font-mono text-foreground break-all leading-snug mt-1">{value}</p>
            ) : (
              <p className="text-2xl font-bold tabular-nums">{value}</p>
            )}
          </div>
        ))}
      </div>

      <div className="grid gap-10 lg:grid-cols-2">
        {/* Left column */}
        <div className="space-y-10">
          {/* Device breakdown */}
          <section>
            <div className="border-b border-border pb-3 mb-0">
              <h2 className="text-[11px] font-semibold uppercase tracking-widest text-muted-foreground">
                Views by Device
              </h2>
            </div>
            {Object.keys(pageViews.byDevice).length === 0 ? (
              <p className="py-6 text-sm text-muted-foreground">No device data yet.</p>
            ) : (
              Object.entries(pageViews.byDevice)
                .sort(([, a], [, b]) => b - a)
                .map(([device, count]) => (
                  <div key={device} className="flex items-center gap-3 border-b border-border py-3 last:border-0">
                    <span className="flex items-center gap-1.5 w-24 shrink-0 text-sm text-muted-foreground">
                      {DEVICE_ICONS[device] ?? <Monitor className="h-3.5 w-3.5" />}
                      <span className="capitalize">{device}</span>
                    </span>
                    <div className="flex-1 h-1.5 overflow-hidden rounded-full bg-border">
                      <div
                        className="h-full rounded-full bg-primary/60"
                        style={{ width: `${(count / maxDevice) * 100}%` }}
                      />
                    </div>
                    <span className="w-8 shrink-0 text-right text-xs tabular-nums text-muted-foreground">
                      {count}
                    </span>
                  </div>
                ))
            )}
          </section>

          {/* Top countries */}
          <section>
            <div className="border-b border-border pb-3">
              <h2 className="text-[11px] font-semibold uppercase tracking-widest text-muted-foreground">
                Views by Country
              </h2>
            </div>
            {pageViews.byCountry.length === 0 ? (
              <p className="py-6 text-sm text-muted-foreground">No country data yet.</p>
            ) : (
              pageViews.byCountry.map(({ country, count }) => (
                <div key={country} className="flex items-center gap-3 border-b border-border py-3 last:border-0">
                  <span className="w-28 shrink-0 text-sm text-foreground truncate">{country}</span>
                  <div className="flex-1 h-1.5 overflow-hidden rounded-full bg-border">
                    <div
                      className="h-full rounded-full bg-blue-400"
                      style={{ width: `${(count / maxCountry) * 100}%` }}
                    />
                  </div>
                  <span className="w-8 shrink-0 text-right text-xs tabular-nums text-muted-foreground">{count}</span>
                </div>
              ))
            )}
          </section>

          {/* Top referrers */}
          <section>
            <div className="border-b border-border pb-3">
              <h2 className="text-[11px] font-semibold uppercase tracking-widest text-muted-foreground">
                Top Referrers
              </h2>
            </div>
            {pageViews.byReferrer.length === 0 ? (
              <p className="py-6 text-sm text-muted-foreground">No referrer data yet.</p>
            ) : (
              pageViews.byReferrer.map(({ referrer, count }) => (
                <div key={referrer} className="flex items-center gap-3 border-b border-border py-3 last:border-0">
                  <span className="flex-1 text-sm text-foreground truncate">{referrer}</span>
                  <div className="w-24 h-1.5 overflow-hidden rounded-full bg-border">
                    <div
                      className="h-full rounded-full bg-violet-400"
                      style={{ width: `${(count / maxReferrer) * 100}%` }}
                    />
                  </div>
                  <span className="w-8 shrink-0 text-right text-xs tabular-nums text-muted-foreground">{count}</span>
                </div>
              ))
            )}
          </section>
        </div>

        {/* Right column */}
        <div className="space-y-10">
          {/* Recent page views */}
          <section>
            <div className="border-b border-border pb-3">
              <h2 className="text-[11px] font-semibold uppercase tracking-widest text-muted-foreground">
                Recent Page Views
              </h2>
            </div>
            {pageViews.recent.length === 0 ? (
              <p className="py-6 text-sm text-muted-foreground">No page view data yet.</p>
            ) : (
              pageViews.recent.map((view) => (
                <div key={view.id} className="flex items-start gap-3 border-b border-border py-3 last:border-0">
                  <span className="mt-0.5 shrink-0">
                    {DEVICE_ICONS[view.device ?? "unknown"] ?? <Monitor className="h-3.5 w-3.5 text-muted-foreground/60" />}
                  </span>
                  <div className="min-w-0 flex-1 text-xs">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="text-muted-foreground">{view.browser ?? "Unknown browser"}</span>
                      {view.country && (
                        <span className="text-muted-foreground/60">{view.country}</span>
                      )}
                      {view.duration_sec && (
                        <span className="text-muted-foreground/60">{fmtDuration(view.duration_sec)}</span>
                      )}
                    </div>
                    {view.referrer && (
                      <p className="mt-0.5 text-muted-foreground/50 truncate">{view.referrer}</p>
                    )}
                  </div>
                  <span className="shrink-0 text-[10px] text-muted-foreground/60 whitespace-nowrap">
                    {fmtDateTime(view.viewed_at)}
                  </span>
                </div>
              ))
            )}
          </section>

          {/* API Requests */}
          <section>
            <div className="border-b border-border pb-3">
              <h2 className="text-[11px] font-semibold uppercase tracking-widest text-muted-foreground">
                Recent API Requests
              </h2>
            </div>
            {apiRequests.recent.length === 0 ? (
              <p className="py-6 text-sm text-muted-foreground">No API request data for this post.</p>
            ) : (
              apiRequests.recent.map((req) => (
                <div key={req.id} className="flex items-center gap-3 border-b border-border py-3 last:border-0">
                  <span className="w-10 shrink-0 font-mono text-[10px] font-bold text-muted-foreground">
                    {req.method}
                  </span>
                  <span className={cn(
                    "w-10 shrink-0 text-xs font-bold tabular-nums",
                    req.status_code && req.status_code < 400 ? "text-emerald-600" : "text-red-600",
                  )}>
                    {req.status_code ?? "—"}
                  </span>
                  <span className="min-w-0 flex-1 truncate font-mono text-[11px] text-muted-foreground">
                    {req.path}
                  </span>
                  {req.duration_ms && (
                    <span className="shrink-0 text-[10px] text-muted-foreground/60">{req.duration_ms}ms</span>
                  )}
                  <span className="shrink-0 text-[10px] text-muted-foreground/60 whitespace-nowrap">
                    {fmtDateTime(req.requested_at)}
                  </span>
                </div>
              ))
            )}
          </section>

          {/* Activity log */}
          <section>
            <div className="border-b border-border pb-3">
              <h2 className="text-[11px] font-semibold uppercase tracking-widest text-muted-foreground">
                Activity Log
              </h2>
            </div>
            {activity.length === 0 ? (
              <p className="py-6 text-sm text-muted-foreground">No activity recorded yet.</p>
            ) : (
              activity.map((entry) => (
                <div key={entry.id} className="flex items-start gap-2.5 border-b border-border py-3 last:border-0">
                  <Activity className="mt-0.5 h-3.5 w-3.5 shrink-0 text-muted-foreground/40" />
                  <div className="min-w-0 flex-1 text-xs">
                    <p>
                      <span className="font-medium">{entry.actor_name}</span>{" "}
                      <span className="text-muted-foreground">
                        {entry.action.replace(/[._]/g, " ")}
                      </span>
                    </p>
                    <p className="mt-0.5 text-muted-foreground/60">{fmtDateTime(entry.occurred_at)}</p>
                  </div>
                </div>
              ))
            )}
          </section>

          {/* SEO Info */}
          {(post.seo_title || post.meta_description) && (
            <section>
              <div className="border-b border-border pb-3">
                <h2 className="text-[11px] font-semibold uppercase tracking-widest text-muted-foreground">SEO</h2>
              </div>
              {post.seo_title && (
                <div className="border-b border-border py-3">
                  <p className="text-[10px] uppercase tracking-wide text-muted-foreground/60 mb-0.5">SEO Title</p>
                  <p className="text-sm">{post.seo_title}</p>
                </div>
              )}
              {post.meta_description && (
                <div className="py-3">
                  <p className="text-[10px] uppercase tracking-wide text-muted-foreground/60 mb-0.5">Meta Description</p>
                  <p className="text-sm text-muted-foreground">{post.meta_description}</p>
                </div>
              )}
            </section>
          )}
        </div>
      </div>
    </div>
  );
}
