import { createFileRoute, Link } from "@tanstack/react-router";
import { queryOptions, useSuspenseQuery } from "@tanstack/react-query";
import { HelpCircle, FolderOpen, Pencil, ExternalLink } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { adminListFaqs, type Faq } from "@/lib/faq.functions";
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from "@/components/ui/table";

interface FaqWithWorkspace extends Faq {
  workspace?: { id: string; name: string } | null;
}

const listQuery = queryOptions({
  queryKey: ["admin", "all-faqs"],
  queryFn: () => adminListFaqs() as Promise<FaqWithWorkspace[]>,
});

export const Route = createFileRoute("/admin/faqs/")({
  loader: ({ context }) => context.queryClient.ensureQueryData(listQuery),
  component: AdminFaqsList,
  errorComponent: ({ error }) => (
    <p className="text-sm text-destructive p-8">Failed to load FAQs: {error.message}</p>
  ),
});

function fmtDate(d: string) {
  return new Date(d).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" });
}

function StatusBadge({ status }: { status: string }) {
  if (status === "published") return <Badge>published</Badge>;
  return <Badge variant="secondary">{status}</Badge>;
}

function AdminFaqsList() {
  const { data: items } = useSuspenseQuery(listQuery);

  return (
    <div className="space-y-6 p-4 sm:p-8">
      <div className="flex items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold">FAQs</h1>
          <p className="text-sm text-muted-foreground">
            {items.length} FAQ{items.length === 1 ? "" : "s"} across all workspaces —
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
          <HelpCircle className="h-10 w-10 text-muted-foreground" />
          <div className="space-y-1">
            <p className="font-medium">No FAQs yet</p>
            <p className="text-sm text-muted-foreground">Create FAQs from inside a workspace.</p>
          </div>
          <Button asChild variant="outline" className="gap-2">
            <Link to="/admin/workspaces"><FolderOpen className="h-4 w-4" /> Open a Workspace</Link>
          </Button>
        </div>
      ) : (
        <div className="overflow-x-auto sm:overflow-x-visible">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Question</TableHead>
                <TableHead className="hidden md:table-cell">Workspace</TableHead>
                <TableHead className="hidden lg:table-cell">Category</TableHead>
                <TableHead>Status</TableHead>
                <TableHead className="hidden sm:table-cell">Updated</TableHead>
                <TableHead className="text-right">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {items.map((item) => (
                <TableRow key={item.id}>
                  <TableCell className="max-w-[180px] sm:max-w-[300px]">
                    <span className="font-medium line-clamp-2 sm:line-clamp-1">{item.question || "Untitled"}</span>
                  </TableCell>
                  <TableCell className="hidden md:table-cell">
                    {item.workspace_id ? (
                      <Link
                        to="/admin/workspaces/$id/faqs"
                        params={{ id: item.workspace_id }}
                        className="text-sm text-primary hover:underline flex items-center gap-1"
                      >
                        {(item.workspace as any)?.name ?? "Workspace"}
                        <ExternalLink className="h-3 w-3" />
                      </Link>
                    ) : (
                      <span className="text-sm text-muted-foreground">—</span>
                    )}
                  </TableCell>
                  <TableCell className="hidden lg:table-cell text-sm">{item.category}</TableCell>
                  <TableCell><StatusBadge status={item.status} /></TableCell>
                  <TableCell className="hidden sm:table-cell text-sm text-muted-foreground">{fmtDate(item.updated_at)}</TableCell>
                  <TableCell>
                    <div className="flex items-center justify-end gap-1">
                      {item.workspace_id && (
                        <>
                          <Button size="sm" variant="ghost" asChild className="gap-1.5 text-xs hidden sm:inline-flex">
                            <Link to="/admin/workspaces/$id/faqs/$faqId" params={{ id: item.workspace_id, faqId: item.id }}>
                              View
                            </Link>
                          </Button>
                          <Button size="sm" variant="ghost" asChild className="gap-1.5 text-xs">
                            <Link to="/admin/workspaces/$id/faqs/$faqId/edit" params={{ id: item.workspace_id, faqId: item.id }}>
                              <Pencil className="h-3.5 w-3.5" />
                              <span className="hidden sm:inline">Edit</span>
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
          Click <strong>View</strong> to see the FAQ details or <strong>Edit</strong> to open the editor inside its workspace.
        </p>
      </div>
    </div>
  );
}
