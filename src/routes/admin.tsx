import { createFileRoute, Link, Outlet, useRouterState, useNavigate } from "@tanstack/react-router";
import {
  LayoutDashboard, Moon, FolderOpen, CreditCard, Settings, ChevronRight,
  LogOut, Bell, BookOpen, HelpCircle, Map, FileText, Users,
  ChevronDown, User, Key, ScrollText, Plug,
} from "lucide-react";
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
    return (
      <div className="flex min-h-screen items-center justify-center bg-background">
        <div className="h-4 w-4 animate-spin rounded-full border-2 border-border border-t-primary" />
      </div>
    );
  }

  // Workspace pages render their own layout
  if (/^\/admin\/workspaces\/[^/]+/.test(pathname)) return <Outlet />;

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
      { label: "Blog Posts",  to: "/admin/blogs",       icon: FileText        },
      { label: "Templates",   to: "/admin/collections", icon: Moon            },
      { label: "Media",       to: "/admin/media",       icon: Moon            },
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
      { label: "API Keys",          to: "/admin/api-keys",           icon: Key        },
      { label: "Request Logs",      to: "/admin/api-logs",           icon: ScrollText },
      { label: "API Explorer",      to: "/admin/api-explorer",       icon: BookOpen   },
      { label: "Analytics",         to: "/admin/analytics",          icon: Map        },
      { label: "Integration Center", to: "/admin/integration-center", icon: Plug       },
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
        <div className="absolute right-0 top-full z-50 mt-1.5 w-48 rounded-xl border border-border bg-white py-1 shadow-lg">
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

// ── Global Layout ──────────────────────────────────────────────────────────────
function GlobalLayout() {
  const pathname = useRouterState({ select: (s) => s.location.pathname });
  const navigate  = useNavigate();
  const [email, setEmail] = useState("");

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

  return (
    <div className="flex h-screen overflow-hidden bg-background">
      {/* ── Sidebar ── */}
      <aside className="flex w-56 shrink-0 flex-col border-r border-border bg-background">
        {/* Logo */}
        <div className="flex h-14 items-center gap-2.5 border-b border-border px-4 shrink-0">
          <div className="flex h-7 w-7 items-center justify-center rounded-lg bg-primary shadow-sm">
            <Moon className="h-4 w-4 text-white" />
          </div>
          <span className="text-sm font-semibold tracking-tight">Lunar CMS</span>
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
        <header className="flex h-14 shrink-0 items-center justify-between border-b border-border bg-background px-6">
          <div className="flex items-center gap-2 text-sm">
            <span className="text-muted-foreground">
              {globalNav.flatMap(g => g.items).find(i => isActive(i.to))?.label ?? "Admin"}
            </span>
          </div>
          <div className="flex items-center gap-2">
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
        <main className="flex-1 overflow-auto">
          <Outlet />
        </main>
      </div>
    </div>
  );
}
