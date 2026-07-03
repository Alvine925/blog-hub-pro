/**
 * DraftFromIdeaPanel
 *
 * A "Draft from idea" dialog on the New Post page.
 * Phase-based: input → generating → result.
 * After generation the input section collapses — only the result is shown.
 */

import { useState, useEffect } from "react";
import { createServerFn } from "@tanstack/react-start";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";

// ── Types ─────────────────────────────────────────────────────────────────────

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
  description: string | null;
}

interface DraftFromIdeaPanelProps {
  onDraftReady: (draft: { title: string; excerpt: string; content: string }) => void;
  workspaceId?: string;
}

type Phase = "input" | "generating" | "result";

// ── Server fn ─────────────────────────────────────────────────────────────────

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
        description: ws.description ?? null,
      };
    } catch {
      return null;
    }
  });

// ── Helpers ───────────────────────────────────────────────────────────────────

const GENERIC_EXAMPLES = [
  "A beginner's guide to building with AI APIs in 2025",
  "Why serverless is the right choice for early-stage startups",
  "10 Tailwind CSS tricks most developers don't know",
  "How we cut infrastructure costs by 60% using edge computing",
];

function buildExamples(ctx: WorkspaceContext | null): string[] {
  if (!ctx?.industry) return GENERIC_EXAMPLES;
  const { industry, targetAudience: audience = "customers", primaryTopics: topics = [] } = ctx;
  const examples: string[] = [];
  if (topics[0]) examples.push(`The ultimate guide to ${topics[0].toLowerCase()} for ${audience}`);
  if (topics[1]) examples.push(`Top trends in ${topics[1].toLowerCase()} your business needs to know`);
  examples.push(`How ${industry} businesses are using AI to grow faster in 2025`);
  examples.push(`5 common mistakes ${audience} make in ${industry} (and how to avoid them)`);
  return examples.slice(0, 4);
}

function buildSystemPrompt(ctx: WorkspaceContext | null): string {
  const lines: string[] = [];
  if (ctx) {
    if (ctx.name)           lines.push(`Company: ${ctx.name}`);
    if (ctx.industry)       lines.push(`Industry: ${ctx.industry}`);
    if (ctx.targetAudience) lines.push(`Target audience: ${ctx.targetAudience}`);
    if (ctx.brandVoice)     lines.push(`Brand voice: ${ctx.brandVoice}`);
    if (ctx.description)    lines.push(`About: ${ctx.description}`);
    if (ctx.primaryTopics?.length) lines.push(`Key topics: ${ctx.primaryTopics.slice(0, 5).join(", ")}`);
  }
  const ctx_block = lines.length
    ? `\n\nWORKSPACE CONTEXT:\n${lines.join("\n")}\n`
    : "";

  return `You are a professional blog post drafter. Return ONLY valid JSON — no markdown fences, no prose.${ctx_block}
Return:
{
  "title": "A compelling, specific post title",
  "excerpt": "1–2 sentence teaser for the target audience",
  "outline": ["Introduction — ...", "Section 1: ... — ...", "Section 2: ... — ...", "Conclusion — ..."],
  "first_paragraph": "Engaging 3–5 sentence opening paragraph in the brand voice"
}`;
}

function outlineToHtml(outline: string[], firstParagraph: string): string {
  const lines: string[] = [];
  if (firstParagraph) { lines.push(`<p>${firstParagraph}</p>`); lines.push(""); }
  for (const section of outline) {
    const clean = section.replace(/^#+\s*/, "").replace(/^\d+\.\s*/, "").trim();
    const isHeading = /^(Introduction|Conclusion|Section\s)/i.test(section) || section.match(/^#{1,3}\s/) || clean.length < 80;
    lines.push(isHeading ? `<h2>${clean}</h2><p></p>` : `<p>${clean}</p>`);
  }
  return lines.join("\n");
}

// ── Component ─────────────────────────────────────────────────────────────────

export function DraftFromIdeaPanel({ onDraftReady, workspaceId }: DraftFromIdeaPanelProps) {
  const [open, setOpen] = useState(false);
  const [phase, setPhase] = useState<Phase>("input");
  const [idea, setIdea] = useState("");
  const [result, setResult] = useState<DraftResult | null>(null);
  const [wsContext, setWsContext] = useState<WorkspaceContext | null>(null);

  useEffect(() => {
    if (!workspaceId) return;
    getWorkspaceContext({ data: { workspaceId } })
      .then((ctx) => setWsContext(ctx))
      .catch(() => {});
  }, [workspaceId]);

  const examples = buildExamples(wsContext);
  const systemPrompt = buildSystemPrompt(wsContext);

  function reset() {
    setPhase("input");
    setIdea("");
    setResult(null);
  }

  function handleClose() {
    setOpen(false);
    // Delay state reset so the dialog close animation completes cleanly
    setTimeout(reset, 300);
  }

  async function handleGenerate() {
    const trimmed = idea.trim();
    if (!trimmed) { toast.error("Describe your idea first"); return; }

    setPhase("generating");
    setResult(null);

    try {
      const { data: { session } } = await supabase.auth.getSession();
      const headers = session?.access_token
        ? { Authorization: `Bearer ${session.access_token}` }
        : {};
      const { data, error } = await supabase.functions.invoke("ai-generate", {
        body: { task: "custom", system_prompt: systemPrompt, prompt: trimmed },
        headers,
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

      setResult(parsed);
      setPhase("result");
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Draft generation failed");
      setPhase("input");
    }
  }

  function handleApply() {
    if (!result) return;
    const content = outlineToHtml(result.outline, result.first_paragraph);
    onDraftReady({ title: result.title, excerpt: result.excerpt, content });
    setOpen(false);
    setTimeout(reset, 300);
    toast.success("Draft applied — continue writing from here.");
  }

  const placeholderHint = wsContext?.industry
    ? `e.g. A practical guide to ${wsContext.industry.toLowerCase()} trends for ${wsContext.targetAudience ?? "your audience"}…`
    : "e.g. A guide to reducing API costs using caching strategies in Next.js…";

  return (
    <>
      {/* ── Trigger ────────────────────────────────────────────────────────── */}
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="text-sm font-medium text-muted-foreground underline-offset-4 hover:text-foreground hover:underline transition-colors"
      >
        Draft from idea
      </button>

      {/* ── Dialog ─────────────────────────────────────────────────────────── */}
      <Dialog open={open} onOpenChange={(v) => { if (!v) handleClose(); }}>
        <DialogContent className="max-w-xl p-0 overflow-hidden">
          <div className="flex flex-col">

            {/* Header */}
            <DialogHeader className="px-6 pt-5 pb-4 border-b border-border">
              <div className="flex items-baseline gap-2">
                <DialogTitle className="text-base font-semibold tracking-tight">
                  Draft from idea
                </DialogTitle>
                {wsContext?.name && (
                  <span className="text-xs text-muted-foreground">
                    — tailored to {wsContext.name}
                  </span>
                )}
              </div>
            </DialogHeader>

            {/* Body */}
            <div className="px-6 py-5 space-y-5 max-h-[75vh] overflow-y-auto">

              {/* Workspace context — always visible */}
              {wsContext && (wsContext.industry || wsContext.targetAudience || wsContext.brandVoice) && (
                <div className="rounded-lg bg-muted/40 px-4 py-3 text-xs text-muted-foreground space-y-0.5">
                  {wsContext.industry && (
                    <p><span className="font-medium text-foreground">Industry:</span> {wsContext.industry}</p>
                  )}
                  {wsContext.targetAudience && (
                    <p><span className="font-medium text-foreground">Audience:</span> {wsContext.targetAudience}</p>
                  )}
                  {wsContext.brandVoice && (
                    <p><span className="font-medium text-foreground">Tone:</span> {wsContext.brandVoice}</p>
                  )}
                </div>
              )}

              {/* ── INPUT PHASE ─────────────────────────────────────────────── */}
              {phase === "input" && (
                <div className="space-y-4">
                  <div className="space-y-2">
                    <label className="text-sm font-medium">Describe your idea</label>
                    <Textarea
                      value={idea}
                      onChange={(e) => setIdea(e.target.value)}
                      placeholder={placeholderHint}
                      rows={4}
                      className="resize-none text-sm"
                      onKeyDown={(e) => {
                        if (e.key === "Enter" && (e.metaKey || e.ctrlKey)) handleGenerate();
                      }}
                    />
                  </div>

                  {/* Example suggestions */}
                  <div className="space-y-1.5">
                    <p className="text-[11px] font-medium uppercase tracking-wider text-muted-foreground/60">
                      Suggestions
                    </p>
                    <div className="flex flex-col gap-1">
                      {examples.map((ex) => (
                        <button
                          key={ex}
                          type="button"
                          onClick={() => setIdea(ex)}
                          className="text-left text-xs text-muted-foreground px-3 py-2 rounded-md border border-border/50 hover:border-border hover:text-foreground hover:bg-muted/30 transition-colors"
                        >
                          {ex}
                        </button>
                      ))}
                    </div>
                  </div>

                  <Button
                    onClick={handleGenerate}
                    disabled={!idea.trim()}
                    className="w-full"
                    size="sm"
                  >
                    Generate draft
                  </Button>
                </div>
              )}

              {/* ── GENERATING PHASE ────────────────────────────────────────── */}
              {phase === "generating" && (
                <div className="flex flex-col items-center justify-center gap-3 py-16 text-center">
                  <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
                  <div className="space-y-1">
                    <p className="text-sm font-medium">Writing your draft…</p>
                    <p className="text-xs text-muted-foreground">This takes about 10–20 seconds.</p>
                  </div>
                </div>
              )}

              {/* ── RESULT PHASE ────────────────────────────────────────────── */}
              {phase === "result" && result && (
                <div className="space-y-5">

                  {/* Title */}
                  <div>
                    <p className="text-[10px] font-semibold uppercase tracking-widest text-muted-foreground mb-1.5">
                      Title
                    </p>
                    <p className="text-lg font-semibold leading-snug">{result.title}</p>
                  </div>

                  {/* Excerpt */}
                  {result.excerpt && (
                    <div>
                      <p className="text-[10px] font-semibold uppercase tracking-widest text-muted-foreground mb-1.5">
                        Excerpt
                      </p>
                      <p className="text-sm text-muted-foreground leading-relaxed">{result.excerpt}</p>
                    </div>
                  )}

                  {/* Outline */}
                  {result.outline.length > 0 && (
                    <div>
                      <p className="text-[10px] font-semibold uppercase tracking-widest text-muted-foreground mb-2">
                        Outline
                      </p>
                      <ol className="space-y-1.5">
                        {result.outline.map((section, i) => (
                          <li key={i} className="flex items-start gap-2.5 text-sm">
                            <span className="shrink-0 mt-0.5 w-5 h-5 rounded-full bg-muted flex items-center justify-center text-[10px] font-bold text-muted-foreground tabular-nums">
                              {i + 1}
                            </span>
                            <span>{section.replace(/^#+\s*/, "").replace(/^\d+\.\s*/, "")}</span>
                          </li>
                        ))}
                      </ol>
                    </div>
                  )}

                  {/* Opening paragraph */}
                  {result.first_paragraph && (
                    <div>
                      <p className="text-[10px] font-semibold uppercase tracking-widest text-muted-foreground mb-1.5">
                        Opening paragraph
                      </p>
                      <p className="text-sm text-muted-foreground leading-relaxed italic">
                        {result.first_paragraph}
                      </p>
                    </div>
                  )}

                  {/* Actions */}
                  <div className="flex gap-2 pt-1 border-t border-border">
                    <Button onClick={handleApply} size="sm" className="flex-1">
                      Use this draft
                    </Button>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => setPhase("input")}
                    >
                      Try another idea
                    </Button>
                  </div>
                </div>
              )}
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
}
