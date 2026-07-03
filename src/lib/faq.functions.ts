import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";

export interface Faq {
  id: string;
  workspace_id: string | null;
  question: string;
  answer: string;
  category: string;
  sort_order: number;
  featured: boolean;
  status: "draft" | "published";
  seo_title: string | null;
  meta_description: string | null;
  created_at: string;
  updated_at: string;
}

export const listPublishedFaqs = createServerFn({ method: "GET" })
  .validator((input: { workspaceId: string; category?: string } | undefined) =>
    z.object({ workspaceId: z.string().uuid(), category: z.string().optional() }).parse(input),
  )
  .handler(async ({ data }): Promise<Faq[]> => {
    const { getAdminClient } = await import("./supabase.server");
    const supabase = (await getAdminClient()) as any;

    let query = supabase
      .from("faqs")
      .select("*")
      .eq("workspace_id", data.workspaceId)
      .eq("status", "published")
      .order("sort_order", { ascending: true });

    if (data.category && data.category !== "All") {
      query = query.eq("category", data.category);
    }

    const { data: rows, error } = await query.limit(200);
    if (error) throw new Error(error.message);
    return (rows ?? []) as Faq[];
  });

export const adminListFaqs = createServerFn({ method: "GET" })
  .validator((input: { workspaceId?: string } | undefined) =>
    z.object({ workspaceId: z.string().uuid().optional() }).parse(input ?? {}),
  )
  .handler(async ({ data }): Promise<Faq[]> => {
    const { getAdminClient } = await import("./supabase.server");
    const supabase = (await getAdminClient()) as any;

    let query = supabase
      .from("faqs")
      .select("*")
      .order("sort_order", { ascending: true })
      .limit(500);

    if (data.workspaceId) {
      query = query.eq("workspace_id", data.workspaceId);
    }

    const { data: rows, error } = await query;
    if (error) throw new Error(error.message);
    return (rows ?? []) as Faq[];
  });

const faqInputSchema = z.object({
  id: z.string().uuid().optional(),
  workspaceId: z.string().uuid(),
  question: z.string().trim().min(1, "Question is required").max(300),
  answer: z.string().trim().min(1, "Answer is required"),
  category: z.string().trim().min(1).max(60).default("General"),
  sort_order: z.number().int().default(0),
  featured: z.boolean().default(false),
  status: z.enum(["draft", "published"]).default("draft"),
  seo_title: z.string().trim().max(200).nullable().default(null),
  meta_description: z.string().trim().max(320).nullable().default(null),
});

export const upsertFaq = createServerFn({ method: "POST" })
  .validator((input: unknown) => faqInputSchema.parse(input))
  .handler(async ({ data }): Promise<{ id: string }> => {
    const { getAdminClient } = await import("./supabase.server");
    const supabase = (await getAdminClient()) as any;

    const record = {
      workspace_id: data.workspaceId,
      question: data.question,
      answer: data.answer,
      category: data.category,
      sort_order: data.sort_order,
      featured: data.featured,
      status: data.status,
      seo_title: data.seo_title,
      meta_description: data.meta_description,
    };

    if (data.id) {
      const { error } = await supabase
        .from("faqs")
        .update(record)
        .eq("id", data.id)
        .eq("workspace_id", data.workspaceId);
      if (error) throw new Error(error.message);
      return { id: data.id };
    }

    const { data: inserted, error } = await supabase
      .from("faqs")
      .insert(record)
      .select("id")
      .single();
    if (error) throw new Error(error.message);
    return { id: (inserted as { id: string }).id };
  });

export const setFaqStatus = createServerFn({ method: "POST" })
  .validator((input: { id: string; workspaceId: string; status: "draft" | "published" }) =>
    z
      .object({
        id: z.string().uuid(),
        workspaceId: z.string().uuid(),
        status: z.enum(["draft", "published"]),
      })
      .parse(input),
  )
  .handler(async ({ data }): Promise<{ success: true }> => {
    const { getAdminClient } = await import("./supabase.server");
    const supabase = (await getAdminClient()) as any;
    const { error } = await supabase
      .from("faqs")
      .update({ status: data.status })
      .eq("id", data.id)
      .eq("workspace_id", data.workspaceId);
    if (error) throw new Error(error.message);
    return { success: true };
  });

export const deleteFaq = createServerFn({ method: "POST" })
  .validator((input: { id: string; workspaceId: string }) =>
    z.object({ id: z.string().uuid(), workspaceId: z.string().uuid() }).parse(input),
  )
  .handler(async ({ data }): Promise<{ success: true }> => {
    const { getAdminClient } = await import("./supabase.server");
    const supabase = (await getAdminClient()) as any;
    const { error } = await supabase
      .from("faqs")
      .delete()
      .eq("id", data.id)
      .eq("workspace_id", data.workspaceId);
    if (error) throw new Error(error.message);
    return { success: true };
  });

export const adminGetFaq = createServerFn({ method: "GET" })
  .validator((input: { id: string; workspaceId: string } | undefined) =>
    z.object({ id: z.string().uuid(), workspaceId: z.string().uuid() }).parse(input),
  )
  .handler(async ({ data }): Promise<Faq> => {
    const { getAdminClient } = await import("./supabase.server");
    const supabase = (await getAdminClient()) as any;
    const { data: row, error } = await supabase
      .from("faqs")
      .select("*")
      .eq("id", data.id)
      .eq("workspace_id", data.workspaceId)
      .single();
    if (error) throw new Error(error.message);
    return row as Faq;
  });
