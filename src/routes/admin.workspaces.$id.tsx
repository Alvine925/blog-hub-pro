import { createFileRoute, Link, Outlet, useRouterState, useNavigate } from "@tanstack/react-router";
import { createServerFn } from "@tanstack/react-start";
import {
  LayoutDashboard, FileText, Layers, ImageIcon, Key, Webhook,
  BarChart2, Bell, Users, Settings, Code2, Moon, Sparkles,
  ChevronLeft, ExternalLink, LogOut,
} from "lucide-react";
import { cn } from "@/lib/utils";
import type { Workspace } from "@/lib/workspace.functions";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

// ── Server fn ───────────────────────────────────────────────────────────────
const getWorkspaceById = createServerFn({ method: "GET" })
  .validator((input: { id: string }) => input)
  .handler(async ({ data }): Promise<Workspace> => {
    const { getAdminClient } = await import("../lib/supabase.server");
    const db = getAdminClient() as any;
    const { data: ws, error } = await db
      .from("workspaces")
      .select("*")
      .eq("id", data.id)
      .single();
    if (error || !ws) throw new Error("Workspace not found");
    return ws as Workspace;
  });

// ── Route ────────────────────────────────────────────────────────────────────
export const Route = createFileRoute("/admin/workspaces/$id")({
  loader: async ({ params }) => {
    const workspace = await getWorkspaceById({ data: { id: params.id } });
    return { workspace };
  },
  component: WorkspaceShell,
  errorComponent: ({ error }) => (
    <div className="flex min-h-screen flex-col items-center justify-center gap-3">
      <p className="text-sm text-red-600 font-medium">{error.message}</p>
      <Link to="/admin/workspaces" className="text-sm text-muted-foreground hover:text-foreground underline">
        ← Back to all workspaces
      </Link>
    </div>
  ),
});

// ── Color helper ─────────────────────────────────────────────────────────────
const COLORS = ["bg-red-500","bg-orange-500","bg-violet-500","bg-blue-500","bg-emerald-500","bg-pink-500"];
function wsColor(name: string) {
  let h = 0;
  for (const c of name) h = (h * 31 + c.charCodeAt(0)) & 0xffffffff;
  return COLORS[Math.abs(h) % COLORS.length];
}

// ── Nav definition ───────────────────────────────────────────────────────────
type NavItem = { label: string; to: string; icon: React.ComponentType<{className?: string}> };
type NavGroup = { group: string; items: NavItem[] };

function buildNav(id: string): NavGroup[] {
  const base = `/admin/workspaces/${id}`;
  return [
    {
      group: "",
      items: [{ label: "Overview", to: base, icon: LayoutDashboard }],
    },
    {
      group: "Content",
      items: [
        { label: "Blogs", to: `${base}/blogs`, icon: FileText },
        { label: "Collections", to: `${base}/collections`, icon: Layers },
        { label: "Media Library", to: `${base}/media`, icon: ImageIcon },
      ],
    },
    {
      group: "Tools",
      items: [
        { label: "AI Assistant", to: `${base}/ai-assistant`, icon: Sparkles },
        { label: "API Keys", to: `${base}/api-keys`, icon: Key },
        { label: "Webhooks", to: `${base}/webhooks`, icon: Webhook },
        { label: "API Explorer", to: `${base}/api-explorer`, icon: Code2 },
      ],
    },
    {
      group: "Insights",
      items: [
        { label: "Analytics", to: `${base}/analytics`, icon: BarChart2 },
        { label: "Notifications", to: `${base}/notifications`, icon: Bell },
      ],
    },
    {
      group: "Team",
      items: [{ label: "Users", to: `${base}/users`, icon: Users }],
    },
    {
      group: "System",
      items: [{ label: "Settings", to: `${base}/settings`, icon: Settings }],
    },
  ];
}

// ── Sidebar ───────────────────────────────────────────────────────────────────
function WorkspaceSidebar({ workspace }: { workspace: Workspace }) {
  const { id } = Route.useParams();
  const pathname = useRouterState({ select: (s) => s.location.pathname });
  const navigate = useNavigate();
  const groups = buildNav(id);

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
    <aside className="flex h-screen w-56 shrink-0 flex-col border-r border-border bg-background overflow-y-auto">
      {/* Brand */}
      <div className="flex h-14 items-center gap-2.5 border-b border-border px-4 shrink-0">
        <div className="flex h-6 w-6 items-center justify-center rounded-md bg-primary">
          <Moon className="h-3.5 w-3.5 text-primary-foreground" />
        </div>
        <span className="text-sm font-semibold tracking-tight">Lunar CMS</span>
      </div>

      {/* Workspace identity */}
      <div className="border-b border-border px-4 py-3 shrink-0">
        <Link
          to="/admin/workspaces"
          className="mb-2 flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground transition-colors"
        >
          <ChevronLeft className="h-3 w-3" />
          All workspaces
        </Link>
        <div className="flex items-center gap-2.5">
          <div className={cn(
            "flex h-7 w-7 shrink-0 items-center justify-center rounded text-[11px] font-bold text-white",
            wsColor(workspace.name),
          )}>
            {workspace.name.slice(0, 2).toUpperCase()}
          </div>
          <div className="min-w-0">
            <p className="truncate text-sm font-semibold leading-tight">{workspace.name}</p>
            <p className="font-mono text-[10px] text-muted-foreground truncate">{workspace.slug}</p>
          </div>
        </div>
      </div>

      {/* Navigation */}
      <nav className="flex-1 py-2">
        {groups.map((g) => (
          <div key={g.group} className={cn(g.group && "mt-3")}>
            {g.group && (
              <p className="mx-4 mb-0.5 text-[9px] font-bold uppercase tracking-widest text-muted-foreground/40">
                {g.group}
              </p>
            )}
            {g.items.map((item) => {
              const active = isActive(item.to);
              return (
                <Link
                  key={item.to}
                  to={item.to}
                  className={cn(
                    "flex items-center gap-2.5 border-l-2 px-4 py-[5px] text-sm transition-colors",
                    active
                      ? "border-primary text-foreground font-medium"
                      : "border-transparent text-muted-foreground hover:border-border hover:text-foreground",
                  )}
                >
                  <item.icon className="h-3.5 w-3.5 shrink-0" />
                  {item.label}
                </Link>
              );
            })}
          </div>
        ))}
      </nav>

      {/* Footer */}
      <div className="shrink-0 border-t border-border py-1">
        <Link
          to="/blogs"
          className="flex items-center gap-2.5 border-l-2 border-transparent px-4 py-[5px] text-sm text-muted-foreground hover:border-border hover:text-foreground transition-colors"
        >
          <ExternalLink className="h-3.5 w-3.5 shrink-0" />
          Public blog
        </Link>
        <button
          type="button"
          onClick={handleSignOut}
          className="flex w-full items-center gap-2.5 border-l-2 border-transparent px-4 py-[5px] text-sm text-muted-foreground hover:border-border hover:text-foreground transition-colors"
        >
          <LogOut className="h-3.5 w-3.5 shrink-0" />
          Sign out
        </button>
      </div>
    </aside>
  );
}

// ── Shell ────────────────────────────────────────────────────────────────────
function WorkspaceShell() {
  const { workspace } = Route.useLoaderData();
  return (
    <div className="flex h-screen overflow-hidden bg-background">
      <WorkspaceSidebar workspace={workspace} />
      <div className="flex min-w-0 flex-1 flex-col overflow-auto">
        <Outlet />
      </div>
    </div>
  );
}
