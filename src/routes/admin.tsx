import { createFileRoute, Link, Outlet, useRouterState, useNavigate } from "@tanstack/react-router";
import { Suspense } from "react";
import {
  LayoutDashboard, Moon, FolderOpen, CreditCard, Settings, ChevronRight,
  LogOut, Bell, BookOpen, HelpCircle, Map, FileText, Users,
  ChevronDown, User, Key, ScrollText, Plug, MessageSquare,
  Sparkles, X, Menu, Loader2, Eye, EyeOff,
} from "lucide-react";
import { Skeleton } from "@/components/ui/skeleton";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { cn } from "@/lib/utils";
import { useState, useEffect, useRef } from "react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { useServerFn } from "@tanstack/react-start";
import { markPasswordChanged } from "@/lib/workspace-members.functions";

export const Route = createFileRoute("/admin")({
  head: () => ({
    meta: [
      { title: "Lunar CMS — Admin" },
      { name: "robots", content: "noindex, nofollow" },
    ],
  }),
  component: AdminLayoutGuard,
});

// ── Full-page skeletons ────────────────────────────────────────────────────────

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
          {[...Array(4)].map((_, i) => (
            <Skeleton key={i} className="h-9 w-full rounded-lg" />
          ))}
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
      <div className="grid gap-10 lg:grid-cols-3">
        {[...Array(3)].map((_, col) => (
          <div key={col} className="space-y-4">
            <div className="border-b border-border pb-3"><Skeleton className="h-3 w-24" /></div>
            <div className="space-y-5">
              {[...Array(4)].map((_, i) => (
                <div key={i} className="space-y-1.5">
                  <Skeleton className="h-4 w-full" />
                  <Skeleton className="h-3 w-3/4" />
                </div>
              ))}
            </div>
          </div>
        ))}
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
      <div className="space-y-3">
        {[...Array(6)].map((_, i) => (
          <div key={i} className="flex items-center gap-4 border-b border-border py-3 last:border-0">
            <Skeleton className="h-3 w-3 rounded-full shrink-0" />
            <Skeleton className="h-3.5 flex-1" />
            <Skeleton className="h-3 w-20" />
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

// ── Password change modal ──────────────────────────────────────────────────────
function PasswordChangeModal({ userId, onDone }: { userId: string; onDone: () => void }) {
  const [newPw,     setNewPw]     = useState("");
  const [confirmPw, setConfirmPw] = useState("");
  const [showPw,    setShowPw]    = useState(false);
  const [busy,      setBusy]      = useState(false);
  const [error,     setError]     = useState("");
  const doMarkChanged = useServerFn(markPasswordChanged);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError("");
    if (newPw.length < 8) { setError("Password must be at least 8 characters."); return; }
    if (newPw !== confirmPw) { setError("Passwords don't match."); return; }

    setBusy(true);
    try {
      const { error: updateErr } = await supabase.auth.updateUser({
        password: newPw,
        data: { password_change_required: false },
      });
      if (updateErr) throw updateErr;
      await doMarkChanged({ data: { userId } });
      toast.success("Password updated — welcome aboard!");
      onDone();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to update password.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="fixed inset-0 z-[60] flex items-center justify-center bg-black/60 backdrop-blur-sm p-4">
      <div className="w-full max-w-md rounded-2xl bg-white shadow-2xl overflow-hidden">

        {/* Header */}
        <div className="px-8 pt-8 pb-6 border-b border-border">
          <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-primary mb-4">
            <Moon className="h-5 w-5 text-white" />
          </div>
          <h2 className="text-xl font-bold tracking-tight">Set your password</h2>
          <p className="mt-1.5 text-sm text-muted-foreground leading-relaxed">
            Welcome to Lunar CMS. Please create a password before continuing — your temporary one will no longer work after this.
          </p>
        </div>

        {/* Form */}
        <form onSubmit={handleSubmit} className="px-8 py-6 space-y-4">
          <div className="space-y-1.5">
            <Label htmlFor="new-pw">New password</Label>
            <div className="relative">
              <Input
                id="new-pw"
                type={showPw ? "text" : "password"}
                value={newPw}
                onChange={(e) => setNewPw(e.target.value)}
                placeholder="At least 8 characters"
                required
                autoFocus
                className="pr-10"
              />
              <button
                type="button"
                onClick={() => setShowPw((v) => !v)}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
                tabIndex={-1}
              >
                {showPw ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
              </button>
            </div>
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="confirm-pw">Confirm password</Label>
            <Input
              id="confirm-pw"
              type={showPw ? "text" : "password"}
              value={confirmPw}
              onChange={(e) => setConfirmPw(e.target.value)}
              placeholder="Same as above"
              required
            />
          </div>

          {error && (
            <p className="text-sm text-destructive rounded-lg bg-destructive/5 border border-destructive/20 px-3 py-2">
              {error}
            </p>
          )}

          <Button type="submit" className="w-full mt-2" disabled={busy}>
            {busy && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
            Set password &amp; continue
          </Button>
        </form>
      </div>
    </div>
  );
}

// ── Onboarding step routes ─────────────────────────────────────────────────────
const STEP_ROUTES: Record<string, string> = {
  welcome:     "/onboarding/welcome",
  website:     "/onboarding/website",
  analyzing:   "/onboarding/analyzing",
  collections: "/onboarding/collections",
  preparing:   "/onboarding/preparing",
  complete:    "/admin/dashboard",
};

// ── Admin layout guard ─────────────────────────────────────────────────────────
function AdminLayoutGuard() {
  const navigate = useNavigate();
  const pathname = useRouterState({ select: (s) => s.location.pathname });
  const [checking,          setChecking]          = useState(true);
  const [needsPasswordChange, setNeedsPasswordChange] = useState(false);
  const [currentUserId,     setCurrentUserId]     = useState<string | null>(null);

  useEffect(() => {
    supabase.auth.getSession().then(async ({ data: { session } }) => {
      if (!session) { navigate({ to: "/login" }); return; }

      // Check onboarding
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

      // Check if password change is required
      const meta = session.user.user_metadata;
      if (meta?.password_change_required === true) {
        setCurrentUserId(session.user.id);
        setNeedsPasswordChange(true);
      }

      setChecking(false);
    });

    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      if (!session) navigate({ to: "/login" });
    });
    return () => subscription.unsubscribe();
  }, [navigate]);

  if (checking) return <FullPageSkeleton pathname={pathname} />;

  const passwordModal = needsPasswordChange && currentUserId ? (
    <PasswordChangeModal userId={currentUserId} onDone={() => setNeedsPasswordChange(false)} />
  ) : null;

  // Workspace pages render their own shell
  if (/^\/admin\/workspaces\/[^/]+/.test(pathname)) {
    return <>{<Outlet />}{passwordModal}</>;
  }
  if (pathname.startsWith("/admin/docs") || pathname.startsWith("/admin/api-explorer")) {
    return <>{<Outlet />}{passwordModal}</>;
  }

  return <>{<GlobalLayout />}{passwordModal}</>;
}

// ── Nav definition ─────────────────────────────────────────────────────────────
type NavItem = { label: string; to: string; icon: React.ComponentType<{ className?: string }> };

const globalNav: Array<{ group: string; items: NavItem[] }> = [
  {
    group: "",
    items: [
      { label: "Dashboard",  to: "/admin/dashboard",  icon: LayoutDashboard },
      { label: "Workspaces", to: "/admin/workspaces", icon: FolderOpen      },
    ],
  },
  {
    group: "Content",
    items: [
      { label: "Blog Posts", to: "/admin/blogs",       icon: FileText      },
      { label: "News",       to: "/admin/news",        icon: FileText      },
      { label: "Articles",   to: "/admin/articles",    icon: BookOpen      },
      { label: "FAQs",       to: "/admin/faqs",        icon: HelpCircle    },
      { label: "Products",   to: "/admin/products",    icon: FileText      },
      { label: "Comments",   to: "/admin/comments",    icon: MessageSquare },
      { label: "Templates",  to: "/admin/collections", icon: Moon          },
      { label: "Media",      to: "/admin/media",       icon: Moon          },
    ],
  },
  {
    group: "Team",
    items: [
      { label: "Users", to: "/admin/users", icon: Users },
    ],
  },
  {
    group: "Account",
    items: [
      { label: "Billing",  to: "/admin/billing",  icon: CreditCard },
      { label: "Settings", to: "/admin/settings", icon: Settings   },
    ],
  },
  {
    group: "Developers",
    items: [
      { label: "API Keys",           to: "/admin/api-keys",           icon: Key        },
      { label: "Request Logs",       to: "/admin/api-logs",           icon: ScrollText },
      { label: "API Explorer",       to: "/admin/api-explorer",       icon: BookOpen   },
      { label: "Analytics",          to: "/admin/analytics",          icon: Map        },
      { label: "Integration Center", to: "/admin/integration-center", icon: Plug       },
      { label: "Developer Docs",     to: "/admin/docs",               icon: BookOpen   },
    ],
  },
  {
    group: "Support",
    items: [
      { label: "Notifications", to: "/admin/notifications", icon: HelpCircle },
    ],
  },
];

// ── Profile dropdown ──────────────────────────────────────────────────────────
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

  return (
    <div ref={ref} className="relative">
      <button
        onClick={() => setOpen(!open)}
        className="flex items-center gap-2 rounded-lg px-2 py-1.5 text-sm hover:bg-muted transition-colors"
      >
        <span className="flex h-7 w-7 items-center justify-center rounded-full bg-primary text-[11px] font-bold text-white">
          {email.slice(0, 2).toUpperCase()}
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
            { label: "Billing",  icon: CreditCard, to: "/admin/billing"  },
            { label: "Settings", icon: Settings,   to: "/admin/settings" },
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
  const [email,      setEmail]      = useState("");
  const [sidebarOpen, setSidebarOpen] = useState(false);

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
    <div className="flex h-screen bg-background overflow-x-clip">

      {/* Mobile backdrop */}
      {sidebarOpen && (
        <div
          className="fixed inset-0 z-30 bg-black/40 md:hidden"
          onClick={() => setSidebarOpen(false)}
        />
      )}

      {/* Sidebar */}
      <aside className={cn(
        "fixed inset-y-0 left-0 z-40 flex w-64 shrink-0 flex-col border-r border-border bg-background transition-transform duration-200 ease-in-out",
        "md:relative md:w-56 md:translate-x-0",
        sidebarOpen ? "translate-x-0" : "-translate-x-full",
      )}>
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

        <div className="shrink-0 border-t border-border p-3">
          <button
            onClick={handleSignOut}
            className="flex w-full items-center gap-2.5 rounded-lg px-3 py-2 text-sm font-medium text-muted-foreground hover:bg-red-50 hover:text-red-600 transition-colors"
          >
            <LogOut className="h-4 w-4 shrink-0" />
            Sign out
          </button>
        </div>
      </aside>

      {/* Main area */}
      <div className="flex min-w-0 flex-1 flex-col overflow-hidden">
        <header className="flex h-14 shrink-0 items-center justify-between border-b border-border bg-background px-3 sm:px-6">
          <button
            type="button"
            onClick={() => setSidebarOpen(true)}
            className="flex h-8 w-8 items-center justify-center rounded-lg text-muted-foreground hover:bg-muted md:hidden"
          >
            <Menu className="h-4 w-4" />
          </button>
          <div className="hidden text-sm font-medium text-muted-foreground md:block">
            Admin
          </div>
          <div className="flex items-center gap-2">
            {email && <ProfileMenu email={email} />}
          </div>
        </header>

        <main className="flex-1 overflow-y-auto">
          <div className="mx-auto max-w-5xl px-4 py-6 sm:px-8 sm:py-8">
            <Suspense fallback={<GenericContentSkeleton />}>
              <Outlet />
            </Suspense>
          </div>
        </main>
      </div>
    </div>
  );
}
