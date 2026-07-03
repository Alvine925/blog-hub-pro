import { createFileRoute, Outlet } from "@tanstack/react-router";

export const Route = createFileRoute("/admin/workspaces/$id/articles")({
  component: () => <Outlet />,
});
