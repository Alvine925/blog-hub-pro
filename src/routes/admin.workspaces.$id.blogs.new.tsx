import { createFileRoute, Link } from "@tanstack/react-router";
import { ChevronLeft } from "lucide-react";
import { BlogPostForm } from "@/components/blog/BlogPostForm";
import { Button } from "@/components/ui/button";

export const Route = createFileRoute("/admin/workspaces/$id/blogs/new")({
  head: () => ({ meta: [{ title: "New Post — Workspace" }] }),
  component: WorkspaceNewPost,
});

function WorkspaceNewPost() {
  const { id } = Route.useParams();
  return (
    <div className="space-y-6 px-8 py-8">
      <div className="flex items-center gap-3">
        <Button size="icon" variant="ghost" asChild>
          <Link to="/admin/workspaces/$id/blogs" params={{ id }}>
            <ChevronLeft className="h-5 w-5" />
          </Link>
        </Button>
        <h1 className="text-2xl font-bold">New Post</h1>
      </div>
      <BlogPostForm workspaceId={id} />
    </div>
  );
}
