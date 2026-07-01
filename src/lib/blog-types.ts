// Client-safe blog domain types and helpers (no server imports here).

export type BlogStatus = "draft" | "published";

export interface BlogPost {
  id: string;
  title: string;
  slug: string;
  excerpt: string;
  content: string;
  cover_image: string | null;
  category: string;
  tags: string[];
  author_name: string;
  seo_title: string | null;
  meta_description: string | null;
  featured: boolean;
  status: BlogStatus;
  published_at: string | null;
  reading_time: number;
  views: number;
  created_at: string;
  updated_at: string;
}

// Card/list projection (no heavy content field).
export type BlogPostSummary = Omit<BlogPost, "content">;

export const BLOG_CATEGORIES = [
  "Wedding",
  "Birthday",
  "Graduation",
  "Baby Shower",
  "Corporate",
  "General",
] as const;

export type BlogCategory = (typeof BLOG_CATEGORIES)[number];

/** Convert a title into a url-friendly slug. */
export function slugify(input: string): string {
  return input
    .toLowerCase()
    .trim()
    .replace(/['"]/g, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 80);
}

/** Estimate reading time in minutes from HTML/text content (200 wpm). */
export function estimateReadingTime(html: string): number {
  const text = html.replace(/<[^>]*>/g, " ");
  const words = text.split(/\s+/).filter(Boolean).length;
  return Math.max(1, Math.round(words / 200));
}

export function formatBlogDate(value: string | null): string {
  if (!value) return "";
  return new Date(value).toLocaleDateString("en-US", {
    year: "numeric",
    month: "long",
    day: "numeric",
  });
}
