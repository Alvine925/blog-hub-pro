import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { queryOptions, useSuspenseQuery, useQueryClient, useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { useState, useMemo } from "react";
import { toast } from "sonner";
import { Plus, Pencil, Trash2, Send, Eye, Clock, BookOpen, Heart, MessageSquare } from "lucide-react";
import {
  adminListArticles, deleteArticle, setArticleStatus,
  type ArticleSummary,
} from "@/lib/article.functions";
import { getBatchContentEngagementStats } from "@/lib/engagement.functions";
import { cn } from "@/lib/utils";
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
} from "@/components/ui/alert-dialog";

// ── Queries ───────────────────────────────────────────────────────────────────
const listQuery = (workspaceId: string) =>
  queryOptions({
    queryKey: ["admin", "articles", workspaceId],
    queryFn: () => adminListArticles({ data: { workspaceId } }),
  });

export const Route = createFileRoute("/admin/workspaces/$id/articles/")({
  loader: ({ context, params }) =>
    context.queryClient.ensureQueryData(listQuery(params.id)),
  component: WorkspaceArticles,
  errorComponent: ({ error }) => (
    <p className="p-8 text-sm text-red-600">{error.message}</p>
  ),
});

const STATUS_STYLE: Record<string, string> = {
  published: "text-emerald-600",
  draft:     "text-muted-foreground",
  scheduled: "text-amber-600",
};

const TYPE_LABEL: Record<string, string> = {
  guide:         "Guide",
  tutorial:      "Tutorial",
  "case-study":  "Case Study",
  documentation: "Docs",
  educational:   "Educational",
};

function fmtDate(d: string | null) {
  if (!d) return "—";
  return new Date(d).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" });
}

// ── Component ─────────────────────────────────────────────────────────────────
function WorkspaceArticles() {
  const { id: workspaceId } = Route.useParams();
  const { data: articles }  = useSuspenseQuery(listQuery(workspaceId));
  const queryClient         = useQueryClient();
  const navigate            = useNavigate();
  const doDelete            = useServerFn(deleteArticle);
  const doStatus            = useServerFn(setArticleStatus);
  const [pending, setPending] = useState<ArticleSummary | null>(null);
  const [busy, setBusy]       = useState(false);

  // Batch engagement stats — one request for all items, no N+1
  const articleIds = useMemo(() => articles.map((a) => a.id), [articles]);
  const doGetBatchStats = useServerFn(getBatchContentEngagementStats);
  const { data: batchStats } = useQuery({
    queryKey: ["batch-engagement-stats", "articles", workspaceId, articleIds.join(",")],
    queryFn: () => doGetBatchStats({ data: { workspaceId, contentType: "articles", ids: articleIds } }),
    enabled: articleIds.length > 0,
    staleTime: 60_000,
  });

  async function handleDelete() {
    if (!pending) return;
    setBusy(true);
    try {
      await doDelete({ data: { id: pending.id, workspaceId } });
      toast.success("Article deleted");
      setPending(null);
      await queryClient.invalidateQueries({ queryKey: ["admin", "articles", workspaceId] });
    } catch (e) { toast.error(e instanceof Error ? e.message : "Failed"); }
    finally { setBusy(false); }
  }

  async function togglePublish(a: ArticleSummary) {
    const next = a.status === "published" ? "draft" : "published";
    try {
      await doStatus({ data: { id: a.id, workspaceId, status: next } });
      toast.success(`Article ${next}`);
      await queryClient.invalidateQueries({ queryKey: ["admin", "articles", workspaceId] });
    } catch (e) { toast.error(e instanceof Error ? e.message : "Failed"); }
  }

  return (
    <div className="min-h-full px-8 py-8">
      {/* Header */}
      <div className="mb-8 flex items-center justify-between">
        <div>
          <h1 className="text-xl font-semibold">Articles</h1>
          <p className="mt-0.5 text-sm text-muted-foreground">{articles.length} articles total</p>
        </div>
        <Link
          to="/admin/workspaces/$id/articles/new"
          params={{ id: workspaceId }}
          className="flex items-center gap-1.5 rounded-md bg-primary px-3 py-1.5 text-sm font-medium text-primary-foreground hover:bg-primary/90 transition-colors"
        >
          <Plus className="h-3.5 w-3.5" /> New Article
        </Link>
      </div>

      {/* Table */}
      {articles.length === 0 ? (
        <div className="flex flex-col items-center gap-3 py-20 border-y border-border text-center">
          <BookOpen className="h-8 w-8 text-muted-foreground/40" />
          <p className="text-sm text-muted-foreground">No articles yet.</p>
          <Link
            to="/admin/workspaces/$id/articles/new"
            params={{ id: workspaceId }}
            className="flex items-center gap-1.5 text-sm font-medium text-primary hover:underline"
          >
            <Plus className="h-3.5 w-3.5" /> Write your first article
          </Link>
        </div>
      ) : (
        <div>
          {/* Column headers */}
          <div className="flex items-center gap-3 border-b border-border pb-2 text-[10px] font-semibold uppercase tracking-widest text-muted-foreground/60">
            <span className="flex-1">Title</span>
            <span className="w-20 shrink-0 hidden sm:block">Status</span>
            <span className="w-24 shrink-0 hidden md:block">Type</span>
            <span className="w-24 shrink-0 hidden lg:block">Published</span>
            <span className="w-16 shrink-0 hidden xl:flex items-center justify-end gap-1">Views</span>
            <span className="w-20 shrink-0 text-right">Actions</span>
          </div>

          {articles.map((article) => (
            <div
              key={article.id}
              onClick={() =>
                navigate({
                  to: "/admin/workspaces/$id/articles/$articleId",
                  params: { id: workspaceId, articleId: article.id },
                })
              }
              className="group flex items-center gap-3 border-b border-border py-3 last:border-0 cursor-pointer hover:bg-muted/30 -mx-2 px-2 rounded-lg transition-colors"
            >
              {/* Title */}
              <div className="flex-1 min-w-0">
                <p className="truncate text-sm font-medium group-hover:text-primary transition-colors">
                  {article.title || "Untitled"}
                </p>
                {article.category && (
                  <span className="text-xs text-muted-foreground">{article.category}</span>
                )}
                <div className="mt-0.5 flex items-center gap-3 text-[10px] text-muted-foreground/60">
                  <span className="flex items-center gap-0.5">
                    <Eye className="h-2.5 w-2.5" />
                    {(batchStats?.[article.id]?.views ?? article.views ?? 0).toLocaleString()}
                  </span>
                  <span className="flex items-center gap-0.5">
                    <Heart className="h-2.5 w-2.5" />
                    {(batchStats?.[article.id]?.likes ?? 0).toLocaleString()}
                  </span>
                  <span className="flex items-center gap-0.5">
                    <MessageSquare className="h-2.5 w-2.5" />
                    {(batchStats?.[article.id]?.comments ?? 0).toLocaleString()}
                  </span>
                </div>
              </div>

              {/* Status */}
              <span className={cn("w-20 shrink-0 text-xs hidden sm:block capitalize", STATUS_STYLE[article.status])}>
                {article.status === "scheduled" && <Clock className="inline mr-1 h-3 w-3" />}
                {article.status}
              </span>

              {/* Type */}
              <span className="w-24 shrink-0 text-xs text-muted-foreground hidden md:block">
                {TYPE_LABEL[article.article_type] ?? article.article_type}
              </span>

              {/* Published date */}
              <span className="w-24 shrink-0 text-xs text-muted-foreground hidden lg:block">
                {fmtDate(article.published_at)}
              </span>

              {/* Views */}
              <span className="w-16 shrink-0 text-right text-xs tabular-nums text-muted-foreground hidden xl:flex items-center justify-end gap-1">
                <Eye className="h-3 w-3" />{article.views.toLocaleString()}
              </span>

              {/* Actions */}
              <div
                className="w-20 shrink-0 flex items-center justify-end gap-1 opacity-0 group-hover:opacity-100 transition-opacity"
                onClick={(e) => e.stopPropagation()}
              >
                <Link
                  to="/admin/workspaces/$id/articles/$articleId/edit"
                  params={{ id: workspaceId, articleId: article.id }}
                  className="flex h-7 w-7 items-center justify-center rounded text-muted-foreground hover:text-foreground hover:bg-muted transition-colors"
                  title="Edit"
                >
                  <Pencil className="h-3.5 w-3.5" />
                </Link>
                <button
                  type="button"
                  onClick={() => togglePublish(article)}
                  className="flex h-7 w-7 items-center justify-center rounded text-muted-foreground hover:text-emerald-600 hover:bg-emerald-50 transition-colors"
                  title={article.status === "published" ? "Unpublish" : "Publish"}
                >
                  <Send className="h-3.5 w-3.5" />
                </button>
                <button
                  type="button"
                  onClick={() => setPending(article)}
                  className="flex h-7 w-7 items-center justify-center rounded text-muted-foreground hover:text-red-600 hover:bg-red-50 transition-colors"
                  title="Delete"
                >
                  <Trash2 className="h-3.5 w-3.5" />
                </button>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Delete dialog */}
      <AlertDialog open={!!pending} onOpenChange={(o) => !o && setPending(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete "{pending?.title || "this article"}"?</AlertDialogTitle>
            <AlertDialogDescription>This action cannot be undone.</AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleDelete}
              disabled={busy}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
