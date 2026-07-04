import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { queryOptions, useSuspenseQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { useState } from "react";
import { toast } from "sonner";
import { ArrowLeft, Pencil, Trash2, Send, Package, DollarSign, Tag, Eye, Heart, MessageSquare, Share2 } from "lucide-react";
import { adminGetProduct, deleteProduct, setProductStatus, type Product } from "@/lib/product.functions";
import { getContentEngagementStats } from "@/lib/engagement.functions";
import { useQuery } from "@tanstack/react-query";
import { cn } from "@/lib/utils";
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
} from "@/components/ui/alert-dialog";

const detailQuery = (id: string, workspaceId: string) =>
  queryOptions({
    queryKey: ["admin", "product", id, workspaceId],
    queryFn: () => adminGetProduct({ data: { id, workspaceId } }),
  });

function ProductDetailSkeleton() {
  return (
    <div className="min-h-full px-4 py-4 sm:px-8 sm:py-8 max-w-4xl space-y-6">
      <Skeleton className="h-4 w-20" />
      <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div className="space-y-2 min-w-0 flex-1">
          <Skeleton className="h-7 w-1/2" />
          <Skeleton className="h-4 w-48" />
        </div>
        <div className="flex shrink-0 items-center gap-2">
          <Skeleton className="h-8 w-24 rounded-md" />
          <Skeleton className="h-8 w-16 rounded-md" />
          <Skeleton className="h-8 w-8 rounded-md" />
        </div>
      </div>
      <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
        {[...Array(4)].map((_, i) => (
          <Skeleton key={i} className="h-14 rounded-lg" />
        ))}
      </div>
      <Skeleton className="h-48 w-full rounded-lg" />
      <div className="grid gap-6 lg:grid-cols-2">
        {[...Array(2)].map((_, col) => (
          <div key={col} className="space-y-3">
            <Skeleton className="h-3 w-24" />
            {[...Array(4)].map((_, i) => (
              <div key={i} className="flex items-center gap-3 border-b border-border py-2.5 last:border-0">
                <Skeleton className="h-3 w-24 shrink-0" />
                <Skeleton className="h-3 flex-1" />
              </div>
            ))}
          </div>
        ))}
      </div>
      <div className="space-y-3">
        {[...Array(6)].map((_, i) => (
          <Skeleton key={i} className={`h-4 ${i % 3 === 2 ? "w-1/2" : "w-full"}`} />
        ))}
      </div>
    </div>
  );
}

export const Route = createFileRoute("/admin/workspaces/$id/products/$productId/")({
  loader: ({ context, params }) =>
    context.queryClient.ensureQueryData(detailQuery(params.productId, params.id)),
  pendingComponent: ProductDetailSkeleton,
  pendingMs: 0,
  component: ProductDetail,
  errorComponent: ({ error }) => (
    <p className="p-8 text-sm text-red-600">{error.message}</p>
  ),
});

const STATUS_STYLE: Record<string, string> = {
  published: "text-emerald-600",
  draft:     "text-muted-foreground",
  archived:  "text-zinc-400",
};

function fmtPrice(price: number | null, currency = "USD") {
  if (price == null) return "Custom pricing";
  return new Intl.NumberFormat("en-US", { style: "currency", currency }).format(price);
}

function StatPill({ icon: Icon, label, value }: { icon: React.ElementType; label: string; value: number }) {
  return (
    <div className="flex items-center gap-1.5 rounded-lg border border-border bg-muted/40 px-3 py-2">
      <Icon className="h-3.5 w-3.5 text-muted-foreground shrink-0" />
      <div>
        <p className="text-xs font-semibold tabular-nums">{value.toLocaleString()}</p>
        <p className="text-[10px] text-muted-foreground">{label}</p>
      </div>
    </div>
  );
}

function ProductDetail() {
  const { id: workspaceId, productId } = Route.useParams();
  const { data: product } = useSuspenseQuery(detailQuery(productId, workspaceId));
  const doGetStats        = useServerFn(getContentEngagementStats);
  const { data: stats }   = useQuery({
    queryKey: ["content-engagement-stats", "products", productId],
    queryFn:  () => doGetStats({ data: { workspaceId, contentType: "products", contentId: productId } }),
    staleTime: 5 * 60_000,
  });
  const queryClient = useQueryClient();
  const navigate    = useNavigate();
  const doDelete    = useServerFn(deleteProduct);
  const doStatus    = useServerFn(setProductStatus);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [busy, setBusy] = useState(false);

  async function handleDelete() {
    setBusy(true);
    try {
      await doDelete({ data: { id: productId, workspaceId } });
      toast.success("Product deleted");
      await queryClient.invalidateQueries({ queryKey: ["admin", "products", workspaceId] });
      navigate({ to: "/admin/workspaces/$id/products", params: { id: workspaceId } });
    } catch (e) { toast.error(e instanceof Error ? e.message : "Failed"); }
    finally { setBusy(false); }
  }

  async function togglePublish() {
    const next = product.status === "published" ? "draft" : "published";
    try {
      await doStatus({ data: { id: productId, workspaceId, status: next } });
      toast.success(`Product ${next}`);
      await queryClient.invalidateQueries({ queryKey: ["admin", "product", productId, workspaceId] });
      await queryClient.invalidateQueries({ queryKey: ["admin", "products", workspaceId] });
    } catch (e) { toast.error(e instanceof Error ? e.message : "Failed"); }
  }

  return (
    <div className="min-h-full px-4 py-4 sm:px-8 sm:py-8 max-w-4xl">
      {/* Back */}
      <Link
        to="/admin/workspaces/$id/products"
        params={{ id: workspaceId }}
        className="inline-flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground transition-colors mb-6"
      >
        <ArrowLeft className="h-3.5 w-3.5" /> Products
      </Link>

      {/* Header */}
      <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div className="min-w-0">
          <h1 className="text-2xl font-bold tracking-tight">{product.name || "Untitled"}</h1>
          <div className="mt-1 flex items-center gap-3 text-sm text-muted-foreground">
            <span className={cn("capitalize font-medium", STATUS_STYLE[product.status])}>
              {product.status}
            </span>
            {product.category && <span>· {product.category}</span>}
            {product.brand && <span>· {product.brand}</span>}
            <span className="flex items-center gap-1">
              · <Eye className="h-3.5 w-3.5" /> {product.views.toLocaleString()} views
            </span>
          </div>
        </div>
        <div className="flex shrink-0 items-center gap-2">
          <button
            type="button"
            onClick={togglePublish}
            className="flex items-center gap-1.5 rounded-md border border-border px-3 py-1.5 text-sm font-medium hover:bg-muted transition-colors"
          >
            <Send className="h-3.5 w-3.5" />
            {product.status === "published" ? "Unpublish" : "Publish"}
          </button>
          <Link
            to="/admin/workspaces/$id/products/$productId/edit"
            params={{ id: workspaceId, productId }}
            className="flex items-center gap-1.5 rounded-md bg-primary px-3 py-1.5 text-sm font-medium text-primary-foreground hover:bg-primary/90 transition-colors"
          >
            <Pencil className="h-3.5 w-3.5" /> Edit
          </Link>
          <button
            type="button"
            onClick={() => setConfirmDelete(true)}
            className="flex h-8 w-8 items-center justify-center rounded-md border border-border text-muted-foreground hover:text-red-600 hover:border-red-300 transition-colors"
          >
            <Trash2 className="h-3.5 w-3.5" />
          </button>
        </div>
      </div>

      {/* Engagement stats */}
      {stats && (
        <div className="mt-6 grid grid-cols-2 gap-2 sm:grid-cols-4">
          <StatPill icon={Eye}           label="Views"    value={product.views ?? 0} />
          <StatPill icon={Heart}         label="Likes"    value={stats.likes}    />
          <StatPill icon={MessageSquare} label="Comments" value={stats.comments} />
          <StatPill icon={Share2}        label="Shares"   value={stats.shares}   />
        </div>
      )}

      {/* Cover image */}
      {product.cover_image && (
        <div className="mt-6">
          <img
            src={product.cover_image}
            alt={product.name}
            className="w-full max-h-64 rounded-lg object-cover border border-border"
          />
        </div>
      )}

      {/* Key info */}
      <div className="mt-8 grid grid-cols-2 gap-4 sm:grid-cols-3 border-y border-border py-6">
        <div>
          <p className="text-xs font-medium uppercase tracking-wider text-muted-foreground/60">Price</p>
          <p className="mt-1 text-lg font-semibold">
            {fmtPrice(product.price, product.currency)}
          </p>
          {product.compare_price && product.compare_price > (product.price ?? 0) && (
            <p className="text-sm line-through text-muted-foreground">
              {fmtPrice(product.compare_price, product.currency)}
            </p>
          )}
        </div>
        {product.sku && (
          <div>
            <p className="text-xs font-medium uppercase tracking-wider text-muted-foreground/60">SKU</p>
            <p className="mt-1 text-sm font-mono">{product.sku}</p>
          </div>
        )}
        {product.category && (
          <div>
            <p className="text-xs font-medium uppercase tracking-wider text-muted-foreground/60">Category</p>
            <p className="mt-1 text-sm">{product.category}</p>
          </div>
        )}
      </div>

      {/* Description */}
      {product.description && (
        <div className="mt-6 border-b border-border pb-6">
          <h2 className="mb-2 text-sm font-semibold uppercase tracking-wider text-muted-foreground/60">Description</h2>
          <p className="text-sm leading-relaxed text-muted-foreground">{product.description}</p>
        </div>
      )}

      {/* Features */}
      {Array.isArray(product.features) && product.features.length > 0 && (
        <div className="mt-6 border-b border-border pb-6">
          <h2 className="mb-3 text-sm font-semibold uppercase tracking-wider text-muted-foreground/60">Features</h2>
          <ul className="space-y-1.5">
            {product.features.map((f, i) => (
              <li key={i} className="flex items-start gap-2 text-sm">
                <span className="mt-0.5 text-emerald-500">✓</span>
                <span>{String(f)}</span>
              </li>
            ))}
          </ul>
        </div>
      )}

      {/* Specifications */}
      {Array.isArray(product.specifications) && product.specifications.length > 0 && (
        <div className="mt-6 border-b border-border pb-6">
          <h2 className="mb-3 text-sm font-semibold uppercase tracking-wider text-muted-foreground/60">Specifications</h2>
          <dl className="divide-y divide-border">
            {product.specifications.map((spec, i) => (
              <div key={i} className="flex items-center justify-between py-2 text-sm">
                <dt className="text-muted-foreground">{(spec as any).key}</dt>
                <dd className="font-medium">{(spec as any).value}</dd>
              </div>
            ))}
          </dl>
        </div>
      )}

      {/* Rich content */}
      {product.content && (
        <div className="mt-6 border-b border-border pb-6">
          <h2 className="mb-3 text-sm font-semibold uppercase tracking-wider text-muted-foreground/60">Full Description</h2>
          <div
            className="prose prose-sm max-w-none"
            dangerouslySetInnerHTML={{ __html: product.content }}
          />
        </div>
      )}

      {/* Tags */}
      {product.tags && product.tags.length > 0 && (
        <div className="mt-6">
          <h2 className="mb-2 text-sm font-semibold uppercase tracking-wider text-muted-foreground/60">Tags</h2>
          <div className="flex flex-wrap gap-1.5">
            {product.tags.map((tag) => (
              <span key={tag} className="inline-flex items-center gap-1 rounded-full bg-muted px-2.5 py-0.5 text-xs">
                <Tag className="h-3 w-3" />{tag}
              </span>
            ))}
          </div>
        </div>
      )}

      <AlertDialog open={confirmDelete} onOpenChange={setConfirmDelete}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete "{product.name}"?</AlertDialogTitle>
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
    </div>
  );
}
