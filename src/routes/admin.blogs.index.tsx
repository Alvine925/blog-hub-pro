import { createFileRoute, Link, useRouter } from "@tanstack/react-router";
import { queryOptions, useSuspenseQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { useState } from "react";
import { toast } from "sonner";
import { Pencil, Trash2, Eye, Send, Undo2, FileText, Clock } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from "@/components/ui/table";
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { adminListPosts, deletePost, setPostStatus } from "@/lib/blog.functions";
import { formatBlogDate, type BlogPostSummary } from "@/lib/blog-types";

const listQuery = queryOptions({
  queryKey: ["admin", "blog_posts"],
  queryFn: () => adminListPosts(),
});

export const Route = createFileRoute("/admin/blogs/")({
  loader: ({ context }) => context.queryClient.ensureQueryData(listQuery),
  component: AdminBlogList,
  errorComponent: ({ error }) => (
    <p className="text-sm text-destructive">Failed to load posts: {error.message}</p>
  ),
});

function StatusBadge({ post }: { post: BlogPostSummary }) {
  if (post.status === "published") return <Badge>published</Badge>;
  if (post.status === "scheduled") {
    return (
      <Badge className="bg-amber-500 text-white hover:bg-amber-500/90 gap-1">
        <Clock className="h-3 w-3" /> scheduled
      </Badge>
    );
  }
  return <Badge variant="secondary">draft</Badge>;
}

function AdminBlogList() {
  const { data: posts } = useSuspenseQuery(listQuery);
  const queryClient = useQueryClient();
  const router = useRouter();
  const del = useServerFn(deletePost);
  const setStatus = useServerFn(setPostStatus);
  const [pendingDelete, setPendingDelete] = useState<BlogPostSummary | null>(null);
  const [busyId, setBusyId] = useState<string | null>(null);

  async function refresh() {
    await queryClient.invalidateQueries({ queryKey: ["admin", "blog_posts"] });
    router.invalidate();
  }

  async function toggleStatus(post: BlogPostSummary) {
    setBusyId(post.id);
    try {
      const next = post.status === "published" ? "draft" : "published";
      await setStatus({ data: { id: post.id, status: next } });
      toast.success(next === "published" ? "Published" : "Unpublished");
      await refresh();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Failed");
    } finally {
      setBusyId(null);
    }
  }

  async function publishNow(post: BlogPostSummary) {
    setBusyId(post.id);
    try {
      await setStatus({ data: { id: post.id, status: "published" } });
      toast.success("Published now");
      await refresh();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Failed");
    } finally {
      setBusyId(null);
    }
  }

  async function confirmDelete() {
    if (!pendingDelete) return;
    setBusyId(pendingDelete.id);
    try {
      await del({ data: { id: pendingDelete.id } });
      toast.success("Post deleted");
      setPendingDelete(null);
      await refresh();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Failed");
    } finally {
      setBusyId(null);
    }
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold">Blogs</h1>
        <p className="text-sm text-muted-foreground">
          {posts.length} post{posts.length === 1 ? "" : "s"} across all workspaces
        </p>
      </div>

      {posts.length === 0 ? (
        <div className="flex flex-col items-center justify-center gap-3 py-24 text-center border-t border-border">
          <FileText className="h-10 w-10 text-muted-foreground" />
          <p className="text-muted-foreground">No blog posts yet. Create posts from inside a workspace.</p>
        </div>
      ) : (
        <div className="overflow-x-auto">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="w-[70px]">Cover</TableHead>
                <TableHead>Title</TableHead>
                <TableHead>Workspace</TableHead>
                <TableHead>Category</TableHead>
                <TableHead>Status</TableHead>
                <TableHead>Date</TableHead>
                <TableHead className="text-right">Views</TableHead>
                <TableHead className="text-right">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {posts.map((post) => (
                <TableRow key={post.id}>
                  <TableCell>
                    {post.cover_image ? (
                      <img src={post.cover_image} alt="" className="h-10 w-14 rounded object-cover" />
                    ) : (
                      <div className="h-10 w-14 rounded bg-muted" />
                    )}
                  </TableCell>
                  <TableCell className="max-w-[280px]">
                    <span className="font-medium">{post.title || "Untitled"}</span>
                    {post.featured && (
                      <Badge variant="outline" className="ml-2">Featured</Badge>
                    )}
                  </TableCell>
                  <TableCell className="text-muted-foreground text-sm">
                    {post.workspace?.name ?? "—"}
                  </TableCell>
                  <TableCell>{post.category}</TableCell>
                  <TableCell><StatusBadge post={post} /></TableCell>
                  <TableCell className="text-muted-foreground text-sm">
                    {post.status === "scheduled" && post.scheduled_at
                      ? `📅 ${formatBlogDate(post.scheduled_at)}`
                      : formatBlogDate(post.published_at) || "—"}
                  </TableCell>
                  <TableCell className="text-right tabular-nums">{post.views}</TableCell>
                  <TableCell>
                    <div className="flex items-center justify-end gap-1">
                      {post.status === "published" && (
                        <Button size="icon" variant="ghost" asChild title="Preview">
                          <Link to="/blogs/$slug" params={{ slug: post.slug }} target="_blank">
                            <Eye className="h-4 w-4" />
                          </Link>
                        </Button>
                      )}
                      {post.status === "scheduled" ? (
                        <Button size="sm" variant="ghost" disabled={busyId === post.id} onClick={() => publishNow(post)} className="text-xs">
                          <Send className="mr-1 h-3.5 w-3.5" /> Publish now
                        </Button>
                      ) : (
                        <Button size="icon" variant="ghost" title={post.status === "published" ? "Unpublish" : "Publish"} disabled={busyId === post.id} onClick={() => toggleStatus(post)}>
                          {post.status === "published"
                            ? <Undo2 className="h-4 w-4" />
                            : <Send className="h-4 w-4" />}
                        </Button>
                      )}
                      <Button size="icon" variant="ghost" asChild title="Edit">
                        <Link to="/admin/blogs/$id" params={{ id: post.id }}>
                          <Pencil className="h-4 w-4" />
                        </Link>
                      </Button>
                      <Button size="icon" variant="ghost" className="text-destructive hover:text-destructive" onClick={() => setPendingDelete(post)}>
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </div>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      )}

      <AlertDialog open={Boolean(pendingDelete)} onOpenChange={(o) => !o && setPendingDelete(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete this post?</AlertDialogTitle>
            <AlertDialogDescription>
              "{pendingDelete?.title}" will be permanently removed. This cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={confirmDelete} className="bg-destructive text-destructive-foreground hover:bg-destructive/90">
              Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
