import { createFileRoute } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { queryOptions, useSuspenseQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { toast } from "sonner";
import {
  UserPlus, Trash2, Loader2, Users, ShieldCheck, ShieldAlert, Eye,
  ChevronDown, ChevronUp, Mail,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import {
  listUsers, listInvites, inviteUser, updateUserRole, removeUser, revokeInvite,
  type CmsUser, type CmsUserInvite, type UserRole,
} from "@/lib/user.functions";
import { formatBlogDate } from "@/lib/blog-types";

const usersQuery = queryOptions({ queryKey: ["admin", "users"], queryFn: () => listUsers() });
const invitesQuery = queryOptions({ queryKey: ["admin", "invites"], queryFn: () => listInvites() });

export const Route = createFileRoute("/admin/users")({
  head: () => ({ meta: [{ title: "Users & Roles — Admin" }] }),
  loader: ({ context }) => Promise.all([
    context.queryClient.ensureQueryData(usersQuery),
    context.queryClient.ensureQueryData(invitesQuery),
  ]),
  component: UsersPage,
  errorComponent: ({ error }) => (
    <p className="text-sm text-destructive">Failed to load users: {error.message}</p>
  ),
});

const ROLE_LABELS: Record<UserRole, string> = { admin: "Admin", editor: "Editor", viewer: "Viewer" };

const ROLE_ICONS: Record<UserRole, React.ComponentType<{ className?: string }>> = {
  admin: ShieldCheck,
  editor: ShieldAlert,
  viewer: Eye,
};

function RoleBadge({ role }: { role: UserRole }) {
  const Icon = ROLE_ICONS[role];
  const variants: Record<UserRole, string> = {
    admin: "bg-primary/10 text-primary border-primary/20",
    editor: "bg-amber-50 text-amber-700 border-amber-200",
    viewer: "bg-muted text-muted-foreground border-border",
  };
  return (
    <span className={`inline-flex items-center gap-1 rounded border px-2 py-0.5 text-xs font-medium ${variants[role]}`}>
      <Icon className="h-3 w-3" /> {ROLE_LABELS[role]}
    </span>
  );
}

function UsersPage() {
  const { data: users } = useSuspenseQuery(usersQuery);
  const { data: invites } = useSuspenseQuery(invitesQuery);
  const queryClient = useQueryClient();
  const invite = useServerFn(inviteUser);
  const updateRole = useServerFn(updateUserRole);
  const remove = useServerFn(removeUser);
  const revokeInv = useServerFn(revokeInvite);

  const [formOpen, setFormOpen] = useState(false);
  const [email, setEmail] = useState("");
  const [role, setRole] = useState<UserRole>("editor");
  const [busy, setBusy] = useState(false);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [pendingRemove, setPendingRemove] = useState<CmsUser | null>(null);

  async function refresh() {
    await Promise.all([
      queryClient.invalidateQueries({ queryKey: ["admin", "users"] }),
      queryClient.invalidateQueries({ queryKey: ["admin", "invites"] }),
    ]);
  }

  async function handleInvite() {
    if (!email.trim()) { toast.error("Enter an email address"); return; }
    setBusy(true);
    try {
      const inv = await invite({ data: { email: email.trim(), role } });
      toast.success(`Invite sent to ${email}`, {
        description: `Share this token with them: ${inv.token.slice(0, 16)}…`,
        duration: 8000,
      });
      setEmail(""); setFormOpen(false);
      await refresh();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Failed to invite");
    } finally {
      setBusy(false);
    }
  }

  async function handleRoleChange(user: CmsUser, newRole: UserRole) {
    setBusyId(user.id);
    try {
      await updateRole({ data: { id: user.id, role: newRole } });
      toast.success("Role updated");
      await refresh();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Failed");
    } finally {
      setBusyId(null);
    }
  }

  async function handleRemove() {
    if (!pendingRemove) return;
    setBusyId(pendingRemove.id);
    try {
      await remove({ data: { id: pendingRemove.id } });
      toast.success("User removed");
      setPendingRemove(null);
      await refresh();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Failed");
    } finally {
      setBusyId(null);
    }
  }

  async function handleRevokeInvite(inv: CmsUserInvite) {
    setBusyId(inv.id);
    try {
      await revokeInv({ data: { id: inv.id } });
      toast.success("Invite revoked");
      await refresh();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Failed");
    } finally {
      setBusyId(null);
    }
  }

  return (
    <div className="max-w-3xl space-y-10">
      <div>
        <h1 className="text-2xl font-bold">Users &amp; Roles</h1>
        <p className="text-sm text-muted-foreground">
          Manage who has access to the CMS and what they can do.
        </p>
      </div>

      <div className="space-y-2">
        <h2 className="text-sm font-semibold uppercase tracking-wide text-muted-foreground">
          Role Permissions
        </h2>
        <div className="grid gap-2 sm:grid-cols-3 text-sm border-t border-border pt-4">
          {(["admin", "editor", "viewer"] as UserRole[]).map((r) => (
            <div key={r} className="space-y-1">
              <RoleBadge role={r} />
              <p className="text-xs text-muted-foreground mt-1.5">
                {r === "admin" && "Full access — manage all content, users, settings, and API keys."}
                {r === "editor" && "Can create, edit, and publish posts and collections."}
                {r === "viewer" && "Read-only access to all content and analytics."}
              </p>
            </div>
          ))}
        </div>
      </div>

      <div className="border-t border-border" />

      <div className="space-y-4">
        <h2 className="text-sm font-semibold uppercase tracking-wide text-muted-foreground">
          Team Members <Badge variant="secondary" className="ml-1">{users.length}</Badge>
        </h2>
        {users.length === 0 ? (
          <div className="flex flex-col items-center gap-2 py-10 text-center">
            <Users className="h-8 w-8 text-muted-foreground" />
            <p className="text-sm text-muted-foreground">No team members yet. Invite someone below.</p>
          </div>
        ) : (
          <div>
            {users.map((user) => (
              <div key={user.id} className="flex items-center gap-4 border-b border-border py-4 last:border-0">
                <div className="h-8 w-8 rounded-full bg-muted flex items-center justify-center shrink-0 text-xs font-semibold uppercase">
                  {(user.name || user.email).slice(0, 2)}
                </div>
                <div className="flex-1 min-w-0">
                  {user.name && <p className="font-medium text-sm">{user.name}</p>}
                  <p className="text-xs text-muted-foreground">{user.email}</p>
                  {user.last_login_at && (
                    <p className="text-xs text-muted-foreground">Last login: {formatBlogDate(user.last_login_at)}</p>
                  )}
                </div>
                <div className="flex items-center gap-2 shrink-0">
                  <Select
                    value={user.role}
                    onValueChange={(v) => handleRoleChange(user, v as UserRole)}
                    disabled={busyId === user.id}
                  >
                    <SelectTrigger className="h-7 w-28 text-xs">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="admin">Admin</SelectItem>
                      <SelectItem value="editor">Editor</SelectItem>
                      <SelectItem value="viewer">Viewer</SelectItem>
                    </SelectContent>
                  </Select>
                  <Button size="icon" variant="ghost" className="text-destructive hover:text-destructive h-7 w-7" onClick={() => setPendingRemove(user)} disabled={busyId === user.id}>
                    <Trash2 className="h-3.5 w-3.5" />
                  </Button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {invites.length > 0 && (
        <>
          <div className="border-t border-border" />
          <div className="space-y-4">
            <h2 className="text-sm font-semibold uppercase tracking-wide text-muted-foreground">
              Pending Invites
            </h2>
            {invites.map((inv) => (
              <div key={inv.id} className="flex items-center gap-4 border-b border-border py-3 last:border-0">
                <Mail className="h-4 w-4 text-muted-foreground shrink-0" />
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium">{inv.email}</p>
                  <p className="text-xs text-muted-foreground">
                    <RoleBadge role={inv.role as UserRole} /> · Expires {formatBlogDate(inv.expires_at)}
                  </p>
                </div>
                <Button size="sm" variant="ghost" className="text-destructive hover:text-destructive" onClick={() => handleRevokeInvite(inv)} disabled={busyId === inv.id}>
                  {busyId === inv.id ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : "Revoke"}
                </Button>
              </div>
            ))}
          </div>
        </>
      )}

      <div className="border-t border-border pt-6">
        <button
          type="button"
          className="flex w-full items-center justify-between text-sm font-semibold"
          onClick={() => setFormOpen((v) => !v)}
        >
          <span className="flex items-center gap-2">
            <UserPlus className="h-4 w-4" /> Invite Team Member
          </span>
          {formOpen ? <ChevronUp className="h-4 w-4 text-muted-foreground" /> : <ChevronDown className="h-4 w-4 text-muted-foreground" />}
        </button>

        {formOpen && (
          <div className="mt-5 grid gap-4 sm:grid-cols-[1fr_auto_auto]">
            <div className="space-y-1.5">
              <Label htmlFor="inv-email">Email</Label>
              <Input id="inv-email" type="email" value={email} onChange={(e) => setEmail(e.target.value)} onKeyDown={(e) => e.key === "Enter" && handleInvite()} placeholder="colleague@example.com" />
            </div>
            <div className="space-y-1.5">
              <Label>Role</Label>
              <Select value={role} onValueChange={(v) => setRole(v as UserRole)}>
                <SelectTrigger className="w-32">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="admin">Admin</SelectItem>
                  <SelectItem value="editor">Editor</SelectItem>
                  <SelectItem value="viewer">Viewer</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="flex items-end">
              <Button onClick={handleInvite} disabled={busy}>
                {busy ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <UserPlus className="mr-2 h-4 w-4" />}
                Invite
              </Button>
            </div>
          </div>
        )}
      </div>

      <AlertDialog open={Boolean(pendingRemove)} onOpenChange={(o) => !o && setPendingRemove(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Remove {pendingRemove?.name || pendingRemove?.email}?</AlertDialogTitle>
            <AlertDialogDescription>
              This user will lose access immediately.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={handleRemove} className="bg-destructive text-destructive-foreground hover:bg-destructive/90">
              Remove
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
