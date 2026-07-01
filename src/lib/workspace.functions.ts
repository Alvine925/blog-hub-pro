import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";

export interface Workspace {
  id: string;
  name: string;
  slug: string;
  description: string | null;
  created_at: string;
  updated_at: string;
}

function slugify(s: string): string {
  return s.toLowerCase().trim().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");
}

export const listWorkspaces = createServerFn({ method: "GET" }).handler(
  async (): Promise<Workspace[]> => {
    const { getAdminClient } = await import("./supabase.server");
    const supabase = await getAdminClient();
    const { data, error } = await supabase
      .from("workspaces")
      .select("*")
      .order("created_at", { ascending: true });
    if (error) {
      if (error.message.includes("schema cache") || error.code === "PGRST204") return [];
      throw new Error(error.message);
    }
    return (data ?? []) as Workspace[];
  },
);

export const createWorkspace = createServerFn({ method: "POST" })
  .validator((input: { name: string; description?: string }) =>
    z.object({ name: z.string().trim().min(1).max(100), description: z.string().max(500).optional() }).parse(input),
  )
  .handler(async ({ data }): Promise<Workspace> => {
    const { getAdminClient } = await import("./supabase.server");
    const supabase = await getAdminClient();
    const slug = slugify(data.name);
    const { data: row, error } = await supabase
      .from("workspaces")
      .insert({ name: data.name, slug, description: data.description ?? null })
      .select("*")
      .single();
    if (error) throw new Error(error.message);
    return row as Workspace;
  });

export const updateWorkspace = createServerFn({ method: "POST" })
  .validator((input: { id: string; name: string; description?: string }) =>
    z.object({ id: z.string().uuid(), name: z.string().trim().min(1).max(100), description: z.string().max(500).optional() }).parse(input),
  )
  .handler(async ({ data }): Promise<{ ok: true }> => {
    const { getAdminClient } = await import("./supabase.server");
    const supabase = await getAdminClient();
    const { error } = await supabase
      .from("workspaces")
      .update({ name: data.name, description: data.description ?? null, updated_at: new Date().toISOString() })
      .eq("id", data.id);
    if (error) throw new Error(error.message);
    return { ok: true };
  });

export const deleteWorkspace = createServerFn({ method: "POST" })
  .validator((input: { id: string }) => z.object({ id: z.string().uuid() }).parse(input))
  .handler(async ({ data }): Promise<{ ok: true }> => {
    const { getAdminClient } = await import("./supabase.server");
    const supabase = await getAdminClient();
    const { error } = await supabase.from("workspaces").delete().eq("id", data.id);
    if (error) throw new Error(error.message);
    return { ok: true };
  });
