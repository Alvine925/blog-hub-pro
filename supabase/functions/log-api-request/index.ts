/**
 * log-api-request — internal function to write one row to api_request_logs.
 *
 * Only callable with the service-role key.
 * This exists as a standalone function so it can be invoked from
 * external systems or other edge functions without importing _shared directly.
 *
 * POST https://<project>.supabase.co/functions/v1/log-api-request
 * Authorization: Bearer <SUPABASE_SERVICE_ROLE_KEY>
 *
 * Body:
 * {
 *   "workspace_id": "uuid",
 *   "api_key_id": "uuid",
 *   "method": "GET",
 *   "path": "/blogs",
 *   "status_code": 200,
 *   "duration_ms": 42,
 *   "ip_address": "1.2.3.4",
 *   "user_agent": "...",
 *   "error": null
 * }
 */

import { logRequest } from "../_shared/logger.ts";

const CORS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, content-type",
};

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { status: 204, headers: CORS });
  }

  // Only allow service-role calls
  const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
  const authHeader = req.headers.get("authorization") ?? "";

  if (!serviceKey || authHeader !== `Bearer ${serviceKey}`) {
    return Response.json(
      { success: false, error: { code: "UNAUTHORIZED", message: "Unauthorized" } },
      { status: 401, headers: CORS },
    );
  }

  let body: Record<string, unknown>;
  try {
    body = await req.json();
  } catch {
    return Response.json(
      { success: false, error: { code: "INVALID_JSON", message: "Request body must be valid JSON" } },
      { status: 400, headers: CORS },
    );
  }

  await logRequest({
    workspaceId: typeof body.workspace_id === "string" ? body.workspace_id : null,
    apiKeyId: typeof body.api_key_id === "string" ? body.api_key_id : null,
    method: typeof body.method === "string" ? body.method : "GET",
    path: typeof body.path === "string" ? body.path : "/",
    statusCode: typeof body.status_code === "number" ? body.status_code : 200,
    durationMs: typeof body.duration_ms === "number" ? body.duration_ms : 0,
    ipAddress: typeof body.ip_address === "string" ? body.ip_address : null,
    userAgent: typeof body.user_agent === "string" ? body.user_agent : null,
    error: typeof body.error === "string" ? body.error : null,
  });

  return Response.json({ success: true }, { headers: CORS });
});
