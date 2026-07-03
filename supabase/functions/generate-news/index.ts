// Edge Function: generate-news
// Uses workspace site intelligence to identify the industry, searches for
// related real industry news via SERP (Google News engine), then writes
// AI-authored news summaries citing the real sources. Falls back to
// AI-only industry-trend items if SERP is unavailable/unconfigured.

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

// ── AI helpers (Lovable → Mistral fallback) ─────────────────────────────────
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

// ── SERP Google News search ──────────────────────────────────────────────────
interface SerpNewsResult {
  title: string;
  link: string;
  source: string;
  date?: string;
  snippet?: string;
}

async function searchIndustryNews(query: string, num = 15): Promise<SerpNewsResult[]> {
  const serpKey = Deno.env.get("SERP_API_KEY");
  if (!serpKey) return [];

  try {
    const params = new URLSearchParams({
      api_key: serpKey,
      engine:  "google_news",
      q:       query,
      gl:      "us",
      hl:      "en",
    });
    const res = await fetch(`https://serpapi.com/search.json?${params}`);
    if (!res.ok) return [];
    const data = await res.json();
    const results: any[] = data?.news_results ?? [];
    return results.slice(0, num).map((r) => ({
      title:   r.title ?? "",
      link:    r.link ?? "",
      source:  r.source?.name ?? r.source ?? "Unknown",
      date:    r.date ?? undefined,
      snippet: r.snippet ?? "",
    })).filter((r) => r.title && r.link);
  } catch {
    return [];
  }
}

function slugify(text: string): string {
  return text.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "").slice(0, 120);
}

interface NewsGenResult {
  title: string;
  excerpt: string;
  content: string;
  category: string;
  seoTitle: string;
  metaDescription: string;
}

async function writeNewsFromSource(params: {
  sourceTitle: string;
  sourceSnippet: string | null;
  sourceName: string;
  industry: string | null;
  companyName: string | null;
  brandVoice: string | null;
}): Promise<NewsGenResult> {
  const { sourceTitle, sourceSnippet, sourceName, industry, companyName, brandVoice } = params;

  const system = `You are a news editor writing for "${companyName ?? "our"}" company blog's industry news section. Given a real news headline/snippet from ${sourceName}, write an original news-style summary article about it (do not plagiarize — rewrite in your own words, attribute the source).

Rules:
- Write in clean HTML using only <p>, <h3>, <ul>, <li>, <strong>, <em>, <blockquote>.
- 300-500 words. Include: what happened, why it matters to businesses in this industry, and a closing takeaway.
- Attribute the original reporting to "${sourceName}" in the text.
- Brand voice: ${brandVoice ?? "Professional and informative"}.
- Return ONLY a valid JSON object (no fences) with this exact shape:
{ "title": "concise news title (max 80 chars)", "excerpt": "1-2 sentence summary (max 200 chars)", "content": "<p>...</p>", "category": "one of: Industry Trends, Company News, Market Analysis, Regulation, Technology, General", "seoTitle": "max 60 chars", "metaDescription": "max 160 chars" }`;

  const raw = await callAI([
    { role: "system", content: system },
    { role: "user", content: `Source headline: "${sourceTitle}"\nSource snippet: ${sourceSnippet ?? "N/A"}\nIndustry context: ${industry ?? "N/A"}` },
  ]);

  try {
    return JSON.parse(raw) as NewsGenResult;
  } catch {
    const match = raw.match(/\{[\s\S]*\}/);
    if (match) return JSON.parse(match[0]) as NewsGenResult;
    throw new Error("AI returned invalid JSON for news content");
  }
}

async function writeTrendNewsItem(params: {
  industry: string | null;
  companyName: string | null;
  brandVoice: string | null;
  avoidTitles: string[];
}): Promise<NewsGenResult> {
  const { industry, companyName, brandVoice, avoidTitles } = params;
  const system = `You are a news editor. No live web search results were available, so write an evergreen "industry trend" news-style article relevant to the "${industry ?? "general business"}" industry that "${companyName ?? "this company"}"'s customers would find timely and useful. Do not fabricate specific dated events, company names, or statistics presented as fact — frame it as trend analysis.

Rules:
- Clean HTML using only <p>, <h3>, <ul>, <li>, <strong>, <em>, <blockquote>.
- 300-500 words.
- Brand voice: ${brandVoice ?? "Professional and informative"}.
- Avoid these already-used titles: ${avoidTitles.join(", ") || "none"}.
- Return ONLY a valid JSON object (no fences): { "title": "...", "excerpt": "...", "content": "...", "category": "Industry Trends", "seoTitle": "...", "metaDescription": "..." }`;

  const raw = await callAI([
    { role: "system", content: system },
    { role: "user", content: `Write one industry trend news article for the ${industry ?? "general"} industry.` },
  ]);
  try {
    return JSON.parse(raw) as NewsGenResult;
  } catch {
    const match = raw.match(/\{[\s\S]*\}/);
    if (match) return JSON.parse(match[0]) as NewsGenResult;
    throw new Error("AI returned invalid JSON for trend news content");
  }
}

async function generateNewsTopicSuggestions(params: {
  count: number;
  industry: string | null;
  existingTitles: string[];
}): Promise<string[]> {
  const { count, industry, existingTitles } = params;
  const system = `Suggest exactly ${count} additional industry-news story angles/topics (headline-style, not full articles) for the "${industry ?? "general business"}" industry, distinct from what's already covered. Return ONLY a valid JSON array of ${count} strings, no fences, no commentary.`;
  const raw = await callAI([
    { role: "system", content: system },
    { role: "user", content: `Already covered:\n${existingTitles.map((t) => `- ${t}`).join("\n")}` },
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
    .select("name, industry, brand_voice, description")
    .eq("id", workspaceId)
    .maybeSingle();

  if (!ws) return json({ error: "Workspace not found" }, 404);

  const industry    = ws.industry ?? null;
  const companyName = ws.name ?? null;
  const brandVoice  = ws.brand_voice ?? null;

  try {
    // ── 1. Search for real industry news via SERP ────────────────────────
    const query = industry ? `${industry} industry news` : `${companyName ?? "business"} industry news`;
    const searchResults = await searchIndustryNews(query, count);

    const items: Array<{ result?: NewsGenResult; source?: SerpNewsResult; error?: string }> = [];

    if (searchResults.length > 0) {
      for (const r of searchResults.slice(0, count)) {
        try {
          const result = await writeNewsFromSource({
            sourceTitle: r.title,
            sourceSnippet: r.snippet ?? null,
            sourceName: r.source,
            industry, companyName, brandVoice,
          });
          items.push({ result, source: r });
        } catch (e) {
          items.push({ error: e instanceof Error ? e.message : String(e) });
        }
      }
    }

    // ── 2. Fill remaining slots with AI trend articles if SERP unavailable/short
    const remainingNeeded = count - items.filter((i) => i.result).length;
    for (let i = 0; i < remainingNeeded; i++) {
      try {
        const result = await writeTrendNewsItem({
          industry, companyName, brandVoice,
          avoidTitles: items.filter((it) => it.result).map((it) => it.result!.title),
        });
        items.push({ result });
      } catch (e) {
        items.push({ error: e instanceof Error ? e.message : String(e) });
      }
    }

    // ── 3. Insert generated news items ────────────────────────────────────
    const toInsert = items.filter((i) => i.result);
    const rows = toInsert.map((i) => {
      const r = i.result!;
      const baseSlug = slugify(r.title) || `news-${Date.now()}`;
      return {
        workspace_id:      workspaceId,
        title:             r.title,
        slug:              `${baseSlug}-${Math.random().toString(36).slice(2, 7)}`,
        excerpt:           r.excerpt,
        content:           r.content,
        category:          r.category || "General",
        source_name:       i.source?.source ?? null,
        source_url:        i.source?.link ?? null,
        breaking:          false,
        featured:          false,
        status:            "draft",
        published_at:      null,
        seo_title:         r.seoTitle,
        meta_description:  r.metaDescription,
      };
    });

    const { data: inserted, error: insertError } = rows.length
      ? await (adminClient as any).from("news").insert(rows).select("id, title, slug")
      : { data: [], error: null };

    if (insertError) throw new Error(insertError.message);

    // ── 4. Generate additional suggested topics ───────────────────────────
    let suggestions: string[] = [];
    if (suggestionCount > 0) {
      suggestions = await generateNewsTopicSuggestions({
        count: suggestionCount,
        industry,
        existingTitles: rows.map((r) => r.title),
      });

      if (suggestions.length) {
        await (adminClient as any).from("workspace_content_opportunities").insert(
          suggestions.slice(0, suggestionCount).map((title) => ({
            workspace_id: workspaceId,
            title,
            type: "news",
            topic: industry,
            reason: "AI-suggested industry news angle",
            priority: "medium",
            status: "suggested",
          })),
        );
      }
    }

    return json({
      generated: (inserted ?? []).length,
      failed:    items.filter((i) => i.error).length,
      used_web_search: searchResults.length > 0,
      news: inserted ?? [],
      suggestions,
    });
  } catch (err: unknown) {
    return json({ error: err instanceof Error ? err.message : String(err) }, 500);
  }
});
