// Edge Function: generate-blog-post
// Generates a full blog post from a content opportunity using AI,
// fetches a real image via SERP API, and generates an AI image via Hugging Face.
// Stores the result in blog_posts and returns the new post id.

import { createClient } from "jsr:@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

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

// ── Image prompt generation engine ────────────────────────────────────────────
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
    topic ? `Topic: ${topic}` : null,
    excerpt ? `Summary: ${excerpt}` : null,
    industry ? `Industry: ${industry}` : null,
    brandVoice ? `Brand voice: ${brandVoice}` : null,
  ].filter(Boolean).join("\n");

  const system = `You are a creative director specializing in blog cover imagery. 
Generate a single detailed, vivid image prompt for a photorealistic cover image that perfectly matches the blog post's theme.
The prompt should be rich with visual details: lighting, mood, setting, style, colors.
Describe a scene or concept — not text on an image. Avoid abstract art unless the topic is clearly creative.
Return ONLY the image prompt as a single descriptive paragraph, no commentary.`;

  const user = `Create an image prompt for a blog post with these details:\n${context}`;
  return callAI([{ role: "system", content: system }, { role: "user", content: user }]);
}

// ── SERP API image search ─────────────────────────────────────────────────────
async function fetchWebImage(query: string): Promise<string | null> {
  const serpKey = Deno.env.get("SERP_API_KEY");
  if (!serpKey) return null;

  try {
    const params = new URLSearchParams({
      api_key: serpKey,
      engine:  "google_images",
      q:       query,
      num:     "10",
      safe:    "active",
    });
    const res = await fetch(`https://serpapi.com/search.json?${params}`);
    if (!res.ok) return null;
    const data = await res.json();
    if (data?.error) return null;
    const results: Array<{ original?: string; thumbnail?: string }> = data?.images_results ?? [];
    for (const img of results.slice(0, 10)) {
      const url = img.original ?? img.thumbnail ?? "";
      if (url.startsWith("http") && !url.startsWith("data:")) return url;
    }
    return null;
  } catch {
    return null;
  }
}

// ── Hugging Face image generation via HF Router ───────────────────────────────
// Uses router.huggingface.co — the only HF hostname reachable from Supabase edge.
// api-inference.huggingface.co is DNS-blocked in the Supabase edge runtime.
// Secret name: HUGGINGFACE_API_KEY

interface HFProvider { label: string; baseUrl: string; model: string }

const HF_PROVIDERS: HFProvider[] = [
  { label: "wavespeed", baseUrl: "https://router.huggingface.co/wavespeed", model: "black-forest-labs/FLUX.1-dev" },
  { label: "fal-ai",    baseUrl: "https://router.huggingface.co/fal-ai",    model: "black-forest-labs/FLUX.1-dev" },
  { label: "together",  baseUrl: "https://router.huggingface.co/together",  model: "black-forest-labs/FLUX.1-schnell-Free" },
];

async function fetchImageBytes(url: string): Promise<Uint8Array | null> {
  try {
    const r = await fetch(url, { signal: AbortSignal.timeout(30_000) });
    if (!r.ok) return null;
    const buf = await r.arrayBuffer();
    return buf.byteLength >= 2000 ? new Uint8Array(buf) : null;
  } catch { return null; }
}

async function generateHFImage(prompt: string): Promise<Uint8Array | null> {
  const key = Deno.env.get("HUGGINGFACE_API_KEY");
  if (!key) return null;

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
      if (!res.ok) continue;

      const ct = res.headers.get("content-type") ?? "";

      // Binary image
      if (ct.startsWith("image/")) {
        const buf = await res.arrayBuffer();
        if (buf.byteLength >= 2000) return new Uint8Array(buf);
        continue;
      }

      // JSON (OpenAI images API format)
      if (ct.includes("application/json")) {
        const data = await res.json();
        const b64 = data?.data?.[0]?.b64_json ?? data?.image ?? null;
        if (b64 && typeof b64 === "string") {
          const binary = atob(b64);
          const bytes = new Uint8Array(binary.length);
          for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);
          if (bytes.byteLength >= 2000) return bytes;
        }
        const imgUrl = data?.data?.[0]?.url ?? data?.images?.[0] ?? null;
        if (imgUrl) {
          const bytes = await fetchImageBytes(imgUrl);
          if (bytes) return bytes;
        }
      }
    } catch { continue; }
  }
  return null;
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
    topic ? `Topic area: ${topic}` : null,
    type ? `Content type: ${type}` : null,
    reason ? `Why this opportunity: ${reason}` : null,
    industry ? `Industry: ${industry}` : null,
    brandVoice ? `Brand voice: ${brandVoice}` : null,
    targetAudience ? `Target audience: ${targetAudience}` : null,
    contentPillars.length ? `Content pillars: ${contentPillars.join(", ")}` : null,
    websiteUrl ? `Website: ${websiteUrl}` : null,
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
    // Attempt to extract JSON if there's surrounding text
    const match = raw.match(/\{[\s\S]*\}/);
    if (match) return JSON.parse(match[0]) as BlogGenResult;
    throw new Error("AI returned invalid JSON for blog content");
  }
}

// ── Upload raw image bytes to Supabase Storage (blog-images bucket) ──────────
const BLOG_BUCKET = "blog-images";

async function uploadGeneratedImage(
  adminClient: ReturnType<typeof createClient>,
  bytes: Uint8Array,
  slug: string,
): Promise<string | null> {
  try {
    const path = `ai-covers/${slug}-${Date.now()}.png`;
    const { error } = await (adminClient as any).storage
      .from(BLOG_BUCKET)
      .upload(path, bytes, { contentType: "image/png", upsert: false });
    if (error) return null;
    // bucket is private → return a long-lived signed URL
    const { data } = await (adminClient as any).storage
      .from(BLOG_BUCKET)
      .createSignedUrl(path, 60 * 60 * 24 * 365 * 10);
    return data?.signedUrl ?? null;
  } catch {
    return null;
  }
}

// ── Main handler ─────────────────────────────────────────────────────────────
Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") return json(null, 200);

  const supabaseUrl        = Deno.env.get("SUPABASE_URL")!;
  const supabaseAnonKey    = Deno.env.get("SUPABASE_ANON_KEY")!;
  const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

  // ── Auth ──────────────────────────────────────────────────────────────────
  const authHeader = req.headers.get("authorization") ?? "";
  if (!authHeader.startsWith("Bearer ")) return json({ error: "Unauthorized" }, 401);

  const isServiceRole = authHeader === `Bearer ${supabaseServiceKey}`;
  let actorEmail = "server";

  // ── Parse body ────────────────────────────────────────────────────────────
  let body: {
    workspace_id: string;
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

  // ── Auth + workspace authorization (single pass) ──────────────────────────
  // Service-role callers are trusted (server-to-server calls).
  // Authenticated users must own the target workspace (workspaces.user_id).
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

  const industry       = ws?.industry       ?? null;
  const brandVoice     = ws?.brand_voice    ?? null;
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

    // ── 3. Fetch web image (SERP) + generate AI image (HF) in parallel ───
    const searchQuery = `${blogContent.title} ${opportunityTopic ?? industry ?? ""} professional photography`;
    const [serpImage, hfImageData] = await Promise.all([
      fetchWebImage(searchQuery),
      generateHFImage(imagePrompt),
    ]);

    // Try to upload HF image to storage; fall back to SERP; fall back to null
    let coverImage: string | null = null;
    const baseSlug = slugify(blogContent.title);

    if (hfImageData) {
      const uploaded = await uploadGeneratedImage(adminClient, hfImageData, baseSlug);
      coverImage = uploaded ?? serpImage;
    } else {
      coverImage = serpImage;
    }

    // ── 4. Ensure unique slug ─────────────────────────────────────────────
    let slug = baseSlug || `post-${Date.now()}`;
    let attempt = 1;
    while (true) {
      const { data: clash } = await (adminClient as any)
        .from("blog_posts").select("id").eq("slug", slug).limit(1);
      if (!clash || clash.length === 0) break;
      slug = `${baseSlug}-${attempt++}`;
    }

    // ── 5. Insert blog post ───────────────────────────────────────────────
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
      }).eq("id", genId);
    }

    return json({
      post_id:      post.id,
      post_slug:    post.slug,
      title:        blogContent.title,
      cover_image:  coverImage,
      image_prompt: imagePrompt,
      serp_image:   serpImage,
      hf_image_uploaded: hfImageData !== null,
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

function json(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}
