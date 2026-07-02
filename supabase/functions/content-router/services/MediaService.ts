/**
 * MediaService.ts — retrieves media_files for the content-router.
 *
 * Returns only the public bucket URL; the internal storage_path is never
 * exposed to API consumers. No signed URLs are generated — all assets are
 * assumed to be in a public bucket (blog-images).
 */
import { getDb } from "../db.ts";
import { toMedia, type PublicMedia } from "../ContentTransformer.ts";

export interface MediaListParams {
  page:       number;
  limit:      number;
  sort:       string;
  order:      "asc" | "desc";
  folder?:    string;
  mime_type?: string;
  search?:    string;
}

export interface MediaListResult {
  rows:  PublicMedia[];
  total: number;
}

const SORT_COLS = new Set(["created_at", "updated_at", "file_name", "size_bytes"]);

const MEDIA_COLS =
  "bucket, storage_path, file_name, mime_type, size_bytes, width_px, height_px, alt_text, caption, folder, tags, created_at";

export async function listMedia(
  workspaceId: string,
  params: MediaListParams,
): Promise<MediaListResult> {
  const db   = getDb();
  const sort = SORT_COLS.has(params.sort) ? params.sort : "created_at";
  const asc  = params.order === "asc";
  const offset = (params.page - 1) * params.limit;

  let query = db
    .from("media_files")
    .select(MEDIA_COLS, { count: "exact" })
    .eq("workspace_id", workspaceId)
    .order(sort, { ascending: asc })
    .range(offset, offset + params.limit - 1);

  if (params.folder)    query = query.eq("folder", params.folder);
  if (params.mime_type) query = query.ilike("mime_type", `${params.mime_type}%`);
  if (params.search) {
    const term = params.search.replace(/[%_\\]/g, "").slice(0, 200);
    query = query.or(`file_name.ilike.%${term}%,alt_text.ilike.%${term}%`);
  }

  const { data, count, error } = await query;
  if (error) {
    // Table may not exist in all deployments — return empty gracefully
    if (error.message?.includes("does not exist") || error.code === "PGRST204") {
      return { rows: [], total: 0 };
    }
    throw new Error(error.message);
  }

  const supabaseUrl = Deno.env.get("SUPABASE_URL") ?? "";
  return {
    rows:  (data ?? []).map((r) => toMedia(r as Record<string, unknown>, supabaseUrl)),
    total: count ?? 0,
  };
}
