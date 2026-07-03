import { createServerFn } from "@tanstack/react-start";

export interface Product {
  id: string;
  workspace_id: string;
  name: string;
  slug: string;
  description: string;
  content: string;
  cover_image: string | null;
  gallery: unknown[];
  category: string;
  brand: string;
  sku: string;
  price: number | null;
  compare_price: number | null;
  currency: string;
  status: "draft" | "published" | "archived";
  featured: boolean;
  specifications: Array<{ key: string; value: string }>;
  features: string[];
  tags: string[];
  seo_title: string | null;
  meta_description: string | null;
  views: number;
  sort_order: number;
  created_at: string;
  updated_at: string;
}

export type ProductSummary = Pick<
  Product,
  "id" | "name" | "slug" | "description" | "cover_image" | "category" | "brand" |
  "price" | "currency" | "status" | "featured" | "tags" | "views" | "sort_order" |
  "created_at" | "updated_at"
>;

export const adminListProducts = createServerFn({ method: "GET" })
  .validator((input: { workspaceId: string }) => input)
  .handler(async ({ data }): Promise<ProductSummary[]> => {
    const { getAdminClient } = await import("../lib/supabase.server");
    const db = getAdminClient() as any;
    const { data: rows, error } = await db
      .from("products")
      .select("id,name,slug,description,cover_image,category,brand,price,currency,status,featured,tags,views,sort_order,created_at,updated_at")
      .eq("workspace_id", data.workspaceId)
      .order("sort_order", { ascending: true })
      .order("created_at", { ascending: false });
    if (error) throw new Error(error.message);
    return rows ?? [];
  });

export const adminGetProduct = createServerFn({ method: "GET" })
  .validator((input: { id: string; workspaceId: string }) => input)
  .handler(async ({ data }): Promise<Product> => {
    const { getAdminClient } = await import("../lib/supabase.server");
    const db = getAdminClient() as any;
    const { data: row, error } = await db
      .from("products")
      .select("*")
      .eq("id", data.id)
      .eq("workspace_id", data.workspaceId)
      .single();
    if (error || !row) throw new Error("Product not found");
    return row as Product;
  });

export const upsertProduct = createServerFn({ method: "POST" })
  .validator((input: { product: Partial<Product> & { workspace_id: string } }) => input)
  .handler(async ({ data }): Promise<Product> => {
    const { getAdminClient } = await import("../lib/supabase.server");
    const db = getAdminClient() as any;
    const { product } = data;

    // Auto-slug from name if missing
    if (!product.slug && product.name) {
      product.slug = product.name
        .toLowerCase()
        .replace(/[^\w\s-]/g, "")
        .replace(/[\s_-]+/g, "-")
        .replace(/^-+|-+$/g, "")
        .slice(0, 80);
    }

    const { id, ...fields } = product;

    if (id) {
      // Update — enforce workspace scoping
      const { data: row, error } = await db
        .from("products")
        .update({ ...fields, updated_at: new Date().toISOString() })
        .eq("id", id)
        .eq("workspace_id", product.workspace_id)
        .select("*")
        .single();
      if (error) throw new Error(error.message);
      return row as Product;
    } else {
      const { data: row, error } = await db
        .from("products")
        .insert(fields)
        .select("*")
        .single();
      if (error) throw new Error(error.message);
      return row as Product;
    }
  });

export const setProductStatus = createServerFn({ method: "POST" })
  .validator((input: { id: string; workspaceId: string; status: Product["status"] }) => input)
  .handler(async ({ data }) => {
    const { getAdminClient } = await import("../lib/supabase.server");
    const db = getAdminClient() as any;
    const { error } = await db
      .from("products")
      .update({ status: data.status, updated_at: new Date().toISOString() })
      .eq("id", data.id)
      .eq("workspace_id", data.workspaceId);
    if (error) throw new Error(error.message);
    return { ok: true };
  });

export const deleteProduct = createServerFn({ method: "POST" })
  .validator((input: { id: string; workspaceId: string }) => input)
  .handler(async ({ data }) => {
    const { getAdminClient } = await import("../lib/supabase.server");
    const db = getAdminClient() as any;
    const { error } = await db
      .from("products")
      .delete()
      .eq("id", data.id)
      .eq("workspace_id", data.workspaceId);
    if (error) throw new Error(error.message);
    return { ok: true };
  });
