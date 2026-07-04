import { createFileRoute } from "@tanstack/react-router";
import { queryOptions, useSuspenseQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { useState } from "react";
import { toast } from "sonner";
import {
  Users, UserPlus, Trash2, Shield, ShieldCheck, Eye, Mail, Loader2,
  ChevronDown, ChevronUp, Check, X,
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
  listWorkspaceMembers, inviteWorkspaceMember, updateWorkspaceMember, removeWorkspaceMember,
  CONTENT_TYPES, CONTENT_LABELS, WORKSPACE_ROLE_LABELS,
  type WorkspaceMember, type WorkspaceRole, type ContentType,
} from "@/lib/workspace-members.functions";
import { cn } from "@/lib/utils";

const membersQuery = (workspaceId: string) =>
  queryOptions({
    queryKey: ["workspace-members", workspaceId],
    queryFn: () => listWorkspaceMembers({ data: { workspaceId } }),
  });

export const Route = createFileRoute("/admin/workspaces/$id/users")({
  loader: ({ context, params }) =>
    context.queryClient.ensureQueryData(membersQuery(params.id)),
  component: WorkspaceUsersPage,
  errorComponent: ({ error }) => <p className="p-8 text-sm text-red-600">{error.message}</p>,
});

// ── Role display helpers ───────────────────────────────────────────────────────
const ROLE_ICONS: Record<WorkspaceRole, React.ComponentType<{ className?: string }>> = {
  workspace_admin: ShieldCheck,
  editor:          Shield,
  viewer:          Eye,
};
const ROLE_COLORS: Record<WorkspaceRole, string> = {
  workspace_admin: "text-primary bg-primary/8 border-primary/20",
  editor:          "text-amber-700 bg-amber-50 border-amber-200",
  viewer:          "text-muted-foreground bg-muted border-border",
};

function RoleBadge({ role }: { role: WorkspaceRole }) {
  const Icon = ROLE_ICONS[role];
  return (
    <span className={cn(
      "inline-flex items-center gap-1 rounded border px-2 py-0.5 text-xs font-medium",
      ROLE_COLORS[role],
    )}>
      <Icon className="h-3 w-3" /> {WORKSPACE_ROLE_LABELS[role]}
    </span>
  );
}

function PermissionTags({ perms }: { perms: ContentType[] }) {
  if (perms.includes("all")) {
    return <span className="text-xs text-muted-foreground">All content</span>;
  }
  return (
    <span className="text-xs text-muted-foreground">
      {perms.map((p) => CONTENT_LABELS[p]).join(", ")}
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

  function toggleAll() {
    onChange(allSelected ? [] : ["all"]);
  }

  function toggleType(type: ContentType) {
    if (type === "all") { toggleAll(); return; }
    const current = value.filter((v) => v !== "all");
    if (current.includes(type)) {
      onChange(current.filter((v) => v !== type));
    } else {
      const next = [...current, type];
      onChange(next.length === CONTENT_TYPES.length ? ["all"] : next);
    }
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
              onClick={() => toggleType(type)}
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

// ── Edit member sheet ──────────────────────────────────────────────────────────
function EditMemberRow({
  member,
  workspaceId,
  onDone,
}: {
  member: WorkspaceMember;
  workspaceId: string;
  onDone: () => void;
}) {
  const doUpdate = useServerFn(updateWorkspaceMember);
  const queryClient = useQueryClient();
  const [role, setRole] = useState<WorkspaceRole>(member.workspace_role);
  const [perms, setPerms] = useState<ContentType[]>(member.content_permissions);
  const [busy, setBusy] = useState(false);

  async function handleSave() {
    setBusy(true);
    try {
      await doUpdate({ data: { memberId: member.id, workspaceRole: role, contentPermissions: perms } });
      toast.success("Member updated");
      await queryClient.invalidateQueries({ queryKey: ["workspace-members", workspaceId] });
      onDone();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Failed to update");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="mt-2 rounded-lg border border-border bg-muted/30 p-4 space-y-4">
      <div className="grid gap-4 sm:grid-cols-2">
        <div className="space-y-1.5">
          <Label>Workspace Role</Label>
          <Select value={role} onValueChange={(v) => setRole(v as WorkspaceRole)}>
            <SelectTrigger>
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="workspace_admin">Admin — full access</SelectItem>
              <SelectItem value="editor">Editor — create & edit content</SelectItem>
              <SelectItem value="viewer">Viewer — read-only</SelectItem>
            </SelectContent>
          </Select>
        </div>
      </div>
      {(role === "editor" || role === "viewer") && (
        <ContentPermissionPicker value={perms} onChange={setPerms} />
      )}
      <div className="flex items-center gap-2">
        <Button size="sm" onClick={handleSave} disabled={busy}>
          {busy && <Loader2 className="mr-2 h-3.5 w-3.5 animate-spin" />}
          Save changes
        </Button>
        <Button size="sm" variant="ghost" onClick={onDone}>Cancel</Button>
      </div>
    </div>
  );
}

// ── Main page ─────────────────────────────────────────────────────────────────
function WorkspaceUsersPage() {
  const { id: workspaceId } = Route.useParams();
  const { data: members } = useSuspenseQuery(membersQuery(workspaceId));
  const queryClient = useQueryClient();
  const doRemove  = useServerFn(removeWorkspaceMember);
  const doInvite  = useServerFn(inviteWorkspaceMember);

  const [showInvite, setShowInvite] = useState(false);
  const [email,  setEmail]  = useState("");
  const [name,   setName]   = useState("");
  const [role,   setRole]   = useState<WorkspaceRole>("editor");
  const [perms,  setPerms]  = useState<ContentType[]>(["all"]);
  const [busy,   setBusy]   = useState(false);
  const [editing, setEditing] = useState<string | null>(null);
  const [pendingRemove, setPendingRemove] = useState<WorkspaceMember | null>(null);
  const [busyId, setBusyId] = useState<string | null>(null);

  async function refresh() {
    await queryClient.invalidateQueries({ queryKey: ["workspace-members", workspaceId] });
  }

  async function handleInvite(e: React.FormEvent) {
    e.preventDefault();
    if (!email.trim() || !name.trim()) return;
    setBusy(true);
    try {
      await doInvite({
        data: {
          workspaceId,
          email: email.trim(),
          name: name.trim(),
          workspaceRole: role,
          contentPermissions: perms,
          loginUrl: `${window.location.origin}/login`,
        },
      });
      toast.success(`Invite sent to ${email}`, {
        description: `${WORKSPACE_ROLE_LABELS[role]} · ${perms.includes("all") ? "All content" : perms.join(", ")}`,
      });
      setEmail(""); setName(""); setRole("editor"); setPerms(["all"]);
      setShowInvite(false);
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
      await doRemove({ data: { memberId: pendingRemove.id } });
      toast.success("Member removed");
      setPendingRemove(null);
      await refresh();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Failed to remove");
    } finally {
      setBusyId(null);
    }
  }

  const active  = members.filter((m) => m.status === "active");
  const pending = members.filter((m) => m.status === "pending");

  return (
    <div className="min-h-full px-4 py-4 sm:px-8 sm:py-8">

      {/* Header */}
      <div className="mb-6 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-xl font-semibold">Workspace Users</h1>
          <p className="mt-0.5 text-sm text-muted-foreground">
            {active.length} member{active.length !== 1 ? "s" : ""}
            {pending.length > 0 && ` · ${pending.length} pending`}
          </p>
        </div>
        <button
          type="button"
          onClick={() => setShowInvite((v) => !v)}
          className="flex items-center gap-1.5 rounded-md bg-primary px-3 py-1.5 text-sm font-medium text-primary-foreground hover:bg-primary/90 transition-colors self-start"
        >
          {showInvite ? <ChevronUp className="h-3.5 w-3.5" /> : <UserPlus className="h-3.5 w-3.5" />}
          {showInvite ? "Cancel" : "Invite User"}
        </button>
      </div>

      {/* Invite form */}
      {showInvite && (
        <form onSubmit={handleInvite} className="mb-8 rounded-xl border border-border bg-muted/30 p-5 space-y-5">
          <h2 className="text-sm font-semibold">Add a team member to this workspace</h2>

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

          <div className="space-y-1.5">
            <Label>Workspace Role</Label>
            <Select value={role} onValueChange={(v) => {
              setRole(v as WorkspaceRole);
              if (v === "workspace_admin") setPerms(["all"]);
            }}>
              <SelectTrigger className="w-full sm:w-72">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="workspace_admin">
                  <div>
                    <p className="font-medium">Admin</p>
                    <p className="text-xs text-muted-foreground">Full access — settings, API keys, all content</p>
                  </div>
                </SelectItem>
                <SelectItem value="editor">
                  <div>
                    <p className="font-medium">Editor</p>
                    <p className="text-xs text-muted-foreground">Create, edit and publish content</p>
                  </div>
                </SelectItem>
                <SelectItem value="viewer">
                  <div>
                    <p className="font-medium">Viewer</p>
                    <p className="text-xs text-muted-foreground">Read-only access to content</p>
                  </div>
                </SelectItem>
              </SelectContent>
            </Select>
          </div>

          {(role === "editor" || role === "viewer") && (
            <ContentPermissionPicker value={perms} onChange={setPerms} />
          )}

          <div className="flex items-center gap-2 pt-1">
            <Button type="submit" disabled={busy || !email.trim() || !name.trim()}>
              {busy
                ? <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                : <Mail className="mr-2 h-4 w-4" />}
              Send invite
            </Button>
            <Button type="button" variant="ghost" onClick={() => setShowInvite(false)}>
              Cancel
            </Button>
          </div>
        </form>
      )}

      {/* Role legend */}
      <div className="mb-6 grid gap-3 sm:grid-cols-3 rounded-lg border border-border bg-muted/20 p-4 text-sm">
        {(["workspace_admin", "editor", "viewer"] as WorkspaceRole[]).map((r) => (
          <div key={r}>
            <RoleBadge role={r} />
            <p className="mt-1.5 text-xs text-muted-foreground leading-relaxed">
              {r === "workspace_admin" && "Full access including API keys, webhooks, and settings."}
              {r === "editor" && "Can create and publish content. No access to dev tools or settings."}
              {r === "viewer" && "Read-only. Cannot edit content or access dev tools."}
            </p>
          </div>
        ))}
      </div>

      {/* Members list */}
      {members.length === 0 ? (
        <div className="flex flex-col items-center gap-3 py-16 text-center">
          <Users className="h-10 w-10 text-muted-foreground/30" />
          <div>
            <p className="text-sm font-medium">No team members yet</p>
            <p className="text-sm text-muted-foreground mt-0.5">Invite someone above to get started.</p>
          </div>
        </div>
      ) : (
        <div className="divide-y divide-border border-t border-border">
          {members.map((member) => (
            <div key={member.id} className="py-4">
              <div className="flex items-center gap-3">
                {/* Avatar */}
                <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-primary/10 text-sm font-semibold text-primary">
                  {(member.name || member.email)[0].toUpperCase()}
                </div>

                {/* Info */}
                <div className="flex-1 min-w-0">
                  <div className="flex flex-wrap items-center gap-2">
                    <p className="text-sm font-medium">{member.name || member.email}</p>
                    <RoleBadge role={member.workspace_role} />
                    {member.status === "pending" && (
                      <span className="text-xs text-amber-600 font-medium">Pending</span>
                    )}
                  </div>
                  <p className="text-xs text-muted-foreground">{member.email}</p>
                  {(member.workspace_role === "editor" || member.workspace_role === "viewer") && (
                    <div className="mt-0.5">
                      <PermissionTags perms={member.content_permissions} />
                    </div>
                  )}
                </div>

                {/* Actions */}
                <div className="flex items-center gap-1 shrink-0">
                  <button
                    type="button"
                    onClick={() => setEditing(editing === member.id ? null : member.id)}
                    className="rounded px-2.5 py-1.5 text-xs font-medium text-muted-foreground hover:bg-muted hover:text-foreground transition-colors"
                  >
                    Edit
                  </button>
                  <button
                    type="button"
                    onClick={() => setPendingRemove(member)}
                    disabled={busyId === member.id}
                    className="flex h-7 w-7 items-center justify-center rounded text-muted-foreground hover:text-red-600 hover:bg-red-50 transition-colors"
                  >
                    {busyId === member.id
                      ? <Loader2 className="h-3.5 w-3.5 animate-spin" />
                      : <Trash2 className="h-3.5 w-3.5" />}
                  </button>
                </div>
              </div>

              {/* Inline edit */}
              {editing === member.id && (
                <EditMemberRow
                  member={member}
                  workspaceId={workspaceId}
                  onDone={() => setEditing(null)}
                />
              )}
            </div>
          ))}
        </div>
      )}

      {/* Confirm remove */}
      <AlertDialog open={!!pendingRemove} onOpenChange={(o) => !o && setPendingRemove(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Remove {pendingRemove?.name || pendingRemove?.email}?</AlertDialogTitle>
            <AlertDialogDescription>
              They will immediately lose access to this workspace.
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
