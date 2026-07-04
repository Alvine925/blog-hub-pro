import { createFileRoute, Link, Outlet, useRouterState, useNavigate } from "@tanstack/react-router";
import { Suspense } from "react";
import {
  LayoutDashboard, Moon, FolderOpen, CreditCard, Settings, ChevronRight,
  LogOut, Bell, BookOpen, HelpCircle, Map, FileText, Users,
  ChevronDown, User, Key, ScrollText, Plug, MessageSquare,
  Sparkles, X, Menu,
} from "lucide-react";
import { Skeleton } from "@/components/ui/skeleton";
import { AiAssistant } from "@/components/dashboard/AiAssistant";
import { cn } from "@/lib/utils";
import { useState, useEffect, useRef } from "react";
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

// ── Full-page skeletons (shown during auth check on first load) ────────────────

function GlobalSidebarSkeleton() {
  return (
    <aside className="flex w-56 shrink-0 flex-col border-r border-border bg-background">
      <div className="flex h-14 items-center gap-2.5 border-b border-border px-4 shrink-0">
        <div className="flex h-7 w-7 items-center justify-center rounded-lg bg-primary">
          <Moon className="h-4 w-4 text-white" />
        </div>
        <span className="text-sm font-semibold tracking-tight">Lunar CMS</span>
      </div>
      <nav className="flex-1 overflow-hidden py-3 px-3 space-y-1">
        {["w-full","w-4/5","w-3/4","w-full","w-4/5","w-3/4","w-full","w-4/5","w-3/4","w-full","w-4/5","w-3/4"].map((w, i) => (
          <Skeleton key={i} className={`h-7 ${w} rounded-md`} />
        ))}
      </nav>
      <div className="shrink-0 border-t border-border p-3 space-y-2">
        <Skeleton className="h-8 w-full rounded-lg" />
        <Skeleton className="h-7 w-3/4 rounded-md" />
      </div>
    </aside>
  );
}

function GlobalHeaderSkeleton() {
  return (
    <header className="flex h-14 shrink-0 items-center justify-between border-b border-border bg-background px-6">
      <Skeleton className="h-4 w-24 rounded-md" />
      <div className="flex items-center gap-2">
        <Skeleton className="h-8 w-24 rounded-lg" />
        <Skeleton className="h-8 w-8 rounded-lg" />
        <Skeleton className="h-8 w-8 rounded-full" />
      </div>
    </header>
  );
}

function DashboardContentSkeleton() {
  return (
    <div className="space-y-6 p-4 sm:space-y-10 sm:p-8">
      <div className="flex items-start justify-between gap-4">
        <div className="space-y-2">
          <Skeleton className="h-6 w-32" />
          <Skeleton className="h-4 w-48 sm:w-64" />
        </div>
        <Skeleton className="h-8 w-24 sm:w-28 rounded-md" />
      </div>
      <div className="grid grid-cols-2 divide-border border border-border rounded-lg overflow-hidden sm:grid-cols-3 md:flex md:divide-x md:border-0 md:border-y md:rounded-none">
        {[...Array(5)].map((_, i) => (
          <div key={i} className={cn(
            "flex-1 px-4 py-4 sm:px-5 sm:py-5 space-y-2",
            i > 0 && "border-t border-border md:border-t-0",
            i % 2 !== 0 && "border-l border-border md:border-l-0",
          )}>
            <Skeleton className="h-7 w-10" />
            <Skeleton className="h-3 w-16" />
          </div>
        ))}
      </div>
      <Skeleton className="h-20 w-full rounded-lg" />
      <div className="grid gap-6 sm:gap-10 lg:grid-cols-[1fr_280px]">
        <div className="space-y-6 sm:space-y-10">
          {[...Array(3)].map((_, s) => (
            <div key={s} className="space-y-3">
              <div className="flex items-center justify-between border-b border-border pb-3">
                <Skeleton className="h-3 w-28" />
                <Skeleton className="h-3 w-14" />
              </div>
              {[...Array(5)].map((_, i) => (
                <div key={i} className="flex items-center gap-3 border-b border-border py-3 last:border-0">
                  <Skeleton className="h-2 w-2 rounded-full shrink-0" />
                  <Skeleton className="h-3 flex-1" />
                  <Skeleton className="h-3 w-16 hidden sm:block" />
                  <Skeleton className="h-3 w-10" />
                </div>
              ))}
            </div>
          ))}
        </div>
        <div className="rounded-lg border border-border p-4 space-y-4">
          <Skeleton className="h-5 w-32" />
          <Skeleton className="h-4 w-full" />
          <Skeleton className="h-4 w-5/6" />
          {[...Array(4)].map((_, i) => (
            <Skeleton key={i} className="h-9 w-full rounded-lg" />
          ))}
          <Skeleton className="h-24 w-full rounded-lg" />
        </div>
      </div>
    </div>
  );
}

function WorkspaceSidebarSkeleton() {
  return (
    <aside className="flex w-52 shrink-0 flex-col border-r border-border bg-background">
      <div className="flex h-14 items-center gap-2.5 border-b border-border px-4 shrink-0">
        <Skeleton className="h-8 w-8 rounded-lg shrink-0" />
        <Skeleton className="h-4 w-24" />
      </div>
      <nav className="flex-1 overflow-hidden py-3 px-3 space-y-1">
        {[...Array(14)].map((_, i) => (
          <Skeleton key={i} className={`h-7 rounded-md ${i % 3 === 0 ? "w-full" : i % 3 === 1 ? "w-4/5" : "w-3/4"}`} />
        ))}
      </nav>
      <div className="shrink-0 border-t border-border p-3">
        <Skeleton className="h-8 w-full rounded-lg" />
      </div>
    </aside>
  );
}

function WorkspaceOverviewContentSkeleton() {
  return (
    <div className="space-y-8 p-4 sm:space-y-12 sm:p-8">
      <div className="flex items-start justify-between gap-4">
        <div className="space-y-2">
          <Skeleton className="h-6 w-28" />
          <Skeleton className="h-4 w-72" />
        </div>
        <Skeleton className="h-9 w-28 rounded-lg" />
      </div>
      <div className="grid grid-cols-4 gap-x-8 gap-y-6 sm:grid-cols-7">
        {[...Array(7)].map((_, i) => (
          <div key={i} className="space-y-1.5">
            <Skeleton className="h-7 w-12" />
            <Skeleton className="h-3 w-16" />
          </div>
        ))}
      </div>
      <div className="space-y-2">
        <Skeleton className="h-1.5 w-full rounded-full" />
        <div className="flex items-center gap-5">
          <Skeleton className="h-3 w-24" />
          <Skeleton className="h-3 w-24" />
          <Skeleton className="h-3 w-16" />
        </div>
      </div>
      <div className="grid gap-10 lg:grid-cols-3">
        {[...Array(3)].map((_, col) => (
          <div key={col} className="space-y-4">
            <div className="border-b border-border pb-3">
              <Skeleton className="h-3 w-24" />
            </div>
            <div className="space-y-5">
              {[...Array(4)].map((_, i) => (
                <div key={i} className="space-y-1.5">
                  <Skeleton className="h-4 w-full" />
                  <Skeleton className="h-3 w-3/4" />
                  <div className="flex gap-1.5 pt-1">
                    <Skeleton className="h-5 w-16 rounded-full" />
                    <Skeleton className="h-5 w-14 rounded-full" />
                  </div>
                </div>
              ))}
            </div>
          </div>
        ))}
      </div>
      <div className="grid gap-12 lg:grid-cols-[1fr_260px]">
        <div className="space-y-3">
          <div className="flex items-center justify-between border-b border-border pb-3">
            <Skeleton className="h-3 w-28" />
            <Skeleton className="h-3 w-14" />
          </div>
          {[...Array(6)].map((_, i) => (
            <div key={i} className="flex items-center gap-3 py-2.5 border-b border-border/60 last:border-0">
              <Skeleton className="h-3 flex-1" />
              <Skeleton className="h-4 w-20 rounded-full" />
              <Skeleton className="h-3 w-16" />
            </div>
          ))}
        </div>
        <div className="space-y-4">
          <div className="border-b border-border pb-3">
            <Skeleton className="h-3 w-16" />
          </div>
          {[...Array(5)].map((_, i) => (
            <div key={i} className="flex items-start gap-3">
              <Skeleton className="h-5 w-5 rounded-full shrink-0" />
              <div className="space-y-1.5 flex-1">
                <Skeleton className="h-3 w-full" />
                <Skeleton className="h-2.5 w-16" />
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

function GenericContentSkeleton() {
  return (
    <div className="space-y-6 p-4 sm:p-8">
      <div className="space-y-2">
        <Skeleton className="h-6 w-40" />
        <Skeleton className="h-4 w-64" />
      </div>
      <div className="flex divide-x divide-border border border-border rounded-lg overflow-hidden">
        {[...Array(3)].map((_, i) => (
          <div key={i} className="flex-1 px-5 py-4 space-y-2">
            <Skeleton className="h-7 w-12" />
            <Skeleton className="h-2.5 w-20" />
          </div>
        ))}
      </div>
      <div className="space-y-3">
        <div className="border-b border-border pb-3">
          <Skeleton className="h-3 w-24" />
        </div>
        {[...Array(6)].map((_, i) => (
          <div key={i} className="flex items-center gap-4 border-b border-border py-3 last:border-0">
            <Skeleton className="h-3 w-3 rounded-full shrink-0" />
            <Skeleton className="h-3.5 flex-1" />
            <Skeleton className="h-3 w-20" />
            <Skeleton className="h-3 w-16" />
          </div>
        ))}
      </div>
    </div>
  );
}

function FullPageSkeleton({ pathname }: { pathname: string }) {
  const isWorkspace = /^\/admin\/workspaces\/[^/]+/.test(pathname);
  const isDashboard  = pathname === "/admin/dashboard";

  if (isWorkspace) {
    return (
      <div className="flex h-screen overflow-hidden bg-background">
        <WorkspaceSidebarSkeleton />
        <div className="flex min-w-0 flex-1 flex-col overflow-hidden">
          <header className="flex h-14 shrink-0 items-center justify-between border-b border-border bg-background px-6">
            <Skeleton className="h-4 w-32 rounded-md" />
            <Skeleton className="h-8 w-24 rounded-lg" />
          </header>
          <main className="flex-1 overflow-y-auto">
            <WorkspaceOverviewContentSkeleton />
          </main>
        </div>
      </div>
    );
  }

  return (
    <div className="flex h-screen overflow-hidden bg-background">
      <GlobalSidebarSkeleton />
      <div className="flex min-w-0 flex-1 flex-col overflow-hidden">
        <GlobalHeaderSkeleton />
        <main className="flex-1 overflow-y-auto">
          {isDashboard ? <DashboardContentSkeleton /> : <GenericContentSkeleton />}
        </main>
      </div>
    </div>
  );
}

const STEP_ROUTES: Record<string, string> = {
  welcome:     "/onboarding/welcome",
  website:     "/onboarding/website",
  analyzing:   "/onboarding/analyzing",
  collections: "/onboarding/collections",
  preparing:   "/onboarding/preparing",
  complete:    "/admin/dashboard",
};

function AdminLayoutGuard() {
  const navigate  = useNavigate();
  const pathname  = useRouterState({ select: (s) => s.location.pathname });
  const [checking, setChecking] = useState(true);

  useEffect(() => {
    supabase.auth.getSession().then(async ({ data: { session } }) => {
      if (!session) { navigate({ to: "/login" }); return; }
      try {
        const { data } = await supabase
          .from("user_onboarding" as never)
          .select("step, completed_at")
          .eq("user_id", session.user.id)
          .maybeSingle() as { data: { step: string; completed_at: string | null } | null };
        if (!data || data.step !== "complete" || !data.completed_at) {
          navigate({ to: (STEP_ROUTES[data?.step ?? "welcome"] ?? "/onboarding/welcome") as "/" });
          return;
        }
      } catch {
        // table doesn't exist yet — let them through
      }
      setChecking(false);
    });

    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      if (!session) navigate({ to: "/login" });
    });
    return () => subscription.unsubscribe();
  }, [navigate]);

  if (checking) {
    return <FullPageSkeleton pathname={pathname} />;
  }

  // Workspace pages and docs portal render their own layout
  if (/^\/admin\/workspaces\/[^/]+/.test(pathname)) return <Outlet />;
  if (pathname.startsWith("/admin/docs")) return <Outlet />;
  if (pathname.startsWith("/admin/api-explorer")) return <Outlet />;

  return <GlobalLayout />;
}

// ── Nav definition ─────────────────────────────────────────────────────────────
type NavItem = { label: string; to: string; icon: React.ComponentType<{ className?: string }> };

const globalNav: Array<{ group: string; items: NavItem[] }> = [
  {
    group: "",
    items: [
      { label: "Dashboard",   to: "/admin/dashboard",   icon: LayoutDashboard },
      { label: "Workspaces",  to: "/admin/workspaces",  icon: FolderOpen      },
    ],
  },
  {
    group: "Content",
    items: [
      { label: "Blog Posts",  to: "/admin/blogs",        icon: FileText        },
      { label: "News",        to: "/admin/news",         icon: FileText        },
      { label: "Articles",    to: "/admin/articles",     icon: BookOpen        },
      { label: "FAQs",        to: "/admin/faqs",         icon: HelpCircle      },
      { label: "Products",    to: "/admin/products",     icon: FileText        },
      { label: "Comments",    to: "/admin/comments",     icon: MessageSquare   },
      { label: "Templates",   to: "/admin/collections",  icon: Moon            },
      { label: "Media",       to: "/admin/media",        icon: Moon            },
    ],
  },
  {
    group: "Team",
    items: [
      { label: "Users",       to: "/admin/users",       icon: Users           },
    ],
  },
  {
    group: "Account",
    items: [
      { label: "Billing",     to: "/admin/billing",     icon: CreditCard      },
      { label: "Settings",    to: "/admin/settings",    icon: Settings        },
    ],
  },
  {
    group: "Developers",
    items: [
      { label: "API Keys",              to: "/admin/api-keys",           icon: Key        },
      { label: "Request Logs",          to: "/admin/api-logs",           icon: ScrollText },
      { label: "API Explorer",          to: "/admin/api-explorer",       icon: BookOpen   },
      { label: "Analytics",             to: "/admin/analytics",          icon: Map        },
      { label: "Integration Center",    to: "/admin/integration-center", icon: Plug       },
      { label: "Developer Docs",        to: "/admin/docs",               icon: BookOpen   },
    ],
  },
  {
    group: "Support",
    items: [
      { label: "Notifications", to: "/admin/notifications", icon: HelpCircle },
    ],
  },
];

// ── Profile dropdown ─────────────────────────────────────────────────────────
function ProfileMenu({ email }: { email: string }) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);
  const navigate = useNavigate();

  useEffect(() => {
    function onClickOutside(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    }
    document.addEventListener("mousedown", onClickOutside);
    return () => document.removeEventListener("mousedown", onClickOutside);
  }, []);

  async function handleSignOut() {
    await supabase.auth.signOut();
    toast.success("Signed out");
    navigate({ to: "/login" });
  }

  const initials = email.slice(0, 2).toUpperCase();

  return (
    <div ref={ref} className="relative">
      <button
        onClick={() => setOpen(!open)}
        className="flex items-center gap-2 rounded-lg px-2 py-1.5 text-sm hover:bg-muted transition-colors"
      >
        <span className="flex h-7 w-7 items-center justify-center rounded-full bg-primary text-[11px] font-bold text-white">
          {initials}
        </span>
        <span className="hidden text-xs text-muted-foreground sm:block truncate max-w-28">{email}</span>
        <ChevronDown className="h-3.5 w-3.5 text-muted-foreground/60" />
      </button>

      {open && (
        <div className="absolute right-0 top-full z-50 mt-1.5 w-48 rounded-lg border border-border bg-white py-1">
          <div className="border-b border-border px-3 py-2">
            <p className="text-xs font-semibold truncate">{email}</p>
          </div>
          {[
            { label: "Billing",     icon: CreditCard, to: "/admin/billing"  },
            { label: "Settings",    icon: Settings,   to: "/admin/settings" },
          ].map((item) => (
            <Link
              key={item.label}
              to={item.to}
              onClick={() => setOpen(false)}
              className="flex items-center gap-2.5 px-3 py-2 text-sm text-muted-foreground hover:bg-muted/50 hover:text-foreground transition-colors"
            >
              <item.icon className="h-3.5 w-3.5" />
              {item.label}
            </Link>
          ))}
          <div className="border-t border-border mt-1">
            <button
              onClick={handleSignOut}
              className="flex w-full items-center gap-2.5 px-3 py-2 text-sm text-red-600 hover:bg-red-50 transition-colors"
            >
              <LogOut className="h-3.5 w-3.5" />
              Sign out
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

// ── Content skeleton loader ────────────────────────────────────────────────────
function ContentSkeleton() {
  return (
    <div className="mx-auto max-w-5xl space-y-6 px-6 py-8 animate-pulse">
      {/* Page title */}
      <div className="space-y-2">
        <div className="h-5 w-40 rounded-md bg-muted" />
        <div className="h-3.5 w-72 rounded-md bg-muted/60" />
      </div>
      {/* Stats strip */}
      <div className="flex divide-x divide-border border border-border rounded-lg overflow-hidden">
        {[1, 2, 3].map((i) => (
          <div key={i} className="flex-1 px-5 py-4 space-y-2">
            <div className="h-7 w-12 rounded-md bg-muted" />
            <div className="h-2.5 w-20 rounded-md bg-muted/60" />
          </div>
        ))}
      </div>
      {/* Content cards */}
      <div className="space-y-3">
        <div className="h-3 w-24 rounded-md bg-muted/60" />
        <div className="rounded-lg border border-border overflow-hidden divide-y divide-border">
          {[1, 2, 3, 4, 5].map((i) => (
            <div key={i} className="flex items-center gap-4 px-4 py-3">
              <div className="h-3 w-3 rounded-full bg-muted" />
              <div className="h-3.5 w-36 rounded-md bg-muted" />
              <div className="ml-auto h-3 w-20 rounded-md bg-muted/60" />
              <div className="h-3 w-16 rounded-md bg-muted/60" />
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

// ── Global Layout ──────────────────────────────────────────────────────────────
function GlobalLayout() {
  const pathname = useRouterState({ select: (s) => s.location.pathname });
  const navigate  = useNavigate();
  const [email,   setEmail]   = useState("");
  const [aiOpen,  setAiOpen]  = useState(false);

  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => {
      setEmail(session?.user?.email ?? "");
    });
  }, []);

  function isActive(to: string) {
    return pathname === to || (to !== "/admin/dashboard" && pathname.startsWith(to));
  }

  async function handleSignOut() {
    await supabase.auth.signOut();
    toast.success("Signed out");
    navigate({ to: "/login" });
  }

  const [sidebarOpen, setSidebarOpen] = useState(false);

  return (
    <div className="flex h-screen overflow-hidden bg-background">

      {/* ── Mobile backdrop ── */}
      {sidebarOpen && (
        <div
          className="fixed inset-0 z-30 bg-black/40 md:hidden"
          onClick={() => setSidebarOpen(false)}
        />
      )}

      {/* ── Sidebar ── */}
      <aside className={cn(
        "fixed inset-y-0 left-0 z-40 flex w-64 shrink-0 flex-col border-r border-border bg-background transition-transform duration-200 ease-in-out",
        "md:relative md:w-56 md:translate-x-0",
        sidebarOpen ? "translate-x-0" : "-translate-x-full",
      )}>
        {/* Logo + mobile close */}
        <div className="flex h-14 items-center gap-2.5 border-b border-border px-4 shrink-0">
          <div className="flex h-7 w-7 items-center justify-center rounded-lg bg-primary">
            <Moon className="h-4 w-4 text-white" />
          </div>
          <span className="text-sm font-semibold tracking-tight">Lunar CMS</span>
          <button
            type="button"
            onClick={() => setSidebarOpen(false)}
            className="ml-auto flex h-7 w-7 items-center justify-center rounded-lg text-muted-foreground hover:bg-muted md:hidden"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        {/* Nav */}
        <nav className="flex-1 overflow-y-auto py-2">
          {globalNav.map((group) => (
            <div key={group.group || "_"} className={cn("mb-0.5", group.group && "mt-4")}>
              {group.group && (
                <p className="mx-4 mb-1 text-[9px] font-bold uppercase tracking-widest text-muted-foreground/40">
                  {group.group}
                </p>
              )}
              {group.items.map((item) => {
                const active = isActive(item.to);
                return (
                  <Link
                    key={item.label}
                    to={item.to}
                    onClick={() => setSidebarOpen(false)}
                    className={cn(
                      "flex items-center gap-2.5 border-l-2 px-4 py-[5px] text-sm transition-colors",
                      active
                        ? "border-primary bg-primary/5 text-foreground font-medium"
                        : "border-transparent text-muted-foreground hover:text-foreground hover:border-border hover:bg-muted/30",
                    )}
                  >
                    <item.icon className="h-3.5 w-3.5 shrink-0" />
                    {item.label}
                    {active && <ChevronRight className="ml-auto h-3 w-3 opacity-40" />}
                  </Link>
                );
              })}
            </div>
          ))}
        </nav>

        {/* Footer */}
        <div className="shrink-0 border-t border-border py-2">
          {email && (
            <div className="mx-3 mb-1 flex items-center gap-2 rounded-lg px-1 py-1.5">
              <span className="flex h-6 w-6 items-center justify-center rounded-full bg-primary text-[10px] font-bold text-white shrink-0">
                {email.slice(0, 2).toUpperCase()}
              </span>
              <span className="truncate text-xs text-muted-foreground">{email}</span>
            </div>
          )}
          <button
            type="button"
            onClick={handleSignOut}
            className="flex w-full items-center gap-2.5 border-l-2 border-transparent px-4 py-[5px] text-sm text-muted-foreground hover:text-foreground hover:border-border hover:bg-muted/30 transition-colors"
          >
            <LogOut className="h-3.5 w-3.5 shrink-0" />
            Sign out
          </button>
        </div>
      </aside>

      {/* ── Main ── */}
      <div className="flex min-w-0 flex-1 flex-col overflow-hidden">
        {/* Top header */}
        <header className="flex h-14 shrink-0 items-center justify-between border-b border-border bg-background px-3 sm:px-6">
          <div className="flex items-center gap-2 text-sm">
            {/* Hamburger — mobile only */}
            <button
              type="button"
              onClick={() => setSidebarOpen(true)}
              className="flex h-8 w-8 items-center justify-center rounded-lg text-muted-foreground hover:bg-muted md:hidden"
            >
              <Menu className="h-4 w-4" />
            </button>
            <span className="text-muted-foreground hidden sm:block">
              {globalNav.flatMap(g => g.items).find(i => isActive(i.to))?.label ?? "Admin"}
            </span>
          </div>
          <div className="flex items-center gap-1 sm:gap-2">
            {/* AI Assistant button */}
            <button
              type="button"
              onClick={() => setAiOpen((v) => !v)}
              className={cn(
                "relative flex items-center gap-1.5 rounded-lg px-2.5 h-8 text-sm font-medium transition-all",
                aiOpen
                  ? "bg-violet-100 text-violet-700 shadow-sm"
                  : "text-muted-foreground hover:bg-muted hover:text-foreground",
              )}
              title="Open AI Assistant"
            >
              <Sparkles className="h-3.5 w-3.5" />
              <span className="hidden sm:block text-xs">AI Assistant</span>
              {/* pulse dot */}
              <span className="absolute -right-0.5 -top-0.5 flex h-2 w-2">
                <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-violet-400 opacity-60" />
                <span className="relative inline-flex h-2 w-2 rounded-full bg-violet-500" />
              </span>
            </button>
            {/* Notifications */}
            <Link
              to="/admin/notifications"
              className="relative flex h-8 w-8 items-center justify-center rounded-lg text-muted-foreground hover:bg-muted hover:text-foreground transition-colors"
            >
              <Bell className="h-4 w-4" />
            </Link>
            {/* Profile */}
            <ProfileMenu email={email} />
          </div>
        </header>

        {/* Content */}
        <main className="flex-1 overflow-y-auto overflow-x-hidden overscroll-x-none touch-pan-y pb-16 md:pb-0">
          <Suspense fallback={<ContentSkeleton />}>
            <Outlet />
          </Suspense>
        </main>
      </div>

      {/* ── Mobile bottom nav ── */}
      <nav className="fixed bottom-0 left-0 right-0 z-20 flex h-16 items-stretch border-t border-border bg-background md:hidden">
        {[
          { label: "Dashboard",   to: "/admin/dashboard",  icon: LayoutDashboard },
          { label: "Workspaces",  to: "/admin/workspaces", icon: FolderOpen      },
          { label: "Blog Posts",  to: "/admin/blogs",      icon: FileText        },
          { label: "API Keys",    to: "/admin/api-keys",   icon: Key             },
          { label: "Settings",    to: "/admin/settings",   icon: Settings        },
        ].map((item) => {
          const active = isActive(item.to);
          return (
            <Link
              key={item.label}
              to={item.to}
              onClick={() => setSidebarOpen(false)}
              className={cn(
                "flex flex-1 flex-col items-center justify-center gap-1 text-center transition-colors",
                active ? "text-primary" : "text-muted-foreground hover:text-foreground",
              )}
            >
              <item.icon className={cn("h-5 w-5", active && "text-primary")} />
              <span className={cn("text-[10px] leading-none", active && "font-semibold")}>{item.label}</span>
            </Link>
          );
        })}
      </nav>

      {/* ── AI Assistant Drawer ── */}
      {/* Backdrop */}
      {aiOpen && (
        <div
          className="fixed inset-0 z-40 bg-black/20 backdrop-blur-[1px]"
          onClick={() => setAiOpen(false)}
        />
      )}

      {/* Panel */}
      <div
        className={cn(
          "fixed right-0 top-0 z-50 flex h-full w-full sm:w-[420px] flex-col border-l border-border bg-background transition-transform duration-300 ease-in-out",
          aiOpen ? "translate-x-0" : "translate-x-full",
        )}
      >
        {/* Drawer header */}
        <div className="flex h-14 shrink-0 items-center justify-between border-b border-border px-5">
          <div className="flex items-center gap-2.5">
            <div className="flex h-7 w-7 items-center justify-center rounded-lg bg-violet-100">
              <Sparkles className="h-4 w-4 text-violet-600" />
            </div>
            <div>
              <p className="text-sm font-semibold">AI Assistant</p>
              <p className="text-[10px] text-muted-foreground">Lunar CMS · Beta</p>
            </div>
          </div>
          <button
            type="button"
            onClick={() => setAiOpen(false)}
            className="flex h-8 w-8 items-center justify-center rounded-lg text-muted-foreground hover:bg-muted hover:text-foreground transition-colors"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        {/* Chat area */}
        <div className="flex flex-1 min-h-0 flex-col p-5">
          <AiAssistant
            compact
            onClose={() => setAiOpen(false)}
            onNavigate={(path) => {
              navigate({ to: path as "/" });
              setAiOpen(false);
            }}
          />
        </div>
      </div>
    </div>
  );
}
