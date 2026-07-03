import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { queryOptions, useSuspenseQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { useState } from "react";
import { toast } from "sonner";
import { ArrowLeft, Pencil, Trash2, Send, Clock, Eye, Tag } from "lucide-react";
import { adminGetArticle, deleteArticle, setArticleStatus, type Article } from "@/lib/article.functions";
import { cn } from "@/lib/utils";
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
} from "@/components/ui/alert-dialog";

const detailQuery = (id: string, workspaceId: string) =>
  queryOptions({
    queryKey: ["admin", "article", id, workspaceId],
    queryFn: () => adminGetArticle({ data: { id, workspaceId } }),
  });

export const Route = createFileRoute("/admin/workspaces/$id/articles/$articleId/")({
  loader: ({ context, params }) =>
    context.queryClient.ensureQueryData(detailQuery(params.articleId, params.id)),
  component: ArticleDetail,
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
  documentation: "Documentation",
  educational:   "Educational",
};

function fmtDate(d: string | null) {
  if (!d) return "—";
  return new Date(d).toLocaleDateString("en-US", { month: "long", day: "numeric", year: "numeric" });
}

function ArticleDetail() {
  const { id: workspaceId, articleId } = Route.useParams();
  const { data: article } = useSuspenseQuery(detailQuery(articleId, workspaceId));
  const queryClient = useQueryClient();
  const navigate    = useNavigate();
  const doDelete    = useServerFn(deleteArticle);
  const doStatus    = useServerFn(setArticleStatus);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [busy, setBusy] = useState(false);

  async function handleDelete() {
    setBusy(true);
    try {
      await doDelete({ data: { id: articleId, workspaceId } });
      toast.success("Article deleted");
      await queryClient.invalidateQueries({ queryKey: ["admin", "articles", workspaceId] });
      navigate({ to: "/admin/workspaces/$id/articles", params: { id: workspaceId } });
    } catch (e) { toast.error(e instanceof Error ? e.message : "Failed"); }
    finally { setBusy(false); }
  }

  async function togglePublish() {
    const next = article.status === "published" ? "draft" : "published";
    try {
      await doStatus({ data: { id: articleId, workspaceId, status: next } });
      toast.success(`Article ${next}`);
      await queryClient.invalidateQueries({ queryKey: ["admin", "article", articleId, workspaceId] });
      await queryClient.invalidateQueries({ queryKey: ["admin", "articles", workspaceId] });
    } catch (e) { toast.error(e instanceof Error ? e.message : "Failed"); }
  }

  return (
    <div className="min-h-full px-8 py-8 max-w-4xl">
      {/* Back */}
      <Link
        to="/admin/workspaces/$id/articles"
        params={{ id: workspaceId }}
        className="inline-flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground transition-colors mb-6"
      >
        <ArrowLeft className="h-3.5 w-3.5" /> Articles
      </Link>

      {/* Header */}
      <div className="flex items-start justify-between gap-4">
        <div className="min-w-0">
          <h1 className="text-2xl font-bold tracking-tight">{article.title || "Untitled"}</h1>
          <div className="mt-1 flex items-center gap-3 text-sm text-muted-foreground flex-wrap">
            <span className={cn("capitalize font-medium", STATUS_STYLE[article.status])}>
              {article.status}
            </span>
            <span>· {TYPE_LABEL[article.article_type] ?? article.article_type}</span>
            {article.category && <span>· {article.category}</span>}
            <span className="flex items-center gap-1">
              · <Clock className="h-3.5 w-3.5" /> {article.reading_time} min read
            </span>
            <span className="flex items-center gap-1">
              · <Eye className="h-3.5 w-3.5" /> {article.views.toLocaleString()} views
            </span>
          </div>
        </div>
        <div className="flex shrink-0 items-center gap-2">
          <button
            type="button"
            onClick={togglePublish}
            className="flex items-center gap-1.5 rounded-md border border-border px-3 py-1.5 text-sm font-medium hover:bg-muted transition-colors"
          >
            <Send className="h-3.5 w-3.5" />
            {article.status === "published" ? "Unpublish" : "Publish"}
          </button>
          <Link
            to="/admin/workspaces/$id/articles/$articleId/edit"
            params={{ id: workspaceId, articleId }}
            className="flex items-center gap-1.5 rounded-md bg-primary px-3 py-1.5 text-sm font-medium text-primary-foreground hover:bg-primary/90 transition-colors"
          >
            <Pencil className="h-3.5 w-3.5" /> Edit
          </Link>
          <button
            type="button"
            onClick={() => setConfirmDelete(true)}
            className="flex h-8 w-8 items-center justify-center rounded-md border border-border text-muted-foreground hover:text-red-600 hover:border-red-300 transition-colors"
          >
            <Trash2 className="h-3.5 w-3.5" />
          </button>
        </div>
      </div>

      {/* Cover image */}
      {article.cover_image && (
        <div className="mt-6">
          <img
            src={article.cover_image}
            alt={article.title}
            className="w-full max-h-64 rounded-lg object-cover border border-border"
          />
        </div>
      )}

      {/* Meta */}
      <div className="mt-6 border-y border-border py-4 flex flex-wrap gap-6 text-sm text-muted-foreground">
        <div>
          <span className="text-xs font-semibold uppercase tracking-wider text-muted-foreground/60 block mb-0.5">Author</span>
          {article.author_name}
        </div>
        <div>
          <span className="text-xs font-semibold uppercase tracking-wider text-muted-foreground/60 block mb-0.5">Published</span>
          {fmtDate(article.published_at)}
        </div>
        {article.word_count && (
          <div>
            <span className="text-xs font-semibold uppercase tracking-wider text-muted-foreground/60 block mb-0.5">Word Count</span>
            {article.word_count.toLocaleString()}
          </div>
        )}
      </div>

      {/* Excerpt */}
      {article.excerpt && (
        <div className="mt-6 border-b border-border pb-6">
          <h2 className="mb-2 text-xs font-semibold uppercase tracking-wider text-muted-foreground/60">Excerpt</h2>
          <p className="text-sm leading-relaxed text-muted-foreground italic">{article.excerpt}</p>
        </div>
      )}

      {/* Content */}
      {article.content && (
        <div className="mt-6 border-b border-border pb-6">
          <div
            className="prose prose-sm max-w-none"
            dangerouslySetInnerHTML={{ __html: article.content }}
          />
        </div>
      )}

      {/* Tags */}
      {article.tags && article.tags.length > 0 && (
        <div className="mt-6">
          <h2 className="mb-2 text-xs font-semibold uppercase tracking-wider text-muted-foreground/60">Tags</h2>
          <div className="flex flex-wrap gap-1.5">
            {article.tags.map((tag) => (
              <span key={tag} className="inline-flex items-center gap-1 rounded-full bg-muted px-2.5 py-0.5 text-xs">
                <Tag className="h-3 w-3" />{tag}
              </span>
            ))}
          </div>
        </div>
      )}

      <AlertDialog open={confirmDelete} onOpenChange={setConfirmDelete}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete "{article.title}"?</AlertDialogTitle>
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
