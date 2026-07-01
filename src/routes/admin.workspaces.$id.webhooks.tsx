import { createFileRoute } from "@tanstack/react-router";
import { queryOptions, useSuspenseQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { useState } from "react";
import { toast } from "sonner";
import { Webhook, Plus, Trash2, ToggleLeft, ToggleRight, ChevronDown, ChevronRight, Loader2 } from "lucide-react";
import {
  listWebhooks, createWebhook, deleteWebhook, toggleWebhook, WEBHOOK_EVENTS,
} from "@/lib/webhook.functions";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
} from "@/components/ui/alert-dialog";

const webhooksQuery = queryOptions({
  queryKey: ["admin", "webhooks"],
  queryFn: () => listWebhooks(),
});

export const Route = createFileRoute("/admin/workspaces/$id/webhooks")({
  loader: ({ context }) => context.queryClient.ensureQueryData(webhooksQuery),
  component: WorkspaceWebhooks,
  errorComponent: ({ error }) => <p className="p-8 text-sm text-red-600">{error.message}</p>,
});

function fmtDate(d: string) {
  return new Date(d).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" });
}

function WorkspaceWebhooks() {
  const { data: webhooks } = useSuspenseQuery(webhooksQuery);
  const queryClient = useQueryClient();
  const doCreate = useServerFn(createWebhook);
  const doDelete = useServerFn(deleteWebhook);
  const doToggle = useServerFn(toggleWebhook);

  const [showForm, setShowForm] = useState(false);
  const [url, setUrl] = useState("");
  const [selectedEvents, setSelectedEvents] = useState<string[]>([]);
  const [busy, setBusy] = useState(false);
  const [pendingDelete, setPendingDelete] = useState<{ id: string; url: string } | null>(null);

  const allEvents: string[] = Array.isArray(WEBHOOK_EVENTS) ? WEBHOOK_EVENTS : Object.values(WEBHOOK_EVENTS).flat();

  function toggleEvent(event: string) {
    setSelectedEvents((prev) =>
      prev.includes(event) ? prev.filter((e) => e !== event) : [...prev, event],
    );
  }

  async function handleCreate(e: React.FormEvent) {
    e.preventDefault();
    if (!url.trim() || selectedEvents.length === 0) return;
    setBusy(true);
    try {
      await doCreate({ data: { url: url.trim(), events: selectedEvents, secret: "" } });
      toast.success("Webhook created");
      setUrl(""); setSelectedEvents([]); setShowForm(false);
      await queryClient.invalidateQueries({ queryKey: ["admin", "webhooks"] });
    } catch (err) { toast.error(err instanceof Error ? err.message : "Failed"); }
    finally { setBusy(false); }
  }

  async function handleToggle(id: string, enabled: boolean) {
    try {
      await doToggle({ data: { id, enabled: !enabled } });
      await queryClient.invalidateQueries({ queryKey: ["admin", "webhooks"] });
    } catch (err) { toast.error(err instanceof Error ? err.message : "Failed"); }
  }

  async function handleDelete() {
    if (!pendingDelete) return;
    setBusy(true);
    try {
      await doDelete({ data: { id: pendingDelete.id } });
      toast.success("Webhook deleted");
      setPendingDelete(null);
      await queryClient.invalidateQueries({ queryKey: ["admin", "webhooks"] });
    } catch (err) { toast.error(err instanceof Error ? err.message : "Failed"); }
    finally { setBusy(false); }
  }

  return (
    <div className="min-h-full px-8 py-8">
      <div className="mb-8 flex items-center justify-between">
        <div>
          <h1 className="text-xl font-semibold">Webhooks</h1>
          <p className="mt-0.5 text-sm text-muted-foreground">Receive real-time event notifications via HTTP.</p>
        </div>
        <button
          type="button"
          onClick={() => setShowForm((v) => !v)}
          className="flex items-center gap-1.5 rounded-md bg-primary px-3 py-1.5 text-sm font-medium text-primary-foreground hover:bg-primary/90 transition-colors"
        >
          <Plus className="h-3.5 w-3.5" /> New Webhook
        </button>
      </div>

      {/* Create form */}
      {showForm && (
        <form onSubmit={handleCreate} className="mb-8 border-b border-border pb-8 space-y-4">
          <h2 className="text-sm font-medium">New webhook endpoint</h2>
          <Input
            type="url"
            placeholder="https://your-site.com/webhook"
            value={url}
            onChange={(e) => setUrl(e.target.value)}
            required
            autoFocus
          />
          <div>
            <p className="mb-2 text-xs text-muted-foreground">Select events to listen for:</p>
            <div className="flex flex-wrap gap-1.5">
              {allEvents.slice(0, 20).map((event) => (
                <button
                  key={event}
                  type="button"
                  onClick={() => toggleEvent(event)}
                  className={cn(
                    "rounded px-2 py-0.5 text-xs font-mono transition-colors",
                    selectedEvents.includes(event)
                      ? "bg-primary text-primary-foreground"
                      : "border border-border text-muted-foreground hover:border-primary/30 hover:text-foreground",
                  )}
                >
                  {event}
                </button>
              ))}
            </div>
          </div>
          <div className="flex gap-2">
            <Button type="submit" size="sm" disabled={busy || !url.trim() || selectedEvents.length === 0}>
              {busy ? <Loader2 className="mr-2 h-3.5 w-3.5 animate-spin" /> : null}
              Create webhook
            </Button>
            <Button type="button" variant="ghost" size="sm" onClick={() => setShowForm(false)}>Cancel</Button>
          </div>
        </form>
      )}

      {/* List */}
      {webhooks.length === 0 ? (
        <div className="flex flex-col items-center gap-3 py-20 border-y border-border text-center">
          <Webhook className="h-8 w-8 text-muted-foreground/30" />
          <p className="text-sm text-muted-foreground">No webhooks yet.</p>
        </div>
      ) : (
        <div>
          <div className="flex items-center gap-3 border-b border-border pb-2 text-[10px] font-semibold uppercase tracking-widest text-muted-foreground/60">
            <span className="flex-1">Endpoint URL</span>
            <span className="w-28 hidden md:block">Created</span>
            <span className="w-16 hidden sm:block">Status</span>
            <span className="w-16 text-right">Actions</span>
          </div>

          {webhooks.map((wh: any) => (
            <div key={wh.id} className="group border-b border-border last:border-0">
              <div className="flex items-center gap-3 py-3.5">
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-mono truncate">{wh.url}</p>
                  {Array.isArray(wh.events) && (
                    <div className="mt-1 flex flex-wrap gap-1">
                      {wh.events.slice(0, 4).map((ev: string) => (
                        <span key={ev} className="text-[10px] font-mono text-muted-foreground/60">{ev}</span>
                      ))}
                      {wh.events.length > 4 && (
                        <span className="text-[10px] text-muted-foreground/60">+{wh.events.length - 4} more</span>
                      )}
                    </div>
                  )}
                </div>
                <span className="w-28 text-xs text-muted-foreground hidden md:block">
                  {fmtDate(wh.created_at)}
                </span>
                <span className={cn(
                  "w-16 text-xs font-medium hidden sm:block",
                  wh.is_active ? "text-emerald-600" : "text-muted-foreground",
                )}>
                  {wh.is_active ? "Active" : "Paused"}
                </span>
                <div className="w-16 flex items-center justify-end gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                  <button
                    type="button"
                    onClick={() => handleToggle(wh.id, wh.is_active)}
                    className="flex h-7 w-7 items-center justify-center rounded text-muted-foreground hover:text-foreground hover:bg-muted transition-colors"
                    title={wh.is_active ? "Pause" : "Enable"}
                  >
                    {wh.is_active ? <ToggleRight className="h-3.5 w-3.5 text-emerald-600" /> : <ToggleLeft className="h-3.5 w-3.5" />}
                  </button>
                  <button
                    type="button"
                    onClick={() => setPendingDelete({ id: wh.id, url: wh.url })}
                    className="flex h-7 w-7 items-center justify-center rounded text-muted-foreground hover:text-red-600 hover:bg-red-50 transition-colors"
                    title="Delete"
                  >
                    <Trash2 className="h-3.5 w-3.5" />
                  </button>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      <AlertDialog open={!!pendingDelete} onOpenChange={(o) => !o && setPendingDelete(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete webhook?</AlertDialogTitle>
            <AlertDialogDescription className="break-all">
              {pendingDelete?.url} will stop receiving events.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleDelete}
              disabled={busy}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
