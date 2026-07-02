import { createFileRoute, Link, notFound } from "@tanstack/react-router";
import { createServerFn } from "@tanstack/react-start";
import { queryOptions, useSuspenseQuery } from "@tanstack/react-query";
import {
  ArrowLeft, Eye, Clock, BarChart2, Globe, Smartphone, Monitor, Tablet,
  Activity, ExternalLink, Pencil, Tag, User, Calendar, BookOpen, TrendingUp,
  Heart, MessageSquare, Share2, CheckCircle, XCircle, AlertCircle,
} from "lucide-react";
import { cn } from "@/lib/utils";

// ── Types ──────────────────────────────────────────────────────────────────────

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
  scheduled_at: string | null;
  reading_time: number;
  views: number;
  word_count: number | null;
  created_at: string;
  updated_at: string;
  seo_title: string | null;
  meta_description: string | null;
}

interface CommentRow {
  id: string;
  author_name: string;
  author_email: string;
  author_website: string | null;
  content: string;
  status: string;
  parent_id: string | null;
  created_at: string;
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

interface WorkspaceBlogDetailData {
  post: PostDetails;
  engagement: { likes: number; comments: number; shares: number };
  comments: CommentRow[];
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

// ── Server fn ──────────────────────────────────────────────────────────────────

const getWorkspaceBlogDetail = createServerFn({ method: "GET" })
  .validator((input: { postId: string }) => input)
  .handler(async ({ data }): Promise<WorkspaceBlogDetailData> => {
    const { getAdminClient } = await import("../lib/supabase.server");
    const db = getAdminClient() as any;

    const { data: post, error: postError } = await db
      .from("blog_posts")
      .select("*")
      .eq("id", data.postId)
      .single();

    if (postError || !post) throw new Error("Post not found");

    const [pvRes, apiRes, actRes, likesRes, commentsRes, sharesRes, allCommentsRes] =
      await Promise.all([
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
        db.from("blog_likes")
          .select("id", { count: "exact", head: true })
          .eq("blog_post_id", data.postId),
        db.from("blog_comments")
          .select("id", { count: "exact", head: true })
          .eq("blog_post_id", data.postId)
          .eq("status", "approved"),
        db.from("blog_shares")
          .select("id", { count: "exact", head: true })
          .eq("blog_post_id", data.postId),
        db.from("blog_comments")
          .select("id,author_name,author_email,author_website,content,status,parent_id,created_at")
          .eq("blog_post_id", data.postId)
          .order("created_at", { ascending: false }),
      ]);

    const views: PageViewRow[] = pvRes.data ?? [];
    const apiRows: ApiRequestRow[] = apiRes.data ?? [];
    const actRows: ActivityRow[] = actRes.data ?? [];
    const commentRows: CommentRow[] = allCommentsRes.data ?? [];

    // Aggregate page views
    const deviceCount: Record<string, number> = {};
    const countryCount: Record<string, number> = {};
    const referrerCount: Record<string, number> = {};
    let totalDuration = 0, durationCount = 0;

    for (const v of views) {
      const d = v.device ?? "unknown";
      deviceCount[d] = (deviceCount[d] ?? 0) + 1;
      if (v.country) countryCount[v.country] = (countryCount[v.country] ?? 0) + 1;
      let ref = "Direct";
      if (v.referrer) {
        try { ref = new URL(v.referrer).hostname; } catch { ref = v.referrer.slice(0, 40); }
      }
      referrerCount[ref] = (referrerCount[ref] ?? 0) + 1;
      if (v.duration_sec) { totalDuration += v.duration_sec; durationCount++; }
    }

    const byCountry = Object.entries(countryCount)
      .map(([country, count]) => ({ country, count }))
      .sort((a, b) => b.count - a.count).slice(0, 8);

    const byReferrer = Object.entries(referrerCount)
      .map(([referrer, count]) => ({ referrer, count }))
      .sort((a, b) => b.count - a.count).slice(0, 8);

    const byStatus: Record<string, number> = {};
    for (const r of apiRows) {
      const s = String(r.status_code ?? "unknown");
      byStatus[s] = (byStatus[s] ?? 0) + 1;
    }

    return {
      post: { ...post, tags: Array.isArray(post.tags) ? post.tags : [] } as PostDetails,
      engagement: {
        likes: likesRes.count ?? 0,
        comments: commentsRes.count ?? 0,
        shares: sharesRes.count ?? 0,
      },
      comments: commentRows,
      pageViews: {
        total: views.length,
        byDevice: deviceCount,
        byCountry,
        byReferrer,
        recent: views.slice(0, 20),
        avgDuration: durationCount > 0 ? Math.round(totalDuration / durationCount) : 0,
      },
      apiRequests: { total: apiRows.length, recent: apiRows.slice(0, 20), byStatus },
      activity: actRows,
    };
  });

// ── Query + Route ──────────────────────────────────────────────────────────────

const detailQuery = (postId: string) =>
  queryOptions({
    queryKey: ["workspace-blog-detail", postId],
    queryFn:  () => getWorkspaceBlogDetail({ data: { postId } }),
    staleTime: 30_000,
  });

export const Route = createFileRoute("/admin/workspaces/$id/blogs/$postId")({
  head: () => ({ meta: [{ title: "Post Details" }] }),
  loader: ({ context, params }) =>
    context.queryClient.ensureQueryData(detailQuery(params.postId)),
  component: WorkspaceBlogDetail,
  notFoundComponent: () => (
    <div className="px-8 py-8">
      <p className="text-sm text-muted-foreground">Post not found.</p>
    </div>
  ),
  errorComponent: ({ error }) => (
    <div className="px-8 py-8">
      <p className="text-sm text-red-600">{error.message}</p>
    </div>
  ),
});

// ── Helpers ────────────────────────────────────────────────────────────────────

function fmtDate(d: string) {
  return new Date(d).toLocaleDateString("en-US", {
    month: "short", day: "numeric", year: "numeric",
  });
}
function fmtDateTime(d: string) {
  return new Date(d).toLocaleString("en-US", {
    month: "short", day: "numeric", hour: "2-digit", minute: "2-digit",
  });
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
  published: "text-emerald-600 bg-emerald-50",
  draft:     "text-muted-foreground bg-muted",
  scheduled: "text-amber-600 bg-amber-50",
};

const COMMENT_STATUS_ICON: Record<string, React.ReactNode> = {
  approved: <CheckCircle className="h-3.5 w-3.5 text-emerald-500" />,
  pending:  <AlertCircle  className="h-3.5 w-3.5 text-amber-500"  />,
  rejected: <XCircle      className="h-3.5 w-3.5 text-red-400"    />,
};

// ── Stat card ──────────────────────────────────────────────────────────────────

function StatCard({
  label, value, icon: Icon, color = "text-muted-foreground",
}: { label: string; value: string; icon: React.ElementType; color?: string }) {
  return (
    <div className="flex-1 min-w-0 px-5 py-4">
      <div className="flex items-center gap-1.5 mb-1">
        <Icon className={cn("h-3.5 w-3.5 shrink-0", color)} />
        <p className="text-[10px] uppercase tracking-widest text-muted-foreground">{label}</p>
      </div>
      <p className="text-2xl font-bold tabular-nums">{value}</p>
    </div>
  );
}

// ── Section header ─────────────────────────────────────────────────────────────

function SectionHeader({ children }: { children: React.ReactNode }) {
  return (
    <div className="border-b border-border pb-3 mb-0">
      <h2 className="text-[11px] font-semibold uppercase tracking-widest text-muted-foreground">
        {children}
      </h2>
    </div>
  );
}

// ── Page component ─────────────────────────────────────────────────────────────

function WorkspaceBlogDetail() {
  const { id: workspaceId, postId } = Route.useParams();
  const { data } = useSuspenseQuery(detailQuery(postId));
  const { post, engagement, comments, pageViews, apiRequests, activity } = data;

  const totalViews    = post.views;
  const engagementTotal = engagement.likes + engagement.comments + engagement.shares;
  const engagementRate  = totalViews > 0
    ? `${((engagementTotal / totalViews) * 100).toFixed(1)}%`
    : "—";

  const maxDevice   = Math.max(...Object.values(pageViews.byDevice), 1);
  const maxCountry  = Math.max(...pageViews.byCountry.map((c) => c.count), 1);
  const maxReferrer = Math.max(...pageViews.byReferrer.map((r) => r.count), 1);

  const pendingComments  = comments.filter((c) => c.status === "pending").length;
  const approvedComments = comments.filter((c) => c.status === "approved").length;

  return (
    <div className="min-h-full px-8 py-8 space-y-8">

      {/* Top nav */}
      <div className="flex items-center justify-between">
        <Link
          to="/admin/workspaces/$id/blogs"
          params={{ id: workspaceId }}
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
              className="flex items-center gap-1.5 rounded-md border border-border bg-white px-3 py-1.5 text-sm text-muted-foreground hover:text-foreground hover:border-primary/40 transition-colors"
            >
              <ExternalLink className="h-3.5 w-3.5" /> View live
            </Link>
          )}
          <Link
            to="/admin/workspaces/$id/blogs/$postId/edit"
            params={{ id: workspaceId, postId }}
            className="flex items-center gap-1.5 rounded-md bg-primary px-4 py-1.5 text-sm font-medium text-primary-foreground hover:bg-primary/90 transition-colors"
          >
            <Pencil className="h-3.5 w-3.5" /> Edit Post
          </Link>
        </div>
      </div>

      {/* Post header */}
      <div className="rounded-xl border border-border bg-white overflow-hidden">
        {post.cover_image && (
          <img
            src={post.cover_image}
            alt={post.title}
            className="w-full h-48 object-cover border-b border-border"
          />
        )}
        <div className="p-6">
          <div className="flex items-center gap-2 mb-3">
            <span className={cn("text-xs font-medium px-2 py-0.5 rounded-full capitalize",
              STATUS_STYLE[post.status] ?? "text-muted-foreground bg-muted")}>
              {post.status}
            </span>
            {post.featured && (
              <span className="text-[10px] bg-amber-50 text-amber-700 font-medium px-2 py-0.5 rounded-full">
                ⭐ Featured
              </span>
            )}
          </div>

          <h1 className="text-2xl font-bold leading-tight">
            {post.title || "Untitled"}
          </h1>
          {post.excerpt && (
            <p className="mt-2 text-sm text-muted-foreground leading-relaxed">
              {post.excerpt}
            </p>
          )}

          <div className="mt-4 flex flex-wrap gap-x-5 gap-y-2 text-xs text-muted-foreground">
            <span className="flex items-center gap-1.5">
              <User className="h-3.5 w-3.5" /> {post.author_name}
            </span>
            {post.category && (
              <span className="flex items-center gap-1.5">
                <Tag className="h-3.5 w-3.5" /> {post.category}
              </span>
            )}
            <span className="flex items-center gap-1.5">
              <BookOpen className="h-3.5 w-3.5" /> {post.reading_time} min read
            </span>
            {post.word_count && (
              <span className="flex items-center gap-1.5">
                <BarChart2 className="h-3.5 w-3.5" /> {post.word_count.toLocaleString()} words
              </span>
            )}
            {post.published_at && (
              <span className="flex items-center gap-1.5">
                <Calendar className="h-3.5 w-3.5" /> Published {fmtDate(post.published_at)}
              </span>
            )}
            {post.scheduled_at && post.status === "scheduled" && (
              <span className="flex items-center gap-1.5 text-amber-600">
                <Clock className="h-3.5 w-3.5" /> Scheduled {fmtDate(post.scheduled_at)}
              </span>
            )}
            <span className="flex items-center gap-1.5">
              <Clock className="h-3.5 w-3.5" /> Updated {fmtDate(post.updated_at)}
            </span>
            <span className="flex items-center gap-1.5 font-mono">
              <Globe className="h-3.5 w-3.5" /> /{post.slug}
            </span>
          </div>

          {post.tags.length > 0 && (
            <div className="mt-3 flex flex-wrap gap-1.5">
              {post.tags.map((tag) => (
                <span key={tag}
                  className="text-[11px] bg-muted px-2.5 py-0.5 rounded-full text-muted-foreground">
                  {tag}
                </span>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* Engagement stats */}
      <div className="rounded-xl border border-border bg-white overflow-hidden divide-x divide-border flex">
        <StatCard label="Total Views"      value={totalViews.toLocaleString()}    icon={Eye}          />
        <StatCard label="Likes"            value={engagement.likes.toLocaleString()}     icon={Heart}        color="text-rose-400" />
        <StatCard label="Approved Comments" value={engagement.comments.toLocaleString()} icon={MessageSquare} color="text-blue-400" />
        <StatCard label="Shares"           value={engagement.shares.toLocaleString()}    icon={Share2}       color="text-violet-400" />
        <StatCard label="Engagement Rate"  value={engagementRate}                 icon={TrendingUp}   />
      </div>

      {/* Performance stats */}
      <div className="rounded-xl border border-border bg-white overflow-hidden divide-x divide-border flex">
        <StatCard label="Tracked Page Views" value={pageViews.total.toLocaleString()} icon={TrendingUp} />
        <StatCard label="Avg. Read Time"
          value={pageViews.avgDuration > 0 ? fmtDuration(pageViews.avgDuration) : "—"}
          icon={Clock} />
        <StatCard label="API Requests" value={apiRequests.total.toLocaleString()} icon={Activity} />
        <div className="flex-1 min-w-0 px-5 py-4">
          <div className="flex items-center gap-1.5 mb-1">
            <Globe className="h-3.5 w-3.5 shrink-0 text-muted-foreground" />
            <p className="text-[10px] uppercase tracking-widest text-muted-foreground">Slug</p>
          </div>
          <p className="text-sm font-mono break-all leading-snug mt-1">/{post.slug}</p>
        </div>
      </div>

      {/* Main grid */}
      <div className="grid gap-8 lg:grid-cols-2">

        {/* LEFT: Comments, activity, SEO */}
        <div className="space-y-8">

          {/* Comments */}
          <section className="rounded-xl border border-border bg-white overflow-hidden">
            <div className="flex items-center justify-between px-5 py-4 border-b border-border">
              <SectionHeader>
                Comments
              </SectionHeader>
              <div className="flex items-center gap-3 text-xs text-muted-foreground ml-auto">
                <span className="flex items-center gap-1 text-emerald-600">
                  <CheckCircle className="h-3 w-3" /> {approvedComments} approved
                </span>
                {pendingComments > 0 && (
                  <span className="flex items-center gap-1 text-amber-600">
                    <AlertCircle className="h-3 w-3" /> {pendingComments} pending
                  </span>
                )}
              </div>
            </div>

            {comments.length === 0 ? (
              <p className="px-5 py-8 text-sm text-muted-foreground text-center">
                No comments yet.
              </p>
            ) : (
              <div className="divide-y divide-border">
                {comments.map((comment) => (
                  <div key={comment.id} className={cn(
                    "px-5 py-4",
                    comment.parent_id ? "pl-10 bg-muted/20" : "",
                  )}>
                    <div className="flex items-start justify-between gap-3">
                      <div className="flex items-center gap-2">
                        <div className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-muted text-xs font-semibold text-muted-foreground">
                          {comment.author_name.charAt(0).toUpperCase()}
                        </div>
                        <div>
                          <div className="flex items-center gap-2">
                            <span className="text-sm font-medium">{comment.author_name}</span>
                            {comment.author_website && (
                              <a href={comment.author_website} target="_blank" rel="noopener noreferrer"
                                className="text-[10px] text-primary hover:underline">
                                {comment.author_website.replace(/^https?:\/\//, "").slice(0, 20)}
                              </a>
                            )}
                            {COMMENT_STATUS_ICON[comment.status]}
                          </div>
                          <p className="text-[10px] text-muted-foreground/60">
                            {comment.author_email} · {fmtDateTime(comment.created_at)}
                            {comment.parent_id && " · Reply"}
                          </p>
                        </div>
                      </div>
                    </div>
                    <p className="mt-2 text-sm text-foreground leading-relaxed">{comment.content}</p>
                  </div>
                ))}
              </div>
            )}
          </section>

          {/* Activity log */}
          <section className="rounded-xl border border-border bg-white overflow-hidden">
            <div className="px-5 py-4 border-b border-border">
              <SectionHeader>Activity Log</SectionHeader>
            </div>
            {activity.length === 0 ? (
              <p className="px-5 py-8 text-sm text-muted-foreground text-center">No activity recorded yet.</p>
            ) : (
              <div className="divide-y divide-border">
                {activity.map((entry) => (
                  <div key={entry.id} className="flex items-start gap-3 px-5 py-3">
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
                ))}
              </div>
            )}
          </section>

          {/* SEO */}
          {(post.seo_title || post.meta_description) && (
            <section className="rounded-xl border border-border bg-white overflow-hidden">
              <div className="px-5 py-4 border-b border-border">
                <SectionHeader>SEO</SectionHeader>
              </div>
              <div className="divide-y divide-border">
                {post.seo_title && (
                  <div className="px-5 py-4">
                    <p className="text-[10px] uppercase tracking-wide text-muted-foreground/60 mb-1">SEO Title</p>
                    <p className="text-sm">{post.seo_title}</p>
                  </div>
                )}
                {post.meta_description && (
                  <div className="px-5 py-4">
                    <p className="text-[10px] uppercase tracking-wide text-muted-foreground/60 mb-1">Meta Description</p>
                    <p className="text-sm text-muted-foreground">{post.meta_description}</p>
                  </div>
                )}
              </div>
            </section>
          )}
        </div>

        {/* RIGHT: Devices, countries, referrers, page views, API requests */}
        <div className="space-y-8">

          {/* Device breakdown */}
          <section className="rounded-xl border border-border bg-white overflow-hidden">
            <div className="px-5 py-4 border-b border-border">
              <SectionHeader>Views by Device</SectionHeader>
            </div>
            {Object.keys(pageViews.byDevice).length === 0 ? (
              <p className="px-5 py-8 text-sm text-muted-foreground text-center">No device data yet.</p>
            ) : (
              <div className="divide-y divide-border">
                {Object.entries(pageViews.byDevice)
                  .sort(([, a], [, b]) => b - a)
                  .map(([device, count]) => (
                    <div key={device} className="flex items-center gap-3 px-5 py-3">
                      <span className="flex items-center gap-1.5 w-24 shrink-0 text-sm text-muted-foreground capitalize">
                        {DEVICE_ICONS[device] ?? <Monitor className="h-3.5 w-3.5" />}
                        {device}
                      </span>
                      <div className="flex-1 h-1.5 overflow-hidden rounded-full bg-border">
                        <div className="h-full rounded-full bg-primary/60"
                          style={{ width: `${(count / maxDevice) * 100}%` }} />
                      </div>
                      <span className="w-8 shrink-0 text-right text-xs tabular-nums text-muted-foreground">
                        {count}
                      </span>
                    </div>
                  ))}
              </div>
            )}
          </section>

          {/* Top countries */}
          <section className="rounded-xl border border-border bg-white overflow-hidden">
            <div className="px-5 py-4 border-b border-border">
              <SectionHeader>Views by Country</SectionHeader>
            </div>
            {pageViews.byCountry.length === 0 ? (
              <p className="px-5 py-8 text-sm text-muted-foreground text-center">No country data yet.</p>
            ) : (
              <div className="divide-y divide-border">
                {pageViews.byCountry.map(({ country, count }) => (
                  <div key={country} className="flex items-center gap-3 px-5 py-3">
                    <span className="w-28 shrink-0 text-sm text-foreground truncate">{country}</span>
                    <div className="flex-1 h-1.5 overflow-hidden rounded-full bg-border">
                      <div className="h-full rounded-full bg-blue-400"
                        style={{ width: `${(count / maxCountry) * 100}%` }} />
                    </div>
                    <span className="w-8 shrink-0 text-right text-xs tabular-nums text-muted-foreground">
                      {count}
                    </span>
                  </div>
                ))}
              </div>
            )}
          </section>

          {/* Top referrers */}
          <section className="rounded-xl border border-border bg-white overflow-hidden">
            <div className="px-5 py-4 border-b border-border">
              <SectionHeader>Top Referrers</SectionHeader>
            </div>
            {pageViews.byReferrer.length === 0 ? (
              <p className="px-5 py-8 text-sm text-muted-foreground text-center">No referrer data yet.</p>
            ) : (
              <div className="divide-y divide-border">
                {pageViews.byReferrer.map(({ referrer, count }) => (
                  <div key={referrer} className="flex items-center gap-3 px-5 py-3">
                    <span className="flex-1 text-sm text-foreground truncate">{referrer}</span>
                    <div className="w-24 h-1.5 overflow-hidden rounded-full bg-border">
                      <div className="h-full rounded-full bg-violet-400"
                        style={{ width: `${(count / maxReferrer) * 100}%` }} />
                    </div>
                    <span className="w-8 shrink-0 text-right text-xs tabular-nums text-muted-foreground">
                      {count}
                    </span>
                  </div>
                ))}
              </div>
            )}
          </section>

          {/* Recent page views */}
          <section className="rounded-xl border border-border bg-white overflow-hidden">
            <div className="px-5 py-4 border-b border-border">
              <SectionHeader>Recent Page Views</SectionHeader>
            </div>
            {pageViews.recent.length === 0 ? (
              <p className="px-5 py-8 text-sm text-muted-foreground text-center">No page view data yet.</p>
            ) : (
              <div className="divide-y divide-border">
                {pageViews.recent.map((view) => (
                  <div key={view.id} className="flex items-start gap-3 px-5 py-3">
                    <span className="mt-0.5 shrink-0 text-muted-foreground/60">
                      {DEVICE_ICONS[view.device ?? "unknown"] ?? <Monitor className="h-3.5 w-3.5" />}
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
                ))}
              </div>
            )}
          </section>

          {/* Recent API requests */}
          <section className="rounded-xl border border-border bg-white overflow-hidden">
            <div className="px-5 py-4 border-b border-border">
              <SectionHeader>Recent API Requests</SectionHeader>
            </div>
            {apiRequests.recent.length === 0 ? (
              <p className="px-5 py-8 text-sm text-muted-foreground text-center">No API request data for this post.</p>
            ) : (
              <div className="divide-y divide-border">
                {apiRequests.recent.map((req) => (
                  <div key={req.id} className="flex items-center gap-3 px-5 py-3">
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
                ))}
              </div>
            )}
          </section>

        </div>
      </div>
    </div>
  );
}
