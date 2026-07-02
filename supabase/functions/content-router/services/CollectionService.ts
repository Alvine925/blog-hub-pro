/**
 * CollectionService.ts — retrieves collections and their entries.
 */
import { getDb } from "../db.ts";
import { toCollection, toCollectionEntry, type PublicCollection, type PublicCollectionEntry } from "../ContentTransformer.ts";

export interface CollectionListResult {
  rows:  PublicCollection[];
  total: number;
}

export interface CollectionEntriesResult {
  collection: PublicCollection;
  rows:        PublicCollectionEntry[];
  total:       number;
}

const COLLECTION_COLS = "slug, name, description, created_at";

export async function listCollections(
  workspaceId: string,
  params: { page: number; limit: number },
): Promise<CollectionListResult> {
  const db = getDb();
  const offset = (params.page - 1) * params.limit;

  const { data, count, error } = await db
    .from("collections")
    .select(COLLECTION_COLS, { count: "exact" })
    .eq("workspace_id", workspaceId)
    .order("name")
    .range(offset, offset + params.limit - 1);

  if (error) throw new Error(error.message);

  return {
    rows:  (data ?? []).map((r) => toCollection(r as Record<string, unknown>)),
    total: count ?? 0,
  };
}

export async function getCollectionEntries(
  workspaceId: string,
  slug: string,
  params: { page: number; limit: number },
): Promise<CollectionEntriesResult | null> {
  const db = getDb();

  // Resolve collection by slug, scoped to the caller's workspace
  const { data: col, error: colErr } = await db
    .from("collections")
    .select("id, " + COLLECTION_COLS)
    .eq("slug", slug)
    .eq("workspace_id", workspaceId)
    .maybeSingle();

  if (colErr || !col) return null;

  const offset = (params.page - 1) * params.limit;
  const { data, count, error } = await db
    .from("collection_entries")
    .select("data, status, created_at, updated_at", { count: "exact" })
    .eq("collection_id", (col as Record<string, unknown>).id)
    .eq("status", "published")
    .order("created_at", { ascending: false })
    .range(offset, offset + params.limit - 1);

  if (error) throw new Error(error.message);

  return {
    collection: toCollection(col as Record<string, unknown>),
    rows:       (data ?? []).map((r) => toCollectionEntry(r as Record<string, unknown>)),
    total:      count ?? 0,
  };
}
