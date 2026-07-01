// Supabase Edge Function: refine blog content.
// Primary:  Lovable AI gateway  (LOVABLE_API_KEY)  → google/gemini-3-flash-preview
// Fallback: Mistral AI           (MISTRAL_API_KEY)  → mistral-large-latest

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

const LOVABLE_GATEWAY = "https://ai.gateway.lovable.dev/v1/chat/completions";
const LOVABLE_MODEL   = "google/gemini-3-flash-preview";

const MISTRAL_GATEWAY = "https://api.mistral.ai/v1/chat/completions";
const MISTRAL_MODEL   = "mistral-large-latest";

type RefineMode = "improve" | "grammar" | "shorten" | "expand" | "seo";

const INSTRUCTIONS: Record<RefineMode, string> = {
  improve:
    "Improve clarity, flow, structure and engagement while keeping the author's meaning and voice.",
  grammar:
    "Fix grammar, spelling and punctuation only. Do not change meaning, tone or structure.",
  shorten:
    "Make the content more concise and punchy without losing key information.",
  expand:
    "Expand the content with more detail, helpful examples and depth while staying on topic.",
  seo:
    "Rewrite for SEO: keyword-rich, scannable headings, strong intro and conclusion, while staying natural.",
};

// ── Shared AI caller with primary → fallback logic ──────────────────────────
interface ChatMessage { role: "system" | "user" | "assistant"; content: string }
interface CallResult  { text: string; model: string; provider: string }

async function callAI(messages: ChatMessage[]): Promise<CallResult> {
  const lovableKey = Deno.env.get("LOVABLE_API_KEY");
  const mistralKey = Deno.env.get("MISTRAL_API_KEY");

  if (lovableKey) {
    try {
      const res = await fetch(LOVABLE_GATEWAY, {
        method: "POST",
        headers: { Authorization: `Bearer ${lovableKey}`, "Content-Type": "application/json" },
        body: JSON.stringify({ model: LOVABLE_MODEL, messages }),
      });

      // 429 / 402 / other non-OK → fall through to Mistral instead of failing hard
      if (res.ok) {
        const data = await res.json();
        return {
          text:     data?.choices?.[0]?.message?.content ?? "",
          model:    LOVABLE_MODEL,
          provider: "lovable",
        };
      }
      // Non-OK → fall through to Mistral
    } catch {
      // Network / other → fall through to Mistral
    }
  }

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
    text:     data?.choices?.[0]?.message?.content ?? "",
    model:    MISTRAL_MODEL,
    provider: "mistral",
  };
}

function stripFences(raw: string): string {
  return raw.replace(/^```(?:html|json)?\s*/i, "").replace(/\s*```$/i, "").trim();
}

// ── Main handler ─────────────────────────────────────────────────────────────
Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const body    = await req.json().catch(() => ({}));
    const content: string = typeof body.content === "string" ? body.content : "";
    const title:   string = typeof body.title   === "string" ? body.title   : "";
    const action:  string = body.action === "metadata" ? "metadata" : "refine";
    const mode: RefineMode = body.mode && body.mode in INSTRUCTIONS ? body.mode : "improve";

    if (!content.trim()) {
      return response({ error: "No content provided." }, 400);
    }

    const systemPrompt =
      action === "metadata"
        ? `You are an expert blog editor. Based on the article, generate SEO-friendly metadata.
Return ONLY a valid JSON object (no markdown fences, no commentary) with exactly these keys:
{"title": string (max 60 chars, compelling), "excerpt": string (1-2 sentences, max 160 chars summarizing the article), "tags": string[] (3-6 short lowercase topic tags)}.`
        : `You are an expert blog editor. ${INSTRUCTIONS[mode]}
Return ONLY the refined article body as clean semantic HTML (use <h2>, <h3>, <p>, <ul>, <ol>, <li>, <blockquote>, <strong>, <em>, <a>). Do not wrap in markdown code fences. Do not include <html>, <head> or <body> tags. Do not add commentary.`;

    const userPrompt = `${title ? `Title: ${title}\n\n` : ""}Article HTML:\n${content}`;

    const { text, model, provider } = await callAI([
      { role: "system", content: systemPrompt },
      { role: "user",   content: userPrompt   },
    ]);

    const raw = stripFences(text);

    if (action === "metadata") {
      let meta: { title?: string; excerpt?: string; tags?: string[] } = {};
      try {
        const match = raw.match(/\{[\s\S]*\}/);
        meta = JSON.parse(match ? match[0] : raw);
      } catch {
        return response({ error: "Could not parse AI metadata." }, 502);
      }
      return response({
        title:    typeof meta.title   === "string" ? meta.title   : "",
        excerpt:  typeof meta.excerpt === "string" ? meta.excerpt : "",
        tags:     Array.isArray(meta.tags) ? meta.tags.filter((t) => typeof t === "string") : [],
        model,
        provider,
      });
    }

    return response({ refined: raw, model, provider });
  } catch (err) {
    return response({ error: err instanceof Error ? err.message : "Unknown error" }, 500);
  }
});

function response(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}
