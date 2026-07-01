import { createFileRoute, Link, notFound } from "@tanstack/react-router";
import { ChevronLeft } from "lucide-react";
import { BlogPostForm } from "@/components/blog/BlogPostForm";
import { Button } from "@/components/ui/button";
import { adminGetPost } from "@/lib/blog.functions";

export const Route = createFileRoute("/admin/blogs/$id")({
  head: () => ({ meta: [{ title: "Edit Post — Admin" }] }),
  loader: async ({ params }) => {
    const post = await adminGetPost({ data: { id: params.id } });
    if (!post) throw notFound();
    return { post };
  },
  component: EditPost,
  errorComponent: ({ error }) => (
    <p className="text-sm text-destructive">Failed to load post: {error.message}</p>
  ),
  notFoundComponent: () => (
    <div className="space-y-3">
      <p className="text-muted-foreground">This post could not be found.</p>
      <Button asChild variant="outline">
        <Link to="/admin/blogs">Back to Blogs</Link>
      </Button>
    </div>
  ),
});

function EditPost() {
  const { post } = Route.useLoaderData();
  return (
    <div className="space-y-6">
      <div className="flex items-center gap-3">
        <Button size="icon" variant="ghost" asChild>
          <Link to="/admin/blogs">
            <ChevronLeft className="h-5 w-5" />
          </Link>
        </Button>
        <h1 className="text-2xl font-bold">Edit Post</h1>
      </div>
      <BlogPostForm initial={post} />
    </div>
  );
}
