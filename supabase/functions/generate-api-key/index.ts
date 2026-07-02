/**
 * generate-api-key — creates a new API key for the calling user's workspace.
 *
 * The raw key is returned ONCE and never stored.
 * Only the SHA-256 hash is persisted in the database.
 *
 * POST https://<project>.supabase.co/functions/v1/generate-api-key
 * Authorization: Bearer <user-jwt>   (or service-role key for internal use)
 *
 * Body:
 * {
 *   "name":        "My website key",        // required
 *   "description": "Used by mysite.com",    // optional
 *   "key_type":    "publishable" | "secret",// default: publishable
 *   "expires_at":  "2027-01-01T00:00:00Z"  // optional ISO timestamp
 * }
 *
 * Response:
 * {
 *   "success": true,
 *   "data": {
 *     "id": "...",
 *     "name": "My website key",
 *     "key_prefix": "pk_live_abc1234",
 *     "key_type": "publishable",
 *     "permissions": [...],
 *     "status": "active",
 *     "created_at": "...",
 *     "key": "pk_live_xxxxxxxxxxxxxxxx"   ← shown ONCE
 *   },
 *   "meta": { "warning": "Store this key securely. It cannot be viewed again." }
 * }
 */

import { createClient } from "jsr:@supabase/supabase-js@2";
import { defaultPermissions } from "../_shared/permissions.ts";

const CORS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
};

async function sha256hex(str: string): Promise<string> {
  const buf = await crypto.subtle.digest(
    "SHA-256",
    new TextEncoder().encode(str),
  );
  return Array.from(new Uint8Array(buf))
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
}

function generateRawKey(type: "publishable" | "secret"): string {
  const bytes = new Uint8Array(32);
  crypto.getRandomValues(bytes);
  const hex = Array.from(bytes)
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
  return type === "secret" ? `sk_live_${hex}` : `pk_live_${hex}`;
}

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: CORS });
  }

  if (req.method !== "POST") {
    return Response.json(
      { success: false, error: { code: "METHOD_NOT_ALLOWED", message: "POST only" } },
      { status: 405, headers: CORS },
    );
  }

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const anonKey = Deno.env.get("SUPABASE_ANON_KEY")!;

    const authHeader = req.headers.get("authorization") ?? "";
    const db = createClient(supabaseUrl, serviceKey);

    // ── Resolve caller identity + workspace ─────────────────────────────
    let userId: string | null = null;
    let workspaceId: string | null = null;

    const isServiceRole = authHeader === `Bearer ${serviceKey}`;

    if (!isServiceRole && authHeader.startsWith("Bearer ")) {
      // JWT path — resolve user → workspace
      const userClient = createClient(supabaseUrl, anonKey, {
        global: { headers: { Authorization: authHeader } },
      });
      const {
        data: { user },
      } = await userClient.auth.getUser();

      if (user) {
        userId = user.id;
        const { data: ws } = await db
          .from("workspaces")
          .select("id")
          .eq("user_id", user.id)
          .single();
        workspaceId = ws?.id ?? null;
      }
    }

    // Fallback: default workspace (for service-role or un-linked users)
    if (!workspaceId) {
      const { data: ws } = await db
        .from("workspaces")
        .select("id")
        .eq("slug", "default")
        .single();
      workspaceId = ws?.id ?? null;
    }

    // ── Parse body ──────────────────────────────────────────────────────
    const body: Record<string, unknown> = await req.json().catch(() => ({}));

    const name =
      typeof body.name === "string" ? body.name.trim() : "";
    const description =
      typeof body.description === "string" ? body.description.trim() : null;
    const keyType: "publishable" | "secret" =
      body.key_type === "secret" ? "secret" : "publishable";
    const expiresAt =
      typeof body.expires_at === "string" ? body.expires_at : null;

    // ── Validate ────────────────────────────────────────────────────────
    if (!name) {
      return Response.json(
        { success: false, error: { code: "VALIDATION_ERROR", message: "name is required" } },
        { status: 400, headers: CORS },
      );
    }
    if (name.length > 100) {
      return Response.json(
        { success: false, error: { code: "VALIDATION_ERROR", message: "name must be 100 characters or fewer" } },
        { status: 400, headers: CORS },
      );
    }
    if (expiresAt && isNaN(Date.parse(expiresAt))) {
      return Response.json(
        { success: false, error: { code: "VALIDATION_ERROR", message: "expires_at must be a valid ISO 8601 timestamp" } },
        { status: 400, headers: CORS },
      );
    }

    // ── Generate + hash ─────────────────────────────────────────────────
    const rawKey = generateRawKey(keyType);
    const keyHash = await sha256hex(rawKey);
    // Store first 15 chars as prefix so users can identify the key (e.g. "pk_live_abc123")
    const keyPrefix = rawKey.slice(0, 15);
    const permissions = defaultPermissions(keyType);

    // ── Persist (hash only — never the raw key) ─────────────────────────
    const { data, error } = await db
      .from("api_keys")
      .insert({
        name,
        description,
        key_hash: keyHash,
        key_prefix: keyPrefix,
        key_type: keyType,
        permissions,
        status: "active",
        workspace_id: workspaceId,
        expires_at: expiresAt,
        created_by: userId,
      })
      .select(
        "id, name, description, key_prefix, key_type, permissions, status, expires_at, created_at",
      )
      .single();

    if (error) {
      return Response.json(
        { success: false, error: { code: "DATABASE_ERROR", message: error.message } },
        { status: 500, headers: CORS },
      );
    }

    // Return the raw key ONCE — it is never retrievable again
    return Response.json(
      {
        success: true,
        data: { ...data, key: rawKey },
        meta: {
          warning:
            "Store this key securely. It will never be shown again. If lost, generate a new key.",
        },
      },
      { headers: CORS },
    );
  } catch (err) {
    console.error("generate-api-key error:", err);
    return Response.json(
      {
        success: false,
        error: {
          code: "INTERNAL_SERVER_ERROR",
          message: "An unexpected error occurred.",
        },
      },
      { status: 500, headers: CORS },
    );
  }
});
