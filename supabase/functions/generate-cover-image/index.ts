// Edge Function: generate-cover-image
// Generates a cover image for a blog post by:
//   1. Building an AI image prompt from the post details
//   2. Fetching a real web image via SERP API (quick fallback)
//   3. Generating an AI image via Hugging Face FLUX
//   4. Uploading the best result to Supabase Storage (blog-images bucket)
//   5. Returning a long-lived signed URL

import { createClient } from "jsr:@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

// ── Helpers ───────────────────────────────────────────────────────────────────
function json(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}

// Safely convert a Uint8Array to base64 without hitting call-stack limits
function uint8ToBase64(bytes: Uint8Array): string {
  let binary = "";
  const CHUNK = 8192;
  for (let i = 0; i < bytes.length; i += CHUNK) {
    binary += String.fromCharCode(...bytes.subarray(i, i + CHUNK));
  }
  return btoa(binary);
}

// ── AI helpers (Lovable → Mistral fallback) ───────────────────────────────────
const LOVABLE_GATEWAY = "https://ai.gateway.lovable.dev/v1/chat/completions";
const LOVABLE_MODEL   = "google/gemini-3-flash-preview";
const MISTRAL_GATEWAY = "https://api.mistral.ai/v1/chat/completions";
const MISTRAL_MODEL   = "mistral-large-latest";

function stripFences(raw: string): string {
  return raw.replace(/^```[\w]*\s*/i, "").replace(/\s*```$/i, "").trim();
}

async function callAI(system: string, user: string): Promise<string> {
  const lovableKey = Deno.env.get("LOVABLE_API_KEY");
  const mistralKey = Deno.env.get("MISTRAL_API_KEY");
  const messages = [{ role: "system", content: system }, { role: "user", content: user }];

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
  if (!res.ok) throw new Error(`Mistral error ${res.status}`);
  const data = await res.json();
  return stripFences(data?.choices?.[0]?.message?.content ?? "");
}

// ── Image prompt engine ───────────────────────────────────────────────────────
async function buildImagePrompt(params: {
  title: string;
  excerpt?: string | null;
  topic?: string | null;
  category?: string | null;
}): Promise<string> {
  const { title, excerpt, topic, category } = params;
  const ctx = [
    `Blog post title: "${title}"`,
    topic    ? `Topic: ${topic}`       : null,
    excerpt  ? `Summary: ${excerpt}`   : null,
    category ? `Category: ${category}` : null,
  ].filter(Boolean).join("\n");

  const system =
    `You are a creative director specialising in blog cover imagery. ` +
    `Generate a single detailed, vivid image prompt for a photorealistic hero/cover image. ` +
    `Include: lighting style, mood, setting, dominant colours, and any relevant objects or people. ` +
    `Do NOT include text, logos, or watermarks in the scene. ` +
    `Return ONLY the image prompt — one descriptive paragraph, no titles, no bullet points.`;

  return callAI(system, `Create an image prompt for:\n${ctx}`);
}

// ── Domains that block hotlinking or serve watermarked/unusable images ────────
// Matched against the parsed hostname using exact equality or suffix (.domain.com).
const SERP_BLOCKED_DOMAINS = [
  "instagram.com", "cdninstagram.com", "lookaside.instagram.com",
  "facebook.com", "fbcdn.net", "fbsbx.com",
  // scontent-*.fbcdn.net pattern covered by fbcdn.net suffix match above
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
    return false; // unparseable URL → skip
  }
}

// Probe a URL to confirm it actually serves a 2xx image (no redirects to HTML, no hotlink blocks)
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

// ── SERP API image search ─────────────────────────────────────────────────────
async function fetchSerpImage(query: string): Promise<{ url: string | null; error?: string }> {
  const key = Deno.env.get("SERP_API_KEY");
  if (!key) return { url: null, error: "SERP_API_KEY not set" };
  try {
    const params = new URLSearchParams({
      api_key: key,
      engine:  "google_images",
      q:       query,
      num:     "20",
      safe:    "active",
    });
    const res = await fetch(`https://serpapi.com/search.json?${params}`);
    if (!res.ok) {
      const detail = await res.text().catch(() => res.status.toString());
      return { url: null, error: `SERP API ${res.status}: ${detail.slice(0, 120)}` };
    }
    const data = await res.json();
    if (data?.error) return { url: null, error: `SERP API error: ${data.error}` };

    const results: Array<{ original?: string; thumbnail?: string }> = data?.images_results ?? [];
    for (const img of results.slice(0, 20)) {
      // Try original first, fall back to thumbnail (Google-cached, more reliable)
      for (const candidate of [img.original, img.thumbnail]) {
        if (!candidate || !isSerpUrlUsable(candidate)) continue;
        if (await probeImageUrl(candidate)) return { url: candidate };
      }
    }
    return { url: null, error: `SERP returned ${results.length} results but none passed image probe` };
  } catch (e) {
    return { url: null, error: `SERP fetch error: ${e instanceof Error ? e.message : String(e)}` };
  }
}

// ── Hugging Face image generation via HF Router ───────────────────────────────
// Uses the HF inference router (router.huggingface.co) — accessible from Supabase.
// NOTE: api-inference.huggingface.co is DNS-blocked in the Supabase edge runtime.
// API key name in Supabase secrets: HUGGINGFACE_API_KEY
//
// Providers tried in order (all use OpenAI-compat /v1/images/generations):
//   1. wavespeed  — fast FLUX.1-dev
//   2. fal-ai     — FLUX.1-dev fallback
//   3. together   — additional fallback

interface HFProvider { label: string; baseUrl: string; model: string }

const HF_PROVIDERS: HFProvider[] = [
  { label: "wavespeed", baseUrl: "https://router.huggingface.co/wavespeed", model: "black-forest-labs/FLUX.1-dev" },
  { label: "fal-ai",    baseUrl: "https://router.huggingface.co/fal-ai",    model: "black-forest-labs/FLUX.1-dev" },
  { label: "together",  baseUrl: "https://router.huggingface.co/together",  model: "black-forest-labs/FLUX.1-schnell-Free" },
];

// Fetch image bytes from a URL (handles provider responses that return a URL)
async function fetchBytes(url: string): Promise<Uint8Array | null> {
  try {
    const r = await fetch(url, { signal: AbortSignal.timeout(30_000) });
    if (!r.ok) return null;
    const buf = await r.arrayBuffer();
    return buf.byteLength >= 2000 ? new Uint8Array(buf) : null;
  } catch { return null; }
}

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
        body: JSON.stringify({
          model:  provider.model,
          prompt,
          n:      1,
          // Size hint — providers ignore what they don't support
          width:  1024,
          height: 576,
        }),
        signal: AbortSignal.timeout(60_000),
      });

      if (!res.ok) {
        const detail = await res.text().catch(() => "");
        errors.push(`${provider.label}: HTTP ${res.status} — ${detail.slice(0, 120)}`);
        continue;
      }

      const ct = res.headers.get("content-type") ?? "";

      // ── Binary image response ──────────────────────────────────────────────
      if (ct.startsWith("image/")) {
        const buf = await res.arrayBuffer();
        if (buf.byteLength >= 2000) return { bytes: new Uint8Array(buf) };
        errors.push(`${provider.label}: binary image too small (${buf.byteLength}B)`);
        continue;
      }

      // ── JSON response (OpenAI images API format) ───────────────────────────
      if (ct.includes("application/json")) {
        const json = await res.json();

        // b64_json embedded directly
        const b64 = json?.data?.[0]?.b64_json ?? json?.image ?? null;
        if (b64 && typeof b64 === "string") {
          const binary = atob(b64);
          const bytes = new Uint8Array(binary.length);
          for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);
          if (bytes.byteLength >= 2000) return { bytes };
        }

        // URL pointing to generated image
        const imgUrl = json?.data?.[0]?.url ?? json?.images?.[0] ?? null;
        if (imgUrl && typeof imgUrl === "string") {
          const bytes = await fetchBytes(imgUrl);
          if (bytes) return { bytes };
          errors.push(`${provider.label}: image URL fetch failed (${imgUrl.slice(0, 60)})`);
          continue;
        }

        errors.push(`${provider.label}: JSON had no image — ${JSON.stringify(json).slice(0, 120)}`);
        continue;
      }

      errors.push(`${provider.label}: unexpected content-type "${ct}"`);
    } catch (e) {
      errors.push(`${provider.label}: ${e instanceof Error ? e.message : String(e)}`);
    }
  }

  return { bytes: null, error: errors.join(" | ") };
}

// ── Upload to Supabase Storage (blog-images bucket) ───────────────────────────
const BUCKET = "blog-images";

async function uploadToStorage(
  adminClient: ReturnType<typeof createClient>,
  bytes: Uint8Array,
  slug: string,
  contentType = "image/png",
): Promise<string | null> {
  const ext  = contentType.includes("jpeg") ? "jpg" : "png";
  const path = `ai-covers/${slug}-${Date.now()}.${ext}`;

  const { error } = await (adminClient as any).storage
    .from(BUCKET)
    .upload(path, bytes, { contentType, upsert: false });

  if (error) return null;

  const { data } = await (adminClient as any).storage
    .from(BUCKET)
    .createSignedUrl(path, 60 * 60 * 24 * 365 * 10); // 10-year signed URL

  return data?.signedUrl ?? null;
}

// ── Main handler ─────────────────────────────────────────────────────────────
Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  const supabaseUrl        = Deno.env.get("SUPABASE_URL")!;
  const supabaseAnonKey    = Deno.env.get("SUPABASE_ANON_KEY")!;
  const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

  // ── Auth ──────────────────────────────────────────────────────────────────
  const authHeader = req.headers.get("authorization") ?? "";
  if (!authHeader.startsWith("Bearer ")) return json({ error: "Unauthorized" }, 401);

  const isServiceRole = authHeader === `Bearer ${supabaseServiceKey}`;
  let callerId: string | null = null;

  if (!isServiceRole) {
    const callerClient = createClient(supabaseUrl, supabaseAnonKey, {
      global: { headers: { Authorization: authHeader } },
    });
    const { data: { user } } = await callerClient.auth.getUser();
    if (!user) return json({ error: "Unauthorized" }, 401);
    callerId = user.id;
  }

  // ── Parse body ────────────────────────────────────────────────────────────
  let body: {
    title: string;
    excerpt?: string | null;
    topic?: string | null;
    category?: string | null;
    image_prompt?: string | null; // optional: skip prompt generation if provided
    post_id?: string | null;      // optional: when provided, writes cover_image back to blog_posts
  };
  try { body = await req.json(); }
  catch { return json({ error: "Invalid JSON body" }, 400); }

  if (!body.title?.trim()) return json({ error: "title is required" }, 400);

  // Validate post_id format if supplied
  const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
  if (body.post_id && !UUID_RE.test(body.post_id)) {
    return json({ error: "post_id must be a valid UUID" }, 400);
  }

  const adminClient = createClient(supabaseUrl, supabaseServiceKey);

  try {
    // ── 1. Build image prompt (unless caller supplies one) ─────────────────
    const imagePrompt = body.image_prompt?.trim()
      || await buildImagePrompt({
        title:    body.title,
        excerpt:  body.excerpt,
        topic:    body.topic,
        category: body.category,
      });

    // ── 2. Fetch web image + generate AI image in parallel ─────────────────
    const serpQuery = `${body.title} ${body.topic ?? body.category ?? ""} professional photo`.trim();
    const [serpResult, hfResult] = await Promise.all([
      fetchSerpImage(serpQuery),
      generateHFImage(imagePrompt),
    ]);

    // ── 3. Pick best image: HF generated > SERP URL ────────────────────────
    let imageUrl: string | null = null;
    let source = "none";

    if (hfResult.bytes) {
      const slug = body.title.toLowerCase().replace(/[^a-z0-9]+/g, "-").slice(0, 40);
      const uploaded = await uploadToStorage(adminClient, hfResult.bytes, slug);
      if (uploaded) { imageUrl = uploaded; source = "ai_generated"; }
    }

    // Fall back to SERP web image
    if (!imageUrl && serpResult.url) {
      imageUrl = serpResult.url;
      source = "web_search";
    }

    // ── 4. Write cover_image back to blog_posts when post_id is supplied ─────
    let coverImagePersisted = false;
    let persistError: string | null = null;

    if (imageUrl && body.post_id) {
      // Only require a valid JWT (already verified above) — this is an admin
      // dashboard where all authenticated users are trusted editors.
      const { error: updateErr } = await (adminClient as any)
        .from("blog_posts")
        .update({ cover_image: imageUrl })
        .eq("id", body.post_id);

      if (updateErr) {
        persistError = updateErr.message;
      } else {
        coverImagePersisted = true;
      }
    }

    // Return diagnostic info even when no image so client can show useful errors
    const diagnostics = {
      serp_error:             serpResult.error ?? null,
      hf_error:               hfResult.error  ?? null,
      cover_image_persisted:  coverImagePersisted,
      ...(persistError ? { persist_error: persistError } : {}),
    };

    return json({
      image_url:    imageUrl,
      image_prompt: imagePrompt,
      source,
      ...diagnostics,
    });

  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : String(err);
    return json({ error: msg }, 500);
  }
});
