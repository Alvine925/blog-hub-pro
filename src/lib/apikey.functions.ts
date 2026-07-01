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

function generateKey(): { raw: string; hash: string; prefix: string } {
  const chars = "abcdefghijklmnopqrstuvwxyz0123456789";
  let rand = "";
  for (let i = 0; i < 40; i++) {
    rand += chars[Math.floor(Math.random() * chars.length)];
  }
  const raw = `lc_${rand}`;
  const prefix = raw.slice(0, 10);
  const hash = btoa(raw);
  return { raw, hash, prefix };
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
      // Table doesn't exist yet — migration hasn't been applied
      if (error.message.includes("schema cache") || error.code === "PGRST204") {
        return [];
      }
      throw new Error(error.message);
    }
    return (data ?? []) as ApiKey[];
  },
);

export const createApiKey = createServerFn({ method: "POST" })
  .validator((input: { name: string }) =>
    z.object({ name: z.string().trim().min(1).max(100) }).parse(input),
  )
  .handler(async ({ data }): Promise<{ key: string; id: string }> => {
    const { getAdminClient } = await import("./supabase.server");
    const supabase = await getAdminClient();
    const { raw, hash, prefix } = generateKey();
    const { data: row, error } = await supabase
      .from("api_keys")
      .insert({ name: data.name, key_hash: hash, key_prefix: prefix })
      .select("id")
      .single();
    if (error) throw new Error(error.message);
    return { key: raw, id: row.id };
  });

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
    const { error } = await supabase
      .from("api_keys")
      .delete()
      .eq("id", data.id);
    if (error) throw new Error(error.message);
    return { ok: true };
  });

export async function validateApiKey(raw: string): Promise<boolean> {
  const { getAdminClient } = await import("./supabase.server");
  const supabase = await getAdminClient();
  const hash = btoa(raw);
  const { data, error } = await supabase
    .from("api_keys")
    .select("id")
    .eq("key_hash", hash)
    .is("revoked_at", null)
    .maybeSingle();
  if (error) return false;
  if (!data) return false;
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
      { data: topPosts },
      { data: recent },
    ] = await Promise.all([
      supabase.from("blog_posts").select("*", { count: "exact", head: true }),
      supabase
        .from("blog_posts")
        .select("*", { count: "exact", head: true })
        .eq("status", "published"),
      supabase
        .from("blog_posts")
        .select("*", { count: "exact", head: true })
        .eq("status", "draft"),
      supabase
        .from("blog_posts")
        .select("id, title, slug, views, status")
        .eq("status", "published")
        .order("views", { ascending: false })
        .limit(5),
      supabase
        .from("blog_posts")
        .select("id, title, status, updated_at")
        .order("updated_at", { ascending: false })
        .limit(5),
    ]);

    const totalViews = (topPosts ?? []).reduce(
      (acc: number, p: { views: number }) => acc + (p.views ?? 0),
      0,
    );

    return {
      total: total ?? 0,
      published: published ?? 0,
      drafts: drafts ?? 0,
      totalViews,
      topPosts: (topPosts ?? []) as Array<{
        id: string;
        title: string;
        slug: string;
        views: number;
        status: string;
      }>,
      recent: (recent ?? []) as Array<{
        id: string;
        title: string;
        status: string;
        updated_at: string;
      }>,
    };
  },
);
