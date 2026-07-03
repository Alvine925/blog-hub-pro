import { createFileRoute, Link } from "@tanstack/react-router";
import { queryOptions, useSuspenseQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { useState } from "react";
import { toast } from "sonner";
import { Pencil, Trash2, Send, Sparkles, X, Save, Plus } from "lucide-react";
import { adminListFaqs, upsertFaq, deleteFaq, setFaqStatus, type Faq } from "@/lib/faq.functions";
import { cn } from "@/lib/utils";
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
} from "@/components/ui/alert-dialog";

const listQuery = (workspaceId: string) =>
  queryOptions({
    queryKey: ["admin", "faqs", workspaceId],
    queryFn: () => adminListFaqs({ data: { workspaceId } }),
  });

export const Route = createFileRoute("/admin/workspaces/$id/faqs/")({
  loader: ({ context, params }) => context.queryClient.ensureQueryData(listQuery(params.id)),
  component: WorkspaceFaqs,
  errorComponent: ({ error }) => <p className="p-8 text-sm text-red-600">{error.message}</p>,
});

const STATUS_STYLE: Record<string, string> = {
  published: "text-emerald-600",
  draft: "text-muted-foreground",
};

function WorkspaceFaqs() {
  const { id: workspaceId } = Route.useParams();
  const { data: faqs } = useSuspenseQuery(listQuery(workspaceId));
  const queryClient = useQueryClient();
  const doDelete = useServerFn(deleteFaq);
  const doStatus = useServerFn(setFaqStatus);
  const doUpsert = useServerFn(upsertFaq);
  const [pendingDelete, setPendingDelete] = useState<Faq | null>(null);
  const [editing, setEditing] = useState<Faq | null>(null);
  const [form, setForm] = useState({ question: "", answer: "", category: "General" });
  const [busy, setBusy] = useState(false);

  const invalidate = () => queryClient.invalidateQueries({ queryKey: ["admin", "faqs"] });

  function startEdit(faq: Faq) {
    setEditing(faq);
    setForm({ question: faq.question, answer: faq.answer, category: faq.category });
  }

  async function handleSave() {
    if (!editing) return;
    setBusy(true);
    try {
      await doUpsert({
        data: {
          id: editing.id,
          workspaceId,
          question: form.question,
          answer: form.answer,
          category: form.category,
          sort_order: editing.sort_order,
          featured: editing.featured,
          status: editing.status,
        },
      });
      toast.success("FAQ updated");
      setEditing(null);
      await invalidate();
    } catch (e) { toast.error(e instanceof Error ? e.message : "Failed"); }
    finally { setBusy(false); }
  }

  async function handleDelete() {
    if (!pendingDelete) return;
    setBusy(true);
    try {
      await doDelete({ data: { id: pendingDelete.id, workspaceId } });
      toast.success("FAQ deleted");
      setPendingDelete(null);
      await invalidate();
    } catch (e) { toast.error(e instanceof Error ? e.message : "Failed"); }
    finally { setBusy(false); }
  }

  async function togglePublish(faq: Faq) {
    const next = faq.status === "published" ? "draft" : "published";
    try {
      await doStatus({ data: { id: faq.id, workspaceId, status: next } });
      toast.success(`FAQ ${next}`);
      await invalidate();
    } catch (e) { toast.error(e instanceof Error ? e.message : "Failed"); }
  }

  return (
    <div className="min-h-full px-8 py-8">
      <div className="mb-8 flex items-center justify-between">
        <div>
          <h1 className="text-xl font-semibold">FAQs</h1>
          <p className="mt-0.5 text-sm text-muted-foreground">
            {faqs.length} question{faqs.length !== 1 ? "s" : ""} — auto-generated from your site analysis during onboarding
          </p>
        </div>
        <Link
          to="/admin/workspaces/$id/faqs/new"
          params={{ id: workspaceId }}
          className="flex items-center gap-1.5 rounded-md bg-primary px-3 py-1.5 text-sm font-medium text-primary-foreground hover:bg-primary/90 transition-colors"
        >
          <Plus className="h-3.5 w-3.5" /> New
        </Link>
      </div>

      {faqs.length === 0 ? (
        <div className="flex flex-col items-center gap-3 py-20 border-y border-border text-center">
          <Sparkles className="h-6 w-6 text-muted-foreground/50" />
          <p className="text-sm text-muted-foreground">
            No FAQs yet. They're generated automatically when "FAQs" is selected during onboarding.
          </p>
        </div>
      ) : (
        <div>
          <div className="flex items-center gap-3 border-b border-border pb-2 text-[10px] font-semibold uppercase tracking-widest text-muted-foreground/60">
            <span className="flex-1">Question</span>
            <span className="w-24 shrink-0 hidden sm:block">Category</span>
            <span className="w-20 shrink-0 hidden md:block">Status</span>
            <span className="w-20 shrink-0 text-right">Actions</span>
          </div>

          {faqs.map((faq) => (
            <div
              key={faq.id}
              className="group flex items-center gap-3 border-b border-border py-3 last:border-0 hover:bg-muted/30 -mx-2 px-2 rounded-lg transition-colors"
            >
              <div className="flex-1 min-w-0">
                <p className="truncate text-sm font-medium">{faq.question}</p>
                <p className="truncate text-xs text-muted-foreground">
                  {faq.answer.replace(/<[^>]+>/g, "").slice(0, 100)}
                </p>
              </div>
              <span className="w-24 shrink-0 text-xs text-muted-foreground hidden sm:block">{faq.category}</span>
              <span className={cn("w-20 shrink-0 text-xs hidden md:block", STATUS_STYLE[faq.status])}>
                {faq.status}
              </span>
              <div className="w-20 shrink-0 flex items-center justify-end gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                <button
                  type="button"
                  onClick={() => startEdit(faq)}
                  className="flex h-7 w-7 items-center justify-center rounded text-muted-foreground hover:text-foreground hover:bg-muted transition-colors"
                  title="Edit"
                >
                  <Pencil className="h-3.5 w-3.5" />
                </button>
                <button
                  type="button"
                  onClick={() => togglePublish(faq)}
                  className="flex h-7 w-7 items-center justify-center rounded text-muted-foreground hover:text-emerald-600 hover:bg-emerald-50 transition-colors"
                  title={faq.status === "published" ? "Unpublish" : "Publish"}
                >
                  <Send className="h-3.5 w-3.5" />
                </button>
                <button
                  type="button"
                  onClick={() => setPendingDelete(faq)}
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

      {editing && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
          <div className="w-full max-w-lg rounded-xl bg-background p-6 shadow-xl">
            <div className="mb-4 flex items-center justify-between">
              <h2 className="text-sm font-semibold">Edit FAQ</h2>
              <button onClick={() => setEditing(null)}><X className="h-4 w-4 text-muted-foreground" /></button>
            </div>
            <div className="space-y-3">
              <div>
                <label className="text-xs font-medium text-muted-foreground">Question</label>
                <input
                  className="mt-1 w-full rounded-md border border-border bg-background px-3 py-2 text-sm"
                  value={form.question}
                  onChange={(e) => setForm((f) => ({ ...f, question: e.target.value }))}
                />
              </div>
              <div>
                <label className="text-xs font-medium text-muted-foreground">Answer</label>
                <textarea
                  className="mt-1 w-full rounded-md border border-border bg-background px-3 py-2 text-sm"
                  rows={5}
                  value={form.answer}
                  onChange={(e) => setForm((f) => ({ ...f, answer: e.target.value }))}
                />
              </div>
              <div>
                <label className="text-xs font-medium text-muted-foreground">Category</label>
                <input
                  className="mt-1 w-full rounded-md border border-border bg-background px-3 py-2 text-sm"
                  value={form.category}
                  onChange={(e) => setForm((f) => ({ ...f, category: e.target.value }))}
                />
              </div>
            </div>
            <div className="mt-5 flex justify-end gap-2">
              <button onClick={() => setEditing(null)} className="rounded-md border border-border px-3 py-1.5 text-sm">
                Cancel
              </button>
              <button
                onClick={handleSave}
                disabled={busy}
                className="flex items-center gap-1.5 rounded-md bg-primary px-3 py-1.5 text-sm font-medium text-primary-foreground hover:bg-primary/90"
              >
                <Save className="h-3.5 w-3.5" /> Save
              </button>
            </div>
          </div>
        </div>
      )}

      <AlertDialog open={!!pendingDelete} onOpenChange={(o) => !o && setPendingDelete(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete this FAQ?</AlertDialogTitle>
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
