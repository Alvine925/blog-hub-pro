import { createFileRoute, Link, Outlet, useRouterState } from "@tanstack/react-router";
import {
  LayoutDashboard,
  FileText,
  ImageIcon,
  Key,
  ExternalLink,
  Moon,
  Webhook,
  BarChart2,
  Settings,
  Search,
  Code2,
} from "lucide-react";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/admin")({
  head: () => ({
    meta: [
      { title: "Lunar CMS — Admin" },
      { name: "robots", content: "noindex, nofollow" },
    ],
  }),
  component: AdminLayout,
});

const navItems = [
  { label: "Dashboard", to: "/admin/dashboard", icon: LayoutDashboard },
  { label: "Blogs", to: "/admin/blogs", icon: FileText },
  { label: "Media", to: "/admin/media", icon: ImageIcon },
  { label: "Analytics", to: "/admin/analytics", icon: BarChart2 },
  { label: "Search", to: "/admin/search", icon: Search },
  { label: "API Keys", to: "/admin/api-keys", icon: Key },
  { label: "API Explorer", to: "/admin/api-explorer", icon: Code2 },
  { label: "Webhooks", to: "/admin/webhooks", icon: Webhook },
  { label: "Settings", to: "/admin/settings", icon: Settings },
];

function AdminLayout() {
  const pathname = useRouterState({ select: (s) => s.location.pathname });

  return (
    <div className="flex min-h-screen w-full bg-muted/30">
      <aside className="hidden w-60 shrink-0 flex-col border-r border-border bg-background md:flex">
        <div className="flex h-14 items-center gap-2 border-b border-border px-5">
          <Moon className="h-5 w-5 text-primary" />
          <span className="font-semibold tracking-tight">Lunar CMS</span>
        </div>
        <nav className="flex-1 space-y-0.5 overflow-y-auto p-3">
          {navItems.map((item) => {
            const active = pathname.startsWith(item.to);
            return (
              <Link
                key={item.to}
                to={item.to}
                className={cn(
                  "flex items-center gap-3 rounded-md px-3 py-2 text-sm font-medium transition-colors",
                  active
                    ? "bg-primary text-primary-foreground"
                    : "text-muted-foreground hover:bg-accent hover:text-foreground",
                )}
              >
                <item.icon className="h-4 w-4" />
                {item.label}
              </Link>
            );
          })}
        </nav>
        <div className="border-t border-border p-3">
          <Link
            to="/blogs"
            className="flex items-center gap-3 rounded-md px-3 py-2 text-sm text-muted-foreground hover:bg-accent hover:text-foreground"
          >
            <ExternalLink className="h-4 w-4" />
            View public blog
          </Link>
        </div>
      </aside>

      {/* Mobile top bar */}
      <div className="flex min-w-0 flex-1 flex-col">
        <div className="flex items-center gap-3 border-b border-border bg-background px-4 py-3 md:hidden">
          <Moon className="h-5 w-5 text-primary" />
          <span className="font-semibold">Lunar CMS</span>
          <div className="ml-auto flex items-center gap-3 overflow-x-auto">
            {navItems.map((item) => (
              <Link
                key={item.to}
                to={item.to}
                className={cn(
                  "shrink-0 text-sm font-medium",
                  pathname.startsWith(item.to)
                    ? "text-primary"
                    : "text-muted-foreground",
                )}
              >
                {item.label}
              </Link>
            ))}
          </div>
        </div>
        <main className="flex-1 p-4 md:p-8">
          <Outlet />
        </main>
      </div>
    </div>
  );
}
