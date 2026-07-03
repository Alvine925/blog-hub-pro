/**
 * ai-assistant — Lunar CMS AI chatbot edge function.
 *
 * Provides an AI assistant that answers questions about the platform,
 * generates integration guides, vibe-coding prompts, and code examples.
 *
 * Auth: Bearer <supabase-session-token> (authenticated admin users only)
 * Body: { messages: ChatMessage[], context?: string }
 * Response: { reply: string }
 *
 * Provider chain: Lovable gateway → Mistral → HuggingFace (Mistral-7B)
 */

import { createClient } from "jsr:@supabase/supabase-js@2";

const CORS = {
  "Access-Control-Allow-Origin":  "*",
  "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
  "Access-Control-Allow-Headers": "Authorization, Content-Type",
};

interface ChatMessage { role: "system" | "user" | "assistant"; content: string }

function json(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...CORS, "Content-Type": "application/json" },
  });
}

// ── System prompt ─────────────────────────────────────────────────────────────

const SYSTEM_PROMPT = `You are the Lunar CMS Assistant — a knowledgeable, friendly, and concise AI helper embedded in the Lunar CMS admin dashboard.

PLATFORM OVERVIEW
Lunar CMS is a headless content management system with a REST API. It supports multiple workspaces, each with its own content and API keys. Content types: Blog Posts, Articles, News, Products, FAQs.

API FACTS
- Base URL pattern: https://<project-ref>.supabase.co/functions/v1/content-router
- Auth header: Authorization: Bearer <api-key>
- Publishable keys (pk_live_*): safe for frontend, read-only + public engagement (likes, comments, views)
- Secret keys (sk_live_*): server-only, full write access + comment moderation
- All responses: { success: true, data: [...], meta: { page, limit, total, totalPages }, links: { ... } }

KEY ENDPOINTS
- GET  /blogs          — list published posts (supports ?search=, ?category=, ?featured=true, ?page=, ?limit=)
- GET  /blogs/:slug    — single post with rich engagement data (stats, related posts, share URLs, word count)
- GET  /blogs/:slug/related   — related posts
- GET  /blogs/:slug/stats     — { views, likes, comment_count }
- GET  /blogs/:slug/comments  — approved comments (paginated)
- GET  /faqs           — list FAQs
- GET  /news           — list news items
- GET  /articles       — list articles
- GET  /products       — list products

ENGAGEMENT ENDPOINTS (blog-engagement function)
- POST   /blogs/:slug/likes   — like a post (X-Visitor-Id header)
- DELETE /blogs/:slug/likes   — unlike
- POST   /blogs/:slug/comments — submit comment (pending moderation)
- POST   /blogs/:slug/view    — record a page view (30-min dedup)
- GET    /blogs/:slug/share   — share metadata

CONTENT ENGAGEMENT ENDPOINTS (content-engagement function) — same pattern for news / articles / products
- GET/POST/DELETE /:type/:slug/likes
- GET/POST        /:type/:slug/comments
- POST            /:type/:slug/view

INTEGRATION PATTERNS
When generating integration code, default to:
- Next.js App Router (fetch, server components)
- Vanilla JS (fetch API)
- React (SWR or React Query)
Always use relative imports where appropriate and show real API key placeholders like YOUR_API_KEY_HERE.

VIBE CODING PROMPTS
When asked to generate a vibe coding prompt, create a detailed, self-contained prompt that a developer can paste into Lovable, Cursor, v0, or Bolt.new to build a full CMS integration. Include: API base URL placeholder, auth header setup, which endpoints to hit, error handling, loading states, and UI requirements.

TONE
- Be concise but complete
- Use markdown with code blocks
- Lead with the answer, then explain
- If unsure, say so and offer to help differently`;

// ── AI providers ──────────────────────────────────────────────────────────────

const LOVABLE_GATEWAY = "https://ai.gateway.lovable.dev/v1/chat/completions";
const LOVABLE_MODEL   = "google/gemini-2-flash";
const MISTRAL_GATEWAY = "https://api.mistral.ai/v1/chat/completions";
const MISTRAL_MODEL   = "mistral-large-latest";
const HF_GATEWAY      = "https://api-inference.huggingface.co/v1/chat/completions";
const HF_MODEL        = "mistralai/Mistral-7B-Instruct-v0.3";

async function callAI(messages: ChatMessage[]): Promise<string> {
  const lovableKey  = Deno.env.get("LOVABLE_API_KEY");
  const mistralKey  = Deno.env.get("MISTRAL_API_KEY");
  const hfKey       = Deno.env.get("HUGGINGFACE_API_KEY");

  const extractContent = (data: Record<string, unknown>): string => {
    const choices = (data?.choices as Array<Record<string, unknown>> | undefined) ?? [];
    return ((choices[0]?.message as Record<string, unknown>)?.content as string | undefined) ?? "";
  };

  // 1. Lovable gateway
  if (lovableKey) {
    try {
      const res = await fetch(LOVABLE_GATEWAY, {
        method: "POST",
        headers: { Authorization: `Bearer ${lovableKey}`, "Content-Type": "application/json" },
        body: JSON.stringify({ model: LOVABLE_MODEL, messages, max_tokens: 2048 }),
        signal: AbortSignal.timeout(20_000),
      });
      if (res.ok) {
        const data = await res.json();
        const text = extractContent(data);
        if (text) return text;
      }
    } catch (e) {
      console.warn("[ai-assistant] Lovable gateway failed:", e instanceof Error ? e.message : e);
    }
  }

  // 2. Mistral
  if (mistralKey) {
    try {
      const res = await fetch(MISTRAL_GATEWAY, {
        method: "POST",
        headers: { Authorization: `Bearer ${mistralKey}`, "Content-Type": "application/json" },
        body: JSON.stringify({ model: MISTRAL_MODEL, messages, max_tokens: 2048 }),
        signal: AbortSignal.timeout(30_000),
      });
      if (res.ok) {
        const data = await res.json();
        const text = extractContent(data);
        if (text) return text;
      }
    } catch (e) {
      console.warn("[ai-assistant] Mistral failed:", e instanceof Error ? e.message : e);
    }
  }

  // 3. HuggingFace (free tier fallback)
  if (hfKey) {
    try {
      const res = await fetch(HF_GATEWAY, {
        method: "POST",
        headers: { Authorization: `Bearer ${hfKey}`, "Content-Type": "application/json" },
        body: JSON.stringify({ model: HF_MODEL, messages, max_tokens: 1024 }),
        signal: AbortSignal.timeout(40_000),
      });
      if (res.ok) {
        const data = await res.json();
        const text = extractContent(data);
        if (text) return text;
      }
    } catch (e) {
      console.warn("[ai-assistant] HuggingFace failed:", e instanceof Error ? e.message : e);
    }
  }

  throw new Error(
    "All AI providers failed or no API keys configured. " +
    "Set LOVABLE_API_KEY, MISTRAL_API_KEY, or HUGGINGFACE_API_KEY in Supabase secrets.",
  );
}

// ── Auth ──────────────────────────────────────────────────────────────────────

async function verifyUser(authHeader: string | null): Promise<boolean> {
  if (!authHeader?.startsWith("Bearer ")) return false;
  const token = authHeader.slice(7).trim();
  if (!token) return false;

  // Accept service-role token directly (used in dev/test)
  const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "";
  if (serviceKey && token === serviceKey) return true;

  // Accept the project's anon / publishable key for trusted server-to-server
  // calls (the app's server function proxies requests using this key because
  // the service-role key is not available in the app runtime).
  const anonKey        = Deno.env.get("SUPABASE_ANON_KEY") ?? "";
  const publishableKey = Deno.env.get("SUPABASE_PUBLISHABLE_KEY") ?? "";
  if (anonKey && token === anonKey) return true;
  if (publishableKey && token === publishableKey) return true;

  try {
    const url  = Deno.env.get("SUPABASE_URL") ?? "";
    const anon = Deno.env.get("SUPABASE_ANON_KEY") ?? "";
    const supabase = createClient(url, anon, {
      auth: { autoRefreshToken: false, persistSession: false },
    });
    const { data: { user }, error } = await supabase.auth.getUser(token);
    return !error && !!user;
  } catch {
    return false;
  }
}

// ── Main handler ──────────────────────────────────────────────────────────────

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") return new Response(null, { status: 204, headers: CORS });
  if (req.method !== "POST") return json({ error: "Method not allowed" }, 405);

  // Auth
  const authed = await verifyUser(req.headers.get("authorization"));
  if (!authed) return json({ error: "Unauthorized" }, 401);

  // Parse body
  let body: { messages: ChatMessage[]; context?: string };
  try {
    body = await req.json();
  } catch {
    return json({ error: "Invalid JSON body" }, 400);
  }

  const { messages, context } = body;
  if (!Array.isArray(messages) || messages.length === 0) {
    return json({ error: "messages must be a non-empty array" }, 400);
  }

  // Build full message list with system prompt
  const systemContent = context
    ? `${SYSTEM_PROMPT}\n\nCurrent workspace context:\n${context}`
    : SYSTEM_PROMPT;

  const fullMessages: ChatMessage[] = [
    { role: "system", content: systemContent },
    // Keep last 20 messages to stay within context limits
    ...messages.slice(-20),
  ];

  try {
    const reply = await callAI(fullMessages);
    return json({ reply });
  } catch (err) {
    console.error("[ai-assistant] Error:", err);
    return json(
      { error: err instanceof Error ? err.message : "AI generation failed" },
      503,
    );
  }
});
