import { createFileRoute, Outlet } from "@tanstack/react-router";

export const Route = createFileRoute("/admin/workspaces/$id/blogs/$postId")({
  component: () => <Outlet />,
});
