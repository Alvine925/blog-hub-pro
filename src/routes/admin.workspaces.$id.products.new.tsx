import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { toast } from "sonner";
import { ArrowLeft, Loader2 } from "lucide-react";
import { upsertProduct, type Product } from "@/lib/product.functions";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";

export const Route = createFileRoute("/admin/workspaces/$id/products/new")({
  component: ProductNew,
});

function ProductNew() {
  const { id: workspaceId } = Route.useParams();
  const navigate    = useNavigate();
  const queryClient = useQueryClient();
  const doUpsert    = useServerFn(upsertProduct);

  const [form, setForm] = useState<Partial<Product>>({
    workspace_id:    workspaceId,
    name:            "",
    description:     "",
    content:         "",
    category:        "",
    brand:           "",
    sku:             "",
    price:           null,
    compare_price:   null,
    currency:        "USD",
    status:          "draft",
    featured:        false,
    seo_title:       "",
    meta_description: "",
  });
  const [saving, setSaving] = useState(false);

  function set<K extends keyof typeof form>(key: K, value: typeof form[K]) {
    setForm((prev) => ({ ...prev, [key]: value }));
  }

  async function handleSave(publish = false) {
    if (!form.name?.trim()) { toast.error("Name is required"); return; }
    setSaving(true);
    try {
      const saved = await doUpsert({
        data: {
          product: {
            ...form,
            workspace_id: workspaceId,
            status: publish ? "published" : "draft",
          } as Partial<Product> & { workspace_id: string },
        },
      });
      toast.success("Product created");
      await queryClient.invalidateQueries({ queryKey: ["admin", "products", workspaceId] });
      navigate({
        to: "/admin/workspaces/$id/products/$productId",
        params: { id: workspaceId, productId: saved.id },
      });
    } catch (e) { toast.error(e instanceof Error ? e.message : "Failed to create"); }
    finally { setSaving(false); }
  }

  return (
    <div className="min-h-full px-8 py-8 max-w-2xl">
      <Link
        to="/admin/workspaces/$id/products"
        params={{ id: workspaceId }}
        className="inline-flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground transition-colors mb-6"
      >
        <ArrowLeft className="h-3.5 w-3.5" /> Products
      </Link>

      <h1 className="text-xl font-semibold mb-8">New Product</h1>

      <div className="space-y-6">
        <div className="space-y-2">
          <Label htmlFor="name">Name *</Label>
          <Input id="name" value={form.name ?? ""} onChange={(e) => set("name", e.target.value)} placeholder="Product name" autoFocus />
        </div>

        <div className="grid grid-cols-2 gap-4">
          <div className="space-y-2">
            <Label htmlFor="category">Category</Label>
            <Input id="category" value={form.category ?? ""} onChange={(e) => set("category", e.target.value)} placeholder="e.g. Software" />
          </div>
          <div className="space-y-2">
            <Label htmlFor="brand">Brand</Label>
            <Input id="brand" value={form.brand ?? ""} onChange={(e) => set("brand", e.target.value)} placeholder="Brand name" />
          </div>
        </div>

        <div className="grid grid-cols-3 gap-4">
          <div className="space-y-2">
            <Label htmlFor="price">Price</Label>
            <Input
              id="price" type="number" step="0.01" min="0"
              value={form.price ?? ""}
              onChange={(e) => set("price", e.target.value ? parseFloat(e.target.value) : null)}
              placeholder="0.00"
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="compare_price">Compare at</Label>
            <Input
              id="compare_price" type="number" step="0.01" min="0"
              value={form.compare_price ?? ""}
              onChange={(e) => set("compare_price", e.target.value ? parseFloat(e.target.value) : null)}
              placeholder="0.00"
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="sku">SKU</Label>
            <Input id="sku" value={form.sku ?? ""} onChange={(e) => set("sku", e.target.value)} placeholder="SKU-001" />
          </div>
        </div>

        <div className="space-y-2">
          <Label htmlFor="description">Short Description</Label>
          <Textarea
            id="description" rows={3}
            value={form.description ?? ""}
            onChange={(e) => set("description", e.target.value)}
            placeholder="1-2 sentence summary shown in listings"
          />
        </div>

        <div className="space-y-2">
          <Label htmlFor="content">Full Description (HTML)</Label>
          <Textarea
            id="content" rows={10} className="font-mono text-xs"
            value={form.content ?? ""}
            onChange={(e) => set("content", e.target.value)}
            placeholder="<p>Detailed product description...</p>"
          />
        </div>

        <div className="space-y-2">
          <Label htmlFor="seo_title">SEO Title</Label>
          <Input id="seo_title" value={form.seo_title ?? ""} onChange={(e) => set("seo_title", e.target.value)} />
        </div>

        <div className="space-y-2">
          <Label htmlFor="meta_description">Meta Description</Label>
          <Textarea id="meta_description" rows={2} value={form.meta_description ?? ""} onChange={(e) => set("meta_description", e.target.value)} />
        </div>

        <div className="flex items-center gap-3 py-2">
          <Switch id="featured" checked={form.featured ?? false} onCheckedChange={(v) => set("featured", v)} />
          <Label htmlFor="featured" className="cursor-pointer">Featured product</Label>
        </div>

        <div className="flex gap-3 pt-4 border-t border-border">
          <button
            type="button" onClick={() => handleSave(false)} disabled={saving}
            className="flex items-center gap-1.5 rounded-md border border-border px-4 py-2 text-sm font-medium hover:bg-muted transition-colors disabled:opacity-50"
          >
            {saving && <Loader2 className="h-3.5 w-3.5 animate-spin" />} Save Draft
          </button>
          <button
            type="button" onClick={() => handleSave(true)} disabled={saving}
            className="flex items-center gap-1.5 rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground hover:bg-primary/90 transition-colors disabled:opacity-50"
          >
            {saving && <Loader2 className="h-3.5 w-3.5 animate-spin" />} Create & Publish
          </button>
        </div>
      </div>
    </div>
  );
}
