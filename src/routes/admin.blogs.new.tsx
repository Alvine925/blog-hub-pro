import { createFileRoute, Link, redirect } from "@tanstack/react-router";
import { FolderOpen, ArrowRight } from "lucide-react";
import { Button } from "@/components/ui/button";

export const Route = createFileRoute("/admin/blogs/new")({
  head: () => ({ meta: [{ title: "New Post — Admin" }] }),
  // Posts must be created inside a workspace, not at the global admin level.
  // Redirect anyone landing here directly to the workspaces list.
  beforeLoad: () => {
    throw redirect({ to: "/admin/workspaces", replace: true });
  },
  component: NewPostRedirect,
});

// Fallback UI shown briefly before the redirect fires
function NewPostRedirect() {
  return (
    <div className="flex flex-col items-center justify-center gap-5 py-32 text-center">
      <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-muted">
        <FolderOpen className="h-7 w-7 text-muted-foreground" />
      </div>
      <div className="space-y-1 max-w-sm">
        <h2 className="text-lg font-semibold">Open a workspace to create a post</h2>
        <p className="text-sm text-muted-foreground">
          Blog posts live inside workspaces. Select the workspace you want to publish to, then create the post from there.
        </p>
      </div>
      <Button asChild className="gap-2">
        <Link to="/admin/workspaces">
          Go to Workspaces <ArrowRight className="h-4 w-4" />
        </Link>
      </Button>
    </div>
  );
}
