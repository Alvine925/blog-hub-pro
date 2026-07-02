import { createFileRoute, Link } from "@tanstack/react-router";
import { createServerFn } from "@tanstack/react-start";
import { queryOptions, useSuspenseQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { useState } from "react";
import { toast } from "sonner";
import { Plus, Pencil, Trash2, Clock, Eye, Send, BarChart2, Heart, MessageSquare, Share2 } from "lucide-react";
import { adminListPosts, deletePost, setPostStatus } from "@/lib/blog.functions";
import { formatBlogDate, type BlogPostSummary } from "@/lib/blog-types";
import { cn } from "@/lib/utils";
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
} from "@/components/ui/alert-dialog";

// ── Engagement counts server fn ───────────────────────────────────────────────
interface EngagementMap {
  [postId: string]: { likes: number; comments: number; shares: number };
}

const getEngagementCounts = createServerFn({ method: "GET" })
  .validator((input: { workspaceId: string }) => input)
  .handler(async ({ data }): Promise<EngagementMap> => {
    const { getAdminClient } = await import("../lib/supabase.server");
    const db = getAdminClient() as any;

    const [likesRes, commentsRes, sharesRes] = await Promise.all([
      db.from("blog_likes")
        .select("blog_post_id")
        .eq("workspace_id", data.workspaceId),
      db.from("blog_comments")
        .select("blog_post_id")
        .eq("workspace_id", data.workspaceId)
        .eq("status", "approved"),
      db.from("blog_shares")
        .select("blog_post_id")
        .eq("workspace_id", data.workspaceId),
    ]);

    const map: EngagementMap = {};

    const tally = (rows: { blog_post_id: string }[] | null, key: "likes" | "comments" | "shares") => {
      for (const r of rows ?? []) {
        if (!map[r.blog_post_id]) map[r.blog_post_id] = { likes: 0, comments: 0, shares: 0 };
        map[r.blog_post_id][key]++;
      }
    };

    tally(likesRes.data, "likes");
    tally(commentsRes.data, "comments");
    tally(sharesRes.data, "shares");

    return map;
  });

// ── Queries ───────────────────────────────────────────────────────────────────
const listQuery = queryOptions({
  queryKey: ["admin", "blog_posts"],
  queryFn: () => adminListPosts(),
});

const engagementQuery = (workspaceId: string) =>
  queryOptions({
    queryKey: ["admin", "blog_engagement_counts", workspaceId],
    queryFn: () => getEngagementCounts({ data: { workspaceId } }),
    staleTime: 60_000,
  });

export const Route = createFileRoute("/admin/workspaces/$id/blogs")({
  loader: ({ context, params }) =>
    Promise.all([
      context.queryClient.ensureQueryData(listQuery),
      context.queryClient.ensureQueryData(engagementQuery(params.id)),
    ]),
  component: WorkspaceBlogs,
  errorComponent: ({ error }) => <p className="p-8 text-sm text-red-600">{error.message}</p>,
});

const STATUS_STYLE: Record<string, string> = {
  published: "text-emerald-600",
  draft: "text-muted-foreground",
  scheduled: "text-amber-600",
};

function WorkspaceBlogs() {
  const { id: workspaceId } = Route.useParams();
  const { data: posts } = useSuspenseQuery(listQuery);
  const { data: engagement } = useSuspenseQuery(engagementQuery(workspaceId));
  const queryClient = useQueryClient();
  const doDelete = useServerFn(deletePost);
  const doStatus = useServerFn(setPostStatus);
  const [pendingDelete, setPendingDelete] = useState<BlogPostSummary | null>(null);
  const [busy, setBusy] = useState(false);

  async function handleDelete() {
    if (!pendingDelete) return;
    setBusy(true);
    try {
      await doDelete({ data: { id: pendingDelete.id } });
      toast.success("Post deleted");
      setPendingDelete(null);
      await queryClient.invalidateQueries({ queryKey: ["admin", "blog_posts"] });
    } catch (e) { toast.error(e instanceof Error ? e.message : "Failed"); }
    finally { setBusy(false); }
  }

  async function togglePublish(post: BlogPostSummary) {
    const next = post.status === "published" ? "draft" : "published";
    try {
      await doStatus({ data: { id: post.id, status: next } });
      toast.success(`Post ${next}`);
      await queryClient.invalidateQueries({ queryKey: ["admin", "blog_posts"] });
    } catch (e) { toast.error(e instanceof Error ? e.message : "Failed"); }
  }

  return (
    <div className="min-h-full px-8 py-8">
      {/* Header */}
      <div className="mb-8 flex items-center justify-between">
        <div>
          <h1 className="text-xl font-semibold">Blogs</h1>
          <p className="mt-0.5 text-sm text-muted-foreground">{posts.length} posts total</p>
        </div>
        <Link
          to="/admin/blogs/new"
          className="flex items-center gap-1.5 rounded-md bg-primary px-3 py-1.5 text-sm font-medium text-primary-foreground hover:bg-primary/90 transition-colors"
        >
          <Plus className="h-3.5 w-3.5" /> New Post
        </Link>
      </div>

      {/* Table */}
      {posts.length === 0 ? (
        <div className="flex flex-col items-center gap-3 py-20 border-y border-border text-center">
          <p className="text-sm text-muted-foreground">No posts yet.</p>
          <Link
            to="/admin/blogs/new"
            className="flex items-center gap-1.5 text-sm font-medium text-primary hover:underline"
          >
            <Plus className="h-3.5 w-3.5" /> Write your first post
          </Link>
        </div>
      ) : (
        <div>
          {/* Column headers */}
          <div className="flex items-center gap-3 border-b border-border pb-2 text-[10px] font-semibold uppercase tracking-widest text-muted-foreground/60">
            <span className="flex-1">Title</span>
            <span className="w-20 shrink-0 hidden sm:block">Status</span>
            <span className="w-24 shrink-0 hidden md:block">Updated</span>
            <span className="w-28 shrink-0 hidden lg:flex items-center gap-3 justify-end">Engagement</span>
            <span className="w-16 shrink-0 hidden xl:block text-right">Views</span>
            <span className="w-24 shrink-0 text-right">Actions</span>
          </div>

          {posts.map((post) => {
            const eng = engagement[post.id] ?? { likes: 0, comments: 0, shares: 0 };
            return (
              <div key={post.id} className="group flex items-center gap-3 border-b border-border py-3 last:border-0">
                {/* Title */}
                <div className="flex-1 min-w-0">
                  <Link
                    to="/admin/blogs/$id"
                    params={{ id: post.id }}
                    className="block truncate text-sm font-medium hover:text-primary transition-colors"
                  >
                    {post.title || "Untitled"}
                  </Link>
                  {post.category && (
                    <span className="text-xs text-muted-foreground">{post.category}</span>
                  )}
                </div>

                {/* Status */}
                <span className={cn("w-20 shrink-0 text-xs hidden sm:block", STATUS_STYLE[post.status])}>
                  {post.status === "scheduled" && <Clock className="inline mr-1 h-3 w-3" />}
                  {post.status}
                </span>

                {/* Date */}
                <span className="w-24 shrink-0 text-xs text-muted-foreground hidden md:block">
                  {formatBlogDate(post.updated_at)}
                </span>

                {/* Engagement: likes · comments · shares */}
                <div className="w-28 shrink-0 hidden lg:flex items-center justify-end gap-3">
                  <span
                    className="flex items-center gap-1 text-xs tabular-nums text-muted-foreground"
                    title={`${eng.likes} like${eng.likes !== 1 ? "s" : ""}`}
                  >
                    <Heart className={cn("h-3 w-3", eng.likes > 0 ? "text-rose-400" : "")} />
                    {eng.likes}
                  </span>
                  <span
                    className="flex items-center gap-1 text-xs tabular-nums text-muted-foreground"
                    title={`${eng.comments} approved comment${eng.comments !== 1 ? "s" : ""}`}
                  >
                    <MessageSquare className={cn("h-3 w-3", eng.comments > 0 ? "text-blue-400" : "")} />
                    {eng.comments}
                  </span>
                  <span
                    className="flex items-center gap-1 text-xs tabular-nums text-muted-foreground"
                    title={`${eng.shares} share${eng.shares !== 1 ? "s" : ""}`}
                  >
                    <Share2 className={cn("h-3 w-3", eng.shares > 0 ? "text-violet-400" : "")} />
                    {eng.shares}
                  </span>
                </div>

                {/* Views */}
                <span className="w-16 shrink-0 text-right text-xs tabular-nums text-muted-foreground hidden xl:flex items-center justify-end gap-1">
                  <Eye className="h-3 w-3" />{post.views.toLocaleString()}
                </span>

                {/* Actions */}
                <div className="w-24 shrink-0 flex items-center justify-end gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                  <Link
                    to="/admin/blog-stats/$postId"
                    params={{ postId: post.id }}
                    className="flex h-7 w-7 items-center justify-center rounded text-muted-foreground hover:text-primary hover:bg-primary/10 transition-colors"
                    title="View analytics"
                  >
                    <BarChart2 className="h-3.5 w-3.5" />
                  </Link>
                  <Link
                    to="/admin/blogs/$id"
                    params={{ id: post.id }}
                    className="flex h-7 w-7 items-center justify-center rounded text-muted-foreground hover:text-foreground hover:bg-muted transition-colors"
                    title="Edit"
                  >
                    <Pencil className="h-3.5 w-3.5" />
                  </Link>
                  <button
                    type="button"
                    onClick={() => togglePublish(post)}
                    className="flex h-7 w-7 items-center justify-center rounded text-muted-foreground hover:text-emerald-600 hover:bg-emerald-50 transition-colors"
                    title={post.status === "published" ? "Unpublish" : "Publish"}
                  >
                    <Send className="h-3.5 w-3.5" />
                  </button>
                  <button
                    type="button"
                    onClick={() => setPendingDelete(post)}
                    className="flex h-7 w-7 items-center justify-center rounded text-muted-foreground hover:text-red-600 hover:bg-red-50 transition-colors"
                    title="Delete"
                  >
                    <Trash2 className="h-3.5 w-3.5" />
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Delete dialog */}
      <AlertDialog open={!!pendingDelete} onOpenChange={(o) => !o && setPendingDelete(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete "{pendingDelete?.title || "this post"}"?</AlertDialogTitle>
            <AlertDialogDescription>This action cannot be undone.</AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleDelete}
              disabled={busy}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
