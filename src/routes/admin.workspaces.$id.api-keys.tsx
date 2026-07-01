import { createFileRoute } from "@tanstack/react-router";
import { queryOptions, useSuspenseQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { useState } from "react";
import { toast } from "sonner";
import { Key, Plus, Copy, Trash2, Eye, EyeOff, Loader2 } from "lucide-react";
import { listApiKeys, revokeApiKey, deleteApiKey, type ApiKey } from "@/lib/apikey.functions";
import { createServerFn } from "@tanstack/react-start";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
} from "@/components/ui/alert-dialog";

const createApiKey = createServerFn({ method: "POST" })
  .validator((input: { name: string }) => input)
  .handler(async ({ data }) => {
    const { getAdminClient } = await import("@/lib/supabase.server");
    const db = getAdminClient() as any;
    const prefix = "lck_" + Math.random().toString(36).slice(2, 10);
    const raw = prefix + "_" + Array.from({ length: 32 }, () => Math.random().toString(36)[2]).join("");
    const { data: row, error } = await db.from("api_keys").insert({
      name: data.name,
      key_prefix: prefix,
      key_hash: raw,
    }).select().single();
    if (error) throw new Error(error.message);
    return { ...row, raw };
  });

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

function WorkspaceApiKeys() {
  const { data: keys } = useSuspenseQuery(keysQuery);
  const queryClient = useQueryClient();
  const doRevoke = useServerFn(revokeApiKey);
  const doDelete = useServerFn(deleteApiKey);
  const doCreate = useServerFn(createApiKey);

  const [showForm, setShowForm] = useState(false);
  const [name, setName] = useState("");
  const [busy, setBusy] = useState(false);
  const [newKey, setNewKey] = useState<string | null>(null);
  const [showKey, setShowKey] = useState(false);
  const [pendingDelete, setPendingDelete] = useState<ApiKey | null>(null);

  async function handleCreate(e: React.FormEvent) {
    e.preventDefault();
    if (!name.trim()) return;
    setBusy(true);
    try {
      const result = await doCreate({ data: { name: name.trim() } });
      setNewKey(result.raw);
      setName(""); setShowForm(false);
      toast.success("API key created — save it now, it won't be shown again");
      await queryClient.invalidateQueries({ queryKey: ["admin", "api_keys"] });
    } catch (err) { toast.error(err instanceof Error ? err.message : "Failed"); }
    finally { setBusy(false); }
  }

  async function handleRevoke(id: string) {
    try {
      await doRevoke({ data: { id } });
      toast.success("Key revoked");
      await queryClient.invalidateQueries({ queryKey: ["admin", "api_keys"] });
    } catch (err) { toast.error(err instanceof Error ? err.message : "Failed"); }
  }

  async function handleDelete() {
    if (!pendingDelete) return;
    setBusy(true);
    try {
      await doDelete({ data: { id: pendingDelete.id } });
      toast.success("Key deleted");
      setPendingDelete(null);
      await queryClient.invalidateQueries({ queryKey: ["admin", "api_keys"] });
    } catch (err) { toast.error(err instanceof Error ? err.message : "Failed"); }
    finally { setBusy(false); }
  }

  return (
    <div className="min-h-full px-8 py-8">
      <div className="mb-8 flex items-center justify-between">
        <div>
          <h1 className="text-xl font-semibold">API Keys</h1>
          <p className="mt-0.5 text-sm text-muted-foreground">Manage access tokens for the Content API.</p>
        </div>
        <button
          type="button"
          onClick={() => setShowForm((v) => !v)}
          className="flex items-center gap-1.5 rounded-md bg-primary px-3 py-1.5 text-sm font-medium text-primary-foreground hover:bg-primary/90 transition-colors"
        >
          <Plus className="h-3.5 w-3.5" /> New Key
        </button>
      </div>

      {/* New key form */}
      {showForm && (
        <form onSubmit={handleCreate} className="mb-8 border-b border-border pb-8 space-y-3">
          <h2 className="text-sm font-medium">Create API key</h2>
          <div className="flex gap-3">
            <Input
              placeholder="Key name (e.g. Production)"
              value={name}
              onChange={(e) => setName(e.target.value)}
              required
              autoFocus
              className="w-64"
            />
            <Button type="submit" size="sm" disabled={busy || !name.trim()}>
              {busy ? <Loader2 className="mr-2 h-3.5 w-3.5 animate-spin" /> : null}
              Create
            </Button>
            <Button type="button" variant="ghost" size="sm" onClick={() => setShowForm(false)}>Cancel</Button>
          </div>
        </form>
      )}

      {/* Newly created key */}
      {newKey && (
        <div className="mb-8 border-b border-border pb-6">
          <p className="mb-2 text-sm font-medium text-emerald-600">
            ✓ Key created — copy it now, it won't be shown again
          </p>
          <div className="flex items-center gap-2">
            <code className="flex-1 rounded border border-border bg-muted px-3 py-2 font-mono text-xs text-foreground overflow-x-auto">
              {showKey ? newKey : newKey.replace(/./g, "•")}
            </code>
            <button
              type="button"
              onClick={() => setShowKey((v) => !v)}
              className="flex h-8 w-8 items-center justify-center rounded border border-border text-muted-foreground hover:text-foreground"
            >
              {showKey ? <EyeOff className="h-3.5 w-3.5" /> : <Eye className="h-3.5 w-3.5" />}
            </button>
            <button
              type="button"
              onClick={() => { navigator.clipboard.writeText(newKey); toast.success("Copied"); }}
              className="flex h-8 w-8 items-center justify-center rounded border border-border text-muted-foreground hover:text-foreground"
            >
              <Copy className="h-3.5 w-3.5" />
            </button>
          </div>
        </div>
      )}

      {/* Keys list */}
      {keys.length === 0 ? (
        <div className="flex flex-col items-center gap-3 py-20 border-y border-border text-center">
          <Key className="h-8 w-8 text-muted-foreground/30" />
          <p className="text-sm text-muted-foreground">No API keys yet.</p>
        </div>
      ) : (
        <div>
          <div className="flex items-center gap-3 border-b border-border pb-2 text-[10px] font-semibold uppercase tracking-widest text-muted-foreground/60">
            <span className="flex-1">Name</span>
            <span className="w-32 hidden sm:block">Prefix</span>
            <span className="w-28 hidden md:block">Created</span>
            <span className="w-16 hidden md:block">Status</span>
            <span className="w-20 shrink-0 text-right">Actions</span>
          </div>

          {keys.map((key: ApiKey) => (
            <div key={key.id} className="group flex items-center gap-3 border-b border-border py-3.5 last:border-0">
              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium">{key.name}</p>
              </div>
              <code className="w-32 text-xs font-mono text-muted-foreground hidden sm:block">
                {key.key_prefix}…
              </code>
              <span className="w-28 text-xs text-muted-foreground hidden md:block">
                {fmtDate(key.created_at)}
              </span>
              <span className={cn(
                "w-16 text-xs font-medium hidden md:block",
                key.revoked_at ? "text-red-600" : "text-emerald-600",
              )}>
                {key.revoked_at ? "Revoked" : "Active"}
              </span>
              <div className="w-20 shrink-0 flex items-center justify-end gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                {!key.revoked_at && (
                  <button
                    type="button"
                    onClick={() => handleRevoke(key.id)}
                    className="flex h-7 w-7 items-center justify-center rounded text-muted-foreground hover:text-amber-600 hover:bg-amber-50 transition-colors"
                    title="Revoke"
                  >
                    <EyeOff className="h-3.5 w-3.5" />
                  </button>
                )}
                <button
                  type="button"
                  onClick={() => setPendingDelete(key)}
                  className="flex h-7 w-7 items-center justify-center rounded text-muted-foreground hover:text-red-600 hover:bg-red-50 transition-colors"
                  title="Delete"
                >
                  <Trash2 className="h-3.5 w-3.5" />
                </button>
              </div>
            </div>
          ))}
        </div>
      )}

      <AlertDialog open={!!pendingDelete} onOpenChange={(o) => !o && setPendingDelete(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete key "{pendingDelete?.name}"?</AlertDialogTitle>
            <AlertDialogDescription>Any apps using this key will immediately lose access.</AlertDialogDescription>
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
