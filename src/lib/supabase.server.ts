import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/integrations/supabase/types";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";

// Parse the project .env file so server functions can read variables
// regardless of how Vite exposes them in the SSR context.
function loadDotEnv(): Record<string, string> {
  try {
    const envPath = resolve(process.cwd(), ".env");
    const raw = readFileSync(envPath, "utf-8");
    const result: Record<string, string> = {};
    for (const line of raw.split("\n")) {
      const trimmed = line.trim();
      if (!trimmed || trimmed.startsWith("#")) continue;
      const eqIdx = trimmed.indexOf("=");
      if (eqIdx === -1) continue;
      const key = trimmed.slice(0, eqIdx).trim();
      let val = trimmed.slice(eqIdx + 1).trim();
      if ((val.startsWith('"') && val.endsWith('"')) || (val.startsWith("'") && val.endsWith("'"))) {
        val = val.slice(1, -1);
      }
      result[key] = val;
    }
    return result;
  } catch {
    return {};
  }
}

// Lazily loaded .env values; process.env (Replit secrets) always take priority.
let _envCache: Record<string, string> | null = null;
function env(key: string): string | undefined {
  if (process.env[key]) return process.env[key] as string;
  if (!_envCache) _envCache = loadDotEnv();
  return _envCache[key];
}

function getUrl(): string {
  const url = env("SUPABASE_URL") ?? env("VITE_SUPABASE_URL");
  if (!url) throw new Error("Missing env var: SUPABASE_URL");
  return url;
}

function getServiceKey(): string {
  // Only accept actual service role keys — never fall back to publishable keys.
  // Falling back to a publishable key silently creates an admin client without
  // admin privileges, causing opaque RLS failures instead of a clear startup error.
  //
  // SECURITY: VITE_* prefixed variables are bundled into the browser by Vite.
  // The service role key must NEVER use a VITE_ prefix. Only SUPABASE_SERVICE_ROLE_KEY
  // (no VITE_ prefix) is accepted here.
  const key =
    env("SUPABASE_SERVICE_ROLE_KEY") ??
    env("SUPABASE_SERVICE_ROLE");
  if (!key) throw new Error("Missing env var: SUPABASE_SERVICE_ROLE_KEY — set it in Replit Secrets (never use VITE_ prefix for service role keys)");
  return key;
}

/**
 * Verify that the calling user has access to a workspace.
 * Uses the authenticated Supabase client (RLS-enforced) to check workspace ownership.
 * Throws a 403-style error if the user does not own the workspace.
 */
export async function verifyWorkspaceAccess(
  workspaceId: string,
  accessToken: string,
): Promise<void> {
  if (!accessToken) throw new Error("Forbidden: authentication required");
  const client = getAuthenticatedClient(accessToken);
  const { data } = await client
    .from("workspaces")
    .select("id")
    .eq("id", workspaceId)
    .maybeSingle();
  if (!data) throw new Error("Forbidden: you do not have access to this workspace");
}

function getPublishableKey(): string {
  const key = env("SUPABASE_PUBLISHABLE_KEY") ?? env("VITE_SUPABASE_PUBLISHABLE_KEY");
  if (!key) throw new Error("Missing env var: SUPABASE_PUBLISHABLE_KEY");
  return key;
}

/**
 * Server-side Supabase admin client using the service role key.
 * Bypasses RLS — only use server-side, never expose to the client.
 * Reads from Replit secrets first, then falls back to the project .env file.
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
