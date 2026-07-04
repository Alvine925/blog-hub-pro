import { createFileRoute } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { queryOptions, useSuspenseQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { toast } from "sonner";
import {
  UserPlus, Trash2, Loader2, Users, ShieldCheck, Shield, Eye,
  ChevronDown, ChevronUp, Mail, Crown, Check, X,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import {
  listUsers, removeUser, revokeInvite, listInvites,
  type CmsUser, type CmsUserInvite, type UserRole,
} from "@/lib/user.functions";
import { listWorkspaces, type Workspace } from "@/lib/workspace.functions";
import {
  invitePlatformUser, inviteWorkspaceMember,
  CONTENT_TYPES, CONTENT_LABELS,
  type WorkspaceRole, type ContentType,
} from "@/lib/workspace-members.functions";
import { formatBlogDate } from "@/lib/blog-types";
import { supabase } from "@/integrations/supabase/client";
import { cn } from "@/lib/utils";
import { useEffect } from "react";

const usersQuery      = queryOptions({ queryKey: ["admin", "users"],      queryFn: () => listUsers()      });
const invitesQuery    = queryOptions({ queryKey: ["admin", "invites"],    queryFn: () => listInvites()    });
const workspacesQuery = queryOptions({ queryKey: ["admin", "workspaces"], queryFn: () => listWorkspaces() });

export const Route = createFileRoute("/admin/users")({
  head: () => ({ meta: [{ title: "Users & Roles — Admin" }] }),
  loader: ({ context }) => Promise.all([
    context.queryClient.ensureQueryData(usersQuery),
    context.queryClient.ensureQueryData(invitesQuery),
    context.queryClient.ensureQueryData(workspacesQuery),
  ]),
  component: UsersPage,
  errorComponent: ({ error }) => (
    <p className="text-sm text-destructive p-8">Failed to load users: {error.message}</p>
  ),
});

// ── Platform role display ─────────────────────────────────────────────────────
type PlatformDisplay = "superadmin" | "co_admin" | "member";

function getPlatformRole(user: CmsUser): PlatformDisplay {
  const raw = (user as any).platform_role;
  if (raw === "superadmin" || raw === "co_admin") return raw;
  if (user.role === "admin") return "co_admin";
  return "member";
}

const PLATFORM_LABELS: Record<PlatformDisplay, string> = {
  superadmin: "Superadmin",
  co_admin:   "Co-Admin",
  member:     "Member",
};

const PLATFORM_STYLES: Record<PlatformDisplay, string> = {
  superadmin: "bg-primary/10 text-primary border-primary/20",
  co_admin:   "bg-violet-50 text-violet-700 border-violet-200",
  member:     "bg-muted text-muted-foreground border-border",
};

const PLATFORM_ICONS: Record<PlatformDisplay, React.ComponentType<{ className?: string }>> = {
  superadmin: Crown,
  co_admin:   ShieldCheck,
  member:     Users,
};

function PlatformBadge({ role }: { role: PlatformDisplay }) {
  const Icon = PLATFORM_ICONS[role];
  return (
    <span className={cn(
      "inline-flex items-center gap-1 rounded border px-2 py-0.5 text-xs font-medium",
      PLATFORM_STYLES[role],
    )}>
      <Icon className="h-3 w-3" />
      {PLATFORM_LABELS[role]}
    </span>
  );
}

// ── Content permission picker ──────────────────────────────────────────────────
function ContentPermissionPicker({
  value,
  onChange,
}: {
  value: ContentType[];
  onChange: (v: ContentType[]) => void;
}) {
  const allSelected = value.includes("all");

  function toggle(type: ContentType) {
    if (type === "all") { onChange(allSelected ? [] : ["all"]); return; }
    const current = value.filter((v) => v !== "all");
    const next = current.includes(type)
      ? current.filter((v) => v !== type)
      : [...current, type];
    onChange(next.length === CONTENT_TYPES.length ? ["all"] : next);
  }

  return (
    <div className="space-y-1.5">
      <Label className="text-xs text-muted-foreground">Content access</Label>
      <div className="flex flex-wrap gap-1.5">
        {(["all", ...CONTENT_TYPES] as ContentType[]).map((type) => {
          const selected = type === "all" ? allSelected : (!allSelected && value.includes(type));
          return (
            <button
              key={type}
              type="button"
              onClick={() => toggle(type)}
              className={cn(
                "flex items-center gap-1 rounded-full border px-2.5 py-1 text-xs font-medium transition-colors",
                selected
                  ? "bg-primary text-white border-primary"
                  : "bg-background border-border text-muted-foreground hover:border-primary/40",
              )}
            >
              {selected && <Check className="h-3 w-3" />}
              {CONTENT_LABELS[type]}
            </button>
          );
        })}
      </div>
    </div>
  );
}

// ── Main page ─────────────────────────────────────────────────────────────────
function UsersPage() {
  const { data: users }      = useSuspenseQuery(usersQuery);
  const { data: invites }    = useSuspenseQuery(invitesQuery);
  const { data: workspaces } = useSuspenseQuery(workspacesQuery);
  const queryClient = useQueryClient();
  const remove    = useServerFn(removeUser);
  const revokeInv = useServerFn(revokeInvite);
  const doPlatformInvite   = useServerFn(invitePlatformUser);
  const doWorkspaceInvite  = useServerFn(inviteWorkspaceMember);

  const [currentUserEmail, setCurrentUserEmail] = useState<string | null>(null);
  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => {
      if (session?.user?.email) setCurrentUserEmail(session.user.email);
    });
  }, []);

  // ── Invite form state ──────────────────────────────────────────────────────
  const [formOpen,     setFormOpen]     = useState(false);
  const [inviteType,   setInviteType]   = useState<"co_admin" | "workspace_member">("co_admin");
  const [email,        setEmail]        = useState("");
  const [name,         setName]         = useState("");
  const [wsId,         setWsId]         = useState("");
  const [wsRole,       setWsRole]       = useState<WorkspaceRole>("editor");
  const [contentPerms, setContentPerms] = useState<ContentType[]>(["all"]);
  const [busy,   setBusy]   = useState(false);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [pendingRemove, setPendingRemove] = useState<CmsUser | null>(null);

  async function refresh() {
    await Promise.all([
      queryClient.invalidateQueries({ queryKey: ["admin", "users"] }),
      queryClient.invalidateQueries({ queryKey: ["admin", "invites"] }),
    ]);
  }

  async function handleInvite(e: React.FormEvent) {
    e.preventDefault();
    if (!email.trim() || !name.trim()) { toast.error("Name and email are required"); return; }
    if (inviteType === "workspace_member" && !wsId) { toast.error("Select a workspace"); return; }

    setBusy(true);
    try {
      const loginUrl = `${window.location.origin}/login`;
      const inviterName = currentUserEmail ?? undefined;

      if (inviteType === "co_admin") {
        await doPlatformInvite({
          data: { email: email.trim(), name: name.trim(), platformRole: "co_admin", loginUrl, inviterName },
        });
        toast.success(`Co-admin invite sent to ${email}`);
      } else {
        const ws = workspaces.find((w: Workspace) => w.id === wsId);
        await doWorkspaceInvite({
          data: {
            workspaceId: wsId,
            email: email.trim(),
            name: name.trim(),
            workspaceRole: wsRole,
            contentPermissions: contentPerms,
            loginUrl,
            workspaceName: ws?.name,
            inviterName,
          },
        });
        toast.success(`Workspace invite sent to ${email}`, {
          description: `${ws?.name ?? ""} · ${wsRole === "workspace_admin" ? "Admin" : wsRole === "editor" ? "Editor" : "Viewer"}`,
        });
      }

      setEmail(""); setName(""); setWsId(""); setWsRole("editor");
      setContentPerms(["all"]); setFormOpen(false);
      await refresh();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Failed to invite");
    } finally {
      setBusy(false);
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
      toast.error(e instanceof Error ? e.message : "Failed to remove");
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
      toast.error(e instanceof Error ? e.message : "Failed to revoke");
    } finally {
      setBusyId(null);
    }
  }

  return (
    <div className="max-w-3xl space-y-10 px-1">

      {/* Page title */}
      <div>
        <h1 className="text-2xl font-bold">Users &amp; Roles</h1>
        <p className="text-sm text-muted-foreground mt-1">
          Manage who can access the CMS and their permissions.
        </p>
      </div>

      {/* Role legend */}
      <div className="space-y-3">
        <h2 className="text-xs font-bold uppercase tracking-widest text-muted-foreground">
          Platform Roles
        </h2>
        <div className="grid gap-3 sm:grid-cols-3 text-sm border border-border rounded-xl p-4">
          {([
            { role: "superadmin" as PlatformDisplay, desc: "Original owner. Can manage all workspaces, users, and platform settings." },
            { role: "co_admin"   as PlatformDisplay, desc: "Invited platform admin. Same access as Superadmin." },
            { role: "member"     as PlatformDisplay, desc: "Access limited to assigned workspaces and their granted role." },
          ]).map(({ role, desc }) => (
            <div key={role} className="space-y-1.5">
              <PlatformBadge role={role} />
              <p className="text-xs text-muted-foreground leading-relaxed">{desc}</p>
            </div>
          ))}
        </div>
      </div>

      <div className="border-t border-border" />

      {/* Members list */}
      <div className="space-y-4">
        <h2 className="text-xs font-bold uppercase tracking-widest text-muted-foreground">
          Team Members
          <span className="ml-2 text-muted-foreground/60 normal-case tracking-normal font-medium text-[11px]">
            {users.length + (currentUserEmail ? 1 : 0)} total
          </span>
        </h2>

        {/* Current superadmin */}
        {currentUserEmail && (
          <div className="flex items-center gap-4 border-b border-border py-4">
            <div className="h-9 w-9 rounded-full bg-primary flex items-center justify-center shrink-0 text-sm font-bold text-white">
              {currentUserEmail.slice(0, 2).toUpperCase()}
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-sm font-medium">You</p>
              <p className="text-xs text-muted-foreground">{currentUserEmail}</p>
            </div>
            <PlatformBadge role="superadmin" />
          </div>
        )}

        {users.length === 0 && (
          <div className="flex flex-col items-center gap-2 py-10 text-center">
            <Users className="h-8 w-8 text-muted-foreground/30" />
            <p className="text-sm text-muted-foreground">No other users yet. Invite someone below.</p>
          </div>
        )}

        {users.map((user) => {
          const pRole = getPlatformRole(user);
          return (
            <div key={user.id} className="flex flex-col gap-2 border-b border-border py-4 last:border-0 sm:flex-row sm:items-center sm:gap-4">
              <div className="h-9 w-9 rounded-full bg-muted flex items-center justify-center shrink-0 text-sm font-semibold">
                {(user.name || user.email).slice(0, 2).toUpperCase()}
              </div>
              <div className="flex-1 min-w-0">
                {user.name && <p className="font-medium text-sm">{user.name}</p>}
                <p className="text-xs text-muted-foreground">{user.email}</p>
                {user.last_login_at && (
                  <p className="text-xs text-muted-foreground">Last login: {formatBlogDate(user.last_login_at)}</p>
                )}
              </div>
              <div className="flex items-center gap-2 shrink-0">
                <PlatformBadge role={pRole} />
                <Button
                  size="icon"
                  variant="ghost"
                  className="text-destructive hover:text-destructive h-7 w-7"
                  onClick={() => setPendingRemove(user)}
                  disabled={busyId === user.id}
                >
                  {busyId === user.id
                    ? <Loader2 className="h-3.5 w-3.5 animate-spin" />
                    : <Trash2 className="h-3.5 w-3.5" />}
                </Button>
              </div>
            </div>
          );
        })}
      </div>

      {/* Pending invites */}
      {invites.length > 0 && (
        <>
          <div className="border-t border-border" />
          <div className="space-y-4">
            <h2 className="text-xs font-bold uppercase tracking-widest text-muted-foreground">
              Pending Invites
            </h2>
            {invites.map((inv) => (
              <div key={inv.id} className="flex items-center gap-4 border-b border-border py-3 last:border-0">
                <Mail className="h-4 w-4 text-muted-foreground shrink-0" />
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium">{inv.email}</p>
                  <p className="text-xs text-muted-foreground">
                    Expires {formatBlogDate(inv.expires_at)}
                  </p>
                </div>
                <span className="text-xs text-amber-600 font-medium shrink-0">Pending</span>
                <Button
                  size="sm"
                  variant="ghost"
                  className="text-destructive hover:text-destructive shrink-0"
                  onClick={() => handleRevokeInvite(inv)}
                  disabled={busyId === inv.id}
                >
                  {busyId === inv.id ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : "Revoke"}
                </Button>
              </div>
            ))}
          </div>
        </>
      )}

      {/* ── Invite form ────────────────────────────────────────────────────── */}
      <div className="border-t border-border pt-6">
        <button
          type="button"
          className="flex w-full items-center justify-between text-sm font-semibold"
          onClick={() => setFormOpen((v) => !v)}
        >
          <span className="flex items-center gap-2">
            <UserPlus className="h-4 w-4" /> Invite User
          </span>
          {formOpen
            ? <ChevronUp className="h-4 w-4 text-muted-foreground" />
            : <ChevronDown className="h-4 w-4 text-muted-foreground" />}
        </button>

        {formOpen && (
          <form onSubmit={handleInvite} className="mt-6 space-y-6">

            {/* Type toggle */}
            <div className="space-y-2">
              <Label>Invite type</Label>
              <div className="flex gap-2">
                {([
                  { value: "co_admin",          label: "Co-Admin",         desc: "Platform-level admin" },
                  { value: "workspace_member",  label: "Workspace Member", desc: "Scoped to a workspace" },
                ] as const).map(({ value, label, desc }) => (
                  <button
                    key={value}
                    type="button"
                    onClick={() => setInviteType(value)}
                    className={cn(
                      "flex-1 rounded-lg border p-3 text-left text-sm transition-colors",
                      inviteType === value
                        ? "border-primary bg-primary/5 text-primary"
                        : "border-border hover:border-primary/40",
                    )}
                  >
                    <p className="font-medium">{label}</p>
                    <p className="text-xs text-muted-foreground mt-0.5">{desc}</p>
                  </button>
                ))}
              </div>
            </div>

            {/* Name + Email */}
            <div className="grid gap-4 sm:grid-cols-2">
              <div className="space-y-1.5">
                <Label htmlFor="inv-name">Full Name</Label>
                <Input
                  id="inv-name"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  placeholder="Jane Smith"
                  required
                  autoFocus
                />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="inv-email">Email Address</Label>
                <Input
                  id="inv-email"
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="jane@company.com"
                  required
                />
              </div>
            </div>

            {/* Workspace member fields */}
            {inviteType === "workspace_member" && (
              <div className="space-y-5 rounded-lg border border-border/60 bg-muted/20 p-4">
                <div className="grid gap-4 sm:grid-cols-2">
                  <div className="space-y-1.5">
                    <Label>Workspace</Label>
                    <Select value={wsId} onValueChange={setWsId} required>
                      <SelectTrigger>
                        <SelectValue placeholder="Select workspace" />
                      </SelectTrigger>
                      <SelectContent>
                        {(workspaces as Workspace[]).map((ws) => (
                          <SelectItem key={ws.id} value={ws.id}>{ws.name}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="space-y-1.5">
                    <Label>Role in workspace</Label>
                    <Select value={wsRole} onValueChange={(v) => {
                      setWsRole(v as WorkspaceRole);
                      if (v === "workspace_admin") setContentPerms(["all"]);
                    }}>
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="workspace_admin">Admin — full access</SelectItem>
                        <SelectItem value="editor">Editor — create &amp; edit</SelectItem>
                        <SelectItem value="viewer">Viewer — read-only</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                </div>

                {(wsRole === "editor" || wsRole === "viewer") && (
                  <ContentPermissionPicker value={contentPerms} onChange={setContentPerms} />
                )}
              </div>
            )}

            {/* Co-admin note */}
            {inviteType === "co_admin" && (
              <p className="text-xs text-muted-foreground rounded-lg bg-violet-50 border border-violet-100 p-3">
                Co-admins have the same platform-level access as you — they can manage all workspaces, users, and settings.
              </p>
            )}

            <div className="flex items-center gap-2">
              <Button type="submit" disabled={busy}>
                {busy ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Mail className="mr-2 h-4 w-4" />}
                Send invite
              </Button>
              <Button type="button" variant="ghost" onClick={() => setFormOpen(false)}>
                Cancel
              </Button>
            </div>
          </form>
        )}
      </div>

      {/* Confirm remove */}
      <AlertDialog open={Boolean(pendingRemove)} onOpenChange={(o) => !o && setPendingRemove(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Remove {pendingRemove?.name || pendingRemove?.email}?</AlertDialogTitle>
            <AlertDialogDescription>
              This user will lose access to the CMS immediately.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleRemove}
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
