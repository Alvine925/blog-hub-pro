/**
 * DraftFromIdeaPanel
 *
 * A floating "Draft from idea" dialog on the New Post page.
 * The user describes their idea; AI returns a title, excerpt,
 * outline, and first paragraph which are auto-filled into the form.
 */

import { useState } from "react";
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

interface DraftFromIdeaPanelProps {
  onDraftReady: (draft: { title: string; excerpt: string; content: string }) => void;
}

const IDEA_EXAMPLES = [
  "A beginner's guide to building with AI APIs in 2025",
  "Why serverless is the right choice for early-stage startups",
  "10 Tailwind CSS tricks most developers don't know",
  "How we cut our infrastructure costs by 60% using edge computing",
];

function outlineToHtml(outline: string[], firstParagraph: string): string {
  const lines: string[] = [];

  // First paragraph as an intro
  if (firstParagraph) {
    lines.push(`<p>${firstParagraph}</p>`);
    lines.push("");
  }

  // Outline sections → headings + placeholder paragraphs
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

export function DraftFromIdeaPanel({ onDraftReady }: DraftFromIdeaPanelProps) {
  const [open, setOpen] = useState(false);
  const [idea, setIdea] = useState("");
  const [loading, setLoading] = useState(false);
  const [preview, setPreview] = useState<DraftResult | null>(null);

  async function handleGenerate() {
    const trimmed = idea.trim();
    if (!trimmed) { toast.error("Describe your idea first"); return; }

    setLoading(true);
    setPreview(null);

    const systemPrompt = `You are a professional blog post drafter. Given a rough idea, return ONLY valid JSON — no markdown fences, no prose, no extra text. Raw JSON only.

Return an object with this exact shape:
{
  "title": "A compelling, specific blog post title",
  "excerpt": "A 1–2 sentence teaser that makes readers want to read more",
  "outline": [
    "Introduction — brief description of what this section covers",
    "Section 1: [name] — brief description",
    "Section 2: [name] — brief description",
    "Section 3: [name] — brief description",
    "Conclusion — key takeaway and call to action"
  ],
  "first_paragraph": "A full, engaging opening paragraph (3–5 sentences) that hooks the reader"
}`;

    try {
      const { data, error } = await supabase.functions.invoke("ai-generate", {
        body: {
          task: "custom",
          system_prompt: systemPrompt,
          prompt: trimmed,
        },
      });

      if (error) throw new Error(error.message);
      if (data?.error) throw new Error(data.error);

      const raw: string = data.result ?? "";

      // Try to parse JSON from the result
      let parsed: DraftResult | null = null;
      try {
        // Strip markdown fences if present
        const cleaned = raw.replace(/^```(?:json)?\n?/m, "").replace(/\n?```$/m, "").trim();
        parsed = JSON.parse(cleaned) as DraftResult;
      } catch {
        // Fallback: use the raw text as first paragraph, extract title from first line
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
        toast.info("Showing simulated draft — connect OpenAI for real AI drafts", { duration: 4000 });
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

  return (
    <>
      {/* Trigger button — shown prominently at the top of a new post */}
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
            </DialogTitle>
          </DialogHeader>

          <div className="space-y-5 pt-1">
            {/* Idea input */}
            <div className="space-y-2">
              <label className="text-sm font-medium">Describe your idea</label>
              <Textarea
                value={idea}
                onChange={(e) => setIdea(e.target.value)}
                placeholder="e.g. A practical guide to reducing API costs using caching strategies in Next.js apps…"
                rows={4}
                className="resize-none"
                disabled={loading}
              />
              <div className="flex flex-wrap gap-1.5">
                {IDEA_EXAMPLES.map((ex) => (
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

            {/* Draft preview */}
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
