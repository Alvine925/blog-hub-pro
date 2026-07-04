import { createFileRoute } from "@tanstack/react-router";
import { queryOptions, useSuspenseQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { useState } from "react";
import { toast } from "sonner";
import { Users, UserPlus, Trash2, Shield, Mail, Loader2 } from "lucide-react";
import { listUsers, listInvites, inviteUser, updateUserRole, removeUser } from "@/lib/user.functions";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
} from "@/components/ui/alert-dialog";

const usersQuery = queryOptions({
  queryKey: ["admin", "users"],
  queryFn: () => listUsers(),
});
const invitesQuery = queryOptions({
  queryKey: ["admin", "invites"],
  queryFn: () => listInvites(),
});

export const Route = createFileRoute("/admin/workspaces/$id/users")({
  loader: ({ context }) => Promise.all([
    context.queryClient.ensureQueryData(usersQuery),
    context.queryClient.ensureQueryData(invitesQuery),
  ]),
  component: WorkspaceUsers,
  errorComponent: ({ error }) => <p className="p-8 text-sm text-red-600">{error.message}</p>,
});

const ROLE_LABELS: Record<string, string> = {
  admin: "Admin", editor: "Editor", viewer: "Viewer",
};

function fmtDate(d: string) {
  return new Date(d).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" });
}

function WorkspaceUsers() {
  const { data: users } = useSuspenseQuery(usersQuery);
  const { data: invites } = useSuspenseQuery(invitesQuery);
  const queryClient = useQueryClient();
  const doInvite = useServerFn(inviteUser);
  const doUpdateRole = useServerFn(updateUserRole);
  const doRemove = useServerFn(removeUser);

  const [showInvite, setShowInvite] = useState(false);
  const [email, setEmail] = useState("");
  const [role, setRole] = useState("editor");
  const [busy, setBusy] = useState(false);
  const [pendingRemove, setPendingRemove] = useState<{ id: string; email: string } | null>(null);

  async function handleInvite(e: React.FormEvent) {
    e.preventDefault();
    if (!email.trim()) return;
    setBusy(true);
    try {
      await doInvite({ data: { email: email.trim(), role } });
      toast.success(`Invite sent to ${email}`);
      setEmail(""); setShowInvite(false);
      await queryClient.invalidateQueries({ queryKey: ["admin", "invites"] });
    } catch (err) { toast.error(err instanceof Error ? err.message : "Failed"); }
    finally { setBusy(false); }
  }

  async function handleRoleChange(userId: string, newRole: string) {
    try {
      await doUpdateRole({ data: { userId, role: newRole } });
      toast.success("Role updated");
      await queryClient.invalidateQueries({ queryKey: ["admin", "users"] });
    } catch (err) { toast.error(err instanceof Error ? err.message : "Failed"); }
  }

  async function handleRemove() {
    if (!pendingRemove) return;
    setBusy(true);
    try {
      await doRemove({ data: { userId: pendingRemove.id } });
      toast.success("User removed");
      setPendingRemove(null);
      await queryClient.invalidateQueries({ queryKey: ["admin", "users"] });
    } catch (err) { toast.error(err instanceof Error ? err.message : "Failed"); }
    finally { setBusy(false); }
  }

  return (
    <div className="min-h-full px-4 py-4 sm:px-8 sm:py-8">
      {/* Header */}
      <div className="mb-6 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-xl font-semibold">Users</h1>
          <p className="mt-0.5 text-sm text-muted-foreground">{users.length} members · {invites.length} pending invites</p>
        </div>
        <button
          type="button"
          onClick={() => setShowInvite((v) => !v)}
          className="flex items-center gap-1.5 rounded-md bg-primary px-3 py-1.5 text-sm font-medium text-primary-foreground hover:bg-primary/90 transition-colors"
        >
          <UserPlus className="h-3.5 w-3.5" /> Invite User
        </button>
      </div>

      {/* Invite form */}
      {showInvite && (
        <form onSubmit={handleInvite} className="mb-8 border-b border-border pb-8">
          <h2 className="mb-3 text-sm font-medium">Invite a team member</h2>
          <div className="flex gap-3 flex-wrap">
            <Input
              type="email"
              placeholder="Email address"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
              autoFocus
              className="w-64"
            />
            <select
              value={role}
              onChange={(e) => setRole(e.target.value)}
              className="rounded-md border border-border bg-background px-3 py-2 text-sm"
            >
              {Object.entries(ROLE_LABELS).map(([v, l]) => (
                <option key={v} value={v}>{l}</option>
              ))}
            </select>
            <Button type="submit" size="sm" disabled={busy || !email.trim()}>
              {busy ? <Loader2 className="mr-2 h-3.5 w-3.5 animate-spin" /> : <Mail className="mr-2 h-3.5 w-3.5" />}
              Send invite
            </Button>
            <Button type="button" variant="ghost" size="sm" onClick={() => setShowInvite(false)}>Cancel</Button>
          </div>
        </form>
      )}

      {/* Members */}
      <section className="mb-10">
        <div className="mb-0 flex items-center border-b border-border pb-2 text-[10px] font-semibold uppercase tracking-widest text-muted-foreground/60">
          <span className="flex-1">Member</span>
          <span className="w-24 hidden sm:block">Role</span>
          <span className="w-28 hidden md:block">Joined</span>
          <span className="w-12 text-right">Actions</span>
        </div>

        {users.length === 0 ? (
          <div className="flex flex-col items-center gap-2 py-10 text-center">
            <Users className="h-8 w-8 text-muted-foreground/30" />
            <p className="text-sm text-muted-foreground">No members yet.</p>
          </div>
        ) : (
          users.map((user: any) => (
            <div key={user.id} className="group flex items-center gap-3 border-b border-border py-3.5 last:border-0">
              {/* Avatar */}
              <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-primary/10 text-xs font-semibold text-primary">
                {(user.email?.[0] ?? "?").toUpperCase()}
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium">{user.full_name || user.email}</p>
                <p className="text-xs text-muted-foreground">{user.email}</p>
              </div>
              <div className="w-24 hidden sm:block">
                <select
                  value={user.role ?? "viewer"}
                  onChange={(e) => handleRoleChange(user.id, e.target.value)}
                  className="text-xs bg-transparent text-muted-foreground hover:text-foreground focus:outline-none cursor-pointer"
                >
                  {Object.entries(ROLE_LABELS).map(([v, l]) => (
                    <option key={v} value={v}>{l}</option>
                  ))}
                </select>
              </div>
              <span className="w-28 text-xs text-muted-foreground hidden md:block">
                {user.joined_at ? fmtDate(user.joined_at) : "—"}
              </span>
              <div className="w-12 flex items-center justify-end opacity-0 group-hover:opacity-100 transition-opacity">
                <button
                  type="button"
                  onClick={() => setPendingRemove({ id: user.id, email: user.email })}
                  className="flex h-7 w-7 items-center justify-center rounded text-muted-foreground hover:text-red-600 hover:bg-red-50 transition-colors"
                  title="Remove"
                >
                  <Trash2 className="h-3.5 w-3.5" />
                </button>
              </div>
            </div>
          ))
        )}
      </section>

      {/* Pending invites */}
      {invites.length > 0 && (
        <section>
          <div className="mb-0 border-b border-border pb-3">
            <h2 className="text-[11px] font-semibold uppercase tracking-widest text-muted-foreground">
              Pending Invites
            </h2>
          </div>
          {invites.map((inv: any) => (
            <div key={inv.id} className="flex items-center gap-3 border-b border-border py-3 last:border-0">
              <Mail className="h-4 w-4 shrink-0 text-muted-foreground/60" />
              <div className="flex-1 min-w-0">
                <p className="text-sm">{inv.email}</p>
                <p className="text-xs text-muted-foreground">
                  <span className={cn(
                    "inline-flex items-center gap-1",
                    inv.role === "admin" ? "text-primary" : "text-muted-foreground",
                  )}>
                    <Shield className="h-3 w-3" />{ROLE_LABELS[inv.role] ?? inv.role}
                  </span>
                  {" · "}{inv.expires_at ? `Expires ${fmtDate(inv.expires_at)}` : "No expiry"}
                </p>
              </div>
              <span className="text-xs text-amber-600 font-medium">Pending</span>
            </div>
          ))}
        </section>
      )}

      <AlertDialog open={!!pendingRemove} onOpenChange={(o) => !o && setPendingRemove(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Remove {pendingRemove?.email}?</AlertDialogTitle>
            <AlertDialogDescription>They will lose access to this workspace immediately.</AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleRemove}
              disabled={busy}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              Remove
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
