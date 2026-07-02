import { createFileRoute, Outlet, useRouterState } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { queryOptions, useSuspenseQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { toast } from "sonner";
import { Plus, Trash2, Loader2, FolderOpen, ArrowRight, Globe, Clock } from "lucide-react";
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

// ── Color palette for gradient fallbacks ──────────────────────────────────────
const CARD_GRADIENTS = [
  "from-violet-600 to-indigo-700",
  "from-blue-600 to-cyan-700",
  "from-emerald-600 to-teal-700",
  "from-orange-500 to-rose-600",
  "from-pink-600 to-purple-700",
  "from-amber-500 to-orange-600",
  "from-sky-500 to-blue-700",
  "from-teal-500 to-emerald-700",
];

function wsGradient(name: string) {
  let h = 0;
  for (const c of name) h = (h * 31 + c.charCodeAt(0)) & 0xffffffff;
  return CARD_GRADIENTS[Math.abs(h) % CARD_GRADIENTS.length];
}

function wsInitials(name: string) {
  return name
    .split(/\s+/)
    .map((w) => w[0]?.toUpperCase() ?? "")
    .slice(0, 2)
    .join("");
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

/** Derive favicon URL from a website_url */
function getFaviconUrl(websiteUrl: string | null | undefined): string | null {
  if (!websiteUrl) return null;
  try {
    const { hostname } = new URL(
      websiteUrl.startsWith("http") ? websiteUrl : `https://${websiteUrl}`,
    );
    return `https://www.google.com/s2/favicons?domain=${hostname}&sz=128`;
  } catch {
    return null;
  }
}

/** Pick the best preview image for a workspace */
function getPreviewImage(ws: Workspace): { type: "image"; url: string } | { type: "favicon"; url: string } | null {
  // 1. Logo from AI context
  const logo = ws.ai_context?.logoUrl;
  if (logo) return { type: "image", url: logo };
  // 2. First site image from AI context
  const siteImg = ws.ai_context?.siteImages?.[0];
  if (siteImg) return { type: "image", url: siteImg };
  // 3. Favicon derived from website_url
  const favicon = getFaviconUrl(ws.website_url);
  if (favicon) return { type: "favicon", url: favicon };
  return null;
}

// ── Workspace Card ────────────────────────────────────────────────────────────
function WorkspaceCard({
  ws,
  onDelete,
}: {
  ws: Workspace;
  onDelete: (ws: Workspace) => void;
}) {
  const preview = getPreviewImage(ws);
  const gradient = wsGradient(ws.name);
  const initials = wsInitials(ws.name);
  const [imgError, setImgError] = useState(false);

  return (
    <div className="group relative flex flex-col overflow-hidden rounded-2xl transition-all duration-300 hover:-translate-y-1 hover:shadow-2xl hover:shadow-black/10">

      {/* ── Cover area ──────────────────────────────────────────────────────── */}
      <a
        href={`/admin/workspaces/${ws.id}`}
        className="relative block h-44 w-full overflow-hidden"
        tabIndex={-1}
        aria-hidden
      >
        {/* Gradient background always present */}
        <div className={`absolute inset-0 bg-gradient-to-br ${gradient}`} />

        {/* Site image as blurred background layer */}
        {preview?.type === "image" && !imgError && (
          <img
            src={preview.url}
            alt=""
            onError={() => setImgError(true)}
            className="absolute inset-0 h-full w-full object-cover opacity-30 blur-sm scale-110"
          />
        )}

        {/* Noise/grain overlay for depth */}
        <div className="absolute inset-0 bg-gradient-to-t from-black/40 via-transparent to-transparent" />

        {/* Centre preview: favicon or logo or initials */}
        <div className="absolute inset-0 flex items-center justify-center">
          {preview && !imgError ? (
            preview.type === "favicon" ? (
              <div className="flex h-16 w-16 items-center justify-center rounded-2xl bg-white/15 backdrop-blur-sm ring-1 ring-white/20 shadow-lg">
                <img
                  src={preview.url}
                  alt={ws.name}
                  onError={() => setImgError(true)}
                  className="h-10 w-10 object-contain"
                />
              </div>
            ) : (
              <div className="flex h-20 w-20 items-center justify-center rounded-2xl bg-white/15 backdrop-blur-sm ring-1 ring-white/20 shadow-lg p-2">
                <img
                  src={preview.url}
                  alt={ws.name}
                  onError={() => setImgError(true)}
                  className="h-full w-full object-contain"
                />
              </div>
            )
          ) : (
            <div className="flex h-16 w-16 items-center justify-center rounded-2xl bg-white/20 backdrop-blur-sm ring-1 ring-white/25 shadow-lg">
              <span className="text-2xl font-bold text-white tracking-tight">{initials}</span>
            </div>
          )}
        </div>

        {/* Default badge top-left */}
        {ws.slug === "default" && (
          <div className="absolute top-3 left-3 rounded-full bg-white/20 backdrop-blur-sm px-2.5 py-0.5 text-[10px] font-semibold uppercase tracking-wider text-white ring-1 ring-white/20">
            default
          </div>
        )}

        {/* Delete button top-right — on hover */}
        {ws.slug !== "default" && (
          <button
            type="button"
            onClick={(e) => { e.preventDefault(); onDelete(ws); }}
            title="Delete workspace"
            className="absolute top-3 right-3 flex h-7 w-7 items-center justify-center rounded-full bg-black/30 backdrop-blur-sm text-white/70 opacity-0 group-hover:opacity-100 hover:bg-red-500/80 hover:text-white transition-all duration-200"
          >
            <Trash2 className="h-3.5 w-3.5" />
          </button>
        )}
      </a>

      {/* ── Info area — sits directly on page background ─────────────────────── */}
      <div className="flex flex-1 flex-col gap-3 px-4 pt-3.5 pb-4">
        {/* Name + slug */}
        <div className="min-w-0 flex-1">
          <div className="flex items-start gap-2 flex-wrap">
            <h3 className="text-sm font-semibold text-foreground leading-tight truncate">
              {ws.name}
            </h3>
            <code className="mt-0.5 rounded-md bg-muted px-1.5 py-0.5 font-mono text-[10px] text-muted-foreground shrink-0">
              {ws.slug}
            </code>
          </div>

          {ws.description && (
            <p className="mt-1 text-xs text-muted-foreground line-clamp-2 leading-relaxed">
              {ws.description}
            </p>
          )}

          {/* Meta row */}
          <div className="mt-2 flex items-center gap-3 text-[10px] text-muted-foreground/60">
            {ws.website_url && (
              <span className="flex items-center gap-1 truncate max-w-[120px]">
                <Globe className="h-2.5 w-2.5 shrink-0" />
                <span className="truncate">
                  {ws.website_url.replace(/^https?:\/\//, "").replace(/\/$/, "")}
                </span>
              </span>
            )}
            {ws.industry && (
              <span className="rounded-md bg-muted px-1.5 py-0.5 font-medium capitalize">
                {ws.industry}
              </span>
            )}
          </div>
        </div>

        {/* Footer: last updated + open button */}
        <div className="flex items-center justify-between gap-2 pt-1 border-t border-border/60">
          <span className="flex items-center gap-1 text-[10px] text-muted-foreground/50">
            <Clock className="h-2.5 w-2.5" />
            {fmtDate(ws.updated_at)}
          </span>
          <a
            href={`/admin/workspaces/${ws.id}`}
            className="flex items-center gap-1 rounded-lg bg-primary px-2.5 py-1 text-[11px] font-medium text-primary-foreground hover:bg-primary/90 transition-colors shrink-0"
          >
            Open
            <ArrowRight className="h-3 w-3" />
          </a>
        </div>
      </div>
    </div>
  );
}

// ── Main page ─────────────────────────────────────────────────────────────────
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

      {/* Inline create form */}
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

      {/* Grid or empty state */}
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
        <div className="grid grid-cols-1 gap-5 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
          {workspaces.map((ws) => (
            <WorkspaceCard
              key={ws.id}
              ws={ws}
              onDelete={setPendingDelete}
            />
          ))}

          {/* "Add workspace" ghost card */}
          <button
            type="button"
            onClick={() => setFormOpen(true)}
            className="group flex flex-col items-center justify-center gap-3 rounded-2xl border-2 border-dashed border-border/60 py-16 text-muted-foreground/40 transition-all duration-200 hover:border-primary/40 hover:text-primary/60 hover:bg-primary/[0.02]"
          >
            <div className="flex h-12 w-12 items-center justify-center rounded-xl border-2 border-dashed border-current transition-all group-hover:scale-110">
              <Plus className="h-5 w-5" />
            </div>
            <span className="text-xs font-medium">New Workspace</span>
          </button>
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
