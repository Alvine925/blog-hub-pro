import { createFileRoute, Link, notFound } from "@tanstack/react-router";
import { createServerFn } from "@tanstack/react-start";
import { queryOptions, useSuspenseQuery } from "@tanstack/react-query";
import {
  ArrowLeft, Eye, Clock, BarChart2, Globe, Smartphone, Monitor, Tablet,
  Activity, ExternalLink, Pencil, Tag, User, Calendar, BookOpen, TrendingUp,
  Heart, MessageSquare, Share2, CheckCircle, XCircle, AlertCircle,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { Skeleton } from "@/components/ui/skeleton";

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

interface BlogViewRow {
  id: string;
  device_type: string | null;
  referrer: string | null;
  created_at: string;
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
  blogViews: {
    total: number;
    byDevice: Record<string, number>;
    byReferrer: Array<{ referrer: string; count: number }>;
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

    const [blogViewsRes, apiRes, actRes, likesRes, commentsRes, sharesRes, allCommentsRes] =
      await Promise.all([
        // blog_views has device_type and referrer — this is where view data lives
        db.from("blog_views")
          .select("id,device_type,referrer,created_at")
          .eq("blog_post_id", data.postId)
          .order("created_at", { ascending: false }),
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

    const viewRows: BlogViewRow[] = blogViewsRes.data ?? [];
    const apiRows: ApiRequestRow[] = apiRes.data ?? [];
    const actRows: ActivityRow[] = actRes.data ?? [];
    const commentRows: CommentRow[] = allCommentsRes.data ?? [];

    // Aggregate device breakdown from blog_views.device_type
    const deviceCount: Record<string, number> = {};
    const referrerCount: Record<string, number> = {};

    for (const v of viewRows) {
      const d = (v.device_type ?? "unknown").toLowerCase();
      deviceCount[d] = (deviceCount[d] ?? 0) + 1;

      let ref = "Direct";
      if (v.referrer) {
        try { ref = new URL(v.referrer).hostname; } catch { ref = v.referrer.slice(0, 40); }
      }
      referrerCount[ref] = (referrerCount[ref] ?? 0) + 1;
    }

    const byReferrer = Object.entries(referrerCount)
      .map(([referrer, count]) => ({ referrer, count }))
      .sort((a, b) => b.count - a.count)
      .slice(0, 8);

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
      blogViews: {
        total: viewRows.length,
        byDevice: deviceCount,
        byReferrer,
      },
      apiRequests: { total: apiRows.length, recent: apiRows.slice(0, 20), byStatus },
      activity: actRows,
    };
  });

// ── Query + Route ──────────────────────────────────────────────────────────────

const detailQuery = (postId: string) =>
  queryOptions({
    queryKey: ["workspace-blog-detail", postId],
    queryFn: () => getWorkspaceBlogDetail({ data: { postId } }),
    staleTime: 5 * 60_000,
  });

function BlogDetailSkeleton() {
  return (
    <div className="min-h-full px-4 py-4 space-y-6 sm:px-8 sm:py-8 sm:space-y-8 max-w-4xl">
      <div className="flex items-center justify-between">
        <Skeleton className="h-4 w-20" />
        <div className="flex items-center gap-2">
          <Skeleton className="h-8 w-24 rounded-md" />
          <Skeleton className="h-8 w-24 rounded-md" />
        </div>
      </div>
      <Skeleton className="h-48 w-full rounded-xl" />
      <div className="space-y-3">
        <div className="flex items-center gap-2">
          <Skeleton className="h-5 w-20 rounded-full" />
          <Skeleton className="h-5 w-16 rounded-full" />
        </div>
        <Skeleton className="h-8 w-2/3" />
        <Skeleton className="h-4 w-40" />
      </div>
      <div className="flex divide-x divide-border border-y border-border">
        {[...Array(4)].map((_, i) => (
          <div key={i} className="flex-1 px-5 py-4 space-y-1.5">
            <Skeleton className="h-3 w-16" />
            <Skeleton className="h-7 w-10" />
          </div>
        ))}
      </div>
      <div className="space-y-3">
        <Skeleton className="h-3 w-28 border-b border-border pb-3" />
        {[...Array(6)].map((_, i) => (
          <Skeleton key={i} className={`h-4 ${i % 3 === 2 ? "w-1/2" : "w-full"}`} />
        ))}
      </div>
      <div className="grid gap-4 lg:grid-cols-2">
        {[...Array(2)].map((_, col) => (
          <div key={col} className="space-y-3">
            <Skeleton className="h-3 w-24" />
            {[...Array(4)].map((_, i) => (
              <div key={i} className="flex items-center gap-3 border-b border-border py-2.5 last:border-0">
                <Skeleton className="h-3 flex-1" />
                <Skeleton className="h-4 w-12 rounded-full" />
              </div>
            ))}
          </div>
        ))}
      </div>
    </div>
  );
}

export const Route = createFileRoute("/admin/workspaces/$id/blogs/$postId/")({
  head: () => ({ meta: [{ title: "Post Details" }] }),
  loader: ({ context, params }) =>
    context.queryClient.ensureQueryData(detailQuery(params.postId)),
  pendingComponent: BlogDetailSkeleton,
  pendingMs: 0,
  component: WorkspaceBlogDetail,
  notFoundComponent: () => (
    <div className="px-4 py-4 sm:px-8 sm:py-8">
      <p className="text-sm text-muted-foreground">Post not found.</p>
    </div>
  ),
  errorComponent: ({ error }) => (
    <div className="px-4 py-4 sm:px-8 sm:py-8">
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

// ── Stat tile (no card, just numbers on the bg) ────────────────────────────────

function StatTile({
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
    <h2 className="text-[11px] font-semibold uppercase tracking-widest text-muted-foreground/70 pb-3 border-b border-border">
      {children}
    </h2>
  );
}

// ── Page component ─────────────────────────────────────────────────────────────

function WorkspaceBlogDetail() {
  const { id: workspaceId, postId } = Route.useParams();
  const { data } = useSuspenseQuery(detailQuery(postId));
  const { post, engagement, comments, blogViews, apiRequests, activity } = data;

  const totalViews     = post.views;
  const engagementTotal = engagement.likes + engagement.comments + engagement.shares;
  const engagementRate  = totalViews > 0
    ? `${((engagementTotal / totalViews) * 100).toFixed(1)}%`
    : "—";

  const maxDevice   = Math.max(...Object.values(blogViews.byDevice), 1);
  const maxReferrer = Math.max(...blogViews.byReferrer.map((r) => r.count), 1);

  const pendingComments  = comments.filter((c) => c.status === "pending").length;
  const approvedComments = comments.filter((c) => c.status === "approved").length;

  return (
    <div className="min-h-full px-4 py-4 space-y-6 sm:px-8 sm:py-8 sm:space-y-8">

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
            <a
              href={`/blogs/${post.slug}`}
              target="_blank"
              rel="noopener noreferrer"
              className="flex items-center gap-1.5 rounded-md border border-border px-3 py-1.5 text-sm text-muted-foreground hover:text-foreground hover:border-primary/40 transition-colors"
            >
              <ExternalLink className="h-3.5 w-3.5" /> View live
            </a>
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

      {/* ── Post header — no card, directly on background ── */}
      <div>
        {post.cover_image && (
          <img
            src={post.cover_image}
            alt={post.title}
            className="w-full h-52 object-cover rounded-xl mb-5"
          />
        )}

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
          <p className="mt-2 text-sm text-muted-foreground leading-relaxed max-w-2xl">
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

      {/* ── Engagement stats — no card, horizontal divider strip ── */}
      <div className="border-y border-border divide-x divide-border flex">
        <StatTile label="Total Views"       value={totalViews.toLocaleString()}           icon={Eye}           />
        <StatTile label="Likes"             value={engagement.likes.toLocaleString()}      icon={Heart}         color="text-rose-400" />
        <StatTile label="Comments"          value={engagement.comments.toLocaleString()}   icon={MessageSquare} color="text-blue-400" />
        <StatTile label="Shares"            value={engagement.shares.toLocaleString()}     icon={Share2}        color="text-violet-400" />
        <StatTile label="Engagement Rate"   value={engagementRate}                         icon={TrendingUp}    />
      </div>

      {/* ── Performance strip ── */}
      <div className="border-b border-border divide-x divide-border flex">
        <StatTile label="Tracked Views"   value={blogViews.total.toLocaleString()} icon={TrendingUp} />
        <StatTile label="API Requests"    value={apiRequests.total.toLocaleString()} icon={Activity} />
        <div className="flex-1 min-w-0 px-5 py-4">
          <div className="flex items-center gap-1.5 mb-1">
            <Globe className="h-3.5 w-3.5 shrink-0 text-muted-foreground" />
            <p className="text-[10px] uppercase tracking-widest text-muted-foreground">Slug</p>
          </div>
          <p className="text-sm font-mono break-all leading-snug mt-1">/{post.slug}</p>
        </div>
      </div>

      {/* ── Main grid ── */}
      <div className="grid gap-10 lg:grid-cols-2">

        {/* LEFT: Comments, activity, SEO */}
        <div className="space-y-10">

          {/* Comments */}
          <section>
            <div className="flex items-center justify-between mb-0">
              <SectionHeader>Comments</SectionHeader>
              <div className="flex items-center gap-3 text-xs text-muted-foreground pb-3">
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
              <p className="py-8 text-sm text-muted-foreground text-center">No comments yet.</p>
            ) : (
              <div className="divide-y divide-border">
                {comments.map((comment) => (
                  <div key={comment.id} className={cn(
                    "py-4",
                    comment.parent_id ? "pl-8" : "",
                  )}>
                    <div className="flex items-center gap-2 mb-2">
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
                          {comment.parent_id && (
                            <span className="text-[10px] text-muted-foreground/50">↩ Reply</span>
                          )}
                        </div>
                        <p className="text-[10px] text-muted-foreground/60">
                          {comment.author_email} · {fmtDateTime(comment.created_at)}
                        </p>
                      </div>
                    </div>
                    <p className="text-sm text-foreground leading-relaxed pl-9">{comment.content}</p>
                  </div>
                ))}
              </div>
            )}
          </section>

          {/* Activity log */}
          <section>
            <SectionHeader>Activity Log</SectionHeader>
            {activity.length === 0 ? (
              <p className="py-8 text-sm text-muted-foreground text-center">No activity recorded yet.</p>
            ) : (
              <div className="divide-y divide-border">
                {activity.map((entry) => (
                  <div key={entry.id} className="flex items-start gap-3 py-3">
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
            <section>
              <SectionHeader>SEO</SectionHeader>
              <div className="divide-y divide-border">
                {post.seo_title && (
                  <div className="py-4">
                    <p className="text-[10px] uppercase tracking-wide text-muted-foreground/60 mb-1">SEO Title</p>
                    <p className="text-sm">{post.seo_title}</p>
                  </div>
                )}
                {post.meta_description && (
                  <div className="py-4">
                    <p className="text-[10px] uppercase tracking-wide text-muted-foreground/60 mb-1">Meta Description</p>
                    <p className="text-sm text-muted-foreground">{post.meta_description}</p>
                  </div>
                )}
              </div>
            </section>
          )}
        </div>

        {/* RIGHT: Devices, referrers, API requests */}
        <div className="space-y-10">

          {/* Device breakdown */}
          <section>
            <SectionHeader>Views by Device</SectionHeader>
            {Object.keys(blogViews.byDevice).length === 0 ? (
              <p className="py-8 text-sm text-muted-foreground text-center">
                No device data yet — visits will appear here once readers view this post through your API.
              </p>
            ) : (
              <div className="divide-y divide-border">
                {Object.entries(blogViews.byDevice)
                  .sort(([, a], [, b]) => b - a)
                  .map(([device, count]) => (
                    <div key={device} className="flex items-center gap-3 py-3">
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

          {/* Top referrers */}
          <section>
            <SectionHeader>Top Referrers</SectionHeader>
            {blogViews.byReferrer.length === 0 ? (
              <p className="py-8 text-sm text-muted-foreground text-center">No referrer data yet.</p>
            ) : (
              <div className="divide-y divide-border">
                {blogViews.byReferrer.map(({ referrer, count }) => (
                  <div key={referrer} className="flex items-center gap-3 py-3">
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

          {/* Recent API requests */}
          <section>
            <SectionHeader>Recent API Requests</SectionHeader>
            {apiRequests.recent.length === 0 ? (
              <p className="py-8 text-sm text-muted-foreground text-center">No API requests for this post yet.</p>
            ) : (
              <div className="divide-y divide-border">
                {apiRequests.recent.map((req) => (
                  <div key={req.id} className="flex items-center gap-3 py-3">
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
