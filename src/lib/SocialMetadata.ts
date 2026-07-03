/**
 * SocialMetadata.ts — Reusable social sharing metadata service for Lunar CMS.
 *
 * Node.js TypeScript port of supabase/functions/_shared/social.ts.
 * Used by the Vite dev-server middleware (api-handler.node.ts) to build
 * the `social` object that is embedded in every API response.
 *
 * Architecture note
 * ─────────────────
 * Lunar CMS is the *content provider*. It never generates share dialogs,
 * Facebook / LinkedIn URLs, or links pointing back to Lunar CMS.
 * Client websites are responsible for using `social.*` to:
 *   1. Populate Open Graph / Twitter Card <meta> tags.
 *   2. Build their own share buttons.
 *   3. Share the *client's own* page URL (window.location.href or framework equiv).
 *
 * Fallback hierarchy
 * ──────────────────
 * title       : social_title → seo_title → title / name / question
 * description : social_description → meta_description / seo_description → excerpt / description / answer
 * image       : social_image → cover_image / featured_image
 * alt         : social_image_alt → null
 * hashtags    : social_hashtags (db) → derived from tags array → []
 * twitterCard : twitter_card (db) → "summary_large_image"
 * type        : open_graph_type (db) → caller-supplied default
 */

export type OgType = "article" | "product" | "website";

export interface SocialMetadata {
  /** Resolved title for og:title / twitter:title */
  title: string;
  /** Resolved description for og:description / twitter:description */
  description: string;
  /** Resolved image URL for og:image / twitter:image (null when unavailable) */
  image: string | null;
  /** Alt text for the social image */
  alt: string | null;
  /** Hashtags (without the # symbol) suggested for social posts */
  hashtags: string[];
  /** Twitter / X card type — always "summary_large_image" by default */
  twitterCard: string;
  /** Open Graph og:type value */
  type: string;
}

/**
 * Build a fully-resolved SocialMetadata object from a raw database row.
 *
 * @param row            Raw DB row as a plain object.
 * @param defaultOgType  og:type to use when row has no `open_graph_type` column.
 *                       Pass "article" for blogs/news/articles,
 *                       "product" for products, "website" for FAQs/pages.
 */
export function buildSocialMetadata(
  row: Record<string, unknown>,
  defaultOgType: OgType,
): SocialMetadata {
  // ── Title ─────────────────────────────────────────────────────────────────
  const title =
    str(row["social_title"]) ??
    str(row["seo_title"]) ??
    str(row["title"]) ??
    str(row["name"]) ??       // products
    str(row["question"]) ??   // faqs
    "";

  // ── Description ───────────────────────────────────────────────────────────
  const description =
    str(row["social_description"]) ??
    str(row["meta_description"]) ??
    str(row["seo_description"]) ??
    str(row["excerpt"]) ??
    str(row["description"]) ?? // products
    str(row["answer"]) ??      // faqs
    "";

  // ── Image ─────────────────────────────────────────────────────────────────
  const image =
    str(row["social_image"]) ??
    str(row["cover_image"]) ??
    str(row["featured_image"]) ??
    null;

  // ── Alt ───────────────────────────────────────────────────────────────────
  const alt = str(row["social_image_alt"]) ?? null;

  // ── Hashtags ──────────────────────────────────────────────────────────────
  let hashtags: string[] = [];
  const rawHashtags = row["social_hashtags"];
  if (Array.isArray(rawHashtags) && rawHashtags.length > 0) {
    hashtags = rawHashtags.map(String).filter(Boolean);
  } else {
    const rawTags = row["tags"];
    if (Array.isArray(rawTags) && rawTags.length > 0) {
      hashtags = rawTags
        .map((t) => String(t).toLowerCase().replace(/\s+/g, ""))
        .filter(Boolean)
        .slice(0, 5);
    }
  }

  // ── Twitter Card ──────────────────────────────────────────────────────────
  const twitterCard = str(row["twitter_card"]) ?? "summary_large_image";

  // ── OG Type ───────────────────────────────────────────────────────────────
  const type = str(row["open_graph_type"]) ?? defaultOgType;

  return { title, description, image, alt, hashtags, twitterCard, type };
}

// ── Internal helper ────────────────────────────────────────────────────────────

/** Return a non-empty trimmed string, or undefined. */
function str(v: unknown): string | undefined {
  if (typeof v === "string" && v.trim().length > 0) return v.trim();
  return undefined;
}

/**
 * Raw social DB columns — fetched from the DB but not exposed directly.
 * Use this set to strip them from the sanitized response before returning.
 */
export const SOCIAL_DB_COLS = new Set([
  "social_title",
  "social_description",
  "social_image",
  "social_image_alt",
  "social_hashtags",
  "open_graph_type",
  "twitter_card",
]);

/**
 * Columns to SELECT from any content table to populate social metadata.
 * Append these to your SELECT string when fetching content rows.
 */
export const SOCIAL_SELECT_COLS =
  "social_title,social_description,social_image,social_image_alt,social_hashtags,open_graph_type,twitter_card";
