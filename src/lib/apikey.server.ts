/**
 * apikey.server.ts — server-only API key utilities
 *
 * This file uses the .server.ts suffix so TanStack Start's bundler
 * never includes it in the client bundle. Only import from server-side
 * code (server functions, Node.js middleware, .server.ts files).
 */

import { getAdminClient } from "./supabase.server";

/** Validate a raw API key by comparing its SHA-256 hash against the database. */
export async function validateApiKey(raw: string): Promise<boolean> {
  const { createHash } = await import("node:crypto");
  const supabase = getAdminClient();
  const hash = createHash("sha256").update(raw).digest("hex");
  const { data, error } = await supabase
    .from("api_keys")
    .select("id, status, revoked_at, expires_at")
    .eq("key_hash", hash)
    .maybeSingle();
  if (error || !data) return false;
  const isRevoked = data.status === "revoked" || Boolean(data.revoked_at);
  const isExpired = data.expires_at && new Date(data.expires_at) <= new Date();
  if (isRevoked || isExpired) return false;
  await supabase
    .from("api_keys")
    .update({ last_used_at: new Date().toISOString() })
    .eq("id", data.id);
  return true;
}
