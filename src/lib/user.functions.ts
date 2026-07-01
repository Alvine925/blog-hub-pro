import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";

export type UserRole = "admin" | "editor" | "viewer";

export interface CmsUser {
  id: string;
  email: string;
  name: string | null;
  role: UserRole;
  avatar_url: string | null;
  created_at: string;
  last_login_at: string | null;
}

export interface CmsUserInvite {
  id: string;
  email: string;
  role: UserRole;
  token: string;
  invited_at: string;
  expires_at: string;
  accepted_at: string | null;
}

export const listUsers = createServerFn({ method: "GET" }).handler(
  async (): Promise<CmsUser[]> => {
    const { getAdminClient } = await import("./supabase.server");
    const supabase = await getAdminClient();
    const { data, error } = await supabase
      .from("cms_users")
      .select("*")
      .order("created_at", { ascending: false });
    if (error) {
      if (error.message.includes("schema cache") || error.code === "PGRST204") return [];
      throw new Error(error.message);
    }
    return (data ?? []) as CmsUser[];
  },
);

export const listInvites = createServerFn({ method: "GET" }).handler(
  async (): Promise<CmsUserInvite[]> => {
    const { getAdminClient } = await import("./supabase.server");
    const supabase = await getAdminClient();
    const { data, error } = await supabase
      .from("cms_user_invites")
      .select("*")
      .is("accepted_at", null)
      .order("invited_at", { ascending: false });
    if (error) {
      if (error.message.includes("schema cache") || error.code === "PGRST204") return [];
      throw new Error(error.message);
    }
    return (data ?? []) as CmsUserInvite[];
  },
);

export const inviteUser = createServerFn({ method: "POST" })
  .validator((input: { email: string; role: UserRole }) =>
    z.object({ email: z.string().email(), role: z.enum(["admin", "editor", "viewer"]) }).parse(input),
  )
  .handler(async ({ data }): Promise<CmsUserInvite> => {
    const { getAdminClient } = await import("./supabase.server");
    const supabase = await getAdminClient();
    const { data: row, error } = await supabase
      .from("cms_user_invites")
      .insert({ email: data.email, role: data.role })
      .select("*")
      .single();
    if (error) throw new Error(error.message);
    return row as CmsUserInvite;
  });

export const updateUserRole = createServerFn({ method: "POST" })
  .validator((input: { id: string; role: UserRole }) =>
    z.object({ id: z.string().uuid(), role: z.enum(["admin", "editor", "viewer"]) }).parse(input),
  )
  .handler(async ({ data }): Promise<{ ok: true }> => {
    const { getAdminClient } = await import("./supabase.server");
    const supabase = await getAdminClient();
    const { error } = await supabase.from("cms_users").update({ role: data.role }).eq("id", data.id);
    if (error) throw new Error(error.message);
    return { ok: true };
  });

export const removeUser = createServerFn({ method: "POST" })
  .validator((input: { id: string }) => z.object({ id: z.string().uuid() }).parse(input))
  .handler(async ({ data }): Promise<{ ok: true }> => {
    const { getAdminClient } = await import("./supabase.server");
    const supabase = await getAdminClient();
    const { error } = await supabase.from("cms_users").delete().eq("id", data.id);
    if (error) throw new Error(error.message);
    return { ok: true };
  });

export const revokeInvite = createServerFn({ method: "POST" })
  .validator((input: { id: string }) => z.object({ id: z.string().uuid() }).parse(input))
  .handler(async ({ data }): Promise<{ ok: true }> => {
    const { getAdminClient } = await import("./supabase.server");
    const supabase = await getAdminClient();
    const { error } = await supabase.from("cms_user_invites").delete().eq("id", data.id);
    if (error) throw new Error(error.message);
    return { ok: true };
  });
