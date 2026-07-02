import { createFileRoute } from "@tanstack/react-router";
import { queryOptions, useSuspenseQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { useState } from "react";
import { toast } from "sonner";
import {
  Zap, Plus, Trash2, Loader2, CheckCircle2, XCircle,
  RefreshCw, Clock, Globe, Shield, Info, ToggleLeft, ToggleRight,
} from "lucide-react";
import { cn } from "@/lib/utils";
import {
  listWebhooks, createWebhook, deleteWebhook, toggleWebhook,
  getWebhookLogs, triggerManualCachePurge, type Webhook, type WebhookLog,
} from "@/lib/webhook.functions";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
} from "@/components/ui/alert-dialog";

// ── Query ──────────────────────────────────────────────────────────────────────

const webhooksQuery = queryOptions({
  queryKey: ["admin", "webhooks"],
  queryFn: () => listWebhooks(),
});

export const Route = createFileRoute("/admin/workspaces/$id/cache-invalidation")({
  head: () => ({ meta: [{ title: "Cache Invalidation" }] }),
  loader: ({ context }) => context.queryClient.ensureQueryData(webhooksQuery),
  component: CacheInvalidationPage,
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

function StatusBadge({ status, error }: { status: number | null; error: string | null }) {
  if (error) return (
    <span className="flex items-center gap-1 text-[11px] font-medium text-red-600">
      <XCircle className="h-3 w-3" /> Error
    </span>
  );
  if (status === null) return (
    <span className="flex items-center gap-1 text-[11px] font-medium text-muted-foreground">
      <Clock className="h-3 w-3" /> Pending
    </span>
  );
  if (status >= 200 && status < 300) return (
    <span className="flex items-center gap-1 text-[11px] font-medium text-emerald-600">
      <CheckCircle2 className="h-3 w-3" /> {status} OK
    </span>
  );
  return (
    <span className="flex items-center gap-1 text-[11px] font-medium text-red-600">
      <XCircle className="h-3 w-3" /> {status}
    </span>
  );
}

// ── Log drawer ─────────────────────────────────────────────────────────────────

function WebhookLogsPanel({ webhookId, onClose }: { webhookId: string; onClose: () => void }) {
  const getLogs = useServerFn(getWebhookLogs);
  const [logs, setLogs] = useState<WebhookLog[] | null>(null);
  const [loading, setLoading] = useState(true);

  useState(() => {
    getLogs({ data: { webhookId } })
      .then((data) => { setLogs(data); setLoading(false); })
      .catch(() => { setLogs([]); setLoading(false); });
  });

  return (
    <div className="rounded-xl border border-border bg-muted/30 p-5 space-y-3">
      <div className="flex items-center justify-between">
        <p className="text-sm font-semibold">Recent Deliveries</p>
        <button type="button" onClick={onClose} className="text-xs text-muted-foreground hover:text-foreground">
          Close
        </button>
      </div>
      {loading ? (
        <div className="flex items-center gap-2 text-sm text-muted-foreground py-4">
          <Loader2 className="h-3.5 w-3.5 animate-spin" /> Loading logs…
        </div>
      ) : !logs?.length ? (
        <p className="text-xs text-muted-foreground py-2">No deliveries yet for this endpoint.</p>
      ) : (
        <div className="divide-y divide-border rounded-lg border border-border bg-white overflow-hidden">
          {logs.map((log) => (
            <div key={log.id} className="flex items-center justify-between gap-4 px-4 py-3">
              <div className="flex items-center gap-3 min-w-0">
                <StatusBadge status={log.response_status} error={log.error} />
                <span className="text-xs text-muted-foreground truncate">{log.event}</span>
              </div>
              <div className="flex items-center gap-3 shrink-0 text-[11px] text-muted-foreground">
                {log.duration_ms != null && <span>{log.duration_ms}ms</span>}
                <span>{fmtDate(log.delivered_at)}</span>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

// ── Endpoint row ───────────────────────────────────────────────────────────────

function EndpointRow({
  hook, onDelete, onToggle, onPurge,
}: {
  hook: Webhook;
  onDelete: () => void;
  onToggle: () => void;
  onPurge: () => Promise<void>;
}) {
  const [purging, setPurging]     = useState(false);
  const [logsOpen, setLogsOpen]   = useState(false);
  const [lastResult, setLastResult] = useState<{ status: number | null; error: string | null } | null>(null);

  async function handlePurge() {
    setPurging(true);
    try {
      await onPurge();
      setLastResult({ status: 200, error: null });
    } catch {
      setLastResult({ status: null, error: "Failed" });
    } finally {
      setPurging(false);
    }
  }

  return (
    <div className="space-y-3">
      <div
        className={cn(
          "flex items-center gap-4 rounded-xl border p-4 transition-all",
          hook.active ? "border-border bg-white" : "border-border bg-muted/20 opacity-70",
        )}
      >
        {/* Status dot */}
        <div className={cn(
          "h-2 w-2 shrink-0 rounded-full",
          hook.active ? "bg-emerald-500" : "bg-muted-foreground/30",
        )} />

        {/* URL + meta */}
        <div className="min-w-0 flex-1">
          <p className="text-sm font-medium text-foreground truncate">{hook.url}</p>
          <div className="mt-0.5 flex items-center gap-3 text-[11px] text-muted-foreground">
            <span>{hook.active ? "Active" : "Disabled"}</span>
            <span>·</span>
            <span>Added {fmtDate(hook.created_at)}</span>
            {lastResult && (
              <>
                <span>·</span>
                <StatusBadge status={lastResult.status} error={lastResult.error} />
              </>
            )}
          </div>
        </div>

        {/* Actions */}
        <div className="flex shrink-0 items-center gap-2">
          <button
            type="button"
            onClick={() => setLogsOpen((o) => !o)}
            className="rounded-lg border border-border bg-white px-3 py-1.5 text-xs font-medium hover:border-primary/40 transition-colors"
          >
            Logs
          </button>
          <button
            type="button"
            onClick={onToggle}
            title={hook.active ? "Disable" : "Enable"}
            className="rounded-lg border border-border bg-white p-1.5 text-muted-foreground hover:border-primary/40 hover:text-foreground transition-colors"
          >
            {hook.active
              ? <ToggleRight className="h-4 w-4 text-emerald-500" />
              : <ToggleLeft className="h-4 w-4" />}
          </button>
          <button
            type="button"
            onClick={handlePurge}
            disabled={purging || !hook.active}
            className="flex items-center gap-1.5 rounded-lg border border-primary/30 bg-primary/5 px-3 py-1.5 text-xs font-semibold text-primary hover:bg-primary/10 transition-colors disabled:opacity-50 disabled:pointer-events-none"
          >
            {purging
              ? <Loader2 className="h-3.5 w-3.5 animate-spin" />
              : <Zap className="h-3.5 w-3.5" />}
            Purge
          </button>
          <button
            type="button"
            onClick={onDelete}
            title="Remove endpoint"
            className="rounded-lg border border-transparent p-1.5 text-muted-foreground/40 hover:border-red-200 hover:bg-red-50 hover:text-red-500 transition-colors"
          >
            <Trash2 className="h-3.5 w-3.5" />
          </button>
        </div>
      </div>

      {logsOpen && (
        <WebhookLogsPanel webhookId={hook.id} onClose={() => setLogsOpen(false)} />
      )}
    </div>
  );
}

// ── Main component ─────────────────────────────────────────────────────────────

function CacheInvalidationPage() {
  const { data: allWebhooks } = useSuspenseQuery(webhooksQuery);
  const queryClient           = useQueryClient();
  const doCreate              = useServerFn(createWebhook);
  const doDelete              = useServerFn(deleteWebhook);
  const doToggle              = useServerFn(toggleWebhook);
  const doPurge               = useServerFn(triggerManualCachePurge);

  // Filter to cache.invalidate webhooks only
  const endpoints = allWebhooks.filter(
    (w: Webhook) => Array.isArray(w.events) && w.events.includes("cache.invalidate" as any),
  );

  const [showForm,     setShowForm]     = useState(false);
  const [url,          setUrl]          = useState("");
  const [secret,       setSecret]       = useState("");
  const [busy,         setBusy]         = useState(false);
  const [purgingAll,   setPurgingAll]   = useState(false);
  const [pendingDelete, setPendingDelete] = useState<Webhook | null>(null);

  async function refresh() {
    await queryClient.invalidateQueries({ queryKey: ["admin", "webhooks"] });
  }

  async function handleCreate(e: React.FormEvent) {
    e.preventDefault();
    if (!url.trim()) { toast.error("Enter a valid URL"); return; }
    setBusy(true);
    try {
      await doCreate({
        data: {
          name: "Cache Invalidation",
          url:    url.trim(),
          secret: secret.trim(),
          events: ["cache.invalidate"],
        },
      });
      toast.success("Cache invalidation endpoint added");
      setUrl(""); setSecret(""); setShowForm(false);
      await refresh();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to add endpoint");
    } finally {
      setBusy(false);
    }
  }

  async function handleDelete() {
    if (!pendingDelete) return;
    setBusy(true);
    try {
      await doDelete({ data: { id: pendingDelete.id } });
      toast.success("Endpoint removed");
      setPendingDelete(null);
      await refresh();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed");
    } finally {
      setBusy(false);
    }
  }

  async function handleToggle(hook: Webhook) {
    try {
      await doToggle({ data: { id: hook.id, active: !hook.active } });
      await refresh();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed");
    }
  }

  async function handlePurgeOne(hook: Webhook) {
    const result = await doPurge({ data: { webhookId: hook.id } });
    if (result.fired === 0) throw new Error("No active endpoints found");
    const r = result.results[0];
    if (r?.error) throw new Error(r.error);
    toast.success(`Cache purged — ${r?.status ?? "?"} in ${r?.duration_ms}ms`);
    await refresh();
  }

  async function handlePurgeAll() {
    if (endpoints.filter((h) => h.active).length === 0) {
      toast.error("No active endpoints configured");
      return;
    }
    setPurgingAll(true);
    try {
      const result = await doPurge({ data: {} });
      if (result.fired === 0) {
        toast.error("No active cache invalidation endpoints found");
      } else {
        const ok  = result.results.filter((r) => !r.error && r.status && r.status < 400).length;
        const err = result.fired - ok;
        if (err === 0) {
          toast.success(`All ${result.fired} endpoint${result.fired > 1 ? "s" : ""} purged successfully`);
        } else {
          toast.warning(`${ok} succeeded, ${err} failed`);
        }
      }
      await refresh();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Purge failed");
    } finally {
      setPurgingAll(false);
    }
  }

  const activeCount = endpoints.filter((h) => h.active).length;

  return (
    <div className="min-h-full px-8 py-8 space-y-8">

      {/* ── Header ── */}
      <div className="flex items-start justify-between gap-4">
        <div className="flex items-start gap-4">
          <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-amber-50">
            <Zap className="h-5 w-5 text-amber-500" />
          </div>
          <div>
            <h1 className="text-2xl font-bold tracking-tight">Cache Invalidation</h1>
            <p className="mt-0.5 text-sm text-muted-foreground">
              Every time content is published or changed, Lunar CMS will POST to your configured endpoints — so your ISR/SSG caches stay fresh automatically.
            </p>
          </div>
        </div>
        <div className="flex shrink-0 items-center gap-2">
          <button
            type="button"
            onClick={handlePurgeAll}
            disabled={purgingAll || activeCount === 0}
            className="flex items-center gap-2 rounded-lg border border-amber-200 bg-amber-50 px-4 py-2 text-sm font-semibold text-amber-700 hover:bg-amber-100 transition-colors disabled:opacity-50 disabled:pointer-events-none"
          >
            {purgingAll
              ? <Loader2 className="h-4 w-4 animate-spin" />
              : <Zap className="h-4 w-4" />}
            Purge All Caches
          </button>
          <button
            type="button"
            onClick={() => setShowForm(true)}
            className="flex items-center gap-2 rounded-lg bg-primary px-4 py-2 text-sm font-semibold text-white shadow-sm hover:bg-primary/90 transition-colors"
          >
            <Plus className="h-4 w-4" /> Add Endpoint
          </button>
        </div>
      </div>

      {/* ── How it works ── */}
      <div className="rounded-xl border border-blue-100 bg-blue-50 p-5 space-y-3">
        <div className="flex items-center gap-2">
          <Info className="h-4 w-4 shrink-0 text-blue-600" />
          <p className="text-sm font-semibold text-blue-900">How it works</p>
        </div>
        <div className="grid gap-3 sm:grid-cols-3 text-xs text-blue-800">
          <div className="space-y-1">
            <p className="font-medium">① Automatic</p>
            <p className="text-blue-700/80">When a post is published, updated, unpublished, or deleted, Lunar CMS fires a <code className="rounded bg-blue-100 px-1">cache.invalidate</code> POST to every active endpoint.</p>
          </div>
          <div className="space-y-1">
            <p className="font-medium">② Manual Purge</p>
            <p className="text-blue-700/80">Click <strong>Purge</strong> on any endpoint to fire it instantly — useful after bulk edits or when you want to force a rebuild.</p>
          </div>
          <div className="space-y-1">
            <p className="font-medium">③ Verified Delivery</p>
            <p className="text-blue-700/80">Add a signing secret and Lunar CMS will include an <code className="rounded bg-blue-100 px-1">X-Lunar-Signature</code> HMAC header your server can verify.</p>
          </div>
        </div>
      </div>

      {/* ── Payload example ── */}
      <div className="rounded-xl border border-border bg-zinc-950 overflow-hidden">
        <div className="flex items-center gap-2 border-b border-white/10 px-4 py-2.5">
          <Globe className="h-3.5 w-3.5 text-zinc-400" />
          <span className="text-xs font-medium text-zinc-400">Payload sent to your endpoint</span>
        </div>
        <pre className="px-5 py-4 text-xs text-zinc-200 font-mono leading-relaxed">{`POST https://your-site.com/api/revalidate
Content-Type: application/json
X-Lunar-Event: cache.invalidate
X-Lunar-Signature: sha256=<hmac>   (only if secret is set)

{
  "event": "cache.invalidate",
  "timestamp": "2025-01-20T12:00:00.000Z",
  "data": {
    "slug": "my-post",
    "title": "My Post",
    "reason": "post.published"
  }
}`}</pre>
      </div>

      {/* ── Add form ── */}
      {showForm && (
        <form
          onSubmit={handleCreate}
          className="rounded-xl border border-primary/20 bg-primary/5 p-6 space-y-5"
        >
          <div className="flex items-center justify-between">
            <h2 className="text-sm font-semibold">Add Cache Invalidation Endpoint</h2>
            <button
              type="button"
              onClick={() => { setShowForm(false); setUrl(""); setSecret(""); }}
              className="text-xs text-muted-foreground hover:text-foreground"
            >
              Cancel
            </button>
          </div>
          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-1.5">
              <Label htmlFor="ci-url">Revalidation URL</Label>
              <Input
                id="ci-url"
                type="url"
                value={url}
                onChange={(e) => setUrl(e.target.value)}
                placeholder="https://your-site.com/api/revalidate"
                required
                autoFocus
              />
              <p className="text-[11px] text-muted-foreground">
                Your ISR/SSG cache purge endpoint (e.g. Next.js <code>/api/revalidate</code>)
              </p>
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="ci-secret">
                Signing Secret{" "}
                <span className="font-normal text-muted-foreground">(optional)</span>
              </Label>
              <Input
                id="ci-secret"
                value={secret}
                onChange={(e) => setSecret(e.target.value)}
                placeholder="my-secret-token"
              />
              <p className="text-[11px] text-muted-foreground flex items-center gap-1">
                <Shield className="h-3 w-3" />
                Used to sign the <code>X-Lunar-Signature</code> header
              </p>
            </div>
          </div>
          <div className="rounded-lg border border-border bg-white p-4 text-xs space-y-2">
            <p className="font-medium text-muted-foreground">Next.js example handler</p>
            <pre className="text-zinc-600 leading-relaxed overflow-x-auto">{`// pages/api/revalidate.ts
export default async function handler(req, res) {
  const signature = req.headers['x-lunar-signature'];
  // optional: verify HMAC with your secret
  await res.revalidate('/blog'); // revalidate your blog page
  await res.revalidate('/');     // revalidate home page
  return res.json({ revalidated: true });
}`}</pre>
          </div>
          <button
            type="submit"
            disabled={busy}
            className="flex items-center gap-2 rounded-lg bg-primary px-4 py-2 text-sm font-semibold text-white hover:bg-primary/90 disabled:opacity-60 transition-colors"
          >
            {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : <Plus className="h-4 w-4" />}
            Add Endpoint
          </button>
        </form>
      )}

      {/* ── Endpoint list ── */}
      <div className="space-y-3">
        <div className="flex items-center justify-between">
          <h2 className="text-sm font-semibold">
            Configured Endpoints
            {endpoints.length > 0 && (
              <span className="ml-2 rounded-full bg-muted px-2 py-0.5 text-[11px] font-medium text-muted-foreground">
                {activeCount} active / {endpoints.length} total
              </span>
            )}
          </h2>
          {endpoints.length > 0 && (
            <button
              type="button"
              onClick={refresh}
              className="flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground transition-colors"
            >
              <RefreshCw className="h-3 w-3" /> Refresh
            </button>
          )}
        </div>

        {endpoints.length === 0 ? (
          <div className="flex flex-col items-center gap-3 rounded-xl border border-dashed border-border py-16 text-center">
            <div className="flex h-12 w-12 items-center justify-center rounded-full bg-amber-50">
              <Zap className="h-6 w-6 text-amber-400" />
            </div>
            <div>
              <p className="text-sm font-medium">No endpoints configured</p>
              <p className="mt-1 text-xs text-muted-foreground max-w-xs">
                Add your website's revalidation URL and Lunar CMS will automatically purge its cache every time you publish content.
              </p>
            </div>
            <button
              type="button"
              onClick={() => setShowForm(true)}
              className="mt-1 flex items-center gap-2 rounded-lg bg-primary px-4 py-2 text-sm font-semibold text-white hover:bg-primary/90 transition-colors"
            >
              <Plus className="h-4 w-4" /> Add your first endpoint
            </button>
          </div>
        ) : (
          <div className="space-y-2">
            {endpoints.map((hook) => (
              <EndpointRow
                key={hook.id}
                hook={hook}
                onDelete={() => setPendingDelete(hook)}
                onToggle={() => handleToggle(hook)}
                onPurge={() => handlePurgeOne(hook)}
              />
            ))}
          </div>
        )}
      </div>

      {/* ── Delete confirmation ── */}
      <AlertDialog open={Boolean(pendingDelete)} onOpenChange={(o) => !o && setPendingDelete(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Remove this endpoint?</AlertDialogTitle>
            <AlertDialogDescription>
              <code className="block mt-1 rounded bg-muted px-2 py-1 text-xs">{pendingDelete?.url}</code>
              <span className="mt-2 block">
                This endpoint will stop receiving cache invalidation requests. You can re-add it at any time.
              </span>
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
              Remove
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
