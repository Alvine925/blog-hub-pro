import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";

export interface SiteSettings {
  site_name: string;
  site_description: string;
  site_url: string;
  blog_title: string;
  blog_description: string;
  social_twitter: string;
  social_github: string;
  social_linkedin: string;
  default_author: string;
  default_category: string;
}

const DEFAULTS: SiteSettings = {
  site_name: "Lunar CMS",
  site_description: "A modern, AI-powered headless CMS",
  site_url: "",
  blog_title: "Blog",
  blog_description: "Ideas, guides and inspiration.",
  social_twitter: "",
  social_github: "",
  social_linkedin: "",
  default_author: "Admin",
  default_category: "General",
};

export const getSettings = createServerFn({ method: "GET" }).handler(
  async (): Promise<SiteSettings> => {
    const { getAdminClient } = await import("./supabase.server");
    const supabase = await getAdminClient();
    const { data, error } = await supabase.from("cms_settings").select("key, value");
    if (error) return DEFAULTS;
    const map: Record<string, string> = {};
    for (const row of data ?? []) map[row.key] = row.value;
    return {
      site_name: map.site_name ?? DEFAULTS.site_name,
      site_description: map.site_description ?? DEFAULTS.site_description,
      site_url: map.site_url ?? DEFAULTS.site_url,
      blog_title: map.blog_title ?? DEFAULTS.blog_title,
      blog_description: map.blog_description ?? DEFAULTS.blog_description,
      social_twitter: map.social_twitter ?? DEFAULTS.social_twitter,
      social_github: map.social_github ?? DEFAULTS.social_github,
      social_linkedin: map.social_linkedin ?? DEFAULTS.social_linkedin,
      default_author: map.default_author ?? DEFAULTS.default_author,
      default_category: map.default_category ?? DEFAULTS.default_category,
    };
  },
);

const settingsSchema = z.object({
  site_name: z.string().trim().max(100).default("Lunar CMS"),
  site_description: z.string().trim().max(300).default(""),
  site_url: z.string().trim().max(200).default(""),
  blog_title: z.string().trim().max(100).default("Blog"),
  blog_description: z.string().trim().max(300).default(""),
  social_twitter: z.string().trim().max(100).default(""),
  social_github: z.string().trim().max(100).default(""),
  social_linkedin: z.string().trim().max(100).default(""),
  default_author: z.string().trim().max(120).default("Admin"),
  default_category: z.string().trim().max(60).default("General"),
});

export const saveSettings = createServerFn({ method: "POST" })
  .validator((input: unknown) => settingsSchema.parse(input))
  .handler(async ({ data }): Promise<{ ok: true }> => {
    const { getAdminClient } = await import("./supabase.server");
    const supabase = await getAdminClient();
    const upserts = Object.entries(data).map(([key, value]) => ({
      key,
      value: String(value),
    }));
    const { error } = await supabase
      .from("cms_settings")
      .upsert(upserts, { onConflict: "key" });
    if (error) throw new Error(error.message);
    return { ok: true };
  });
