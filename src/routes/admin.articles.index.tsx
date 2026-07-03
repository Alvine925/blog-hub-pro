import { createFileRoute, Link } from "@tanstack/react-router";
import { createServerFn } from "@tanstack/react-start";
import { queryOptions, useSuspenseQuery } from "@tanstack/react-query";
import { BookOpen, FolderOpen, Pencil, ExternalLink } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from "@/components/ui/table";

interface ArticleRow {
  id: string;
  workspace_id: string;
  title: string;
  slug: string;
  category: string;
  article_type: string;
  status: string;
  views: number;
  updated_at: string;
  workspace: { id: string; name: string } | null;
}

const listAllArticles = createServerFn({ method: "GET" }).handler(async (): Promise<ArticleRow[]> => {
  const { getAdminClient } = await import("@/lib/supabase.server");
  const db = getAdminClient() as any;
  const { data, error } = await db
    .from("articles")
    .select("id,workspace_id,title,slug,category,article_type,status,views,updated_at,workspace:workspaces(id,name)")
    .order("updated_at", { ascending: false })
    .limit(500);
  if (error) throw new Error(error.message);
  return data ?? [];
});

const listQuery = queryOptions({
  queryKey: ["admin", "all-articles"],
  queryFn: () => listAllArticles(),
});

export const Route = createFileRoute("/admin/articles/")({
  loader: ({ context }) => context.queryClient.ensureQueryData(listQuery),
  component: AdminArticlesList,
  errorComponent: ({ error }) => (
    <p className="text-sm text-destructive p-8">Failed to load articles: {error.message}</p>
  ),
});

const TYPE_LABEL: Record<string, string> = {
  guide: "Guide", tutorial: "Tutorial", "case-study": "Case Study",
  documentation: "Docs", educational: "Educational",
};

function fmtDate(d: string) {
  return new Date(d).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" });
}

function StatusBadge({ status }: { status: string }) {
  if (status === "published") return <Badge>published</Badge>;
  return <Badge variant="secondary">{status}</Badge>;
}

function AdminArticlesList() {
  const { data: items } = useSuspenseQuery(listQuery);

  return (
    <div className="space-y-6 p-8">
      <div className="flex items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold">Articles</h1>
          <p className="text-sm text-muted-foreground">
            {items.length} article{items.length === 1 ? "" : "s"} across all workspaces —
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
          <BookOpen className="h-10 w-10 text-muted-foreground" />
          <div className="space-y-1">
            <p className="font-medium">No articles yet</p>
            <p className="text-sm text-muted-foreground">Create articles from inside a workspace.</p>
          </div>
          <Button asChild variant="outline" className="gap-2">
            <Link to="/admin/workspaces"><FolderOpen className="h-4 w-4" /> Open a Workspace</Link>
          </Button>
        </div>
      ) : (
        <div className="overflow-x-auto">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Title</TableHead>
                <TableHead>Workspace</TableHead>
                <TableHead>Type</TableHead>
                <TableHead>Category</TableHead>
                <TableHead>Status</TableHead>
                <TableHead>Updated</TableHead>
                <TableHead className="text-right">Views</TableHead>
                <TableHead className="text-right">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {items.map((item) => (
                <TableRow key={item.id}>
                  <TableCell className="max-w-[260px]">
                    <span className="font-medium">{item.title || "Untitled"}</span>
                  </TableCell>
                  <TableCell>
                    {item.workspace_id ? (
                      <Link
                        to="/admin/workspaces/$id/articles"
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
                  <TableCell className="text-sm">{TYPE_LABEL[item.article_type] ?? item.article_type}</TableCell>
                  <TableCell className="text-sm">{item.category}</TableCell>
                  <TableCell><StatusBadge status={item.status} /></TableCell>
                  <TableCell className="text-sm text-muted-foreground">{fmtDate(item.updated_at)}</TableCell>
                  <TableCell className="text-right tabular-nums text-sm">{item.views.toLocaleString()}</TableCell>
                  <TableCell>
                    <div className="flex items-center justify-end gap-1">
                      {item.workspace_id && (
                        <>
                          <Button size="sm" variant="ghost" asChild className="gap-1.5 text-xs">
                            <Link to="/admin/workspaces/$id/articles/$articleId" params={{ id: item.workspace_id, articleId: item.id }}>
                              View
                            </Link>
                          </Button>
                          <Button size="sm" variant="ghost" asChild className="gap-1.5 text-xs">
                            <Link to="/admin/workspaces/$id/articles/$articleId/edit" params={{ id: item.workspace_id, articleId: item.id }}>
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
          To create, edit, or publish articles, navigate to its workspace. Click <strong>View</strong> to see details or <strong>Edit</strong> to open the editor.
        </p>
      </div>
    </div>
  );
}
