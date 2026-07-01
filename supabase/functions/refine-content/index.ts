// Supabase Edge Function: refine blog content with Lovable AI.
// Uses the LOVABLE_API_KEY managed secret available in the Supabase runtime.

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

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
  seo: "Rewrite for SEO: keyword-rich, scannable headings, strong intro and conclusion, while staying natural.",
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const apiKey = Deno.env.get("LOVABLE_API_KEY");
    if (!apiKey) {
      return new Response(
        JSON.stringify({ error: "LOVABLE_API_KEY is not configured." }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }

    const body = await req.json().catch(() => ({}));
    const content: string = typeof body.content === "string" ? body.content : "";
    const title: string = typeof body.title === "string" ? body.title : "";
    const action: string = body.action === "metadata" ? "metadata" : "refine";
    const mode: RefineMode =
      body.mode && body.mode in INSTRUCTIONS ? body.mode : "improve";

    if (!content.trim()) {
      return new Response(JSON.stringify({ error: "No content provided." }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const systemPrompt =
      action === "metadata"
        ? `You are an expert blog editor. Based on the article, generate SEO-friendly metadata.
Return ONLY a valid JSON object (no markdown fences, no commentary) with exactly these keys:
{"title": string (max 60 chars, compelling), "excerpt": string (1-2 sentences, max 160 chars summarizing the article), "tags": string[] (3-6 short lowercase topic tags)}.`
        : `You are an expert blog editor. ${INSTRUCTIONS[mode]}
Return ONLY the refined article body as clean semantic HTML (use <h2>, <h3>, <p>, <ul>, <ol>, <li>, <blockquote>, <strong>, <em>, <a>). Do not wrap it in markdown code fences. Do not include <html>, <head> or <body> tags. Do not add commentary.`;

    const userPrompt = `${title ? `Title: ${title}\n\n` : ""}Article HTML:\n${content}`;

    const res = await fetch(
      "https://ai.gateway.lovable.dev/v1/chat/completions",
      {
        method: "POST",
        headers: {
          Authorization: `Bearer ${apiKey}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          model: "google/gemini-3-flash-preview",
          messages: [
            { role: "system", content: systemPrompt },
            { role: "user", content: userPrompt },
          ],
        }),
      },
    );

    if (res.status === 429) {
      return new Response(
        JSON.stringify({ error: "Rate limit reached. Please try again shortly." }),
        { status: 429, headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }
    if (res.status === 402) {
      return new Response(
        JSON.stringify({ error: "AI credits exhausted. Please add credits to continue." }),
        { status: 402, headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }
    if (!res.ok) {
      const detail = await res.text();
      return new Response(
        JSON.stringify({ error: "AI request failed.", detail }),
        { status: 502, headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }

    const data = await res.json();
    let raw: string = data?.choices?.[0]?.message?.content ?? "";
    raw = raw
      .replace(/^```(?:html|json)?\s*/i, "")
      .replace(/\s*```$/i, "")
      .trim();

    if (action === "metadata") {
      let meta: { title?: string; excerpt?: string; tags?: string[] } = {};
      try {
        const match = raw.match(/\{[\s\S]*\}/);
        meta = JSON.parse(match ? match[0] : raw);
      } catch {
        return new Response(
          JSON.stringify({ error: "Could not parse AI metadata." }),
          { status: 502, headers: { ...corsHeaders, "Content-Type": "application/json" } },
        );
      }
      return new Response(
        JSON.stringify({
          title: typeof meta.title === "string" ? meta.title : "",
          excerpt: typeof meta.excerpt === "string" ? meta.excerpt : "",
          tags: Array.isArray(meta.tags)
            ? meta.tags.filter((t) => typeof t === "string")
            : [],
        }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }

    return new Response(JSON.stringify({ refined: raw }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });

  } catch (err) {
    return new Response(
      JSON.stringify({ error: err instanceof Error ? err.message : "Unknown error" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  }
});
