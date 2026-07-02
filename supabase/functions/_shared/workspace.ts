import { createClient } from "jsr:@supabase/supabase-js@2";

export interface Workspace {
  id: string;
  name: string;
  slug: string;
}

export async function resolveWorkspace(
  workspaceId: string,
): Promise<Workspace | null> {
  const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
  const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
  const supabase = createClient(supabaseUrl, serviceKey);

  const { data, error } = await supabase
    .from("workspaces")
    .select("id, name, slug")
    .eq("id", workspaceId)
    .single();

  if (error || !data) return null;
  return data as Workspace;
}

export async function resolveUserWorkspace(
  userId: string,
): Promise<string | null> {
  const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
  const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
  const supabase = createClient(supabaseUrl, serviceKey);

  const { data } = await supabase
    .from("workspaces")
    .select("id")
    .eq("user_id", userId)
    .single();

  if (!data) {
    // Fall back to default workspace
    const { data: def } = await supabase
      .from("workspaces")
      .select("id")
      .eq("slug", "default")
      .single();
    return def?.id ?? null;
  }

  return data.id;
}
