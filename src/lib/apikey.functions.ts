import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";

export interface ApiKey {
  id: string;
  name: string;
  key_prefix: string;
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
      .select("id, name, key_prefix, created_at, last_used_at, revoked_at")
      .order("created_at", { ascending: false });
    if (error) {
      if (error.message.includes("schema cache") || error.code === "PGRST204") return [];
      throw new Error(error.message);
    }
    return (data ?? []) as ApiKey[];
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
      .update({ revoked_at: new Date().toISOString() })
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

export async function validateApiKey(raw: string): Promise<boolean> {
  const { createHash } = await import("node:crypto");
  const { getAdminClient } = await import("./supabase.server");
  const supabase = await getAdminClient();
  const hash = createHash("sha256").update(raw).digest("hex");
  const { data, error } = await supabase
    .from("api_keys")
    .select("id")
    .eq("key_hash", hash)
    .is("revoked_at", null)
    .maybeSingle();
  if (error || !data) return false;
  await supabase
    .from("api_keys")
    .update({ last_used_at: new Date().toISOString() })
    .eq("id", data.id);
  return true;
}

export const getDashboardStats = createServerFn({ method: "GET" }).handler(
  async () => {
    const { getAdminClient } = await import("./supabase.server");
    const supabase = await getAdminClient();

    const [
      { count: total },
      { count: published },
      { count: drafts },
      { count: scheduled },
      { data: topPosts },
      { data: recent },
    ] = await Promise.all([
      supabase.from("blog_posts").select("*", { count: "exact", head: true }),
      supabase.from("blog_posts").select("*", { count: "exact", head: true }).eq("status", "published"),
      supabase.from("blog_posts").select("*", { count: "exact", head: true }).eq("status", "draft"),
      supabase.from("blog_posts").select("*", { count: "exact", head: true }).eq("status", "scheduled"),
      supabase.from("blog_posts").select("id, title, slug, views, status").eq("status", "published").order("views", { ascending: false }).limit(5),
      supabase.from("blog_posts").select("id, title, status, updated_at").order("updated_at", { ascending: false }).limit(5),
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
    };
  },
);
