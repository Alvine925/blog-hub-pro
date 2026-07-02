/**
 * sanitize.ts — user-generated content sanitization utilities.
 *
 * Used by public write endpoints (comments) so raw HTML/script content
 * supplied by anonymous visitors never reaches storage or downstream
 * consumers unescaped.
 */

/** Strip all HTML tags from a string, leaving plain text only. */
export function stripTags(value: string): string {
  return value.replace(/<[^>]*>/g, "");
}

/** Escape HTML-significant characters so the string is safe to embed verbatim. */
export function escapeHtml(value: string): string {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

/** Sanitize free-text comment content: strip tags, collapse whitespace, cap length. */
export function sanitizeCommentContent(value: string, maxLen = 5000): string {
  const stripped = stripTags(value ?? "").trim();
  return stripped.slice(0, maxLen);
}

/** Basic email format check (structural only, no DNS/MX lookup). */
export function isValidEmail(value: string): boolean {
  return typeof value === "string" && /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value) && value.length <= 254;
}

/** Sanitize a plain-text display field (name, website): strip tags, trim, cap length. */
export function sanitizeText(value: string, maxLen = 200): string {
  return stripTags(value ?? "").trim().slice(0, maxLen);
}

/** Validate an http(s) URL, returning null if invalid or unsafe. */
export function sanitizeUrl(value: string | null | undefined): string | null {
  if (!value) return null;
  try {
    const u = new URL(value);
    if (u.protocol !== "http:" && u.protocol !== "https:") return null;
    return u.toString().slice(0, 500);
  } catch {
    return null;
  }
}
