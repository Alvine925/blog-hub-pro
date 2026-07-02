export const CORS_HEADERS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, OPTIONS",
  "Access-Control-Allow-Headers": "Authorization, Content-Type, X-Requested-With",
};

export type ApiMeta = {
  page?: number;
  limit?: number;
  total?: number;
  totalPages?: number;
  [key: string]: unknown;
};

export function ok(data: unknown, meta: ApiMeta = {}, status = 200): Response {
  return Response.json(
    { success: true, data, meta },
    {
      status,
      headers: { ...CORS_HEADERS, "Content-Type": "application/json" },
    },
  );
}

export function fail(code: string, message: string, status: number): Response {
  return Response.json(
    { success: false, error: { code, message } },
    {
      status,
      headers: { ...CORS_HEADERS, "Content-Type": "application/json" },
    },
  );
}

export function cors(): Response {
  return new Response(null, { status: 204, headers: CORS_HEADERS });
}
