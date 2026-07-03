import { useState } from "react";
import { useNavigate } from "@tanstack/react-router";
import { useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Loader2, Sparkles, CheckCircle2, ExternalLink, ImageIcon, FileText } from "lucide-react";

interface ContentOpportunity {
  id: string;
  title: string;
  type: string;
  topic: string | null;
  reason: string | null;
  priority: "high" | "medium" | "low";
}

interface GenerateBlogDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  opportunity: ContentOpportunity | null;
  workspaceId: string;
}

type Step =
  | { id: "idle" }
  | { id: "generating" }
  | { id: "done"; postId: string; postSlug: string; title: string; coverImage: string | null }
  | { id: "error"; message: string };

const STEPS_LABELS = [
  "Analysing content opportunity…",
  "Generating blog post structure…",
  "Writing all sections…",
  "Crafting image prompt…",
  "Fetching web image…",
  "Generating AI cover image…",
  "Saving to database…",
];

export function GenerateBlogDialog({
  open, onOpenChange, opportunity, workspaceId,
}: GenerateBlogDialogProps) {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const [step, setStep] = useState<Step>({ id: "idle" });
  const [stepIndex, setStepIndex] = useState(0);

  async function generate() {
    if (!opportunity) return;
    setStep({ id: "generating" });
    setStepIndex(0);

    // Animate through steps while waiting
    const interval = setInterval(() => {
      setStepIndex((prev) => Math.min(prev + 1, STEPS_LABELS.length - 1));
    }, 2800);

    try {
      const { data: { session } } = await supabase.auth.getSession();
      const authHeaders = session?.access_token ? { Authorization: `Bearer ${session.access_token}` } : {};
      const { data, error } = await supabase.functions.invoke("generate-blog-post", {
        body: {
          workspace_id: workspaceId,
          opportunity: {
            title:  opportunity.title,
            topic:  opportunity.topic,
            type:   opportunity.type,
            reason: opportunity.reason,
          },
        },
        headers: authHeaders,
      });

      clearInterval(interval);

      if (error) throw new Error(error.message);
      if (data?.error) throw new Error(data.error);

      setStep({
        id:         "done",
        postId:     data.post_id,
        postSlug:   data.post_slug,
        title:      data.title,
        coverImage: data.cover_image ?? null,
      });

      // Invalidate blog queries so lists refresh
      queryClient.invalidateQueries({ queryKey: ["admin", "blog_posts"] });
      queryClient.invalidateQueries({ queryKey: ["workspace-overview", workspaceId, "v3"] });
      toast.success("Blog post generated and saved as draft!");

    } catch (err) {
      clearInterval(interval);
      const msg = err instanceof Error ? err.message : "Generation failed";
      setStep({ id: "error", message: msg });
      toast.error(msg);
    }
  }

  function handleClose(open: boolean) {
    if (step.id === "generating") return; // prevent closing while generating
    if (!open) {
      setStep({ id: "idle" });
      setStepIndex(0);
    }
    onOpenChange(open);
  }

  function goToPost() {
    if (step.id !== "done") return;
    onOpenChange(false);
    setStep({ id: "idle" });
    navigate({ to: "/admin/blogs/$id", params: { id: step.postId } });
  }

  if (!opportunity) return null;

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Sparkles className="h-4 w-4 text-primary" />
            Generate Blog Post
          </DialogTitle>
        </DialogHeader>

        {/* Opportunity summary */}
        <div className="rounded-lg bg-muted/60 p-3 space-y-1">
          <p className="text-sm font-semibold line-clamp-2">{opportunity.title}</p>
          {opportunity.topic && (
            <p className="text-xs text-primary font-medium">{opportunity.type} · {opportunity.topic}</p>
          )}
          {opportunity.reason && (
            <p className="text-xs text-muted-foreground line-clamp-2">{opportunity.reason}</p>
          )}
        </div>

        {/* Idle state */}
        {step.id === "idle" && (
          <div className="space-y-4">
            <p className="text-sm text-muted-foreground">
              AI will generate a full blog post for this opportunity, including all sections, SEO metadata, and a cover image — saved as a draft ready for your review.
            </p>
            <div className="space-y-1.5 text-xs text-muted-foreground">
              {[
                { icon: FileText, text: "Full post with intro, 4-6 sections, conclusion" },
                { icon: ImageIcon, text: "Cover image: web search + AI-generated" },
                { icon: Sparkles, text: "SEO title, meta description, tags" },
              ].map(({ icon: Icon, text }) => (
                <div key={text} className="flex items-center gap-2">
                  <Icon className="h-3 w-3 shrink-0 text-primary" />
                  <span>{text}</span>
                </div>
              ))}
            </div>
            <div className="flex gap-2 pt-1">
              <Button variant="outline" onClick={() => handleClose(false)} className="flex-1">Cancel</Button>
              <Button onClick={generate} className="flex-1">
                <Sparkles className="mr-2 h-4 w-4" /> Generate Now
              </Button>
            </div>
          </div>
        )}

        {/* Generating state */}
        {step.id === "generating" && (
          <div className="space-y-4 py-2">
            <div className="flex items-center gap-3">
              <Loader2 className="h-5 w-5 animate-spin text-primary shrink-0" />
              <div className="min-w-0 flex-1">
                <p className="text-sm font-medium">{STEPS_LABELS[stepIndex]}</p>
                <p className="text-xs text-muted-foreground mt-0.5">This takes about 20-40 seconds…</p>
              </div>
            </div>
            {/* Progress dots */}
            <div className="flex gap-1.5">
              {STEPS_LABELS.map((_, i) => (
                <div
                  key={i}
                  className={`h-1 flex-1 rounded-full transition-colors duration-500 ${
                    i <= stepIndex ? "bg-primary" : "bg-muted"
                  }`}
                />
              ))}
            </div>
          </div>
        )}

        {/* Done state */}
        {step.id === "done" && (
          <div className="space-y-4">
            <div className="flex items-start gap-3">
              <CheckCircle2 className="h-5 w-5 text-emerald-500 mt-0.5 shrink-0" />
              <div>
                <p className="text-sm font-semibold">Post generated successfully!</p>
                <p className="text-xs text-muted-foreground mt-0.5">Saved as a draft — review and publish when ready.</p>
              </div>
            </div>
            {step.coverImage && (
              <img
                src={step.coverImage}
                alt="Generated cover"
                className="w-full aspect-video rounded-md object-cover border border-border"
                onError={(e) => { (e.target as HTMLImageElement).style.display = "none"; }}
              />
            )}
            <p className="text-sm font-medium line-clamp-2">"{step.title}"</p>
            <div className="flex gap-2">
              <Button variant="outline" onClick={() => handleClose(false)} className="flex-1">Close</Button>
              <Button onClick={goToPost} className="flex-1">
                <ExternalLink className="mr-2 h-4 w-4" /> Open Draft
              </Button>
            </div>
          </div>
        )}

        {/* Error state */}
        {step.id === "error" && (
          <div className="space-y-4">
            <div className="rounded-md bg-destructive/10 p-3">
              <p className="text-sm font-medium text-destructive">Generation failed</p>
              <p className="text-xs text-muted-foreground mt-1 line-clamp-3">{step.message}</p>
            </div>
            <div className="flex gap-2">
              <Button variant="outline" onClick={() => handleClose(false)} className="flex-1">Close</Button>
              <Button onClick={() => { setStep({ id: "idle" }); setStepIndex(0); }} className="flex-1">
                Try Again
              </Button>
            </div>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
