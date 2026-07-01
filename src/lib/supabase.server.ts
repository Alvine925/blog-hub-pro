import type { SupabaseClient } from "@supabase/supabase-js";

/**
 * Server-only Supabase admin client (service role — bypasses RLS).
 * NEVER import this file from client/route/component code at module scope.
 * Import it INSIDE a server-function handler via `await import(...)`.
 *
 * Delegates to the generated integration client, which correctly supports
 * both legacy JWT keys and new-format `sb_secret_*` keys.
 */
export async function getAdminClient(): Promise<SupabaseClient> {
  const { supabaseAdmin } = await import(
    "@/integrations/supabase/client.server"
  );
  return supabaseAdmin as unknown as SupabaseClient;
}

export const BLOG_BUCKET = "blog-images";
