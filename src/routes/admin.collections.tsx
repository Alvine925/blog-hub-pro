import { createFileRoute, Link } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { queryOptions, useSuspenseQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { toast } from "sonner";
import {
  Plus, Trash2, Loader2, Layers, ChevronDown, ChevronUp, ArrowRight,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { listCollections, createCollection, deleteCollection, type Collection } from "@/lib/collection.functions";

const colsQuery = queryOptions({
  queryKey: ["admin", "collections"],
  queryFn: () => listCollections(),
});

export const Route = createFileRoute("/admin/collections")({
  head: () => ({ meta: [{ title: "Collections — Admin" }] }),
  loader: ({ context }) => context.queryClient.ensureQueryData(colsQuery),
  component: CollectionsPage,
  errorComponent: ({ error }) => (
    <p className="text-sm text-destructive">Failed to load collections: {error.message}</p>
  ),
});

function CollectionsPage() {
  const { data: collections } = useSuspenseQuery(colsQuery);
  const queryClient = useQueryClient();
  const create = useServerFn(createCollection);
  const del = useServerFn(deleteCollection);

  const [formOpen, setFormOpen] = useState(false);
  const [name, setName] = useState("");
  const [desc, setDesc] = useState("");
  const [busy, setBusy] = useState(false);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [pendingDelete, setPendingDelete] = useState<Collection | null>(null);

  async function refresh() {
    await queryClient.invalidateQueries({ queryKey: ["admin", "collections"] });
  }

  async function handleCreate() {
    if (!name.trim()) { toast.error("Enter a name"); return; }
    setBusy(true);
    try {
      await create({ data: { name: name.trim(), description: desc.trim() || undefined, schema: [] } });
      toast.success("Collection created");
      setName(""); setDesc(""); setFormOpen(false);
      await refresh();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Failed");
    } finally {
      setBusy(false);
    }
  }

  async function handleDelete() {
    if (!pendingDelete) return;
    setBusyId(pendingDelete.id);
    try {
      await del({ data: { id: pendingDelete.id } });
      toast.success("Collection deleted");
      setPendingDelete(null);
      await refresh();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Failed");
    } finally {
      setBusyId(null);
    }
  }

  return (
    <div className="max-w-3xl space-y-10">
      <div>
        <h1 className="text-2xl font-bold">Collections</h1>
        <p className="text-sm text-muted-foreground">
          Build custom content types with your own fields — FAQs, testimonials, products, team members, and more.
        </p>
      </div>

      {collections.length === 0 ? (
        <div className="flex flex-col items-center gap-3 py-16 text-center border-t border-border">
          <Layers className="h-9 w-9 text-muted-foreground" />
          <p className="text-muted-foreground">No collections yet.</p>
          <p className="text-sm text-muted-foreground">Create one below to define your first custom content type.</p>
        </div>
      ) : (
        <div className="border-t border-border">
          {collections.map((col) => (
            <div key={col.id} className="flex items-center gap-4 border-b border-border py-4 last:border-0">
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2">
                  <span className="font-semibold">{col.name}</span>
                  <code className="text-xs text-muted-foreground font-mono bg-muted/60 px-1.5 py-0.5 rounded">{col.slug}</code>
                </div>
                {col.description && <p className="text-xs text-muted-foreground mt-0.5 truncate">{col.description}</p>}
                <div className="mt-1 flex items-center gap-2 text-xs text-muted-foreground">
                  <span>{col.schema.length} field{col.schema.length !== 1 ? "s" : ""}</span>
                  <span>·</span>
                  <span>{col.entry_count ?? 0} entr{(col.entry_count ?? 0) !== 1 ? "ies" : "y"}</span>
                </div>
              </div>
              <div className="flex items-center gap-2 shrink-0">
                <Button size="sm" variant="ghost" asChild>
                  <Link to="/admin/collections/$id" params={{ id: col.id }}>
                    Manage <ArrowRight className="ml-1.5 h-3.5 w-3.5" />
                  </Link>
                </Button>
                <Button size="icon" variant="ghost" className="text-destructive hover:text-destructive" onClick={() => setPendingDelete(col)} disabled={busyId === col.id}>
                  <Trash2 className="h-4 w-4" />
                </Button>
              </div>
            </div>
          ))}
        </div>
      )}

      <div className="border-t border-border pt-6">
        <button type="button" className="flex w-full items-center justify-between text-sm font-semibold" onClick={() => setFormOpen((v) => !v)}>
          <span className="flex items-center gap-2"><Plus className="h-4 w-4" /> New Collection</span>
          {formOpen ? <ChevronUp className="h-4 w-4 text-muted-foreground" /> : <ChevronDown className="h-4 w-4 text-muted-foreground" />}
        </button>
        {formOpen && (
          <div className="mt-5 space-y-4">
            <div className="grid gap-4 sm:grid-cols-2">
              <div className="space-y-1.5">
                <Label htmlFor="col-name">Name</Label>
                <Input id="col-name" value={name} onChange={(e) => setName(e.target.value)} placeholder="e.g. Testimonials, FAQs" />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="col-desc">Description <span className="text-muted-foreground font-normal">(optional)</span></Label>
                <Input id="col-desc" value={desc} onChange={(e) => setDesc(e.target.value)} placeholder="What this collection stores" />
              </div>
            </div>
            <p className="text-xs text-muted-foreground">You'll define fields after creating the collection.</p>
            <Button onClick={handleCreate} disabled={busy}>
              {busy ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Plus className="mr-2 h-4 w-4" />}
              Create Collection
            </Button>
          </div>
        )}
      </div>

      <AlertDialog open={Boolean(pendingDelete)} onOpenChange={(o) => !o && setPendingDelete(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete "{pendingDelete?.name}"?</AlertDialogTitle>
            <AlertDialogDescription>
              All {pendingDelete?.entry_count ?? 0} entries in this collection will be permanently deleted.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={handleDelete} className="bg-destructive text-destructive-foreground hover:bg-destructive/90">Delete</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
