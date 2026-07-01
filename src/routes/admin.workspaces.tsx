import { createFileRoute } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { queryOptions, useSuspenseQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { toast } from "sonner";
import {
  Plus, Trash2, Loader2, FolderOpen, ChevronDown, ChevronUp,
  ArrowRight, Settings, Clock,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
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

const WS_COLORS = [
  "bg-red-500", "bg-orange-500", "bg-amber-500", "bg-green-500",
  "bg-teal-500", "bg-blue-500", "bg-violet-500", "bg-pink-500",
];

function wsColor(name: string) {
  let hash = 0;
  for (const c of name) hash = (hash * 31 + c.charCodeAt(0)) & 0xffffffff;
  return WS_COLORS[Math.abs(hash) % WS_COLORS.length];
}

function WorkspaceCard({
  ws,
  onDelete,
}: {
  ws: Workspace;
  onDelete: (ws: Workspace) => void;
}) {
  const initial = ws.name.slice(0, 2).toUpperCase();
  const color = wsColor(ws.name);

  return (
    <div className="group flex items-start gap-4 rounded-xl border border-border bg-background p-5 shadow-sm transition-all hover:shadow-md hover:border-primary/30">
      {/* Avatar */}
      <div className={`flex h-11 w-11 shrink-0 items-center justify-center rounded-xl text-sm font-bold text-white ${color}`}>
        {initial}
      </div>

      {/* Info */}
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2 flex-wrap">
          <span className="font-semibold">{ws.name}</span>
          {ws.slug === "default" && (
            <Badge variant="secondary" className="text-[10px]">Default</Badge>
          )}
          <code className="text-xs text-muted-foreground font-mono bg-muted/60 px-1.5 py-0.5 rounded">
            {ws.slug}
          </code>
        </div>
        {ws.description && (
          <p className="mt-0.5 text-sm text-muted-foreground line-clamp-1">{ws.description}</p>
        )}
        <div className="mt-2 flex items-center gap-3 text-xs text-muted-foreground">
          <span className="flex items-center gap-1">
            <Clock className="h-3 w-3" /> Created {formatBlogDate(ws.created_at)}
          </span>
        </div>
      </div>

      {/* Actions */}
      <div className="flex shrink-0 items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
        {ws.slug !== "default" && (
          <Button
            size="icon"
            variant="ghost"
            className="h-8 w-8 text-destructive hover:text-destructive hover:bg-destructive/10"
            onClick={() => onDelete(ws)}
            title="Delete workspace"
          >
            <Trash2 className="h-4 w-4" />
          </Button>
        )}
        <Button size="icon" variant="ghost" className="h-8 w-8 text-muted-foreground" title="Workspace settings">
          <Settings className="h-4 w-4" />
        </Button>
      </div>
    </div>
  );
}

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
    <div className="space-y-10">
      <div className="flex items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold">Workspaces</h1>
          <p className="text-sm text-muted-foreground">
            Organise content into separate projects. Each workspace is an isolated namespace for collections and posts.
          </p>
        </div>
        <Button onClick={() => setFormOpen(true)} className="shrink-0">
          <Plus className="mr-2 h-4 w-4" /> New Workspace
        </Button>
      </div>

      {workspaces.length === 0 ? (
        <div className="flex flex-col items-center gap-3 py-24 text-center rounded-xl border border-dashed border-border">
          <FolderOpen className="h-10 w-10 text-muted-foreground" />
          <p className="font-medium">No workspaces yet</p>
          <p className="text-sm text-muted-foreground">Create your first workspace to get started.</p>
          <Button onClick={() => setFormOpen(true)} className="mt-2">
            <Plus className="mr-2 h-4 w-4" /> Create Workspace
          </Button>
        </div>
      ) : (
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {workspaces.map((ws) => (
            <WorkspaceCard key={ws.id} ws={ws} onDelete={setPendingDelete} />
          ))}

          {/* "Create new" card */}
          <button
            type="button"
            onClick={() => setFormOpen((v) => !v)}
            className="flex items-center gap-3 rounded-xl border border-dashed border-border bg-background p-5 text-sm text-muted-foreground hover:border-primary/40 hover:text-foreground transition-colors"
          >
            <Plus className="h-5 w-5" />
            <span>New Workspace</span>
          </button>
        </div>
      )}

      {/* Create form */}
      {formOpen && (
        <div className="rounded-xl border border-border bg-background p-6 shadow-sm space-y-5">
          <div className="flex items-center justify-between">
            <h2 className="text-sm font-semibold">New Workspace</h2>
            <button type="button" onClick={() => setFormOpen(false)} className="text-xs text-muted-foreground hover:text-foreground">
              Cancel
            </button>
          </div>
          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-1.5">
              <Label htmlFor="ws-name">Name</Label>
              <Input
                id="ws-name"
                value={name}
                onChange={(e) => setName(e.target.value)}
                onKeyDown={(e) => e.key === "Enter" && handleCreate()}
                placeholder="My Project"
                autoFocus
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="ws-desc">
                Description <span className="text-muted-foreground font-normal">(optional)</span>
              </Label>
              <Input
                id="ws-desc"
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                placeholder="What this workspace is for"
              />
            </div>
          </div>
          <Button onClick={handleCreate} disabled={busy}>
            {busy ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Plus className="mr-2 h-4 w-4" />}
            Create Workspace
          </Button>
        </div>
      )}

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
