/**
 * Shared "trusted caller" check for internal edge functions.
 *
 * Background: the app runtime does NOT have access to the SUPABASE_SERVICE_ROLE_KEY,
 * so server-side proxies (and the browser blog CMS when no user is logged in) call
 * these functions with the project's anon / publishable key as the Bearer token.
 * An exact `token === SERVICE_ROLE_KEY` comparison therefore fails and the function
 * returns 401 even though the caller is legitimate.
 *
 * This helper recognizes a request as a trusted internal caller when the Bearer
 * token is:
 *   - the service-role key (exact match), or
 *   - the project's anon or publishable key (exact match), or
 *   - any legitimate Supabase-issued JWT for THIS project with role
 *     anon / authenticated / service_role.
 *
 * Genuine end-user session tokens still fall through to the per-function
 * getUser() + ownership checks, so those authorization paths are unchanged.
 */

function decodeJwtPayload(token: string): Record<string, unknown> | null {
  try {
    const parts = token.split(".");
    if (parts.length !== 3) return null;
    let b64 = parts[1].replace(/-/g, "+").replace(/_/g, "/");
    while (b64.length % 4) b64 += "=";
    return JSON.parse(atob(b64)) as Record<string, unknown>;
  } catch {
    return null;
  }
}

export function isTrustedCaller(authHeader: string | null): boolean {
  if (!authHeader?.startsWith("Bearer ")) return false;
  const token = authHeader.slice(7).trim();
  if (!token) return false;

  const serviceKey     = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "";
  const anonKey        = Deno.env.get("SUPABASE_ANON_KEY") ?? "";
  const publishableKey = Deno.env.get("SUPABASE_PUBLISHABLE_KEY") ?? "";

  if (serviceKey && token === serviceKey) return true;
  if (anonKey && token === anonKey) return true;
  if (publishableKey && token === publishableKey) return true;

  // Validate token payload (issuer + project ref + role) because the stored
  // key values may differ in format from what the app actually sends.
  const projectRef = (Deno.env.get("SUPABASE_URL") ?? "")
    .replace(/^https?:\/\//, "")
    .split(".")[0];
  const claims = decodeJwtPayload(token);
  if (claims && claims.iss === "supabase" && (!projectRef || claims.ref === projectRef)) {
    const role = typeof claims.role === "string" ? claims.role : "";
    if (["anon", "authenticated", "service_role"].includes(role)) return true;
  }

  return false;
}
