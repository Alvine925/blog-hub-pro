import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";

export interface PostVersion {
  id: string;
  post_id: string;
  title: string;
  excerpt: string;
  status: string;
  author_name: string;
  snapshot: Record<string, unknown>;
  created_at: string;
}

export const listPostVersions = createServerFn({ method: "GET" })
  .validator((input: { postId: string }) =>
    z.object({ postId: z.string().uuid() }).parse(input),
  )
  .handler(async ({ data }): Promise<PostVersion[]> => {
    const { getAdminClient } = await import("./supabase.server");
    const supabase = await getAdminClient();
    const { data: rows, error } = await supabase
      .from("post_versions")
      .select("*")
      .eq("post_id", data.postId)
      .order("created_at", { ascending: false })
      .limit(20);
    if (error) {
      if (error.code === "PGRST204" || error.message.includes("schema cache")) return [];
      throw new Error(error.message);
    }
    return (rows ?? []) as PostVersion[];
  });

export const deletePostVersion = createServerFn({ method: "POST" })
  .validator((input: { id: string }) => z.object({ id: z.string().uuid() }).parse(input))
  .handler(async ({ data }): Promise<{ ok: true }> => {
    const { getAdminClient } = await import("./supabase.server");
    const supabase = await getAdminClient();
    const { error } = await supabase.from("post_versions").delete().eq("id", data.id);
    if (error) throw new Error(error.message);
    return { ok: true };
  });
