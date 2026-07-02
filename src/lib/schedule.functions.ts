import { createServerFn } from "@tanstack/react-start";

export const publishScheduledPosts = createServerFn({ method: "POST" }).handler(
  async (): Promise<{ published: number }> => {
    try {
      const { getAdminClient } = await import("./supabase.server");
      const supabase = await getAdminClient();

      const { data: due, error } = await supabase
        .from("blog_posts")
        .select("id, slug, title, category, author_name")
        .eq("status", "scheduled")
        .lte("scheduled_at", new Date().toISOString())
        .not("scheduled_at", "is", null);

      if (error || !due || due.length === 0) return { published: 0 };

      const now = new Date().toISOString();
      const ids = due.map((p: { id: string }) => p.id);

      const { error: updateError } = await supabase
        .from("blog_posts")
        .update({ status: "published", published_at: now, scheduled_at: null })
        .in("id", ids);

      if (!updateError) {
        for (const post of due as Array<{
          id: string;
          slug: string;
          title: string;
          category: string;
          author_name: string;
        }>) {
          import("./webhook.functions").then(({ dispatchWebhooks }) => {
            const payload = {
              id: post.id, slug: post.slug, title: post.title,
              status: "published", category: post.category, author_name: post.author_name,
            };
            dispatchWebhooks("post.published", payload).catch(() => {});
            dispatchWebhooks("cache.invalidate", { ...payload, reason: "scheduled.published" }).catch(() => {});
          });
        }
      }

      return { published: due.length };
    } catch {
      return { published: 0 };
    }
  },
);
