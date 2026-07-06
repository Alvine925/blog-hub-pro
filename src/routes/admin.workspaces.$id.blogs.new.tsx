import { createFileRoute, Link } from "@tanstack/react-router";
import { useState } from "react";
import { ChevronLeft } from "lucide-react";
import { BlogPostForm } from "@/components/blog/BlogPostForm";
import { Button } from "@/components/ui/button";
import type { BlogPost } from "@/lib/blog-types";

export const Route = createFileRoute("/admin/workspaces/$id/blogs/new")({
  head: () => ({ meta: [{ title: "New Post — Workspace" }] }),
  component: WorkspaceNewPost,
});

function WorkspaceNewPost() {
  const { id } = Route.useParams();

  // Read AI assistant prefill from sessionStorage (set when user clicks "Open as Blog Post")
  const [initial] = useState<Partial<BlogPost> | undefined>(() => {
    try {
      const raw = sessionStorage.getItem("ai_prefill");
      if (!raw) return undefined;
      const data = JSON.parse(raw) as { type: string; title?: string; content?: string };
      if (data.type !== "blog") return undefined;
      sessionStorage.removeItem("ai_prefill");
      return {
        title:   data.title   ?? "",
        content: data.content ?? "",
        excerpt: "",
        status:  "draft",
      } as Partial<BlogPost>;
    } catch {
      return undefined;
    }
  });

  return (
    <div className="space-y-6 px-4 py-4 sm:px-8 sm:py-8">
      <div className="flex items-center gap-3">
        <Button size="icon" variant="ghost" asChild>
          <Link to="/admin/workspaces/$id/blogs" params={{ id }}>
            <ChevronLeft className="h-5 w-5" />
          </Link>
        </Button>
        <h1 className="text-2xl font-bold">New Post</h1>
      </div>
      <BlogPostForm workspaceId={id} initial={initial as BlogPost | undefined} />
    </div>
  );
}
