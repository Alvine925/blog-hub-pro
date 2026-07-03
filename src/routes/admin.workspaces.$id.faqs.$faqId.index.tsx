import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { queryOptions, useSuspenseQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { useState } from "react";
import { toast } from "sonner";
import { ArrowLeft, Pencil, Trash2, Send, Star } from "lucide-react";
import { adminGetFaq, deleteFaq, setFaqStatus, type Faq } from "@/lib/faq.functions";
import { cn } from "@/lib/utils";
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
} from "@/components/ui/alert-dialog";

const detailQuery = (id: string, workspaceId: string) =>
  queryOptions({
    queryKey: ["admin", "faq", id, workspaceId],
    queryFn:  () => adminGetFaq({ data: { id, workspaceId } }),
  });

export const Route = createFileRoute("/admin/workspaces/$id/faqs/$faqId/")({
  loader: ({ context, params }) =>
    context.queryClient.ensureQueryData(detailQuery(params.faqId, params.id)),
  component: FaqDetail,
  errorComponent: ({ error }) => <p className="p-8 text-sm text-red-600">{error.message}</p>,
});

const STATUS_STYLE: Record<string, string> = {
  published: "text-emerald-600",
  draft:     "text-muted-foreground",
};

function FaqDetail() {
  const { id: workspaceId, faqId } = Route.useParams();
  const { data: faq }  = useSuspenseQuery(detailQuery(faqId, workspaceId));
  const queryClient    = useQueryClient();
  const navigate       = useNavigate();
  const doDelete       = useServerFn(deleteFaq);
  const doStatus       = useServerFn(setFaqStatus);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [busy, setBusy] = useState(false);

  async function handleDelete() {
    setBusy(true);
    try {
      await doDelete({ data: { id: faqId, workspaceId } });
      toast.success("FAQ deleted");
      await queryClient.invalidateQueries({ queryKey: ["admin", "faqs", workspaceId] });
      navigate({ to: "/admin/workspaces/$id/faqs", params: { id: workspaceId } });
    } catch (e) { toast.error(e instanceof Error ? e.message : "Failed"); }
    finally { setBusy(false); }
  }

  async function togglePublish() {
    const next = faq.status === "published" ? "draft" : "published";
    try {
      await doStatus({ data: { id: faqId, workspaceId, status: next } });
      toast.success(`FAQ ${next}`);
      await queryClient.invalidateQueries({ queryKey: ["admin", "faq", faqId, workspaceId] });
      await queryClient.invalidateQueries({ queryKey: ["admin", "faqs", workspaceId] });
    } catch (e) { toast.error(e instanceof Error ? e.message : "Failed"); }
  }

  return (
    <div className="min-h-full px-8 py-8 max-w-4xl">
      <Link
        to="/admin/workspaces/$id/faqs"
        params={{ id: workspaceId }}
        className="inline-flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground transition-colors mb-6"
      >
        <ArrowLeft className="h-3.5 w-3.5" /> FAQs
      </Link>

      <div className="flex items-start justify-between gap-4">
        <div className="min-w-0 flex-1">
          {faq.featured && (
            <span className="inline-flex items-center gap-1 rounded-full bg-amber-100 px-2 py-0.5 text-xs font-semibold text-amber-700 mb-2">
              <Star className="h-3 w-3" /> Featured
            </span>
          )}
          <h1 className="text-xl font-semibold">{faq.question}</h1>
          <div className="mt-1 flex items-center gap-3 text-sm text-muted-foreground">
            <span className={cn("capitalize font-medium", STATUS_STYLE[faq.status])}>{faq.status}</span>
            {faq.category && <span>· {faq.category}</span>}
            <span>· Sort order: {faq.sort_order}</span>
          </div>
        </div>
        <div className="flex shrink-0 items-center gap-2">
          <button
            type="button" onClick={togglePublish}
            className="flex items-center gap-1.5 rounded-md border border-border px-3 py-1.5 text-sm font-medium hover:bg-muted transition-colors"
          >
            <Send className="h-3.5 w-3.5" />
            {faq.status === "published" ? "Unpublish" : "Publish"}
          </button>
          <Link
            to="/admin/workspaces/$id/faqs/$faqId/edit"
            params={{ id: workspaceId, faqId }}
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

      <div className="mt-8 rounded-lg border border-border bg-muted/30 p-6">
        <h2 className="mb-3 text-xs font-semibold uppercase tracking-wider text-muted-foreground/60">Answer</h2>
        <div
          className="prose prose-sm max-w-none text-foreground"
          dangerouslySetInnerHTML={{ __html: faq.answer }}
        />
      </div>

      {(faq.seo_title || faq.meta_description) && (
        <div className="mt-6 rounded-lg border border-border p-4">
          <h2 className="mb-3 text-xs font-semibold uppercase tracking-wider text-muted-foreground/60">SEO</h2>
          {faq.seo_title && <p className="text-sm font-medium">{faq.seo_title}</p>}
          {faq.meta_description && <p className="mt-1 text-sm text-muted-foreground">{faq.meta_description}</p>}
        </div>
      )}

      <AlertDialog open={confirmDelete} onOpenChange={setConfirmDelete}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete this FAQ?</AlertDialogTitle>
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
