import { createClient } from "jsr:@supabase/supabase-js@2";

export interface ApiKeyContext {
  keyId: string;
  workspaceId: string;
  keyType: "publishable" | "secret";
  permissions: string[];
}

export type AuthResult =
  | { ok: true; context: ApiKeyContext }
  | { ok: false; error: string; status: number };

/** Constant-time string comparison to prevent timing attacks. */
function safeEqual(a: string, b: string): boolean {
  if (a.length !== b.length) return false;
  let diff = 0;
  for (let i = 0; i < a.length; i++) {
    diff |= a.charCodeAt(i) ^ b.charCodeAt(i);
  }
  return diff === 0;
}

async function sha256hex(str: string): Promise<string> {
  const buf = await crypto.subtle.digest(
    "SHA-256",
    new TextEncoder().encode(str),
  );
  return Array.from(new Uint8Array(buf))
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
}

export async function validateApiKey(
  authHeader: string | null,
): Promise<AuthResult> {
  if (!authHeader) {
    return { ok: false, error: "MISSING_AUTH", status: 401 };
  }

  if (!authHeader.startsWith("Bearer ")) {
    return { ok: false, error: "INVALID_FORMAT", status: 401 };
  }

  const token = authHeader.slice(7).trim();

  // Reject obviously malformed tokens
  if (!token || token.length < 20) {
    return { ok: false, error: "INVALID_KEY", status: 401 };
  }

  const hash = await sha256hex(token);

  const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
  const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
  const supabase = createClient(supabaseUrl, serviceKey);

  const { data: key, error } = await supabase
    .from("api_keys")
    .select("id, workspace_id, key_type, permissions, status, expires_at")
    .eq("key_hash", hash)
    .single();

  // Use the same error regardless of why it failed (don't leak info)
  if (error || !key) {
    return { ok: false, error: "INVALID_KEY", status: 401 };
  }

  if (key.status !== "active") {
    return { ok: false, error: "INVALID_KEY", status: 401 };
  }

  if (key.expires_at && new Date(key.expires_at) <= new Date()) {
    return { ok: false, error: "INVALID_KEY", status: 401 };
  }

  if (!key.workspace_id) {
    return { ok: false, error: "INVALID_KEY", status: 401 };
  }

  // Fire-and-forget: update last_used_at
  supabase
    .from("api_keys")
    .update({ last_used_at: new Date().toISOString() })
    .eq("id", key.id)
    .then(() => {})
    .catch(() => {});

  return {
    ok: true,
    context: {
      keyId: key.id,
      workspaceId: key.workspace_id,
      keyType: (key.key_type ?? "publishable") as "publishable" | "secret",
      permissions: Array.isArray(key.permissions)
        ? (key.permissions as string[])
        : ["read:blogs", "read:pages", "read:media", "read:collections"],
    },
  };
}
