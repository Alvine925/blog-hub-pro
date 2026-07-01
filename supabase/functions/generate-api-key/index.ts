import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

async function sha256hex(str: string): Promise<string> {
  const buf = await crypto.subtle.digest(
    "SHA-256",
    new TextEncoder().encode(str),
  );
  return Array.from(new Uint8Array(buf))
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
}

function generateRawKey(): string {
  const bytes = new Uint8Array(32);
  crypto.getRandomValues(bytes);
  const hex = Array.from(bytes)
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
  return `lc_${hex}`;
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    const body = await req.json().catch(() => ({}));
    const name = typeof body?.name === "string" ? body.name.trim() : "";

    if (!name) {
      return Response.json(
        { error: "name is required" },
        { status: 400, headers: corsHeaders },
      );
    }
    if (name.length > 100) {
      return Response.json(
        { error: "name too long (max 100 chars)" },
        { status: 400, headers: corsHeaders },
      );
    }

    const raw = generateRawKey();
    const hash = await sha256hex(raw);
    const prefix = raw.slice(0, 12);

    const supabaseUrl = Deno.env.get("SUPABASE_URL");
    const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");

    if (!supabaseUrl || !serviceKey) {
      return Response.json(
        { error: "Server configuration error" },
        { status: 500, headers: corsHeaders },
      );
    }

    const supabase = createClient(supabaseUrl, serviceKey);

    const { data, error } = await supabase
      .from("api_keys")
      .insert({ name, key_hash: hash, key_prefix: prefix })
      .select("id")
      .single();

    if (error) {
      return Response.json(
        { error: error.message },
        { status: 500, headers: corsHeaders },
      );
    }

    return Response.json(
      { key: raw, id: data.id },
      { headers: corsHeaders },
    );
  } catch (err) {
    return Response.json(
      { error: String(err) },
      { status: 500, headers: corsHeaders },
    );
  }
});
