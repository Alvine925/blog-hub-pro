import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { queryOptions, useSuspenseQuery, useQueryClient, useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { useState, useMemo, useEffect, useRef } from "react";
import { toast } from "sonner";
import {
  Pencil, Trash2, Send, Newspaper, ExternalLink, X, Save, Plus,
  Eye, Heart, MessageSquare, Sparkles, CheckSquare, Square, Loader2,
} from "lucide-react";
import { GenerateContentDialog } from "@/components/ai/GenerateContentDialog";
import { adminListNews, upsertNews, deleteNews, setNewsStatus, type NewsItem } from "@/lib/news.functions";
import { getBatchContentEngagementStats } from "@/lib/engagement.functions";
import { supabase } from "@/integrations/supabase/client";
import { cn } from "@/lib/utils";
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
} from "@/components/ui/alert-dialog";

const listQuery = (workspaceId: string) =>
  queryOptions({
    queryKey: ["admin", "news", workspaceId],
    queryFn: () => adminListNews({ data: { workspaceId } }),
  });

export const Route = createFileRoute("/admin/workspaces/$id/news/")({
  loader: ({ context, params }) => context.queryClient.ensureQueryData(listQuery(params.id)),
  component: WorkspaceNews,
  errorComponent: ({ error }) => <p className="p-8 text-sm text-red-600">{error.message}</p>,
});

const STATUS_STYLE: Record<string, string> = {
  published: "text-emerald-600",
  draft: "text-muted-foreground",
  scheduled: "text-amber-600",
};

function WorkspaceNews() {
  const { id: workspaceId } = Route.useParams();
  const { data: news } = useSuspenseQuery(listQuery(workspaceId));
  const queryClient = useQueryClient();
  const navigate = useNavigate();
  const doDelete = useServerFn(deleteNews);
  const doStatus = useServerFn(setNewsStatus);
  const doUpsert = useServerFn(upsertNews);
  const [pendingDelete, setPendingDelete] = useState<NewsItem | null>(null);
  const [editing, setEditing] = useState<NewsItem | null>(null);
  const [form, setForm] = useState({ title: "", excerpt: "", content: "", category: "General" });
  const [busy, setBusy] = useState(false);
  const [generateOpen, setGenerateOpen] = useState(false);
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [bulkBusy, setBulkBusy] = useState(false);
  const [autoGenerating, setAutoGenerating] = useState(false);
  const autoTriggeredRef = useRef(false);

  const newsIds = useMemo(() => news.map((n) => n.id), [news]);
  const doGetBatchStats = useServerFn(getBatchContentEngagementStats);
  const { data: batchStats } = useQuery({
    queryKey: ["batch-engagement-stats", "news", workspaceId, newsIds.join(",")],
    queryFn: () => doGetBatchStats({ data: { workspaceId, contentType: "news", ids: newsIds } }),
    enabled: newsIds.length > 0,
    staleTime: 60_000,
  });

  useEffect(() => {
    if (news.length === 0 && !autoTriggeredRef.current) {
      autoTriggeredRef.current = true;
      setAutoGenerating(true);
      supabase.functions
        .invoke("generate-news", { body: { workspace_id: workspaceId, count: 10 } })
        .then(() => queryClient.invalidateQueries({ queryKey: ["admin", "news", workspaceId] }))
        .catch((err) => toast.error("Auto-generation failed: " + (err?.message ?? "Unknown error")))
        .finally(() => setAutoGenerating(false));
    }
  }, []);

  const invalidate = () => queryClient.invalidateQueries({ queryKey: ["admin", "news"] });

  function toggleSelect(id: string) {
    setSelected((prev) => {
      const next = new Set(prev);
      next.has(id) ? next.delete(id) : next.add(id);
      return next;
    });
  }

  function toggleSelectAll() {
    setSelected(selected.size === news.length ? new Set() : new Set(news.map((n) => n.id)));
  }

  async function bulkSetStatus(status: "published" | "draft") {
    if (selected.size === 0) return;
    setBulkBusy(true);
    try {
      await Promise.all(
        [...selected].map((id) => doStatus({ data: { id, workspaceId, status } }))
      );
      toast.success(`${selected.size} item${selected.size > 1 ? "s" : ""} ${status}`);
      setSelected(new Set());
      await invalidate();
    } catch (e) { toast.error(e instanceof Error ? e.message : "Failed"); }
    finally { setBulkBusy(false); }
  }

  function startEdit(item: NewsItem) {
    setEditing(item);
    setForm({ title: item.title, excerpt: item.excerpt, content: item.content, category: item.category });
  }

  async function handleSave() {
    if (!editing) return;
    setBusy(true);
    try {
      await doUpsert({
        data: {
          id: editing.id, workspaceId, title: form.title, slug: editing.slug,
          excerpt: form.excerpt, content: form.content, category: form.category, status: editing.status,
        },
      });
      toast.success("News item updated");
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
      toast.success("News item deleted");
      setPendingDelete(null);
      await invalidate();
    } catch (e) { toast.error(e instanceof Error ? e.message : "Failed"); }
    finally { setBusy(false); }
  }

  async function togglePublish(item: NewsItem) {
    const next = item.status === "published" ? "draft" : "published";
    try {
      await doStatus({ data: { id: item.id, workspaceId, status: next } });
      toast.success(`News ${next}`);
      await invalidate();
    } catch (e) { toast.error(e instanceof Error ? e.message : "Failed"); }
  }

  return (
    <div className="min-h-full px-8 py-8">
      <div className="mb-8 flex items-center justify-between">
        <div>
          <h1 className="text-xl font-semibold">News</h1>
          <p className="mt-0.5 text-sm text-muted-foreground">
            {news.length} item{news.length !== 1 ? "s" : ""} — researched and written from real industry news
          </p>
        </div>
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={() => setGenerateOpen(true)}
            className="flex items-center gap-1.5 rounded-md border border-primary/30 bg-primary/5 px-3 py-1.5 text-sm font-medium text-primary hover:bg-primary/10 transition-colors"
          >
            <Sparkles className="h-3.5 w-3.5" /> Generate with AI
          </button>
          <Link
            to="/admin/workspaces/$id/news/new"
            params={{ id: workspaceId }}
            className="flex items-center gap-1.5 rounded-md bg-primary px-3 py-1.5 text-sm font-medium text-primary-foreground hover:bg-primary/90 transition-colors"
          >
            <Plus className="h-3.5 w-3.5" /> New
          </Link>
        </div>
      </div>

      {selected.size > 0 && (
        <div className="mb-4 flex items-center gap-3 rounded-lg border border-primary/20 bg-primary/5 px-4 py-2.5">
          <span className="text-sm font-medium text-primary">{selected.size} selected</span>
          <div className="ml-auto flex items-center gap-2">
            <button
              type="button"
              onClick={() => bulkSetStatus("published")}
              disabled={bulkBusy}
              className="flex items-center gap-1.5 rounded-md bg-emerald-600 px-3 py-1.5 text-xs font-medium text-white hover:bg-emerald-700 disabled:opacity-50 transition-colors"
            >
              {bulkBusy ? <Loader2 className="h-3 w-3 animate-spin" /> : <Send className="h-3 w-3" />}
              Publish All
            </button>
            <button
              type="button"
              onClick={() => bulkSetStatus("draft")}
              disabled={bulkBusy}
              className="flex items-center gap-1.5 rounded-md border border-border bg-background px-3 py-1.5 text-xs font-medium hover:bg-muted disabled:opacity-50 transition-colors"
            >
              Unpublish All
            </button>
            <button
              type="button"
              onClick={() => setSelected(new Set())}
              className="flex h-6 w-6 items-center justify-center rounded text-muted-foreground hover:text-foreground transition-colors"
            >
              <X className="h-3.5 w-3.5" />
            </button>
          </div>
        </div>
      )}

      {autoGenerating ? (
        <div className="flex flex-col items-center gap-4 py-20 border-y border-border text-center">
          <Loader2 className="h-7 w-7 animate-spin text-primary" />
          <div>
            <p className="text-sm font-medium">Generating news articles…</p>
            <p className="text-xs text-muted-foreground mt-1">AI is researching industry trends for your workspace. This takes about 20–40 seconds.</p>
          </div>
        </div>
      ) : news.length === 0 ? (
        <div className="flex flex-col items-center gap-3 py-20 border-y border-border text-center">
          <Newspaper className="h-6 w-6 text-muted-foreground/50" />
          <p className="text-sm text-muted-foreground">No news yet. Use "Generate with AI" to create your first batch.</p>
        </div>
      ) : (
        <div>
          <div className="flex items-center gap-3 border-b border-border pb-2 text-[10px] font-semibold uppercase tracking-widest text-muted-foreground/60">
            <button
              type="button"
              onClick={toggleSelectAll}
              className="shrink-0 text-muted-foreground hover:text-foreground transition-colors"
              title={selected.size === news.length ? "Deselect all" : "Select all"}
            >
              {selected.size === news.length && news.length > 0
                ? <CheckSquare className="h-3.5 w-3.5 text-primary" />
                : <Square className="h-3.5 w-3.5" />}
            </button>
            <span className="flex-1">Title</span>
            <span className="w-28 shrink-0 hidden sm:block">Source</span>
            <span className="w-24 shrink-0 hidden md:block">Category</span>
            <span className="w-20 shrink-0 hidden lg:block">Status</span>
            <span className="w-20 shrink-0 text-right">Actions</span>
          </div>

          {news.map((item) => (
            <div
              key={item.id}
              onClick={() => navigate({ to: "/admin/workspaces/$id/news/$newsId", params: { id: workspaceId, newsId: item.id } })}
              className={cn(
                "group flex items-center gap-3 border-b border-border py-3 last:border-0 hover:bg-muted/30 -mx-2 px-2 rounded-lg transition-colors cursor-pointer",
                selected.has(item.id) && "bg-primary/5"
              )}
            >
              <button
                type="button"
                onClick={(e) => { e.stopPropagation(); toggleSelect(item.id); }}
                className="shrink-0 text-muted-foreground hover:text-primary transition-colors"
              >
                {selected.has(item.id)
                  ? <CheckSquare className="h-3.5 w-3.5 text-primary" />
                  : <Square className="h-3.5 w-3.5" />}
              </button>
              <div className="flex-1 min-w-0">
                <p className="truncate text-sm font-medium">{item.title}</p>
                <p className="truncate text-xs text-muted-foreground">{item.excerpt}</p>
                <div className="mt-0.5 flex items-center gap-3 text-[10px] text-muted-foreground/60">
                  <span className="flex items-center gap-0.5"><Eye className="h-2.5 w-2.5" />{(batchStats?.[item.id]?.views ?? 0).toLocaleString()}</span>
                  <span className="flex items-center gap-0.5"><Heart className="h-2.5 w-2.5" />{(batchStats?.[item.id]?.likes ?? 0).toLocaleString()}</span>
                  <span className="flex items-center gap-0.5"><MessageSquare className="h-2.5 w-2.5" />{(batchStats?.[item.id]?.comments ?? 0).toLocaleString()}</span>
                </div>
              </div>
              <span className="w-28 shrink-0 text-xs text-muted-foreground hidden sm:flex items-center gap-1">
                {item.source_name ?? "AI trend"}
                {item.source_url && (
                  <a href={item.source_url} target="_blank" rel="noreferrer" onClick={(e) => e.stopPropagation()}>
                    <ExternalLink className="h-3 w-3" />
                  </a>
                )}
              </span>
              <span className="w-24 shrink-0 text-xs text-muted-foreground hidden md:block">{item.category}</span>
              <span className={cn("w-20 shrink-0 text-xs hidden lg:block", STATUS_STYLE[item.status])}>{item.status}</span>
              <div className="w-20 shrink-0 flex items-center justify-end gap-1 opacity-0 group-hover:opacity-100 transition-opacity" onClick={(e) => e.stopPropagation()}>
                <button type="button" onClick={() => startEdit(item)} className="flex h-7 w-7 items-center justify-center rounded text-muted-foreground hover:text-foreground hover:bg-muted transition-colors" title="Edit">
                  <Pencil className="h-3.5 w-3.5" />
                </button>
                <button type="button" onClick={() => togglePublish(item)} className="flex h-7 w-7 items-center justify-center rounded text-muted-foreground hover:text-emerald-600 hover:bg-emerald-50 transition-colors" title={item.status === "published" ? "Unpublish" : "Publish"}>
                  <Send className="h-3.5 w-3.5" />
                </button>
                <button type="button" onClick={() => setPendingDelete(item)} className="flex h-7 w-7 items-center justify-center rounded text-muted-foreground hover:text-red-600 hover:bg-red-50 transition-colors" title="Delete">
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
              <h2 className="text-sm font-semibold">Edit News Item</h2>
              <button onClick={() => setEditing(null)}><X className="h-4 w-4 text-muted-foreground" /></button>
            </div>
            <div className="space-y-3">
              <div>
                <label className="text-xs font-medium text-muted-foreground">Title</label>
                <input className="mt-1 w-full rounded-md border border-border bg-background px-3 py-2 text-sm" value={form.title} onChange={(e) => setForm((f) => ({ ...f, title: e.target.value }))} />
              </div>
              <div>
                <label className="text-xs font-medium text-muted-foreground">Excerpt</label>
                <textarea className="mt-1 w-full rounded-md border border-border bg-background px-3 py-2 text-sm" rows={2} value={form.excerpt} onChange={(e) => setForm((f) => ({ ...f, excerpt: e.target.value }))} />
              </div>
              <div>
                <label className="text-xs font-medium text-muted-foreground">Content</label>
                <textarea className="mt-1 w-full rounded-md border border-border bg-background px-3 py-2 text-sm" rows={6} value={form.content} onChange={(e) => setForm((f) => ({ ...f, content: e.target.value }))} />
              </div>
              <div>
                <label className="text-xs font-medium text-muted-foreground">Category</label>
                <input className="mt-1 w-full rounded-md border border-border bg-background px-3 py-2 text-sm" value={form.category} onChange={(e) => setForm((f) => ({ ...f, category: e.target.value }))} />
              </div>
            </div>
            <div className="mt-5 flex justify-end gap-2">
              <button onClick={() => setEditing(null)} className="rounded-md border border-border px-3 py-1.5 text-sm">Cancel</button>
              <button onClick={handleSave} disabled={busy} className="flex items-center gap-1.5 rounded-md bg-primary px-3 py-1.5 text-sm font-medium text-primary-foreground hover:bg-primary/90">
                <Save className="h-3.5 w-3.5" /> Save
              </button>
            </div>
          </div>
        </div>
      )}

      <AlertDialog open={!!pendingDelete} onOpenChange={(o) => !o && setPendingDelete(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete this news item?</AlertDialogTitle>
            <AlertDialogDescription>This action cannot be undone.</AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={handleDelete} disabled={busy} className="bg-destructive text-destructive-foreground hover:bg-destructive/90">Delete</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <GenerateContentDialog open={generateOpen} onOpenChange={setGenerateOpen} contentType="news" workspaceId={workspaceId} />
    </div>
  );
}
