import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";

export type FieldType = "text" | "textarea" | "number" | "boolean" | "date" | "select" | "image";

export interface CollectionField {
  name: string;
  label: string;
  type: FieldType;
  required: boolean;
  options?: string[];
}

export interface Collection {
  id: string;
  name: string;
  slug: string;
  description: string | null;
  schema: CollectionField[];
  created_at: string;
  updated_at: string;
  entry_count?: number;
}

export interface CollectionEntry {
  id: string;
  collection_id: string;
  data: Record<string, unknown>;
  status: "draft" | "published";
  created_at: string;
  updated_at: string;
}

function slugify(s: string): string {
  return s.toLowerCase().trim().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");
}

const fieldSchema = z.object({
  name: z.string().min(1),
  label: z.string().min(1),
  type: z.enum(["text", "textarea", "number", "boolean", "date", "select", "image"]),
  required: z.boolean(),
  options: z.array(z.string()).optional(),
});

export const listCollections = createServerFn({ method: "GET" }).handler(
  async (): Promise<Collection[]> => {
    const { getAdminClient } = await import("./supabase.server");
    const supabase = await getAdminClient();
    const { data, error } = await supabase
      .from("collections")
      .select("*")
      .order("created_at", { ascending: false });
    if (error) {
      if (error.message.includes("schema cache") || error.code === "PGRST204") return [];
      throw new Error(error.message);
    }

    const cols = (data ?? []) as Collection[];
    await Promise.all(
      cols.map(async (col) => {
        const { count } = await supabase
          .from("collection_entries")
          .select("*", { count: "exact", head: true })
          .eq("collection_id", col.id);
        col.entry_count = count ?? 0;
      }),
    );
    return cols;
  },
);

export const getCollection = createServerFn({ method: "GET" })
  .validator((input: { id: string }) => z.object({ id: z.string().uuid() }).parse(input))
  .handler(async ({ data }): Promise<Collection> => {
    const { getAdminClient } = await import("./supabase.server");
    const supabase = await getAdminClient();
    const { data: row, error } = await supabase
      .from("collections")
      .select("*")
      .eq("id", data.id)
      .single();
    if (error) throw new Error(error.message);
    return row as Collection;
  });

export const createCollection = createServerFn({ method: "POST" })
  .validator((input: { name: string; description?: string; schema: CollectionField[] }) =>
    z.object({
      name: z.string().trim().min(1).max(100),
      description: z.string().max(500).optional(),
      schema: z.array(fieldSchema),
    }).parse(input),
  )
  .handler(async ({ data }): Promise<Collection> => {
    const { getAdminClient } = await import("./supabase.server");
    const supabase = await getAdminClient();
    const slug = slugify(data.name);
    const { data: row, error } = await supabase
      .from("collections")
      .insert({ name: data.name, slug, description: data.description ?? null, schema: data.schema })
      .select("*")
      .single();
    if (error) throw new Error(error.message);
    return row as Collection;
  });

export const updateCollectionSchema = createServerFn({ method: "POST" })
  .validator((input: { id: string; name: string; description?: string; schema: CollectionField[] }) =>
    z.object({
      id: z.string().uuid(),
      name: z.string().trim().min(1).max(100),
      description: z.string().max(500).optional(),
      schema: z.array(fieldSchema),
    }).parse(input),
  )
  .handler(async ({ data }): Promise<{ ok: true }> => {
    const { getAdminClient } = await import("./supabase.server");
    const supabase = await getAdminClient();
    const { error } = await supabase
      .from("collections")
      .update({ name: data.name, description: data.description ?? null, schema: data.schema, updated_at: new Date().toISOString() })
      .eq("id", data.id);
    if (error) throw new Error(error.message);
    return { ok: true };
  });

export const deleteCollection = createServerFn({ method: "POST" })
  .validator((input: { id: string }) => z.object({ id: z.string().uuid() }).parse(input))
  .handler(async ({ data }): Promise<{ ok: true }> => {
    const { getAdminClient } = await import("./supabase.server");
    const supabase = await getAdminClient();
    const { error } = await supabase.from("collections").delete().eq("id", data.id);
    if (error) throw new Error(error.message);
    return { ok: true };
  });

export const listCollectionEntries = createServerFn({ method: "GET" })
  .validator((input: { collectionId: string }) => z.object({ collectionId: z.string().uuid() }).parse(input))
  .handler(async ({ data }): Promise<CollectionEntry[]> => {
    const { getAdminClient } = await import("./supabase.server");
    const supabase = await getAdminClient();
    const { data: rows, error } = await supabase
      .from("collection_entries")
      .select("*")
      .eq("collection_id", data.collectionId)
      .order("created_at", { ascending: false });
    if (error) {
      if (error.message.includes("schema cache") || error.code === "PGRST204") return [];
      throw new Error(error.message);
    }
    return (rows ?? []) as CollectionEntry[];
  });

export const upsertCollectionEntry = createServerFn({ method: "POST" })
  .validator((input: { id?: string; collection_id: string; data: Record<string, unknown>; status: "draft" | "published" }) =>
    z.object({
      id: z.string().uuid().optional(),
      collection_id: z.string().uuid(),
      data: z.record(z.unknown()),
      status: z.enum(["draft", "published"]),
    }).parse(input),
  )
  .handler(async ({ data }): Promise<CollectionEntry> => {
    const { getAdminClient } = await import("./supabase.server");
    const supabase = await getAdminClient();
    if (data.id) {
      const { data: row, error } = await supabase
        .from("collection_entries")
        .update({ data: data.data, status: data.status, updated_at: new Date().toISOString() })
        .eq("id", data.id)
        .select("*")
        .single();
      if (error) throw new Error(error.message);
      return row as CollectionEntry;
    } else {
      const { data: row, error } = await supabase
        .from("collection_entries")
        .insert({ collection_id: data.collection_id, data: data.data, status: data.status })
        .select("*")
        .single();
      if (error) throw new Error(error.message);
      return row as CollectionEntry;
    }
  });

export const deleteCollectionEntry = createServerFn({ method: "POST" })
  .validator((input: { id: string }) => z.object({ id: z.string().uuid() }).parse(input))
  .handler(async ({ data }): Promise<{ ok: true }> => {
    const { getAdminClient } = await import("./supabase.server");
    const supabase = await getAdminClient();
    const { error } = await supabase.from("collection_entries").delete().eq("id", data.id);
    if (error) throw new Error(error.message);
    return { ok: true };
  });
