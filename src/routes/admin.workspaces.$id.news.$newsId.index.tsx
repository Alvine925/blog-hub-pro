import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { queryOptions, useSuspenseQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { toast } from "sonner";
import { ArrowLeft, Pencil, Trash2, Send, ExternalLink, AlertTriangle, Star, Eye, Heart, MessageSquare, Share2 } from "lucide-react";
import { adminGetNews, deleteNews, setNewsStatus, type NewsItem } from "@/lib/news.functions";
import { getContentEngagementStats } from "@/lib/engagement.functions";
import { useQuery } from "@tanstack/react-query";
import { cn } from "@/lib/utils";
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
} from "@/components/ui/alert-dialog";

const detailQuery = (id: string, workspaceId: string) =>
  queryOptions({
    queryKey: ["admin", "news", id, workspaceId],
    queryFn:  () => adminGetNews({ data: { id, workspaceId } }),
  });

export const Route = createFileRoute("/admin/workspaces/$id/news/$newsId/")({
  loader: ({ context, params }) =>
    context.queryClient.ensureQueryData(detailQuery(params.newsId, params.id)),
  component: NewsDetail,
  errorComponent: ({ error }) => <p className="p-8 text-sm text-red-600">{error.message}</p>,
});

const STATUS_STYLE: Record<string, string> = {
  published: "text-emerald-600",
  draft:     "text-muted-foreground",
  scheduled: "text-amber-600",
};

function fmtDate(d: string | null) {
  if (!d) return "—";
  return new Date(d).toLocaleDateString("en-US", { month: "long", day: "numeric", year: "numeric" });
}

function StatPill({ icon: Icon, label, value }: { icon: React.ElementType; label: string; value: number }) {
  return (
    <div className="flex items-center gap-1.5 rounded-lg border border-border bg-muted/40 px-3 py-2">
      <Icon className="h-3.5 w-3.5 text-muted-foreground shrink-0" />
      <div>
        <p className="text-xs font-semibold tabular-nums">{value.toLocaleString()}</p>
        <p className="text-[10px] text-muted-foreground">{label}</p>
      </div>
    </div>
  );
}

function NewsDetail() {
  const { id: workspaceId, newsId } = Route.useParams();
  const { data: item }  = useSuspenseQuery(detailQuery(newsId, workspaceId));
  const doGetStats      = useServerFn(getContentEngagementStats);
  const { data: stats } = useQuery({
    queryKey: ["content-engagement-stats", "news", newsId],
    queryFn:  () => doGetStats({ data: { workspaceId, contentType: "news", contentId: newsId } }),
    staleTime: 60_000,
  });
  const queryClient     = useQueryClient();
  const navigate        = useNavigate();
  const doDelete        = useServerFn(deleteNews);
  const doStatus        = useServerFn(setNewsStatus);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [busy, setBusy] = useState(false);

  async function handleDelete() {
    setBusy(true);
    try {
      await doDelete({ data: { id: newsId, workspaceId } });
      toast.success("News item deleted");
      await queryClient.invalidateQueries({ queryKey: ["admin", "news", workspaceId] });
      navigate({ to: "/admin/workspaces/$id/news", params: { id: workspaceId } });
    } catch (e) { toast.error(e instanceof Error ? e.message : "Failed"); }
    finally { setBusy(false); }
  }

  async function togglePublish() {
    const next = item.status === "published" ? "draft" : "published";
    try {
      await doStatus({ data: { id: newsId, workspaceId, status: next } });
      toast.success(`News item ${next}`);
      await queryClient.invalidateQueries({ queryKey: ["admin", "news", newsId, workspaceId] });
      await queryClient.invalidateQueries({ queryKey: ["admin", "news", workspaceId] });
    } catch (e) { toast.error(e instanceof Error ? e.message : "Failed"); }
  }

  return (
    <div className="min-h-full px-8 py-8 max-w-4xl">
      <Link
        to="/admin/workspaces/$id/news"
        params={{ id: workspaceId }}
        className="inline-flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground transition-colors mb-6"
      >
        <ArrowLeft className="h-3.5 w-3.5" /> News
      </Link>

      <div className="flex items-start justify-between gap-4">
        <div className="min-w-0">
          <div className="flex items-center gap-2 flex-wrap mb-1">
            {item.breaking && (
              <span className="inline-flex items-center gap-1 rounded-full bg-red-100 px-2 py-0.5 text-xs font-semibold text-red-700">
                <AlertTriangle className="h-3 w-3" /> Breaking
              </span>
            )}
            {item.featured && (
              <span className="inline-flex items-center gap-1 rounded-full bg-amber-100 px-2 py-0.5 text-xs font-semibold text-amber-700">
                <Star className="h-3 w-3" /> Featured
              </span>
            )}
          </div>
          <h1 className="text-2xl font-bold tracking-tight">{item.title || "Untitled"}</h1>
          <div className="mt-1 flex items-center gap-3 text-sm text-muted-foreground flex-wrap">
            <span className={cn("capitalize font-medium", STATUS_STYLE[item.status])}>{item.status}</span>
            {item.category && <span>· {item.category}</span>}
            <span>· {item.views.toLocaleString()} views</span>
          </div>
        </div>
        <div className="flex shrink-0 items-center gap-2">
          <button
            type="button" onClick={togglePublish}
            className="flex items-center gap-1.5 rounded-md border border-border px-3 py-1.5 text-sm font-medium hover:bg-muted transition-colors"
          >
            <Send className="h-3.5 w-3.5" />
            {item.status === "published" ? "Unpublish" : "Publish"}
          </button>
          <Link
            to="/admin/workspaces/$id/news/$newsId/edit"
            params={{ id: workspaceId, newsId }}
            className="flex items-center gap-1.5 rounded-md bg-primary px-3 py-1.5 text-sm font-medium text-primary-foreground hover:bg-primary/90 transition-colors"
          >
            <Pencil className="h-3.5 w-3.5" /> Edit
          </Link>
          <button
            type="button" onClick={() => setConfirmDelete(true)}
            className="flex h-8 w-8 items-center justify-center rounded-md border border-border text-muted-foreground hover:text-red-600 hover:border-red-300 transition-colors"
          >
            <Trash2 className="h-3.5 w-3.5" />
          </button>
        </div>
      </div>

      {item.cover_image && (
        <div className="mt-6">
          <img src={item.cover_image} alt={item.title} className="w-full max-h-64 rounded-lg object-cover border border-border" />
        </div>
      )}

      <div className="mt-6 border-y border-border py-4 flex flex-wrap gap-6 text-sm text-muted-foreground">
        <div>
          <span className="text-xs font-semibold uppercase tracking-wider text-muted-foreground/60 block mb-0.5">Published</span>
          {fmtDate(item.published_at)}
        </div>
        {item.expires_at && (
          <div>
            <span className="text-xs font-semibold uppercase tracking-wider text-muted-foreground/60 block mb-0.5">Expires</span>
            {fmtDate(item.expires_at)}
          </div>
        )}
        {item.source_name && (
          <div>
            <span className="text-xs font-semibold uppercase tracking-wider text-muted-foreground/60 block mb-0.5">Source</span>
            <span className="flex items-center gap-1">
              {item.source_name}
              {item.source_url && (
                <a href={item.source_url} target="_blank" rel="noreferrer" className="text-primary hover:underline">
                  <ExternalLink className="h-3 w-3" />
                </a>
              )}
            </span>
          </div>
        )}
      </div>

      {/* Engagement stats */}
      {stats && (
        <div className="mt-6 grid grid-cols-4 gap-2">
          <StatPill icon={Eye}          label="Views"    value={stats.views}    />
          <StatPill icon={Heart}        label="Likes"    value={stats.likes}    />
          <StatPill icon={MessageSquare} label="Comments" value={stats.comments} />
          <StatPill icon={Share2}       label="Shares"   value={stats.shares}   />
        </div>
      )}

      {item.excerpt && (
        <div className="mt-6 border-b border-border pb-6">
          <h2 className="mb-2 text-xs font-semibold uppercase tracking-wider text-muted-foreground/60">Excerpt</h2>
          <p className="text-sm leading-relaxed text-muted-foreground italic">{item.excerpt}</p>
        </div>
      )}

      {item.content && (
        <div className="mt-6">
          <div className="prose prose-sm max-w-none" dangerouslySetInnerHTML={{ __html: item.content }} />
        </div>
      )}

      <AlertDialog open={confirmDelete} onOpenChange={setConfirmDelete}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete "{item.title}"?</AlertDialogTitle>
            <AlertDialogDescription>This action cannot be undone.</AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={handleDelete} disabled={busy} className="bg-destructive text-destructive-foreground hover:bg-destructive/90">
              Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
