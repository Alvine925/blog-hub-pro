/**
 * transformer.ts — Centralized response transformer for the Lunar CMS API.
 *
 * All REST endpoints (api-gateway, content-router, and any future gateway)
 * must use these functions to sanitize database rows before returning them
 * to API consumers.
 *
 * Internal fields that are NEVER exposed:
 *   workspace_id · user_id · owner_id · storage_path · deleted_at
 *   internal_notes · internal_status · private_metadata · draft_content
 *   audit fields (created_by, updated_by)
 */

// ── Blog ─────────────────────────────────────────────────────────────────────

export interface PublicBlogSummary {
  slug: string;
  title: string;
  excerpt: string;
  image: string | null;
  category: string;
  tags: string[];
  author: string;
  featured: boolean;
  reading_time: number;
  views: number;
  published_at: string | null;
  updated_at: string;
}

export interface PublicBlogDetail extends PublicBlogSummary {
  content: string;
  seo_title: string | null;
  meta_description: string | null;
}

export function toBlogSummary(row: Record<string, unknown>): PublicBlogSummary {
  return {
    slug:         row.slug as string,
    title:        (row.title as string) || "",
    excerpt:      (row.excerpt as string) || "",
    image:        (row.cover_image as string | null) ?? null,
    category:     (row.category as string) || "General",
    tags:         Array.isArray(row.tags) ? (row.tags as string[]) : [],
    author:       (row.author_name as string) || "Admin",
    featured:     Boolean(row.featured),
    reading_time: Number(row.reading_time) || 1,
    views:        Number(row.views) || 0,
    published_at: (row.published_at as string | null) ?? null,
    updated_at:   row.updated_at as string,
  };
}

export function toBlogDetail(row: Record<string, unknown>): PublicBlogDetail {
  return {
    ...toBlogSummary(row),
    content:          (row.content as string) || "",
    seo_title:        (row.seo_title as string | null) ?? null,
    meta_description: (row.meta_description as string | null) ?? null,
  };
}

// ── Page ─────────────────────────────────────────────────────────────────────

export interface PublicPage {
  slug: string;
  title: string;
  excerpt: string | null;
  content: string;
  image: string | null;
  seo_title: string | null;
  meta_description: string | null;
  published_at: string | null;
  updated_at: string;
}

export function toPage(row: Record<string, unknown>): PublicPage {
  return {
    slug:             row.slug as string,
    title:            (row.title as string) || "",
    excerpt:          (row.excerpt as string | null) ?? null,
    content:          (row.content as string) || "",
    image:            (row.cover_image as string | null) ?? null,
    seo_title:        (row.seo_title as string | null) ?? null,
    meta_description: (row.meta_description as string | null) ?? null,
    published_at:     (row.published_at as string | null) ?? null,
    updated_at:       row.updated_at as string,
  };
}

// ── Collection ────────────────────────────────────────────────────────────────

export interface PublicCollection {
  slug: string;
  name: string;
  description: string | null;
  created_at: string;
}

export interface PublicCollectionEntry {
  data: Record<string, unknown>;
  status: string;
  created_at: string;
  updated_at: string;
}

export function toCollection(row: Record<string, unknown>): PublicCollection {
  return {
    slug:        row.slug as string,
    name:        (row.name as string) || "",
    description: (row.description as string | null) ?? null,
    created_at:  row.created_at as string,
  };
}

export function toCollectionEntry(row: Record<string, unknown>): PublicCollectionEntry {
  return {
    data:       (row.data as Record<string, unknown>) ?? {},
    status:     (row.status as string) || "published",
    created_at: row.created_at as string,
    updated_at: row.updated_at as string,
  };
}

// ── Category ─────────────────────────────────────────────────────────────────

export interface PublicCategory {
  name: string;
  slug: string;
  post_count: number;
}

export function toCategory(name: string, count: number): PublicCategory {
  return {
    name,
    slug:       name.toLowerCase().replace(/\s+/g, "-").replace(/[^a-z0-9-]/g, ""),
    post_count: count,
  };
}

// ── Tag ──────────────────────────────────────────────────────────────────────

export interface PublicTag {
  name: string;
  slug: string;
  post_count: number;
}

export function toTag(name: string, count: number): PublicTag {
  return {
    name,
    slug:       name.toLowerCase().replace(/\s+/g, "-").replace(/[^a-z0-9-]/g, ""),
    post_count: count,
  };
}

// ── Media ─────────────────────────────────────────────────────────────────────

export interface PublicMedia {
  url: string;
  file_name: string;
  mime_type: string;
  size_bytes: number;
  width: number | null;
  height: number | null;
  alt_text: string | null;
  caption: string | null;
  folder: string;
  tags: string[];
  created_at: string;
}

export function toMedia(
  row: Record<string, unknown>,
  supabaseUrl: string,
): PublicMedia {
  const bucket = (row.bucket as string) || "blog-images";
  const path   = row.storage_path as string;
  const url    = `${supabaseUrl}/storage/v1/object/public/${bucket}/${path}`;

  return {
    url,
    file_name:  row.file_name as string,
    mime_type:  (row.mime_type as string) || "application/octet-stream",
    size_bytes: Number(row.size_bytes) || 0,
    width:      row.width_px != null ? Number(row.width_px) : null,
    height:     row.height_px != null ? Number(row.height_px) : null,
    alt_text:   (row.alt_text as string | null) ?? null,
    caption:    (row.caption as string | null) ?? null,
    folder:     (row.folder as string) || "/",
    tags:       Array.isArray(row.tags) ? (row.tags as string[]) : [],
    created_at: row.created_at as string,
  };
}

// ── Search result ─────────────────────────────────────────────────────────────

export interface PublicSearchResult {
  type: "blog" | "collection" | "category" | "tag";
  title: string;
  slug: string;
  excerpt: string | null;
  image: string | null;
  published_at: string | null;
}
