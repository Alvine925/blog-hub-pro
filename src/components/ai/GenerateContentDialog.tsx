import { useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import {
  Loader2, Sparkles, CheckCircle2, FileText, Newspaper, HelpCircle, Package, BookOpen, PenLine,
} from "lucide-react";

export type ContentType = "news" | "faqs" | "products" | "articles" | "blogs";

const CONFIG: Record<ContentType, {
  edgeFn: string;
  label: string;
  icon: React.ComponentType<{ className?: string }>;
  description: string;
  bullets: string[];
  invalidateKey: string;
}> = {
  news: {
    edgeFn:       "generate-news",
    label:        "News",
    icon:         Newspaper,
    description:  "AI will research real industry trends and write news articles for your workspace — saved as drafts ready for review.",
    bullets: [
      "Up to 10 news articles from real industry sources",
      "AI-written summaries with citations",
      "Category, excerpt and full content included",
    ],
    invalidateKey: "news",
  },
  faqs: {
    edgeFn:       "generate-faqs",
    label:        "FAQs",
    icon:         HelpCircle,
    description:  "AI will analyse your workspace's brand, services and audience to generate realistic FAQ question/answer pairs — saved as drafts.",
    bullets: [
      "Up to 10 Q&A pairs tailored to your business",
      "Categorised and ready to publish",
      "Derived from your site's content intelligence",
    ],
    invalidateKey: "faqs",
  },
  products: {
    edgeFn:       "generate-products",
    label:        "Products",
    icon:         Package,
    description:  "AI will analyse your workspace to generate realistic product catalog entries based on your industry and brand — saved as drafts.",
    bullets: [
      "Up to 10 product entries with descriptions",
      "Pricing, category and features included",
      "Tailored to your business context",
    ],
    invalidateKey: "products",
  },
  articles: {
    edgeFn:       "generate-articles",
    label:        "Articles",
    icon:         BookOpen,
    description:  "AI will write long-form guides, tutorials and case studies matched to your industry and audience — saved as drafts.",
    bullets: [
      "Up to 10 long-form articles (guides, tutorials, case studies)",
      "Full HTML content with headings and structure",
      "SEO title and meta description included",
    ],
    invalidateKey: "articles",
  },
  blogs: {
    edgeFn:       "generate-blog-post",
    label:        "Blog Posts",
    icon:         PenLine,
    description:  "AI will generate complete blog posts tailored to your workspace's brand, audience and industry — saved as drafts ready to edit.",
    bullets: [
      "Up to 10 blog posts with full rich-text content",
      "Category, excerpt, cover image prompt and SEO fields",
      "Matched to your brand voice and industry",
    ],
    invalidateKey: "blog_posts",
  },
};

const STEP_LABELS = [
  "Reading workspace intelligence…",
  "Analysing industry & brand voice…",
  "Generating content structure…",
  "Writing all items…",
  "Saving to database…",
];

interface GenerateContentDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  contentType: ContentType;
  workspaceId: string;
}

type Step =
  | { id: "idle" }
  | { id: "generating" }
  | { id: "done"; count: number }
  | { id: "error"; message: string };

export function GenerateContentDialog({
  open, onOpenChange, contentType, workspaceId,
}: GenerateContentDialogProps) {
  const queryClient = useQueryClient();
  const cfg = CONFIG[contentType];
  const Icon = cfg.icon;

  const [step, setStep] = useState<Step>({ id: "idle" });
  const [stepIndex, setStepIndex] = useState(0);

  async function generate() {
    setStep({ id: "generating" });
    setStepIndex(0);

    const interval = setInterval(() => {
      setStepIndex((prev) => Math.min(prev + 1, STEP_LABELS.length - 1));
    }, 3000);

    try {
      const { data: { session } } = await supabase.auth.getSession();
      const authHeaders = session?.access_token
        ? { Authorization: `Bearer ${session.access_token}` }
        : {};

      const { data, error } = await supabase.functions.invoke(cfg.edgeFn, {
        body: { workspace_id: workspaceId, count: 10, suggestion_count: 0 },
        headers: authHeaders,
      });

      clearInterval(interval);

      if (error) throw new Error(error.message);
      if (data?.error) throw new Error(data.error);

      const count = (data as { generated?: number })?.generated ?? 0;
      setStep({ id: "done", count });

      queryClient.invalidateQueries({ queryKey: ["admin", cfg.invalidateKey, workspaceId] });
      toast.success(`${count} ${cfg.label.toLowerCase()} generated and saved as drafts!`);
    } catch (err) {
      clearInterval(interval);
      const msg = err instanceof Error ? err.message : "Generation failed";
      setStep({ id: "error", message: msg });
      toast.error(msg);
    }
  }

  function handleClose(open: boolean) {
    if (step.id === "generating") return;
    if (!open) {
      setStep({ id: "idle" });
      setStepIndex(0);
    }
    onOpenChange(open);
  }

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Sparkles className="h-4 w-4 text-primary" />
            Generate {cfg.label} with AI
          </DialogTitle>
        </DialogHeader>

        {step.id === "idle" && (
          <div className="space-y-4">
            <div className="rounded-lg bg-muted/60 p-3 flex items-start gap-3">
              <Icon className="h-5 w-5 text-primary mt-0.5 shrink-0" />
              <p className="text-sm text-muted-foreground">{cfg.description}</p>
            </div>
            <div className="space-y-1.5 text-xs text-muted-foreground">
              {cfg.bullets.map((b) => (
                <div key={b} className="flex items-center gap-2">
                  <FileText className="h-3 w-3 shrink-0 text-primary" />
                  <span>{b}</span>
                </div>
              ))}
            </div>
            <div className="flex gap-2 pt-1">
              <Button variant="outline" onClick={() => handleClose(false)} className="flex-1">
                Cancel
              </Button>
              <Button onClick={generate} className="flex-1">
                <Sparkles className="mr-2 h-4 w-4" /> Generate Now
              </Button>
            </div>
          </div>
        )}

        {step.id === "generating" && (
          <div className="space-y-4 py-2">
            <div className="flex items-center gap-3">
              <Loader2 className="h-5 w-5 animate-spin text-primary shrink-0" />
              <div className="min-w-0 flex-1">
                <p className="text-sm font-medium">{STEP_LABELS[stepIndex]}</p>
                <p className="text-xs text-muted-foreground mt-0.5">This takes about 20–40 seconds…</p>
              </div>
            </div>
            <div className="flex gap-1.5">
              {STEP_LABELS.map((_, i) => (
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

        {step.id === "done" && (
          <div className="space-y-4">
            <div className="flex items-start gap-3">
              <CheckCircle2 className="h-5 w-5 text-emerald-500 mt-0.5 shrink-0" />
              <div>
                <p className="text-sm font-semibold">
                  {step.count} {cfg.label.toLowerCase()} generated!
                </p>
                <p className="text-xs text-muted-foreground mt-0.5">
                  Saved as drafts — review and publish when ready.
                </p>
              </div>
            </div>
            <Button onClick={() => handleClose(false)} className="w-full">
              Done
            </Button>
          </div>
        )}

        {step.id === "error" && (
          <div className="space-y-4">
            <div className="rounded-md bg-destructive/10 p-3">
              <p className="text-sm font-medium text-destructive">Generation failed</p>
              <p className="text-xs text-muted-foreground mt-1 line-clamp-3">{step.message}</p>
            </div>
            <div className="flex gap-2">
              <Button variant="outline" onClick={() => handleClose(false)} className="flex-1">
                Close
              </Button>
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
