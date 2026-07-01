import { createFileRoute } from "@tanstack/react-router";
import { createServerFn } from "@tanstack/react-start";
import { useServerFn } from "@tanstack/react-start";
import { queryOptions, useSuspenseQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { toast } from "sonner";
import { Bell, CheckCheck, Trash2, Info, CheckCircle2, AlertTriangle, XCircle, Loader2 } from "lucide-react";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";

interface Notification {
  id: string; type: string; title: string; body: string | null;
  action_url: string | null; read_at: string | null; dismissed_at: string | null; created_at: string;
}

const listNotifications = createServerFn({ method: "GET" })
  .validator((input: { workspaceId: string }) => input)
  .handler(async ({ data }): Promise<Notification[]> => {
    const { getAdminClient } = await import("../../lib/supabase.server");
    const db = getAdminClient() as any;
    const { data: rows, error } = await db
      .from("notifications")
      .select("*")
      .eq("workspace_id", data.workspaceId)
      .is("dismissed_at", null)
      .order("created_at", { ascending: false })
      .limit(50);
    if (error) throw new Error(error.message);
    return rows ?? [];
  });

const markRead = createServerFn({ method: "POST" })
  .validator((input: { id: string }) => input)
  .handler(async ({ data }) => {
    const { getAdminClient } = await import("../../lib/supabase.server");
    const db = getAdminClient() as any;
    await db.from("notifications").update({ read_at: new Date().toISOString() }).eq("id", data.id);
    return { ok: true };
  });

const markAllRead = createServerFn({ method: "POST" })
  .validator((input: { workspaceId: string }) => input)
  .handler(async ({ data }) => {
    const { getAdminClient } = await import("../../lib/supabase.server");
    const db = getAdminClient() as any;
    await db.from("notifications")
      .update({ read_at: new Date().toISOString() })
      .eq("workspace_id", data.workspaceId)
      .is("read_at", null);
    return { ok: true };
  });

const dismissNotification = createServerFn({ method: "POST" })
  .validator((input: { id: string }) => input)
  .handler(async ({ data }) => {
    const { getAdminClient } = await import("../../lib/supabase.server");
    const db = getAdminClient() as any;
    await db.from("notifications").update({ dismissed_at: new Date().toISOString() }).eq("id", data.id);
    return { ok: true };
  });

const notifQuery = (id: string) =>
  queryOptions({ queryKey: ["workspace-notifications", id], queryFn: () => listNotifications({ data: { workspaceId: id } }) });

export const Route = createFileRoute("/admin/workspaces/$id/notifications")({
  loader: ({ context, params }) => context.queryClient.ensureQueryData(notifQuery(params.id)),
  component: WorkspaceNotifications,
  errorComponent: ({ error }) => <p className="p-8 text-sm text-red-600">{error.message}</p>,
});

const TYPE_ICONS: Record<string, React.ReactNode> = {
  info:    <Info className="h-4 w-4 text-blue-500" />,
  success: <CheckCircle2 className="h-4 w-4 text-emerald-500" />,
  warning: <AlertTriangle className="h-4 w-4 text-amber-500" />,
  error:   <XCircle className="h-4 w-4 text-red-500" />,
};

function fmtDate(d: string) {
  return new Date(d).toLocaleDateString("en-US", { month: "short", day: "numeric", hour: "2-digit", minute: "2-digit" });
}

function WorkspaceNotifications() {
  const { id } = Route.useParams();
  const { data: notifications } = useSuspenseQuery(notifQuery(id));
  const queryClient = useQueryClient();
  const doRead = useServerFn(markRead);
  const doAllRead = useServerFn(markAllRead);
  const doDismiss = useServerFn(dismissNotification);
  const [loading, setLoading] = useState(false);

  const unread = notifications.filter((n) => !n.read_at).length;

  async function handleMarkAll() {
    setLoading(true);
    try {
      await doAllRead({ data: { workspaceId: id } });
      await queryClient.invalidateQueries({ queryKey: ["workspace-notifications", id] });
      toast.success("All marked as read");
    } catch { toast.error("Failed"); }
    finally { setLoading(false); }
  }

  async function handleRead(notifId: string) {
    try {
      await doRead({ data: { id: notifId } });
      await queryClient.invalidateQueries({ queryKey: ["workspace-notifications", id] });
    } catch { /* silent */ }
  }

  async function handleDismiss(notifId: string) {
    try {
      await doDismiss({ data: { id: notifId } });
      await queryClient.invalidateQueries({ queryKey: ["workspace-notifications", id] });
    } catch { /* silent */ }
  }

  return (
    <div className="min-h-full px-8 py-8">
      <div className="mb-8 flex items-center justify-between">
        <div>
          <h1 className="text-xl font-semibold">Notifications</h1>
          <p className="mt-0.5 text-sm text-muted-foreground">
            {unread > 0 ? `${unread} unread` : "All caught up"}
          </p>
        </div>
        {unread > 0 && (
          <Button variant="outline" size="sm" onClick={handleMarkAll} disabled={loading}>
            {loading ? <Loader2 className="mr-2 h-3.5 w-3.5 animate-spin" /> : <CheckCheck className="mr-2 h-3.5 w-3.5" />}
            Mark all read
          </Button>
        )}
      </div>

      {notifications.length === 0 ? (
        <div className="flex flex-col items-center gap-2 py-20 border-y border-border text-center">
          <Bell className="h-8 w-8 text-muted-foreground/30" />
          <p className="text-sm text-muted-foreground">No notifications.</p>
        </div>
      ) : (
        <div>
          {notifications.map((n) => (
            <div
              key={n.id}
              className={cn(
                "group flex items-start gap-3 border-b border-border py-4 last:border-0",
                !n.read_at && "bg-primary/[0.02]",
              )}
              onMouseEnter={() => { if (!n.read_at) handleRead(n.id); }}
            >
              <span className="mt-0.5 shrink-0">{TYPE_ICONS[n.type] ?? <Info className="h-4 w-4 text-muted-foreground" />}</span>
              <div className="flex-1 min-w-0">
                <p className={cn("text-sm", !n.read_at && "font-medium")}>{n.title}</p>
                {n.body && <p className="mt-0.5 text-xs text-muted-foreground">{n.body}</p>}
                <p className="mt-1 text-[10px] text-muted-foreground/60">{fmtDate(n.created_at)}</p>
              </div>
              {!n.read_at && (
                <span className="mt-1.5 h-2 w-2 shrink-0 rounded-full bg-primary" />
              )}
              <button
                type="button"
                onClick={() => handleDismiss(n.id)}
                className="opacity-0 group-hover:opacity-100 shrink-0 flex h-6 w-6 items-center justify-center rounded text-muted-foreground hover:text-red-600 hover:bg-red-50 transition-all"
                title="Dismiss"
              >
                <Trash2 className="h-3.5 w-3.5" />
              </button>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
