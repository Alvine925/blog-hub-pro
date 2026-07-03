import { createFileRoute, Link } from "@tanstack/react-router";
import { createServerFn } from "@tanstack/react-start";
import { queryOptions, useSuspenseQuery } from "@tanstack/react-query";
import { FileText, FolderOpen, Pencil, ExternalLink } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from "@/components/ui/table";

interface NewsRow {
  id: string;
  workspace_id: string | null;
  title: string;
  slug: string;
  category: string;
  status: string;
  breaking: boolean;
  source_name: string | null;
  updated_at: string;
  workspace: { id: string; name: string } | null;
}

const listAllNews = createServerFn({ method: "GET" }).handler(async (): Promise<NewsRow[]> => {
  const { getAdminClient } = await import("@/lib/supabase.server");
  const db = getAdminClient() as any;
  const { data, error } = await db
    .from("news")
    .select("id,workspace_id,title,slug,category,status,breaking,source_name,updated_at,workspace:workspaces(id,name)")
    .order("updated_at", { ascending: false })
    .limit(500);
  if (error) throw new Error(error.message);
  return data ?? [];
});

const listQuery = queryOptions({
  queryKey: ["admin", "all-news"],
  queryFn: () => listAllNews(),
});

export const Route = createFileRoute("/admin/news/")({
  loader: ({ context }) => context.queryClient.ensureQueryData(listQuery),
  component: AdminNewsList,
  errorComponent: ({ error }) => (
    <p className="text-sm text-destructive p-8">Failed to load news: {error.message}</p>
  ),
});

function fmtDate(d: string) {
  return new Date(d).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" });
}

function StatusBadge({ status }: { status: string }) {
  if (status === "published") return <Badge>published</Badge>;
  return <Badge variant="secondary">{status}</Badge>;
}

function AdminNewsList() {
  const { data: items } = useSuspenseQuery(listQuery);

  return (
    <div className="space-y-6 p-8">
      <div className="flex items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold">News</h1>
          <p className="text-sm text-muted-foreground">
            {items.length} item{items.length === 1 ? "" : "s"} across all workspaces —
            read-only view. Open a workspace to create or edit.
          </p>
        </div>
        <Button asChild variant="outline" size="sm" className="gap-2 shrink-0">
          <Link to="/admin/workspaces">
            <FolderOpen className="h-4 w-4" /> Go to Workspaces
          </Link>
        </Button>
      </div>

      {items.length === 0 ? (
        <div className="flex flex-col items-center justify-center gap-4 py-24 text-center border-t border-border">
          <FileText className="h-10 w-10 text-muted-foreground" />
          <div className="space-y-1">
            <p className="font-medium">No news items yet</p>
            <p className="text-sm text-muted-foreground">Create news items from inside a workspace.</p>
          </div>
          <Button asChild variant="outline" className="gap-2">
            <Link to="/admin/workspaces">
              <FolderOpen className="h-4 w-4" /> Open a Workspace
            </Link>
          </Button>
        </div>
      ) : (
        <div className="overflow-x-auto">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Title</TableHead>
                <TableHead>Workspace</TableHead>
                <TableHead>Category</TableHead>
                <TableHead>Status</TableHead>
                <TableHead>Updated</TableHead>
                <TableHead className="text-right">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {items.map((item) => (
                <TableRow key={item.id}>
                  <TableCell className="max-w-[280px]">
                    <span className="font-medium">{item.title || "Untitled"}</span>
                    {item.breaking && (
                      <Badge variant="destructive" className="ml-2 text-[10px]">Breaking</Badge>
                    )}
                  </TableCell>
                  <TableCell>
                    {item.workspace_id ? (
                      <Link
                        to="/admin/workspaces/$id/news"
                        params={{ id: item.workspace_id }}
                        className="text-sm text-primary hover:underline flex items-center gap-1"
                      >
                        {item.workspace?.name ?? "Workspace"}
                        <ExternalLink className="h-3 w-3" />
                      </Link>
                    ) : (
                      <span className="text-sm text-muted-foreground">—</span>
                    )}
                  </TableCell>
                  <TableCell className="text-sm">{item.category}</TableCell>
                  <TableCell><StatusBadge status={item.status} /></TableCell>
                  <TableCell className="text-sm text-muted-foreground">{fmtDate(item.updated_at)}</TableCell>
                  <TableCell>
                    <div className="flex items-center justify-end gap-1">
                      {item.workspace_id && (
                        <>
                          <Button size="sm" variant="ghost" asChild title="View details" className="gap-1.5 text-xs">
                            <Link
                              to="/admin/workspaces/$id/news/$newsId"
                              params={{ id: item.workspace_id, newsId: item.id }}
                            >
                              View
                            </Link>
                          </Button>
                          <Button size="sm" variant="ghost" asChild title="Edit in workspace" className="gap-1.5 text-xs">
                            <Link
                              to="/admin/workspaces/$id/news/$newsId/edit"
                              params={{ id: item.workspace_id, newsId: item.id }}
                            >
                              <Pencil className="h-3.5 w-3.5" /> Edit
                            </Link>
                          </Button>
                        </>
                      )}
                    </div>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      )}

      <div className="rounded-xl border border-border/60 bg-muted/20 px-4 py-3">
        <p className="text-xs text-muted-foreground">
          <span className="font-semibold text-foreground">This is a read-only view.</span>{" "}
          To create, edit, or publish news, navigate to its workspace. Click <strong>View</strong> to see details or <strong>Edit</strong> to open the editor.
        </p>
      </div>
    </div>
  );
}
