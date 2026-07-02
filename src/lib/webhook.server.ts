/**
 * webhook.server.ts — server-only webhook utilities
 *
 * This file uses the .server.ts suffix so TanStack Start's bundler
 * never includes it in the client bundle. Only import from server-side
 * code (server functions, Node.js middleware, .server.ts files).
 *
 * Re-exports getAdminClient so that dispatchWebhooks in webhook.functions.ts
 * can import from here instead of directly importing ./supabase.server,
 * which triggers the import-protection warning when that file is traced
 * through client-included modules.
 */

export { getAdminClient } from "./supabase.server";
