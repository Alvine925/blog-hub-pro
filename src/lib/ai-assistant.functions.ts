import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";

const messageSchema = z.object({
  role:    z.enum(["user", "assistant"]),
  content: z.string().min(1).max(10_000),
});

const askSchema = z.object({
  messages: z.array(messageSchema).min(1).max(50),
  context:  z.string().max(2000).optional(),
});

/**
 * Server function that proxies to the ai-assistant Supabase edge function.
 * Forwards the user's session token so the edge function can verify auth.
 */
export const askAssistant = createServerFn({ method: "POST" })
  .validator((d: unknown) => askSchema.parse(d))
  .handler(async ({ data }): Promise<{ reply: string }> => {
    const { getAdminClient } = await import("./supabase.server");

    // Build the edge function URL — Replit secrets are in process.env
    const supabaseUrl = process.env.SUPABASE_URL ?? process.env.VITE_SUPABASE_URL ?? "";
    const serviceKey  = process.env.SUPABASE_SERVICE_ROLE_KEY ?? process.env.SUPABASE_SERVICE_ROLE ?? "";
    const edgeFnUrl   = `${supabaseUrl}/functions/v1/ai-assistant`;

    const res = await fetch(edgeFnUrl, {
      method: "POST",
      headers: {
        "Content-Type":  "application/json",
        Authorization:   `Bearer ${serviceKey}`,
      },
      body: JSON.stringify({ messages: data.messages, context: data.context }),
    });

    if (!res.ok) {
      const errBody = await res.text().catch(() => "");
      throw new Error(`AI assistant error (${res.status}): ${errBody.slice(0, 200)}`);
    }

    const json = await res.json() as { reply?: string; error?: string };
    if (json.error) throw new Error(json.error);
    if (!json.reply) throw new Error("Empty response from AI assistant");
    return { reply: json.reply };
  });
