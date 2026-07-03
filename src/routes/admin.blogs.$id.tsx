import { createFileRoute, Link, redirect, notFound } from "@tanstack/react-router";
import { FolderOpen, ArrowRight } from "lucide-react";
import { Button } from "@/components/ui/button";
import { adminGetPost } from "@/lib/blog.functions";

export const Route = createFileRoute("/admin/blogs/$id")({
  head: () => ({ meta: [{ title: "Edit Post — Admin" }] }),
  loader: async ({ params }) => {
    const post = await adminGetPost({ data: { id: params.id } });
    if (!post) throw notFound();

    // If we know the workspace, redirect straight to the workspace's editor
    if (post.workspace_id) {
      throw redirect({
        to: "/admin/workspaces/$id/blogs/$postId/edit",
        params: { id: post.workspace_id, postId: params.id },
        replace: true,
      });
    }

    // Fallback: post has no workspace — surface a helpful message
    return { post };
  },
  component: EditPostFallback,
  notFoundComponent: () => (
    <div className="space-y-3">
      <p className="text-muted-foreground">This post could not be found.</p>
      <Button asChild variant="outline">
        <Link to="/admin/blogs">Back to Blogs</Link>
      </Button>
    </div>
  ),
});

function EditPostFallback() {
  return (
    <div className="flex flex-col items-center justify-center gap-5 py-32 text-center">
      <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-muted">
        <FolderOpen className="h-7 w-7 text-muted-foreground" />
      </div>
      <div className="space-y-1 max-w-sm">
        <h2 className="text-lg font-semibold">This post has no workspace</h2>
        <p className="text-sm text-muted-foreground">
          The post exists but isn't linked to a workspace. Go to the blog list to find it.
        </p>
      </div>
      <Button asChild className="gap-2">
        <Link to="/admin/blogs">
          <ArrowRight className="h-4 w-4" /> View all posts
        </Link>
      </Button>
    </div>
  );
}
