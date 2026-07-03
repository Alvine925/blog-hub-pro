// Edge Function: generate-faqs
// Analyzes a workspace's site intelligence (industry, brand voice, services,
// products, target audience) and generates a batch of FAQ Q&A pairs, plus
// extra suggested FAQ topics for later generation.

import { createClient } from "jsr:@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

function json(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}

// ── AI helpers (Lovable → Mistral fallback) — mirrors generate-blog-post ─────
interface ChatMessage { role: "system" | "user" | "assistant"; content: string }

const LOVABLE_GATEWAY = "https://ai.gateway.lovable.dev/v1/chat/completions";
const LOVABLE_MODEL   = "google/gemini-3-flash-preview";
const MISTRAL_GATEWAY = "https://api.mistral.ai/v1/chat/completions";
const MISTRAL_MODEL   = "mistral-large-latest";

function stripFences(raw: string): string {
  return raw.replace(/^```(?:html|json|markdown)?\s*/i, "").replace(/\s*```$/i, "").trim();
}

async function callAI(messages: ChatMessage[]): Promise<string> {
  const lovableKey = Deno.env.get("LOVABLE_API_KEY");
  const mistralKey = Deno.env.get("MISTRAL_API_KEY");

  if (lovableKey) {
    try {
      const res = await fetch(LOVABLE_GATEWAY, {
        method: "POST",
        headers: { Authorization: `Bearer ${lovableKey}`, "Content-Type": "application/json" },
        body: JSON.stringify({ model: LOVABLE_MODEL, messages }),
      });
      if (res.ok) {
        const data = await res.json();
        return stripFences(data?.choices?.[0]?.message?.content ?? "");
      }
    } catch { /* fall through */ }
  }

  if (!mistralKey) throw new Error("No AI provider configured. Set LOVABLE_API_KEY or MISTRAL_API_KEY.");
  const res = await fetch(MISTRAL_GATEWAY, {
    method: "POST",
    headers: { Authorization: `Bearer ${mistralKey}`, "Content-Type": "application/json" },
    body: JSON.stringify({ model: MISTRAL_MODEL, messages }),
  });
  if (!res.ok) throw new Error(`Mistral error ${res.status}: ${await res.text()}`);
  const data = await res.json();
  return stripFences(data?.choices?.[0]?.message?.content ?? "");
}

interface FaqGenResult {
  question: string;
  answer: string;
  category: string;
}

async function generateFaqBatch(params: {
  count: number;
  companyName: string | null;
  industry: string | null;
  description: string | null;
  brandVoice: string | null;
  targetAudience: string | null;
  services: string[];
  products: string[];
  existingQuestions: string[];
}): Promise<FaqGenResult[]> {
  const { count, companyName, industry, description, brandVoice, targetAudience, services, products, existingQuestions } = params;

  const context = [
    companyName      ? `Company: ${companyName}`                     : null,
    industry         ? `Industry: ${industry}`                       : null,
    description      ? `About: ${description}`                       : null,
    brandVoice       ? `Brand voice: ${brandVoice}`                  : null,
    targetAudience   ? `Target audience: ${targetAudience}`          : null,
    services.length  ? `Services: ${services.join(", ")}`            : null,
    products.length  ? `Products: ${products.join(", ")}`            : null,
  ].filter(Boolean).join("\n");

  const avoid = existingQuestions.length
    ? `\n\nDo NOT repeat or closely paraphrase these existing questions:\n${existingQuestions.map((q) => `- ${q}`).join("\n")}`
    : "";

  const system = `You are a customer support and content strategist. Based on the site analysis below, write exactly ${count} realistic, high-value FAQ question/answer pairs that real prospective customers of this business would ask.

Rules:
- Cover a mix of: pricing/billing, getting started, features/capabilities, support, and trust/security topics relevant to this specific business.
- Answers should be genuinely useful, 2-4 sentences, in plain HTML using only <p>, <strong>, <em>, <ul>, <li>.
- Do not invent specific prices, contact details, or policies that were not implied by the context — keep answers general but concrete and on-brand.
- Return ONLY a valid JSON array (no fences, no commentary) of exactly ${count} objects with this shape:
[{ "question": "...", "answer": "<p>...</p>", "category": "one of: Pricing, Getting Started, Features, Support, Security, General" }]`;

  const raw = await callAI([
    { role: "system", content: system },
    { role: "user", content: `Business context:\n${context}${avoid}` },
  ]);

  try {
    const parsed = JSON.parse(raw);
    if (Array.isArray(parsed)) return parsed as FaqGenResult[];
    throw new Error("not an array");
  } catch {
    const match = raw.match(/\[[\s\S]*\]/);
    if (match) return JSON.parse(match[0]) as FaqGenResult[];
    throw new Error("AI returned invalid JSON for FAQ batch");
  }
}

async function generateFaqTopicSuggestions(params: {
  count: number;
  industry: string | null;
  companyName: string | null;
  existingQuestions: string[];
}): Promise<string[]> {
  const { count, industry, companyName, existingQuestions } = params;
  const system = `You are a content strategist. Suggest exactly ${count} additional FAQ question TOPICS (just the question text, not the answer) that would be valuable for this business's FAQ page, but that are different from the questions already written. Return ONLY a valid JSON array of ${count} strings, no commentary, no fences.`;
  const raw = await callAI([
    { role: "system", content: system },
    { role: "user", content: `Company: ${companyName ?? "N/A"}\nIndustry: ${industry ?? "N/A"}\nAlready covered:\n${existingQuestions.map((q) => `- ${q}`).join("\n")}` },
  ]);
  try {
    const parsed = JSON.parse(raw);
    if (Array.isArray(parsed)) return parsed.map((s) => String(s));
  } catch {
    const match = raw.match(/\[[\s\S]*\]/);
    if (match) {
      const parsed = JSON.parse(match[0]);
      if (Array.isArray(parsed)) return parsed.map((s) => String(s));
    }
  }
  return [];
}

// ── Main handler ──────────────────────────────────────────────────────────────
Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") return json(null, 200);

  const supabaseUrl        = Deno.env.get("SUPABASE_URL")!;
  const supabaseAnonKey    = Deno.env.get("SUPABASE_ANON_KEY")!;
  const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

  const authHeader = req.headers.get("authorization") ?? "";
  if (!authHeader.startsWith("Bearer ")) return json({ error: "Unauthorized" }, 401);
  const isServiceRole = authHeader === `Bearer ${supabaseServiceKey}`;

  let body: { workspace_id: string; count?: number; suggestion_count?: number };
  try { body = await req.json(); }
  catch { return json({ error: "Invalid JSON body" }, 400); }

  const workspaceId = body.workspace_id;
  if (!workspaceId) return json({ error: "workspace_id is required" }, 400);

  const adminClient = createClient(supabaseUrl, supabaseServiceKey);

  if (!isServiceRole) {
    const callerClient = createClient(supabaseUrl, supabaseAnonKey, {
      global: { headers: { Authorization: authHeader } },
    });
    const { data: { user } } = await callerClient.auth.getUser();
    if (!user) return json({ error: "Unauthorized" }, 401);

    const { data: ws_check } = await (adminClient as any)
      .from("workspaces")
      .select("id")
      .eq("id", workspaceId)
      .eq("user_id", user.id)
      .maybeSingle();
    if (!ws_check) return json({ error: "Forbidden: you do not own this workspace" }, 403);
  }

  const count           = Math.min(Math.max(body.count ?? 10, 1), 20);
  const suggestionCount = Math.min(Math.max(body.suggestion_count ?? 10, 0), 20);

  const { data: ws } = await (adminClient as any)
    .from("workspaces")
    .select("name, industry, brand_voice, target_audience, description, ai_context")
    .eq("id", workspaceId)
    .maybeSingle();

  if (!ws) return json({ error: "Workspace not found" }, 404);

  const services: string[] = ws.ai_context?.services ?? [];
  const products: string[] = ws.ai_context?.products ?? [];

  const { data: existingFaqs } = await (adminClient as any)
    .from("faqs")
    .select("question")
    .eq("workspace_id", workspaceId);

  const existingQuestions = (existingFaqs ?? []).map((f: { question: string }) => f.question);

  try {
    const batch = await generateFaqBatch({
      count,
      companyName: ws.name,
      industry: ws.industry,
      description: ws.description,
      brandVoice: ws.brand_voice,
      targetAudience: ws.target_audience,
      services,
      products,
      existingQuestions,
    });

    const rows = batch.slice(0, count).map((f, i) => ({
      workspace_id: workspaceId,
      question: f.question,
      answer: f.answer,
      category: f.category || "General",
      sort_order: existingQuestions.length + i,
      status: "draft",
    }));

    const { data: inserted, error: insertError } = await (adminClient as any)
      .from("faqs")
      .insert(rows)
      .select("id, question");

    if (insertError) throw new Error(insertError.message);

    let suggestions: string[] = [];
    if (suggestionCount > 0) {
      suggestions = await generateFaqTopicSuggestions({
        count: suggestionCount,
        industry: ws.industry,
        companyName: ws.name,
        existingQuestions: [...existingQuestions, ...batch.map((f) => f.question)],
      });

      if (suggestions.length) {
        await (adminClient as any).from("workspace_content_opportunities").insert(
          suggestions.slice(0, suggestionCount).map((title) => ({
            workspace_id: workspaceId,
            title,
            type: "faq",
            topic: ws.industry,
            reason: "AI-suggested FAQ topic from site analysis",
            priority: "medium",
            status: "suggested",
          })),
        );
      }
    }

    return json({
      generated: (inserted ?? []).length,
      faqs: inserted ?? [],
      suggestions,
    });
  } catch (err: unknown) {
    return json({ error: err instanceof Error ? err.message : String(err) }, 500);
  }
});
