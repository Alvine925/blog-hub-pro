import { createFileRoute } from "@tanstack/react-router";
import { queryOptions, useSuspenseQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { useState } from "react";
import { toast } from "sonner";
import {
  Webhook, Plus, Trash2, ToggleLeft, ToggleRight, Loader2,
  ChevronDown, ChevronRight, CheckCircle2, XCircle, Clock,
  RefreshCw, FlaskConical,
} from "lucide-react";
import {
  listWebhooks, createWebhook, deleteWebhook, toggleWebhook,
  getWebhookLogs, testWebhookDelivery, retryWebhookDelivery,
  WEBHOOK_EVENTS, type Webhook as WebhookType, type WebhookLog,
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

// ── Helpers ────────────────────────────────────────────────────────────────────

function fmtDate(d: string) {
  const ms = Date.now() - new Date(d).getTime();
  const m = Math.floor(ms / 60000);
  if (m < 1) return "just now";
  if (m < 60) return `${m}m ago`;
  const h = Math.floor(m / 60);
  if (h < 24) return `${h}h ago`;
  return new Date(d).toLocaleDateString("en-US", { month: "short", day: "numeric" });
}

function isFailedLog(log: WebhookLog) {
  return !!log.error || (log.response_status !== null && log.response_status >= 400);
}

function StatusBadge({ log }: { log: WebhookLog }) {
  if (log.error) return (
    <span className="flex items-center gap-1 text-[11px] font-medium text-red-600">
      <XCircle className="h-3 w-3" /> Error
    </span>
  );
  if (log.response_status === null) return (
    <span className="flex items-center gap-1 text-[11px] font-medium text-muted-foreground">
      <Clock className="h-3 w-3" /> Pending
    </span>
  );
  if (log.response_status >= 200 && log.response_status < 300) return (
    <span className="flex items-center gap-1 text-[11px] font-medium text-emerald-600">
      <CheckCircle2 className="h-3 w-3" /> {log.response_status}
    </span>
  );
  return (
    <span className="flex items-center gap-1 text-[11px] font-medium text-red-600">
      <XCircle className="h-3 w-3" /> {log.response_status}
    </span>
  );
}

// ── Log panel ──────────────────────────────────────────────────────────────────

function WebhookLogsPanel({ webhook }: { webhook: WebhookType }) {
  const doGetLogs = useServerFn(getWebhookLogs);
  const doRetry   = useServerFn(retryWebhookDelivery);
  const [logs, setLogs]           = useState<WebhookLog[] | null>(null);
  const [loading, setLoading]     = useState(false);
  const [loaded, setLoaded]       = useState(false);
  const [retrying, setRetrying]   = useState<string | null>(null);

  async function loadLogs() {
    setLoading(true);
    try {
      const data = await doGetLogs({ data: { webhookId: webhook.id } });
      setLogs(data);
      setLoaded(true);
    } catch {
      setLogs([]);
      setLoaded(true);
    } finally {
      setLoading(false);
    }
  }

  async function handleRetry(log: WebhookLog) {
    setRetrying(log.id);
    try {
      const result = await doRetry({ data: { logId: log.id } });
      if (result.error) {
        toast.error(`Retry failed: ${result.error}`);
      } else {
        toast.success(`Retry delivered — ${result.status} in ${result.duration_ms}ms`);
        await loadLogs();
      }
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Retry failed");
    } finally {
      setRetrying(null);
    }
  }

  if (!loaded) {
    return (
      <button
        type="button"
        onClick={loadLogs}
        disabled={loading}
        className="flex items-center gap-1.5 text-xs text-muted-foreground hover:text-foreground transition-colors"
      >
        {loading
          ? <Loader2 className="h-3 w-3 animate-spin" />
          : <ChevronRight className="h-3 w-3" />}
        View delivery logs
      </button>
    );
  }

  return (
    <div className="mt-1 space-y-2 pl-4 border-l-2 border-border">
      <div className="flex items-center justify-between">
        <p className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground/60">
          Recent Deliveries
        </p>
        <button
          type="button"
          onClick={loadLogs}
          disabled={loading}
          className="flex items-center gap-1 text-[11px] text-muted-foreground hover:text-foreground transition-colors"
        >
          <RefreshCw className={cn("h-3 w-3", loading && "animate-spin")} />
          Refresh
        </button>
      </div>

      {!logs?.length ? (
        <p className="text-xs text-muted-foreground py-1">No deliveries recorded yet.</p>
      ) : (
        <div className="space-y-1">
          {logs.map((log) => (
            <div
              key={log.id}
              className={cn(
                "flex items-center justify-between gap-3 rounded-lg border px-3 py-2 text-xs",
                isFailedLog(log)
                  ? "border-red-100 bg-red-50/50"
                  : "border-border bg-white",
              )}
            >
              <div className="flex items-center gap-3 min-w-0">
                <StatusBadge log={log} />
                <span className="font-mono text-muted-foreground truncate">{log.event}</span>
                {log.error && (
                  <span className="truncate text-red-600/70 max-w-[200px]" title={log.error}>
                    {log.error}
                  </span>
                )}
              </div>
              <div className="flex shrink-0 items-center gap-2">
                {log.duration_ms != null && (
                  <span className="text-[11px] text-muted-foreground">{log.duration_ms}ms</span>
                )}
                <span className="text-[11px] text-muted-foreground">{fmtDate(log.delivered_at)}</span>
                {isFailedLog(log) && !log.event.includes("(retry)") && (
                  <button
                    type="button"
                    onClick={() => handleRetry(log)}
                    disabled={retrying === log.id}
                    className="flex items-center gap-1 rounded border border-amber-200 bg-amber-50 px-2 py-0.5 text-[11px] font-medium text-amber-700 hover:bg-amber-100 transition-colors disabled:opacity-50"
                  >
                    {retrying === log.id
                      ? <Loader2 className="h-2.5 w-2.5 animate-spin" />
                      : <RefreshCw className="h-2.5 w-2.5" />}
                    Retry
                  </button>
                )}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

// ── Webhook row ────────────────────────────────────────────────────────────────

function WebhookRow({
  wh, onDelete, onToggle,
}: {
  wh: WebhookType;
  onDelete: () => void;
  onToggle: () => void;
}) {
  const doTest = useServerFn(testWebhookDelivery);
  const [expanded, setExpanded] = useState(false);
  const [testing, setTesting]   = useState(false);

  async function handleTest() {
    setTesting(true);
    try {
      const r = await doTest({ data: { id: wh.id } });
      if (r.error) {
        toast.error(`Test failed: ${r.error}`);
      } else if (r.status && r.status >= 200 && r.status < 300) {
        toast.success(`Test delivered — ${r.status} in ${r.duration_ms}ms`);
      } else {
        toast.warning(`Test returned ${r.status ?? "no response"} in ${r.duration_ms}ms`);
      }
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Test failed");
    } finally {
      setTesting(false);
    }
  }

  return (
    <div className="border-b border-border last:border-0">
      <div className="flex items-center gap-3 py-3.5">
        {/* Expand button */}
        <button
          type="button"
          onClick={() => setExpanded((e) => !e)}
          className="shrink-0 text-muted-foreground/40 hover:text-muted-foreground transition-colors"
        >
          {expanded
            ? <ChevronDown className="h-3.5 w-3.5" />
            : <ChevronRight className="h-3.5 w-3.5" />}
        </button>

        {/* Status dot */}
        <div className={cn(
          "h-2 w-2 shrink-0 rounded-full",
          wh.active ? "bg-emerald-500" : "bg-muted-foreground/30",
        )} />

        {/* URL + events */}
        <div className="flex-1 min-w-0">
          <p className="text-sm font-mono truncate">{wh.url}</p>
          {Array.isArray(wh.events) && (
            <div className="mt-1 flex flex-wrap gap-1">
              {wh.events.slice(0, 5).map((ev: string) => (
                <span key={ev} className="rounded bg-muted px-1.5 py-0.5 text-[10px] font-mono text-muted-foreground">
                  {ev}
                </span>
              ))}
              {wh.events.length > 5 && (
                <span className="text-[10px] text-muted-foreground/60">+{wh.events.length - 5} more</span>
              )}
            </div>
          )}
        </div>

        {/* Created */}
        <span className="w-24 text-xs text-muted-foreground hidden md:block shrink-0">
          {fmtDate(wh.created_at)}
        </span>

        {/* Status pill */}
        <span className={cn(
          "w-14 text-xs font-medium hidden sm:block shrink-0",
          wh.active ? "text-emerald-600" : "text-muted-foreground",
        )}>
          {wh.active ? "Active" : "Paused"}
        </span>

        {/* Actions */}
        <div className="flex items-center gap-1 shrink-0">
          <button
            type="button"
            onClick={handleTest}
            disabled={testing}
            title="Send test delivery"
            className="flex h-7 items-center gap-1 rounded px-2 text-[11px] font-medium text-muted-foreground border border-border hover:border-primary/30 hover:text-foreground transition-colors disabled:opacity-50"
          >
            {testing
              ? <Loader2 className="h-3 w-3 animate-spin" />
              : <FlaskConical className="h-3 w-3" />}
            Test
          </button>
          <button
            type="button"
            onClick={onToggle}
            title={wh.active ? "Pause" : "Enable"}
            className="flex h-7 w-7 items-center justify-center rounded text-muted-foreground hover:text-foreground hover:bg-muted transition-colors"
          >
            {wh.active
              ? <ToggleRight className="h-3.5 w-3.5 text-emerald-600" />
              : <ToggleLeft className="h-3.5 w-3.5" />}
          </button>
          <button
            type="button"
            onClick={onDelete}
            title="Delete"
            className="flex h-7 w-7 items-center justify-center rounded text-muted-foreground hover:text-red-600 hover:bg-red-50 transition-colors"
          >
            <Trash2 className="h-3.5 w-3.5" />
          </button>
        </div>
      </div>

      {/* Logs panel */}
      {expanded && (
        <div className="pb-4">
          <WebhookLogsPanel webhook={wh} />
        </div>
      )}
    </div>
  );
}

// ── Main component ─────────────────────────────────────────────────────────────

function WorkspaceWebhooks() {
  const { data: webhooks } = useSuspenseQuery(webhooksQuery);
  const queryClient = useQueryClient();
  const doCreate    = useServerFn(createWebhook);
  const doDelete    = useServerFn(deleteWebhook);
  const doToggle    = useServerFn(toggleWebhook);

  const [showForm,      setShowForm]      = useState(false);
  const [url,           setUrl]           = useState("");
  const [name,          setName]          = useState("");
  const [selectedEvents, setSelectedEvents] = useState<string[]>([]);
  const [busy,          setBusy]          = useState(false);
  const [pendingDelete, setPendingDelete] = useState<{ id: string; url: string } | null>(null);

  const allEvents: string[] = Array.isArray(WEBHOOK_EVENTS)
    ? WEBHOOK_EVENTS as unknown as string[]
    : Object.values(WEBHOOK_EVENTS as Record<string, string[]>).flat();

  function toggleEvent(event: string) {
    setSelectedEvents((prev) =>
      prev.includes(event) ? prev.filter((e) => e !== event) : [...prev, event],
    );
  }

  async function refresh() {
    await queryClient.invalidateQueries({ queryKey: ["admin", "webhooks"] });
  }

  async function handleCreate(e: React.FormEvent) {
    e.preventDefault();
    if (!url.trim() || selectedEvents.length === 0) return;
    setBusy(true);
    try {
      await doCreate({
        data: {
          name: name.trim() || "Webhook",
          url: url.trim(),
          secret: "",
          events: selectedEvents,
        },
      });
      toast.success("Webhook created");
      setUrl(""); setName(""); setSelectedEvents([]); setShowForm(false);
      await refresh();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed");
    } finally {
      setBusy(false);
    }
  }

  async function handleToggle(wh: WebhookType) {
    try {
      await doToggle({ data: { id: wh.id, active: !wh.active } });
      await refresh();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed");
    }
  }

  async function handleDelete() {
    if (!pendingDelete) return;
    setBusy(true);
    try {
      await doDelete({ data: { id: pendingDelete.id } });
      toast.success("Webhook deleted");
      setPendingDelete(null);
      await refresh();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="min-h-full px-4 py-4 sm:px-8 sm:py-8">
      {/* Header */}
      <div className="mb-6 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-xl font-semibold">Webhooks</h1>
          <p className="mt-0.5 text-sm text-muted-foreground">
            Receive real-time event notifications via HTTP. Failed deliveries retry automatically up to 3 times.
          </p>
        </div>
        <button
          type="button"
          onClick={() => setShowForm((v) => !v)}
          className="flex items-center gap-1.5 rounded-md bg-primary px-3 py-1.5 text-sm font-medium text-primary-foreground hover:bg-primary/90 transition-colors"
        >
          <Plus className="h-3.5 w-3.5" /> New Webhook
        </button>
      </div>

      {/* Retry info banner */}
      <div className="mb-6 flex items-start gap-3 rounded-lg border border-blue-100 bg-blue-50 px-4 py-3">
        <RefreshCw className="mt-0.5 h-4 w-4 shrink-0 text-blue-500" />
        <div className="text-xs text-blue-800 space-y-0.5">
          <p className="font-semibold">Automatic retry with exponential backoff</p>
          <p className="text-blue-700/80">
            When a delivery fails (network error or 5xx), Lunar CMS retries up to{" "}
            <strong>3 times</strong> with <strong>1 s → 2 s</strong> backoff — automatically, before giving up and logging the failure. You can also manually retry any failed delivery from the logs panel below.
          </p>
        </div>
      </div>

      {/* Create form */}
      {showForm && (
        <form onSubmit={handleCreate} className="mb-8 rounded-xl border border-primary/20 bg-primary/5 p-5 space-y-4">
          <h2 className="text-sm font-semibold">New webhook endpoint</h2>
          <div className="grid gap-3 sm:grid-cols-2">
            <div className="space-y-1">
              <label className="text-xs font-medium text-muted-foreground">Name</label>
              <Input
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="My Webhook"
              />
            </div>
            <div className="space-y-1">
              <label className="text-xs font-medium text-muted-foreground">Endpoint URL</label>
              <Input
                type="url"
                placeholder="https://your-site.com/webhook"
                value={url}
                onChange={(e) => setUrl(e.target.value)}
                required
                autoFocus
              />
            </div>
          </div>
          <div>
            <p className="mb-2 text-xs font-medium text-muted-foreground">Events to subscribe to:</p>
            <div className="flex flex-wrap gap-1.5">
              {allEvents.map((event) => (
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
            <Button type="button" variant="ghost" size="sm" onClick={() => { setShowForm(false); setUrl(""); setName(""); setSelectedEvents([]); }}>
              Cancel
            </Button>
          </div>
        </form>
      )}

      {/* List */}
      {webhooks.length === 0 ? (
        <div className="flex flex-col items-center gap-3 py-20 border-y border-border text-center">
          <Webhook className="h-8 w-8 text-muted-foreground/30" />
          <p className="text-sm text-muted-foreground">No webhooks yet.</p>
          <button
            type="button"
            onClick={() => setShowForm(true)}
            className="text-xs text-primary hover:underline"
          >
            Create your first webhook
          </button>
        </div>
      ) : (
        <div>
          <div className="flex items-center gap-3 border-b border-border pb-2 text-[10px] font-semibold uppercase tracking-widest text-muted-foreground/60">
            <span className="w-4 shrink-0" />
            <span className="w-2 shrink-0" />
            <span className="flex-1">Endpoint URL</span>
            <span className="w-24 hidden md:block shrink-0">Added</span>
            <span className="w-14 hidden sm:block shrink-0">Status</span>
            <span className="w-28 text-right shrink-0">Actions</span>
          </div>

          {(webhooks as WebhookType[]).map((wh) => (
            <WebhookRow
              key={wh.id}
              wh={wh}
              onDelete={() => setPendingDelete({ id: wh.id, url: wh.url })}
              onToggle={() => handleToggle(wh)}
            />
          ))}
        </div>
      )}

      <AlertDialog open={!!pendingDelete} onOpenChange={(o) => !o && setPendingDelete(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete webhook?</AlertDialogTitle>
            <AlertDialogDescription className="break-all">
              <code className="block mt-1 rounded bg-muted px-2 py-1 text-xs">{pendingDelete?.url}</code>
              <span className="mt-2 block">This endpoint will stop receiving events. All delivery history will also be removed.</span>
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleDelete}
              disabled={busy}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              {busy ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
              Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
