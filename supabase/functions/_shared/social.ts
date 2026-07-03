/**
 * social.ts — Reusable SocialMetadata service for Lunar CMS.
 *
 * Every content transformer (blogs, news, articles, products, faqs, and any
 * future content type) calls `buildSocialMetadata` to produce the `social`
 * object that is embedded in every API response.
 *
 * Architecture note
 * ─────────────────
 * Lunar CMS is the *content provider*. It never generates share dialogs,
 * Facebook / LinkedIn URLs, or links pointing back to Lunar CMS.
 * Client websites are responsible for using `social.*` to:
 *   1. Populate Open Graph / Twitter Card <meta> tags.
 *   2. Build their own share buttons.
 *   3. Share the *client's own* page URL (window.location.href).
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
 * @param row        Raw DB row as a plain object.
 * @param defaultOgType  The og:type to use when the row has no `open_graph_type` column.
 *                   Pass "article" for blogs/news/articles, "product" for products,
 *                   "website" for FAQs/pages.
 */
export function buildSocialMetadata(
  row: Record<string, unknown>,
  defaultOgType: OgType,
): SocialMetadata {
  // ── Title ─────────────────────────────────────────────────────────────────
  const title = str(row.social_title)
    ?? str(row.seo_title)
    ?? str(row.title)
    ?? str(row.name)       // products
    ?? str(row.question)   // faqs
    ?? "";

  // ── Description ───────────────────────────────────────────────────────────
  const description = str(row.social_description)
    ?? str(row.meta_description)
    ?? str(row.seo_description)
    ?? str(row.excerpt)
    ?? str(row.description)  // products
    ?? str(row.answer)        // faqs (truncated)
    ?? "";

  // ── Image ─────────────────────────────────────────────────────────────────
  const image = str(row.social_image)
    ?? str(row.cover_image)
    ?? str(row.featured_image)
    ?? null;

  // ── Alt ───────────────────────────────────────────────────────────────────
  const alt = str(row.social_image_alt) ?? null;

  // ── Hashtags ──────────────────────────────────────────────────────────────
  let hashtags: string[] = [];
  if (Array.isArray(row.social_hashtags) && (row.social_hashtags as unknown[]).length > 0) {
    hashtags = (row.social_hashtags as unknown[]).map(String).filter(Boolean);
  } else if (Array.isArray(row.tags) && (row.tags as unknown[]).length > 0) {
    // Derive from tags: strip spaces, lowercase
    hashtags = (row.tags as unknown[])
      .map((t) => String(t).toLowerCase().replace(/\s+/g, ""))
      .filter(Boolean)
      .slice(0, 5);
  }

  // ── Twitter Card ──────────────────────────────────────────────────────────
  const twitterCard = str(row.twitter_card) ?? "summary_large_image";

  // ── OG Type ───────────────────────────────────────────────────────────────
  const type = str(row.open_graph_type) ?? defaultOgType;

  return { title, description, image, alt, hashtags, twitterCard, type };
}

// ── Internal helper ────────────────────────────────────────────────────────────

/** Return a non-empty string or undefined. */
function str(v: unknown): string | undefined {
  if (typeof v === "string" && v.trim().length > 0) return v.trim();
  return undefined;
}
