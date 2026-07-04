import { createFileRoute, Link, notFound } from "@tanstack/react-router";
import { ChevronLeft } from "lucide-react";
import { BlogPostForm } from "@/components/blog/BlogPostForm";
import { Button } from "@/components/ui/button";
import { adminGetPost } from "@/lib/blog.functions";

export const Route = createFileRoute("/admin/workspaces/$id/blogs/$postId/edit")({
  head: () => ({ meta: [{ title: "Edit Post" }] }),
  loader: async ({ params }) => {
    const post = await adminGetPost({ data: { id: params.postId } });
    if (!post) throw notFound();
    return { post };
  },
  component: WorkspaceEditPost,
  errorComponent: ({ error }) => (
    <div className="px-4 py-4 sm:px-8 sm:py-8">
      <p className="text-sm text-destructive">Failed to load post: {error.message}</p>
    </div>
  ),
  notFoundComponent: () => {
    const { id } = Route.useParams();
    return (
      <div className="px-4 py-4 sm:px-8 sm:py-8 space-y-3">
        <p className="text-muted-foreground">This post could not be found.</p>
        <Button asChild variant="outline">
          <Link to="/admin/workspaces/$id/blogs" params={{ id }}>
            ← Back to Blogs
          </Link>
        </Button>
      </div>
    );
  },
});

function WorkspaceEditPost() {
  const { id: workspaceId, postId } = Route.useParams();
  const { post } = Route.useLoaderData();

  return (
    <div className="space-y-6 px-4 py-4 sm:px-8 sm:py-8">
      <div className="flex items-center gap-3">
        <Button size="icon" variant="ghost" asChild>
          <Link
            to="/admin/workspaces/$id/blogs/$postId"
            params={{ id: workspaceId, postId }}
          >
            <ChevronLeft className="h-5 w-5" />
          </Link>
        </Button>
        <div className="min-w-0">
          <h1 className="text-xl font-bold truncate">{post.title || "Edit Post"}</h1>
          <p className="text-xs text-muted-foreground mt-0.5">
            Editing inside workspace ·{" "}
            <Link
              to="/admin/workspaces/$id/blogs/$postId"
              params={{ id: workspaceId, postId }}
              className="hover:text-foreground transition-colors"
            >
              View details
            </Link>
          </p>
        </div>
      </div>

      {/* Pass workspaceId so the form redirects back to the workspace blog list after save */}
      <BlogPostForm initial={post} workspaceId={workspaceId} />
    </div>
  );
}
