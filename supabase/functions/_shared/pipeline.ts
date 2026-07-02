/**
 * pipeline.ts — Unified request middleware pipeline for the Lunar CMS API.
 *
 * Both api-gateway and content-router run every request through this shared
 * pipeline to guarantee a consistent lifecycle:
 *
 *   OPTIONS preflight → method guard → auth → rate-limit → context
 *
 * On success the caller receives the full ApiKeyContext + rate-limit state
 * and is free to run its own route logic before calling finalize() to attach
 * standard headers and fire the access log.
 */

import { validateApiKey, type ApiKeyContext } from "./auth.ts";
import { checkRateLimit, type RateLimitResult } from "./rate_limit.ts";
import { logRequest } from "./logger.ts";
import { fail, cors } from "./response.ts";
import { ERRORS } from "./errors.ts";

// ── Public types ─────────────────────────────────────────────────────────────

export interface PipelineContext {
  keyContext: ApiKeyContext;
  rate: RateLimitResult;
  ip: string | null;
  ua: string | null;
  startTime: number;
  path: string;
  method: string;
}

export type PipelineResult =
  | { ok: true; ctx: PipelineContext }
  | { ok: false; response: Response };

// ── runPipeline ───────────────────────────────────────────────────────────────

/**
 * Run the shared middleware pipeline.
 *
 * @param req        - The incoming Deno Request.
 * @param fnName     - The edge-function name used to strip the path prefix
 *                     (e.g. "api-gateway" or "content-router").
 * @returns          - PipelineResult (ok or early-exit response).
 */
export async function runPipeline(
  req: Request,
  fnName: string,
): Promise<PipelineResult> {
  // ── CORS preflight ──────────────────────────────────────────────────────────
  if (req.method === "OPTIONS") {
    return { ok: false, response: cors() };
  }

  // ── Method guard ────────────────────────────────────────────────────────────
  if (req.method !== "GET") {
    return {
      ok: false,
      response: fail(
        ERRORS.METHOD_NOT_ALLOWED.code,
        ERRORS.METHOD_NOT_ALLOWED.message,
        405,
      ),
    };
  }

  // ── Resolve path ────────────────────────────────────────────────────────────
  const url = new URL(req.url);
  const parts = url.pathname.split("/").filter(Boolean);
  const fnIdx = parts.findIndex((p) => p === fnName);
  const segments = fnIdx >= 0 ? parts.slice(fnIdx + 1) : parts;
  const path = "/" + segments.join("/");

  const ip = req.headers.get("x-forwarded-for")?.split(",")[0].trim() ?? null;
  const ua = req.headers.get("user-agent") ?? null;
  const method = req.method;
  const startTime = Date.now();

  // ── 1. Authentication ───────────────────────────────────────────────────────
  const auth = await validateApiKey(req.headers.get("authorization"));
  if (!auth.ok) {
    // Log unauthenticated attempt (fire-and-forget)
    logRequest({
      workspaceId: null,
      apiKeyId: null,
      method,
      path,
      statusCode: 401,
      durationMs: Date.now() - startTime,
      ipAddress: ip,
      userAgent: ua,
      error: auth.error,
    });
    return {
      ok: false,
      response: fail(ERRORS.INVALID_KEY.code, ERRORS.INVALID_KEY.message, 401),
    };
  }

  const { context } = auth;

  // ── 2. Rate limiting ────────────────────────────────────────────────────────
  const rate = await checkRateLimit(context.keyId, context.workspaceId);
  if (!rate.allowed) {
    logRequest({
      workspaceId: context.workspaceId,
      apiKeyId: context.keyId,
      method,
      path,
      statusCode: 429,
      durationMs: Date.now() - startTime,
      ipAddress: ip,
      userAgent: ua,
      error: "Rate limit exceeded",
    });
    const res = fail(
      ERRORS.RATE_LIMITED.code,
      ERRORS.RATE_LIMITED.message,
      429,
    );
    attachRateLimitHeaders(res, rate);
    return { ok: false, response: res };
  }

  return {
    ok: true,
    ctx: { keyContext: context, rate, ip, ua, startTime, path, method },
  };
}

// ── finalize ─────────────────────────────────────────────────────────────────

/**
 * Attach rate-limit headers to the response and fire the access log.
 * Call this as the very last step before returning from an edge function.
 */
export function finalize(
  res: Response,
  ctx: PipelineContext,
): Response {
  attachRateLimitHeaders(res, ctx.rate);

  logRequest({
    workspaceId: ctx.keyContext.workspaceId,
    apiKeyId: ctx.keyContext.keyId,
    method: ctx.method,
    path: ctx.path,
    statusCode: res.status,
    durationMs: Date.now() - ctx.startTime,
    ipAddress: ctx.ip,
    userAgent: ctx.ua,
    error: null,
  });

  return res;
}

// ── attachRateLimitHeaders ────────────────────────────────────────────────────

export function attachRateLimitHeaders(
  res: Response,
  rate: Pick<RateLimitResult, "limit" | "remaining" | "resetAt">,
): void {
  res.headers.set("X-RateLimit-Limit", String(rate.limit));
  res.headers.set("X-RateLimit-Remaining", String(rate.remaining));
  res.headers.set("X-RateLimit-Reset", rate.resetAt);
}
