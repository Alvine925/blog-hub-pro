import { useState } from "react";
import {
  createFileRoute, Link, Outlet, useRouterState, useNavigate,
} from "@tanstack/react-router";
import { createServerFn } from "@tanstack/react-start";
import {
  LayoutDashboard, FileText, Layers, ImageIcon, Key, Webhook,
  BarChart2, Bell, Settings, Code2, Sparkles,
  ChevronLeft, ExternalLink, LogOut, Plus, Search, ChevronRight, Info, Plug, Zap, BookOpen, MessageSquare,
  HelpCircle, Newspaper, Package, GraduationCap, Menu, X,
} from "lucide-react";
import { cn } from "@/lib/utils";
import type { Workspace } from "@/lib/workspace.functions";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

// ── Server fn ─────────────────────────────────────────────────────────────────
const getWorkspaceById = createServerFn({ method: "GET" })
  .validator((input: { id: string }) => input)
  .handler(async ({ data }): Promise<Workspace> => {
    const { getAdminClient } = await import("@/lib/supabase.server");
    const db = getAdminClient() as any;
    const { data: ws, error } = await db
      .from("workspaces")
      .select("*")
      .eq("id", data.id)
      .single();
    if (error || !ws) throw new Error("Workspace not found");
    return ws as Workspace;
  });

// ── Route ─────────────────────────────────────────────────────────────────────
export const Route = createFileRoute("/admin/workspaces/$id")({
  loader: async ({ params }) => {
    const workspace = await getWorkspaceById({ data: { id: params.id } });
    return { workspace };
  },
  component: WorkspaceShell,
  errorComponent: WorkspaceError,
});

// ── Color helpers ─────────────────────────────────────────────────────────────
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

// ── Nav groups ────────────────────────────────────────────────────────────────
type NavItem  = { label: string; to: string; icon: React.ComponentType<{ className?: string }> };
type NavGroup = { group: string; items: NavItem[] };

function buildNav(id: string): NavGroup[] {
  const base = `/admin/workspaces/${id}`;
  return [
    {
      group: "Overview",
      items: [
        { label: "Dashboard", to: base,          icon: LayoutDashboard },
        { label: "About",     to: `${base}/about`, icon: Info           },
      ],
    },
    {
      group: "Content",
      items: [
        { label: "Blog Posts",    to: `${base}/blogs`,        icon: FileText       },
        { label: "Articles",      to: `${base}/articles`,     icon: GraduationCap  },
        { label: "News",          to: `${base}/news`,         icon: Newspaper      },
        { label: "Products",      to: `${base}/products`,     icon: Package        },
        { label: "FAQs",          to: `${base}/faqs`,         icon: HelpCircle     },
        { label: "Comments",      to: `${base}/comments`,     icon: MessageSquare  },
        { label: "Collections",   to: `${base}/collections`,  icon: Layers         },
        { label: "Media Library", to: `${base}/media`,        icon: ImageIcon      },
      ],
    },
    {
      group: "Tools",
      items: [
        { label: "AI Assistant",  to: `${base}/ai-assistant`, icon: Sparkles   },
        { label: "API Keys",           to: `${base}/api-keys`,             icon: Key     },
        { label: "Webhooks",           to: `${base}/webhooks`,             icon: Webhook },
        { label: "Cache Invalidation", to: `${base}/cache-invalidation`,   icon: Zap     },
        { label: "Integration Center", to: `${base}/integration-center`,   icon: Plug    },
      ],
    },
    {
      group: "Insights",
      items: [
        { label: "Analytics",     to: `${base}/analytics`,    icon: BarChart2  },
        { label: "Notifications", to: `${base}/notifications`, icon: Bell      },
      ],
    },
    {
      group: "System",
      items: [
        { label: "Settings",      to: `${base}/settings`,     icon: Settings   },
      ],
    },
  ];
}

// ── Error component (keeps minimal nav) ───────────────────────────────────────
function WorkspaceError({ error }: { error: Error }) {
  return (
    <div className="flex h-screen items-center justify-center bg-background">
      <div className="text-center space-y-4">
        <div className="flex h-12 w-12 items-center justify-center rounded-full bg-red-100 mx-auto">
          <span className="text-xl">⚠</span>
        </div>
        <div>
          <p className="font-semibold text-foreground">Failed to load workspace</p>
          <p className="mt-1 text-sm text-muted-foreground">{error.message}</p>
        </div>
        <Link
          to="/admin/workspaces"
          className="inline-flex items-center gap-2 rounded-lg bg-primary px-4 py-2 text-sm font-semibold text-white hover:bg-primary/90 transition-colors"
        >
          <ChevronLeft className="h-4 w-4" /> Back to Workspaces
        </Link>
      </div>
    </div>
  );
}

// ── Sidebar ───────────────────────────────────────────────────────────────────
function WorkspaceSidebar({
  workspace,
  sidebarOpen,
  onClose,
}: {
  workspace: Workspace;
  sidebarOpen: boolean;
  onClose: () => void;
}) {
  const { id } = Route.useParams();
  const pathname = useRouterState({ select: (s) => s.location.pathname });
  const navigate  = useNavigate();
  const groups    = buildNav(id);
  const gradient  = wsGradient(workspace.name);

  // Derive workspace icon: scraped logo → Google favicon → gradient initials
  const logoUrl: string | null = workspace.ai_context?.logoUrl ?? null;
  const faviconDomain = (() => {
    try { return workspace.website_url ? new URL(workspace.website_url).hostname : null; }
    catch { return workspace.website_url ?? null; }
  })();
  const faviconUrl: string | null = faviconDomain
    ? `https://www.google.com/s2/favicons?domain=${faviconDomain}&sz=64`
    : null;

  function isActive(to: string) {
    const base = `/admin/workspaces/${id}`;
    if (to === base) return pathname === base || pathname === `${base}/`;
    return pathname.startsWith(to);
  }

  async function handleSignOut() {
    await supabase.auth.signOut();
    toast.success("Signed out");
    navigate({ to: "/login" });
  }

  return (
    <aside className={cn(
      "fixed inset-y-0 left-0 z-40 flex h-screen w-72 shrink-0 flex-col border-r border-border bg-white transition-transform duration-200 ease-in-out",
      "md:relative md:w-60 md:translate-x-0",
      sidebarOpen ? "translate-x-0" : "-translate-x-full",
    )}>

      {/* ── Workspace header ── */}
      <div className="shrink-0 border-b border-border px-4 py-3">
        <div className="flex items-center justify-between">
          <Link
            to="/admin/workspaces"
            className="mb-3 flex items-center gap-1 text-xs font-medium text-muted-foreground hover:text-primary transition-colors"
          >
            <ChevronLeft className="h-3 w-3" /> All workspaces
          </Link>
          <button
            type="button"
            onClick={onClose}
            className="mb-3 flex h-6 w-6 items-center justify-center rounded text-muted-foreground hover:bg-muted md:hidden"
          >
            <X className="h-3.5 w-3.5" />
          </button>
        </div>
        <div className="flex items-center gap-3">
          {/* Logo image (scraped or favicon) – falls back to gradient initials */}
          {(logoUrl || faviconUrl) ? (
            <img
              src={logoUrl ?? faviconUrl!}
              alt={workspace.name}
              className="h-9 w-9 shrink-0 rounded-lg object-contain bg-muted p-0.5"
              onError={(e) => {
                const img = e.currentTarget;
                if (faviconUrl && img.src !== faviconUrl) {
                  img.src = faviconUrl;
                } else {
                  img.style.display = "none";
                  const sib = img.nextElementSibling as HTMLElement | null;
                  if (sib) sib.style.display = "flex";
                }
              }}
            />
          ) : null}
          {/* Gradient initials fallback (hidden when image loads) */}
          <div
            className={cn(
              "h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-gradient-to-br text-sm font-bold text-white shadow-sm",
              gradient,
            )}
            style={{ display: (logoUrl || faviconUrl) ? "none" : "flex" }}
          >
            {workspace.name.slice(0, 2).toUpperCase()}
          </div>
          <div className="min-w-0">
            <p className="truncate text-sm font-semibold leading-snug">{workspace.name}</p>
            <p className="font-mono text-[10px] text-muted-foreground truncate">{workspace.slug}</p>
          </div>
        </div>
      </div>

      {/* ── Navigation ── */}
      <nav className="flex-1 overflow-y-auto py-3 px-2">
        {groups.map((g) => (
          <div key={g.group} className="mb-4">
            <p className="mb-1 px-2 text-[9px] font-bold uppercase tracking-widest text-muted-foreground/50">
              {g.group}
            </p>
            {g.items.map((item) => {
              const active = isActive(item.to);
              return (
                <Link
                  key={item.label}
                  to={item.to}
                  onClick={onClose}
                  className={cn(
                    "flex items-center gap-2.5 rounded-md px-2.5 py-2 text-sm font-medium transition-colors",
                    active
                      ? "bg-primary/10 text-primary"
                      : "text-muted-foreground hover:bg-muted hover:text-foreground",
                  )}
                >
                  <item.icon className={cn("h-4 w-4 shrink-0", active && "text-primary")} />
                  {item.label}
                  {active && <ChevronRight className="ml-auto h-3 w-3 opacity-60" />}
                </Link>
              );
            })}
          </div>
        ))}
      </nav>

      {/* ── Footer ── */}
      <div className="shrink-0 border-t border-border px-2 py-2 space-y-0.5">
        <Link
          to="/blogs"
          className="flex items-center gap-2.5 rounded-md px-2.5 py-2 text-sm font-medium text-muted-foreground hover:bg-muted hover:text-foreground transition-colors"
        >
          <ExternalLink className="h-4 w-4 shrink-0" />
          Public blog
        </Link>
        <button
          type="button"
          onClick={handleSignOut}
          className="flex w-full items-center gap-2.5 rounded-md px-2.5 py-2 text-sm font-medium text-muted-foreground hover:bg-red-50 hover:text-red-600 transition-colors"
        >
          <LogOut className="h-4 w-4 shrink-0" />
          Sign out
        </button>
      </div>
    </aside>
  );
}

// ── Top header inside workspace ───────────────────────────────────────────────
function WorkspaceHeader({
  workspace,
  onOpenSidebar,
}: {
  workspace: Workspace;
  onOpenSidebar: () => void;
}) {
  const pathname = useRouterState({ select: (s) => s.location.pathname });
  const { id } = Route.useParams();

  // Derive page label from current path
  const base = `/admin/workspaces/${id}`;
  const groups = buildNav(id);
  const allItems = groups.flatMap((g) => g.items);
  const active = allItems.find((item) => {
    if (item.to === base) return pathname === base || pathname === `${base}/`;
    return pathname.startsWith(item.to);
  });
  const pageLabel = active?.label ?? "Overview";

  return (
    <header className="flex h-14 shrink-0 items-center justify-between border-b border-border bg-white px-3 sm:px-6">
      {/* Left: hamburger + breadcrumb */}
      <div className="flex items-center gap-2">
        <button
          type="button"
          onClick={onOpenSidebar}
          className="flex h-8 w-8 items-center justify-center rounded-lg text-muted-foreground hover:bg-muted md:hidden"
        >
          <Menu className="h-4 w-4" />
        </button>
        <div className="flex items-center gap-2 text-sm text-muted-foreground">
          <span className="hidden font-medium text-foreground sm:block">{workspace.name}</span>
          <span className="hidden sm:block">/</span>
          <span>{pageLabel}</span>
        </div>
      </div>

      {/* Actions */}
      <div className="flex items-center gap-1 sm:gap-2">
        {/* Search */}
        <button className="flex items-center gap-2 rounded-lg border border-border bg-muted/50 px-3 py-1.5 text-xs text-muted-foreground hover:bg-muted transition-colors">
          <Search className="h-3.5 w-3.5" />
          <span className="hidden sm:inline">Search...</span>
          <kbd className="hidden sm:inline ml-1 rounded bg-white border border-border px-1 font-mono text-[10px]">⌘K</kbd>
        </button>

        {/* Notifications */}
        <Link
          to={`${base}/notifications`}
          className="flex h-8 w-8 items-center justify-center rounded-lg text-muted-foreground hover:bg-muted hover:text-foreground transition-colors"
        >
          <Bell className="h-4 w-4" />
        </Link>

        {/* Create button */}
        <Link
          to="/admin/blogs/new"
          className="flex items-center gap-1.5 rounded-lg bg-primary px-3 py-1.5 text-sm font-semibold text-white hover:bg-primary/90 transition-colors shadow-sm"
        >
          <Plus className="h-3.5 w-3.5" />
          <span className="hidden sm:inline">Create</span>
        </Link>
      </div>
    </header>
  );
}

// ── Shell ─────────────────────────────────────────────────────────────────────
function WorkspaceShell() {
  const { workspace } = Route.useLoaderData();
  const [sidebarOpen, setSidebarOpen] = useState(false);

  return (
    <div className="flex h-screen overflow-hidden bg-background">
      {/* Mobile backdrop */}
      {sidebarOpen && (
        <div
          className="fixed inset-0 z-30 bg-black/40 md:hidden"
          onClick={() => setSidebarOpen(false)}
        />
      )}

      {/* Left sidebar */}
      <WorkspaceSidebar
        workspace={workspace}
        sidebarOpen={sidebarOpen}
        onClose={() => setSidebarOpen(false)}
      />

      {/* Right: header + page content */}
      <div className="flex min-w-0 flex-1 flex-col overflow-hidden">
        <WorkspaceHeader
          workspace={workspace}
          onOpenSidebar={() => setSidebarOpen(true)}
        />
        <main className="flex-1 overflow-y-auto flex flex-col">
          <Outlet />
        </main>
      </div>
    </div>
  );
}
