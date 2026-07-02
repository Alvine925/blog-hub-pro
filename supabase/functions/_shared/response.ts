export const CORS_HEADERS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, POST, PUT, DELETE, OPTIONS",
  "Access-Control-Allow-Headers": "Authorization, Content-Type, X-Requested-With, X-Visitor-Id",
};

// ── Meta & Links types ────────────────────────────────────────────────────────

export type ApiMeta = {
  page?: number;
  limit?: number;
  total?: number;
  totalPages?: number;
  [key: string]: unknown;
};

export type ApiLinks = {
  first?: string | null;
  previous?: string | null;
  next?: string | null;
  last?: string | null;
};

// ── Pagination link builder ───────────────────────────────────────────────────

/**
 * Build HATEOAS-style pagination links for list endpoints.
 *
 * @param baseUrl    - Full request URL (query params are preserved and page is overridden).
 * @param page       - Current page number (1-based).
 * @param totalPages - Total number of pages.
 */
export function buildPaginationLinks(
  baseUrl: string,
  page: number,
  totalPages: number,
): ApiLinks {
  if (!totalPages || totalPages <= 0) {
    return { first: null, previous: null, next: null, last: null };
  }

  function pageUrl(p: number): string {
    try {
      const u = new URL(baseUrl);
      u.searchParams.set("page", String(p));
      return u.toString();
    } catch {
      return baseUrl;
    }
  }

  return {
    first:    pageUrl(1),
    previous: page > 1 ? pageUrl(page - 1) : null,
    next:     page < totalPages ? pageUrl(page + 1) : null,
    last:     pageUrl(totalPages),
  };
}

// ── Response builders ─────────────────────────────────────────────────────────

/**
 * Return a successful JSON response.
 *
 * @param data    - Response payload.
 * @param meta    - Pagination / metadata (page, limit, total, totalPages, …).
 * @param status  - HTTP status code (default 200).
 * @param links   - HATEOAS pagination links (built with buildPaginationLinks).
 */
export function ok(
  data: unknown,
  meta: ApiMeta = {},
  status = 200,
  links: ApiLinks = {},
): Response {
  return Response.json(
    { success: true, data, meta, links },
    {
      status,
      headers: { ...CORS_HEADERS, "Content-Type": "application/json" },
    },
  );
}

/**
 * Return an error JSON response.
 *
 * @param code    - Machine-readable error code string.
 * @param message - Human-readable error description.
 * @param status  - HTTP status code.
 */
export function fail(code: string, message: string, status: number): Response {
  return Response.json(
    { success: false, error: { code, message } },
    {
      status,
      headers: { ...CORS_HEADERS, "Content-Type": "application/json" },
    },
  );
}

/** Return a 204 CORS preflight response. */
export function cors(): Response {
  return new Response(null, { status: 204, headers: CORS_HEADERS });
}
