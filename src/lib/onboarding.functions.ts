/**
 * Onboarding helpers.
 *
 * All functions are server functions using the admin (service-role) client so
 * they bypass RLS and work even if table-level GRANTs haven't been applied yet.
 * The caller must pass userId (obtained client-side from supabase.auth.getSession).
 */

import { createServerFn } from "@tanstack/react-start";

// ── Types ────────────────────────────────────────────────────────────────────

export type OnboardingStep =
  | "welcome"
  | "website"
  | "analyzing"
  | "collections"
  | "preparing"
  | "complete";

export interface OnboardingState {
  id: string;
  user_id: string;
  step: OnboardingStep;
  workspace_id: string | null;
  website_url: string | null;
  analysis_data: WebsiteIntelligence | null;
  completed_at: string | null;
  created_at: string;
  updated_at: string;
}

export interface Competitor {
  name: string;
  website: string;
  description: string;
  strengths: string[];
  weaknesses: string[];
  contentStrategy: string;
}

export interface ContentOpportunity {
  title: string;
  type: string;
  topic: string;
  reason: string;
  priority: "high" | "medium" | "low";
}

export interface WebsiteIntelligence {
  websiteName: string;
  companyName: string;
  industry: string;
  description: string;
  targetAudience: string;
  businessModel: string;
  services: string[];
  products: string[];
  brandVoice: string;
  primaryTopics: string[];
  keywords: string[];
  location: string | null;
  language: string;
  socialLinks: Record<string, string>;
  competitors: Competitor[];
  contentOpportunities: ContentOpportunity[];
  contentPillars: string[];
  suggestedTags: string[];
  suggestedCategories: string[];
  brandSummary: string;
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type AnyClient = any;

async function getDb(): Promise<AnyClient> {
  const { getAdminClient } = await import("./supabase.server");
  return getAdminClient();
}

// ── getOnboardingState ────────────────────────────────────────────────────────

export const getOnboardingState = createServerFn({ method: "POST" })
  .validator((input: { userId: string }) => input)
  .handler(async ({ data }): Promise<OnboardingState | null> => {
    const db: AnyClient = await getDb();

    const { data: row, error } = await db
      .from("user_onboarding")
      .select("*")
      .eq("user_id", data.userId)
      .maybeSingle();

    if (error) {
      console.warn("[onboarding] getOnboardingState error:", error.message);
      return null;
    }
    return (row ?? null) as OnboardingState | null;
  });

// ── upsertOnboardingState ─────────────────────────────────────────────────────

export const upsertOnboardingState = createServerFn({ method: "POST" })
  .validator(
    (input: {
      userId: string;
      step: OnboardingStep;
      website_url?: string;
      workspace_id?: string;
      analysis_data?: WebsiteIntelligence;
      completed_at?: string;
    }) => input,
  )
  .handler(async ({ data }): Promise<OnboardingState | null> => {
    const db: AnyClient = await getDb();

    const payload: Record<string, unknown> = {
      user_id:    data.userId,
      step:       data.step,
      updated_at: new Date().toISOString(),
    };
    if (data.website_url   !== undefined) payload.website_url   = data.website_url;
    if (data.workspace_id  !== undefined) payload.workspace_id  = data.workspace_id;
    if (data.analysis_data !== undefined) payload.analysis_data = data.analysis_data;
    if (data.completed_at  !== undefined) payload.completed_at  = data.completed_at;

    const { data: row, error } = await db
      .from("user_onboarding")
      .upsert(payload, { onConflict: "user_id" })
      .select("*")
      .single();

    if (error) {
      console.warn("[onboarding] upsertOnboardingState error:", error.message);
      // Don't throw — let the flow continue even if persistence fails
      return null;
    }
    return row as OnboardingState;
  });

// ── createOnboardingWorkspace ─────────────────────────────────────────────────

export const createOnboardingWorkspace = createServerFn({ method: "POST" })
  .validator(
    (input: {
      userId: string;
      name: string;
      websiteUrl: string;
      intelligence: WebsiteIntelligence;
      selectedCollections: string[];
    }) => input,
  )
  .handler(async ({ data }): Promise<{ workspaceId: string }> => {
    const db: AnyClient = await getDb();

    function slugify(s: string): string {
      return s.toLowerCase().trim().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");
    }

    const name =
      data.name ||
      data.intelligence.companyName ||
      data.intelligence.websiteName ||
      "My Workspace";
    const baseSlug = slugify(name);

    const { data: existing } = await db
      .from("workspaces")
      .select("id")
      .eq("slug", baseSlug);

    const finalSlug =
      existing && existing.length > 0 ? `${baseSlug}-${Date.now()}` : baseSlug;

    const intel = data.intelligence;

    const { data: workspace, error: wsError } = await db
      .from("workspaces")
      .insert({
        name,
        slug: finalSlug,
        description:          intel.description || null,
        user_id:              data.userId,
        website_url:          data.websiteUrl || null,
        industry:             intel.industry || null,
        target_audience:      intel.targetAudience || null,
        business_model:       intel.businessModel || null,
        brand_voice:          intel.brandVoice || null,
        language:             intel.language || "en",
        location:             intel.location || null,
        social_links:         intel.socialLinks || {},
        ai_context: {
          brandSummary:        intel.brandSummary,
          primaryTopics:       intel.primaryTopics,
          services:            intel.services,
          products:            intel.products,
          suggestedCategories: intel.suggestedCategories,
          suggestedTags:       intel.suggestedTags,
        },
        content_pillars:       intel.contentPillars || [],
        selected_collections:  data.selectedCollections,
      })
      .select("id")
      .single();

    if (wsError) throw new Error(wsError.message);
    const workspaceId = (workspace as { id: string }).id;

    // Insert competitors
    if (intel.competitors?.length) {
      await db.from("workspace_competitors").insert(
        intel.competitors.slice(0, 6).map((c: Competitor) => ({
          workspace_id:     workspaceId,
          name:             c.name,
          website:          c.website || null,
          description:      c.description || null,
          strengths:        c.strengths || [],
          weaknesses:       c.weaknesses || [],
          content_strategy: c.contentStrategy || null,
        })),
      );
    }

    // Insert keywords
    if (intel.keywords?.length) {
      await db.from("workspace_keywords").insert(
        intel.keywords.slice(0, 20).map((kw: string) => ({
          workspace_id:     workspaceId,
          keyword:          kw,
          opportunity_type: "general",
        })),
      );
    }

    // Insert content opportunities
    if (intel.contentOpportunities?.length) {
      await db.from("workspace_content_opportunities").insert(
        intel.contentOpportunities.slice(0, 10).map((co: ContentOpportunity) => ({
          workspace_id: workspaceId,
          title:        co.title,
          type:         co.type || "blog",
          topic:        co.topic || null,
          reason:       co.reason || null,
          priority:     co.priority || "medium",
        })),
      );
    }

    return { workspaceId };
  });

// ── getWorkspaceIntelligence ──────────────────────────────────────────────────

export const getWorkspaceIntelligence = createServerFn({ method: "POST" })
  .validator((input: { userId: string }) => input)
  .handler(
    async ({ data }): Promise<{
      workspace: Record<string, unknown> | null;
      competitors: unknown[];
      keywords: unknown[];
      opportunities: unknown[];
    }> => {
      const db: AnyClient = await getDb();

      const { data: workspaces } = await db
        .from("workspaces")
        .select("*")
        .eq("user_id", data.userId)
        .not("website_url", "is", null)
        .order("created_at", { ascending: false })
        .limit(1);

      const workspace = workspaces?.[0] ?? null;
      if (!workspace) {
        return { workspace: null, competitors: [], keywords: [], opportunities: [] };
      }

      const wid = (workspace as { id: string }).id;

      const [{ data: competitors }, { data: keywords }, { data: opportunities }] =
        await Promise.all([
          db.from("workspace_competitors").select("*").eq("workspace_id", wid).limit(6),
          db.from("workspace_keywords").select("*").eq("workspace_id", wid).limit(20),
          db
            .from("workspace_content_opportunities")
            .select("*")
            .eq("workspace_id", wid)
            .order("priority")
            .limit(8),
        ]);

      return {
        workspace:    workspace as Record<string, unknown>,
        competitors:  competitors ?? [],
        keywords:     keywords ?? [],
        opportunities: opportunities ?? [],
      };
    },
  );
