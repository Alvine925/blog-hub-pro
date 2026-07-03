// Edge Function: generate-products
// Analyzes workspace site intelligence and generates a batch of product catalog
// entries, plus additional product suggestions for later generation.

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

// ── AI helpers (Lovable → Mistral fallback) ───────────────────────────────────
interface ChatMessage { role: "system" | "user" | "assistant"; content: string }

const LOVABLE_GATEWAY = "https://ai.gateway.lovable.dev/v1/chat/completions";
const LOVABLE_MODEL   = "google/gemini-3-flash-preview";
const MISTRAL_GATEWAY = "https://api.mistral.ai/v1/chat/completions";
const MISTRAL_MODEL   = "mistral-large-latest";

function stripFences(raw: string): string {
  return raw.replace(/^```(?:json)?\s*/i, "").replace(/\s*```$/i, "").trim();
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

// ── Slug helpers ───────────────────────────────────────────────────────────────
function slugify(text: string): string {
  return text
    .toLowerCase()
    .replace(/[^\w\s-]/g, "")
    .replace(/[\s_-]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 80);
}

function uniqueSlug(base: string, existing: Set<string>): string {
  let slug = slugify(base);
  let counter = 2;
  while (existing.has(slug)) { slug = `${slugify(base)}-${counter++}`; }
  existing.add(slug);
  return slug;
}

// ── Product generation ────────────────────────────────────────────────────────
interface ProductGenResult {
  name: string;
  slug: string;
  description: string;
  content: string;
  category: string;
  brand: string;
  price: number | null;
  currency: string;
  features: string[];
  specifications: Array<{ key: string; value: string }>;
  tags: string[];
  seo_title: string;
  meta_description: string;
}

async function generateProductBatch(params: {
  count: number;
  companyName: string;
  industry: string;
  description: string;
  brandVoice: string;
  targetAudience: string;
  services: string[];
  products: string[];
  existingNames: string[];
}): Promise<ProductGenResult[]> {
  const { count, companyName, industry, description, brandVoice, targetAudience, services, products, existingNames } = params;

  const context = [
    companyName     ? `Company: ${companyName}`             : null,
    industry        ? `Industry: ${industry}`               : null,
    description     ? `About: ${description}`               : null,
    brandVoice      ? `Brand voice: ${brandVoice}`          : null,
    targetAudience  ? `Target audience: ${targetAudience}`  : null,
    services.length ? `Services: ${services.join(", ")}`    : null,
    products.length ? `Existing products: ${products.join(", ")}` : null,
  ].filter(Boolean).join("\n");

  const avoid = existingNames.length
    ? `\n\nDo NOT repeat these existing product names:\n${existingNames.map((n) => `- ${n}`).join("\n")}`
    : "";

  const system = `You are a product content specialist. Based on the business context below, generate exactly ${count} realistic product catalog entries for this company's product/service offerings.

Rules:
- Each product should be a real-sounding offering this company could sell (physical product, digital product, service package, or subscription tier).
- Write description in plain text (1-2 sentences). Write content as detailed HTML using <p>, <h2>, <ul>, <li>, <strong>.
- Include realistic features (array of short strings) and specifications (array of {key, value} objects).
- Set price to a realistic numeric value in USD, or null if it's a service with custom pricing.
- Generate relevant tags (2-4 per product).
- Return ONLY a valid JSON array (no fences, no commentary) of exactly ${count} objects:
[{
  "name": "...",
  "description": "...",
  "content": "<p>...</p>",
  "category": "...",
  "brand": "${companyName || 'Brand'}",
  "price": 99.00,
  "currency": "USD",
  "features": ["Feature 1", "Feature 2"],
  "specifications": [{"key": "Spec", "value": "Value"}],
  "tags": ["tag1", "tag2"],
  "seo_title": "...",
  "meta_description": "..."
}]`;

  const raw = await callAI([
    { role: "system", content: system },
    { role: "user", content: `Business context:\n${context}${avoid}` },
  ]);

  try {
    const parsed = JSON.parse(raw);
    if (Array.isArray(parsed)) return parsed as ProductGenResult[];
    throw new Error("not an array");
  } catch {
    const match = raw.match(/\[[\s\S]*\]/);
    if (match) return JSON.parse(match[0]) as ProductGenResult[];
    throw new Error("AI returned invalid JSON for product batch");
  }
}

async function generateProductSuggestions(params: {
  count: number;
  industry: string;
  companyName: string;
  existingNames: string[];
}): Promise<string[]> {
  const { count, industry, companyName, existingNames } = params;
  const system = `You are a product strategist. Suggest exactly ${count} additional product/service names that would be valuable additions to this company's catalog, different from what already exists. Return ONLY a valid JSON array of ${count} strings (product names only), no commentary, no fences.`;
  const raw = await callAI([
    { role: "system", content: system },
    { role: "user", content: `Company: ${companyName ?? "N/A"}\nIndustry: ${industry ?? "N/A"}\nAlready has:\n${existingNames.map((n) => `- ${n}`).join("\n")}` },
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

  const { data: existingProducts } = await (adminClient as any)
    .from("products")
    .select("name, slug")
    .eq("workspace_id", workspaceId);

  const existingNames: string[] = (existingProducts ?? []).map((p: { name: string }) => p.name);
  const existingSlugs = new Set<string>((existingProducts ?? []).map((p: { slug: string }) => p.slug));

  try {
    const batch = await generateProductBatch({
      count,
      companyName: ws.name ?? "",
      industry: ws.industry ?? "",
      description: ws.description ?? "",
      brandVoice: ws.brand_voice ?? "Professional",
      targetAudience: ws.target_audience ?? "",
      services,
      products,
      existingNames,
    });

    const rows = batch.slice(0, count).map((p, i) => ({
      workspace_id:     workspaceId,
      name:             p.name,
      slug:             uniqueSlug(p.name, existingSlugs),
      description:      p.description || "",
      content:          p.content || "",
      category:         p.category || "General",
      brand:            p.brand || ws.name || "",
      price:            typeof p.price === "number" ? p.price : null,
      currency:         p.currency || "USD",
      features:         Array.isArray(p.features) ? p.features : [],
      specifications:   Array.isArray(p.specifications) ? p.specifications : [],
      tags:             Array.isArray(p.tags) ? p.tags : [],
      seo_title:        p.seo_title || p.name,
      meta_description: p.meta_description || p.description || "",
      status:           "published",
      sort_order:       existingNames.length + i,
    }));

    const { data: inserted, error: insertError } = await (adminClient as any)
      .from("products")
      .insert(rows)
      .select("id, name, slug");

    if (insertError) throw new Error(insertError.message);

    let suggestions: string[] = [];
    if (suggestionCount > 0) {
      suggestions = await generateProductSuggestions({
        count: suggestionCount,
        industry: ws.industry ?? "",
        companyName: ws.name ?? "",
        existingNames: [...existingNames, ...batch.map((p) => p.name)],
      });

      if (suggestions.length) {
        await (adminClient as any).from("workspace_content_opportunities").insert(
          suggestions.slice(0, suggestionCount).map((title) => ({
            workspace_id: workspaceId,
            title,
            type:         "product",
            topic:        ws.industry ?? "",
            reason:       "AI-suggested product from site analysis",
            priority:     "medium",
            status:       "suggested",
          })),
        );
      }
    }

    return json({
      generated:   (inserted ?? []).length,
      products:    inserted ?? [],
      suggestions,
    });
  } catch (err: unknown) {
    return json({ error: err instanceof Error ? err.message : String(err) }, 500);
  }
});
