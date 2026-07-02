import { createFileRoute, Link } from "@tanstack/react-router";
import { queryOptions, useSuspenseQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { useState } from "react";
import { toast } from "sonner";
import { Plus, Pencil, Trash2, Clock, Eye, Send, BarChart2 } from "lucide-react";
import { adminListPosts, deletePost, setPostStatus } from "@/lib/blog.functions";
import { formatBlogDate, type BlogPostSummary } from "@/lib/blog-types";
import { cn } from "@/lib/utils";
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
} from "@/components/ui/alert-dialog";

const listQuery = queryOptions({
  queryKey: ["admin", "blog_posts"],
  queryFn: () => adminListPosts(),
});

export const Route = createFileRoute("/admin/workspaces/$id/blogs")({
  loader: ({ context }) => context.queryClient.ensureQueryData(listQuery),
  component: WorkspaceBlogs,
  errorComponent: ({ error }) => <p className="p-8 text-sm text-red-600">{error.message}</p>,
});

const STATUS_STYLE: Record<string, string> = {
  published: "text-emerald-600",
  draft: "text-muted-foreground",
  scheduled: "text-amber-600",
};

function WorkspaceBlogs() {
  const { data: posts } = useSuspenseQuery(listQuery);
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
            <span className="w-16 shrink-0 hidden lg:block text-right">Views</span>
            <span className="w-16 shrink-0 text-right">Actions</span>
          </div>

          {posts.map((post) => (
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

              {/* Views */}
              <span className="w-16 shrink-0 text-right text-xs tabular-nums text-muted-foreground hidden lg:flex items-center justify-end gap-1">
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
          ))}
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
