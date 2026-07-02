import { createClient } from "jsr:@supabase/supabase-js@2";

export interface RequestLog {
  workspaceId: string | null;
  apiKeyId: string | null;
  method: string;
  path: string;
  statusCode: number;
  durationMs: number;
  ipAddress: string | null;
  userAgent: string | null;
  error: string | null;
}

/** Write one row to api_request_logs. Never throws — logging must not break responses. */
export async function logRequest(log: RequestLog): Promise<void> {
  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, serviceKey);

    await supabase.from("api_request_logs").insert({
      workspace_id: log.workspaceId,
      api_key_id: log.apiKeyId,
      method: log.method,
      path: log.path,
      status_code: log.statusCode,
      duration_ms: log.durationMs,
      ip_address: log.ipAddress,
      user_agent: log.userAgent,
      error: log.error,
    });
  } catch {
    // Silently swallow — logging must never fail a request
  }
}
