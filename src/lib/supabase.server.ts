import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/integrations/supabase/types";

/**
 * Server-side Supabase admin client using the service role key.
 * Bypasses RLS — only use server-side, never expose to the client.
 */
export function getAdminClient(): SupabaseClient<Database> {
  const url = process.env.SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY ?? process.env.SUPABASE_PUBLISHABLE_KEY;

  if (!url || !key) {
    const missing = [
      ...(!url ? ["SUPABASE_URL"] : []),
      ...(!key ? ["SUPABASE_SERVICE_ROLE_KEY"] : []),
    ];
    throw new Error(
      `Missing Supabase environment variable(s): ${missing.join(", ")}.`,
    );
  }

  return createClient<Database>(url, key, {
    auth: {
      storage: undefined,
      persistSession: false,
      autoRefreshToken: false,
    },
  });
}

/**
 * Server-side Supabase client authenticated with the user's JWT.
 * Uses the `authenticated` role so RLS policies resolve auth.uid() correctly.
 */
export function getAuthenticatedClient(accessToken: string): SupabaseClient<Database> {
  const url = process.env.SUPABASE_URL;
  const key = process.env.SUPABASE_PUBLISHABLE_KEY;

  if (!url || !key) {
    throw new Error("Missing Supabase environment variable(s): SUPABASE_URL, SUPABASE_PUBLISHABLE_KEY.");
  }

  return createClient<Database>(url, key, {
    global: { headers: { Authorization: `Bearer ${accessToken}` } },
    auth: {
      storage: undefined,
      persistSession: false,
      autoRefreshToken: false,
    },
  });
}

export const BLOG_BUCKET = "blog-images";
