import { createFileRoute } from "@tanstack/react-router";
import { queryOptions, useSuspenseQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { useState } from "react";
import { toast } from "sonner";
import {
  Key, Plus, Copy, Trash2, Eye, EyeOff, Loader2,
  Globe, Lock, AlertTriangle, Shield,
} from "lucide-react";
import { listApiKeys, revokeApiKey, deleteApiKey, type ApiKey } from "@/lib/apikey.functions";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { cn } from "@/lib/utils";
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter,
} from "@/components/ui/dialog";

const keysQuery = queryOptions({
  queryKey: ["admin", "api_keys"],
  queryFn: () => listApiKeys(),
});

export const Route = createFileRoute("/admin/workspaces/$id/api-keys")({
  loader: ({ context }) => context.queryClient.ensureQueryData(keysQuery),
  component: WorkspaceApiKeys,
  errorComponent: ({ error }) => <p className="p-8 text-sm text-red-600">{error.message}</p>,
});

function fmtDate(d: string) {
  return new Date(d).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" });
}

function KeyTypePill({ type }: { type: "publishable" | "secret" }) {
  return (
    <span className={cn(
      "inline-flex items-center gap-1 rounded-full px-1.5 py-0.5 text-[9px] font-semibold uppercase",
      type === "secret" ? "bg-amber-50 text-amber-700" : "bg-emerald-50 text-emerald-700",
    )}>
      {type === "secret" ? <Lock className="h-2 w-2" /> : <Globe className="h-2 w-2" />}
      {type}
    </span>
  );
}

function WorkspaceApiKeys() {
  const { data: keys } = useSuspenseQuery(keysQuery);
  const queryClient = useQueryClient();
  const doRevoke = useServerFn(revokeApiKey);
  const doDelete = useServerFn(deleteApiKey);

  const [showForm, setShowForm] = useState(false);
  const [name, setName] = useState("");
  const [keyType, setKeyType] = useState<"publishable" | "secret">("publishable");
  const [busy, setBusy] = useState(false);
  const [newKeyDialog, setNewKeyDialog] = useState<{ key: string } | null>(null);
  const [showKey, setShowKey] = useState(false);
  const [pendingDelete, setPendingDelete] = useState<ApiKey | null>(null);
  const [pendingRevoke, setPendingRevoke] = useState<ApiKey | null>(null);
  const [busyId, setBusyId] = useState<string | null>(null);

  async function handleCreate(e: React.FormEvent) {
    e.preventDefault();
    if (!name.trim()) return;
    setBusy(true);
    try {
      const { data, error } = await supabase.functions.invoke("generate-api-key", {
        body: { name: name.trim(), key_type: keyType },
      });
      if (error) throw new Error(error.message);
      if (!data?.success) throw new Error(data?.error?.message ?? "Failed to generate key");
      setName(""); setShowForm(false);
      setNewKeyDialog({ key: data.data.key });
      setShowKey(false);
      await queryClient.invalidateQueries({ queryKey: ["admin", "api_keys"] });
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to create key");
    } finally {
      setBusy(false);
    }
  }

  async function handleRevoke() {
    if (!pendingRevoke) return;
    setBusyId(pendingRevoke.id);
    try {
      await doRevoke({ data: { id: pendingRevoke.id } });
      toast.success("Key revoked");
      setPendingRevoke(null);
      await queryClient.invalidateQueries({ queryKey: ["admin", "api_keys"] });
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed");
    } finally {
      setBusyId(null);
    }
  }

  async function handleDelete() {
    if (!pendingDelete) return;
    setBusyId(pendingDelete.id);
    try {
      await doDelete({ data: { id: pendingDelete.id } });
      toast.success("Key deleted");
      setPendingDelete(null);
      await queryClient.invalidateQueries({ queryKey: ["admin", "api_keys"] });
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed");
    } finally {
      setBusyId(null);
    }
  }

  const active = keys.filter((k) => k.status === "active" && !k.revoked_at);
  const inactive = keys.filter((k) => k.status !== "active" || k.revoked_at);

  return (
    <div className="min-h-full px-8 py-8 max-w-4xl">
      <div className="mb-8 flex items-center justify-between">
        <div>
          <h1 className="text-xl font-semibold">API Keys</h1>
          <p className="mt-0.5 text-sm text-muted-foreground">Manage access tokens for the Content API.</p>
        </div>
        <Button
          onClick={() => setShowForm((v) => !v)}
          size="sm"
        >
          <Plus className="mr-1.5 h-3.5 w-3.5" /> New Key
        </Button>
      </div>

      {/* Create form */}
      {showForm && (
        <form onSubmit={handleCreate} className="mb-8 rounded-lg border border-border p-5 space-y-4">
          <h2 className="text-sm font-medium flex items-center gap-2">
            <Key className="h-4 w-4 text-muted-foreground" /> New API Key
          </h2>

          {/* Key type selector */}
          <div className="grid grid-cols-2 gap-3">
            {(["publishable", "secret"] as const).map((type) => (
              <button
                key={type}
                type="button"
                onClick={() => setKeyType(type)}
                className={cn(
                  "flex items-start gap-2.5 rounded-lg border p-3 text-left transition-colors",
                  keyType === type
                    ? "border-primary bg-primary/5"
                    : "border-border hover:border-muted-foreground/30",
                )}
              >
                {type === "publishable"
                  ? <Globe className={cn("h-4 w-4 mt-0.5 shrink-0", keyType === type ? "text-primary" : "text-muted-foreground")} />
                  : <Shield className={cn("h-4 w-4 mt-0.5 shrink-0", keyType === type ? "text-primary" : "text-muted-foreground")} />
                }
                <div>
                  <p className="text-xs font-semibold capitalize">{type}</p>
                  <p className="text-[10px] text-muted-foreground mt-0.5">
                    {type === "publishable" ? "Read-only • client-safe • pk_live_" : "Full access • server only • sk_live_"}
                  </p>
                </div>
              </button>
            ))}
          </div>

          <div>
            <Label htmlFor="ws-key-name" className="text-xs">Name</Label>
            <Input
              id="ws-key-name"
              placeholder="e.g. Production, Next.js App"
              value={name}
              onChange={(e) => setName(e.target.value)}
              required
              autoFocus
              className="mt-1 w-full max-w-sm"
            />
          </div>

          <div className="flex gap-2">
            <Button type="submit" size="sm" disabled={busy || !name.trim()}>
              {busy && <Loader2 className="mr-2 h-3.5 w-3.5 animate-spin" />}
              Generate
            </Button>
            <Button type="button" variant="ghost" size="sm" onClick={() => setShowForm(false)}>
              Cancel
            </Button>
          </div>
        </form>
      )}

      {/* Keys list */}
      {active.length === 0 && inactive.length === 0 ? (
        <div className="flex flex-col items-center gap-3 py-20 border-y border-border text-center">
          <Key className="h-8 w-8 text-muted-foreground/30" />
          <p className="text-sm text-muted-foreground">No API keys yet. Create one above.</p>
        </div>
      ) : (
        <div className="space-y-6">
          {/* Active */}
          {active.length > 0 && (
            <div>
              <p className="mb-2 text-[10px] font-bold uppercase tracking-widest text-muted-foreground/60">
                Active — {active.length}
              </p>
              <div className="divide-y divide-border rounded-lg border border-border overflow-hidden">
                {active.map((key) => (
                  <KeyRow key={key.id} apiKey={key} busyId={busyId} onRevoke={setPendingRevoke} onDelete={setPendingDelete} />
                ))}
              </div>
            </div>
          )}

          {/* Inactive */}
          {inactive.length > 0 && (
            <div className="opacity-60">
              <p className="mb-2 text-[10px] font-bold uppercase tracking-widest text-muted-foreground/60">
                Revoked — {inactive.length}
              </p>
              <div className="divide-y divide-border rounded-lg border border-border overflow-hidden">
                {inactive.map((key) => (
                  <KeyRow key={key.id} apiKey={key} busyId={busyId} onRevoke={setPendingRevoke} onDelete={setPendingDelete} />
                ))}
              </div>
            </div>
          )}
        </div>
      )}

      {/* New key reveal dialog */}
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
                Copy this key now — it <strong>will never be shown again</strong>. Only a hash is stored.
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
              <Button
                variant="outline"
                onClick={() => {
                  navigator.clipboard.writeText(newKeyDialog?.key ?? "");
                  toast.success("Copied to clipboard");
                }}
              >
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
      <AlertDialog open={!!pendingRevoke} onOpenChange={(o) => !o && setPendingRevoke(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Revoke "{pendingRevoke?.name}"?</AlertDialogTitle>
            <AlertDialogDescription>
              Any apps using this key will immediately lose access. This cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleRevoke}
              disabled={busyId !== null}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              Revoke
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Delete confirm */}
      <AlertDialog open={!!pendingDelete} onOpenChange={(o) => !o && setPendingDelete(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete "{pendingDelete?.name}"?</AlertDialogTitle>
            <AlertDialogDescription>
              This permanently removes the key record. Any app using it will lose access immediately.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleDelete}
              disabled={busyId !== null}
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

function KeyRow({
  apiKey, busyId, onRevoke, onDelete,
}: {
  apiKey: ApiKey;
  busyId: string | null;
  onRevoke: (k: ApiKey) => void;
  onDelete: (k: ApiKey) => void;
}) {
  return (
    <div className="group flex items-center gap-3 bg-background px-4 py-3">
      <div className="flex-1 min-w-0">
        <p className="text-sm font-medium">{apiKey.name}</p>
        {apiKey.description && (
          <p className="text-xs text-muted-foreground mt-0.5 line-clamp-1">{apiKey.description}</p>
        )}
      </div>
      <code className="text-xs font-mono text-muted-foreground hidden sm:block">
        {apiKey.key_prefix}…
      </code>
      <KeyTypePill type={apiKey.key_type} />
      <span className="text-xs text-muted-foreground hidden md:block whitespace-nowrap">
        {fmtDate(apiKey.created_at)}
      </span>
      <span className="text-xs text-muted-foreground hidden md:block whitespace-nowrap">
        {apiKey.last_used_at ? fmtDate(apiKey.last_used_at) : "Never used"}
      </span>
      <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity shrink-0">
        {apiKey.status === "active" && !apiKey.revoked_at && (
          <button
            type="button"
            onClick={() => onRevoke(apiKey)}
            disabled={busyId === apiKey.id}
            className="flex h-7 w-7 items-center justify-center rounded text-muted-foreground hover:text-amber-600 hover:bg-amber-50 transition-colors"
            title="Revoke"
          >
            <EyeOff className="h-3.5 w-3.5" />
          </button>
        )}
        <button
          type="button"
          onClick={() => onDelete(apiKey)}
          disabled={busyId === apiKey.id}
          className="flex h-7 w-7 items-center justify-center rounded text-muted-foreground hover:text-red-600 hover:bg-red-50 transition-colors"
          title="Delete"
        >
          <Trash2 className="h-3.5 w-3.5" />
        </button>
      </div>
    </div>
  );
}
