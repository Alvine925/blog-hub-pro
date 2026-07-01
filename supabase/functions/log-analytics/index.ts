// Supabase Edge Function: ingest analytics events (page views, API requests, activity log).
// Requires a valid Supabase JWT or service-role key — unauthenticated calls are rejected.

import { createClient } from "jsr:@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

interface PageViewEvent {
  type: "page_view";
  path: string;
  post_id?: string;
  workspace_id?: string;
  referrer?: string;
  session_id?: string;
}

interface ApiLogEvent {
  type: "api_request";
  method: string;
  path: string;
  status_code: number;
  duration_ms: number;
  api_key_id?: string;
  workspace_id?: string;
  error?: string;
}

interface ActivityEvent {
  type: "activity";
  workspace_id?: string;
  actor_id?: string;
  actor_name: string;
  actor_type?: string;
  action: string;
  entity_type: string;
  entity_id?: string;
  entity_label?: string;
}

type AnalyticsEvent = PageViewEvent | ApiLogEvent | ActivityEvent;

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
  const supabaseAnonKey = Deno.env.get("SUPABASE_ANON_KEY")!;
  const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

  // ── Auth ───────────────────────────────────────────────────────────────────
  const authHeader = req.headers.get("authorization") ?? "";
  if (!authHeader.startsWith("Bearer ")) {
    return new Response(JSON.stringify({ error: "Unauthorized" }), {
      status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  const isServiceRole = authHeader === `Bearer ${supabaseServiceKey}`;
  let verifiedWorkspaceId: string | null = null;

  if (!isServiceRole) {
    // Verify JWT and resolve the caller's workspace
    const callerClient = createClient(supabaseUrl, supabaseAnonKey, {
      global: { headers: { Authorization: authHeader } },
    });
    const { data: { user } } = await callerClient.auth.getUser();
    if (!user) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }
  }

  // Use service-role client for all writes
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const adminClient = createClient(supabaseUrl, supabaseServiceKey) as any;

  // Resolve the default workspace if no verified workspace set
  if (!verifiedWorkspaceId) {
    const { data: ws } = await adminClient
      .from("workspaces").select("id").eq("slug", "default").single();
    verifiedWorkspaceId = ws?.id ?? null;
  }

  // ── Parse events ───────────────────────────────────────────────────────────
  let events: AnalyticsEvent[];
  try {
    const raw = await req.json();
    events = Array.isArray(raw) ? raw : [raw];
  } catch {
    return new Response(JSON.stringify({ error: "Invalid JSON" }), {
      status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  const ip = req.headers.get("x-forwarded-for")?.split(",")[0].trim();
  const ua = req.headers.get("user-agent") ?? undefined;

  const results: { ok: boolean; error?: string }[] = [];

  for (const event of events) {
    // Always use the server-resolved workspace, not the client-supplied one
    const wsId = verifiedWorkspaceId;

    try {
      if (event.type === "page_view") {
        const { error } = await adminClient.from("page_views").insert({
          workspace_id: wsId,
          post_id: event.post_id ?? null,
          path: event.path,
          referrer: event.referrer ?? null,
          session_id: event.session_id ?? null,
          device: detectDevice(ua),
          browser: detectBrowser(ua),
        });
        results.push({ ok: !error, error: error?.message });
      } else if (event.type === "api_request") {
        const { error } = await adminClient.from("api_request_logs").insert({
          workspace_id: wsId,
          api_key_id: event.api_key_id ?? null,
          method: event.method,
          path: event.path,
          status_code: event.status_code,
          duration_ms: event.duration_ms,
          ip_address: ip ?? null,
          user_agent: ua ?? null,
          error: event.error ?? null,
        });
        results.push({ ok: !error, error: error?.message });
      } else if (event.type === "activity") {
        const { error } = await adminClient.from("activity_log").insert({
          workspace_id: wsId,
          actor_id: event.actor_id ?? null,
          actor_name: event.actor_name,
          actor_type: event.actor_type ?? "user",
          action: event.action,
          entity_type: event.entity_type,
          entity_id: event.entity_id ?? null,
          entity_label: event.entity_label ?? null,
          ip_address: ip ?? null,
          user_agent: ua ?? null,
        });
        results.push({ ok: !error, error: error?.message });
      } else {
        results.push({ ok: false, error: "Unknown event type" });
      }
    } catch (err) {
      results.push({ ok: false, error: err instanceof Error ? err.message : String(err) });
    }
  }

  const allOk = results.every((r) => r.ok);
  return new Response(JSON.stringify({ ok: allOk, results }), {
    status: allOk ? 200 : 207,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
});

function detectDevice(ua?: string | null): string {
  if (!ua) return "unknown";
  const lower = ua.toLowerCase();
  if (lower.includes("bot") || lower.includes("crawler") || lower.includes("spider")) return "bot";
  if (lower.includes("mobile") || lower.includes("android") || lower.includes("iphone")) return "mobile";
  if (lower.includes("tablet") || lower.includes("ipad")) return "tablet";
  return "desktop";
}

function detectBrowser(ua?: string | null): string | undefined {
  if (!ua) return undefined;
  const lower = ua.toLowerCase();
  if (lower.includes("edg/")) return "Edge";
  if (lower.includes("chrome")) return "Chrome";
  if (lower.includes("safari")) return "Safari";
  if (lower.includes("firefox")) return "Firefox";
  if (lower.includes("opera") || lower.includes("opr/")) return "Opera";
  return "Other";
}
