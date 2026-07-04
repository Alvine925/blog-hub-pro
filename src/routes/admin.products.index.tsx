import { createFileRoute, Link } from "@tanstack/react-router";
import { createServerFn } from "@tanstack/react-start";
import { queryOptions, useSuspenseQuery } from "@tanstack/react-query";
import { Package, FolderOpen, Pencil, ExternalLink } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from "@/components/ui/table";

interface ProductRow {
  id: string;
  workspace_id: string;
  name: string;
  slug: string;
  category: string;
  brand: string;
  price: number | null;
  currency: string;
  status: string;
  views: number;
  updated_at: string;
  workspace: { id: string; name: string } | null;
}

const listAllProducts = createServerFn({ method: "GET" }).handler(async (): Promise<ProductRow[]> => {
  const { getAdminClient } = await import("@/lib/supabase.server");
  const db = getAdminClient() as any;
  const { data, error } = await db
    .from("products")
    .select("id,workspace_id,name,slug,category,brand,price,currency,status,views,updated_at,workspace:workspaces(id,name)")
    .order("updated_at", { ascending: false })
    .limit(500);
  if (error) throw new Error(error.message);
  return data ?? [];
});

const listQuery = queryOptions({
  queryKey: ["admin", "all-products"],
  queryFn: () => listAllProducts(),
});

export const Route = createFileRoute("/admin/products/")({
  loader: ({ context }) => context.queryClient.ensureQueryData(listQuery),
  component: AdminProductsList,
  errorComponent: ({ error }) => (
    <p className="text-sm text-destructive p-8">Failed to load products: {error.message}</p>
  ),
});

function fmtDate(d: string) {
  return new Date(d).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" });
}

function fmtPrice(price: number | null, currency: string) {
  if (price == null) return "—";
  return new Intl.NumberFormat("en-US", { style: "currency", currency }).format(price);
}

function StatusBadge({ status }: { status: string }) {
  if (status === "published") return <Badge>published</Badge>;
  if (status === "archived") return <Badge variant="outline">archived</Badge>;
  return <Badge variant="secondary">{status}</Badge>;
}

function AdminProductsList() {
  const { data: items } = useSuspenseQuery(listQuery);

  return (
    <div className="space-y-6 p-4 sm:p-8">
      <div className="flex items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold">Products</h1>
          <p className="text-sm text-muted-foreground">
            {items.length} product{items.length === 1 ? "" : "s"} across all workspaces —
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
          <Package className="h-10 w-10 text-muted-foreground" />
          <div className="space-y-1">
            <p className="font-medium">No products yet</p>
            <p className="text-sm text-muted-foreground">Create products from inside a workspace.</p>
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
                <TableHead>Name</TableHead>
                <TableHead className="hidden md:table-cell">Workspace</TableHead>
                <TableHead className="hidden lg:table-cell">Category</TableHead>
                <TableHead className="hidden sm:table-cell">Price</TableHead>
                <TableHead>Status</TableHead>
                <TableHead className="hidden sm:table-cell">Updated</TableHead>
                <TableHead className="hidden lg:table-cell text-right">Views</TableHead>
                <TableHead className="text-right">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {items.map((item) => (
                <TableRow key={item.id}>
                  <TableCell className="max-w-[160px] sm:max-w-[240px]">
                    <span className="font-medium line-clamp-2 sm:line-clamp-1">{item.name || "Untitled"}</span>
                    {item.brand && <span className="hidden sm:inline ml-2 text-xs text-muted-foreground">{item.brand}</span>}
                  </TableCell>
                  <TableCell className="hidden md:table-cell">
                    {item.workspace_id ? (
                      <Link
                        to="/admin/workspaces/$id/products"
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
                  <TableCell className="hidden lg:table-cell text-sm">{item.category}</TableCell>
                  <TableCell className="hidden sm:table-cell text-sm">{fmtPrice(item.price, item.currency)}</TableCell>
                  <TableCell><StatusBadge status={item.status} /></TableCell>
                  <TableCell className="hidden sm:table-cell text-sm text-muted-foreground">{fmtDate(item.updated_at)}</TableCell>
                  <TableCell className="hidden lg:table-cell text-right tabular-nums text-sm">{item.views.toLocaleString()}</TableCell>
                  <TableCell>
                    <div className="flex items-center justify-end gap-1">
                      {item.workspace_id && (
                        <>
                          <Button size="sm" variant="ghost" asChild className="gap-1.5 text-xs hidden sm:inline-flex">
                            <Link to="/admin/workspaces/$id/products/$productId" params={{ id: item.workspace_id, productId: item.id }}>
                              View
                            </Link>
                          </Button>
                          <Button size="sm" variant="ghost" asChild className="gap-1.5 text-xs">
                            <Link to="/admin/workspaces/$id/products/$productId/edit" params={{ id: item.workspace_id, productId: item.id }}>
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
          Click <strong>View</strong> to see product details or <strong>Edit</strong> to open the editor inside its workspace.
        </p>
      </div>
    </div>
  );
}
