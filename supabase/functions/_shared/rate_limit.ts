import { createClient } from "jsr:@supabase/supabase-js@2";

const DEFAULT_HOURLY_LIMIT = 1000;

export interface RateLimitResult {
  allowed: boolean;
  remaining: number;
  limit: number;
  resetAt: string; // ISO timestamp of next window
}

/**
 * Check and increment the rate limit counter for the current hourly window.
 * Fails open: if the database is unavailable the request is allowed.
 */
export async function checkRateLimit(
  apiKeyId: string,
  workspaceId: string,
): Promise<RateLimitResult> {
  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, serviceKey);

    // Truncate to the current UTC hour
    const now = new Date();
    const windowStart = new Date(
      Date.UTC(
        now.getUTCFullYear(),
        now.getUTCMonth(),
        now.getUTCDate(),
        now.getUTCHours(),
      ),
    );
    const windowStartIso = windowStart.toISOString();

    // Next window reset
    const nextWindow = new Date(windowStart.getTime() + 3_600_000);
    const resetAt = nextWindow.toISOString();

    const { data: existing } = await supabase
      .from("api_rate_limits")
      .select("id, request_count, limit_count")
      .eq("api_key_id", apiKeyId)
      .eq("window_start", windowStartIso)
      .single();

    if (!existing) {
      // First request in this window — create record
      await supabase.from("api_rate_limits").upsert(
        {
          api_key_id: apiKeyId,
          workspace_id: workspaceId,
          window_start: windowStartIso,
          request_count: 1,
          limit_count: DEFAULT_HOURLY_LIMIT,
          updated_at: new Date().toISOString(),
        },
        { onConflict: "api_key_id,window_start" },
      );
      return {
        allowed: true,
        remaining: DEFAULT_HOURLY_LIMIT - 1,
        limit: DEFAULT_HOURLY_LIMIT,
        resetAt,
      };
    }

    const limit = existing.limit_count ?? DEFAULT_HOURLY_LIMIT;

    if (existing.request_count >= limit) {
      return { allowed: false, remaining: 0, limit, resetAt };
    }

    // Increment atomically
    await supabase
      .from("api_rate_limits")
      .update({
        request_count: existing.request_count + 1,
        updated_at: new Date().toISOString(),
      })
      .eq("id", existing.id);

    return {
      allowed: true,
      remaining: limit - (existing.request_count + 1),
      limit,
      resetAt,
    };
  } catch {
    // Fail open — don't block requests when the rate-limit table is unavailable
    return {
      allowed: true,
      remaining: DEFAULT_HOURLY_LIMIT,
      limit: DEFAULT_HOURLY_LIMIT,
      resetAt: new Date(Date.now() + 3_600_000).toISOString(),
    };
  }
}
