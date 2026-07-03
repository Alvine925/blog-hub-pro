import { createServerFn, createServerOnlyFn } from "@tanstack/react-start";
import { z } from "zod";

export const WEBHOOK_EVENTS = [
  "post.published",
  "post.updated",
  "post.unpublished",
  "post.deleted",
  "cache.invalidate",
] as const;

export type WebhookEvent = (typeof WEBHOOK_EVENTS)[number];

export interface Webhook {
  id: string;
  name: string;
  url: string;
  secret: string;
  events: WebhookEvent[];
  active: boolean;
  created_at: string;
}

export interface WebhookLog {
  id: string;
  webhook_id: string;
  event: string;
  response_status: number | null;
  duration_ms: number | null;
  error: string | null;
  delivered_at: string;
}

export interface TestDeliveryResult {
  status: number | null;
  duration_ms: number;
  error: string | null;
}

// ---------------------------------------------------------------------------
// CRUD
// ---------------------------------------------------------------------------

export const listWebhooks = createServerFn({ method: "GET" }).handler(
  async (): Promise<Webhook[]> => {
    const { getAdminClient } = await import("./supabase.server");
    const supabase = await getAdminClient();
    const { data, error } = await supabase
      .from("webhooks")
      .select("*")
      .order("created_at", { ascending: false });
    if (error) {
      if (error.message.includes("schema cache") || error.code === "PGRST204") return [];
      throw new Error(error.message);
    }
    return (data ?? []) as Webhook[];
  },
);

export const getWebhookLogs = createServerFn({ method: "GET" })
  .validator((input: { webhookId: string }) =>
    z.object({ webhookId: z.string().uuid() }).parse(input),
  )
  .handler(async ({ data }): Promise<WebhookLog[]> => {
    const { getAdminClient } = await import("./supabase.server");
    const supabase = await getAdminClient();
    const { data: rows, error } = await supabase
      .from("webhook_logs")
      .select("*")
      .eq("webhook_id", data.webhookId)
      .order("delivered_at", { ascending: false })
      .limit(20);
    if (error) {
      if (error.message.includes("schema cache") || error.code === "PGRST204") return [];
      throw new Error(error.message);
    }
    return (rows ?? []) as WebhookLog[];
  });

export const createWebhook = createServerFn({ method: "POST" })
  .validator((input: { name: string; url: string; secret: string; events: string[] }) =>
    z
      .object({
        name: z.string().trim().min(1).max(100),
        url: z.string().url(),
        secret: z.string().max(200).default(""),
        events: z.array(z.string()).min(1),
      })
      .parse(input),
  )
  .handler(async ({ data }): Promise<{ id: string }> => {
    const { getAdminClient } = await import("./supabase.server");
    const supabase = await getAdminClient();
    const { data: row, error } = await supabase
      .from("webhooks")
      .insert({ name: data.name, url: data.url, secret: data.secret, events: data.events })
      .select("id")
      .single();
    if (error) throw new Error(error.message);
    return { id: row.id };
  });

export const updateWebhook = createServerFn({ method: "POST" })
  .validator(
    (input: { id: string; name: string; url: string; secret: string; events: string[]; active: boolean }) =>
      z
        .object({
          id: z.string().uuid(),
          name: z.string().trim().min(1).max(100),
          url: z.string().url(),
          secret: z.string().max(200).default(""),
          events: z.array(z.string()).min(1),
          active: z.boolean(),
        })
        .parse(input),
  )
  .handler(async ({ data }): Promise<{ ok: true }> => {
    const { getAdminClient } = await import("./supabase.server");
    const supabase = await getAdminClient();
    const { error } = await supabase
      .from("webhooks")
      .update({ name: data.name, url: data.url, secret: data.secret, events: data.events, active: data.active })
      .eq("id", data.id);
    if (error) throw new Error(error.message);
    return { ok: true };
  });

export const deleteWebhook = createServerFn({ method: "POST" })
  .validator((input: { id: string }) => z.object({ id: z.string().uuid() }).parse(input))
  .handler(async ({ data }): Promise<{ ok: true }> => {
    const { getAdminClient } = await import("./supabase.server");
    const supabase = await getAdminClient();
    const { error } = await supabase.from("webhooks").delete().eq("id", data.id);
    if (error) throw new Error(error.message);
    return { ok: true };
  });

export const toggleWebhook = createServerFn({ method: "POST" })
  .validator((input: { id: string; active: boolean }) =>
    z.object({ id: z.string().uuid(), active: z.boolean() }).parse(input),
  )
  .handler(async ({ data }): Promise<{ ok: true }> => {
    const { getAdminClient } = await import("./supabase.server");
    const supabase = await getAdminClient();
    const { error } = await supabase.from("webhooks").update({ active: data.active }).eq("id", data.id);
    if (error) throw new Error(error.message);
    return { ok: true };
  });

// ---------------------------------------------------------------------------
// TEST DELIVERY
// ---------------------------------------------------------------------------

export const testWebhookDelivery = createServerFn({ method: "POST" })
  .validator((input: { id: string }) => z.object({ id: z.string().uuid() }).parse(input))
  .handler(async ({ data }): Promise<TestDeliveryResult> => {
    const { getAdminClient } = await import("./supabase.server");
    const supabase = await getAdminClient();

    const { data: hook, error: hookError } = await supabase
      .from("webhooks")
      .select("url, secret")
      .eq("id", data.id)
      .single();

    if (hookError || !hook) throw new Error("Webhook not found");

    const body = JSON.stringify({
      event: "test",
      timestamp: new Date().toISOString(),
      data: {
        id: "00000000-0000-0000-0000-000000000000",
        slug: "test-delivery",
        title: "Test Delivery from Lunar CMS",
        status: "published",
        category: "General",
        author_name: "Lunar CMS",
      },
    });

    const headers: Record<string, string> = {
      "Content-Type": "application/json",
      "User-Agent": "LunarCMS/1.0",
      "X-Lunar-Event": "test",
    };

    if (hook.secret) {
      const { createHmac } = await import("node:crypto");
      headers["X-Lunar-Signature"] = "sha256=" + createHmac("sha256", hook.secret).update(body).digest("hex");
    }

    const start = Date.now();
    let status: number | null = null;
    let error: string | null = null;

    try {
      const res = await fetch(hook.url, {
        method: "POST",
        headers,
        body,
        signal: AbortSignal.timeout(10_000),
      });
      status = res.status;
    } catch (err) {
      error = err instanceof Error ? err.message : String(err);
    }

    const duration_ms = Date.now() - start;

    await supabase.from("webhook_logs").insert({
      webhook_id: data.id,
      event: "test",
      response_status: status,
      duration_ms,
      error,
    });

    return { status, duration_ms, error };
  });

// ---------------------------------------------------------------------------
// MANUAL CACHE PURGE
// ---------------------------------------------------------------------------

export const triggerManualCachePurge = createServerFn({ method: "POST" })
  .validator((input: { webhookId?: string }) =>
    z.object({ webhookId: z.string().uuid().optional() }).parse(input),
  )
  .handler(async ({ data }): Promise<{ fired: number; results: Array<{ url: string; status: number | null; duration_ms: number; error: string | null }> }> => {
    const { getAdminClient } = await import("./supabase.server");
    const supabase = await getAdminClient();

    let query = (supabase as any)
      .from("webhooks")
      .select("*")
      .eq("active", true)
      .contains("events", ["cache.invalidate"]);

    if (data.webhookId) query = query.eq("id", data.webhookId);

    const { data: hooks, error } = await query;
    if (error || !hooks || hooks.length === 0) return { fired: 0, results: [] };

    const body = JSON.stringify({
      event: "cache.invalidate",
      timestamp: new Date().toISOString(),
      data: {
        reason: "manual_purge",
        triggered_by: "user",
      },
    });

    const results = await Promise.all(
      hooks.map(async (hook: Webhook) => {
        const start = Date.now();
        let status: number | null = null;
        let errorMsg: string | null = null;

        try {
          const hdrs: Record<string, string> = {
            "Content-Type": "application/json",
            "User-Agent": "LunarCMS/1.0",
            "X-Lunar-Event": "cache.invalidate",
          };
          if (hook.secret) {
            const { createHmac } = await import("node:crypto");
            hdrs["X-Lunar-Signature"] = "sha256=" + createHmac("sha256", hook.secret).update(body).digest("hex");
          }
          const res = await fetch(hook.url, {
            method: "POST", headers: hdrs, body,
            signal: AbortSignal.timeout(10_000),
          });
          status = res.status;
        } catch (err) {
          errorMsg = err instanceof Error ? err.message : String(err);
        }

        const duration_ms = Date.now() - start;
        await (supabase as any).from("webhook_logs").insert({
          webhook_id: hook.id,
          event: "cache.invalidate",
          response_status: status,
          duration_ms,
          error: errorMsg,
        });

        return { url: hook.url, status, duration_ms, error: errorMsg };
      }),
    );

    return { fired: results.length, results };
  });

// ---------------------------------------------------------------------------
// MANUAL RETRY
// ---------------------------------------------------------------------------

export const retryWebhookDelivery = createServerFn({ method: "POST" })
  .validator((input: { logId: string }) =>
    z.object({ logId: z.string().uuid() }).parse(input),
  )
  .handler(async ({ data }): Promise<TestDeliveryResult> => {
    const { getAdminClient } = await import("./supabase.server");
    const supabase = await getAdminClient();

    // Look up the original log entry
    const { data: log, error: logError } = await (supabase as any)
      .from("webhook_logs")
      .select("webhook_id, event")
      .eq("id", data.logId)
      .single();
    if (logError || !log) throw new Error("Delivery log not found");

    // Look up the webhook
    const { data: hook, error: hookError } = await (supabase as any)
      .from("webhooks")
      .select("url, secret, active")
      .eq("id", log.webhook_id)
      .single();
    if (hookError || !hook) throw new Error("Webhook not found");

    const body = JSON.stringify({
      event: log.event,
      timestamp: new Date().toISOString(),
      data: { reason: "manual_retry" },
    });

    const hdrs: Record<string, string> = {
      "Content-Type": "application/json",
      "User-Agent": "LunarCMS/1.0",
      "X-Lunar-Event": log.event,
      "X-Lunar-Retry": "true",
    };
    if (hook.secret) {
      const { createHmac } = await import("node:crypto");
      hdrs["X-Lunar-Signature"] = "sha256=" + createHmac("sha256", hook.secret).update(body).digest("hex");
    }

    const start = Date.now();
    let status: number | null = null;
    let error: string | null = null;

    try {
      const res = await fetch(hook.url, {
        method: "POST", headers: hdrs, body,
        signal: AbortSignal.timeout(10_000),
      });
      status = res.status;
    } catch (err) {
      error = err instanceof Error ? err.message : String(err);
    }

    const duration_ms = Date.now() - start;
    await (supabase as any).from("webhook_logs").insert({
      webhook_id: log.webhook_id,
      event: `${log.event} (retry)`,
      response_status: status,
      duration_ms,
      error,
    });

    return { status, duration_ms, error };
  });

// ---------------------------------------------------------------------------
// AUTOMATIC CACHE INVALIDATION (internal — no user config required)
// ---------------------------------------------------------------------------

/**
 * Directly call the cache-invalidation Supabase Edge Function.
 *
 * This fires automatically whenever a post is published, updated, or deleted —
 * completely independently of any user-configured webhooks.
 * Never throws: cache invalidation must never break a content save.
 */
export async function fireCacheInvalidation(
  event:
    | "blog.published"
    | "blog.updated"
    | "blog.deleted"
    | "page.published"
    | "page.updated"
    | "collection.updated"
    | "media.updated",
  workspaceId: string,
  slug?: string,
): Promise<void> {
  try {
    const supabaseUrl  = process.env.SUPABASE_URL;
    const serviceKey   = process.env.SUPABASE_SERVICE_ROLE_KEY;
    if (!supabaseUrl || !serviceKey) return;

    await fetch(`${supabaseUrl}/functions/v1/cache-invalidation`, {
      method: "POST",
      headers: {
        "Content-Type":  "application/json",
        "Authorization": `Bearer ${serviceKey}`,
      },
      body: JSON.stringify({ event, workspaceId, slug }),
      signal: AbortSignal.timeout(5_000),
    });
  } catch {
    // Never crash the caller
  }
}

// ---------------------------------------------------------------------------
// DISPATCHER (server-side only)
// ---------------------------------------------------------------------------

const RETRY_BACKOFF_MS = [0, 1_000, 2_000]; // wait before attempt 0, 1, 2
const MAX_ATTEMPTS      = 3;

function sleep(ms: number) {
  return new Promise<void>((r) => setTimeout(r, ms));
}

async function hmacSha256(secret: string, body: string): Promise<string> {
  const { createHmac } = await import("node:crypto");
  return "sha256=" + createHmac("sha256", secret).update(body).digest("hex");
}

/** Fire a single HTTP delivery, returning status + error. Never throws. */
async function fireDelivery(
  url: string,
  headers: Record<string, string>,
  body: string,
): Promise<{ status: number | null; error: string | null }> {
  try {
    const res = await fetch(url, {
      method: "POST",
      headers,
      body,
      signal: AbortSignal.timeout(10_000),
    });
    return { status: res.status, error: null };
  } catch (err) {
    return { status: null, error: err instanceof Error ? err.message : String(err) };
  }
}

/** Returns true when the delivery should be retried (server-side error or network failure). */
function shouldRetry(status: number | null, error: string | null): boolean {
  if (error) return true;          // network / timeout
  if (status !== null && status >= 500) return true; // 5xx server error
  return false;
}

export const dispatchWebhooks = createServerOnlyFn(async (
  event: WebhookEvent,
  payload: Record<string, unknown>,
): Promise<void> => {
  try {
    const { getAdminClient } = await import("./supabase.server");
    const supabase = await getAdminClient();

    const { data: hooks, error } = await supabase
      .from("webhooks")
      .select("*")
      .eq("active", true)
      .contains("events", [event]);

    if (error || !hooks || hooks.length === 0) return;

    const body = JSON.stringify({
      event,
      timestamp: new Date().toISOString(),
      data: payload,
    });

    await Promise.allSettled(
      hooks.map(async (hook: Webhook) => {
        const hdrs: Record<string, string> = {
          "Content-Type": "application/json",
          "User-Agent": "LunarCMS/1.0",
          "X-Lunar-Event": event,
        };
        if (hook.secret) hdrs["X-Lunar-Signature"] = await hmacSha256(hook.secret, body);

        const globalStart = Date.now();
        let response_status: number | null = null;
        let errorMsg: string | null = null;
        let attempts = 0;

        for (let i = 0; i < MAX_ATTEMPTS; i++) {
          if (RETRY_BACKOFF_MS[i] > 0) await sleep(RETRY_BACKOFF_MS[i]);
          attempts++;
          const result = await fireDelivery(hook.url, hdrs, body);
          response_status = result.status;
          errorMsg = result.error;
          if (!shouldRetry(response_status, errorMsg)) break;
        }

        const duration_ms = Date.now() - globalStart;
        const logError = errorMsg
          ? attempts > 1
            ? `[${attempts} attempts] ${errorMsg}`
            : errorMsg
          : null;

        await supabase.from("webhook_logs").insert({
          webhook_id: hook.id,
          event,
          response_status,
          duration_ms,
          error: logError,
        });
      }),
    );
  } catch {
    // Never crash the caller
  }
});
