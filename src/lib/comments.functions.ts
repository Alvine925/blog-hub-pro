import { createServerFn } from "@tanstack/start";
import { createClient }   from "@supabase/supabase-js";

function getAdminClient() {
  const url = process.env.SUPABASE_URL!;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY!;
  return createClient(url, key);
}

export type CommentStatus = "pending" | "approved" | "rejected" | "spam" | "trash";

export interface AdminComment {
  id:          string;
  workspace_id: string;
  post_id:     string;
  parent_id:   string | null;
  name:        string;
  email:       string | null;
  website:     string | null;
  content:     string;
  status:      CommentStatus;
  created_at:  string;
  updated_at:  string;
  // joined
  post_slug?:  string;
  post_title?: string;
}

/** List all comments across all workspaces (admin view — includes email). */
export const listAdminComments = createServerFn({ method: "GET" })
  .validator((d: { status?: CommentStatus; page?: number; limit?: number }) => d)
  .handler(async ({ data }) => {
    const { status, page = 1, limit = 50 } = data;
    const offset = (page - 1) * limit;
    const db = getAdminClient();

    let query = (db as any)
      .from("blog_comments")
      .select(
        "id, workspace_id, post_id, parent_id, name, email, website, content, status, created_at, updated_at, blog_posts(slug, title)",
        { count: "exact" },
      )
      .is("deleted_at", null)
      .order("created_at", { ascending: false })
      .range(offset, offset + limit - 1);

    if (status) query = query.eq("status", status);

    const { data: rows, count, error } = await query;
    if (error) throw new Error(error.message);

    const comments = (rows ?? []).map((r: Record<string, unknown>) => ({
      id:           r.id,
      workspace_id: r.workspace_id,
      post_id:      r.post_id,
      parent_id:    r.parent_id ?? null,
      name:         r.name,
      email:        r.email ?? null,
      website:      r.website ?? null,
      content:      r.content,
      status:       r.status,
      created_at:   r.created_at,
      updated_at:   r.updated_at,
      post_slug:    (r.blog_posts as Record<string, string> | null)?.slug  ?? null,
      post_title:   (r.blog_posts as Record<string, string> | null)?.title ?? null,
    }));

    return { comments, total: count ?? 0, page, limit };
  });

/** Change comment status (approve / reject / spam / trash / pending). */
export const moderateComment = createServerFn({ method: "POST" })
  .validator((d: { id: string; status: CommentStatus }) => d)
  .handler(async ({ data }) => {
    const { error } = await (getAdminClient() as any)
      .from("blog_comments")
      .update({ status: data.status, updated_at: new Date().toISOString() })
      .eq("id", data.id)
      .is("deleted_at", null);
    if (error) throw new Error(error.message);
    return { ok: true };
  });

/** Permanently hard-delete a comment (bypasses soft-delete). */
export const deleteCommentPermanently = createServerFn({ method: "POST" })
  .validator((d: { id: string }) => d)
  .handler(async ({ data }) => {
    const { error } = await (getAdminClient() as any)
      .from("blog_comments")
      .delete()
      .eq("id", data.id);
    if (error) throw new Error(error.message);
    return { ok: true };
  });

/** Count of comments by status — used for badge counts in the sidebar. */
export const getCommentCounts = createServerFn({ method: "GET" })
  .handler(async () => {
    const db = getAdminClient();
    const statuses: CommentStatus[] = ["pending", "approved", "rejected", "spam", "trash"];
    const counts: Record<string, number> = {};

    await Promise.all(
      statuses.map(async (s) => {
        const { count } = await (db as any)
          .from("blog_comments")
          .select("id", { count: "exact", head: true })
          .eq("status", s)
          .is("deleted_at", null);
        counts[s] = count ?? 0;
      }),
    );

    return counts as Record<CommentStatus, number>;
  });
