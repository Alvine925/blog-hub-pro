/**
 * db.ts — shared Supabase service-role client for content-router services.
 *
 * The module-level singleton is safe: Deno edge isolates reuse the module
 * across warm invocations (one per concurrent request), so the client is
 * created at most once per isolate lifetime, not once globally.
 */
import { createClient, type SupabaseClient } from "jsr:@supabase/supabase-js@2";

let _client: SupabaseClient | null = null;

export function getDb(): SupabaseClient {
  if (_client) return _client;
  const url = Deno.env.get("SUPABASE_URL");
  const key = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
  if (!url || !key) throw new Error("Missing SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY");
  _client = createClient(url, key);
  return _client;
}
