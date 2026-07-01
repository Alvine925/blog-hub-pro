import { createFileRoute } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { queryOptions, useSuspenseQuery, useQueryClient, useQuery } from "@tanstack/react-query";
import { useState } from "react";
import { toast } from "sonner";
import {
  Plus, Trash2, Loader2, Webhook, ChevronDown, ChevronUp,
  CheckCircle2, XCircle, Clock, ToggleLeft, ToggleRight, Eye, EyeOff,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Checkbox } from "@/components/ui/checkbox";
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel,
  AlertDialogContent, AlertDialogDescription, AlertDialogFooter,
  AlertDialogHeader, AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import {
  listWebhooks, getWebhookLogs, createWebhook, deleteWebhook,
  toggleWebhook, WEBHOOK_EVENTS,
  type Webhook as WebhookType, type WebhookLog,
} from "@/lib/webhook.functions";
import { formatBlogDate } from "@/lib/blog-types";

const webhooksQuery = queryOptions({
  queryKey: ["admin", "webhooks"],
  queryFn: () => listWebhooks(),
});

export const Route = createFileRoute("/admin/webhooks")({
  head: () => ({ meta: [{ title: "Webhooks — Admin" }] }),
  loader: ({ context }) => context.queryClient.ensureQueryData(webhooksQuery),
  component: WebhooksPage,
  errorComponent: ({ error }) => (
    <p className="text-sm text-destructive">Failed to load webhooks: {error.message}</p>
  ),
});

const EVENT_LABELS: Record<string, string> = {
  "post.published": "Post Published",
  "post.updated": "Post Updated",
  "post.unpublished": "Post Unpublished",
  "post.deleted": "Post Deleted",
};

function LogRow({ log }: { log: WebhookLog }) {
  const ok = log.response_status !== null && log.response_status < 300;
  return (
    <div className="flex items-center gap-3 border-b border-border/50 py-2 text-xs last:border-0">
      {log.error || !ok ? (
        <XCircle className="h-3.5 w-3.5 shrink-0 text-destructive" />
      ) : (
        <CheckCircle2 className="h-3.5 w-3.5 shrink-0 text-green-500" />
      )}
      <Badge variant="outline" className="text-[10px] px-1.5 py-0 font-mono">
        {log.response_status ?? "ERR"}
      </Badge>
      <span className="min-w-0 flex-1 truncate font-medium text-muted-foreground">{log.event}</span>
      {log.duration_ms !== null && (
        <span className="shrink-0 flex items-center gap-1 text-muted-foreground">
          <Clock className="h-3 w-3" /> {log.duration_ms}ms
        </span>
      )}
      <span className="shrink-0 text-muted-foreground">{formatBlogDate(log.delivered_at)}</span>
      {log.error && (
        <span className="min-w-0 max-w-[200px] truncate text-destructive" title={log.error}>{log.error}</span>
      )}
    </div>
  );
}

function WebhookRow({ hook }: { hook: WebhookType }) {
  const queryClient = useQueryClient();
  const del = useServerFn(deleteWebhook);
  const toggle = useServerFn(toggleWebhook);
  const [expanded, setExpanded] = useState(false);
  const [pendingDelete, setPendingDelete] = useState(false);
  const [busy, setBusy] = useState(false);
  const [showSecret, setShowSecret] = useState(false);

  const logsQuery = useQuery({
    queryKey: ["admin", "webhook_logs", hook.id],
    queryFn: () => getWebhookLogs({ data: { webhookId: hook.id } }),
    enabled: expanded,
  });

  async function handleToggle() {
    setBusy(true);
    try {
      await toggle({ data: { id: hook.id, active: !hook.active } });
      await queryClient.invalidateQueries({ queryKey: ["admin", "webhooks"] });
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Failed");
    } finally {
      setBusy(false);
    }
  }

  async function handleDelete() {
    setBusy(true);
    try {
      await del({ data: { id: hook.id } });
      toast.success("Webhook deleted");
      await queryClient.invalidateQueries({ queryKey: ["admin", "webhooks"] });
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Failed");
    } finally {
      setBusy(false);
      setPendingDelete(false);
    }
  }

  return (
    <div className={`border-b border-border py-5 last:border-0 ${!hook.active ? "opacity-60" : ""}`}>
      <div className="flex items-start gap-3">
        <div className="flex-1 min-w-0">
          <div className="flex flex-wrap items-center gap-2">
            <span className="font-semibold">{hook.name}</span>
            <Badge variant={hook.active ? "default" : "secondary"} className="text-xs">
              {hook.active ? "Active" : "Paused"}
            </Badge>
          </div>
          <p className="mt-0.5 truncate text-xs font-mono text-muted-foreground">{hook.url}</p>
          <div className="mt-1.5 flex flex-wrap gap-1">
            {hook.events.map((ev) => (
              <Badge key={ev} variant="outline" className="text-[10px] px-1.5">
                {EVENT_LABELS[ev] ?? ev}
              </Badge>
            ))}
          </div>
          {hook.secret && (
            <div className="mt-1.5 flex items-center gap-1">
              <span className="text-xs text-muted-foreground">Secret:</span>
              <code className="text-xs font-mono">
                {showSecret ? hook.secret : "•".repeat(Math.min(hook.secret.length, 20))}
              </code>
              <button type="button" onClick={() => setShowSecret((v) => !v)} className="text-muted-foreground hover:text-foreground">
                {showSecret ? <EyeOff className="h-3 w-3" /> : <Eye className="h-3 w-3" />}
              </button>
            </div>
          )}
        </div>
        <div className="flex shrink-0 items-center gap-1">
          <Button size="icon" variant="ghost" onClick={handleToggle} disabled={busy} title={hook.active ? "Pause" : "Activate"}>
            {hook.active
              ? <ToggleRight className="h-5 w-5 text-primary" />
              : <ToggleLeft className="h-5 w-5 text-muted-foreground" />}
          </Button>
          <Button size="icon" variant="ghost" className="text-destructive hover:text-destructive" onClick={() => setPendingDelete(true)} disabled={busy}>
            <Trash2 className="h-4 w-4" />
          </Button>
          <Button size="icon" variant="ghost" onClick={() => setExpanded((v) => !v)} title="Delivery logs">
            {expanded ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
          </Button>
        </div>
      </div>

      {expanded && (
        <div className="mt-4 rounded border border-border bg-muted/30 p-3">
          <p className="mb-2 text-xs font-semibold uppercase tracking-wider text-muted-foreground">Recent Deliveries</p>
          {logsQuery.isLoading ? (
            <div className="flex items-center gap-2 text-xs text-muted-foreground">
              <Loader2 className="h-3 w-3 animate-spin" /> Loading…
            </div>
          ) : logsQuery.data && logsQuery.data.length > 0 ? (
            logsQuery.data.map((log) => <LogRow key={log.id} log={log} />)
          ) : (
            <p className="text-xs text-muted-foreground">No deliveries yet.</p>
          )}
        </div>
      )}

      <AlertDialog open={pendingDelete} onOpenChange={(o) => !o && setPendingDelete(false)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete "{hook.name}"?</AlertDialogTitle>
            <AlertDialogDescription>
              This webhook and all its delivery logs will be permanently removed.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={handleDelete} disabled={busy} className="bg-destructive text-destructive-foreground hover:bg-destructive/90">
              {busy && <Loader2 className="mr-2 h-4 w-4 animate-spin" />} Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}

const BLANK_FORM = {
  name: "",
  url: "",
  secret: "",
  events: ["post.published", "post.updated", "post.deleted"] as string[],
};

function AddWebhookForm() {
  const queryClient = useQueryClient();
  const create = useServerFn(createWebhook);
  const [form, setForm] = useState(BLANK_FORM);
  const [busy, setBusy] = useState(false);
  const [showSecret, setShowSecret] = useState(false);
  const [open, setOpen] = useState(false);

  function toggleEvent(ev: string) {
    setForm((f) => ({
      ...f,
      events: f.events.includes(ev) ? f.events.filter((e) => e !== ev) : [...f.events, ev],
    }));
  }

  async function handleCreate() {
    if (!form.name.trim()) { toast.error("Enter a name"); return; }
    if (!form.url.trim()) { toast.error("Enter a URL"); return; }
    if (form.events.length === 0) { toast.error("Select at least one event"); return; }
    setBusy(true);
    try {
      await create({ data: { name: form.name.trim(), url: form.url.trim(), secret: form.secret, events: form.events } });
      toast.success("Webhook created");
      setForm(BLANK_FORM);
      setOpen(false);
      await queryClient.invalidateQueries({ queryKey: ["admin", "webhooks"] });
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Failed to create webhook");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="border-t border-border pt-6">
      <button
        type="button"
        className="flex w-full items-center justify-between text-sm font-semibold"
        onClick={() => setOpen((v) => !v)}
      >
        <span className="flex items-center gap-2">
          <Plus className="h-4 w-4" /> Add Webhook
        </span>
        {open ? <ChevronUp className="h-4 w-4 text-muted-foreground" /> : <ChevronDown className="h-4 w-4 text-muted-foreground" />}
      </button>
      <p className="mt-1 text-xs text-muted-foreground">Notify an external URL when content changes.</p>

      {open && (
        <div className="mt-5 space-y-4">
          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-1.5">
              <Label htmlFor="wh-name">Name</Label>
              <Input id="wh-name" value={form.name} onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))} placeholder="My Website" />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="wh-url">URL</Label>
              <Input id="wh-url" type="url" value={form.url} onChange={(e) => setForm((f) => ({ ...f, url: e.target.value }))} placeholder="https://example.com/webhooks" />
            </div>
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="wh-secret">Signing Secret <span className="text-muted-foreground font-normal">(optional)</span></Label>
            <div className="relative">
              <Input
                id="wh-secret"
                type={showSecret ? "text" : "password"}
                value={form.secret}
                onChange={(e) => setForm((f) => ({ ...f, secret: e.target.value }))}
                placeholder="my-secret"
                className="pr-9"
              />
              <button type="button" onClick={() => setShowSecret((v) => !v)} className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground">
                {showSecret ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
              </button>
            </div>
            <p className="text-xs text-muted-foreground">Sent as <code>X-Lunar-Signature: sha256=…</code> on each request.</p>
          </div>

          <div className="space-y-2">
            <Label>Events</Label>
            <div className="grid gap-2 sm:grid-cols-2">
              {WEBHOOK_EVENTS.map((ev) => (
                <div key={ev} className="flex items-center gap-2">
                  <Checkbox id={`ev-${ev}`} checked={form.events.includes(ev)} onCheckedChange={() => toggleEvent(ev)} />
                  <label htmlFor={`ev-${ev}`} className="cursor-pointer text-sm">{EVENT_LABELS[ev] ?? ev}</label>
                </div>
              ))}
            </div>
          </div>

          <Button onClick={handleCreate} disabled={busy}>
            {busy ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Plus className="mr-2 h-4 w-4" />}
            Create Webhook
          </Button>
        </div>
      )}
    </div>
  );
}

function WebhooksPage() {
  const { data: hooks } = useSuspenseQuery(webhooksQuery);

  return (
    <div className="space-y-10 max-w-3xl">
      <div>
        <h1 className="text-2xl font-bold">Webhooks</h1>
        <p className="text-sm text-muted-foreground">Get notified when content is published, updated, or deleted.</p>
      </div>

      {/* Payload format */}
      <div className="space-y-2">
        <h2 className="text-sm font-semibold uppercase tracking-wide text-muted-foreground">Payload Format</h2>
        <pre className="overflow-x-auto rounded border border-border bg-slate-950 p-4 text-xs leading-relaxed text-slate-100">
{`{
  "event": "post.published",
  "timestamp": "2026-07-01T12:00:00.000Z",
  "data": {
    "id": "uuid",
    "slug": "my-post",
    "title": "My Post",
    "status": "published",
    "category": "General",
    "author_name": "Admin"
  }
}`}
        </pre>
        <p className="text-xs text-muted-foreground">
          Verify requests using the <code className="text-xs">X-Lunar-Signature</code> header (HMAC-SHA256 of the raw body).
        </p>
      </div>

      <div className="border-t border-border" />

      {/* Webhooks list */}
      {hooks.length === 0 ? (
        <div className="flex flex-col items-center gap-3 py-16 text-center">
          <Webhook className="h-9 w-9 text-muted-foreground" />
          <p className="text-muted-foreground">No webhooks configured yet.</p>
          <p className="text-sm text-muted-foreground">Add one below to start receiving event notifications.</p>
        </div>
      ) : (
        <div>
          {hooks.map((hook) => (
            <WebhookRow key={hook.id} hook={hook} />
          ))}
        </div>
      )}

      <AddWebhookForm />
    </div>
  );
}
