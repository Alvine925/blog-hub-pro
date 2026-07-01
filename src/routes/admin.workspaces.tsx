import { createFileRoute, Outlet, useRouterState } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { queryOptions, useSuspenseQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { toast } from "sonner";
import {
  Plus, Trash2, Loader2, FolderOpen, Clock, ArrowRight,
} from "lucide-react";
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

// If a specific workspace is selected, pass through to child route (WorkspaceShell).
// Otherwise render the workspaces list.
function WorkspacesRouteGuard() {
  const pathname = useRouterState({ select: (s) => s.location.pathname });
  if (/^\/admin\/workspaces\/[^/]/.test(pathname)) return <Outlet />;
  return <WorkspacesPage />;
}

const WS_GRADIENTS = [
  "from-red-500 to-rose-600",
  "from-orange-500 to-amber-600",
  "from-violet-500 to-purple-600",
  "from-blue-500 to-cyan-600",
  "from-emerald-500 to-teal-600",
  "from-pink-500 to-fuchsia-600",
  "from-indigo-500 to-blue-600",
  "from-green-500 to-emerald-600",
];

function wsGradient(name: string) {
  let h = 0;
  for (const c of name) h = (h * 31 + c.charCodeAt(0)) & 0xffffffff;
  return WS_GRADIENTS[Math.abs(h) % WS_GRADIENTS.length];
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
    <div className="min-h-full px-8 py-8 space-y-8">

      {/* ── Header ── */}
      <div className="flex items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Workspaces</h1>
          <p className="mt-0.5 text-sm text-muted-foreground">
            Each workspace is an isolated namespace for your collections and content.
          </p>
        </div>
        <button
          type="button"
          onClick={() => setFormOpen(true)}
          className="flex shrink-0 items-center gap-2 rounded-lg bg-primary px-4 py-2 text-sm font-semibold text-white shadow-sm hover:bg-primary/90 transition-colors"
        >
          <Plus className="h-4 w-4" /> New Workspace
        </button>
      </div>

      {/* ── Create form ── */}
      {formOpen && (
        <div className="rounded-xl border border-primary/20 bg-primary/5 p-6 shadow-sm space-y-5">
          <div className="flex items-center justify-between">
            <h2 className="text-sm font-semibold">Create Workspace</h2>
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
            className="flex items-center gap-2 rounded-lg bg-primary px-4 py-2 text-sm font-semibold text-white hover:bg-primary/90 transition-colors disabled:opacity-60"
          >
            {busy
              ? <Loader2 className="h-4 w-4 animate-spin" />
              : <Plus className="h-4 w-4" />}
            Create Workspace
          </button>
        </div>
      )}

      {/* ── Workspace list ── */}
      {workspaces.length === 0 ? (
        <div className="flex flex-col items-center gap-3 rounded-xl border border-dashed border-border py-24 text-center">
          <FolderOpen className="h-10 w-10 text-muted-foreground/30" />
          <p className="text-sm font-medium">No workspaces yet</p>
          <p className="text-xs text-muted-foreground">Create your first workspace to get started.</p>
          <button
            type="button"
            onClick={() => setFormOpen(true)}
            className="mt-1 flex items-center gap-2 rounded-lg bg-primary px-4 py-2 text-sm font-semibold text-white hover:bg-primary/90 transition-colors"
          >
            <Plus className="h-4 w-4" /> Create Workspace
          </button>
        </div>
      ) : (
        <div className="rounded-xl border border-border bg-white shadow-sm overflow-hidden">
          {/* Table header */}
          <div className="grid grid-cols-[1fr_auto] items-center border-b border-border bg-muted/40 px-5 py-2.5">
            <p className="text-[11px] font-semibold uppercase tracking-widest text-muted-foreground">Workspace</p>
            <p className="text-[11px] font-semibold uppercase tracking-widest text-muted-foreground">Action</p>
          </div>

          {/* Rows */}
          <div className="divide-y divide-border">
            {workspaces.map((ws) => {
              const gradient = wsGradient(ws.name);
              const initials = ws.name.slice(0, 2).toUpperCase();

              return (
                <div
                  key={ws.id}
                  className="group flex items-center gap-4 px-5 py-4 hover:bg-muted/20 transition-colors"
                >
                  {/* Avatar */}
                  <div className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-gradient-to-br text-xs font-bold text-white shadow-sm ${gradient}`}>
                    {initials}
                  </div>

                  {/* Info — this is the "background" content */}
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2">
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
                      <p className="mt-0.5 truncate text-xs text-muted-foreground">{ws.description}</p>
                    )}
                    <p className="mt-0.5 flex items-center gap-1 text-[11px] text-muted-foreground/60">
                      <Clock className="h-2.5 w-2.5" />
                      Updated {fmtDate(ws.updated_at)}
                    </p>
                  </div>

                  {/* Delete — subtle, appears on hover */}
                  {ws.slug !== "default" && (
                    <button
                      type="button"
                      onClick={() => setPendingDelete(ws)}
                      title="Delete workspace"
                      className="opacity-0 group-hover:opacity-100 flex h-7 w-7 items-center justify-center rounded-lg text-muted-foreground/40 hover:bg-red-50 hover:text-red-500 transition-all"
                    >
                      <Trash2 className="h-3.5 w-3.5" />
                    </button>
                  )}

                  {/* ── Main CTA: Open Dashboard ── */}
                  <a
                    href={`/admin/workspaces/${ws.id}`}
                    className="flex shrink-0 items-center gap-2 rounded-lg bg-primary px-4 py-2 text-sm font-semibold text-white shadow-sm hover:bg-primary/90 transition-colors"
                  >
                    Open Dashboard
                    <ArrowRight className="h-3.5 w-3.5" />
                  </a>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* ── Delete confirmation ── */}
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
