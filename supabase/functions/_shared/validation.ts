/**
 * validation.ts — input validation utilities for the Lunar CMS API gateway.
 *
 * Handles structural validation of incoming request data before any
 * business logic or database queries run. All auth-specific validation
 * (key format, hash lookup) lives in auth.ts; this module covers general
 * request hygiene.
 */

// ── Token format ────────────────────────────────────────────────────────────

/** Accepted key prefixes */
const VALID_PREFIXES = ["pk_live_", "sk_live_"] as const;

/**
 * Returns true if the raw token string looks structurally valid.
 * Does NOT verify the key against the database.
 */
export function isValidTokenFormat(token: string): boolean {
  if (!token || typeof token !== "string") return false;
  const hasPrefix = VALID_PREFIXES.some((p) => token.startsWith(p));
  if (!hasPrefix) return false;
  // After the prefix the payload must be at least 16 characters
  const payload = token.slice(token.indexOf("_", 3) + 1); // after "pk_live_"
  return payload.length >= 16;
}

/**
 * Extracts and validates the Bearer token from an Authorization header.
 * Returns the raw token string or null if the header is absent / malformed.
 */
export function extractBearerToken(authHeader: string | null): string | null {
  if (!authHeader) return null;
  const [scheme, token] = authHeader.trim().split(/\s+/, 2);
  if (scheme?.toLowerCase() !== "bearer" || !token) return null;
  if (!isValidTokenFormat(token)) return null;
  return token;
}

// ── Pagination ───────────────────────────────────────────────────────────────

export interface PaginationParams {
  page: number;
  limit: number;
  offset: number;
}

export function parsePaginationParams(url: URL): PaginationParams {
  const page = Math.max(1, parseInt(url.searchParams.get("page") ?? "1", 10) || 1);
  const limit = Math.min(100, Math.max(1, parseInt(url.searchParams.get("limit") ?? "20", 10) || 20));
  return { page, limit, offset: (page - 1) * limit };
}

// ── String sanitisation ─────────────────────────────────────────────────────

/**
 * Strips characters that are dangerous in ILIKE patterns before they reach
 * the database. Does not escape — simply removes % and _ wildcards supplied
 * by the caller.
 */
export function sanitiseSearchTerm(term: string): string {
  return term.replace(/[%_\\]/g, "").slice(0, 200);
}

// ── Slug validation ─────────────────────────────────────────────────────────

const SLUG_RE = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;

export function isValidSlug(value: string): boolean {
  return typeof value === "string" && value.length > 0 && value.length <= 200 && SLUG_RE.test(value);
}
