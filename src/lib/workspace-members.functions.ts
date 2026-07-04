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

    // Try to create a brand-new auth user with a temporary password
    const tempPassword = genTempPassword();
    const { data: authData, error: authErr } = await supabase.auth.admin.createUser({
      email: data.email,
      password: tempPassword,
      email_confirm: true,
      user_metadata: { name: data.name, password_change_required: true },
    });

    let userId: string;
    let isExistingUser = false;

    if (authErr) {
      // Only swallow "already registered" — anything else is a real error
      if (!authErr.message.includes("already been registered")) throw new Error(authErr.message);

      // Existing user: locate their id but NEVER reset their password
      const { data: existing } = await supabase.auth.admin.listUsers();
      const found = existing?.users?.find((u: any) => u.email === data.email);
      if (!found) throw new Error("User already exists but could not be located.");
      userId = found.id;
      isExistingUser = true;
    } else {
      userId = authData.user.id;
    }

    // Upsert cms_users — for existing users, only set what's safe to overwrite
    const cmsPayload = isExistingUser
      ? { id: userId, email: data.email, name: data.name }
      : { id: userId, email: data.email, name: data.name,
          role: data.workspaceRole === "workspace_admin" ? "admin" : data.workspaceRole,
          platform_role: "member", password_change_required: true };

    const { error: cmsErr } = await supabase
      .from("cms_users")
      .upsert(cmsPayload, { onConflict: "id" });
    if (cmsErr) throw new Error(`Failed to create user profile: ${cmsErr.message}`);

    // Add to workspace — existing users are activated immediately (they already have a password)
    const { error: memberErr } = await supabase.from("workspace_members").upsert({
      workspace_id: data.workspaceId,
      email: data.email, name: data.name, user_id: userId,
      workspace_role: data.workspaceRole,
      content_permissions: data.contentPermissions,
      status: isExistingUser ? "active" : "pending",
      accepted_at: isExistingUser ? new Date().toISOString() : null,
    }, { onConflict: "workspace_id,email" });
    if (memberErr) throw new Error(memberErr.message);

    // Send the invite email — new users get their temp password, existing users get a notification
    try {
      await supabase.functions.invoke("send-invite-email", {
        body: {
          email: data.email, name: data.name,
          // Omit tempPassword for existing users so the email doesn't include credentials
          ...(isExistingUser ? {} : { tempPassword }),
          loginUrl: data.loginUrl,
          workspaceName: data.workspaceName, inviterName: data.inviterName,
        },
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
    let isExistingUser = false;

    if (authErr) {
      if (!authErr.message.includes("already been registered")) throw new Error(authErr.message);
      // Existing user: locate but NEVER reset their password
      const { data: existing } = await supabase.auth.admin.listUsers();
      const found = existing?.users?.find((u: any) => u.email === data.email);
      if (!found) throw new Error("User already exists but could not be located.");
      userId = found.id;
      isExistingUser = true;
    } else {
      userId = authData.user.id;
    }

    // Only update role/password_change fields for brand-new users
    const cmsPayload = isExistingUser
      ? { id: userId, email: data.email, name: data.name }
      : { id: userId, email: data.email, name: data.name,
          role: "admin", platform_role: data.platformRole, password_change_required: true };

    const { error: cmsErr } = await supabase
      .from("cms_users")
      .upsert(cmsPayload, { onConflict: "id" });
    if (cmsErr) throw new Error(`Failed to create user profile: ${cmsErr.message}`);

    for (const ws of data.workspaceAssignments) {
      await supabase.from("workspace_members").upsert({
        workspace_id: ws.workspaceId, email: data.email, name: data.name, user_id: userId,
        workspace_role: ws.workspaceRole, content_permissions: ws.contentPermissions,
        status: "active", accepted_at: new Date().toISOString(),
      }, { onConflict: "workspace_id,email" });
    }

    try {
      await supabase.functions.invoke("send-invite-email", {
        body: {
          email: data.email, name: data.name,
          ...(isExistingUser ? {} : { tempPassword }),
          loginUrl: data.loginUrl, inviterName: data.inviterName,
        },
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

// ── Suspend workspace member ───────────────────────────────────────────────────
export const suspendWorkspaceMember = createServerFn({ method: "POST" })
  .validator((input: { memberId: string }) => input)
  .handler(async ({ data }) => {
    const { getAdminClient } = await import("./supabase.server");
    const supabase = getAdminClient() as any;
    const { error } = await supabase
      .from("workspace_members")
      .update({ status: "suspended", updated_at: new Date().toISOString() })
      .eq("id", data.memberId);
    if (error) throw new Error(error.message);
    return { ok: true };
  });

// ── Reactivate workspace member ────────────────────────────────────────────────
export const reactivateWorkspaceMember = createServerFn({ method: "POST" })
  .validator((input: { memberId: string }) => input)
  .handler(async ({ data }) => {
    const { getAdminClient } = await import("./supabase.server");
    const supabase = getAdminClient() as any;
    const { error } = await supabase
      .from("workspace_members")
      .update({ status: "active", updated_at: new Date().toISOString() })
      .eq("id", data.memberId);
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
      .select("email, name, user_id, status")
      .eq("id", data.memberId)
      .single();
    if (memberErr || !member) throw new Error("Member not found");

    // Only resend to users who haven't logged in yet — never reset an active user's password
    if (member.status !== "pending") {
      throw new Error("Cannot resend invite: this member has already accepted their invite.");
    }

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
// Clears password_change_required in cms_users after the user sets their own password.
// Accepts the caller's access token to verify identity server-side.
export const markPasswordChanged = createServerFn({ method: "POST" })
  .validator((input: { accessToken: string }) => input)
  .handler(async ({ data }) => {
    const { getAdminClient } = await import("./supabase.server");
    const supabase = getAdminClient() as any;

    const { data: { user }, error: authErr } = await supabase.auth.getUser(data.accessToken);
    if (authErr || !user) throw new Error("Unauthorized");

    await supabase
      .from("cms_users")
      .update({ password_change_required: false })
      .eq("id", user.id);

    return { ok: true };
  });

// ── Track user login ───────────────────────────────────────────────────────────
// Accepts the caller's access token so identity is verified server-side;
// never trusts a client-supplied userId.
export const trackUserLogin = createServerFn({ method: "POST" })
  .validator((input: { accessToken: string }) => input)
  .handler(async ({ data }) => {
    const { getAdminClient } = await import("./supabase.server");
    const supabase = getAdminClient() as any;

    // Verify the JWT and extract the real user id
    const { data: { user }, error: authErr } = await supabase.auth.getUser(data.accessToken);
    if (authErr || !user) throw new Error("Unauthorized");

    const now = new Date().toISOString();

    // Find which pending memberships we're about to activate (to notify admins)
    const { data: pendingRows } = await supabase
      .from("workspace_members")
      .select("workspace_id, name, email")
      .eq("user_id", user.id)
      .eq("status", "pending");

    // Activate any pending workspace memberships (first login only)
    await supabase
      .from("workspace_members")
      .update({ status: "active", accepted_at: now })
      .eq("user_id", user.id)
      .eq("status", "pending");

    // Update last_login_at in cms_users
    await supabase
      .from("cms_users")
      .update({ last_login_at: now })
      .eq("id", user.id);

    // Notify workspace admins for each workspace that was just joined
    const activated = (pendingRows ?? []) as { workspace_id: string; name: string | null; email: string }[];
    if (activated.length > 0) {
      const memberName  = activated[0].name  || activated[0].email || "A team member";
      const memberEmail = activated[0].email || "";

      for (const row of activated) {
        const wsId = row.workspace_id;

        // In-app notification for the workspace
        await supabase.from("notifications").insert({
          workspace_id: wsId,
          type: "member_invited",
          title: `${memberName} accepted their invitation`,
          body: `${memberName} has logged in for the first time and joined the workspace.`,
          action_url: `/admin/workspaces/${wsId}/users`,
          action_label: "View members",
          metadata: { user_id: user.id, member_email: memberEmail },
        });

        // Email: find workspace admins (excluding the member themselves)
        const { data: admins } = await supabase
          .from("workspace_members")
          .select("email, name")
          .eq("workspace_id", wsId)
          .eq("workspace_role", "workspace_admin")
          .eq("status", "active")
          .neq("user_id", user.id);

        const adminRecipients = ((admins ?? []) as { email: string; name: string | null }[])
          .filter((a) => a.email);

        if (adminRecipients.length > 0) {
          try {
            await supabase.functions.invoke("send-transactional-email", {
              body: {
                type: "member_login",
                to: adminRecipients.map((a) => ({ email: a.email, name: a.name ?? undefined })),
                data: {
                  memberName,
                  memberEmail,
                  workspaceName: wsId, // workspace name not in query; admins see the id in the link
                  dashboardUrl: `${process.env.VITE_APP_URL ?? ""}/admin/workspaces/${wsId}/users`,
                },
              },
            });
          } catch (e) {
            console.warn("[trackUserLogin] member_login email non-fatal:", e);
          }
        }
      }
    }

    return { ok: true };
  });

// ── Send welcome email ─────────────────────────────────────────────────────────
// Called after a new user signs up (organic) or an invited user sets their password.
// Accepts accessToken to verify identity server-side — never trusts client-supplied email.
export const sendWelcomeEmail = createServerFn({ method: "POST" })
  .validator((input: {
    accessToken: string;
    type: "welcome" | "welcome_invited";
    workspaceName?: string;
    dashboardUrl?: string;
  }) => input)
  .handler(async ({ data }) => {
    const { getAdminClient } = await import("./supabase.server");
    const supabase = getAdminClient() as any;

    // Verify caller and derive email server-side (never trust client-supplied address)
    const { data: { user }, error: authErr } = await supabase.auth.getUser(data.accessToken);
    if (authErr || !user?.email) return { ok: false }; // non-fatal: skip email if not authed

    const name = user.user_metadata?.name ?? user.user_metadata?.full_name ?? undefined;

    try {
      await supabase.functions.invoke("send-transactional-email", {
        body: {
          type: data.type,
          to: [{ email: user.email, name }],
          data: {
            loginUrl:      `${process.env.VITE_APP_URL ?? ""}/login`,
            workspaceName: data.workspaceName,
            dashboardUrl:  data.dashboardUrl ?? `${process.env.VITE_APP_URL ?? ""}/`,
          },
        },
      });
    } catch (e) {
      console.warn("[sendWelcomeEmail] non-fatal:", e);
    }

    return { ok: true };
  });
