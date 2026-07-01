import { createFileRoute } from "@tanstack/react-router";
import { createServerFn } from "@tanstack/react-start";
import { useServerFn } from "@tanstack/react-start";
import { queryOptions, useSuspenseQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { toast } from "sonner";
import {
  Bell, CheckCheck, Trash2, Info, CheckCircle2, AlertTriangle, XCircle,
  FileText, Image, Key, Webhook, CreditCard, Cpu, Loader2,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

interface Notification {
  id: string;
  type: string;
  title: string;
  body: string | null;
  action_url: string | null;
  action_label: string | null;
  read_at: string | null;
  dismissed_at: string | null;
  created_at: string;
}

/** Resolve the default workspace id server-side so callers can't inject a workspace. */
async function getDefaultWorkspaceId(supabase: any): Promise<string | null> {
  const { data } = await supabase
    .from("workspaces")
    .select("id")
    .eq("slug", "default")
    .single();
  return data?.id ?? null;
}

const listNotifications = createServerFn({ method: "GET" }).handler(
  async (): Promise<Notification[]> => {
    const { getAdminClient } = await import("@/lib/supabase.server");
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const supabase = (await getAdminClient()) as any;
    const wsId = await getDefaultWorkspaceId(supabase);

    const query = supabase
      .from("notifications")
      .select("id, type, title, body, action_url, action_label, read_at, dismissed_at, created_at")
      .is("dismissed_at", null)
      .order("created_at", { ascending: false })
      .limit(100);

    // Scope to workspace when available; fall through for global (null workspace) rows too
    const { data, error } = wsId
      ? await query.or(`workspace_id.eq.${wsId},workspace_id.is.null`)
      : await query.is("workspace_id", null);

    if (error) throw new Error(error.message);
    return (data ?? []) as Notification[];
  },
);

const markAllRead = createServerFn({ method: "POST" }).handler(async () => {
  const { getAdminClient } = await import("@/lib/supabase.server");
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const supabase = (await getAdminClient()) as any;
  const wsId = await getDefaultWorkspaceId(supabase);

  const query = supabase
    .from("notifications")
    .update({ read_at: new Date().toISOString() })
    .is("read_at", null);

  const { error } = wsId
    ? await query.or(`workspace_id.eq.${wsId},workspace_id.is.null`)
    : await query.is("workspace_id", null);

  if (error) throw new Error(error.message);
  return { ok: true };
});

const markOneRead = createServerFn({ method: "POST" })
  .validator((d: { id: string }) => d)
  .handler(async ({ data }) => {
    const { getAdminClient } = await import("@/lib/supabase.server");
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const supabase = (await getAdminClient()) as any;
    const wsId = await getDefaultWorkspaceId(supabase);

    // Update only if the notification belongs to this workspace (or is global)
    const query = supabase
      .from("notifications")
      .update({ read_at: new Date().toISOString() })
      .eq("id", data.id);

    const { error } = wsId
      ? await query.or(`workspace_id.eq.${wsId},workspace_id.is.null`)
      : await query.is("workspace_id", null);

    if (error) throw new Error(error.message);
    return { ok: true };
  });

const dismissNotification = createServerFn({ method: "POST" })
  .validator((d: { id: string }) => d)
  .handler(async ({ data }) => {
    const { getAdminClient } = await import("@/lib/supabase.server");
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const supabase = (await getAdminClient()) as any;
    const wsId = await getDefaultWorkspaceId(supabase);

    const query = supabase
      .from("notifications")
      .update({ dismissed_at: new Date().toISOString() })
      .eq("id", data.id);

    const { error } = wsId
      ? await query.or(`workspace_id.eq.${wsId},workspace_id.is.null`)
      : await query.is("workspace_id", null);

    if (error) throw new Error(error.message);
    return { ok: true };
  });

const notificationsQuery = queryOptions({
  queryKey: ["admin", "notifications"],
  queryFn: () => listNotifications(),
});

export const Route = createFileRoute("/admin/notifications")({
  head: () => ({ meta: [{ title: "Notifications — Admin" }] }),
  loader: ({ context }) => context.queryClient.ensureQueryData(notificationsQuery),
  component: NotificationsPage,
});

const TYPE_ICON: Record<string, React.ComponentType<{ className?: string }>> = {
  info: Info,
  success: CheckCircle2,
  warning: AlertTriangle,
  error: XCircle,
  post_published: FileText,
  post_scheduled: FileText,
  media_uploaded: Image,
  api_key_created: Key,
  webhook_failed: Webhook,
  billing: CreditCard,
  system: Cpu,
};

const TYPE_COLOR: Record<string, string> = {
  info: "text-blue-500",
  success: "text-green-500",
  warning: "text-amber-500",
  error: "text-red-500",
  post_published: "text-primary",
  post_scheduled: "text-amber-500",
  media_uploaded: "text-purple-500",
  api_key_created: "text-primary",
  webhook_failed: "text-red-500",
  billing: "text-primary",
  system: "text-muted-foreground",
};

const TYPE_BG: Record<string, string> = {
  info: "bg-blue-50",
  success: "bg-green-50",
  warning: "bg-amber-50",
  error: "bg-red-50",
  post_published: "bg-primary/10",
  post_scheduled: "bg-amber-50",
  media_uploaded: "bg-purple-50",
  api_key_created: "bg-primary/10",
  webhook_failed: "bg-red-50",
  billing: "bg-primary/10",
  system: "bg-muted",
};

function formatRelative(dateStr: string) {
  const date = new Date(dateStr);
  const now = new Date();
  const diffMs = now.getTime() - date.getTime();
  const diffMins = Math.floor(diffMs / 60000);
  if (diffMins < 1) return "just now";
  if (diffMins < 60) return `${diffMins}m ago`;
  const diffHours = Math.floor(diffMins / 60);
  if (diffHours < 24) return `${diffHours}h ago`;
  const diffDays = Math.floor(diffHours / 24);
  if (diffDays < 7) return `${diffDays}d ago`;
  return date.toLocaleDateString();
}

function groupByDate(notifications: Notification[]) {
  const groups: { label: string; items: Notification[] }[] = [];
  const today = new Date();
  const yesterday = new Date(today);
  yesterday.setDate(yesterday.getDate() - 1);

  const grouped: Record<string, Notification[]> = {};
  for (const n of notifications) {
    const d = new Date(n.created_at);
    let label: string;
    if (d.toDateString() === today.toDateString()) label = "Today";
    else if (d.toDateString() === yesterday.toDateString()) label = "Yesterday";
    else label = d.toLocaleDateString("en-US", { month: "long", day: "numeric", year: "numeric" });
    if (!grouped[label]) grouped[label] = [];
    grouped[label].push(n);
  }

  for (const label of ["Today", "Yesterday"]) {
    if (grouped[label]) groups.push({ label, items: grouped[label] });
  }
  for (const [label, items] of Object.entries(grouped)) {
    if (label !== "Today" && label !== "Yesterday") groups.push({ label, items });
  }
  return groups;
}

function NotificationsPage() {
  const { data: notifications } = useSuspenseQuery(notificationsQuery);
  const queryClient = useQueryClient();
  const doMarkAllRead = useServerFn(markAllRead);
  const doMarkOneRead = useServerFn(markOneRead);
  const doDismiss = useServerFn(dismissNotification);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [markingAll, setMarkingAll] = useState(false);

  const unread = notifications.filter((n) => !n.read_at);
  const groups = groupByDate(notifications);

  async function refresh() {
    await queryClient.invalidateQueries({ queryKey: ["admin", "notifications"] });
  }

  async function handleMarkAllRead() {
    setMarkingAll(true);
    try {
      await doMarkAllRead({});
      await refresh();
      toast.success("All notifications marked as read");
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Failed");
    } finally {
      setMarkingAll(false);
    }
  }

  async function handleMarkRead(id: string) {
    setBusyId(id);
    try {
      await doMarkOneRead({ data: { id } });
      await refresh();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Failed");
    } finally {
      setBusyId(null);
    }
  }

  async function handleDismiss(id: string) {
    setBusyId(id);
    try {
      await doDismiss({ data: { id } });
      await refresh();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Failed");
    } finally {
      setBusyId(null);
    }
  }

  return (
    <div className="max-w-2xl space-y-8">
      {/* Header */}
      <div className="flex items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold">Notifications</h1>
          <p className="text-sm text-muted-foreground">
            {unread.length > 0 ? `${unread.length} unread` : "All caught up"}
          </p>
        </div>
        {unread.length > 0 && (
          <Button variant="outline" size="sm" onClick={handleMarkAllRead} disabled={markingAll} className="shrink-0">
            {markingAll
              ? <Loader2 className="mr-2 h-3.5 w-3.5 animate-spin" />
              : <CheckCheck className="mr-2 h-3.5 w-3.5" />}
            Mark all read
          </Button>
        )}
      </div>

      {/* Empty state */}
      {notifications.length === 0 ? (
        <div className="flex flex-col items-center gap-3 py-24 text-center rounded-xl border border-dashed border-border">
          <div className="flex h-14 w-14 items-center justify-center rounded-full bg-muted">
            <Bell className="h-7 w-7 text-muted-foreground" />
          </div>
          <p className="font-semibold">No notifications</p>
          <p className="text-sm text-muted-foreground max-w-xs">
            You're all caught up! Notifications appear here when something changes in your workspace.
          </p>
        </div>
      ) : (
        <div className="space-y-8">
          {groups.map((group) => (
            <div key={group.label}>
              <p className="mb-3 text-xs font-bold uppercase tracking-widest text-muted-foreground/60">
                {group.label}
              </p>
              <div className="space-y-2">
                {group.items.map((n) => {
                  const Icon = TYPE_ICON[n.type] ?? Info;
                  const iconColor = TYPE_COLOR[n.type] ?? "text-muted-foreground";
                  const iconBg = TYPE_BG[n.type] ?? "bg-muted";
                  const isUnread = !n.read_at;

                  return (
                    <div
                      key={n.id}
                      className={cn(
                        "group relative flex items-start gap-4 rounded-xl border p-4 transition-all",
                        isUnread
                          ? "border-primary/20 bg-primary/5"
                          : "border-border/60 bg-background hover:bg-muted/20",
                      )}
                    >
                      {/* Unread dot */}
                      {isUnread && (
                        <span className="absolute right-4 top-4 h-2 w-2 rounded-full bg-primary" />
                      )}

                      {/* Icon */}
                      <div className={cn("mt-0.5 flex h-9 w-9 shrink-0 items-center justify-center rounded-xl", iconBg, iconColor)}>
                        <Icon className="h-4 w-4" />
                      </div>

                      {/* Content */}
                      <div className="min-w-0 flex-1">
                        <p className={cn("text-sm font-semibold", isUnread ? "text-foreground" : "text-foreground/80")}>
                          {n.title}
                        </p>
                        {n.body && (
                          <p className="mt-0.5 text-xs text-muted-foreground leading-relaxed line-clamp-2">{n.body}</p>
                        )}
                        <div className="mt-2 flex items-center gap-3">
                          <span className="text-xs text-muted-foreground">{formatRelative(n.created_at)}</span>
                          {n.action_url && n.action_label && (
                            <a href={n.action_url} className="text-xs font-semibold text-primary hover:underline">
                              {n.action_label} →
                            </a>
                          )}
                        </div>
                      </div>

                      {/* Actions — appear on hover */}
                      <div className="flex shrink-0 items-center gap-1 opacity-0 transition-opacity group-hover:opacity-100">
                        {isUnread && (
                          <Button
                            size="icon"
                            variant="ghost"
                            className="h-7 w-7 text-muted-foreground hover:text-green-600"
                            onClick={() => handleMarkRead(n.id)}
                            disabled={busyId === n.id}
                            title="Mark as read"
                          >
                            <CheckCircle2 className="h-3.5 w-3.5" />
                          </Button>
                        )}
                        <Button
                          size="icon"
                          variant="ghost"
                          className="h-7 w-7 text-muted-foreground hover:text-destructive"
                          onClick={() => handleDismiss(n.id)}
                          disabled={busyId === n.id}
                          title="Dismiss"
                        >
                          {busyId === n.id
                            ? <Loader2 className="h-3.5 w-3.5 animate-spin" />
                            : <Trash2 className="h-3.5 w-3.5" />}
                        </Button>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
