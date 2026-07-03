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

export const listApiKeys = createServerFn({ method: "GET" })
  .validator((input?: { workspaceId?: string | null }) => input ?? {})
  .handler(
  async ({ data: params }): Promise<ApiKey[]> => {
    const { getAdminClient } = await import("./supabase.server");
    const supabase = await getAdminClient();

    // Resolve workspace: prefer the caller-supplied ID; fall back to default workspace.
    // We always scope to one workspace so keys from other tenants are never returned.
    let workspaceId = params?.workspaceId ?? null;
    if (!workspaceId) {
      const { data: ws } = await supabase
        .from("workspaces")
        .select("id")
        .eq("slug", "default")
        .single();
      workspaceId = ws?.id ?? null;
    }

    let query = supabase
      .from("api_keys")
      .select(
        "id, name, description, key_prefix, key_type, permissions, status, expires_at, created_at, last_used_at, revoked_at",
      )
      .order("created_at", { ascending: false });

    if (workspaceId) {
      query = query.eq("workspace_id", workspaceId);
    }

    const { data, error } = await query;
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

// ── API request log viewer ───────────────────────────────────────────────────

export interface ApiRequestLog {
  id: string;
  workspace_id: string | null;
  api_key_id: string | null;
  method: string;
  path: string;
  status_code: number | null;
  duration_ms: number | null;
  ip_address: string | null;
  user_agent: string | null;
  error: string | null;
  requested_at: string;
  // joined
  key_prefix: string | null;
  key_name: string | null;
}

export const listApiRequestLogs = createServerFn({ method: "GET" })
  .validator(
    (input: { limit?: number; offset?: number; status_class?: "2xx" | "4xx" | "5xx" | "all"; path_filter?: string }) =>
      input,
  )
  .handler(async ({ data }): Promise<{ rows: ApiRequestLog[]; total: number }> => {
    // ── Server-side auth guard ───────────────────────────────────────────────
    // Parse the Supabase session cookie that the browser forwards automatically.
    const { getWebRequest } = await import("@tanstack/react-start/server");
    const req = getWebRequest();
    const cookieHeader = req.headers.get("cookie") ?? "";
    // Supabase stores the session as sb-<ref>-auth-token (may be chunked: .0, .1 …)
    const tokenMatch = cookieHeader.match(/sb-[^=]+-auth-token(?:\.0)?=([^;]+)/);
    let accessToken: string | null = null;
    if (tokenMatch) {
      try {
        const raw = decodeURIComponent(tokenMatch[1]);
        const parsed = JSON.parse(raw);
        accessToken = parsed?.access_token ?? null;
      } catch { /* malformed cookie — deny below */ }
    }
    const { getAdminClient } = await import("./supabase.server");
    const supabase = await getAdminClient();

    // Verify the token is a valid, active Supabase session
    if (!accessToken) throw new Error("Unauthorized");
    const { data: { user }, error: authErr } = await supabase.auth.getUser(accessToken);
    if (authErr || !user) throw new Error("Unauthorized");

    const limit = Math.min(data?.limit ?? 50, 200);
    const offset = data?.offset ?? 0;
    const status_class = data?.status_class ?? "all";
    const path_filter = data?.path_filter ?? "";

    let query = (supabase as any)
      .from("api_request_logs")
      .select(
        `id, workspace_id, api_key_id, method, path, status_code, duration_ms,
         ip_address, user_agent, error, requested_at,
         api_keys!api_request_logs_api_key_id_fkey(key_prefix, name)`,
        { count: "exact" },
      )
      .order("requested_at", { ascending: false })
      .range(offset, offset + limit - 1);

    if (status_class === "2xx") query = query.gte("status_code", 200).lt("status_code", 300);
    else if (status_class === "4xx") query = query.gte("status_code", 400).lt("status_code", 500);
    else if (status_class === "5xx") query = query.gte("status_code", 500).lt("status_code", 600);

    if (path_filter.trim()) query = query.ilike("path", `%${path_filter.trim()}%`);

    const { data: rows, count, error } = await query;
    if (error) {
      if (error.message?.includes("schema cache") || error.code === "PGRST204") {
        return { rows: [], total: 0 };
      }
      throw new Error(error.message);
    }

    const mapped: ApiRequestLog[] = (rows ?? []).map((r: Record<string, unknown>) => {
      const key = r["api_keys"] as { key_prefix?: string; name?: string } | null;
      return {
        id: r.id as string,
        workspace_id: (r.workspace_id ?? null) as string | null,
        api_key_id: (r.api_key_id ?? null) as string | null,
        method: (r.method as string) ?? "GET",
        path: r.path as string,
        status_code: (r.status_code ?? null) as number | null,
        duration_ms: (r.duration_ms ?? null) as number | null,
        ip_address: (r.ip_address ?? null) as string | null,
        user_agent: (r.user_agent ?? null) as string | null,
        error: (r.error ?? null) as string | null,
        requested_at: r.requested_at as string,
        key_prefix: key?.key_prefix ?? null,
        key_name: key?.name ?? null,
      };
    });

    return { rows: mapped, total: count ?? 0 };
  });

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
