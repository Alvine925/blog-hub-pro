import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";

export type WorkspaceRole   = "workspace_admin" | "editor" | "viewer";
export type PlatformRole    = "superadmin" | "co_admin" | "member";
export type ContentType     = "all" | "blogs" | "articles" | "news" | "faqs" | "products";

export const CONTENT_LABELS: Record<ContentType, string> = {
  all:      "All Content",
  blogs:    "Blog Posts",
  articles: "Articles",
  news:     "News",
  faqs:     "FAQs",
  products: "Products",
};

export const CONTENT_TYPES: ContentType[] = ["blogs", "articles", "news", "faqs", "products"];

export const WORKSPACE_ROLE_LABELS: Record<WorkspaceRole, string> = {
  workspace_admin: "Admin",
  editor:          "Editor",
  viewer:          "Viewer",
};

export interface WorkspaceMember {
  id: string;
  workspace_id: string;
  email: string;
  name: string | null;
  user_id: string | null;
  workspace_role: WorkspaceRole;
  content_permissions: ContentType[];
  status: "pending" | "active" | "suspended";
  invited_at: string;
  accepted_at: string | null;
}

export interface WorkspaceAccess {
  platformRole: PlatformRole | null;
  workspaceRole: WorkspaceRole | null;
  contentPermissions: ContentType[];
  isFullAccess: boolean;
}

function genTempPassword(): string {
  const chars = "ABCDEFGHJKMNPQRSTUVWXYZabcdefghjkmnpqrstuvwxyz23456789!@#$";
  return Array.from({ length: 12 }, () => chars[Math.floor(Math.random() * chars.length)]).join("");
}

// ── List workspace members ─────────────────────────────────────────────────────
export const listWorkspaceMembers = createServerFn({ method: "GET" })
  .validator((input: { workspaceId: string }) => input)
  .handler(async ({ data }): Promise<WorkspaceMember[]> => {
    const { getAdminClient } = await import("./supabase.server");
    const supabase = getAdminClient() as any;
    const { data: rows, error } = await supabase
      .from("workspace_members")
      .select("*")
      .eq("workspace_id", data.workspaceId)
      .order("created_at", { ascending: false });
    if (error) {
      if (error.code === "PGRST204" || error.message?.includes("schema cache")) return [];
      throw new Error(error.message);
    }
    return (rows ?? []) as WorkspaceMember[];
  });

// ── Get current user's workspace role ─────────────────────────────────────────
export const getMyWorkspaceRole = createServerFn({ method: "GET" })
  .validator((input: { workspaceId: string; userId: string }) => input)
  .handler(async ({ data }): Promise<WorkspaceAccess> => {
    const { getAdminClient } = await import("./supabase.server");
    const supabase = getAdminClient() as any;

    const { data: cmsUser } = await supabase
      .from("cms_users")
      .select("platform_role")
      .eq("id", data.userId)
      .maybeSingle();

    const platformRole: PlatformRole = cmsUser?.platform_role ?? "superadmin";

    if (platformRole === "superadmin" || platformRole === "co_admin") {
      return { platformRole, workspaceRole: "workspace_admin", contentPermissions: ["all"], isFullAccess: true };
    }

    const { data: member } = await supabase
      .from("workspace_members")
      .select("workspace_role, content_permissions, status")
      .eq("workspace_id", data.workspaceId)
      .eq("user_id", data.userId)
      .eq("status", "active")
      .maybeSingle();

    if (!member) {
      return { platformRole, workspaceRole: null, contentPermissions: [], isFullAccess: false };
    }

    return {
      platformRole,
      workspaceRole: member.workspace_role as WorkspaceRole,
      contentPermissions: (member.content_permissions ?? ["all"]) as ContentType[],
      isFullAccess: member.workspace_role === "workspace_admin",
    };
  });

// ── Invite workspace member ────────────────────────────────────────────────────
const inviteWorkspaceSchema = z.object({
  workspaceId:        z.string().uuid(),
  email:              z.string().email(),
  name:               z.string().min(1),
  workspaceRole:      z.enum(["workspace_admin", "editor", "viewer"]),
  contentPermissions: z.array(z.string()).default(["all"]),
  loginUrl:           z.string().url(),
  workspaceName:      z.string().optional(),
  inviterName:        z.string().optional(),
});

export const inviteWorkspaceMember = createServerFn({ method: "POST" })
  .validator((input: unknown) => inviteWorkspaceSchema.parse(input))
  .handler(async ({ data }) => {
    const { getAdminClient } = await import("./supabase.server");
    const supabase = getAdminClient() as any;
    const tempPassword = genTempPassword();

    const { data: authData, error: authErr } = await supabase.auth.admin.createUser({
      email: data.email,
      password: tempPassword,
      email_confirm: true,
      user_metadata: { name: data.name, password_change_required: true },
    });

    let userId: string;
    if (authErr) {
      if (!authErr.message.includes("already been registered")) throw new Error(authErr.message);
      const { data: existing } = await supabase.auth.admin.listUsers();
      const found = existing?.users?.find((u: any) => u.email === data.email);
      if (!found) throw new Error("User already exists but could not be located.");
      userId = found.id;
    } else {
      userId = authData.user.id;
    }

    await supabase.from("cms_users").upsert({
      id: userId, email: data.email, name: data.name,
      role: data.workspaceRole === "workspace_admin" ? "admin" : data.workspaceRole,
      platform_role: "member", password_change_required: true,
    }, { onConflict: "id" });

    const { error: memberErr } = await supabase.from("workspace_members").upsert({
      workspace_id: data.workspaceId,
      email: data.email, name: data.name, user_id: userId,
      workspace_role: data.workspaceRole,
      content_permissions: data.contentPermissions,
      status: "active", accepted_at: new Date().toISOString(),
    }, { onConflict: "workspace_id,email" });
    if (memberErr) throw new Error(memberErr.message);

    try {
      await supabase.functions.invoke("send-invite-email", {
        body: { email: data.email, name: data.name, tempPassword, loginUrl: data.loginUrl,
                workspaceName: data.workspaceName, inviterName: data.inviterName },
      });
    } catch (e) { console.warn("Email non-fatal:", e); }

    return { ok: true, userId };
  });

// ── Invite platform user (co-admin) ───────────────────────────────────────────
const invitePlatformSchema = z.object({
  email:        z.string().email(),
  name:         z.string().min(1),
  platformRole: z.enum(["co_admin"]),
  workspaceAssignments: z.array(z.object({
    workspaceId:        z.string().uuid(),
    workspaceRole:      z.enum(["workspace_admin", "editor", "viewer"]),
    contentPermissions: z.array(z.string()).default(["all"]),
    workspaceName:      z.string().optional(),
  })).default([]),
  loginUrl:    z.string().url(),
  inviterName: z.string().optional(),
});

export const invitePlatformUser = createServerFn({ method: "POST" })
  .validator((input: unknown) => invitePlatformSchema.parse(input))
  .handler(async ({ data }) => {
    const { getAdminClient } = await import("./supabase.server");
    const supabase = getAdminClient() as any;
    const tempPassword = genTempPassword();

    const { data: authData, error: authErr } = await supabase.auth.admin.createUser({
      email: data.email,
      password: tempPassword,
      email_confirm: true,
      user_metadata: { name: data.name, password_change_required: true },
    });

    let userId: string;
    if (authErr) {
      if (!authErr.message.includes("already been registered")) throw new Error(authErr.message);
      const { data: existing } = await supabase.auth.admin.listUsers();
      const found = existing?.users?.find((u: any) => u.email === data.email);
      if (!found) throw new Error("User already exists but could not be located.");
      userId = found.id;
    } else {
      userId = authData.user.id;
    }

    await supabase.from("cms_users").upsert({
      id: userId, email: data.email, name: data.name,
      role: "admin", platform_role: data.platformRole, password_change_required: true,
    }, { onConflict: "id" });

    for (const ws of data.workspaceAssignments) {
      await supabase.from("workspace_members").upsert({
        workspace_id: ws.workspaceId, email: data.email, name: data.name, user_id: userId,
        workspace_role: ws.workspaceRole, content_permissions: ws.contentPermissions,
        status: "active", accepted_at: new Date().toISOString(),
      }, { onConflict: "workspace_id,email" });
    }

    try {
      await supabase.functions.invoke("send-invite-email", {
        body: { email: data.email, name: data.name, tempPassword, loginUrl: data.loginUrl,
                inviterName: data.inviterName },
      });
    } catch (e) { console.warn("Email non-fatal:", e); }

    return { ok: true, userId };
  });

// ── Update workspace member ────────────────────────────────────────────────────
export const updateWorkspaceMember = createServerFn({ method: "POST" })
  .validator((input: { memberId: string; workspaceRole: WorkspaceRole; contentPermissions: ContentType[] }) => input)
  .handler(async ({ data }) => {
    const { getAdminClient } = await import("./supabase.server");
    const supabase = getAdminClient() as any;
    const { error } = await supabase
      .from("workspace_members")
      .update({ workspace_role: data.workspaceRole, content_permissions: data.contentPermissions, updated_at: new Date().toISOString() })
      .eq("id", data.memberId);
    if (error) throw new Error(error.message);
    return { ok: true };
  });

// ── Remove workspace member ────────────────────────────────────────────────────
export const removeWorkspaceMember = createServerFn({ method: "POST" })
  .validator((input: { memberId: string }) => input)
  .handler(async ({ data }) => {
    const { getAdminClient } = await import("./supabase.server");
    const supabase = getAdminClient() as any;
    const { error } = await supabase.from("workspace_members").delete().eq("id", data.memberId);
    if (error) throw new Error(error.message);
    return { ok: true };
  });

// ── Resend workspace invite ────────────────────────────────────────────────────
const resendInviteSchema = z.object({
  memberId:      z.string().uuid(),
  loginUrl:      z.string().url(),
  workspaceName: z.string().optional(),
  inviterName:   z.string().optional(),
});

export const resendWorkspaceInvite = createServerFn({ method: "POST" })
  .validator((input: unknown) => resendInviteSchema.parse(input))
  .handler(async ({ data }) => {
    const { getAdminClient } = await import("./supabase.server");
    const supabase = getAdminClient() as any;

    const { data: member, error: memberErr } = await supabase
      .from("workspace_members")
      .select("email, name, user_id")
      .eq("id", data.memberId)
      .single();
    if (memberErr || !member) throw new Error("Member not found");

    const tempPassword = genTempPassword();

    if (member.user_id) {
      const { error: pwErr } = await supabase.auth.admin.updateUserById(member.user_id, {
        password: tempPassword,
        user_metadata: { password_change_required: true },
      });
      if (pwErr) throw new Error(pwErr.message);
      await supabase.from("cms_users").update({ password_change_required: true }).eq("id", member.user_id);
    }

    try {
      await supabase.functions.invoke("send-invite-email", {
        body: {
          email: member.email,
          name: member.name,
          tempPassword,
          loginUrl: data.loginUrl,
          workspaceName: data.workspaceName,
          inviterName: data.inviterName,
        },
      });
    } catch (e) { console.warn("Resend email non-fatal:", e); }

    return { ok: true };
  });

// ── Mark password changed ──────────────────────────────────────────────────────
export const markPasswordChanged = createServerFn({ method: "POST" })
  .validator((input: { userId: string }) => input)
  .handler(async ({ data }) => {
    const { getAdminClient } = await import("./supabase.server");
    const supabase = getAdminClient() as any;
    await supabase.from("cms_users").update({ password_change_required: false }).eq("id", data.userId);
    return { ok: true };
  });
