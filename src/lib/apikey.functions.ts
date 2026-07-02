import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";

export interface ApiKey {
  id: string;
  name: string;
  description: string | null;
  key_prefix: string;
  key_type: "publishable" | "secret";
  permissions: string[];
  status: "active" | "revoked" | "expired";
  expires_at: string | null;
  created_at: string;
  last_used_at: string | null;
  revoked_at: string | null;
}

export const listApiKeys = createServerFn({ method: "GET" }).handler(
  async (): Promise<ApiKey[]> => {
    const { getAdminClient } = await import("./supabase.server");
    const supabase = await getAdminClient();
    const { data, error } = await supabase
      .from("api_keys")
      .select(
        "id, name, description, key_prefix, key_type, permissions, status, expires_at, created_at, last_used_at, revoked_at",
      )
      .order("created_at", { ascending: false });
    if (error) {
      if (error.message.includes("schema cache") || error.code === "PGRST204") return [];
      throw new Error(error.message);
    }
    return (data ?? []).map((row: Record<string, unknown>) => ({
      id: row.id as string,
      name: row.name as string,
      description: (row.description ?? null) as string | null,
      key_prefix: row.key_prefix as string,
      key_type: ((row.key_type as string) === "secret" ? "secret" : "publishable") as "publishable" | "secret",
      permissions: Array.isArray(row.permissions)
        ? (row.permissions as string[])
        : ["read:blogs", "read:pages", "read:media", "read:collections"],
      // Treat old revoked_at as revoked for backward compat
      status: (row.revoked_at && row.status !== "revoked"
        ? "revoked"
        : (row.status as string) ?? "active") as "active" | "revoked" | "expired",
      expires_at: (row.expires_at ?? null) as string | null,
      created_at: row.created_at as string,
      last_used_at: (row.last_used_at ?? null) as string | null,
      revoked_at: (row.revoked_at ?? null) as string | null,
    }));
  },
);

export const revokeApiKey = createServerFn({ method: "POST" })
  .validator((input: { id: string }) =>
    z.object({ id: z.string().uuid() }).parse(input),
  )
  .handler(async ({ data }): Promise<{ ok: true }> => {
    const { getAdminClient } = await import("./supabase.server");
    const supabase = await getAdminClient();
    const { error } = await supabase
      .from("api_keys")
      .update({
        status: "revoked",
        revoked_at: new Date().toISOString(), // keep backward compat
      })
      .eq("id", data.id);
    if (error) throw new Error(error.message);
    return { ok: true };
  });

export const deleteApiKey = createServerFn({ method: "POST" })
  .validator((input: { id: string }) =>
    z.object({ id: z.string().uuid() }).parse(input),
  )
  .handler(async ({ data }): Promise<{ ok: true }> => {
    const { getAdminClient } = await import("./supabase.server");
    const supabase = await getAdminClient();
    const { error } = await supabase.from("api_keys").delete().eq("id", data.id);
    if (error) throw new Error(error.message);
    return { ok: true };
  });

/** Node.js server-side API key validation (used by internal REST handlers). */
export async function validateApiKey(raw: string): Promise<boolean> {
  const { createHash } = await import("node:crypto");
  const { getAdminClient } = await import("./supabase.server");
  const supabase = await getAdminClient();
  const hash = createHash("sha256").update(raw).digest("hex");
  const { data, error } = await supabase
    .from("api_keys")
    .select("id, status, revoked_at, expires_at")
    .eq("key_hash", hash)
    .maybeSingle();
  if (error || !data) return false;
  // Check new status column, fall back to revoked_at for pre-migration rows
  const isRevoked = data.status === "revoked" || Boolean(data.revoked_at);
  const isExpired = data.expires_at && new Date(data.expires_at) <= new Date();
  if (isRevoked || isExpired) return false;
  await supabase
    .from("api_keys")
    .update({ last_used_at: new Date().toISOString() })
    .eq("id", data.id);
  return true;
}

// ── Dashboard & analytics stats ───────────────────────────────────────────────

export const getDashboardStats = createServerFn({ method: "GET" }).handler(
  async () => {
    const { getAdminClient } = await import("./supabase.server");
    const supabase = await getAdminClient();

    const today = new Date().toISOString().slice(0, 10);

    const [
      { count: total },
      { count: published },
      { count: drafts },
      { count: scheduled },
      { data: topPosts },
      { data: recent },
      { count: apiRequestsToday },
      { count: apiErrorsToday },
      { count: activeKeys },
    ] = await Promise.all([
      supabase.from("blog_posts").select("*", { count: "exact", head: true }),
      supabase.from("blog_posts").select("*", { count: "exact", head: true }).eq("status", "published"),
      supabase.from("blog_posts").select("*", { count: "exact", head: true }).eq("status", "draft"),
      supabase.from("blog_posts").select("*", { count: "exact", head: true }).eq("status", "scheduled"),
      supabase.from("blog_posts").select("id, title, slug, views, status").eq("status", "published").order("views", { ascending: false }).limit(5),
      supabase.from("blog_posts").select("id, title, status, updated_at").order("updated_at", { ascending: false }).limit(5),
      // API stats — graceful fallback if table doesn't exist yet
      supabase.from("api_request_logs").select("*", { count: "exact", head: true }).gte("requested_at", today + "T00:00:00Z").then(r => ({ count: r.count ?? 0 })).catch(() => ({ count: 0 })),
      supabase.from("api_request_logs").select("*", { count: "exact", head: true }).gte("requested_at", today + "T00:00:00Z").gte("status_code", 400).then(r => ({ count: r.count ?? 0 })).catch(() => ({ count: 0 })),
      supabase.from("api_keys").select("*", { count: "exact", head: true }).or("status.eq.active,and(status.is.null,revoked_at.is.null)").then(r => ({ count: r.count ?? 0 })).catch(() => ({ count: 0 })),
    ]);

    const totalViews = (topPosts ?? []).reduce(
      (acc: number, p: { views: number }) => acc + (p.views ?? 0),
      0,
    );

    return {
      total: total ?? 0,
      published: published ?? 0,
      drafts: drafts ?? 0,
      scheduled: scheduled ?? 0,
      totalViews,
      topPosts: (topPosts ?? []) as Array<{ id: string; title: string; slug: string; views: number; status: string }>,
      recent: (recent ?? []) as Array<{ id: string; title: string; status: string; updated_at: string }>,
      apiRequestsToday: (apiRequestsToday ?? 0) as number,
      apiErrorsToday: (apiErrorsToday ?? 0) as number,
      activeKeys: (activeKeys ?? 0) as number,
    };
  },
);
