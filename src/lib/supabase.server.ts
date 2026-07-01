import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/integrations/supabase/types";

/**
 * Server-side Supabase client using the publishable (anon) key.
 *
 * NOTE: The service-role key is not available to this app's server runtime
 * (the `SUPABASE_` secret prefix is reserved/managed and only injected into
 * the deployed worker, not the preview). Admin auth is deferred, so blog
 * CRUD runs against the anon key and the database policies are opened
 * accordingly. Add authentication + tighten RLS before going to production.
 */
export function getAdminClient(): SupabaseClient<Database> {
  const url = process.env.SUPABASE_URL;
  const key = process.env.SUPABASE_PUBLISHABLE_KEY;

  if (!url || !key) {
    const missing = [
      ...(!url ? ["SUPABASE_URL"] : []),
      ...(!key ? ["SUPABASE_PUBLISHABLE_KEY"] : []),
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

export const BLOG_BUCKET = "blog-images";
