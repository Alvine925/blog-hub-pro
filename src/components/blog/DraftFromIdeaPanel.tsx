/**
 * DraftFromIdeaPanel
 *
 * A floating "Draft from idea" dialog on the New Post page.
 * The user describes their idea; AI returns a title, excerpt,
 * outline, and first paragraph which are auto-filled into the form.
 * When workspaceId is provided the prompt and examples are tailored
 * to the workspace's industry, audience, and brand voice.
 */

import { useState, useEffect } from "react";
import { createServerFn } from "@tanstack/react-start";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { Sparkles, Loader2, Lightbulb, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";

interface DraftResult {
  title: string;
  excerpt: string;
  outline: string[];
  first_paragraph: string;
}

interface WorkspaceContext {
  name: string;
  industry: string | null;
  targetAudience: string | null;
  brandVoice: string | null;
  primaryTopics: string[];
  suggestedCategories: string[];
  description: string | null;
}

interface DraftFromIdeaPanelProps {
  onDraftReady: (draft: { title: string; excerpt: string; content: string }) => void;
  workspaceId?: string;
}

const GENERIC_EXAMPLES = [
  "A beginner's guide to building with AI APIs in 2025",
  "Why serverless is the right choice for early-stage startups",
  "10 Tailwind CSS tricks most developers don't know",
  "How we cut our infrastructure costs by 60% using edge computing",
];

const getWorkspaceContext = createServerFn({ method: "GET" })
  .validator((input: { workspaceId: string }) => input)
  .handler(async ({ data }): Promise<WorkspaceContext | null> => {
    try {
      const { getAdminClient } = await import("@/lib/supabase.server");
      const db = getAdminClient();
      const { data: ws } = await db
        .from("workspaces")
        .select("name, industry, target_audience, brand_voice, content_pillars, ai_context, description")
        .eq("id", data.workspaceId)
        .maybeSingle();
      if (!ws) return null;
      const aiCtx = ws.ai_context as Record<string, unknown> | null;
      return {
        name: ws.name ?? "",
        industry: ws.industry ?? null,
        targetAudience: ws.target_audience ?? null,
        brandVoice: ws.brand_voice ?? null,
        primaryTopics: (ws.content_pillars as string[] | null) ?? (aiCtx?.primaryTopics as string[] | null) ?? [],
        suggestedCategories: (aiCtx?.suggestedCategories as string[] | null) ?? [],
        description: ws.description ?? null,
      };
    } catch {
      return null;
    }
  });

function buildIdeaExamples(ctx: WorkspaceContext | null): string[] {
  if (!ctx || !ctx.industry) return GENERIC_EXAMPLES;
  const industry = ctx.industry;
  const audience = ctx.targetAudience ?? "customers";
  const topics = ctx.primaryTopics?.slice(0, 2) ?? [];
  const examples: string[] = [];
  if (topics[0]) examples.push(`The ultimate guide to ${topics[0].toLowerCase()} for ${audience}`);
  if (topics[1]) examples.push(`Top trends in ${topics[1].toLowerCase()} your business needs to know`);
  examples.push(`How ${industry} businesses are using AI to grow faster in 2025`);
  examples.push(`5 common mistakes ${audience} make in ${industry} (and how to avoid them)`);
  return examples.slice(0, 4);
}

function buildSystemPrompt(ctx: WorkspaceContext | null): string {
  const contextLines: string[] = [];
  if (ctx) {
    if (ctx.name) contextLines.push(`Company/Workspace: ${ctx.name}`);
    if (ctx.industry) contextLines.push(`Industry: ${ctx.industry}`);
    if (ctx.targetAudience) contextLines.push(`Target audience: ${ctx.targetAudience}`);
    if (ctx.brandVoice) contextLines.push(`Brand voice: ${ctx.brandVoice}`);
    if (ctx.description) contextLines.push(`About: ${ctx.description}`);
    if (ctx.primaryTopics?.length) contextLines.push(`Key topics: ${ctx.primaryTopics.slice(0, 5).join(", ")}`);
  }

  const contextBlock = contextLines.length
    ? `\n\nWORKSPACE CONTEXT (use this to tailor the draft):\n${contextLines.join("\n")}\n`
    : "";

  return `You are a professional blog post drafter. Given a rough idea, return ONLY valid JSON — no markdown fences, no prose, no extra text. Raw JSON only.${contextBlock}
Return an object with this exact shape:
{
  "title": "A compelling, specific blog post title tailored to the workspace context",
  "excerpt": "A 1–2 sentence teaser that speaks directly to the target audience",
  "outline": [
    "Introduction — brief description of what this section covers",
    "Section 1: [name] — brief description",
    "Section 2: [name] — brief description",
    "Section 3: [name] — brief description",
    "Conclusion — key takeaway and call to action"
  ],
  "first_paragraph": "A full, engaging opening paragraph (3–5 sentences) written in the brand voice that hooks the reader"
}`;
}

function outlineToHtml(outline: string[], firstParagraph: string): string {
  const lines: string[] = [];

  if (firstParagraph) {
    lines.push(`<p>${firstParagraph}</p>`);
    lines.push("");
  }

  outline.forEach((section) => {
    const clean = section.replace(/^#+\s*/, "").replace(/^\d+\.\s*/, "").trim();
    const isHeading = section.match(/^#{1,3}\s/) || section.match(/^(Introduction|Conclusion|Section\s)/i);

    if (isHeading || clean.length < 80) {
      lines.push(`<h2>${clean}</h2>`);
      lines.push("<p></p>");
    } else {
      lines.push(`<p>${clean}</p>`);
    }
  });

  return lines.join("\n");
}

export function DraftFromIdeaPanel({ onDraftReady, workspaceId }: DraftFromIdeaPanelProps) {
  const [open, setOpen] = useState(false);
  const [idea, setIdea] = useState("");
  const [loading, setLoading] = useState(false);
  const [preview, setPreview] = useState<DraftResult | null>(null);
  const [wsContext, setWsContext] = useState<WorkspaceContext | null>(null);

  useEffect(() => {
    if (!workspaceId) return;
    getWorkspaceContext({ data: { workspaceId } })
      .then((ctx) => setWsContext(ctx))
      .catch(() => {});
  }, [workspaceId]);

  const examples = buildIdeaExamples(wsContext);
  const systemPrompt = buildSystemPrompt(wsContext);

  async function handleGenerate() {
    const trimmed = idea.trim();
    if (!trimmed) { toast.error("Describe your idea first"); return; }

    setLoading(true);
    setPreview(null);

    try {
      const { data: { session } } = await supabase.auth.getSession();
      const authHeaders = session?.access_token
        ? { Authorization: `Bearer ${session.access_token}` }
        : {};
      const { data, error } = await supabase.functions.invoke("ai-generate", {
        body: {
          task: "custom",
          system_prompt: systemPrompt,
          prompt: trimmed,
        },
        headers: authHeaders,
      });

      if (error) throw new Error(error.message);
      if (data?.error) throw new Error(data.error);

      const raw: string = data.result ?? "";

      let parsed: DraftResult | null = null;
      try {
        const cleaned = raw.replace(/^```(?:json)?\n?/m, "").replace(/\n?```$/m, "").trim();
        parsed = JSON.parse(cleaned) as DraftResult;
      } catch {
        const lines = raw.split("\n").filter(Boolean);
        parsed = {
          title: lines[0]?.replace(/^#\s*/, "") ?? trimmed,
          excerpt: lines[1] ?? "",
          outline: lines.slice(2, 7),
          first_paragraph: lines.slice(1).join(" ").slice(0, 500),
        };
      }

      setPreview(parsed);
      if (data.simulated) {
        toast.info("Showing simulated draft — connect AI for real drafts", { duration: 4000 });
      }
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Draft generation failed");
    } finally {
      setLoading(false);
    }
  }

  function handleApply() {
    if (!preview) return;
    const content = outlineToHtml(preview.outline, preview.first_paragraph);
    onDraftReady({ title: preview.title, excerpt: preview.excerpt, content });
    setOpen(false);
    setPreview(null);
    setIdea("");
    toast.success("Draft applied — continue writing from here!");
  }

  function handleClose() {
    setOpen(false);
    setPreview(null);
    setIdea("");
  }

  const placeholderHint = wsContext?.industry
    ? `e.g. A practical guide to ${wsContext.industry.toLowerCase()} trends for ${wsContext.targetAudience ?? "your audience"}…`
    : "e.g. A practical guide to reducing API costs using caching strategies in Next.js apps…";

  return (
    <>
      <Button
        type="button"
        variant="outline"
        size="sm"
        onClick={() => setOpen(true)}
        className="gap-2 border-dashed border-primary/40 text-primary hover:border-primary hover:bg-primary/5"
      >
        <Lightbulb className="h-4 w-4" />
        Draft from idea
      </Button>

      <Dialog open={open} onOpenChange={(v) => { if (!v) handleClose(); }}>
        <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Sparkles className="h-5 w-5 text-primary" />
              Draft from idea
              {wsContext?.name && (
                <span className="text-xs font-normal text-muted-foreground ml-1">
                  — tailored to {wsContext.name}
                </span>
              )}
            </DialogTitle>
          </DialogHeader>

          <div className="space-y-5 pt-1">
            {wsContext && (wsContext.industry || wsContext.targetAudience) && (
              <div className="rounded-lg border border-border/60 bg-muted/30 px-4 py-3 text-xs text-muted-foreground space-y-1">
                {wsContext.industry && <p><span className="font-medium text-foreground">Industry:</span> {wsContext.industry}</p>}
                {wsContext.targetAudience && <p><span className="font-medium text-foreground">Audience:</span> {wsContext.targetAudience}</p>}
                {wsContext.brandVoice && <p><span className="font-medium text-foreground">Tone:</span> {wsContext.brandVoice}</p>}
              </div>
            )}

            <div className="space-y-2">
              <label className="text-sm font-medium">Describe your idea</label>
              <Textarea
                value={idea}
                onChange={(e) => setIdea(e.target.value)}
                placeholder={placeholderHint}
                rows={4}
                className="resize-none"
                disabled={loading}
              />
              <div className="flex flex-wrap gap-1.5">
                {examples.map((ex) => (
                  <button
                    key={ex}
                    type="button"
                    onClick={() => setIdea(ex)}
                    className="rounded-full border border-border/60 px-2.5 py-0.5 text-xs text-muted-foreground hover:border-primary/40 hover:text-foreground transition-colors"
                  >
                    {ex}
                  </button>
                ))}
              </div>
            </div>

            <Button
              onClick={handleGenerate}
              disabled={loading || !idea.trim()}
              className="gap-2 w-full"
            >
              {loading
                ? <><Loader2 className="h-4 w-4 animate-spin" /> Drafting…</>
                : <><Sparkles className="h-4 w-4" /> Generate draft</>}
            </Button>

            {preview && (
              <div className="space-y-4 rounded-xl border border-border bg-muted/20 p-5">
                <div>
                  <p className="text-[10px] font-semibold uppercase tracking-widest text-muted-foreground mb-1">Title</p>
                  <p className="text-base font-semibold">{preview.title}</p>
                </div>

                {preview.excerpt && (
                  <div>
                    <p className="text-[10px] font-semibold uppercase tracking-widest text-muted-foreground mb-1">Excerpt</p>
                    <p className="text-sm text-muted-foreground">{preview.excerpt}</p>
                  </div>
                )}

                <div>
                  <p className="text-[10px] font-semibold uppercase tracking-widest text-muted-foreground mb-2">Outline</p>
                  <div className="space-y-1">
                    {preview.outline.map((section, i) => (
                      <div key={i} className="flex items-start gap-2">
                        <Badge variant="secondary" className="text-[10px] min-w-[1.5rem] justify-center shrink-0 mt-0.5">
                          {i + 1}
                        </Badge>
                        <p className="text-sm">{section.replace(/^#+\s*/, "").replace(/^\d+\.\s*/, "")}</p>
                      </div>
                    ))}
                  </div>
                </div>

                {preview.first_paragraph && (
                  <div>
                    <p className="text-[10px] font-semibold uppercase tracking-widest text-muted-foreground mb-1">Opening paragraph</p>
                    <p className="text-sm text-muted-foreground leading-relaxed">{preview.first_paragraph}</p>
                  </div>
                )}

                <div className="flex gap-2 pt-2">
                  <Button onClick={handleApply} className="flex-1 gap-2">
                    <Sparkles className="h-4 w-4" />
                    Apply draft to editor
                  </Button>
                  <Button
                    variant="outline"
                    onClick={() => { setPreview(null); }}
                    className="gap-1.5"
                  >
                    <X className="h-4 w-4" />
                    Regenerate
                  </Button>
                </div>
              </div>
            )}
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
}
