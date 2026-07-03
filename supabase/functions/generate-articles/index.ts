// Edge Function: generate-articles
// Analyzes workspace site intelligence and generates a batch of long-form
// article drafts (guides, tutorials, case studies), plus suggestions for later.

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
  return raw.replace(/^```(?:json|html|markdown)?\s*/i, "").replace(/\s*```$/i, "").trim();
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
    .slice(0, 100);
}

function uniqueSlug(base: string, existing: Set<string>): string {
  let slug = slugify(base);
  let counter = 2;
  while (existing.has(slug)) { slug = `${slugify(base)}-${counter++}`; }
  existing.add(slug);
  return slug;
}

function estimateReadingTime(html: string): number {
  const words = html.replace(/<[^>]+>/g, " ").split(/\s+/).filter(Boolean).length;
  return Math.max(1, Math.round(words / 200));
}

function countWords(html: string): number {
  return html.replace(/<[^>]+>/g, " ").split(/\s+/).filter(Boolean).length;
}

// ── Article generation ────────────────────────────────────────────────────────
interface ArticleGenResult {
  title: string;
  excerpt: string;
  content: string;
  category: string;
  tags: string[];
  article_type: string;
  seo_title: string;
  meta_description: string;
}

const ARTICLE_TYPES = ["guide", "tutorial", "case-study", "educational", "guide"];

async function generateArticleBatch(params: {
  count: number;
  companyName: string;
  industry: string;
  description: string;
  brandVoice: string;
  targetAudience: string;
  services: string[];
  primaryTopics: string[];
  existingTitles: string[];
}): Promise<ArticleGenResult[]> {
  const { count, companyName, industry, description, brandVoice, targetAudience, services, primaryTopics, existingTitles } = params;

  const context = [
    companyName      ? `Company: ${companyName}`            : null,
    industry         ? `Industry: ${industry}`              : null,
    description      ? `About: ${description}`              : null,
    brandVoice       ? `Brand voice: ${brandVoice}`         : null,
    targetAudience   ? `Target audience: ${targetAudience}` : null,
    services.length  ? `Services: ${services.join(", ")}`   : null,
    primaryTopics.length ? `Key topics: ${primaryTopics.join(", ")}` : null,
  ].filter(Boolean).join("\n");

  const avoid = existingTitles.length
    ? `\n\nDo NOT repeat or closely paraphrase these existing titles:\n${existingTitles.map((t) => `- ${t}`).join("\n")}`
    : "";

  const system = `You are an expert content writer and industry specialist. Based on the business context below, write exactly ${count} long-form educational articles that would be genuinely valuable to this company's target audience.

Rules:
- Mix article types: guides, tutorials, case studies, and educational pieces.
- Each article content should be 600-1000 words of rich HTML (use <h2>, <h3>, <p>, <ul>, <li>, <strong>, <em>, <blockquote>).
- Excerpt should be 1-2 sentences summarizing the article.
- Category should reflect the main topic area.
- Tags should be 3-5 relevant keywords.
- article_type must be one of: guide, tutorial, case-study, educational
- Return ONLY a valid JSON array (no fences, no commentary) of exactly ${count} objects:
[{
  "title": "...",
  "excerpt": "...",
  "content": "<h2>...</h2><p>...</p>...",
  "category": "...",
  "tags": ["tag1", "tag2", "tag3"],
  "article_type": "guide",
  "seo_title": "...",
  "meta_description": "..."
}]`;

  const raw = await callAI([
    { role: "system", content: system },
    { role: "user", content: `Business context:\n${context}${avoid}` },
  ]);

  try {
    const parsed = JSON.parse(raw);
    if (Array.isArray(parsed)) return parsed as ArticleGenResult[];
    throw new Error("not an array");
  } catch {
    const match = raw.match(/\[[\s\S]*\]/);
    if (match) return JSON.parse(match[0]) as ArticleGenResult[];
    throw new Error("AI returned invalid JSON for article batch");
  }
}

async function generateArticleSuggestions(params: {
  count: number;
  industry: string;
  companyName: string;
  existingTitles: string[];
}): Promise<string[]> {
  const { count, industry, companyName, existingTitles } = params;
  const system = `You are a content strategist. Suggest exactly ${count} article title ideas that would be valuable for this company's content library, different from what already exists. Return ONLY a valid JSON array of ${count} strings, no commentary, no fences.`;
  const raw = await callAI([
    { role: "system", content: system },
    { role: "user", content: `Company: ${companyName ?? "N/A"}\nIndustry: ${industry ?? "N/A"}\nAlready written:\n${existingTitles.map((t) => `- ${t}`).join("\n")}` },
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

  const services: string[]      = ws.ai_context?.services ?? [];
  const primaryTopics: string[] = ws.ai_context?.primaryTopics ?? [];

  const { data: existingArticles } = await (adminClient as any)
    .from("articles")
    .select("title, slug")
    .eq("workspace_id", workspaceId);

  const existingTitles: string[] = (existingArticles ?? []).map((a: { title: string }) => a.title);
  const existingSlugs = new Set<string>((existingArticles ?? []).map((a: { slug: string }) => a.slug));

  try {
    const batch = await generateArticleBatch({
      count,
      companyName:   ws.name ?? "",
      industry:      ws.industry ?? "",
      description:   ws.description ?? "",
      brandVoice:    ws.brand_voice ?? "Professional",
      targetAudience: ws.target_audience ?? "",
      services,
      primaryTopics,
      existingTitles,
    });

    const now = new Date().toISOString();
    const rows = batch.slice(0, count).map((a) => {
      const validType = ["guide","tutorial","case-study","educational"].includes(a.article_type)
        ? a.article_type : "guide";
      return {
        workspace_id:     workspaceId,
        title:            a.title,
        slug:             uniqueSlug(a.title, existingSlugs),
        excerpt:          a.excerpt || "",
        content:          a.content || "",
        category:         a.category || "General",
        tags:             Array.isArray(a.tags) ? a.tags : [],
        author_name:      "AI Assistant",
        article_type:     validType,
        reading_time:     estimateReadingTime(a.content || ""),
        word_count:       countWords(a.content || ""),
        seo_title:        a.seo_title || a.title,
        meta_description: a.meta_description || a.excerpt || "",
        status:           "draft",
        published_at:     null,
      };
    });

    const { data: inserted, error: insertError } = await (adminClient as any)
      .from("articles")
      .insert(rows)
      .select("id, title, slug, article_type");

    if (insertError) throw new Error(insertError.message);

    let suggestions: string[] = [];
    if (suggestionCount > 0) {
      suggestions = await generateArticleSuggestions({
        count: suggestionCount,
        industry:    ws.industry ?? "",
        companyName: ws.name ?? "",
        existingTitles: [...existingTitles, ...batch.map((a) => a.title)],
      });

      if (suggestions.length) {
        await (adminClient as any).from("workspace_content_opportunities").insert(
          suggestions.slice(0, suggestionCount).map((title) => ({
            workspace_id: workspaceId,
            title,
            type:         "article",
            topic:        ws.industry ?? "",
            reason:       "AI-suggested article from site analysis",
            priority:     "medium",
            status:       "suggested",
          })),
        );
      }
    }

    return json({
      generated:   (inserted ?? []).length,
      articles:    inserted ?? [],
      suggestions,
    });
  } catch (err: unknown) {
    return json({ error: err instanceof Error ? err.message : String(err) }, 500);
  }
});
