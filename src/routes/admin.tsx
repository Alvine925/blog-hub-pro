import { createFileRoute, Link, Outlet, useRouterState, useNavigate } from "@tanstack/react-router";
import {
  LayoutDashboard, Moon, FolderOpen, CreditCard, Settings, ChevronRight, LogOut,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { useState, useEffect } from "react";
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
  const pathname = useRouterState({ select: (s) => s.location.pathname });
  const [checking, setChecking] = useState(true);

  useEffect(() => {
    supabase.auth.getSession().then(async ({ data: { session } }) => {
      if (!session) {
        navigate({ to: "/login" });
        return;
      }
      try {
        const { data } = await supabase
          .from("user_onboarding" as never)
          .select("step, completed_at")
          .eq("user_id", session.user.id)
          .maybeSingle() as { data: { step: string; completed_at: string | null } | null };
        if (!data || data.step !== "complete" || !data.completed_at) {
          const step = data?.step ?? "welcome";
          navigate({ to: (STEP_ROUTES[step] ?? "/onboarding/welcome") as "/" });
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

  // Workspace pages render their own layout — just pass through
  if (/^\/admin\/workspaces\/[^/]+/.test(pathname)) {
    return <Outlet />;
  }

  return <GlobalLayout />;
}

type NavItem = { label: string; to: string; icon: React.ComponentType<{ className?: string }> };

const globalNav: Array<{ group: string; items: NavItem[] }> = [
  {
    group: "",
    items: [
      { label: "Dashboard", to: "/admin/dashboard", icon: LayoutDashboard },
      { label: "Workspaces", to: "/admin/workspaces", icon: FolderOpen },
    ],
  },
  {
    group: "Account",
    items: [
      { label: "Billing", to: "/admin/billing", icon: CreditCard },
      { label: "Settings", to: "/admin/settings", icon: Settings },
    ],
  },
];

function GlobalLayout() {
  const pathname = useRouterState({ select: (s) => s.location.pathname });
  const navigate = useNavigate();

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
      {/* Sidebar */}
      <aside className="flex w-56 shrink-0 flex-col border-r border-border bg-background">
        {/* Logo */}
        <div className="flex h-14 items-center gap-2.5 border-b border-border px-4">
          <div className="flex h-6 w-6 items-center justify-center rounded-md bg-primary">
            <Moon className="h-3.5 w-3.5 text-primary-foreground" />
          </div>
          <span className="text-sm font-semibold tracking-tight">Lunar CMS</span>
        </div>

        {/* Nav */}
        <nav className="flex-1 overflow-y-auto py-3">
          {globalNav.map((group) => (
            <div key={group.group} className={cn("mb-1", group.group && "mt-3")}>
              {group.group && (
                <p className="mx-4 mb-1 text-[10px] font-semibold uppercase tracking-widest text-muted-foreground/50">
                  {group.group}
                </p>
              )}
              {group.items.map((item) => {
                const active = isActive(item.to);
                return (
                  <Link
                    key={item.to}
                    to={item.to}
                    className={cn(
                      "flex items-center gap-2.5 border-l-2 px-4 py-1.5 text-sm transition-colors",
                      active
                        ? "border-primary text-foreground font-medium"
                        : "border-transparent text-muted-foreground hover:text-foreground hover:border-border",
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
        <div className="border-t border-border py-2">
          <button
            type="button"
            onClick={handleSignOut}
            className="flex w-full items-center gap-2.5 border-l-2 border-transparent px-4 py-1.5 text-sm text-muted-foreground hover:text-foreground hover:border-border transition-colors"
          >
            <LogOut className="h-3.5 w-3.5 shrink-0" />
            Sign out
          </button>
        </div>
      </aside>

      {/* Content */}
      <div className="flex min-w-0 flex-1 flex-col overflow-auto">
        <main className="flex-1 p-8">
          <Outlet />
        </main>
      </div>
    </div>
  );
}
