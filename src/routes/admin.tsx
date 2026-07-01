import { createFileRoute, Link, Outlet, useRouterState, useNavigate } from "@tanstack/react-router";
import {
  LayoutDashboard, FileText, ImageIcon, Key, ExternalLink, Moon,
  Webhook, BarChart2, Settings, Search, Code2, Layers, Users,
  FolderOpen, CreditCard, Bell, Sparkles, Menu, X, ChevronRight,
  ChevronDown, Check, Loader2, LogOut,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { useState, useRef, useEffect } from "react";
import { useQuery } from "@tanstack/react-query";
import { listWorkspaces, type Workspace } from "@/lib/workspace.functions";
import { queryOptions } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

export const Route = createFileRoute("/admin")({
  head: () => ({
    meta: [
      { title: "Lunar CMS — Admin" },
      { name: "robots", content: "noindex, nofollow" },
    ],
  }),
  component: AdminLayoutGuard,
});

const STEP_ROUTES: Record<string, string> = {
  welcome:     "/onboarding/welcome",
  website:     "/onboarding/website",
  analyzing:   "/onboarding/analyzing",
  collections: "/onboarding/collections",
  preparing:   "/onboarding/preparing",
  complete:    "/admin/dashboard",
};

function AdminLayoutGuard() {
  const navigate = useNavigate();
  const [checking, setChecking] = useState(true);

  useEffect(() => {
    supabase.auth.getSession().then(async ({ data: { session } }) => {
      if (!session) {
        navigate({ to: "/login" });
        return;
      }

      // Enforce onboarding gate
      try {
        const { data } = await supabase
          .from("user_onboarding" as never)
          .select("step, completed_at")
          .eq("user_id", session.user.id)
          .maybeSingle() as { data: { step: string; completed_at: string | null } | null };

        if (!data || data.step !== "complete" || !data.completed_at) {
          // Send back to where they left off
          const step = data?.step ?? "welcome";
          const route = STEP_ROUTES[step] ?? "/onboarding/welcome";
          navigate({ to: route as "/" });
          return;
        }
      } catch {
        // If the table doesn't exist yet, let them through
      }

      setChecking(false);
    });

    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      if (!session) navigate({ to: "/login" });
    });

    return () => subscription.unsubscribe();
  }, [navigate]);

  if (checking) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-white">
        <Loader2 className="h-5 w-5 animate-spin text-zinc-400" />
      </div>
    );
  }

  return <AdminLayout />;
}

type NavItem = { label: string; to: string; icon: React.ComponentType<{ className?: string }> };
type NavSection = { label: string; items: NavItem[] };

const navSections: NavSection[] = [
  {
    label: "Content",
    items: [
      { label: "Dashboard", to: "/admin/dashboard", icon: LayoutDashboard },
      { label: "Blogs", to: "/admin/blogs", icon: FileText },
      { label: "Collections", to: "/admin/collections", icon: Layers },
      { label: "Media", to: "/admin/media", icon: ImageIcon },
    ],
  },
  {
    label: "Insights",
    items: [
      { label: "Analytics", to: "/admin/analytics", icon: BarChart2 },
      { label: "Search", to: "/admin/search", icon: Search },
    ],
  },
  {
    label: "Developers",
    items: [
      { label: "API Keys", to: "/admin/api-keys", icon: Key },
      { label: "API Explorer", to: "/admin/api-explorer", icon: Code2 },
      { label: "Webhooks", to: "/admin/webhooks", icon: Webhook },
    ],
  },
  {
    label: "Access",
    items: [
      { label: "Users & Roles", to: "/admin/users", icon: Users },
      { label: "Workspaces", to: "/admin/workspaces", icon: FolderOpen },
    ],
  },
  {
    label: "Account",
    items: [
      { label: "AI Assistant", to: "/admin/ai-assistant", icon: Sparkles },
      { label: "Notifications", to: "/admin/notifications", icon: Bell },
      { label: "Settings", to: "/admin/settings", icon: Settings },
      { label: "Billing", to: "/admin/billing", icon: CreditCard },
    ],
  },
];

const workspacesQuery = queryOptions({
  queryKey: ["admin", "workspaces"],
  queryFn: () => listWorkspaces(),
  staleTime: 60_000,
});

// Extract workspace id from pathname like /admin/workspaces/some-uuid
function extractWorkspaceId(pathname: string): string | null {
  const match = pathname.match(/^\/admin\/workspaces\/([^/]+)$/);
  return match ? match[1] : null;
}

function WorkspaceSwitcher({ pathname, onNavigate }: { pathname: string; onNavigate?: () => void }) {
  const { data: workspaces = [] } = useQuery(workspacesQuery);
  const navigate = useNavigate();
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  const activeWsId = extractWorkspaceId(pathname);
  const activeWs = workspaces.find((w) => w.id === activeWsId) ?? null;

  // Close on outside click
  useEffect(() => {
    function handle(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    }
    if (open) document.addEventListener("mousedown", handle);
    return () => document.removeEventListener("mousedown", handle);
  }, [open]);

  function handleSelect(ws: Workspace | null) {
    setOpen(false);
    onNavigate?.();
    if (ws) {
      navigate({ to: "/admin/workspaces/$id", params: { id: ws.id } });
    } else {
      navigate({ to: "/admin/dashboard" });
    }
  }

  return (
    <div className="px-3 pb-1" ref={ref}>
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className={cn(
          "group flex w-full items-center gap-2.5 rounded-lg border px-3 py-2 text-sm transition-all",
          open
            ? "border-primary/40 bg-primary/5 text-foreground"
            : "border-border bg-muted/40 text-muted-foreground hover:border-border hover:bg-muted hover:text-foreground",
        )}
      >
        {/* Workspace color dot */}
        <WsDot name={activeWs?.name ?? "all"} isAll={!activeWs} />

        <span className="flex-1 truncate text-left font-medium text-xs">
          {activeWs ? activeWs.name : "All Workspaces"}
        </span>

        <ChevronDown className={cn("h-3.5 w-3.5 shrink-0 transition-transform", open && "rotate-180")} />
      </button>

      {/* Dropdown */}
      {open && (
        <div className="absolute z-50 mt-1.5 w-52 overflow-hidden rounded-xl border border-border bg-background shadow-lg">
          {/* Main dashboard option */}
          <button
            type="button"
            onClick={() => handleSelect(null)}
            className={cn(
              "flex w-full items-center gap-2.5 px-3 py-2.5 text-sm transition-colors hover:bg-muted/60",
              !activeWs && "bg-primary/5 font-semibold text-primary",
            )}
          >
            <LayoutDashboard className="h-3.5 w-3.5 shrink-0" />
            <span className="flex-1 text-left">Main Dashboard</span>
            {!activeWs && <Check className="h-3.5 w-3.5 shrink-0" />}
          </button>

          {workspaces.length > 0 && (
            <>
              <div className="mx-3 my-1 border-t border-border/60" />
              <p className="px-3 pb-1 pt-0.5 text-[10px] font-bold uppercase tracking-widest text-muted-foreground/50">
                Workspaces
              </p>
              {workspaces.map((ws) => (
                <button
                  key={ws.id}
                  type="button"
                  onClick={() => handleSelect(ws)}
                  className={cn(
                    "flex w-full items-center gap-2.5 px-3 py-2 text-sm transition-colors hover:bg-muted/60",
                    activeWs?.id === ws.id && "bg-primary/5 font-semibold text-primary",
                  )}
                >
                  <WsDot name={ws.name} isAll={false} />
                  <span className="flex-1 truncate text-left">{ws.name}</span>
                  {activeWs?.id === ws.id && <Check className="h-3.5 w-3.5 shrink-0" />}
                </button>
              ))}
            </>
          )}

          {workspaces.length === 0 && (
            <p className="px-3 py-2 text-xs text-muted-foreground">No workspaces yet</p>
          )}

          <div className="mx-3 my-1 border-t border-border/60" />
          <Link
            to="/admin/workspaces"
            onClick={() => { setOpen(false); onNavigate?.(); }}
            className="flex w-full items-center gap-2.5 px-3 py-2 text-xs text-muted-foreground hover:bg-muted/60 hover:text-foreground transition-colors"
          >
            <FolderOpen className="h-3.5 w-3.5 shrink-0" />
            Manage workspaces
          </Link>
        </div>
      )}
    </div>
  );
}

const WS_COLORS = [
  "bg-red-500", "bg-orange-500", "bg-amber-500", "bg-emerald-500",
  "bg-teal-500", "bg-blue-500", "bg-violet-500", "bg-pink-500",
];
function WsDot({ name, isAll }: { name: string; isAll: boolean }) {
  if (isAll) return <div className="h-2.5 w-2.5 shrink-0 rounded-full bg-muted-foreground/40" />;
  let h = 0;
  for (const c of name) h = (h * 31 + c.charCodeAt(0)) & 0xffffffff;
  const cls = WS_COLORS[Math.abs(h) % WS_COLORS.length];
  return <div className={cn("h-2.5 w-2.5 shrink-0 rounded-full", cls)} />;
}

function NavLink({ item, pathname, onClick }: { item: NavItem; pathname: string; onClick?: () => void }) {
  const active = pathname === item.to || (item.to !== "/admin/dashboard" && pathname.startsWith(item.to));
  return (
    <Link
      to={item.to}
      onClick={onClick}
      className={cn(
        "group flex items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium transition-all duration-150",
        active
          ? "bg-primary text-primary-foreground shadow-sm"
          : "text-muted-foreground hover:bg-accent hover:text-foreground",
      )}
    >
      <item.icon className={cn("h-4 w-4 shrink-0 transition-transform", active ? "" : "group-hover:scale-110")} />
      <span>{item.label}</span>
      {active && <ChevronRight className="ml-auto h-3 w-3 opacity-60" />}
    </Link>
  );
}

function Sidebar({ pathname, onClose }: { pathname: string; onClose?: () => void }) {
  return (
    <div className="relative flex h-full flex-col bg-background">
      {/* Logo */}
      <div className="flex h-14 items-center gap-2.5 border-b border-border px-5">
        <div className="flex h-7 w-7 items-center justify-center rounded-lg bg-primary">
          <Moon className="h-4 w-4 text-primary-foreground" />
        </div>
        <span className="font-bold tracking-tight text-foreground">Lunar CMS</span>
        {onClose && (
          <button type="button" onClick={onClose} className="ml-auto text-muted-foreground hover:text-foreground md:hidden">
            <X className="h-5 w-5" />
          </button>
        )}
      </div>

      {/* Workspace switcher */}
      <div className="border-b border-border py-2">
        <WorkspaceSwitcher pathname={pathname} onNavigate={onClose} />
      </div>

      {/* Navigation */}
      <nav className="flex-1 overflow-y-auto p-3 space-y-5">
        {navSections.map((section) => (
          <div key={section.label}>
            <p className="mb-1.5 px-3 text-[10px] font-bold uppercase tracking-widest text-muted-foreground/60">
              {section.label}
            </p>
            <div className="space-y-0.5">
              {section.items.map((item) => (
                <NavLink key={item.to} item={item} pathname={pathname} onClick={onClose} />
              ))}
            </div>
          </div>
        ))}
      </nav>

      {/* Footer */}
      <div className="border-t border-border p-3 space-y-0.5">
        <Link
          to="/blogs"
          className="flex items-center gap-3 rounded-lg px-3 py-2 text-sm text-muted-foreground hover:bg-accent hover:text-foreground transition-colors"
        >
          <ExternalLink className="h-4 w-4 shrink-0" />
          View public blog
        </Link>
      </div>
    </div>
  );
}

function AdminLayout() {
  const pathname = useRouterState({ select: (s) => s.location.pathname });
  const [mobileOpen, setMobileOpen] = useState(false);

  // Build breadcrumb label — workspace dashboard gets its own label
  const activeWsId = extractWorkspaceId(pathname);
  const currentSection = navSections
    .flatMap((s) => s.items)
    .find((item) => pathname === item.to || (item.to !== "/admin/dashboard" && pathname.startsWith(item.to)));
  const breadcrumbLabel = activeWsId ? "Workspace" : currentSection?.label;

  return (
    <div className="flex min-h-screen w-full bg-muted/20">
      {/* Desktop sidebar */}
      <aside className="hidden w-60 shrink-0 flex-col border-r border-border md:flex">
        <Sidebar pathname={pathname} />
      </aside>

      {/* Mobile drawer */}
      {mobileOpen && (
        <>
          <div
            className="fixed inset-0 z-40 bg-black/40 backdrop-blur-sm md:hidden"
            onClick={() => setMobileOpen(false)}
          />
          <div className="fixed inset-y-0 left-0 z-50 w-72 md:hidden">
            <Sidebar pathname={pathname} onClose={() => setMobileOpen(false)} />
          </div>
        </>
      )}

      {/* Main content */}
      <div className="flex min-w-0 flex-1 flex-col">
        {/* Top header */}
        <header className="sticky top-0 z-30 flex h-14 items-center gap-3 border-b border-border bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60 px-4 md:px-6">
          <button
            type="button"
            onClick={() => setMobileOpen(true)}
            className="md:hidden text-muted-foreground hover:text-foreground"
          >
            <Menu className="h-5 w-5" />
          </button>

          {/* Breadcrumb */}
          <div className="flex items-center gap-2 text-sm">
            <span className="hidden text-muted-foreground md:block">Admin</span>
            {breadcrumbLabel && (
              <>
                <ChevronRight className="hidden h-3.5 w-3.5 text-muted-foreground md:block" />
                <span className="font-medium">{breadcrumbLabel}</span>
              </>
            )}
          </div>

          {/* Right actions */}
          <div className="ml-auto flex items-center gap-2">
            <Link
              to="/admin/notifications"
              className={cn(
                "relative flex h-8 w-8 items-center justify-center rounded-lg text-muted-foreground transition-colors hover:bg-accent hover:text-foreground",
                pathname.startsWith("/admin/notifications") && "bg-accent text-foreground",
              )}
              title="Notifications"
            >
              <Bell className="h-4 w-4" />
            </Link>
            <Link
              to="/admin/ai-assistant"
              className={cn(
                "flex h-8 w-8 items-center justify-center rounded-lg text-muted-foreground transition-colors hover:bg-accent hover:text-foreground",
                pathname.startsWith("/admin/ai-assistant") && "bg-accent text-foreground",
              )}
              title="AI Assistant"
            >
              <Sparkles className="h-4 w-4" />
            </Link>
            <Link
              to="/admin/blogs/new"
              className="hidden items-center gap-1.5 rounded-lg bg-primary px-3 py-1.5 text-xs font-semibold text-primary-foreground transition-colors hover:bg-primary/90 sm:flex"
            >
              <FileText className="h-3.5 w-3.5" />
              New post
            </Link>
          </div>
        </header>

        {/* Page content */}
        <main className="flex-1 p-4 md:p-8">
          <Outlet />
        </main>
      </div>
    </div>
  );
}
