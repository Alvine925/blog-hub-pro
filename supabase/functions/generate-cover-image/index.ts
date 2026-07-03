// Edge Function: generate-cover-image
// Generates a cover image for a blog post using a waterfall fallback chain:
//   1. Pollinations AI  — free, no key required, fast
//   2. SERP API         — real web image (downloaded + stored)
//   3. Hugging Face     — FLUX AI generation
// Every successful result is downloaded and uploaded to Supabase Storage (blog-images bucket).
// Returns a long-lived signed URL and writes cover_image to blog_posts when post_id is supplied.

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

// ── 2. SERP API image search ──────────────────────────────────────────────────
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
  const key = Deno.env.get("SERP_API_KEY");
  if (!key) return { bytes: null, error: "SERP_API_KEY not set" };
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
      return { bytes: null, error: `SERP API ${res.status}: ${detail.slice(0, 120)}` };
    }
    const data = await res.json();
    if (data?.error) return { bytes: null, error: `SERP API error: ${data.error}` };

    const results: Array<{ original?: string; thumbnail?: string }> = data?.images_results ?? [];
    for (const img of results.slice(0, 20)) {
      for (const candidate of [img.original, img.thumbnail]) {
        if (!candidate || !isSerpUrlUsable(candidate)) continue;
        if (!(await probeImageUrl(candidate))) continue;
        // Download the image bytes
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
        body: JSON.stringify({
          model:  provider.model,
          prompt,
          n:      1,
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

      if (ct.startsWith("image/")) {
        const buf = await res.arrayBuffer();
        if (buf.byteLength >= 2000) return { bytes: new Uint8Array(buf) };
        errors.push(`${provider.label}: binary image too small (${buf.byteLength}B)`);
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
        if (imgUrl && typeof imgUrl === "string") {
          const bytes = await fetchBytes(imgUrl);
          if (bytes) return { bytes };
          errors.push(`${provider.label}: image URL fetch failed (${imgUrl.slice(0, 60)})`);
          continue;
        }
        errors.push(`${provider.label}: JSON had no image — ${JSON.stringify(jsonData).slice(0, 120)}`);
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

  if (error) {
    console.error("[Storage] Upload error:", error.message);
    return null;
  }

  const { data } = await (adminClient as any).storage
    .from(BUCKET)
    .createSignedUrl(path, 60 * 60 * 24 * 365 * 10); // 10-year signed URL

  return data?.signedUrl ?? null;
}

// ── Main handler ──────────────────────────────────────────────────────────────
Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  const supabaseUrl        = Deno.env.get("SUPABASE_URL")!;
  const supabaseAnonKey    = Deno.env.get("SUPABASE_ANON_KEY")!;
  const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

  // ── Auth ──────────────────────────────────────────────────────────────────
  const authHeader = req.headers.get("authorization") ?? "";
  if (!authHeader.startsWith("Bearer ")) return json({ error: "Unauthorized" }, 401);

  const isServiceRole = isTrustedCaller(authHeader);

  if (!isServiceRole) {
    const callerClient = createClient(supabaseUrl, supabaseAnonKey, {
      global: { headers: { Authorization: authHeader } },
    });
    const { data: { user } } = await callerClient.auth.getUser();
    if (!user) return json({ error: "Unauthorized" }, 401);
  }

  // ── Parse body ────────────────────────────────────────────────────────────
  let body: {
    title: string;
    excerpt?: string | null;
    topic?: string | null;
    category?: string | null;
    image_prompt?: string | null;
    post_id?: string | null;
  };
  try { body = await req.json(); }
  catch { return json({ error: "Invalid JSON body" }, 400); }

  if (!body.title?.trim()) return json({ error: "title is required" }, 400);

  const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
  if (body.post_id && !UUID_RE.test(body.post_id)) {
    return json({ error: "post_id must be a valid UUID" }, 400);
  }

  const adminClient = createClient(supabaseUrl, supabaseServiceKey);

  try {
    // ── 1. Build image prompt ─────────────────────────────────────────────
    const imagePrompt = body.image_prompt?.trim()
      || await buildImagePrompt({
        title:    body.title,
        excerpt:  body.excerpt,
        topic:    body.topic,
        category: body.category,
      });

    const slug = body.title.toLowerCase().replace(/[^a-z0-9]+/g, "-").slice(0, 40);
    const serpQuery = `${body.title} ${body.topic ?? body.category ?? ""} professional photo`.trim();

    let imageUrl: string | null = null;
    let source = "none";
    const errors: Record<string, string> = {};

    // ── 2. Try Pollinations first ─────────────────────────────────────────
    console.log("[generate-cover-image] Trying Pollinations...");
    const pollinationsResult = await fetchPollinationsImage(imagePrompt);

    if (pollinationsResult.bytes) {
      const uploaded = await uploadToStorage(adminClient, pollinationsResult.bytes, slug);
      if (uploaded) {
        imageUrl = uploaded;
        source = "pollinations";
        console.log("[generate-cover-image] Pollinations succeeded, stored at:", uploaded.slice(0, 80));
      } else {
        errors.pollinations_upload = "Upload to storage failed";
      }
    } else {
      errors.pollinations = pollinationsResult.error ?? "Unknown error";
      console.warn("[generate-cover-image] Pollinations failed:", errors.pollinations);
    }

    // ── 3. Fallback: SERP API ─────────────────────────────────────────────
    if (!imageUrl) {
      console.log("[generate-cover-image] Trying SERP...");
      const serpResult = await fetchSerpImageBytes(serpQuery);

      if (serpResult.bytes) {
        const uploaded = await uploadToStorage(adminClient, serpResult.bytes, `serp-${slug}`);
        if (uploaded) {
          imageUrl = uploaded;
          source = "web_search";
          console.log("[generate-cover-image] SERP succeeded, stored at:", uploaded.slice(0, 80));
        } else {
          errors.serp_upload = "Upload to storage failed";
        }
      } else {
        errors.serp = serpResult.error ?? "Unknown error";
        console.warn("[generate-cover-image] SERP failed:", errors.serp);
      }
    }

    // ── 4. Fallback: Hugging Face ─────────────────────────────────────────
    if (!imageUrl) {
      console.log("[generate-cover-image] Trying Hugging Face...");
      const hfResult = await generateHFImage(imagePrompt);

      if (hfResult.bytes) {
        const uploaded = await uploadToStorage(adminClient, hfResult.bytes, `hf-${slug}`);
        if (uploaded) {
          imageUrl = uploaded;
          source = "ai_generated";
          console.log("[generate-cover-image] Hugging Face succeeded, stored at:", uploaded.slice(0, 80));
        } else {
          errors.hf_upload = "Upload to storage failed";
        }
      } else {
        errors.hf = hfResult.error ?? "Unknown error";
        console.warn("[generate-cover-image] Hugging Face failed:", errors.hf);
      }
    }

    // ── 5. Write cover_image back to blog_posts when post_id is supplied ──
    let coverImagePersisted = false;
    let persistError: string | null = null;

    if (imageUrl && body.post_id) {
      const { error: updateErr } = await (adminClient as any)
        .from("blog_posts")
        .update({ cover_image: imageUrl })
        .eq("id", body.post_id);

      if (updateErr) {
        persistError = updateErr.message;
        console.error("[generate-cover-image] Failed to persist cover_image:", persistError);
      } else {
        coverImagePersisted = true;
        console.log("[generate-cover-image] cover_image persisted to blog_posts:", body.post_id);
      }
    }

    return json({
      image_url:             imageUrl,
      image_prompt:          imagePrompt,
      source,
      cover_image_persisted: coverImagePersisted,
      ...(persistError ? { persist_error: persistError } : {}),
      ...(Object.keys(errors).length ? { errors } : {}),
    });

  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : String(err);
    return json({ error: msg }, 500);
  }
});
