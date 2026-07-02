import { createFileRoute } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { queryOptions, useSuspenseQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { toast } from "sonner";
import {
  Plus, Trash2, Copy, Key, AlertTriangle, Loader2,
  Eye, EyeOff, Shield, Globe, ChevronDown, ChevronUp,
  Terminal, Lock, Link2, Check,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Textarea } from "@/components/ui/textarea";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter,
} from "@/components/ui/dialog";
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from "@/components/ui/table";
import { supabase } from "@/integrations/supabase/client";
import {
  listApiKeys, revokeApiKey, deleteApiKey, type ApiKey,
} from "@/lib/apikey.functions";
import { formatBlogDate } from "@/lib/blog-types";
import { cn } from "@/lib/utils";

const keysQuery = queryOptions({
  queryKey: ["admin", "api_keys"],
  queryFn: () => listApiKeys(),
});

export const Route = createFileRoute("/admin/api-keys")({
  head: () => ({ meta: [{ title: "API Keys — Admin" }] }),
  loader: ({ context }) => context.queryClient.ensureQueryData(keysQuery),
  component: ApiKeysPage,
  errorComponent: ({ error }) => (
    <p className="text-sm text-destructive">Failed to load API keys: {error.message}</p>
  ),
});

// ── helpers ───────────────────────────────────────────────────────────────────

function KeyTypeBadge({ type }: { type: "publishable" | "secret" }) {
  return (
    <span className={cn(
      "inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide",
      type === "secret"
        ? "bg-amber-50 text-amber-700"
        : "bg-emerald-50 text-emerald-700",
    )}>
      {type === "secret" ? <Lock className="h-2.5 w-2.5" /> : <Globe className="h-2.5 w-2.5" />}
      {type}
    </span>
  );
}

function StatusBadge({ status }: { status: ApiKey["status"] }) {
  if (status === "active") {
    return (
      <span className="inline-flex h-1.5 w-1.5 rounded-full bg-emerald-500" title="Active" />
    );
  }
  return (
    <Badge variant="outline" className="text-[10px] py-0 h-4 text-muted-foreground">
      {status}
    </Badge>
  );
}

const SCOPE_LABELS: Record<string, string> = {
  "read:blogs": "Blogs",
  "read:pages": "Pages",
  "read:media": "Media",
  "read:collections": "Collections",
  "write:blogs": "Write Blogs",
  "write:pages": "Write Pages",
  "write:media": "Write Media",
  "write:collections": "Write Collections",
  "manage:api_keys": "Manage Keys",
};

function PermissionChips({ permissions }: { permissions: string[] }) {
  const reads = permissions.filter((p) => p.startsWith("read:"));
  const writes = permissions.filter((p) => p.startsWith("write:") || p.startsWith("manage:"));
  return (
    <div className="flex flex-wrap gap-1">
      {reads.map((p) => (
        <span key={p} className="rounded bg-sky-50 px-1.5 py-0.5 text-[9px] font-medium text-sky-700">
          {SCOPE_LABELS[p] ?? p}
        </span>
      ))}
      {writes.map((p) => (
        <span key={p} className="rounded bg-violet-50 px-1.5 py-0.5 text-[9px] font-medium text-violet-700">
          {SCOPE_LABELS[p] ?? p}
        </span>
      ))}
    </div>
  );
}

// ── API Base URL ──────────────────────────────────────────────────────────────

const SUPABASE_URL =
  (typeof import.meta !== "undefined" && (import.meta as Record<string, unknown>).env
    ? (import.meta as { env: Record<string, string> }).env.VITE_SUPABASE_URL
    : "") ?? "";

const CONTENT_ROUTER_URL = SUPABASE_URL
  ? `${SUPABASE_URL}/functions/v1/content-router`
  : "";

function CopyableUrl({ label, url, note }: { label: string; url: string; note: string }) {
  const [copied, setCopied] = useState(false);

  function handleCopy() {
    if (!url) return;
    navigator.clipboard.writeText(url).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    });
  }

  return (
    <div className="space-y-1.5">
      <div className="flex items-center gap-2">
        <p className="text-xs font-semibold text-foreground">{label}</p>
        <span className="text-[10px] text-muted-foreground">{note}</span>
      </div>
      <div className="flex items-center gap-2">
        <div className="flex flex-1 items-center gap-2 rounded-lg border border-border bg-muted/40 px-3 py-2 min-w-0">
          <Link2 className="h-3.5 w-3.5 shrink-0 text-muted-foreground" />
          {url ? (
            <code className="truncate text-xs font-mono text-foreground">{url}</code>
          ) : (
            <span className="text-xs text-muted-foreground italic">Supabase URL not configured</span>
          )}
        </div>
        <Button
          size="sm"
          variant="outline"
          className="shrink-0 h-9 gap-1.5"
          onClick={handleCopy}
          disabled={!url}
        >
          {copied ? (
            <><Check className="h-3.5 w-3.5 text-emerald-600" /> Copied</>
          ) : (
            <><Copy className="h-3.5 w-3.5" /> Copy</>
          )}
        </Button>
      </div>
    </div>
  );
}

function ApiBaseUrl() {
  return (
    <div className="rounded-lg border border-border bg-background p-5 space-y-4">
      <div className="flex items-center gap-2">
        <Link2 className="h-4 w-4 text-muted-foreground" />
        <h2 className="text-sm font-semibold">Base API URL</h2>
        <span className="ml-auto rounded-full bg-emerald-50 px-2 py-0.5 text-[10px] font-semibold text-emerald-700 uppercase tracking-wide">
          Live
        </span>
      </div>

      <p className="text-xs text-muted-foreground">
        Use this URL as the base for all API requests. Append the resource path after it and pass your API key
        as a <code className="rounded bg-muted px-1 text-[11px] font-mono">Bearer</code> token.
      </p>

      <CopyableUrl
        label="Content Router"
        url={CONTENT_ROUTER_URL}
        note="— Recommended · full endpoint set"
      />

      <div className="rounded-lg bg-muted/50 p-3 space-y-1.5">
        <p className="text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">Quick example</p>
        <pre className="overflow-x-auto text-[11px] font-mono text-foreground leading-relaxed whitespace-pre-wrap break-all">{CONTENT_ROUTER_URL
          ? `fetch("${CONTENT_ROUTER_URL}/blogs", {\n  headers: { Authorization: "Bearer YOUR_API_KEY" }\n})`
          : `fetch("<BASE_URL>/blogs", {\n  headers: { Authorization: "Bearer YOUR_API_KEY" }\n})`
        }</pre>
      </div>
    </div>
  );
}

// ── Gateway reference ─────────────────────────────────────────────────────────

const ENDPOINTS = [
  { method: "GET", path: "/blogs",                   desc: "List published posts. Params: page, limit, search, category, tag, featured, sort, order" },
  { method: "GET", path: "/blogs/featured",           desc: "Featured published posts. Params: limit (max 50)" },
  { method: "GET", path: "/blogs/latest",             desc: "Most recent posts. Params: limit (max 50)" },
  { method: "GET", path: "/blogs/:slug",              desc: "Single post by slug — includes full content" },
  { method: "GET", path: "/blogs/:slug/related",      desc: "Related posts by category + tags. Params: limit" },
  { method: "GET", path: "/pages",                    desc: "List published pages. Params: page, limit" },
  { method: "GET", path: "/pages/:slug",              desc: "Single page by slug" },
  { method: "GET", path: "/categories",               desc: "All categories with post counts. Params: sort (name|post_count)" },
  { method: "GET", path: "/tags",                     desc: "All tags with post counts" },
  { method: "GET", path: "/media",                    desc: "List media files. Params: page, limit, folder, mime_type" },
  { method: "GET", path: "/collections",              desc: "List all collections" },
  { method: "GET", path: "/collections/:slug",        desc: "Published entries in a collection" },
  { method: "GET", path: "/search?q=",                desc: "Search across blogs, pages, categories. Params: q (required), page, limit" },
];

function GatewayReference() {
  const [open, setOpen] = useState(false);
  const baseUrl = CONTENT_ROUTER_URL || "<BASE_URL>";

  return (
    <section>
      <button
        onClick={() => setOpen((v) => !v)}
        className="flex w-full items-center justify-between border-y border-border py-4 text-left"
      >
        <div className="flex items-center gap-2">
          <Terminal className="h-4 w-4 text-muted-foreground" />
          <span className="text-sm font-medium">API Endpoint Reference</span>
        </div>
        {open ? (
          <ChevronUp className="h-4 w-4 text-muted-foreground" />
        ) : (
          <ChevronDown className="h-4 w-4 text-muted-foreground" />
        )}
      </button>

      {open && (
        <div className="space-y-6 py-5">
          <p className="text-sm text-muted-foreground">
            All endpoints are served by the <code className="rounded bg-muted px-1 py-0.5 text-xs">content-router</code> Edge
            Function. Use your API key as a Bearer token — the key automatically resolves your workspace.
            Callers never need to send workspace or tenant IDs.
          </p>

          <div className="space-y-0 divide-y divide-border rounded-lg border border-border overflow-hidden">
            {ENDPOINTS.map((ep) => (
              <div key={ep.path} className="flex items-start gap-3 px-4 py-3 bg-background">
                <span className="mt-0.5 shrink-0 rounded bg-primary px-1.5 py-0.5 text-[10px] font-bold text-primary-foreground">
                  {ep.method}
                </span>
                <div className="min-w-0 flex-1">
                  <code className="break-all text-xs font-mono text-foreground">{ep.path}</code>
                  <p className="mt-0.5 text-xs text-muted-foreground">{ep.desc}</p>
                </div>
              </div>
            ))}
          </div>

          <div>
            <p className="mb-2 text-xs font-medium text-muted-foreground uppercase tracking-wide">Example — fetch all posts</p>
            <pre className="overflow-x-auto rounded-lg border border-border bg-slate-950 px-4 py-4 text-xs font-mono text-slate-100 leading-relaxed">{`const response = await fetch(
  "${baseUrl}/blogs",
  { headers: { Authorization: \`Bearer \${process.env.LUNAR_API_KEY}\` } }
);

const { data, meta, links } = await response.json();
// data  = array of posts
// meta  = { page, limit, total, totalPages }
// links = { first, previous, next, last }`}</pre>
          </div>

          <div>
            <p className="mb-2 text-xs font-medium text-muted-foreground uppercase tracking-wide">Response format</p>
            <pre className="overflow-x-auto rounded-lg border border-border bg-slate-950 px-4 py-4 text-xs font-mono text-slate-100 leading-relaxed">{`// Success
{
  "success": true,
  "data": [...],
  "meta": { "page": 1, "limit": 20, "total": 42, "totalPages": 3 },
  "links": { "first": "...", "previous": null, "next": "...", "last": "..." }
}

// Error
{ "success": false, "error": { "code": "INVALID_API_KEY", "message": "..." } }`}</pre>
          </div>

          <div className="grid gap-3 sm:grid-cols-2">
            <div className="rounded-lg border border-border p-4">
              <div className="flex items-center gap-2 mb-2">
                <Globe className="h-3.5 w-3.5 text-emerald-600" />
                <p className="text-xs font-semibold text-emerald-700">Publishable Key</p>
              </div>
              <p className="text-xs text-muted-foreground">
                Safe for client-side use (browser, mobile). Grants read-only access to published content.
                Prefix: <code className="font-mono text-[10px]">pk_live_</code>
              </p>
            </div>
            <div className="rounded-lg border border-border p-4">
              <div className="flex items-center gap-2 mb-2">
                <Lock className="h-3.5 w-3.5 text-amber-600" />
                <p className="text-xs font-semibold text-amber-700">Secret Key</p>
              </div>
              <p className="text-xs text-muted-foreground">
                Server-side only. Never expose in client code. Grants full read + write access.
                Prefix: <code className="font-mono text-[10px]">sk_live_</code>
              </p>
            </div>
          </div>
        </div>
      )}
    </section>
  );
}

// ── Create form ───────────────────────────────────────────────────────────────

function CreateKeyForm({ onCreated }: { onCreated: (key: string) => void }) {
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [keyType, setKeyType] = useState<"publishable" | "secret">("publishable");
  const [creating, setCreating] = useState(false);

  async function handleCreate() {
    if (!name.trim()) { toast.error("Enter a name for the key"); return; }
    setCreating(true);
    try {
      const { data, error } = await supabase.functions.invoke("generate-api-key", {
        body: {
          name: name.trim(),
          description: description.trim() || undefined,
          key_type: keyType,
        },
      });
      if (error) throw new Error(error.message);
      if (!data?.success) throw new Error(data?.error?.message ?? "Failed to generate key");
      setName(""); setDescription("");
      onCreated(data.data.key);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Failed to create key");
    } finally {
      setCreating(false);
    }
  }

  return (
    <div className="space-y-4 rounded-lg border border-border p-5">
      <div className="flex items-center gap-2">
        <Key className="h-4 w-4 text-muted-foreground" />
        <h2 className="text-sm font-semibold">Generate New Key</h2>
      </div>

      <p className="text-xs text-muted-foreground">
        Keys are generated using CSPRNG inside a Supabase Edge Function. Only a SHA-256 hash is stored — the raw key is shown once.
      </p>

      {/* Key type */}
      <div className="grid grid-cols-2 gap-3">
        {(["publishable", "secret"] as const).map((type) => (
          <button
            key={type}
            type="button"
            onClick={() => setKeyType(type)}
            className={cn(
              "flex items-start gap-3 rounded-lg border p-3 text-left transition-colors",
              keyType === type
                ? "border-primary bg-primary/5"
                : "border-border hover:border-muted-foreground/30 hover:bg-muted/30",
            )}
          >
            {type === "publishable"
              ? <Globe className={cn("h-4 w-4 mt-0.5 shrink-0", keyType === type ? "text-primary" : "text-muted-foreground")} />
              : <Shield className={cn("h-4 w-4 mt-0.5 shrink-0", keyType === type ? "text-primary" : "text-muted-foreground")} />
            }
            <div>
              <p className="text-xs font-semibold capitalize">{type}</p>
              <p className="text-[10px] text-muted-foreground leading-tight mt-0.5">
                {type === "publishable" ? "Read-only • client-safe • pk_live_" : "Full access • server only • sk_live_"}
              </p>
            </div>
            {keyType === type && (
              <span className="ml-auto h-2 w-2 mt-1 rounded-full bg-primary shrink-0" />
            )}
          </button>
        ))}
      </div>

      {/* Name + description */}
      <div className="space-y-3">
        <div>
          <Label htmlFor="key-name" className="text-xs">Name <span className="text-destructive">*</span></Label>
          <Input
            id="key-name"
            value={name}
            onChange={(e) => setName(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && handleCreate()}
            placeholder="e.g. My Website, Marketing App"
            className="mt-1"
          />
        </div>
        <div>
          <Label htmlFor="key-desc" className="text-xs text-muted-foreground">Description (optional)</Label>
          <Textarea
            id="key-desc"
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            placeholder="What is this key used for?"
            rows={2}
            className="mt-1 resize-none text-sm"
          />
        </div>
      </div>

      <Button onClick={handleCreate} disabled={creating} className="w-full sm:w-auto">
        {creating ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Plus className="mr-2 h-4 w-4" />}
        Generate Key
      </Button>
    </div>
  );
}

// ── Key table ─────────────────────────────────────────────────────────────────

function KeyTable({
  keys,
  onRevoke,
  onDelete,
  busyId,
}: {
  keys: ApiKey[];
  onRevoke: (k: ApiKey) => void;
  onDelete: (k: ApiKey) => void;
  busyId: string | null;
}) {
  if (keys.length === 0) return null;

  return (
    <div className="overflow-x-auto rounded-lg border border-border">
      <Table>
        <TableHeader>
          <TableRow className="hover:bg-transparent">
            <TableHead className="w-6"></TableHead>
            <TableHead>Name</TableHead>
            <TableHead>Prefix</TableHead>
            <TableHead>Type</TableHead>
            <TableHead>Permissions</TableHead>
            <TableHead>Created</TableHead>
            <TableHead>Last Used</TableHead>
            <TableHead className="text-right">Actions</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {keys.map((key) => (
            <TableRow key={key.id} className={key.status !== "active" ? "opacity-50" : ""}>
              <TableCell className="pl-4 pr-0">
                <StatusBadge status={key.status} />
              </TableCell>
              <TableCell>
                <p className="font-medium text-sm">{key.name}</p>
                {key.description && (
                  <p className="text-xs text-muted-foreground mt-0.5 line-clamp-1">{key.description}</p>
                )}
              </TableCell>
              <TableCell>
                <code className="rounded bg-muted px-1.5 py-0.5 text-xs">{key.key_prefix}…</code>
              </TableCell>
              <TableCell>
                <KeyTypeBadge type={key.key_type} />
              </TableCell>
              <TableCell>
                <PermissionChips permissions={key.permissions} />
              </TableCell>
              <TableCell className="text-muted-foreground text-xs whitespace-nowrap">
                {formatBlogDate(key.created_at)}
              </TableCell>
              <TableCell className="text-muted-foreground text-xs whitespace-nowrap">
                {key.last_used_at ? formatBlogDate(key.last_used_at) : "Never"}
              </TableCell>
              <TableCell>
                <div className="flex items-center justify-end gap-1">
                  {key.status === "active" && (
                    <Button
                      size="sm"
                      variant="ghost"
                      className="h-7 text-xs"
                      onClick={() => onRevoke(key)}
                      disabled={busyId === key.id}
                    >
                      <AlertTriangle className="mr-1 h-3 w-3" />
                      Revoke
                    </Button>
                  )}
                  <Button
                    size="icon"
                    variant="ghost"
                    className="h-7 w-7 text-destructive hover:text-destructive"
                    onClick={() => onDelete(key)}
                    disabled={busyId === key.id}
                  >
                    <Trash2 className="h-3.5 w-3.5" />
                  </Button>
                </div>
              </TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </div>
  );
}

// ── Page ──────────────────────────────────────────────────────────────────────

function ApiKeysPage() {
  const { data: keys } = useSuspenseQuery(keysQuery);
  const queryClient = useQueryClient();
  const revoke = useServerFn(revokeApiKey);
  const del = useServerFn(deleteApiKey);

  const [newKeyDialog, setNewKeyDialog] = useState<{ key: string } | null>(null);
  const [showKey, setShowKey] = useState(false);
  const [pendingRevoke, setPendingRevoke] = useState<ApiKey | null>(null);
  const [pendingDelete, setPendingDelete] = useState<ApiKey | null>(null);
  const [busyId, setBusyId] = useState<string | null>(null);

  async function refresh() {
    await queryClient.invalidateQueries({ queryKey: ["admin", "api_keys"] });
  }

  function handleCreated(key: string) {
    setNewKeyDialog({ key });
    setShowKey(false);
    refresh();
  }

  async function handleRevoke() {
    if (!pendingRevoke) return;
    setBusyId(pendingRevoke.id);
    try {
      await revoke({ data: { id: pendingRevoke.id } });
      toast.success("Key revoked — it can no longer be used to authenticate");
      setPendingRevoke(null);
      await refresh();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Failed to revoke key");
    } finally {
      setBusyId(null);
    }
  }

  async function handleDelete() {
    if (!pendingDelete) return;
    setBusyId(pendingDelete.id);
    try {
      await del({ data: { id: pendingDelete.id } });
      toast.success("Key deleted");
      setPendingDelete(null);
      await refresh();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Failed to delete key");
    } finally {
      setBusyId(null);
    }
  }

  function copyKey(key: string) {
    navigator.clipboard.writeText(key).then(() => toast.success("Key copied to clipboard"));
  }

  const active = keys.filter((k) => k.status === "active" && !k.revoked_at);
  const inactive = keys.filter((k) => k.status !== "active" || k.revoked_at);

  return (
    <div className="mx-auto max-w-5xl space-y-8 px-6 py-8">
      {/* Header */}
      <div>
        <h1 className="text-xl font-semibold">API Keys</h1>
        <p className="mt-0.5 text-sm text-muted-foreground">
          Generate keys to access your content from any external application. Keys are stored as SHA-256 hashes and never logged in plain text.
        </p>
      </div>

      {/* Stats strip */}
      <div className="flex divide-x divide-border border border-border rounded-lg overflow-hidden">
        {[
          { label: "Active Keys",    value: active.length,   green: active.length > 0  },
          { label: "Total Generated", value: keys.length,                               },
          { label: "Revoked",         value: inactive.length, red: inactive.length > 0  },
        ].map(({ label, value, green, red }) => (
          <div key={label} className="flex-1 px-5 py-4">
            <p className={cn(
              "text-2xl font-bold tabular-nums",
              green && "text-emerald-600",
              red && "text-destructive",
            )}>
              {value}
            </p>
            <p className="text-[10px] uppercase tracking-wide text-muted-foreground mt-0.5">{label}</p>
          </div>
        ))}
      </div>

      {/* Base API URL */}
      <ApiBaseUrl />

      {/* Gateway reference (collapsible) */}
      <GatewayReference />

      {/* Create form */}
      <CreateKeyForm onCreated={handleCreated} />

      {/* Active keys */}
      <section className="space-y-3">
        <div className="flex items-center gap-2 border-b border-border pb-3">
          <h2 className="text-[11px] font-bold uppercase tracking-widest text-muted-foreground">
            Active Keys
          </h2>
          {active.length > 0 && (
            <Badge variant="secondary" className="h-4 text-[10px] px-1.5">{active.length}</Badge>
          )}
        </div>
        {active.length === 0 ? (
          <div className="flex flex-col items-center gap-3 py-12 text-center">
            <Key className="h-8 w-8 text-muted-foreground/40" />
            <p className="text-sm text-muted-foreground">No active API keys yet. Generate one above.</p>
          </div>
        ) : (
          <KeyTable keys={active} onRevoke={setPendingRevoke} onDelete={setPendingDelete} busyId={busyId} />
        )}
      </section>

      {/* Revoked / expired */}
      {inactive.length > 0 && (
        <section className="space-y-3">
          <div className="flex items-center gap-2 border-b border-border pb-3">
            <h2 className="text-[11px] font-bold uppercase tracking-widest text-muted-foreground">
              Revoked / Expired
            </h2>
            <Badge variant="outline" className="h-4 text-[10px] px-1.5">{inactive.length}</Badge>
          </div>
          <KeyTable keys={inactive} onRevoke={setPendingRevoke} onDelete={setPendingDelete} busyId={busyId} />
        </section>
      )}

      {/* ── Dialogs ── */}

      {/* New key reveal */}
      <Dialog open={Boolean(newKeyDialog)} onOpenChange={(o) => { if (!o) setNewKeyDialog(null); }}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Key className="h-4 w-4" /> API Key Generated
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div className="flex items-start gap-2 rounded-lg border border-amber-200 bg-amber-50 p-3">
              <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0 text-amber-600" />
              <p className="text-xs text-amber-800">
                Copy this key now — it <strong>will never be shown again</strong>. If lost, generate a new one and revoke this.
              </p>
            </div>
            <div className="flex gap-2">
              <div className="relative flex-1">
                <Input
                  readOnly
                  value={showKey ? (newKeyDialog?.key ?? "") : "•".repeat(52)}
                  className="font-mono text-xs pr-10"
                />
                <button
                  type="button"
                  onClick={() => setShowKey((v) => !v)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
                >
                  {showKey ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                </button>
              </div>
              <Button variant="outline" onClick={() => copyKey(newKeyDialog?.key ?? "")}>
                <Copy className="mr-2 h-4 w-4" /> Copy
              </Button>
            </div>
          </div>
          <DialogFooter>
            <Button onClick={() => setNewKeyDialog(null)}>Done</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Revoke confirm */}
      <AlertDialog open={Boolean(pendingRevoke)} onOpenChange={(o) => !o && setPendingRevoke(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Revoke "{pendingRevoke?.name}"?</AlertDialogTitle>
            <AlertDialogDescription>
              Any application using this key will immediately lose access. This cannot be undone — generate a new key if needed.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleRevoke}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              Revoke Key
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Delete confirm */}
      <AlertDialog open={Boolean(pendingDelete)} onOpenChange={(o) => !o && setPendingDelete(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete "{pendingDelete?.name}"?</AlertDialogTitle>
            <AlertDialogDescription>
              This permanently removes the key record from the database. This cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleDelete}
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
