import { createFileRoute } from "@tanstack/react-router";
import { createServerFn } from "@tanstack/react-start";
import { supabase } from "@/integrations/supabase/client";
import { queryOptions, useSuspenseQuery } from "@tanstack/react-query";
import { useState } from "react";
import { toast } from "sonner";
import {
  Sparkles, Copy, CheckCheck, Loader2, RotateCcw, FileText,
  Languages, AlignLeft, Search, HelpCircle, Tag, Layers,
  Image as ImageIcon, ChevronDown, Code2, Zap, BookOpen,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";
import { PromptBuilder, QuickActionButtons } from "@/components/ai/PromptBuilder";

interface AiGeneration {
  id: string;
  task: string;
  prompt: string;
  result: string | null;
  status: string;
  model: string;
  duration_ms: number | null;
  created_at: string;
}

const listGenerations = createServerFn({ method: "GET" }).handler(
  async (): Promise<AiGeneration[]> => {
    const { getAdminClient } = await import("@/lib/supabase.server");
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const supabase = (await getAdminClient()) as any;

    const { data: ws } = await supabase
      .from("workspaces").select("id").eq("slug", "default").single();
    const workspaceId: string | null = ws?.id ?? null;

    const query = supabase
      .from("ai_generations")
      .select("id, task, prompt, result, status, model, duration_ms, created_at")
      .eq("status", "completed")
      .order("created_at", { ascending: false })
      .limit(20);

    const { data, error } = workspaceId
      ? await query.eq("workspace_id", workspaceId)
      : await query.is("workspace_id", null);

    if (error) throw new Error(error.message);
    return (data ?? []) as AiGeneration[];
  },
);

const generationsQuery = queryOptions({
  queryKey: ["admin", "ai-generations"],
  queryFn: () => listGenerations(),
});

export const Route = createFileRoute("/admin/ai-assistant")({
  head: () => ({ meta: [{ title: "AI Assistant — Admin" }] }),
  loader: ({ context }) => context.queryClient.ensureQueryData(generationsQuery),
  component: AiAssistantPage,
});

type Task = {
  id: string;
  label: string;
  icon: React.ComponentType<{ className?: string }>;
  description: string;
  promptLabel: string;
  promptPlaceholder: string;
  hasOptions?: boolean;
};

const TASKS: Task[] = [
  {
    id: "generate_article",
    label: "Generate Article",
    icon: FileText,
    description: "Write a full blog article from a topic or brief",
    promptLabel: "Topic or brief",
    promptPlaceholder: "e.g. The benefits of serverless architecture for startups",
  },
  {
    id: "rewrite",
    label: "Rewrite",
    icon: RotateCcw,
    description: "Improve clarity, tone, or style of existing content",
    promptLabel: "Content to rewrite",
    promptPlaceholder: "Paste your existing content here…",
  },
  {
    id: "translate",
    label: "Translate",
    icon: Languages,
    description: "Translate content to another language",
    promptLabel: "Content to translate",
    promptPlaceholder: "Paste your content here…",
    hasOptions: true,
  },
  {
    id: "summarize",
    label: "Summarize",
    icon: AlignLeft,
    description: "Create a concise summary of long content",
    promptLabel: "Content to summarize",
    promptPlaceholder: "Paste the content you want summarized…",
  },
  {
    id: "generate_seo",
    label: "Generate SEO",
    icon: Search,
    description: "Generate meta title and description",
    promptLabel: "Article title or topic",
    promptPlaceholder: "e.g. Getting started with Supabase and React",
  },
  {
    id: "generate_faqs",
    label: "Generate FAQs",
    icon: HelpCircle,
    description: "Create FAQ questions and answers",
    promptLabel: "Topic or article",
    promptPlaceholder: "e.g. How to deploy a Next.js app to Vercel",
  },
  {
    id: "generate_tags",
    label: "Generate Tags",
    icon: Tag,
    description: "Suggest relevant content tags",
    promptLabel: "Article title or content",
    promptPlaceholder: "e.g. Introduction to TypeScript generics…",
  },
  {
    id: "generate_categories",
    label: "Generate Categories",
    icon: Layers,
    description: "Suggest content categories",
    promptLabel: "Article topic or content",
    promptPlaceholder: "e.g. Building a REST API with Node.js and Express…",
  },
  {
    id: "generate_image_prompt",
    label: "Image Prompt",
    icon: ImageIcon,
    description: "Create an AI image generation prompt",
    promptLabel: "Article or concept",
    promptPlaceholder: "e.g. A beginner's guide to machine learning",
  },
];

type TabId = "content" | "prompt-builder" | "quick-actions";

const TABS: { id: TabId; label: string; icon: React.ComponentType<{ className?: string }> }[] = [
  { id: "content",        label: "Content AI",     icon: Sparkles },
  { id: "prompt-builder", label: "Prompt Builder", icon: Code2     },
  { id: "quick-actions",  label: "Quick Actions",  icon: Zap       },
];

function TaskCard({ task, selected, onClick }: { task: Task; selected: boolean; onClick: () => void }) {
  const Icon = task.icon;
  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        "flex items-start gap-3 rounded-xl border p-4 text-left transition-all hover:border-primary/40",
        selected ? "border-primary bg-primary/5 shadow-sm" : "border-border bg-background",
      )}
    >
      <div className={cn(
        "mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-lg",
        selected ? "bg-primary text-primary-foreground" : "bg-muted text-muted-foreground",
      )}>
        <Icon className="h-4 w-4" />
      </div>
      <div className="min-w-0">
        <p className={cn("text-sm font-semibold", selected && "text-primary")}>{task.label}</p>
        <p className="mt-0.5 text-xs text-muted-foreground line-clamp-1">{task.description}</p>
      </div>
    </button>
  );
}

// ── Quick Actions tab ──────────────────────────────────────────────────────────

function QuickActionsTab() {
  const [selectedPrompt, setSelectedPrompt] = useState<{ text: string; label: string } | null>(null);
  const [copied, setCopied] = useState(false);

  function handleSelect(prompt: string, label: string) {
    setSelectedPrompt({ text: prompt, label });
    window.scrollTo({ top: 0, behavior: "smooth" });
  }

  function handleCopy() {
    if (!selectedPrompt) return;
    navigator.clipboard.writeText(selectedPrompt.text).then(() => {
      setCopied(true);
      toast.success("Prompt copied — paste it into your vibe coding tool!");
      setTimeout(() => setCopied(false), 2500);
    });
  }

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-base font-semibold">Quick action prompts</h2>
        <p className="text-sm text-muted-foreground mt-0.5">
          One click to generate a full, ready-to-paste prompt for your vibe coding tool.
        </p>
      </div>

      {selectedPrompt && (
        <div className="rounded-xl border border-primary/30 bg-primary/5 overflow-hidden">
          <div className="flex items-center justify-between px-4 py-3 border-b border-border">
            <div className="flex items-center gap-2">
              <BookOpen className="h-4 w-4 text-primary" />
              <span className="text-sm font-semibold text-primary">{selectedPrompt.label}</span>
            </div>
            <div className="flex gap-2">
              <Button size="sm" variant="outline" onClick={() => setSelectedPrompt(null)}>
                Clear
              </Button>
              <Button size="sm" onClick={handleCopy} className="gap-1.5">
                {copied
                  ? <><CheckCheck className="h-3.5 w-3.5 text-green-400" /> Copied!</>
                  : <><Copy className="h-3.5 w-3.5" /> Copy</>}
              </Button>
            </div>
          </div>
          <pre className="p-4 text-xs leading-relaxed whitespace-pre-wrap font-mono text-foreground max-h-80 overflow-y-auto">
            {selectedPrompt.text}
          </pre>
          <div className="px-4 py-3 border-t border-border bg-muted/20">
            <Button onClick={handleCopy} className="w-full gap-2">
              {copied
                ? <><CheckCheck className="h-4 w-4 text-green-400" /> Copied to clipboard!</>
                : <><Copy className="h-4 w-4" /> Copy full prompt</>}
            </Button>
          </div>
        </div>
      )}

      <QuickActionButtons onSelect={handleSelect} />

      <div className="rounded-xl border border-border/60 bg-muted/20 p-4 space-y-2">
        <p className="text-xs font-semibold">💡 How to use quick actions</p>
        <ul className="space-y-1 text-xs text-muted-foreground">
          <li>1. Click any card above to instantly generate the prompt</li>
          <li>2. Click <strong>Copy</strong> to copy the full prompt</li>
          <li>3. Paste into Bolt, Cursor, Replit, Lovable, or any AI coding tool</li>
          <li>4. The AI builds your site with Lunar CMS fully wired up</li>
        </ul>
      </div>
    </div>
  );
}

// ── Content AI tab ─────────────────────────────────────────────────────────────

function ContentAiTab({ history }: { history: AiGeneration[] }) {
  const [selectedTask, setSelectedTask] = useState<Task>(TASKS[0]);
  const [prompt, setPrompt] = useState("");
  const [targetLanguage, setTargetLanguage] = useState("Spanish");
  const [result, setResult] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [copied, setCopied] = useState(false);
  const [showHistory, setShowHistory] = useState(false);

  async function handleGenerate() {
    if (!prompt.trim()) {
      toast.error(`Enter ${selectedTask.promptLabel.toLowerCase()}`);
      return;
    }
    setIsLoading(true);
    setResult(null);

    let fullPrompt = prompt;
    if (selectedTask.id === "translate" && targetLanguage) {
      fullPrompt = `Translate the following to ${targetLanguage}:\n\n${prompt}`;
    }

    try {
      const { data, error } = await supabase.functions.invoke("ai-generate", {
        body: { task: selectedTask.id, prompt: fullPrompt },
      });
      if (error) throw new Error(error.message);
      if (data?.error) throw new Error(data.error);
      setResult(data.result ?? "");
      if (data.simulated) {
        toast.info("Showing simulated output — connect OpenAI to generate real content", { duration: 5000 });
      } else {
        toast.success("Content generated successfully");
      }
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Generation failed");
    } finally {
      setIsLoading(false);
    }
  }

  function handleCopy() {
    if (!result) return;
    navigator.clipboard.writeText(result).then(() => {
      setCopied(true);
      toast.success("Copied to clipboard");
      setTimeout(() => setCopied(false), 2000);
    });
  }

  const TASK_LABELS: Record<string, string> = Object.fromEntries(TASKS.map((t) => [t.id, t.label]));

  return (
    <div className="grid gap-8 lg:grid-cols-[1fr_380px]">
      {/* Left column */}
      <div className="space-y-6">
        {/* Task picker */}
        <div className="space-y-2">
          <Label className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
            Select task
          </Label>
          <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
            {TASKS.map((task) => (
              <TaskCard
                key={task.id}
                task={task}
                selected={selectedTask.id === task.id}
                onClick={() => { setSelectedTask(task); setResult(null); }}
              />
            ))}
          </div>
        </div>

        {/* Prompt */}
        <div className="space-y-2">
          <Label htmlFor="ai-prompt" className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
            {selectedTask.promptLabel}
          </Label>
          <Textarea
            id="ai-prompt"
            value={prompt}
            onChange={(e) => setPrompt(e.target.value)}
            placeholder={selectedTask.promptPlaceholder}
            rows={6}
            className="resize-none font-[inherit]"
          />
          {selectedTask.hasOptions && (
            <div className="flex items-center gap-2 mt-2">
              <Label htmlFor="target-lang" className="text-xs text-muted-foreground whitespace-nowrap">
                Target language
              </Label>
              <Input
                id="target-lang"
                value={targetLanguage}
                onChange={(e) => setTargetLanguage(e.target.value)}
                className="h-8 text-sm"
                placeholder="e.g. French, German, Japanese"
              />
            </div>
          )}
        </div>

        <Button
          onClick={handleGenerate}
          disabled={isLoading}
          className="gap-2"
          size="lg"
        >
          {isLoading
            ? <><Loader2 className="h-4 w-4 animate-spin" /> Generating…</>
            : <><Sparkles className="h-4 w-4" /> Generate</>}
        </Button>

        {/* Result */}
        {result !== null && (
          <div className="space-y-2 rounded-xl border border-border bg-muted/30 p-4">
            <div className="flex items-center justify-between">
              <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                Result
              </p>
              <Button size="sm" variant="ghost" onClick={handleCopy} className="gap-1.5 h-7 text-xs">
                {copied ? <CheckCheck className="h-3 w-3 text-green-500" /> : <Copy className="h-3 w-3" />}
                {copied ? "Copied" : "Copy"}
              </Button>
            </div>
            <pre className="whitespace-pre-wrap font-[inherit] text-sm leading-relaxed text-foreground">
              {result}
            </pre>
          </div>
        )}
      </div>

      {/* Right column — history */}
      <div className="space-y-4 lg:border-l lg:border-border lg:pl-8">
        <button
          type="button"
          className="flex w-full items-center justify-between text-xs font-semibold uppercase tracking-wide text-muted-foreground"
          onClick={() => setShowHistory((v) => !v)}
        >
          Recent generations
          <ChevronDown className={cn("h-3.5 w-3.5 transition-transform", showHistory && "rotate-180")} />
        </button>

        {(showHistory || history.length > 0) && (
          <>
            {history.length === 0 ? (
              <p className="text-xs text-muted-foreground">No generations yet.</p>
            ) : (
              <div className="space-y-2">
                {history.map((gen) => (
                  <button
                    key={gen.id}
                    type="button"
                    className="w-full rounded-lg border border-border p-3 text-left hover:bg-accent transition-colors"
                    onClick={() => {
                      setSelectedTask(TASKS.find((t) => t.id === gen.task) ?? TASKS[0]);
                      setPrompt(gen.prompt);
                      setResult(gen.result);
                    }}
                  >
                    <div className="flex items-center gap-2 mb-1">
                      <Badge variant="secondary" className="text-[10px] px-1.5">
                        {TASK_LABELS[gen.task] ?? gen.task}
                      </Badge>
                      {gen.duration_ms && (
                        <span className="text-[10px] text-muted-foreground">{gen.duration_ms}ms</span>
                      )}
                    </div>
                    <p className="text-xs text-muted-foreground line-clamp-2">{gen.prompt}</p>
                  </button>
                ))}
              </div>
            )}
          </>
        )}

        <div className="rounded-xl border border-border/60 bg-muted/20 p-4 space-y-2">
          <p className="text-xs font-semibold">Tips</p>
          <ul className="space-y-1.5 text-xs text-muted-foreground">
            <li>• Be specific — the more context you give, the better the output</li>
            <li>• For articles, specify tone and target audience</li>
            <li>• Generated content is saved to your generation history</li>
            <li>• Copy and paste results directly into the blog editor</li>
          </ul>
        </div>
      </div>
    </div>
  );
}

// ── Page ───────────────────────────────────────────────────────────────────────

function AiAssistantPage() {
  const { data: history } = useSuspenseQuery(generationsQuery);
  const [activeTab, setActiveTab] = useState<TabId>("content");

  return (
    <div className="space-y-8">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-bold">AI Assistant</h1>
        <p className="text-sm text-muted-foreground">
          Generate content, build integration prompts, and get your site live faster
        </p>
      </div>

      {/* Tab bar */}
      <div className="flex items-center gap-1 rounded-xl border border-border bg-muted/30 p-1 w-fit">
        {TABS.map(({ id, label, icon: Icon }) => (
          <button
            key={id}
            type="button"
            onClick={() => setActiveTab(id)}
            className={cn(
              "flex items-center gap-2 rounded-lg px-4 py-2 text-sm font-medium transition-all",
              activeTab === id
                ? "bg-background text-foreground shadow-sm"
                : "text-muted-foreground hover:text-foreground",
            )}
          >
            <Icon className="h-4 w-4" />
            {label}
          </button>
        ))}
      </div>

      {/* Tab content */}
      {activeTab === "content" && <ContentAiTab history={history} />}

      {activeTab === "prompt-builder" && (
        <div className="max-w-2xl">
          <div className="mb-6 space-y-1">
            <h2 className="text-base font-semibold">Build your integration prompt</h2>
            <p className="text-sm text-muted-foreground">
              Tell us what you're building and we'll generate a detailed, copy-paste prompt
              you can drop straight into Bolt, Cursor, Replit, Lovable, or any AI coding tool.
              The prompt covers API setup, code examples, error handling, and every content type you need.
            </p>
          </div>
          <PromptBuilder />
        </div>
      )}

      {activeTab === "quick-actions" && <QuickActionsTab />}
    </div>
  );
}
