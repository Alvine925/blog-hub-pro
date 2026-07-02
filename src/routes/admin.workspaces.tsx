import { createFileRoute, Outlet, useRouterState } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { queryOptions, useSuspenseQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { toast } from "sonner";
import { Plus, Trash2, Loader2, FolderOpen, Clock, ArrowRight } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { listWorkspaces, createWorkspace, deleteWorkspace, type Workspace } from "@/lib/workspace.functions";

const wsQuery = queryOptions({
  queryKey: ["admin", "workspaces"],
  queryFn: () => listWorkspaces(),
});

export const Route = createFileRoute("/admin/workspaces")({
  head: () => ({ meta: [{ title: "Workspaces — Admin" }] }),
  loader: ({ context }) => context.queryClient.ensureQueryData(wsQuery),
  component: WorkspacesRouteGuard,
  errorComponent: ({ error }) => (
    <p className="text-sm text-destructive">Failed to load workspaces: {error.message}</p>
  ),
});

function WorkspacesRouteGuard() {
  const pathname = useRouterState({ select: (s) => s.location.pathname });
  if (/^\/admin\/workspaces\/[^/]/.test(pathname)) return <Outlet />;
  return <WorkspacesPage />;
}

const WS_COLORS = [
  "bg-red-500", "bg-orange-500", "bg-violet-500",
  "bg-blue-500", "bg-emerald-500", "bg-pink-500",
  "bg-indigo-500", "bg-teal-500",
];

function wsColor(name: string) {
  let h = 0;
  for (const c of name) h = (h * 31 + c.charCodeAt(0)) & 0xffffffff;
  return WS_COLORS[Math.abs(h) % WS_COLORS.length];
}

function fmtDate(d: string) {
  const ms = Date.now() - new Date(d).getTime();
  const m = Math.floor(ms / 60000);
  if (m < 1) return "just now";
  if (m < 60) return `${m}m ago`;
  const h = Math.floor(m / 60);
  if (h < 24) return `${h}h ago`;
  const days = Math.floor(h / 24);
  if (days < 7) return `${days}d ago`;
  return new Date(d).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" });
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
    <div className="min-h-full space-y-8">

      {/* Header */}
      <div className="flex items-start justify-between gap-4">
        <div>
          <h1 className="text-xl font-semibold">Workspaces</h1>
          <p className="mt-0.5 text-sm text-muted-foreground">
            Each workspace is an isolated namespace for your collections and content.
          </p>
        </div>
        <button
          type="button"
          onClick={() => setFormOpen(true)}
          className="flex shrink-0 items-center gap-1.5 rounded-md bg-primary px-3 py-1.5 text-sm font-medium text-primary-foreground hover:bg-primary/90 transition-colors"
        >
          <Plus className="h-3.5 w-3.5" /> New Workspace
        </button>
      </div>

      {/* Inline create form — flat, no card */}
      {formOpen && (
        <div className="border-b border-border pb-6 space-y-4">
          <div className="flex items-center justify-between">
            <h2 className="text-sm font-medium">New workspace</h2>
            <button
              type="button"
              onClick={() => { setFormOpen(false); setName(""); setDescription(""); }}
              className="text-xs text-muted-foreground hover:text-foreground transition-colors"
            >
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
                Description <span className="font-normal text-muted-foreground">(optional)</span>
              </Label>
              <Input
                id="ws-desc"
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                placeholder="What this workspace is for"
              />
            </div>
          </div>
          <button
            type="button"
            onClick={handleCreate}
            disabled={busy}
            className="flex items-center gap-1.5 rounded-md bg-primary px-3 py-1.5 text-sm font-medium text-primary-foreground hover:bg-primary/90 transition-colors disabled:opacity-60"
          >
            {busy ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Plus className="h-3.5 w-3.5" />}
            Create Workspace
          </button>
        </div>
      )}

      {/* Workspace list — flat, no card wrapper */}
      {workspaces.length === 0 ? (
        <div className="flex flex-col items-center gap-3 border-y border-border py-24 text-center">
          <FolderOpen className="h-8 w-8 text-muted-foreground/30" />
          <p className="text-sm font-medium">No workspaces yet</p>
          <p className="text-xs text-muted-foreground">Create your first workspace to get started.</p>
          <button
            type="button"
            onClick={() => setFormOpen(true)}
            className="mt-1 flex items-center gap-1.5 rounded-md bg-primary px-3 py-1.5 text-sm font-medium text-primary-foreground hover:bg-primary/90 transition-colors"
          >
            <Plus className="h-3.5 w-3.5" /> Create Workspace
          </button>
        </div>
      ) : (
        <div>
          {/* Column headers */}
          <div className="flex items-center justify-between border-b border-border pb-2 text-[10px] font-semibold uppercase tracking-widest text-muted-foreground/60">
            <span>Workspace</span>
            <span>Action</span>
          </div>

          {/* Rows — directly on background */}
          {workspaces.map((ws) => {
            const initials = ws.name.slice(0, 2).toUpperCase();
            return (
              <div
                key={ws.id}
                className="group flex items-center gap-4 border-b border-border py-4 last:border-0 hover:bg-muted/20 -mx-2 px-2 transition-colors"
              >
                {/* Avatar */}
                <div className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-md text-xs font-bold text-white ${wsColor(ws.name)}`}>
                  {initials}
                </div>

                {/* Info */}
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="text-sm font-medium text-foreground">{ws.name}</span>
                    {ws.slug === "default" && (
                      <span className="rounded-full bg-muted px-1.5 py-0.5 text-[10px] font-medium text-muted-foreground">
                        default
                      </span>
                    )}
                    <code className="rounded bg-muted px-1.5 py-0.5 font-mono text-[10px] text-muted-foreground">
                      {ws.slug}
                    </code>
                  </div>
                  {ws.description && (
                    <p className="mt-0.5 truncate text-xs text-muted-foreground max-w-lg">{ws.description}</p>
                  )}
                  <p className="mt-0.5 flex items-center gap-1 text-[10px] text-muted-foreground/50">
                    <Clock className="h-2.5 w-2.5" />
                    Updated {fmtDate(ws.updated_at)}
                  </p>
                </div>

                {/* Delete — on hover */}
                {ws.slug !== "default" && (
                  <button
                    type="button"
                    onClick={() => setPendingDelete(ws)}
                    title="Delete workspace"
                    className="opacity-0 group-hover:opacity-100 flex h-7 w-7 items-center justify-center rounded text-muted-foreground/40 hover:bg-red-50 hover:text-red-500 transition-all"
                  >
                    <Trash2 className="h-3.5 w-3.5" />
                  </button>
                )}

                {/* Open Dashboard */}
                <a
                  href={`/admin/workspaces/${ws.id}`}
                  className="flex shrink-0 items-center gap-1.5 rounded-md bg-primary px-3 py-1.5 text-sm font-medium text-primary-foreground hover:bg-primary/90 transition-colors"
                >
                  Open Dashboard
                  <ArrowRight className="h-3.5 w-3.5" />
                </a>
              </div>
            );
          })}
        </div>
      )}

      {/* Delete confirmation */}
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
              {busy ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
              Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
