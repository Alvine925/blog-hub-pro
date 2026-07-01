import { createFileRoute } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { queryOptions, useSuspenseQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { toast } from "sonner";
import { Plus, Trash2, Loader2, FolderOpen, ChevronDown, ChevronUp } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { listWorkspaces, createWorkspace, deleteWorkspace, type Workspace } from "@/lib/workspace.functions";
import { formatBlogDate } from "@/lib/blog-types";

const wsQuery = queryOptions({
  queryKey: ["admin", "workspaces"],
  queryFn: () => listWorkspaces(),
});

export const Route = createFileRoute("/admin/workspaces")({
  head: () => ({ meta: [{ title: "Workspaces — Admin" }] }),
  loader: ({ context }) => context.queryClient.ensureQueryData(wsQuery),
  component: WorkspacesPage,
  errorComponent: ({ error }) => (
    <p className="text-sm text-destructive">Failed to load workspaces: {error.message}</p>
  ),
});

function WorkspacesPage() {
  const { data: workspaces } = useSuspenseQuery(wsQuery);
  const queryClient = useQueryClient();
  const create = useServerFn(createWorkspace);
  const del = useServerFn(deleteWorkspace);

  const [formOpen, setFormOpen] = useState(false);
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [busy, setBusy] = useState(false);
  const [pendingDelete, setPendingDelete] = useState<Workspace | null>(null);

  async function refresh() {
    await queryClient.invalidateQueries({ queryKey: ["admin", "workspaces"] });
  }

  async function handleCreate() {
    if (!name.trim()) { toast.error("Enter a workspace name"); return; }
    setBusy(true);
    try {
      await create({ data: { name: name.trim(), description: description.trim() || undefined } });
      toast.success("Workspace created");
      setName(""); setDescription(""); setFormOpen(false);
      await refresh();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Failed");
    } finally {
      setBusy(false);
    }
  }

  async function handleDelete() {
    if (!pendingDelete) return;
    setBusy(true);
    try {
      await del({ data: { id: pendingDelete.id } });
      toast.success("Workspace deleted");
      setPendingDelete(null);
      await refresh();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Failed");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="max-w-3xl space-y-10">
      <div>
        <h1 className="text-2xl font-bold">Workspaces</h1>
        <p className="text-sm text-muted-foreground">
          Organise content into separate projects. Each workspace is an isolated namespace for collections and blog posts.
        </p>
      </div>

      {workspaces.length === 0 ? (
        <div className="flex flex-col items-center gap-3 py-16 text-center border-t border-border">
          <FolderOpen className="h-9 w-9 text-muted-foreground" />
          <p className="text-muted-foreground">No workspaces yet.</p>
        </div>
      ) : (
        <div className="border-t border-border">
          {workspaces.map((ws) => (
            <div key={ws.id} className="flex items-center gap-4 border-b border-border py-4 last:border-0">
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2">
                  <span className="font-semibold">{ws.name}</span>
                  <code className="text-xs text-muted-foreground font-mono bg-muted/60 px-1.5 py-0.5 rounded">
                    {ws.slug}
                  </code>
                </div>
                {ws.description && (
                  <p className="text-sm text-muted-foreground mt-0.5 truncate">{ws.description}</p>
                )}
                <p className="text-xs text-muted-foreground mt-0.5">Created {formatBlogDate(ws.created_at)}</p>
              </div>
              {ws.slug !== "default" && (
                <Button
                  size="icon"
                  variant="ghost"
                  className="text-destructive hover:text-destructive shrink-0"
                  onClick={() => setPendingDelete(ws)}
                >
                  <Trash2 className="h-4 w-4" />
                </Button>
              )}
            </div>
          ))}
        </div>
      )}

      <div className="border-t border-border pt-6">
        <button
          type="button"
          className="flex w-full items-center justify-between text-sm font-semibold"
          onClick={() => setFormOpen((v) => !v)}
        >
          <span className="flex items-center gap-2">
            <Plus className="h-4 w-4" /> New Workspace
          </span>
          {formOpen ? <ChevronUp className="h-4 w-4 text-muted-foreground" /> : <ChevronDown className="h-4 w-4 text-muted-foreground" />}
        </button>

        {formOpen && (
          <div className="mt-5 space-y-4">
            <div className="space-y-1.5">
              <Label htmlFor="ws-name">Name</Label>
              <Input id="ws-name" value={name} onChange={(e) => setName(e.target.value)} placeholder="My Project" />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="ws-desc">Description <span className="text-muted-foreground font-normal">(optional)</span></Label>
              <Input id="ws-desc" value={description} onChange={(e) => setDescription(e.target.value)} placeholder="What this workspace is for" />
            </div>
            <Button onClick={handleCreate} disabled={busy}>
              {busy ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Plus className="mr-2 h-4 w-4" />}
              Create Workspace
            </Button>
          </div>
        )}
      </div>

      <AlertDialog open={Boolean(pendingDelete)} onOpenChange={(o) => !o && setPendingDelete(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete "{pendingDelete?.name}"?</AlertDialogTitle>
            <AlertDialogDescription>
              This workspace will be permanently removed. Content inside it is not automatically deleted but will be unlinked.
            </AlertDialogDescription>
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
