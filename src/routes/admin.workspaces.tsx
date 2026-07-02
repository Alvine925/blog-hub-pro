import { createFileRoute, Outlet, useRouterState } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { queryOptions, useSuspenseQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { toast } from "sonner";
import { Plus, Trash2, Loader2, FolderOpen, ArrowRight, Globe, Clock } from "lucide-react";
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { listWorkspaces, deleteWorkspace, type Workspace } from "@/lib/workspace.functions";
import { CreateWorkspaceWizard } from "@/components/workspace/CreateWorkspaceWizard";

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

/** Pick the best preview image for a workspace.
 *  cover  → real site screenshot/hero, used as full object-cover background
 *  logo   → brand logo (often transparent PNG), shown large & centred on gradient
 *  favicon → tiny icon, shown centred on gradient
 */
function getPreviewImage(ws: Workspace):
  | { type: "cover";   url: string }
  | { type: "logo";    url: string; favicon?: string }
  | { type: "favicon"; url: string }
  | null {
  const siteImg = ws.ai_context?.siteImages?.[0];
  const logo    = ws.ai_context?.logoUrl;
  const favicon = getFaviconUrl(ws.website_url);

  // A real site screenshot makes the best cover
  if (siteImg) return { type: "cover", url: siteImg };
  // Logo gets its own centred treatment; pass favicon along for the bg tint
  if (logo) return { type: "logo", url: logo, favicon: favicon ?? undefined };
  // Just the favicon
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
        {/* Gradient — always the base */}
        <div className={`absolute inset-0 bg-gradient-to-br ${gradient}`} />

        {/* ── COVER: real site screenshot fills the whole area ── */}
        {preview?.type === "cover" && !imgError && (
          <img
            src={preview.url}
            alt={ws.name}
            onError={() => setImgError(true)}
            className="absolute inset-0 h-full w-full object-cover"
          />
        )}

        {/* ── LOGO: blurred favicon as soft bg tint + logo large & centred ── */}
        {preview?.type === "logo" && !imgError && (
          <>
            {/* optional favicon softly blurred into the gradient bg */}
            {preview.favicon && (
              <img
                src={preview.favicon}
                alt=""
                aria-hidden
                className="absolute inset-0 h-full w-full object-cover scale-[3] blur-2xl opacity-20"
              />
            )}
            {/* logo itself — fill most of the cover area, contained */}
            <div className="absolute inset-0 flex items-center justify-center p-6">
              <img
                src={preview.url}
                alt={ws.name}
                onError={() => setImgError(true)}
                className="max-h-full max-w-full object-contain drop-shadow-2xl"
              />
            </div>
          </>
        )}

        {/* ── FAVICON: large & centred on gradient ── */}
        {preview?.type === "favicon" && !imgError && (
          <>
            {/* blurred favicon as soft bg texture */}
            <img
              src={preview.url}
              alt=""
              aria-hidden
              className="absolute inset-0 h-full w-full object-cover scale-[3] blur-2xl opacity-25"
            />
            <div className="absolute inset-0 flex items-center justify-center">
              <img
                src={preview.url}
                alt={ws.name}
                onError={() => setImgError(true)}
                className="h-20 w-20 object-contain drop-shadow-2xl"
              />
            </div>
          </>
        )}

        {/* ── FALLBACK: initials ── */}
        {(!preview || imgError) && (
          <div className="absolute inset-0 flex items-center justify-center">
            <span className="text-5xl font-bold text-white/70 tracking-tight drop-shadow-lg select-none">
              {initials}
            </span>
          </div>
        )}

        {/* Bottom scrim for readability */}
        <div className="absolute inset-x-0 bottom-0 h-12 bg-gradient-to-t from-black/25 to-transparent" />

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
  const del = useServerFn(deleteWorkspace);

  const [wizardOpen, setWizardOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  const [pendingDelete, setPendingDelete] = useState<Workspace | null>(null);

  async function refresh() {
    await queryClient.invalidateQueries({ queryKey: ["admin", "workspaces"] });
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
          onClick={() => setWizardOpen(true)}
          className="flex shrink-0 items-center gap-1.5 rounded-md bg-primary px-3 py-1.5 text-sm font-medium text-primary-foreground hover:bg-primary/90 transition-colors"
        >
          <Plus className="h-3.5 w-3.5" /> New Workspace
        </button>
      </div>

      {/* Grid or empty state */}
      {workspaces.length === 0 ? (
        <div className="flex flex-col items-center gap-3 border-y border-border py-24 text-center">
          <FolderOpen className="h-8 w-8 text-muted-foreground/30" />
          <p className="text-sm font-medium">No workspaces yet</p>
          <p className="text-xs text-muted-foreground">Create your first workspace to get started.</p>
          <button
            type="button"
            onClick={() => setWizardOpen(true)}
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
            onClick={() => setWizardOpen(true)}
            className="group flex flex-col items-center justify-center gap-3 rounded-2xl border-2 border-dashed border-border/60 py-16 text-muted-foreground/40 transition-all duration-200 hover:border-primary/40 hover:text-primary/60 hover:bg-primary/[0.02]"
          >
            <div className="flex h-12 w-12 items-center justify-center rounded-xl border-2 border-dashed border-current transition-all group-hover:scale-110">
              <Plus className="h-5 w-5" />
            </div>
            <span className="text-xs font-medium">New Workspace</span>
          </button>
        </div>
      )}

      {/* Workspace creation wizard */}
      {wizardOpen && (
        <CreateWorkspaceWizard
          onClose={() => { setWizardOpen(false); refresh(); }}
        />
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
