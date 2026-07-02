// Supabase Edge Function: analyze-website
// Crawls a website using Firecrawl, then uses AI to extract business intelligence,
// competitor insights, and content opportunities.

import { createClient } from "jsr:@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

const LOVABLE_GATEWAY = "https://ai.gateway.lovable.dev/v1/chat/completions";
const LOVABLE_MODEL = "google/gemini-3-flash-preview";
const MISTRAL_GATEWAY = "https://api.mistral.ai/v1/chat/completions";
const MISTRAL_MODEL = "mistral-large-latest";

interface ChatMessage { role: "system" | "user" | "assistant"; content: string }

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

  if (!mistralKey) throw new Error("No AI provider configured.");

  const res = await fetch(MISTRAL_GATEWAY, {
    method: "POST",
    headers: { Authorization: `Bearer ${mistralKey}`, "Content-Type": "application/json" },
    body: JSON.stringify({ model: MISTRAL_MODEL, messages }),
  });
  if (!res.ok) throw new Error(`Mistral error ${res.status}: ${await res.text()}`);
  const data = await res.json();
  return stripFences(data?.choices?.[0]?.message?.content ?? "");
}

function stripFences(raw: string): string {
  return raw.replace(/^```(?:json|markdown|html)?\s*/i, "").replace(/\s*```$/i, "").trim();
}

function normalizeUrl(url: string): string {
  let u = url.trim();
  if (!u.startsWith("http://") && !u.startsWith("https://")) u = "https://" + u;
  try {
    const parsed = new URL(u);
    return parsed.origin; // e.g. https://example.com
  } catch {
    return u;
  }
}

interface ScrapeResult {
  content: string;
  logoUrl: string | null;
  images: string[];
}

async function firecrawlScrape(url: string, firecrawlKey: string): Promise<ScrapeResult> {
  const res = await fetch("https://api.firecrawl.dev/v1/scrape", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${firecrawlKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      url,
      formats: ["markdown"],
      onlyMainContent: true,
      timeout: 20000,
    }),
  });

  if (!res.ok) {
    const txt = await res.text();
    throw new Error(`Firecrawl error ${res.status}: ${txt}`);
  }

  const data = await res.json();
  const content = (data?.data?.markdown ?? data?.markdown ?? "").slice(0, 8000);

  // Extract logo/images from metadata
  const meta = data?.data?.metadata ?? {};
  const logoUrl = meta?.ogImage ?? meta?.favicon ?? null;

  // Collect images from metadata or content
  const images: string[] = [];
  if (meta?.ogImage) images.push(meta.ogImage);

  return { content, logoUrl, images };
}

async function serpSearch(query: string, serpKey: string): Promise<string> {
  const url = `https://serpapi.com/search.json?q=${encodeURIComponent(query)}&api_key=${serpKey}&num=10`;
  try {
    const res = await fetch(url);
    if (!res.ok) return "";
    const data = await res.json();
    const results = (data?.organic_results ?? []).slice(0, 8);
    return results.map((r: { title: string; link: string; snippet?: string }) =>
      `${r.title} - ${r.link}: ${r.snippet ?? ""}`
    ).join("\n");
  } catch {
    return "";
  }
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const { url } = await req.json();
    if (!url) return Response.json({ error: "url is required" }, { status: 400, headers: corsHeaders });

    const normalizedUrl = normalizeUrl(url);
    const domain = new URL(normalizedUrl).hostname.replace("www.", "");

    const firecrawlKey = Deno.env.get("FIRECRAWL_API_KEY");
    const serpKey = Deno.env.get("SERP_API_KEY") ?? Deno.env.get("SERPAPI_KEY") ?? Deno.env.get("SERPAPI_API_KEY");

    // ── 1. Crawl the website ─────────────────────────────────────────────────
    let websiteContent = "";
    let logoUrl: string | null = null;
    const siteImages: string[] = [];

    if (firecrawlKey) {
      try {
        const pages = [normalizedUrl];
        try {
          const mapRes = await fetch("https://api.firecrawl.dev/v1/map", {
            method: "POST",
            headers: { Authorization: `Bearer ${firecrawlKey}`, "Content-Type": "application/json" },
            body: JSON.stringify({ url: normalizedUrl, limit: 5 }),
          });
          if (mapRes.ok) {
            const mapData = await mapRes.json();
            const extras: string[] = (mapData?.links ?? []).filter((l: string) =>
              /about|service|product|team|solution|feature/i.test(l)
            ).slice(0, 3);
            pages.push(...extras);
          }
        } catch { /* ignore */ }

        const contents = await Promise.allSettled(
          pages.map((p) => firecrawlScrape(p, firecrawlKey))
        );

        const fulfilled = contents.filter(
          (r): r is PromiseFulfilledResult<ScrapeResult> => r.status === "fulfilled"
        );

        websiteContent = fulfilled
          .map((r) => r.value.content)
          .join("\n\n---\n\n")
          .slice(0, 12000);

        // Prefer homepage logo, then any page
        for (const r of fulfilled) {
          if (r.value.logoUrl && !logoUrl) logoUrl = r.value.logoUrl;
          siteImages.push(...r.value.images);
        }
      } catch (e) {
        console.error("Firecrawl error:", e);
      }
    }

    // Always have a reliable favicon fallback
    const faviconFallback = `https://www.google.com/s2/favicons?domain=${domain}&sz=128`;
    const finalLogoUrl = logoUrl ?? faviconFallback;

    // ── 2. SERP competitor search ────────────────────────────────────────────
    let serpResults = "";
    if (serpKey) {
      try {
        serpResults = await serpSearch(`competitors of ${domain} OR alternatives to ${domain}`, serpKey);
      } catch (e) {
        console.error("SERP error:", e);
      }
    }

    // ── 3. AI analysis ──────────────────────────────────────────────────────
    const hasContent = websiteContent.length > 100;
    const contentSection = hasContent
      ? `\n\nWEBSITE CONTENT:\n${websiteContent}`
      : `\n\nNo website content was scraped. Make reasonable inferences from the domain name: ${domain}`;

    const serpSection = serpResults
      ? `\n\nSERP COMPETITOR DATA:\n${serpResults}`
      : "";

    const analysisPrompt = `You are a business intelligence analyst. Analyze the website at ${normalizedUrl} (domain: ${domain}).${contentSection}${serpSection}

Return ONLY a valid JSON object (no markdown fences, no explanation) with this exact structure:
{
  "websiteName": "string",
  "companyName": "string",
  "industry": "string",
  "description": "2-3 sentence summary of what this business does",
  "targetAudience": "string describing the primary target audience",
  "businessModel": "B2B | B2C | B2B2C | SaaS | E-commerce | Agency | Blog | Other",
  "services": ["string", "string"],
  "products": ["string"],
  "brandVoice": "Professional | Friendly | Technical | Creative | Authoritative | Conversational",
  "primaryTopics": ["string", "string", "string"],
  "keywords": ["string", "string", "string", "string", "string"],
  "location": "City, Country or null",
  "language": "en",
  "socialLinks": { "twitter": "", "linkedin": "", "instagram": "", "facebook": "" },
  "competitors": [
    {
      "name": "string",
      "website": "https://...",
      "description": "string",
      "strengths": ["string"],
      "weaknesses": ["string"],
      "contentStrategy": "string"
    }
  ],
  "contentOpportunities": [
    {
      "title": "string",
      "type": "blog | guide | faq | comparison | case-study",
      "topic": "string",
      "reason": "Why this is a good opportunity",
      "priority": "high | medium | low"
    }
  ],
  "contentPillars": ["string", "string", "string", "string"],
  "suggestedTags": ["string", "string", "string"],
  "suggestedCategories": ["string", "string", "string"],
  "brandSummary": "A comprehensive 3-4 sentence brand context that will be used to power AI content generation"
}

Provide at least 3 competitors, 5 content opportunities, and 4 content pillars. Be specific and accurate.`;

    const raw = await callAI([
      { role: "system", content: "You are a business intelligence analyst. Always return valid JSON only, no markdown fences." },
      { role: "user", content: analysisPrompt },
    ]);

    let intelligence: Record<string, unknown>;
    try {
      intelligence = JSON.parse(raw);
    } catch {
      const match = raw.match(/\{[\s\S]+\}/);
      if (!match) throw new Error("AI returned invalid JSON");
      intelligence = JSON.parse(match[0]);
    }

    // Inject logo and images into intelligence (not from AI, from scraping)
    intelligence.logoUrl = finalLogoUrl;
    intelligence.siteImages = siteImages.slice(0, 6);

    return Response.json(
      { success: true, url: normalizedUrl, domain, intelligence },
      { headers: corsHeaders }
    );
  } catch (err) {
    console.error("analyze-website error:", err);
    return Response.json(
      { error: err instanceof Error ? err.message : String(err) },
      { status: 500, headers: corsHeaders }
    );
  }
});
