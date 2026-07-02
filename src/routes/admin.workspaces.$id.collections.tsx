import { createFileRoute, Link } from "@tanstack/react-router";
import { createServerFn } from "@tanstack/react-start";
import { queryOptions, useSuspenseQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { useState } from "react";
import { toast } from "sonner";
import { Plus, Pencil, Trash2, Layers } from "lucide-react";
import { listCollections, createCollection, deleteCollection } from "@/lib/collection.functions";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
} from "@/components/ui/alert-dialog";

// ── Auto-seed collections from workspace.selected_collections ─────────────────
// Handles existing workspaces created before onboarding seeded the collections table.
const COLLECTION_META: Record<string, { label: string; description: string }> = {
  blogs:          { label: "Blog Posts",    description: "Articles, news, and updates" },
  pages:          { label: "Pages",         description: "Static website pages" },
  media:          { label: "Media Library", description: "Images and file uploads" },
  documentation:  { label: "Documentation", description: "Technical docs and guides" },
  products:       { label: "Products",      description: "Product catalogue" },
  faqs:           { label: "FAQs",          description: "Frequently asked questions" },
  "case-studies": { label: "Case Studies",  description: "Client success stories" },
  testimonials:   { label: "Testimonials",  description: "Customer reviews" },
  team:           { label: "Team Members",  description: "Staff profiles" },
  events:         { label: "Events",        description: "Upcoming events" },
  portfolio:      { label: "Portfolio",     description: "Work showcase" },
  services:       { label: "Services",      description: "Service offerings" },
};

const seedCollectionsFromWorkspace = createServerFn({ method: "POST" })
  .validator((input: { workspaceId: string }) => input)
  .handler(async ({ data }) => {
    const { getAdminClient } = await import("@/lib/supabase.server");
    const db = getAdminClient() as any;

    // Fetch selected_collections from workspace
    const { data: ws } = await db
      .from("workspaces")
      .select("selected_collections")
      .eq("id", data.workspaceId)
      .single();

    const selected: string[] = ws?.selected_collections ?? [];
    if (!selected.length) return { seeded: 0 };

    const rows = selected.map((slug: string) => {
      const meta = COLLECTION_META[slug] ?? { label: slug, description: null };
      return { name: meta.label, slug, description: meta.description, schema: [] };
    });

    await db.from("collections").upsert(rows, { onConflict: "slug", ignoreDuplicates: true });
    return { seeded: rows.length };
  });

const listQuery = queryOptions({
  queryKey: ["admin", "collections"],
  queryFn: () => listCollections(),
});

export const Route = createFileRoute("/admin/workspaces/$id/collections")({
  loader: async ({ context, params }) => {
    // Backfill any selected content types that aren't in the collections table yet
    await seedCollectionsFromWorkspace({ data: { workspaceId: params.id } });
    return context.queryClient.ensureQueryData(listQuery);
  },
  component: WorkspaceCollections,
  errorComponent: ({ error }) => <p className="p-8 text-sm text-red-600">{error.message}</p>,
});

function WorkspaceCollections() {
  const { data: collections } = useSuspenseQuery(listQuery);
  const queryClient = useQueryClient();
  const doCreate = useServerFn(createCollection);
  const doDelete = useServerFn(deleteCollection);

  const [showForm, setShowForm] = useState(false);
  const [name, setName] = useState("");
  const [desc, setDesc] = useState("");
  const [busy, setBusy] = useState(false);
  const [pendingDelete, setPendingDelete] = useState<{ id: string; name: string } | null>(null);

  async function handleCreate(e: React.FormEvent) {
    e.preventDefault();
    if (!name.trim()) return;
    setBusy(true);
    try {
      await doCreate({ data: { name: name.trim(), description: desc.trim() } });
      toast.success("Collection created");
      setName(""); setDesc(""); setShowForm(false);
      await queryClient.invalidateQueries({ queryKey: ["admin", "collections"] });
    } catch (err) { toast.error(err instanceof Error ? err.message : "Failed"); }
    finally { setBusy(false); }
  }

  async function handleDelete() {
    if (!pendingDelete) return;
    setBusy(true);
    try {
      await doDelete({ data: { id: pendingDelete.id } });
      toast.success("Collection deleted");
      setPendingDelete(null);
      await queryClient.invalidateQueries({ queryKey: ["admin", "collections"] });
    } catch (err) { toast.error(err instanceof Error ? err.message : "Failed"); }
    finally { setBusy(false); }
  }

  return (
    <div className="min-h-full px-8 py-8">
      {/* Header */}
      <div className="mb-8 flex items-center justify-between">
        <div>
          <h1 className="text-xl font-semibold">Collections</h1>
          <p className="mt-0.5 text-sm text-muted-foreground">{collections.length} content types defined</p>
        </div>
        <button
          type="button"
          onClick={() => setShowForm((v) => !v)}
          className="flex items-center gap-1.5 rounded-md bg-primary px-3 py-1.5 text-sm font-medium text-primary-foreground hover:bg-primary/90 transition-colors"
        >
          <Plus className="h-3.5 w-3.5" /> New Collection
        </button>
      </div>

      {/* Inline create form */}
      {showForm && (
        <form onSubmit={handleCreate} className="mb-8 border-b border-border pb-8 space-y-3">
          <h2 className="text-sm font-medium">New collection</h2>
          <div className="grid gap-3 sm:grid-cols-2">
            <Input
              placeholder="Collection name"
              value={name}
              onChange={(e) => setName(e.target.value)}
              required
              autoFocus
            />
            <Textarea
              placeholder="Description (optional)"
              value={desc}
              onChange={(e) => setDesc(e.target.value)}
              rows={1}
              className="resize-none"
            />
          </div>
          <div className="flex gap-2">
            <Button type="submit" size="sm" disabled={busy || !name.trim()}>Create</Button>
            <Button type="button" variant="ghost" size="sm" onClick={() => setShowForm(false)}>Cancel</Button>
          </div>
        </form>
      )}

      {/* List */}
      {collections.length === 0 ? (
        <div className="flex flex-col items-center gap-3 py-20 border-y border-border text-center">
          <Layers className="h-8 w-8 text-muted-foreground/30" />
          <p className="text-sm text-muted-foreground">No collections yet.</p>
          <button
            type="button"
            onClick={() => setShowForm(true)}
            className="text-sm font-medium text-primary hover:underline flex items-center gap-1"
          >
            <Plus className="h-3.5 w-3.5" /> Create first collection
          </button>
        </div>
      ) : (
        <div>
          <div className="flex items-center gap-3 border-b border-border pb-2 text-[10px] font-semibold uppercase tracking-widest text-muted-foreground/60">
            <span className="flex-1">Name</span>
            <span className="flex-1 hidden sm:block">Description</span>
            <span className="w-16 shrink-0 text-right">Actions</span>
          </div>

          {collections.map((col: any) => (
            <div key={col.id} className="group flex items-center gap-3 border-b border-border py-3.5 last:border-0">
              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium">{col.name}</p>
                <p className="text-xs font-mono text-muted-foreground">{col.slug}</p>
              </div>
              <p className="flex-1 text-sm text-muted-foreground hidden sm:block truncate">
                {col.description || "—"}
              </p>
              <div className="w-16 shrink-0 flex items-center justify-end gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                <Link
                  to="/admin/collections/$id"
                  params={{ id: col.id }}
                  className="flex h-7 w-7 items-center justify-center rounded text-muted-foreground hover:text-foreground hover:bg-muted transition-colors"
                  title="Edit schema"
                >
                  <Pencil className="h-3.5 w-3.5" />
                </Link>
                <button
                  type="button"
                  onClick={() => setPendingDelete({ id: col.id, name: col.name })}
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

      <AlertDialog open={!!pendingDelete} onOpenChange={(o) => !o && setPendingDelete(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete "{pendingDelete?.name}"?</AlertDialogTitle>
            <AlertDialogDescription>All entries in this collection will be permanently deleted.</AlertDialogDescription>
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
