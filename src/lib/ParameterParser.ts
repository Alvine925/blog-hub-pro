/**
 * ParameterParser.ts
 *
 * Utilities for rendering parameter tables and building unified parameter
 * lists from EndpointRegistry definitions. The DocumentationService and
 * UI components consume these helpers directly.
 */

import type { QueryParam, EndpointDefinition } from "./EndpointRegistry";

export interface ParsedParam extends QueryParam {
  source: "path" | "query" | "pagination" | "search";
}

// ── Standard pagination params injected for every paginated endpoint ──────────

export const PAGINATION_PARAMS: QueryParam[] = [
  {
    name: "limit",
    type: "integer",
    required: false,
    default: "20",
    description: "Number of results per page. Maximum: 100.",
    example: "10",
  },
  {
    name: "offset",
    type: "integer",
    required: false,
    default: "0",
    description: "Number of results to skip (0-based). Use with limit for pagination.",
    example: "20",
  },
];

// ── Standard search param ─────────────────────────────────────────────────────

export const SEARCH_PARAM: QueryParam = {
  name: "search",
  type: "string",
  required: false,
  description: "Full-text search query. Searches title and excerpt fields.",
  example: "marketing strategy",
};

// ── Build full parameter list for an endpoint ─────────────────────────────────

export function buildParamList(endpoint: EndpointDefinition): ParsedParam[] {
  const params: ParsedParam[] = [];

  // Path params first
  for (const p of endpoint.pathParams ?? []) {
    params.push({ ...p, source: "path" });
  }

  // Endpoint-specific query params
  for (const p of endpoint.queryParams) {
    params.push({ ...p, source: "query" });
  }

  // Auto-inject pagination
  if (endpoint.pagination) {
    for (const p of PAGINATION_PARAMS) {
      params.push({ ...p, source: "pagination" });
    }
  }

  // Auto-inject search (only if not already in queryParams)
  if (endpoint.search && !endpoint.queryParams.find((p) => p.name === "search")) {
    params.push({ ...SEARCH_PARAM, source: "search" });
  }

  return params;
}

// ── Format a single param for display ─────────────────────────────────────────

export function formatParamType(param: ParsedParam): string {
  if (param.type === "enum" && param.enumValues) {
    return `enum (${param.enumValues.join(" | ")})`;
  }
  return param.type;
}

// ── Build example URL with query params ───────────────────────────────────────

export function buildExampleUrl(
  baseUrl: string,
  endpoint: EndpointDefinition,
  pathValues?: Record<string, string>,
): string {
  let path = endpoint.path;

  // Replace path params
  const pathPs = endpoint.pathParams ?? [];
  for (const p of pathPs) {
    const val = pathValues?.[p.name] ?? p.example;
    path = path.replace(`:${p.name}`, val);
  }

  // API is always served under /api/v1/... in this project
  const url = `${baseUrl}/api/v1${path}`;

  // Build query string from examples
  const qs: string[] = [];

  // First endpoint-specific query param example
  const firstQp = endpoint.queryParams[0];
  if (firstQp) qs.push(`${firstQp.name}=${encodeURIComponent(firstQp.example)}`);

  // Pagination uses limit + offset (matches api-handler.node.ts contract)
  if (endpoint.pagination) qs.push("limit=10", "offset=0");

  return qs.length ? `${url}?${qs.join("&")}` : url;
}
