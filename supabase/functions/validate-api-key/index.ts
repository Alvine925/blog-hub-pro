/**
 * validate-api-key — internal utility endpoint.
 *
 * Validates a Bearer token and returns the resolved key context.
 * Useful for other services / edge functions that need to verify
 * an API key without duplicating the auth logic.
 *
 * Call with the same Authorization header the client provided:
 *   POST https://<project>.supabase.co/functions/v1/validate-api-key
 *   Authorization: Bearer pk_live_xxxxxxxxxxxxxxxxxx
 *
 * Response on success:
 *   { success: true, data: { keyId, keyType, permissions, workspaceResolved: true } }
 *
 * Note: workspaceId is intentionally NOT returned to callers.
 */

import { validateApiKey } from "../_shared/auth.ts";
import { ok, fail, cors } from "../_shared/response.ts";
import { ERRORS } from "../_shared/errors.ts";

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") return cors();

  const result = await validateApiKey(req.headers.get("authorization"));

  if (!result.ok) {
    return fail(ERRORS.INVALID_KEY.code, ERRORS.INVALID_KEY.message, 401);
  }

  const { context } = result;

  // Never expose workspaceId to external callers
  return ok({
    keyId: context.keyId,
    keyType: context.keyType,
    permissions: context.permissions,
    workspaceResolved: true,
  });
});
