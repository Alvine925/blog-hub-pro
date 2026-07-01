import { createFileRoute } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { queryOptions, useSuspenseQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { toast } from "sonner";
import {
  Plus, Trash2, Copy, Key, AlertTriangle, Loader2, Eye, EyeOff,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { supabase } from "@/integrations/supabase/client";
import { listApiKeys, revokeApiKey, deleteApiKey, type ApiKey } from "@/lib/apikey.functions";
import { formatBlogDate } from "@/lib/blog-types";

const keysQuery = queryOptions({
  queryKey: ["admin", "api_keys"],
  queryFn: () => listApiKeys(),
});

export const Route = createFileRoute("/admin/api-keys")({
  head: () => ({ meta: [{ title: "API Keys — Admin" }] }),
  loader: ({ context }) => context.queryClient.ensureQueryData(keysQuery),
  component: ApiKeys,
  errorComponent: ({ error }) => (
    <p className="text-sm text-destructive">Failed to load API keys: {error.message}</p>
  ),
});

function ApiKeys() {
  const { data: keys } = useSuspenseQuery(keysQuery);
  const queryClient = useQueryClient();
  const revoke = useServerFn(revokeApiKey);
  const del = useServerFn(deleteApiKey);

  const [newName, setNewName] = useState("");
  const [creating, setCreating] = useState(false);
  const [newKeyDialog, setNewKeyDialog] = useState<{ key: string } | null>(null);
  const [showKey, setShowKey] = useState(false);
  const [pendingRevoke, setPendingRevoke] = useState<ApiKey | null>(null);
  const [pendingDelete, setPendingDelete] = useState<ApiKey | null>(null);
  const [busyId, setBusyId] = useState<string | null>(null);

  async function refresh() {
    await queryClient.invalidateQueries({ queryKey: ["admin", "api_keys"] });
  }

  async function handleCreate() {
    if (!newName.trim()) {
      toast.error("Enter a name for the key");
      return;
    }
    setCreating(true);
    try {
      const { data, error } = await supabase.functions.invoke("generate-api-key", {
        body: { name: newName.trim() },
      });
      if (error) throw new Error(error.message);
      if (data?.error) throw new Error(data.error);
      setNewName("");
      setNewKeyDialog({ key: data.key });
      setShowKey(false);
      await refresh();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Failed to create key");
    } finally {
      setCreating(false);
    }
  }

  async function handleRevoke() {
    if (!pendingRevoke) return;
    setBusyId(pendingRevoke.id);
    try {
      await revoke({ data: { id: pendingRevoke.id } });
      toast.success("Key revoked");
      setPendingRevoke(null);
      await refresh();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Failed");
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
      toast.error(e instanceof Error ? e.message : "Failed");
    } finally {
      setBusyId(null);
    }
  }

  function copyKey(key: string) {
    navigator.clipboard.writeText(key).then(() => toast.success("Key copied to clipboard"));
  }

  const active = keys.filter((k) => !k.revoked_at);
  const revoked = keys.filter((k) => k.revoked_at);

  return (
    <div className="space-y-10 max-w-4xl">
      <div>
        <h1 className="text-2xl font-bold">API Keys</h1>
        <p className="text-sm text-muted-foreground">
          Use API keys to access your content from any application. Keys are generated securely via Supabase Edge Functions.
        </p>
      </div>

      {/* REST API reference */}
      <div className="space-y-3">
        <h2 className="text-sm font-semibold uppercase tracking-wide text-muted-foreground">
          REST Endpoints
        </h2>
        {[
          { method: "GET", path: "/api/v1/posts", desc: "List published posts (search, category, limit, offset)" },
          { method: "GET", path: "/api/v1/posts/:slug", desc: "Get a single post by slug" },
        ].map((ep) => (
          <div key={ep.path} className="flex flex-wrap items-start gap-3 border-b border-border/50 py-3 last:border-0">
            <span className="mt-0.5 shrink-0 rounded bg-primary px-2 py-0.5 text-xs font-bold text-primary-foreground">
              {ep.method}
            </span>
            <div className="min-w-0 flex-1">
              <code className="break-all text-sm font-mono">{ep.path}</code>
              <p className="mt-0.5 text-xs text-muted-foreground">{ep.desc}</p>
            </div>
          </div>
        ))}
        <pre className="mt-2 rounded border border-border bg-slate-950 px-4 py-3 text-xs font-mono text-slate-100">
          curl /api/v1/posts?category=Wedding&amp;limit=10
        </pre>
      </div>

      <div className="border-t border-border" />

      {/* Create new key */}
      <div className="space-y-4">
        <h2 className="text-sm font-semibold uppercase tracking-wide text-muted-foreground">
          Generate New Key
        </h2>
        <p className="text-xs text-muted-foreground">
          Keys are generated using the Web Crypto API (CSPRNG) inside a Supabase Edge Function and stored as SHA-256 hashes. The raw key is shown only once.
        </p>
        <div className="flex gap-3">
          <div className="flex-1">
            <Label htmlFor="key-name" className="sr-only">Key name</Label>
            <Input
              id="key-name"
              value={newName}
              onChange={(e) => setNewName(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && handleCreate()}
              placeholder="e.g. My Website, Marketing App"
            />
          </div>
          <Button onClick={handleCreate} disabled={creating}>
            {creating ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Plus className="mr-2 h-4 w-4" />}
            Generate
          </Button>
        </div>
      </div>

      <div className="border-t border-border" />

      {/* Active keys */}
      <div className="space-y-4">
        <h2 className="text-sm font-semibold uppercase tracking-wide text-muted-foreground">
          Active Keys {active.length > 0 && <Badge variant="secondary" className="ml-1">{active.length}</Badge>}
        </h2>
        {active.length === 0 ? (
          <div className="flex flex-col items-center gap-3 py-12 text-center">
            <Key className="h-8 w-8 text-muted-foreground" />
            <p className="text-sm text-muted-foreground">No active API keys. Generate one above.</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Name</TableHead>
                  <TableHead>Prefix</TableHead>
                  <TableHead>Created</TableHead>
                  <TableHead>Last Used</TableHead>
                  <TableHead className="text-right">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {active.map((key) => (
                  <TableRow key={key.id}>
                    <TableCell className="font-medium">{key.name}</TableCell>
                    <TableCell>
                      <code className="rounded bg-muted px-1.5 py-0.5 text-xs">{key.key_prefix}…</code>
                    </TableCell>
                    <TableCell className="text-muted-foreground text-sm">{formatBlogDate(key.created_at)}</TableCell>
                    <TableCell className="text-muted-foreground text-sm">
                      {key.last_used_at ? formatBlogDate(key.last_used_at) : "Never"}
                    </TableCell>
                    <TableCell>
                      <div className="flex items-center justify-end gap-1">
                        <Button size="sm" variant="ghost" onClick={() => setPendingRevoke(key)} disabled={busyId === key.id}>
                          <AlertTriangle className="mr-1.5 h-3.5 w-3.5" /> Revoke
                        </Button>
                        <Button size="icon" variant="ghost" className="text-destructive hover:text-destructive" onClick={() => setPendingDelete(key)} disabled={busyId === key.id}>
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      </div>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        )}
      </div>

      {revoked.length > 0 && (
        <>
          <div className="border-t border-border" />
          <div className="space-y-4">
            <h2 className="text-sm font-semibold uppercase tracking-wide text-muted-foreground">
              Revoked Keys
            </h2>
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Name</TableHead>
                    <TableHead>Prefix</TableHead>
                    <TableHead>Revoked</TableHead>
                    <TableHead className="text-right">Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {revoked.map((key) => (
                    <TableRow key={key.id} className="opacity-50">
                      <TableCell className="font-medium">{key.name}</TableCell>
                      <TableCell>
                        <code className="rounded bg-muted px-1.5 py-0.5 text-xs">{key.key_prefix}…</code>
                      </TableCell>
                      <TableCell className="text-muted-foreground text-sm">{formatBlogDate(key.revoked_at!)}</TableCell>
                      <TableCell>
                        <div className="flex justify-end">
                          <Button size="icon" variant="ghost" className="text-destructive hover:text-destructive" onClick={() => setPendingDelete(key)} disabled={busyId === key.id}>
                            <Trash2 className="h-4 w-4" />
                          </Button>
                        </div>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          </div>
        </>
      )}

      {/* New key dialog */}
      <Dialog open={Boolean(newKeyDialog)} onOpenChange={(o) => { if (!o) setNewKeyDialog(null); }}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>API Key Generated</DialogTitle>
          </DialogHeader>
          <div className="space-y-3">
            <p className="text-sm text-muted-foreground">
              Copy this key now — it won't be shown again. Generated securely using CSPRNG and stored as a SHA-256 hash.
            </p>
            <div className="flex gap-2">
              <div className="relative flex-1">
                <Input
                  readOnly
                  value={showKey ? newKeyDialog?.key ?? "" : "•".repeat(40)}
                  className="font-mono text-sm pr-10"
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

      <AlertDialog open={Boolean(pendingRevoke)} onOpenChange={(o) => !o && setPendingRevoke(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Revoke "{pendingRevoke?.name}"?</AlertDialogTitle>
            <AlertDialogDescription>
              Any application using this key will immediately lose access. This cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={handleRevoke} className="bg-destructive text-destructive-foreground hover:bg-destructive/90">
              Revoke Key
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <AlertDialog open={Boolean(pendingDelete)} onOpenChange={(o) => !o && setPendingDelete(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete "{pendingDelete?.name}"?</AlertDialogTitle>
            <AlertDialogDescription>
              This will permanently remove the key record. This cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={handleDelete} className="bg-destructive text-destructive-foreground hover:bg-destructive/90">
              Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
