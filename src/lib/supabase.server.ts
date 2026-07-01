import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/integrations/supabase/types";

function getUrl(): string {
  const url =
    process.env.SUPABASE_URL ??
    process.env.VITE_SUPABASE_URL;
  if (!url) throw new Error("Missing env var: SUPABASE_URL");
  return url;
}

function getServiceKey(): string {
  const key =
    process.env.SUPABASE_SERVICE_ROLE_KEY ??
    process.env.VITE_SUPABASE_SERVICE_ROLE ??
    process.env.SUPABASE_SERVICE_ROLE ??
    process.env.SUPABASE_PUBLISHABLE_KEY ??
    process.env.VITE_SUPABASE_PUBLISHABLE_KEY;
  if (!key) throw new Error("Missing env var: SUPABASE_SERVICE_ROLE_KEY");
  return key;
}

function getPublishableKey(): string {
  const key =
    process.env.SUPABASE_PUBLISHABLE_KEY ??
    process.env.VITE_SUPABASE_PUBLISHABLE_KEY;
  if (!key) throw new Error("Missing env var: SUPABASE_PUBLISHABLE_KEY");
  return key;
}

/**
 * Server-side Supabase admin client using the service role key.
 * Bypasses RLS — only use server-side, never expose to the client.
 * Reads from .env: SUPABASE_SERVICE_ROLE_KEY or VITE_SUPABASE_SERVICE_ROLE
 */
export function getAdminClient(): SupabaseClient<Database> {
  return createClient<Database>(getUrl(), getServiceKey(), {
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
  return createClient<Database>(getUrl(), getPublishableKey(), {
    global: { headers: { Authorization: `Bearer ${accessToken}` } },
    auth: {
      storage: undefined,
      persistSession: false,
      autoRefreshToken: false,
    },
  });
}

export const BLOG_BUCKET = "blog-images";
