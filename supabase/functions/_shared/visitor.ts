/**
 * visitor.ts — anonymous visitor identification for public engagement writes.
 *
 * External websites/JS clients are expected to generate a stable random ID
 * client-side (e.g. UUID persisted in localStorage) and send it on every
 * engagement request via the `X-Visitor-Id` header. When absent, we fall
 * back to a best-effort hash of IP + User-Agent (weaker dedup, but avoids
 * hard-failing requests from clients that haven't implemented the header).
 */

const VISITOR_ID_RE = /^[a-zA-Z0-9_-]{8,128}$/;

async function sha256hex(str: string): Promise<string> {
  const buf = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(str));
  return Array.from(new Uint8Array(buf))
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
}

export interface VisitorInfo {
  visitorId: string;
  isFallback: boolean;
  ip: string | null;
  userAgent: string | null;
}

/** Resolve a visitor identifier for the current request. */
export async function getVisitorId(req: Request): Promise<VisitorInfo> {
  const ip = req.headers.get("x-forwarded-for")?.split(",")[0].trim() ?? null;
  const userAgent = req.headers.get("user-agent") ?? null;

  const header = req.headers.get("x-visitor-id");
  if (header && VISITOR_ID_RE.test(header)) {
    return { visitorId: header, isFallback: false, ip, userAgent };
  }

  // Fallback: hash of IP + UA + day, so dedup still works within a day
  // without a client-supplied identifier.
  const day = new Date().toISOString().slice(0, 10);
  const fallback = await sha256hex(`${ip ?? "unknown"}|${userAgent ?? "unknown"}|${day}`);
  return { visitorId: `fp_${fallback.slice(0, 32)}`, isFallback: true, ip, userAgent };
}

/** Classify device type from a User-Agent string (best-effort, no deps). */
export function classifyDevice(userAgent: string | null): "mobile" | "tablet" | "desktop" | "unknown" {
  if (!userAgent) return "unknown";
  const ua = userAgent.toLowerCase();
  if (/ipad|tablet/.test(ua)) return "tablet";
  if (/mobi|android|iphone/.test(ua)) return "mobile";
  return "desktop";
}
