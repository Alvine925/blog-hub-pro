// Edge Function: generate-blog-post
// Generates a full blog post from a content opportunity using AI, then fetches a cover image
// using a sequential fallback chain:
//   1. Pollinations AI  — free, no key required
//   2. SERP API         — real web image (downloaded + stored)
//   3. Hugging Face     — FLUX AI generation
// Every successful image is downloaded and uploaded to Supabase Storage (blog-images bucket).
// Stores the result in blog_posts and returns the new post id.

import { createClient } from "jsr:@supabase/supabase-js@2";
import { isTrustedCaller } from "../_shared/trusted-caller.ts";

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

// ── Image prompt generation ───────────────────────────────────────────────────
async function generateImagePrompt(params: {
  title: string;
  topic: string | null;
  excerpt: string;
  industry: string | null;
  brandVoice: string | null;
}): Promise<string> {
  const { title, topic, excerpt, industry, brandVoice } = params;
  const context = [
    `Blog post title: "${title}"`,
    topic      ? `Topic: ${topic}`           : null,
    excerpt    ? `Summary: ${excerpt}`       : null,
    industry   ? `Industry: ${industry}`     : null,
    brandVoice ? `Brand voice: ${brandVoice}` : null,
  ].filter(Boolean).join("\n");

  const system = `You are a creative director specializing in blog cover imagery. 
Generate a single detailed, vivid image prompt for a photorealistic cover image that perfectly matches the blog post's theme.
The prompt should be rich with visual details: lighting, mood, setting, style, colors.
Describe a scene or concept — not text on an image. Avoid abstract art unless the topic is clearly creative.
Return ONLY the image prompt as a single descriptive paragraph, no commentary.`;

  return callAI([
    { role: "system", content: system },
    { role: "user", content: `Create an image prompt for a blog post with these details:\n${context}` },
  ]);
}

// ── Download image bytes from any URL ────────────────────────────────────────
async function fetchBytes(url: string, timeoutMs = 30_000): Promise<Uint8Array | null> {
  try {
    const res = await fetch(url, {
      headers: { "User-Agent": "Mozilla/5.0 (compatible; Googlebot/2.1)" },
      signal: AbortSignal.timeout(timeoutMs),
    });
    if (!res.ok) return null;
    const ct = res.headers.get("content-type") ?? "";
    if (!ct.startsWith("image/")) return null;
    const buf = await res.arrayBuffer();
    return buf.byteLength >= 2000 ? new Uint8Array(buf) : null;
  } catch { return null; }
}

// ── 1. Pollinations AI ────────────────────────────────────────────────────────
// Free image generation — no API key required.
// URL: https://image.pollinations.ai/prompt/{encoded_prompt}
async function fetchPollinationsImage(prompt: string): Promise<{ bytes: Uint8Array | null; error?: string }> {
  try {
    const url = `https://image.pollinations.ai/prompt/${encodeURIComponent(prompt)}`;
    console.log("[Pollinations] Requesting:", url.slice(0, 120));
    const res = await fetch(url, {
      headers: { "User-Agent": "Mozilla/5.0" },
      signal: AbortSignal.timeout(45_000),
      redirect: "follow",
    });
    if (!res.ok) {
      return { bytes: null, error: `Pollinations HTTP ${res.status}` };
    }
    const ct = res.headers.get("content-type") ?? "";
    if (!ct.startsWith("image/")) {
      return { bytes: null, error: `Pollinations returned non-image content-type: ${ct}` };
    }
    const buf = await res.arrayBuffer();
    if (buf.byteLength < 2000) {
      return { bytes: null, error: `Pollinations image too small (${buf.byteLength}B)` };
    }
    console.log("[Pollinations] Success:", buf.byteLength, "bytes");
    return { bytes: new Uint8Array(buf) };
  } catch (e) {
    return { bytes: null, error: `Pollinations error: ${e instanceof Error ? e.message : String(e)}` };
  }
}

// ── 2. SERP API image search (returns downloaded bytes) ──────────────────────
const SERP_BLOCKED_DOMAINS = [
  "instagram.com", "cdninstagram.com", "lookaside.instagram.com",
  "facebook.com", "fbcdn.net", "fbsbx.com",
  "shutterstock.com", "gettyimages.com", "istockphoto.com", "alamy.com",
  "depositphotos.com", "dreamstime.com", "123rf.com",
  "pinterest.com", "pinimg.com",
  "twimg.com",
];

function isSerpUrlUsable(url: string): boolean {
  if (!url.startsWith("http") || url.startsWith("data:")) return false;
  try {
    const host = new URL(url).hostname.toLowerCase();
    return !SERP_BLOCKED_DOMAINS.some(
      (blocked) => host === blocked || host.endsWith("." + blocked),
    );
  } catch {
    return false;
  }
}

async function probeImageUrl(url: string): Promise<boolean> {
  try {
    const res = await fetch(url, {
      method: "HEAD",
      headers: { "User-Agent": "Mozilla/5.0 (compatible; Googlebot/2.1)" },
      redirect: "follow",
      signal: AbortSignal.timeout(4_000),
    });
    if (!res.ok) return false;
    const ct = res.headers.get("content-type") ?? "";
    return ct.startsWith("image/");
  } catch {
    return false;
  }
}

async function fetchSerpImageBytes(query: string): Promise<{ bytes: Uint8Array | null; error?: string }> {
  const serpKey = Deno.env.get("SERP_API_KEY");
  if (!serpKey) return { bytes: null, error: "SERP_API_KEY not set" };

  try {
    const params = new URLSearchParams({
      api_key: serpKey,
      engine:  "google_images",
      q:       query,
      num:     "20",
      safe:    "active",
    });
    const res = await fetch(`https://serpapi.com/search.json?${params}`);
    if (!res.ok) {
      const detail = await res.text().catch(() => res.status.toString());
      return { bytes: null, error: `SERP API ${res.status}: ${detail.slice(0, 120)}` };
    }
    const data = await res.json();
    if (data?.error) return { bytes: null, error: `SERP API error: ${data.error}` };

    const results: Array<{ original?: string; thumbnail?: string }> = data?.images_results ?? [];
    for (const img of results.slice(0, 20)) {
      for (const candidate of [img.original, img.thumbnail]) {
        if (!candidate || !isSerpUrlUsable(candidate)) continue;
        if (!(await probeImageUrl(candidate))) continue;
        const bytes = await fetchBytes(candidate, 20_000);
        if (bytes) {
          console.log("[SERP] Downloaded image from:", candidate.slice(0, 80));
          return { bytes };
        }
      }
    }
    return { bytes: null, error: `SERP returned ${results.length} results but none could be downloaded` };
  } catch (e) {
    return { bytes: null, error: `SERP fetch error: ${e instanceof Error ? e.message : String(e)}` };
  }
}

// ── 3. Hugging Face image generation ─────────────────────────────────────────
interface HFProvider { label: string; baseUrl: string; model: string }

const HF_PROVIDERS: HFProvider[] = [
  { label: "wavespeed", baseUrl: "https://router.huggingface.co/wavespeed", model: "black-forest-labs/FLUX.1-dev" },
  { label: "fal-ai",    baseUrl: "https://router.huggingface.co/fal-ai",    model: "black-forest-labs/FLUX.1-dev" },
  { label: "together",  baseUrl: "https://router.huggingface.co/together",  model: "black-forest-labs/FLUX.1-schnell-Free" },
];

async function generateHFImage(prompt: string): Promise<{ bytes: Uint8Array | null; error?: string }> {
  const key = Deno.env.get("HUGGINGFACE_API_KEY");
  if (!key) return { bytes: null, error: "HUGGINGFACE_API_KEY not set in Supabase secrets" };

  const errors: string[] = [];

  for (const provider of HF_PROVIDERS) {
    const url = `${provider.baseUrl}/v1/images/generations`;
    try {
      const res = await fetch(url, {
        method: "POST",
        headers: {
          Authorization:  `Bearer ${key}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ model: provider.model, prompt, n: 1, width: 1024, height: 576 }),
        signal: AbortSignal.timeout(60_000),
      });
      if (!res.ok) {
        const detail = await res.text().catch(() => "");
        errors.push(`${provider.label}: HTTP ${res.status} — ${detail.slice(0, 120)}`);
        continue;
      }

      const ct = res.headers.get("content-type") ?? "";

      if (ct.startsWith("image/")) {
        const buf = await res.arrayBuffer();
        if (buf.byteLength >= 2000) return { bytes: new Uint8Array(buf) };
        errors.push(`${provider.label}: binary too small (${buf.byteLength}B)`);
        continue;
      }

      if (ct.includes("application/json")) {
        const jsonData = await res.json();
        const b64 = jsonData?.data?.[0]?.b64_json ?? jsonData?.image ?? null;
        if (b64 && typeof b64 === "string") {
          const binary = atob(b64);
          const bytes = new Uint8Array(binary.length);
          for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);
          if (bytes.byteLength >= 2000) return { bytes };
        }
        const imgUrl = jsonData?.data?.[0]?.url ?? jsonData?.images?.[0] ?? null;
        if (imgUrl) {
          const bytes = await fetchBytes(imgUrl);
          if (bytes) return { bytes };
          errors.push(`${provider.label}: image URL fetch failed`);
          continue;
        }
        errors.push(`${provider.label}: JSON had no image — ${JSON.stringify(jsonData).slice(0, 80)}`);
      }
    } catch (e) {
      errors.push(`${provider.label}: ${e instanceof Error ? e.message : String(e)}`);
    }
  }
  return { bytes: null, error: errors.join(" | ") };
}

// ── Upload to Supabase Storage (blog-images bucket) ───────────────────────────
const BLOG_BUCKET = "blog-images";

async function uploadToStorage(
  adminClient: ReturnType<typeof createClient>,
  bytes: Uint8Array,
  slug: string,
): Promise<string | null> {
  try {
    const path = `ai-covers/${slug}-${Date.now()}.png`;
    const { error } = await (adminClient as any).storage
      .from(BLOG_BUCKET)
      .upload(path, bytes, { contentType: "image/png", upsert: false });
    if (error) {
      console.error("[Storage] Upload error:", error.message);
      return null;
    }
    const { data } = await (adminClient as any).storage
      .from(BLOG_BUCKET)
      .createSignedUrl(path, 60 * 60 * 24 * 365 * 10); // 10-year signed URL
    return data?.signedUrl ?? null;
  } catch {
    return null;
  }
}

// ── Cover image waterfall: Pollinations → SERP → HF ─────────────────────────
interface CoverImageResult {
  url: string | null;
  source: "pollinations" | "web_search" | "ai_generated" | "none";
  errors: Record<string, string>;
}

async function generateCoverImage(
  imagePrompt: string,
  serpQuery: string,
  slug: string,
  adminClient: ReturnType<typeof createClient>,
): Promise<CoverImageResult> {
  const errors: Record<string, string> = {};

  // 1. Pollinations
  console.log("[cover-image] Trying Pollinations...");
  const pollinationsResult = await fetchPollinationsImage(imagePrompt);
  if (pollinationsResult.bytes) {
    const uploaded = await uploadToStorage(adminClient, pollinationsResult.bytes, slug);
    if (uploaded) return { url: uploaded, source: "pollinations", errors };
    errors.pollinations_upload = "Upload to storage failed";
  } else {
    errors.pollinations = pollinationsResult.error ?? "Unknown error";
    console.warn("[cover-image] Pollinations failed:", errors.pollinations);
  }

  // 2. SERP
  console.log("[cover-image] Trying SERP...");
  const serpResult = await fetchSerpImageBytes(serpQuery);
  if (serpResult.bytes) {
    const uploaded = await uploadToStorage(adminClient, serpResult.bytes, `serp-${slug}`);
    if (uploaded) return { url: uploaded, source: "web_search", errors };
    errors.serp_upload = "Upload to storage failed";
  } else {
    errors.serp = serpResult.error ?? "Unknown error";
    console.warn("[cover-image] SERP failed:", errors.serp);
  }

  // 3. Hugging Face
  console.log("[cover-image] Trying Hugging Face...");
  const hfResult = await generateHFImage(imagePrompt);
  if (hfResult.bytes) {
    const uploaded = await uploadToStorage(adminClient, hfResult.bytes, `hf-${slug}`);
    if (uploaded) return { url: uploaded, source: "ai_generated", errors };
    errors.hf_upload = "Upload to storage failed";
  } else {
    errors.hf = hfResult.error ?? "Unknown error";
    console.warn("[cover-image] Hugging Face failed:", errors.hf);
  }

  return { url: null, source: "none", errors };
}

// ── Slug helper ───────────────────────────────────────────────────────────────
function slugify(text: string): string {
  return text.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "").slice(0, 120);
}

// ── Blog content generation ───────────────────────────────────────────────────
interface BlogGenResult {
  title: string;
  excerpt: string;
  content: string;
  category: string;
  tags: string[];
  seoTitle: string;
  metaDescription: string;
}

async function generateBlogContent(params: {
  opportunityTitle: string;
  topic: string | null;
  type: string | null;
  reason: string | null;
  industry: string | null;
  brandVoice: string | null;
  contentPillars: string[];
  targetAudience: string | null;
  websiteUrl: string | null;
}): Promise<BlogGenResult> {
  const {
    opportunityTitle, topic, type, reason, industry, brandVoice,
    contentPillars, targetAudience, websiteUrl,
  } = params;

  const context = [
    `Opportunity: "${opportunityTitle}"`,
    topic           ? `Topic area: ${topic}`                             : null,
    type            ? `Content type: ${type}`                            : null,
    reason          ? `Why this opportunity: ${reason}`                  : null,
    industry        ? `Industry: ${industry}`                            : null,
    brandVoice      ? `Brand voice: ${brandVoice}`                       : null,
    targetAudience  ? `Target audience: ${targetAudience}`               : null,
    contentPillars.length ? `Content pillars: ${contentPillars.join(", ")}` : null,
    websiteUrl      ? `Website: ${websiteUrl}`                           : null,
  ].filter(Boolean).join("\n");

  const system = `You are an expert SEO content writer for a modern CMS. 

Write a comprehensive, professional blog post in clean HTML. The post must include:
1. A compelling <h1> title (already derived, just write the body)
2. An engaging introduction (2-3 paragraphs in <p> tags)
3. At least 4-6 main sections with <h2> headings
4. Subsections with <h3> headings where appropriate
5. Bullet or numbered lists (<ul>/<ol>/<li>) for tips, features, or steps
6. A blockquote (<blockquote>) with a key insight or statistic
7. A conclusion section with a clear call to action
8. Total length: 800-1200 words of body text

Format rules:
- Use ONLY: <h2>, <h3>, <p>, <ul>, <ol>, <li>, <blockquote>, <strong>, <em>
- Do NOT include <html>, <head>, <body>, or <h1> (title is separate)
- Do NOT use markdown or code fences
- Do NOT include any image tags

Also return metadata. Respond with ONLY a valid JSON object (no fences) with these exact keys:
{
  "title": "SEO-optimized post title (max 60 chars)",
  "excerpt": "1-2 sentence summary for previews (max 160 chars)",
  "content": "<h2>First Section</h2><p>...</p>...",
  "category": "one of: Technology, Business, Marketing, Lifestyle, Health, Finance, Education, Travel, Food, Entertainment, General",
  "tags": ["tag1", "tag2", "tag3", "tag4", "tag5"],
  "seoTitle": "SEO title (max 60 chars)",
  "metaDescription": "Meta description (max 160 chars)"
}`;

  const raw = await callAI([
    { role: "system", content: system },
    { role: "user", content: `Write a complete blog post for this content opportunity:\n${context}` },
  ]);

  try {
    return JSON.parse(raw) as BlogGenResult;
  } catch {
    const match = raw.match(/\{[\s\S]*\}/);
    if (match) return JSON.parse(match[0]) as BlogGenResult;
    throw new Error("AI returned invalid JSON for blog content");
  }
}

// ── Main handler ──────────────────────────────────────────────────────────────
Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") return json(null, 200);

  const supabaseUrl        = Deno.env.get("SUPABASE_URL")!;
  const supabaseAnonKey    = Deno.env.get("SUPABASE_ANON_KEY")!;
  const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

  // ── Auth ──────────────────────────────────────────────────────────────────
  const authHeader = req.headers.get("authorization") ?? "";
  if (!authHeader.startsWith("Bearer ")) return json({ error: "Unauthorized" }, 401);

  const isServiceRole = isTrustedCaller(authHeader);
  let actorEmail = "server";

  // ── Parse body ────────────────────────────────────────────────────────────
  let body: {
    workspace_id: string;
    batch?: boolean;
    count?: number;
    opportunity?: { title?: string; topic?: string | null; type?: string | null; reason?: string | null; priority?: string };
    opportunity_title?: string;
    opportunity_topic?: string | null;
    opportunity_type?: string | null;
    opportunity_reason?: string | null;
  };
  try { body = await req.json(); }
  catch { return json({ error: "Invalid JSON body" }, 400); }

  const workspaceId = body.workspace_id;
  if (!workspaceId) return json({ error: "workspace_id is required" }, 400);

  const adminClient = createClient(supabaseUrl, supabaseServiceKey);

  // ── Auth + workspace authorization ────────────────────────────────────────
  if (!isServiceRole) {
    const callerClient = createClient(supabaseUrl, supabaseAnonKey, {
      global: { headers: { Authorization: authHeader } },
    });
    const { data: { user } } = await callerClient.auth.getUser();
    if (!user) return json({ error: "Unauthorized" }, 401);
    actorEmail = user.email ?? "unknown";

    const { data: ws_check } = await (adminClient as any)
      .from("workspaces")
      .select("id")
      .eq("id", workspaceId)
      .eq("user_id", user.id)
      .maybeSingle();

    if (!ws_check) return json({ error: "Forbidden: you do not own this workspace" }, 403);
  }

  // ── Batch mode: draft up to `count` posts from unused opportunities ───────
  // Leaves the remaining opportunities untouched so they still surface as
  // "suggestions" in the dashboard (at least 10 by design — see analyze-website).
  if (body.batch) {
    const count = Math.min(Math.max(body.count ?? 10, 1), 20);

    const { data: ws } = await (adminClient as any)
      .from("workspaces")
      .select("industry, brand_voice, content_pillars, target_audience, website_url, description")
      .eq("id", workspaceId)
      .maybeSingle();

    const industry       = ws?.industry        ?? null;
    const brandVoice     = ws?.brand_voice     ?? null;
    const contentPillars = ws?.content_pillars ?? [];
    const targetAudience = ws?.target_audience ?? null;
    const websiteUrl     = ws?.website_url     ?? null;

    const { data: opportunities } = await (adminClient as any)
      .from("workspace_content_opportunities")
      .select("id, title, type, topic, reason, priority")
      .eq("workspace_id", workspaceId)
      .eq("status", "suggested")
      .in("type", ["blog", "guide", "comparison", "case-study"])
      .order("priority", { ascending: true })
      .limit(count);

    const results: Array<{ opportunity_id: string; post_id?: string; slug?: string; title?: string; error?: string }> = [];

    for (const o of (opportunities ?? [])) {
      try {
        const blogContent = await generateBlogContent({
          opportunityTitle: o.title, topic: o.topic, type: o.type,
          reason: o.reason, industry, brandVoice,
          contentPillars, targetAudience, websiteUrl,
        });

        const imagePrompt = await generateImagePrompt({
          title: blogContent.title, topic: o.topic, excerpt: blogContent.excerpt,
          industry, brandVoice,
        });

        const baseSlug  = slugify(blogContent.title);
        const serpQuery = `${blogContent.title} ${o.topic ?? industry ?? ""} professional photography`;
        const coverResult = await generateCoverImage(imagePrompt, serpQuery, baseSlug, adminClient);

        let slug = baseSlug || `post-${Date.now()}`;
        let attempt = 1;
        while (true) {
          const { data: clash } = await (adminClient as any)
            .from("blog_posts").select("id").eq("slug", slug).limit(1);
          if (!clash || clash.length === 0) break;
          slug = `${baseSlug}-${attempt++}`;
        }

        const { data: post, error: insertError } = await (adminClient as any)
          .from("blog_posts")
          .insert({
            workspace_id:     workspaceId,
            title:            blogContent.title,
            slug,
            excerpt:          blogContent.excerpt,
            content:          blogContent.content,
            cover_image:      coverResult.url,
            category:         blogContent.category,
            tags:             blogContent.tags,
            author_name:      "AI Assistant",
            seo_title:        blogContent.seoTitle,
            meta_description: blogContent.metaDescription,
            featured:         false,
            status:           "draft",
            reading_time:     Math.ceil(blogContent.content.replace(/<[^>]+>/g, "").split(/\s+/).length / 200),
          })
          .select("id, slug")
          .single();

        if (insertError) throw new Error(insertError.message);

        await (adminClient as any)
          .from("workspace_content_opportunities")
          .update({ status: "generated", content_id: post.id })
          .eq("id", o.id);

        results.push({ opportunity_id: o.id, post_id: post.id, slug: post.slug, title: blogContent.title });
      } catch (e) {
        results.push({ opportunity_id: o.id, error: e instanceof Error ? e.message : String(e) });
      }
    }

    const { count: remainingSuggestions } = await (adminClient as any)
      .from("workspace_content_opportunities")
      .select("id", { count: "exact", head: true })
      .eq("workspace_id", workspaceId)
      .eq("status", "suggested");

    return json({
      generated: results.filter((r) => r.post_id).length,
      failed:    results.filter((r) => r.error).length,
      results,
      remaining_suggestions: remainingSuggestions ?? 0,
    });
  }

  const opp = body.opportunity ?? {};
  const opportunityTitle  = opp.title  ?? body.opportunity_title  ?? "Untitled Opportunity";
  const opportunityTopic  = opp.topic  ?? body.opportunity_topic  ?? null;
  const opportunityType   = opp.type   ?? body.opportunity_type   ?? null;
  const opportunityReason = opp.reason ?? body.opportunity_reason ?? null;

  // ── Load workspace context ────────────────────────────────────────────────
  const { data: ws } = await (adminClient as any)
    .from("workspaces")
    .select("industry, brand_voice, content_pillars, target_audience, website_url, description")
    .eq("id", workspaceId)
    .maybeSingle();

  const industry       = ws?.industry        ?? null;
  const brandVoice     = ws?.brand_voice     ?? null;
  const contentPillars = ws?.content_pillars ?? [];
  const targetAudience = ws?.target_audience ?? null;
  const websiteUrl     = ws?.website_url     ?? null;

  // ── Log generation start ──────────────────────────────────────────────────
  const { data: gen } = await (adminClient as any)
    .from("ai_generations")
    .insert({
      workspace_id:  workspaceId,
      task:          "generate_article",
      model:         LOVABLE_MODEL,
      prompt:        `Generate blog post for: "${opportunityTitle}"`,
      system_prompt: "generate-blog-post edge function",
      parameters:    { opportunityTitle, opportunityTopic, opportunityType },
      actor_name:    actorEmail,
      status:        "running",
    })
    .select("id")
    .single();
  const genId: string | null = gen?.id ?? null;
  const startMs = Date.now();

  try {
    // ── 1. Generate blog content (AI) ─────────────────────────────────────
    const blogContent = await generateBlogContent({
      opportunityTitle, topic: opportunityTopic, type: opportunityType,
      reason: opportunityReason, industry, brandVoice,
      contentPillars, targetAudience, websiteUrl,
    });

    // ── 2. Generate image prompt ──────────────────────────────────────────
    const imagePrompt = await generateImagePrompt({
      title:      blogContent.title,
      topic:      opportunityTopic,
      excerpt:    blogContent.excerpt,
      industry,
      brandVoice,
    });

    // ── 3. Cover image waterfall: Pollinations → SERP → HF ───────────────
    const baseSlug   = slugify(blogContent.title);
    const serpQuery  = `${blogContent.title} ${opportunityTopic ?? industry ?? ""} professional photography`;
    const coverResult = await generateCoverImage(imagePrompt, serpQuery, baseSlug, adminClient);
    const coverImage  = coverResult.url;

    // ── 4. Ensure unique slug ─────────────────────────────────────────────
    let slug = baseSlug || `post-${Date.now()}`;
    let attempt = 1;
    while (true) {
      const { data: clash } = await (adminClient as any)
        .from("blog_posts").select("id").eq("slug", slug).limit(1);
      if (!clash || clash.length === 0) break;
      slug = `${baseSlug}-${attempt++}`;
    }

    // ── 5. Insert blog post (cover_image already set) ─────────────────────
    const { data: post, error: insertError } = await (adminClient as any)
      .from("blog_posts")
      .insert({
        workspace_id:     workspaceId,
        title:            blogContent.title,
        slug,
        excerpt:          blogContent.excerpt,
        content:          blogContent.content,
        cover_image:      coverImage,
        category:         blogContent.category,
        tags:             blogContent.tags,
        author_name:      "AI Assistant",
        seo_title:        blogContent.seoTitle,
        meta_description: blogContent.metaDescription,
        featured:         false,
        status:           "draft",
        reading_time:     Math.ceil(blogContent.content.replace(/<[^>]+>/g, "").split(/\s+/).length / 200),
      })
      .select("id, slug")
      .single();

    if (insertError) throw new Error(insertError.message);

    // ── 6. Update generation record ───────────────────────────────────────
    if (genId) {
      await (adminClient as any).from("ai_generations").update({
        status:       "completed",
        post_id:      post.id,
        result:       `Generated blog post: "${blogContent.title}"`,
        model:        LOVABLE_MODEL,
        duration_ms:  Date.now() - startMs,
        completed_at: new Date().toISOString(),
        parameters:   {
          opportunityTitle, opportunityTopic, opportunityType,
          cover_source:  coverResult.source,
          cover_errors:  Object.keys(coverResult.errors).length ? coverResult.errors : null,
        },
      }).eq("id", genId);
    }

    return json({
      post_id:        post.id,
      post_slug:      post.slug,
      title:          blogContent.title,
      cover_image:    coverImage,
      image_prompt:   imagePrompt,
      cover_source:   coverResult.source,
      ...(Object.keys(coverResult.errors).length ? { cover_errors: coverResult.errors } : {}),
    });

  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : String(err);
    if (genId) {
      await (adminClient as any).from("ai_generations").update({
        status:      "failed",
        error:       msg,
        duration_ms: Date.now() - startMs,
      }).eq("id", genId);
    }
    return json({ error: msg }, 500);
  }
});
