import { createFileRoute, Link } from "@tanstack/react-router";
import { createServerFn } from "@tanstack/react-start";
import { queryOptions, useSuspenseQuery } from "@tanstack/react-query";
import { useState } from "react";
import { Skeleton } from "@/components/ui/skeleton";

// ── Loading skeleton ──────────────────────────────────────────────────────────
function WorkspaceOverviewSkeleton() {
  return (
    <div className="min-h-full space-y-8 px-4 py-4 sm:space-y-12 sm:px-8 sm:py-8">
      {/* Header */}
      <div className="flex items-start justify-between gap-4">
        <div className="space-y-2">
          <Skeleton className="h-6 w-28" />
          <Skeleton className="h-4 w-72" />
        </div>
        <Skeleton className="h-9 w-28 rounded-lg" />
      </div>

      {/* Stats row — 7 columns */}
      <div className="grid grid-cols-2 gap-x-4 gap-y-4 sm:grid-cols-4 sm:gap-x-8 sm:gap-y-6 lg:grid-cols-7">
        {[...Array(7)].map((_, i) => (
          <div key={i} className="space-y-1.5">
            <Skeleton className="h-7 w-12" />
            <Skeleton className="h-3 w-16" />
          </div>
        ))}
      </div>

      {/* Status progress bar */}
      <div className="space-y-2">
        <Skeleton className="h-1.5 w-full rounded-full" />
        <div className="flex items-center gap-5">
          <Skeleton className="h-3 w-24" />
          <Skeleton className="h-3 w-24" />
          <Skeleton className="h-3 w-16" />
        </div>
      </div>

      {/* Intelligence grid — 3 columns */}
      <div className="grid gap-10 lg:grid-cols-3">
        {[...Array(3)].map((_, col) => (
          <div key={col} className="space-y-4">
            <div className="flex items-center justify-between border-b border-border pb-3">
              <Skeleton className="h-3 w-24" />
            </div>
            <div className="space-y-5">
              {[...Array(4)].map((_, i) => (
                <div key={i} className="space-y-1.5">
                  <Skeleton className="h-4 w-full" />
                  <Skeleton className="h-3 w-3/4" />
                  <div className="flex gap-1.5 pt-1">
                    <Skeleton className="h-5 w-16 rounded-full" />
                    <Skeleton className="h-5 w-14 rounded-full" />
                  </div>
                </div>
              ))}
            </div>
          </div>
        ))}
      </div>

      {/* Main grid: left content + right activity */}
      <div className="grid gap-12 lg:grid-cols-[1fr_260px]">
        {/* Left */}
        <div className="space-y-10">
          {/* Recent Posts */}
          <div className="space-y-3">
            <div className="flex items-center justify-between border-b border-border pb-3">
              <Skeleton className="h-3 w-28" />
              <Skeleton className="h-3 w-14" />
            </div>
            {[...Array(6)].map((_, i) => (
              <div key={i} className="flex items-center gap-3 py-2.5 border-b border-border/60 last:border-0">
                <Skeleton className="h-3 flex-1" />
                <Skeleton className="h-4 w-20 rounded-full" />
                <Skeleton className="h-3 w-16" />
              </div>
            ))}
          </div>

          {/* Quick Actions grid */}
          <div className="space-y-4">
            <div className="border-b border-border pb-3">
              <Skeleton className="h-3 w-28" />
            </div>
            <div className="grid gap-0 sm:grid-cols-2 lg:grid-cols-3 divide-y sm:divide-y-0">
              {[...Array(6)].map((_, i) => (
                <div key={i} className="flex items-center gap-3 py-3 pr-3">
                  <Skeleton className="h-7 w-7 rounded-lg shrink-0" />
                  <div className="space-y-1 flex-1">
                    <Skeleton className="h-3.5 w-24" />
                    <Skeleton className="h-3 w-32" />
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* Right: Activity */}
        <div className="space-y-4">
          <div className="border-b border-border pb-3">
            <Skeleton className="h-3 w-16" />
          </div>
          <div className="space-y-4">
            {[...Array(6)].map((_, i) => (
              <div key={i} className="flex items-start gap-3">
                <Skeleton className="h-5 w-5 rounded-full shrink-0 mt-0.5" />
                <div className="space-y-1.5 flex-1">
                  <Skeleton className="h-3 w-full" />
                  <Skeleton className="h-3 w-3/4" />
                  <Skeleton className="h-2.5 w-16" />
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
import {
  FileText, Layers, ImageIcon, Sparkles, Key, Clock, Activity,
  Plus, Eye, Send, FilePen, ArrowRight, Zap, TrendingUp,
  Globe, Tag, BookOpen, ExternalLink, BarChart2, Lightbulb,
  ChevronRight, Newspaper, HelpCircle, Package,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { GenerateBlogDialog } from "@/components/blog/GenerateBlogDialog";

// ── Types ─────────────────────────────────────────────────────────────────────
interface RecentPost {
  id: string; title: string; status: string;
  updated_at: string; views: number; slug: string;
}
interface ActivityEntry {
  id: string; actor_name: string; action: string;
  entity_label: string | null; occurred_at: string; entity_type: string;
}
interface Competitor {
  id: string; name: string; website: string | null;
  description: string | null; strengths: string[]; weaknesses: string[];
  content_strategy: string | null;
}
interface Keyword {
  id: string; keyword: string; opportunity_type: string;
}
interface ContentOpportunity {
  id: string; title: string; type: string;
  topic: string | null; reason: string | null; priority: "high" | "medium" | "low";
}
interface WorkspaceIntel {
  website_url: string | null;
  industry: string | null;
  description: string | null;
  target_audience: string | null;
  business_model: string | null;
  brand_voice: string | null;
  content_pillars: string[];
  selected_collections: string[];
  ai_context: {
    brandSummary?: string;
    primaryTopics?: string[];
    suggestedCategories?: string[];
    suggestedTags?: string[];
  } | null;
}
interface RecentContent {
  id: string; title: string; status: string; updated_at: string;
}
interface Overview {
  stats: {
    postsTotal: number; postsPublished: number; postsDraft: number;
    postsScheduled: number; collections: number; mediaFiles: number; aiGenerations: number;
  };
  recentPosts:     RecentPost[];
  recentNews:      RecentContent[];
  recentArticles:  RecentContent[];
  recentFaqs:      Array<{ id: string; question: string; status: string; updated_at: string }>;
  recentProducts:  Array<{ id: string; name: string; status: string; updated_at: string }>;
  recentActivity:  ActivityEntry[];
  intel:           WorkspaceIntel | null;
  competitors:     Competitor[];
  keywords:        Keyword[];
  opportunities:   ContentOpportunity[];
}

// ── Server fn ─────────────────────────────────────────────────────────────────
const getOverview = createServerFn({ method: "GET" })
  .validator((input: { id: string }) => input)
  .handler(async ({ data }): Promise<Overview> => {
    const { getAdminClient } = await import("@/lib/supabase.server");
    const db = getAdminClient() as any;

    const [
      pubRes, draftRes, schedRes, mediaRes, aiRes,
      postsRes, actRes, wsRes, compRes, kwRes, oppRes,
      newsRes, artRes, faqRes, prodRes,
    ] = await Promise.all([
      db.from("blog_posts").select("id", { count: "exact", head: true }).eq("workspace_id", data.id).eq("status", "published"),
      db.from("blog_posts").select("id", { count: "exact", head: true }).eq("workspace_id", data.id).eq("status", "draft"),
      db.from("blog_posts").select("id", { count: "exact", head: true }).eq("workspace_id", data.id).eq("status", "scheduled"),
      db.from("media_files").select("id", { count: "exact", head: true }).eq("workspace_id", data.id),
      db.from("ai_generations").select("id", { count: "exact", head: true }).eq("workspace_id", data.id),
      db.from("blog_posts")
        .select("id,title,status,updated_at,views,slug")
        .eq("workspace_id", data.id)
        .order("updated_at", { ascending: false })
        .limit(8),
      db.from("activity_log")
        .select("id,actor_name,action,entity_label,occurred_at,entity_type")
        .eq("workspace_id", data.id)
        .order("occurred_at", { ascending: false })
        .limit(8),
      db.from("workspaces")
        .select("website_url,industry,description,target_audience,business_model,brand_voice,content_pillars,selected_collections,ai_context")
        .eq("id", data.id)
        .maybeSingle(),
      db.from("workspace_competitors").select("*").eq("workspace_id", data.id).limit(6),
      db.from("workspace_keywords").select("*").eq("workspace_id", data.id).limit(24),
      db.from("workspace_content_opportunities")
        .select("*").eq("workspace_id", data.id)
        .order("priority", { ascending: true }).limit(8),
      db.from("news").select("id,title,status,updated_at").eq("workspace_id", data.id)
        .order("updated_at", { ascending: false }).limit(5),
      db.from("articles").select("id,title,status,updated_at").eq("workspace_id", data.id)
        .order("updated_at", { ascending: false }).limit(5),
      db.from("faqs").select("id,question,status,updated_at").eq("workspace_id", data.id)
        .order("updated_at", { ascending: false }).limit(5),
      db.from("products").select("id,name,status,updated_at").eq("workspace_id", data.id)
        .order("updated_at", { ascending: false }).limit(5),
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
        collections:    (wsRes.data?.selected_collections ?? []).length,
        mediaFiles:     mediaRes.count ?? 0,
        aiGenerations:  aiRes.count    ?? 0,
      },
      recentPosts:    postsRes.data  ?? [],
      recentNews:     newsRes.data   ?? [],
      recentArticles: artRes.data    ?? [],
      recentFaqs:     faqRes.data    ?? [],
      recentProducts: prodRes.data   ?? [],
      recentActivity: actRes.data    ?? [],
      intel:          wsRes.data     ?? null,
      competitors:    compRes.data   ?? [],
      keywords:       kwRes.data     ?? [],
      opportunities:  oppRes.data    ?? [],
    };
  });

// ── Route ─────────────────────────────────────────────────────────────────────
const overviewQuery = (id: string) =>
  queryOptions({
    queryKey: ["workspace-overview", id, "v4"],
    queryFn:  () => getOverview({ data: { id } }),
  });

export const Route = createFileRoute("/admin/workspaces/$id/")({
  loader:           ({ context, params }) => context.queryClient.ensureQueryData(overviewQuery(params.id)),
  pendingComponent: WorkspaceOverviewSkeleton,
  pendingMs:        0,
  component:        WorkspaceOverview,
  errorComponent:   ({ error }) => <p className="p-8 text-sm text-red-600">{error.message}</p>,
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

const STATUS_CFG: Record<string, { label: string; dot: string }> = {
  published: { label: "Published", dot: "bg-emerald-500" },
  draft:     { label: "Draft",     dot: "bg-gray-300"   },
  scheduled: { label: "Scheduled", dot: "bg-amber-400"  },
};

const PRIORITY_CFG: Record<string, { label: string; class: string }> = {
  high:   { label: "High",   class: "text-red-600"   },
  medium: { label: "Medium", class: "text-amber-600" },
  low:    { label: "Low",    class: "text-gray-400"  },
};

// ── Sub-components ────────────────────────────────────────────────────────────
function StatusBadge({ status }: { status: string }) {
  const cfg = STATUS_CFG[status] ?? STATUS_CFG.draft;
  return (
    <span className="inline-flex items-center gap-1.5 text-[11px] text-muted-foreground">
      <span className={cn("h-1.5 w-1.5 rounded-full shrink-0", cfg.dot)} />
      {cfg.label}
    </span>
  );
}

function SectionHeading({ icon: Icon, title, action }: {
  icon: React.ComponentType<{ className?: string }>;
  title: string;
  action?: React.ReactNode;
}) {
  return (
    <div className="flex items-center justify-between pb-3 border-b border-border/60">
      <div className="flex items-center gap-2">
        <Icon className="h-3.5 w-3.5 text-muted-foreground" />
        <h2 className="text-xs font-semibold uppercase tracking-widest text-muted-foreground">{title}</h2>
      </div>
      {action}
    </div>
  );
}

// ── Page ──────────────────────────────────────────────────────────────────────
function WorkspaceOverview() {
  const { id } = Route.useParams();
  const { data } = useSuspenseQuery(overviewQuery(id));
  const {
    stats, recentPosts, recentActivity,
    recentNews     = [],
    recentArticles = [],
    recentFaqs     = [],
    recentProducts = [],
    intel          = null,
    competitors    = [],
    keywords       = [],
    opportunities  = [],
  } = data as any;

  const [generateDialogOpen, setGenerateDialogOpen] = useState(false);
  const [selectedOpportunity, setSelectedOpportunity] = useState<ContentOpportunity | null>(null);

  const base  = `/admin/workspaces/${id}`;
  const total = Math.max(stats.postsTotal, 1);

  const hasIntel = !!(intel?.website_url || intel?.industry || competitors.length || keywords.length || opportunities.length);

  const QUICK_ACTIONS = [
    { label: "New Blog Post",  desc: "Write and publish content",  to: `${base}/blogs/new`,    icon: FileText,  primary: true },
    { label: "New Collection", desc: "Define a content type",      to: `${base}/collections`,  icon: Layers     },
    { label: "Upload Media",   desc: "Add images and files",       to: `${base}/media`,        icon: ImageIcon  },
    { label: "AI Assistant",   desc: "Generate content with AI",   to: `${base}/ai-assistant`, icon: Sparkles   },
    { label: "API Keys",       desc: "Manage access tokens",       to: `${base}/api-keys`,     icon: Key        },
    { label: "Analytics",      desc: "View performance metrics",   to: `${base}/analytics`,    icon: TrendingUp },
  ];

  const primaryTopics = intel?.ai_context?.primaryTopics ?? [];
  const suggestedTags = intel?.ai_context?.suggestedTags ?? [];
  const allKeywords   = keywords.map((k: any) => k.keyword);

  return (
    <>
    <GenerateBlogDialog
      open={generateDialogOpen}
      onOpenChange={setGenerateDialogOpen}
      opportunity={selectedOpportunity}
      workspaceId={id}
    />
    <div className="min-h-full space-y-8 px-4 py-4 sm:space-y-12 sm:px-8 sm:py-8">

      {/* ── Header ── */}
      <div className="flex items-start justify-between gap-4">
        <div>
          <h1 className="text-xl font-bold tracking-tight">Overview</h1>
          <p className="mt-0.5 text-sm text-muted-foreground">Content, activity, and site intelligence for this workspace.</p>
        </div>
        <Link
          to="/admin/workspaces/$id/blogs/new"
          params={{ id }}
          className="flex items-center gap-2 rounded-lg bg-primary px-4 py-2 text-sm font-semibold text-white hover:bg-primary/90 transition-colors shrink-0"
        >
          <Plus className="h-4 w-4" /> New Post
        </Link>
      </div>

      {/* ── Stats row ── */}
      <div className="grid grid-cols-2 gap-x-4 gap-y-4 sm:grid-cols-4 sm:gap-x-8 sm:gap-y-6 lg:grid-cols-7">
        {[
          { label: "Total Posts",  value: stats.postsTotal,     icon: FileText  },
          { label: "Published",    value: stats.postsPublished, icon: Send,      accent: "text-emerald-600" },
          { label: "Drafts",       value: stats.postsDraft,     icon: FilePen   },
          { label: "Scheduled",    value: stats.postsScheduled, icon: Clock,     accent: "text-amber-600" },
          { label: "Collections",  value: stats.collections,    icon: Layers,    accent: "text-primary" },
          { label: "Media Files",  value: stats.mediaFiles,     icon: ImageIcon },
          { label: "AI Gens",      value: stats.aiGenerations,  icon: Sparkles  },
        ].map(({ label, value, icon: Icon, accent }) => (
          <div key={label} className="space-y-1">
            <p className={cn("text-2xl font-bold tabular-nums", accent ?? "text-foreground")}>
              {value.toLocaleString()}
            </p>
            <p className="flex items-center gap-1.5 text-xs text-muted-foreground">
              <Icon className="h-3 w-3 shrink-0" />
              {label}
            </p>
          </div>
        ))}
      </div>

      {/* ── Content Status Bar ── */}
      {stats.postsTotal > 0 && (
        <div className="space-y-2">
          <div className="flex h-1.5 overflow-hidden rounded-full bg-muted">
            <div className="h-full bg-emerald-500 transition-all" style={{ width: `${(stats.postsPublished / total) * 100}%` }} />
            <div className="h-full bg-amber-400  transition-all" style={{ width: `${(stats.postsScheduled / total) * 100}%` }} />
            <div className="h-full bg-zinc-300   transition-all" style={{ width: `${(stats.postsDraft     / total) * 100}%` }} />
          </div>
          <div className="flex flex-wrap items-center gap-5 text-xs text-muted-foreground">
            <span className="flex items-center gap-1.5"><span className="h-1.5 w-1.5 rounded-full bg-emerald-500" />{stats.postsPublished} published</span>
            <span className="flex items-center gap-1.5"><span className="h-1.5 w-1.5 rounded-full bg-amber-400"  />{stats.postsScheduled} scheduled</span>
            <span className="flex items-center gap-1.5"><span className="h-1.5 w-1.5 rounded-full bg-zinc-300"   />{stats.postsDraft} drafts</span>
          </div>
        </div>
      )}

      {/* ── Site Intelligence ── */}
      {intel?.website_url && (
        <div className="space-y-4">
          <SectionHeading icon={Globe} title="Site Intelligence" />
          <div className="flex flex-wrap gap-x-10 gap-y-4 text-sm">
            <div>
              <p className="text-[10px] font-semibold uppercase tracking-widest text-muted-foreground/50 mb-1">Website</p>
              <a
                href={intel.website_url}
                target="_blank"
                rel="noopener noreferrer"
                className="flex items-center gap-1 text-primary hover:underline text-sm"
              >
                {intel.website_url.replace(/^https?:\/\//, "")}
                <ExternalLink className="h-3 w-3" />
              </a>
            </div>
            {intel.industry && (
              <div>
                <p className="text-[10px] font-semibold uppercase tracking-widest text-muted-foreground/50 mb-1">Industry</p>
                <p className="font-medium">{intel.industry}</p>
              </div>
            )}
            {intel.brand_voice && (
              <div>
                <p className="text-[10px] font-semibold uppercase tracking-widest text-muted-foreground/50 mb-1">Brand Voice</p>
                <p className="font-medium">{intel.brand_voice}</p>
              </div>
            )}
            {intel.business_model && (
              <div>
                <p className="text-[10px] font-semibold uppercase tracking-widest text-muted-foreground/50 mb-1">Business Model</p>
                <p className="font-medium">{intel.business_model}</p>
              </div>
            )}
            {intel.target_audience && (
              <div>
                <p className="text-[10px] font-semibold uppercase tracking-widest text-muted-foreground/50 mb-1">Target Audience</p>
                <p className="font-medium max-w-xs">{intel.target_audience}</p>
              </div>
            )}
          </div>
          {intel.description && (
            <p className="text-sm text-muted-foreground leading-relaxed max-w-2xl">{intel.description}</p>
          )}
        </div>
      )}

      {/* ── Content Pillars ── */}
      {(intel?.content_pillars?.length ?? 0) > 0 && (
        <div className="space-y-4">
          <SectionHeading icon={BookOpen} title="Content Pillars" />
          <div className="flex flex-wrap gap-2">
            {intel!.content_pillars.map((p: string, i: number) => (
              <span key={i} className="flex items-center gap-2 text-sm">
                <span className="flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-primary text-[10px] font-bold text-white">
                  {i + 1}
                </span>
                <span className="font-medium">{p}</span>
              </span>
            ))}
          </div>
        </div>
      )}

      {/* ── Intelligence Grid ── */}
      {hasIntel && (
        <div className="grid gap-10 lg:grid-cols-3">

          {/* Competitors */}
          <div className="space-y-4">
            <SectionHeading icon={BarChart2} title="Competitors" />
            {competitors.length === 0 ? (
              <p className="text-sm text-muted-foreground">No competitors identified.</p>
            ) : (
              <div className="space-y-5">
                {competitors.map((c: any) => (
                  <div key={c.id}>
                    <div className="flex items-start gap-2">
                      <div className="min-w-0 flex-1">
                        <p className="text-sm font-semibold">{c.name}</p>
                        {c.website && (
                          <a
                            href={c.website.startsWith("http") ? c.website : `https://${c.website}`}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="flex items-center gap-1 text-[11px] text-primary hover:underline"
                          >
                            {c.website.replace(/^https?:\/\//, "")}
                            <ExternalLink className="h-2.5 w-2.5" />
                          </a>
                        )}
                      </div>
                    </div>
                    {c.description && (
                      <p className="mt-1 text-xs text-muted-foreground line-clamp-2">{c.description}</p>
                    )}
                    {(c.strengths?.length > 0 || c.weaknesses?.length > 0) && (
                      <div className="mt-2 flex flex-wrap gap-1.5">
                        {c.strengths?.slice(0, 2).map((s: string, i: number) => (
                          <span key={i} className="text-[11px] text-emerald-700 bg-emerald-50 rounded-full px-2 py-0.5">↑ {s}</span>
                        ))}
                        {c.weaknesses?.slice(0, 1).map((w: string, i: number) => (
                          <span key={i} className="text-[11px] text-red-600 bg-red-50 rounded-full px-2 py-0.5">↓ {w}</span>
                        ))}
                      </div>
                    )}
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Keywords */}
          <div className="space-y-4">
            <SectionHeading icon={Tag} title="Target Keywords" />
            {allKeywords.length === 0 && primaryTopics.length === 0 ? (
              <p className="text-sm text-muted-foreground">No keywords identified.</p>
            ) : (
              <div className="space-y-5">
                {primaryTopics.length > 0 && (
                  <div>
                    <p className="mb-2 text-[10px] font-semibold uppercase tracking-widest text-muted-foreground/50">Primary Topics</p>
                    <div className="flex flex-wrap gap-1.5">
                      {primaryTopics.map((t: string, i: number) => (
                        <span key={i} className="text-[11px] font-medium text-primary bg-primary/8 rounded-full px-2.5 py-1">
                          {t}
                        </span>
                      ))}
                    </div>
                  </div>
                )}
                {allKeywords.length > 0 && (
                  <div>
                    <p className="mb-2 text-[10px] font-semibold uppercase tracking-widest text-muted-foreground/50">SEO Keywords</p>
                    <div className="flex flex-wrap gap-1.5">
                      {allKeywords.map((kw: string, i: number) => (
                        <span key={i} className="text-[11px] text-foreground bg-muted rounded-full px-2.5 py-1">
                          {kw}
                        </span>
                      ))}
                    </div>
                  </div>
                )}
                {suggestedTags.length > 0 && (
                  <div>
                    <p className="mb-2 text-[10px] font-semibold uppercase tracking-widest text-muted-foreground/50">Suggested Tags</p>
                    <div className="flex flex-wrap gap-1.5">
                      {suggestedTags.slice(0, 8).map((t: string, i: number) => (
                        <span key={i} className="text-[11px] text-violet-700 bg-violet-50 rounded-full px-2.5 py-1">
                          #{t}
                        </span>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            )}
          </div>

          {/* Content Opportunities */}
          <div className="space-y-4">
            <SectionHeading icon={Lightbulb} title="Content Opportunities" />
            {opportunities.length === 0 ? (
              <p className="text-sm text-muted-foreground">No opportunities identified.</p>
            ) : (
              <div className="space-y-5">
                {opportunities.map((opp: any) => {
                  const pcfg = PRIORITY_CFG[opp.priority] ?? PRIORITY_CFG.medium;
                  return (
                    <div key={opp.id}>
                      <div className="flex items-start gap-2">
                        <p className="text-sm font-semibold flex-1 leading-snug">{opp.title}</p>
                        <span className={cn("text-[11px] font-medium shrink-0", pcfg.class)}>{pcfg.label}</span>
                      </div>
                      {opp.topic && (
                        <p className="mt-0.5 text-[11px] text-primary font-medium">{opp.type} · {opp.topic}</p>
                      )}
                      {opp.reason && (
                        <p className="mt-1 text-[11px] text-muted-foreground line-clamp-2">{opp.reason}</p>
                      )}
                      <div className="mt-2 flex items-center gap-3">
                        <button
                          type="button"
                          onClick={() => { setSelectedOpportunity(opp); setGenerateDialogOpen(true); }}
                          className="inline-flex items-center gap-1 rounded-md bg-primary px-2 py-1 text-[11px] font-semibold text-white hover:bg-primary/90 transition-colors"
                        >
                          <Sparkles className="h-2.5 w-2.5" /> Generate Blog
                        </button>
                        <Link
                          to="/admin/workspaces/$id/blogs/new"
                          params={{ id }}
                          className="inline-flex items-center gap-1 text-[11px] font-medium text-muted-foreground hover:text-primary transition-colors"
                        >
                          Write manually <ChevronRight className="h-2.5 w-2.5" />
                        </Link>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </div>
      )}

      {/* ── Main Grid: Posts + Activity ── */}
      <div className="grid gap-12 lg:grid-cols-[1fr_260px]">

        {/* Left: Posts + Quick Actions */}
        <div className="space-y-10">

          {/* Recent Posts */}
          <div className="space-y-4">
            <SectionHeading
              icon={Eye}
              title="Recent Posts"
              action={
                <Link to={`${base}/blogs`} className="flex items-center gap-1 text-xs text-primary font-medium hover:underline">
                  View all <ArrowRight className="h-3 w-3" />
                </Link>
              }
            />
            {recentPosts.length === 0 ? (
              <div className="py-10 text-center space-y-2">
                <FileText className="mx-auto h-7 w-7 text-muted-foreground/25" />
                <p className="text-sm text-muted-foreground">No posts yet — create your first.</p>
                <Link
                  to="/admin/workspaces/$id/blogs/new"
                  params={{ id }}
                  className="inline-flex items-center gap-1.5 rounded-lg bg-primary px-3 py-1.5 text-xs font-semibold text-white hover:bg-primary/90 transition-colors mt-1"
                >
                  <Plus className="h-3 w-3" /> Write first post
                </Link>
              </div>
            ) : (
              <div className="divide-y divide-border/60">
                {recentPosts.map((post: any) => (
                  <div key={post.id} className="flex items-center gap-3 py-2.5 hover:opacity-80 transition-opacity">
                    <Link
                      to="/admin/workspaces/$id/blogs/$postId"
                      params={{ id, postId: post.id }}
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

          {/* Recent News — only when data exists */}
          {(recentNews as any[]).length > 0 && (
            <div className="space-y-4">
              <SectionHeading
                icon={Newspaper}
                title="Recent News"
                action={<Link to={`${base}/news`} className="flex items-center gap-1 text-xs text-primary font-medium hover:underline">View all <ArrowRight className="h-3 w-3" /></Link>}
              />
              <div className="divide-y divide-border/60">
                {(recentNews as any[]).map((item) => (
                  <div key={item.id} className="flex items-center gap-3 py-2.5 hover:opacity-80 transition-opacity">
                    <Link to="/admin/workspaces/$id/news/$newsId" params={{ id, newsId: item.id }}
                      className="min-w-0 flex-1 truncate text-sm font-medium hover:text-primary transition-colors">
                      {item.title || "Untitled"}
                    </Link>
                    <StatusBadge status={item.status} />
                    <span className="shrink-0 text-xs text-muted-foreground hidden sm:block">{fmtDate(item.updated_at)}</span>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Recent Articles — only when data exists */}
          {(recentArticles as any[]).length > 0 && (
            <div className="space-y-4">
              <SectionHeading
                icon={BookOpen}
                title="Recent Articles"
                action={<Link to={`${base}/articles`} className="flex items-center gap-1 text-xs text-primary font-medium hover:underline">View all <ArrowRight className="h-3 w-3" /></Link>}
              />
              <div className="divide-y divide-border/60">
                {(recentArticles as any[]).map((item) => (
                  <div key={item.id} className="flex items-center gap-3 py-2.5 hover:opacity-80 transition-opacity">
                    <Link to="/admin/workspaces/$id/articles/$articleId" params={{ id, articleId: item.id }}
                      className="min-w-0 flex-1 truncate text-sm font-medium hover:text-primary transition-colors">
                      {item.title || "Untitled"}
                    </Link>
                    <StatusBadge status={item.status} />
                    <span className="shrink-0 text-xs text-muted-foreground hidden sm:block">{fmtDate(item.updated_at)}</span>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Recent FAQs — only when data exists */}
          {(recentFaqs as any[]).length > 0 && (
            <div className="space-y-4">
              <SectionHeading
                icon={HelpCircle}
                title="Recent FAQs"
                action={<Link to={`${base}/faqs`} className="flex items-center gap-1 text-xs text-primary font-medium hover:underline">View all <ArrowRight className="h-3 w-3" /></Link>}
              />
              <div className="divide-y divide-border/60">
                {(recentFaqs as any[]).map((item) => (
                  <div key={item.id} className="flex items-center gap-3 py-2.5 hover:opacity-80 transition-opacity">
                    <Link to="/admin/workspaces/$id/faqs/$faqId" params={{ id, faqId: item.id }}
                      className="min-w-0 flex-1 truncate text-sm font-medium hover:text-primary transition-colors">
                      {item.question || "Untitled"}
                    </Link>
                    <StatusBadge status={item.status} />
                    <span className="shrink-0 text-xs text-muted-foreground hidden sm:block">{fmtDate(item.updated_at)}</span>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Recent Products — only when data exists */}
          {(recentProducts as any[]).length > 0 && (
            <div className="space-y-4">
              <SectionHeading
                icon={Package}
                title="Recent Products"
                action={<Link to={`${base}/products`} className="flex items-center gap-1 text-xs text-primary font-medium hover:underline">View all <ArrowRight className="h-3 w-3" /></Link>}
              />
              <div className="divide-y divide-border/60">
                {(recentProducts as any[]).map((item) => (
                  <div key={item.id} className="flex items-center gap-3 py-2.5 hover:opacity-80 transition-opacity">
                    <Link to="/admin/workspaces/$id/products/$productId" params={{ id, productId: item.id }}
                      className="min-w-0 flex-1 truncate text-sm font-medium hover:text-primary transition-colors">
                      {item.name || "Untitled"}
                    </Link>
                    <StatusBadge status={item.status} />
                    <span className="shrink-0 text-xs text-muted-foreground hidden sm:block">{fmtDate(item.updated_at)}</span>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Quick Actions */}
          <div className="space-y-4">
            <SectionHeading icon={Zap} title="Quick Actions" />
            <div className="grid gap-0 sm:grid-cols-2 lg:grid-cols-3 divide-y sm:divide-y-0">
              {QUICK_ACTIONS.map((a) => (
                <Link
                  key={a.to}
                  to={a.to}
                  className="flex items-center gap-3 py-3 pr-3 hover:opacity-70 transition-opacity group"
                >
                  <span className={cn(
                    "flex h-7 w-7 shrink-0 items-center justify-center rounded-lg",
                    a.primary ? "bg-primary text-white" : "bg-muted text-muted-foreground",
                  )}>
                    <a.icon className="h-3.5 w-3.5" />
                  </span>
                  <div className="min-w-0">
                    <p className={cn("text-sm font-semibold leading-tight", a.primary && "text-primary")}>{a.label}</p>
                    <p className="text-xs text-muted-foreground truncate">{a.desc}</p>
                  </div>
                </Link>
              ))}
            </div>
          </div>
        </div>

        {/* Right: Activity */}
        <div className="space-y-4">
          <SectionHeading icon={Activity} title="Activity" />
          {recentActivity.length === 0 ? (
            <p className="text-sm text-muted-foreground">No activity yet.</p>
          ) : (
            <div className="space-y-4">
              {recentActivity.map((entry: any) => (
                <div key={entry.id} className="flex items-start gap-3">
                  <span className="mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-muted">
                    <Activity className="h-2.5 w-2.5 text-muted-foreground" />
                  </span>
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
    </>
  );
}
