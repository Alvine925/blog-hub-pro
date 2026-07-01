// Supabase Edge Function: create in-app notifications.
// Optionally uses AI to draft the body from a brief.
// Primary:  Lovable AI gateway  (LOVABLE_API_KEY)  → google/gemini-3-flash-preview
// Fallback: Mistral AI           (MISTRAL_API_KEY)  → mistral-large-latest
// Requires a valid Supabase JWT or service-role key.

import { createClient } from "jsr:@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

const LOVABLE_GATEWAY = "https://ai.gateway.lovable.dev/v1/chat/completions";
const LOVABLE_MODEL   = "google/gemini-3-flash-preview";

const MISTRAL_GATEWAY = "https://api.mistral.ai/v1/chat/completions";
const MISTRAL_MODEL   = "mistral-large-latest";

interface ChatMessage { role: "system" | "user" | "assistant"; content: string }

/** Generate notification body text with primary → Mistral fallback. Best-effort — never throws. */
async function generateBody(brief: string): Promise<string | null> {
  const system: ChatMessage = {
    role: "system",
    content:
      "You write concise, clear in-app notification messages for a CMS platform. Return 1-2 sentences only — no formatting, no markdown.",
  };
  const user: ChatMessage = { role: "user", content: brief };

  const lovableKey = Deno.env.get("LOVABLE_API_KEY");
  const mistralKey = Deno.env.get("MISTRAL_API_KEY");

  // Try Lovable first
  if (lovableKey) {
    try {
      const res = await fetch(LOVABLE_GATEWAY, {
        method: "POST",
        headers: { Authorization: `Bearer ${lovableKey}`, "Content-Type": "application/json" },
        body: JSON.stringify({ model: LOVABLE_MODEL, messages: [system, user] }),
      });
      if (res.ok) {
        const data = await res.json();
        const text = (data?.choices?.[0]?.message?.content ?? "").trim();
        if (text) return text;
      }
      // Non-ok or empty → fall through to Mistral
    } catch {
      // Network error → fall through
    }
  }

  // Try Mistral as fallback
  if (mistralKey) {
    try {
      const res = await fetch(MISTRAL_GATEWAY, {
        method: "POST",
        headers: { Authorization: `Bearer ${mistralKey}`, "Content-Type": "application/json" },
        body: JSON.stringify({ model: MISTRAL_MODEL, messages: [system, user] }),
      });
      if (res.ok) {
        const data = await res.json();
        return (data?.choices?.[0]?.message?.content ?? "").trim() || null;
      }
    } catch {
      // Best-effort — proceed without AI-generated body
    }
  }

  return null;
}

interface NotificationPayload {
  brief?:        string;
  type:          string;
  title:         string;
  body?:         string;
  action_url?:   string;
  action_label?: string;
  metadata?:     Record<string, unknown>;
}

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  const supabaseUrl        = Deno.env.get("SUPABASE_URL")!;
  const supabaseAnonKey    = Deno.env.get("SUPABASE_ANON_KEY")!;
  const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

  // ── Auth ─────────────────────────────────────────────────────────────────
  const authHeader = req.headers.get("authorization") ?? "";
  if (!authHeader.startsWith("Bearer ")) {
    return json({ error: "Unauthorized" }, 401);
  }

  const isServiceRole = authHeader === `Bearer ${supabaseServiceKey}`;
  if (!isServiceRole) {
    const callerClient = createClient(supabaseUrl, supabaseAnonKey, {
      global: { headers: { Authorization: authHeader } },
    });
    const { data: { user } } = await callerClient.auth.getUser();
    if (!user) return json({ error: "Unauthorized" }, 401);
  }

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const adminClient = createClient(supabaseUrl, supabaseServiceKey) as any;

  // Server-side workspace resolution — never trust client-supplied IDs
  const { data: defaultWs } = await adminClient
    .from("workspaces").select("id").eq("slug", "default").single();
  const workspaceId: string | null = defaultWs?.id ?? null;

  // ── Parse payload ─────────────────────────────────────────────────────────
  let payload: NotificationPayload | NotificationPayload[];
  try { payload = await req.json(); }
  catch { return json({ error: "Invalid JSON" }, 400); }

  const notifications = Array.isArray(payload) ? payload : [payload];

  // Process all notifications (AI body generation is parallelised)
  const toInsert = await Promise.all(
    notifications.map(async (n) => {
      let body = n.body ?? null;

      // Generate body via AI when a brief is supplied but no explicit body
      if (!body && n.brief) {
        body = await generateBody(n.brief);
      }

      return {
        workspace_id: workspaceId,
        user_id:      null,
        type:         n.type,
        title:        n.title,
        body,
        action_url:   n.action_url   ?? null,
        action_label: n.action_label ?? null,
        metadata:     n.metadata     ?? {},
      };
    }),
  );

  const { data, error } = await adminClient.from("notifications").insert(toInsert).select();

  if (error) return json({ error: error.message }, 500);
  return json({ ok: true, notifications: data });
});

function json(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}
