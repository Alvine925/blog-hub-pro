import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { Skeleton } from "@/components/ui/skeleton";

function ProductsListSkeleton() {
  return (
    <div className="min-h-full px-4 py-4 sm:px-8 sm:py-8">
      <div className="mb-6 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="space-y-1.5">
          <Skeleton className="h-6 w-20" />
          <Skeleton className="h-4 w-32" />
        </div>
        <div className="flex items-center gap-2">
          <Skeleton className="h-8 w-36 rounded-md" />
          <Skeleton className="h-8 w-28 rounded-md" />
        </div>
      </div>
      <div className="flex items-center gap-3 border-b border-border pb-2">
        <Skeleton className="h-3 flex-1" />
        <Skeleton className="h-3 w-20 hidden sm:block" />
        <Skeleton className="h-3 w-28 hidden md:block" />
        <Skeleton className="h-3 w-24 hidden lg:block" />
        <Skeleton className="h-3 w-16 hidden xl:block" />
        <Skeleton className="h-3 w-20" />
      </div>
      {[...Array(10)].map((_, i) => (
        <div key={i} className="flex items-center gap-3 border-b border-border py-3 last:border-0">
          <div className="flex-1 min-w-0 flex items-center gap-2">
            <Skeleton className="h-8 w-8 shrink-0 rounded" />
            <div className="min-w-0 space-y-1.5">
              <Skeleton className="h-4 w-40" />
              <Skeleton className="h-3 w-20" />
            </div>
          </div>
          <Skeleton className="h-4 w-20 shrink-0 rounded-full hidden sm:block" />
          <Skeleton className="h-3 w-28 shrink-0 hidden md:block" />
          <Skeleton className="h-3 w-20 shrink-0 hidden lg:block" />
          <Skeleton className="h-3 w-12 shrink-0 hidden xl:block" />
          <Skeleton className="h-7 w-16 shrink-0 rounded-md" />
        </div>
      ))}
    </div>
  );
}
import { queryOptions, useSuspenseQuery, useQueryClient, useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { useState, useMemo } from "react";
import { toast } from "sonner";
import {
  Plus, Pencil, Trash2, Send, Eye, Tag, DollarSign, Package, Heart, MessageSquare, Sparkles,
} from "lucide-react";
import { GenerateContentDialog } from "@/components/ai/GenerateContentDialog";
import {
  adminListProducts, deleteProduct, setProductStatus,
  type ProductSummary,
} from "@/lib/product.functions";
import { getBatchContentEngagementStats } from "@/lib/engagement.functions";
import { cn } from "@/lib/utils";
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
} from "@/components/ui/alert-dialog";

// ── Queries ───────────────────────────────────────────────────────────────────
const listQuery = (workspaceId: string) =>
  queryOptions({
    queryKey: ["admin", "products", workspaceId],
    queryFn: () => adminListProducts({ data: { workspaceId } }),
  });

export const Route = createFileRoute("/admin/workspaces/$id/products/")({
  loader: ({ context, params }) =>
    context.queryClient.ensureQueryData(listQuery(params.id)),
  pendingComponent: ProductsListSkeleton,
  pendingMs: 0,
  component: WorkspaceProducts,
  errorComponent: ({ error }) => (
    <p className="p-8 text-sm text-red-600">{error.message}</p>
  ),
});

const STATUS_STYLE: Record<string, string> = {
  published: "text-emerald-600",
  draft:     "text-muted-foreground",
  archived:  "text-zinc-400",
};

function fmt(n: number | null, currency = "USD") {
  if (n == null) return "—";
  return new Intl.NumberFormat("en-US", { style: "currency", currency }).format(n);
}

function fmtDate(d: string) {
  return new Date(d).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" });
}

// ── Component ─────────────────────────────────────────────────────────────────
function WorkspaceProducts() {
  const { id: workspaceId } = Route.useParams();
  const { data: products }  = useSuspenseQuery(listQuery(workspaceId));
  const queryClient         = useQueryClient();
  const navigate            = useNavigate();
  const doDelete            = useServerFn(deleteProduct);
  const doStatus            = useServerFn(setProductStatus);
  const [pending, setPending] = useState<ProductSummary | null>(null);
  const [busy, setBusy]       = useState(false);
  const [generateOpen, setGenerateOpen] = useState(false);

  // Batch engagement stats — one request for all items, no N+1
  const productIds = useMemo(() => products.map((p) => p.id), [products]);
  const doGetBatchStats = useServerFn(getBatchContentEngagementStats);
  const { data: batchStats } = useQuery({
    queryKey: ["batch-engagement-stats", "products", workspaceId, productIds.join(",")],
    queryFn: () => doGetBatchStats({ data: { workspaceId, contentType: "products", ids: productIds } }),
    enabled: productIds.length > 0,
    staleTime: 5 * 60_000,
  });

  async function handleDelete() {
    if (!pending) return;
    setBusy(true);
    try {
      await doDelete({ data: { id: pending.id, workspaceId } });
      toast.success("Product deleted");
      setPending(null);
      await queryClient.invalidateQueries({ queryKey: ["admin", "products", workspaceId] });
    } catch (e) { toast.error(e instanceof Error ? e.message : "Failed"); }
    finally { setBusy(false); }
  }

  async function togglePublish(p: ProductSummary) {
    const next = p.status === "published" ? "draft" : "published";
    try {
      await doStatus({ data: { id: p.id, workspaceId, status: next } });
      toast.success(`Product ${next}`);
      await queryClient.invalidateQueries({ queryKey: ["admin", "products", workspaceId] });
    } catch (e) { toast.error(e instanceof Error ? e.message : "Failed"); }
  }

  return (
    <div className="min-h-full px-4 py-4 sm:px-8 sm:py-8">
      {/* Header */}
      <div className="mb-6 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-xl font-semibold">Products</h1>
          <p className="mt-0.5 text-sm text-muted-foreground">{products.length} products total</p>
        </div>
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={() => setGenerateOpen(true)}
            className="flex items-center gap-1.5 rounded-md border border-primary/30 bg-primary/5 px-3 py-1.5 text-sm font-medium text-primary hover:bg-primary/10 transition-colors"
          >
            <Sparkles className="h-3.5 w-3.5" /> Generate with AI
          </button>
          <Link
            to="/admin/workspaces/$id/products/new"
            params={{ id: workspaceId }}
            className="flex items-center gap-1.5 rounded-md bg-primary px-3 py-1.5 text-sm font-medium text-primary-foreground hover:bg-primary/90 transition-colors"
          >
            <Plus className="h-3.5 w-3.5" /> New Product
          </Link>
        </div>
      </div>

      {/* Table */}
      {products.length === 0 ? (
        <div className="flex flex-col items-center gap-3 py-20 border-y border-border text-center">
          <Package className="h-8 w-8 text-muted-foreground/40" />
          <p className="text-sm text-muted-foreground">No products yet.</p>
          <Link
            to="/admin/workspaces/$id/products/new"
            params={{ id: workspaceId }}
            className="flex items-center gap-1.5 text-sm font-medium text-primary hover:underline"
          >
            <Plus className="h-3.5 w-3.5" /> Add your first product
          </Link>
        </div>
      ) : (
        <div>
          {/* Column headers */}
          <div className="flex items-center gap-3 border-b border-border pb-2 text-[10px] font-semibold uppercase tracking-widest text-muted-foreground/60">
            <span className="flex-1">Name</span>
            <span className="w-20 shrink-0 hidden sm:block">Status</span>
            <span className="w-28 shrink-0 hidden md:block">Category</span>
            <span className="w-24 shrink-0 hidden lg:block text-right">Price</span>
            <span className="w-16 shrink-0 hidden xl:flex items-center justify-end gap-1">Views</span>
            <span className="w-20 shrink-0 text-right">Actions</span>
          </div>

          {products.map((product) => (
            <div
              key={product.id}
              onClick={() =>
                navigate({
                  to: "/admin/workspaces/$id/products/$productId",
                  params: { id: workspaceId, productId: product.id },
                })
              }
              className="group flex items-center gap-3 border-b border-border py-3 last:border-0 cursor-pointer hover:bg-muted/30 -mx-2 px-2 rounded-lg transition-colors"
            >
              {/* Name */}
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2">
                  {product.cover_image && (
                    <img
                      src={product.cover_image}
                      alt={product.name}
                      className="h-8 w-8 shrink-0 rounded object-cover border border-border"
                    />
                  )}
                  <div className="min-w-0">
                    <p className="truncate text-sm font-medium group-hover:text-primary transition-colors">
                      {product.name || "Untitled"}
                    </p>
                    {product.brand && (
                      <span className="text-xs text-muted-foreground">{product.brand}</span>
                    )}
                    <div className="mt-0.5 flex items-center gap-3 text-[10px] text-muted-foreground/60">
                      <span className="flex items-center gap-0.5">
                        <Eye className="h-2.5 w-2.5" />
                        {(batchStats?.[product.id]?.views ?? product.views ?? 0).toLocaleString()}
                      </span>
                      <span className="flex items-center gap-0.5">
                        <Heart className="h-2.5 w-2.5" />
                        {(batchStats?.[product.id]?.likes ?? 0).toLocaleString()}
                      </span>
                      <span className="flex items-center gap-0.5">
                        <MessageSquare className="h-2.5 w-2.5" />
                        {(batchStats?.[product.id]?.comments ?? 0).toLocaleString()}
                      </span>
                    </div>
                  </div>
                </div>
              </div>

              {/* Status */}
              <span className={cn("w-20 shrink-0 text-xs hidden sm:block capitalize", STATUS_STYLE[product.status])}>
                {product.status}
              </span>

              {/* Category */}
              <span className="w-28 shrink-0 text-xs text-muted-foreground hidden md:block truncate">
                {product.category || "—"}
              </span>

              {/* Price */}
              <span className="w-24 shrink-0 text-right text-xs tabular-nums text-muted-foreground hidden lg:block">
                {fmt(product.price, product.currency)}
              </span>

              {/* Views */}
              <span className="w-16 shrink-0 text-right text-xs tabular-nums text-muted-foreground hidden xl:flex items-center justify-end gap-1">
                <Eye className="h-3 w-3" />{product.views.toLocaleString()}
              </span>

              {/* Actions */}
              <div
                className="w-20 shrink-0 flex items-center justify-end gap-1 sm:opacity-0 sm:group-hover:opacity-100 transition-opacity"
                onClick={(e) => e.stopPropagation()}
              >
                <Link
                  to="/admin/workspaces/$id/products/$productId/edit"
                  params={{ id: workspaceId, productId: product.id }}
                  className="flex h-7 w-7 items-center justify-center rounded text-muted-foreground hover:text-foreground hover:bg-muted transition-colors"
                  title="Edit"
                >
                  <Pencil className="h-3.5 w-3.5" />
                </Link>
                <button
                  type="button"
                  onClick={() => togglePublish(product)}
                  className="flex h-7 w-7 items-center justify-center rounded text-muted-foreground hover:text-emerald-600 hover:bg-emerald-50 transition-colors"
                  title={product.status === "published" ? "Unpublish" : "Publish"}
                >
                  <Send className="h-3.5 w-3.5" />
                </button>
                <button
                  type="button"
                  onClick={() => setPending(product)}
                  className="flex h-7 w-7 items-center justify-center rounded text-muted-foreground hover:text-red-600 hover:bg-red-50 transition-colors"
                  title="Delete"
                >
                  <Trash2 className="h-3.5 w-3.5" />
                </button>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Delete dialog */}
      <AlertDialog open={!!pending} onOpenChange={(o) => !o && setPending(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete "{pending?.name || "this product"}"?</AlertDialogTitle>
            <AlertDialogDescription>This action cannot be undone.</AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleDelete}
              disabled={busy}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <GenerateContentDialog
        open={generateOpen}
        onOpenChange={setGenerateOpen}
        contentType="products"
        workspaceId={workspaceId}
      />
    </div>
  );
}
