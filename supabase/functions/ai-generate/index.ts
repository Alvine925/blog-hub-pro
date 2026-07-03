// Supabase Edge Function: generate CMS content.
// Primary:  Lovable AI gateway  (LOVABLE_API_KEY)  → google/gemini-3-flash-preview
// Fallback: Mistral AI           (MISTRAL_API_KEY)  → mistral-large-latest

import { createClient } from "jsr:@supabase/supabase-js@2";
import { isTrustedCaller } from "../_shared/trusted-caller.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

const LOVABLE_GATEWAY = "https://ai.gateway.lovable.dev/v1/chat/completions";
const LOVABLE_MODEL   = "google/gemini-3-flash-preview";

const MISTRAL_GATEWAY = "https://api.mistral.ai/v1/chat/completions";
const MISTRAL_MODEL   = "mistral-large-latest";

// ── Shared AI caller with primary → fallback logic ──────────────────────────
interface ChatMessage { role: "system" | "user" | "assistant"; content: string }
interface CallResult  { result: string; model: string; provider: string; prompt_tokens: number; result_tokens: number }

async function callAI(messages: ChatMessage[]): Promise<CallResult> {
  const lovableKey = Deno.env.get("LOVABLE_API_KEY");
  const mistralKey = Deno.env.get("MISTRAL_API_KEY");

  // Try Lovable AI first (when key present)
  if (lovableKey) {
    try {
      const res = await fetch(LOVABLE_GATEWAY, {
        method: "POST",
        headers: { Authorization: `Bearer ${lovableKey}`, "Content-Type": "application/json" },
        body: JSON.stringify({ model: LOVABLE_MODEL, messages }),
      });

      // Retriable errors → fall through to Mistral
      if (res.status !== 429 && res.status !== 402 && res.ok) {
        const data = await res.json();
        const raw = stripFences(data?.choices?.[0]?.message?.content ?? "");
        return {
          result: raw,
          model: LOVABLE_MODEL,
          provider: "lovable",
          prompt_tokens:  data?.usage?.prompt_tokens     ?? 0,
          result_tokens:  data?.usage?.completion_tokens ?? 0,
        };
      }
      // 429 / 402 / non-ok → fall through
    } catch {
      // Network error → fall through
    }
  }

  // Fallback: Mistral AI
  if (!mistralKey) {
    throw new Error(
      !lovableKey
        ? "No AI provider configured. Set LOVABLE_API_KEY or MISTRAL_API_KEY in Supabase secrets."
        : "Primary AI provider unavailable and MISTRAL_API_KEY is not configured.",
    );
  }

  const res = await fetch(MISTRAL_GATEWAY, {
    method: "POST",
    headers: { Authorization: `Bearer ${mistralKey}`, "Content-Type": "application/json" },
    body: JSON.stringify({ model: MISTRAL_MODEL, messages }),
  });

  if (res.status === 429) throw new Error("Rate limit reached on Mistral. Please try again shortly.");
  if (!res.ok) {
    const detail = await res.text();
    throw new Error(`Mistral AI error ${res.status}: ${detail}`);
  }

  const data = await res.json();
  return {
    result: stripFences(data?.choices?.[0]?.message?.content ?? ""),
    model: MISTRAL_MODEL,
    provider: "mistral",
    prompt_tokens:  data?.usage?.prompt_tokens     ?? 0,
    result_tokens:  data?.usage?.completion_tokens ?? 0,
  };
}

function stripFences(raw: string): string {
  return raw.replace(/^```(?:html|json|markdown)?\s*/i, "").replace(/\s*```$/i, "").trim();
}

// ── Task system prompts ──────────────────────────────────────────────────────
type Task =
  | "generate_article" | "rewrite"      | "translate"       | "summarize"
  | "generate_seo"     | "generate_faqs"| "generate_metadata"
  | "generate_categories" | "generate_tags" | "generate_image_prompt" | "custom";

const SYSTEM_PROMPTS: Record<Task | "default", string> = {
  generate_article:
    "You are an expert content writer for a modern CMS. Write professional, engaging, SEO-friendly blog articles in clean HTML (use <h2>, <h3>, <p>, <ul>, <ol>, <li>, <blockquote>, <strong>, <em>). Do not include <html>, <head>, or <body> tags. Do not wrap in markdown code fences.",
  rewrite:
    "You are a professional editor. Rewrite the provided content to improve clarity, engagement, and readability. Return clean HTML with the same structure as the input.",
  translate:
    "You are a professional translator. Preserve the original tone, formatting, and HTML structure. Return only the translated HTML — no commentary.",
  summarize:
    "You are a skilled summariser. Produce a concise, accurate 2-4 sentence summary that captures the key points. Return plain text only.",
  generate_seo:
    `You are an SEO specialist. Return ONLY a valid JSON object (no markdown fences) with exactly these keys:
{"seo_title": string (max 60 chars), "meta_description": string (max 160 chars), "keywords": string[] (5-8 terms)}.`,
  generate_faqs:
    "You are a content strategist. Generate clear, helpful FAQ questions and answers. Return clean HTML using <h3> for questions and <p> for answers.",
  generate_metadata:
    `You are a content metadata expert. Return ONLY a valid JSON object (no markdown fences) with exactly these keys:
{"title": string (max 60 chars), "excerpt": string (1-2 sentences, max 160 chars), "tags": string[] (3-6 lowercase tags), "category": string}.`,
  generate_categories:
    "You are a content strategist. Suggest 3-5 relevant content categories. Return a JSON array of strings only — no markdown, no commentary.",
  generate_tags:
    "You are a content tagging expert. Suggest 5-8 relevant lowercase tags. Return a JSON array of strings only — no markdown, no commentary.",
  generate_image_prompt:
    "You are a creative director. Generate a detailed, vivid image prompt for AI image generators (DALL-E / Midjourney style). Return a single descriptive paragraph — no formatting, no headers.",
  custom:
    "You are a helpful AI assistant for a CMS platform. Follow the user's instructions precisely.",
  default:
    "You are a helpful AI assistant for a CMS platform.",
};

// ── Main handler ─────────────────────────────────────────────────────────────
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

  const isServiceRole = isTrustedCaller(authHeader);
  let actorEmail = "server";
  if (!isServiceRole) {
    const callerClient = createClient(supabaseUrl, supabaseAnonKey, {
      global: { headers: { Authorization: authHeader } },
    });
    const { data: { user } } = await callerClient.auth.getUser();
    if (!user) return json({ error: "Unauthorized" }, 401);
    actorEmail = user.email ?? "unknown";
  }

  // ── Parse body ────────────────────────────────────────────────────────────
  // workspace_id is intentionally NOT accepted from the client — it is always
  // resolved server-side to prevent cross-tenant workspace targeting.
  let body: {
    task?: string; prompt?: string; system_prompt?: string;
    parameters?: Record<string, unknown>; post_id?: string;
  };
  try { body = await req.json(); }
  catch { return json({ error: "Invalid JSON body" }, 400); }

  const task   = (body.task ?? "custom") as Task;
  const prompt = (body.prompt ?? "").trim();
  if (!prompt) return json({ error: "prompt is required" }, 400);

  const systemPrompt = body.system_prompt ?? SYSTEM_PROMPTS[task] ?? SYSTEM_PROMPTS.default;

  // ── Resolve workspace server-side ─────────────────────────────────────────
  // Always use the default workspace — never trust client-supplied IDs.
  const adminClient = createClient(supabaseUrl, supabaseServiceKey);
  const { data: ws } = await adminClient.from("workspaces").select("id").eq("slug", "default").single();
  const workspaceId: string | null = ws?.id ?? null;

  // ── Insert generation record ──────────────────────────────────────────────
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data: gen } = await (adminClient as any)
    .from("ai_generations")
    .insert({
      workspace_id: workspaceId,
      post_id:      body.post_id ?? null,
      task,
      model:        LOVABLE_MODEL, // will be updated with actual model used
      prompt,
      system_prompt: systemPrompt,
      parameters:   body.parameters ?? {},
      actor_name:   actorEmail,
      status:       "running",
    })
    .select("id")
    .single();
  const genId: string | null = gen?.id ?? null;
  const startMs = Date.now();

  // ── Call AI (with fallback) ───────────────────────────────────────────────
  try {
    const { result, model, provider, prompt_tokens, result_tokens } = await callAI([
      { role: "system",  content: systemPrompt },
      { role: "user",    content: prompt       },
    ]);

    const durationMs = Date.now() - startMs;
    if (genId) {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      await (adminClient as any).from("ai_generations").update({
        status: "completed", result, model,
        prompt_tokens, result_tokens,
        duration_ms: durationMs,
        completed_at: new Date().toISOString(),
      }).eq("id", genId);
    }

    return json({ id: genId, result, model, provider, prompt_tokens, result_tokens });
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : String(err);
    if (genId) {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      await (adminClient as any).from("ai_generations").update({
        status: "failed", error: msg, duration_ms: Date.now() - startMs,
      }).eq("id", genId);
    }
    return json({ error: msg }, 500);
  }
});

function json(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}
