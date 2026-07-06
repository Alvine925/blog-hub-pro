import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { createServerFn } from "@tanstack/react-start";
import { getRequest } from "@tanstack/react-start/server";
import { useState } from "react";
import { toast } from "sonner";
import {
  Sparkles, Loader2, Copy, RotateCcw, CheckCheck, ArrowRight,
  FileText, BookOpen, Newspaper, Package, HelpCircle, Wand2,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/admin/workspaces/$id/ai-assistant")({
  head: () => ({ meta: [{ title: "AI Assistant" }] }),
  component: WorkspaceAI,
});

// ── Types ─────────────────────────────────────────────────────────────────────

type ContentTarget = "blog" | "article" | "news" | "faq" | "product" | null;

interface Task {
  key:      string;
  label:    string;
  prompt:   string;
  hint:     string;
  pushTo:   ContentTarget;
  category: string;
}

// ── Tasks grouped by content type ─────────────────────────────────────────────

const TASKS: Task[] = [
  // ── Blog Posts ──────────────────────────────────────────────────────────────
  {
    key:      "blog-write",
    label:    "Write Blog Post",
    prompt:   "Write a complete, engaging blog post. Include an attention-grabbing intro, well-structured sections with subheadings, key takeaways, and a clear conclusion. Topic: ",
    hint:     "Enter a topic, headline, or brief description",
    pushTo:   "blog",
    category: "Blog Posts",
  },
  {
    key:      "blog-intro",
    label:    "Write Blog Intro",
    prompt:   "Write a compelling 2–3 paragraph introduction for a blog post about: ",
    hint:     "Enter your blog post topic or working title",
    pushTo:   "blog",
    category: "Blog Posts",
  },
  {
    key:      "blog-outline",
    label:    "Blog Outline",
    prompt:   "Create a detailed blog post outline with H2 and H3 subheadings, key points for each section, and a suggested call-to-action. Topic: ",
    hint:     "Enter your topic or working title",
    pushTo:   "blog",
    category: "Blog Posts",
  },
  {
    key:      "blog-seo",
    label:    "SEO Title & Meta",
    prompt:   "Generate 3 SEO-optimised title options (under 60 characters each) and a compelling meta description (under 155 characters) for a blog post about: ",
    hint:     "Enter your blog post topic",
    pushTo:   null,
    category: "Blog Posts",
  },
  {
    key:      "blog-conclusion",
    label:    "Blog Conclusion",
    prompt:   "Write a strong, memorable blog post conclusion that summarises the key points and includes a clear call-to-action. The blog post is about: ",
    hint:     "Describe the blog post or paste its main points",
    pushTo:   "blog",
    category: "Blog Posts",
  },

  // ── Articles ─────────────────────────────────────────────────────────────────
  {
    key:      "article-write",
    label:    "Write Article",
    prompt:   "Write a well-researched, in-depth article with clear structure. Use subheadings, include actionable insights, and cite best practices where relevant. Article topic: ",
    hint:     "Enter the article subject",
    pushTo:   "article",
    category: "Articles",
  },
  {
    key:      "article-how-to",
    label:    "How-To Guide",
    prompt:   "Write a step-by-step how-to guide that is easy to follow. Number each step clearly and add tips or warnings where relevant. What the guide covers: ",
    hint:     "Describe the task or process",
    pushTo:   "article",
    category: "Articles",
  },
  {
    key:      "article-case-study",
    label:    "Case Study",
    prompt:   "Write a structured case study including: Background, Challenge, Solution, Implementation steps, Results, and Key Takeaways. Subject: ",
    hint:     "Describe the business, product, or situation",
    pushTo:   "article",
    category: "Articles",
  },
  {
    key:      "article-educational",
    label:    "Educational Article",
    prompt:   "Write a clear, educational article that explains the following concept for a general audience. Use simple language, concrete examples, and a logical progression from basics to advanced. Topic: ",
    hint:     "Enter the concept or subject to explain",
    pushTo:   "article",
    category: "Articles",
  },

  // ── News ─────────────────────────────────────────────────────────────────────
  {
    key:      "news-write",
    label:    "Write News Item",
    prompt:   "Write a concise, informative news article. Include a punchy headline, a lead paragraph answering Who/What/When/Where/Why, and 2–3 supporting paragraphs with context. News topic: ",
    hint:     "Describe the news event or announcement",
    pushTo:   "news",
    category: "News",
  },
  {
    key:      "news-brief",
    label:    "News Brief",
    prompt:   "Write a short 2-paragraph news brief (100–150 words) summarising the following news or announcement: ",
    hint:     "Paste or describe the news",
    pushTo:   "news",
    category: "News",
  },
  {
    key:      "news-headlines",
    label:    "Headline Options",
    prompt:   "Write 5 engaging news headline options for the following story. Vary the style — some factual, some punchy, some question-based. Story: ",
    hint:     "Describe the news story or paste its key facts",
    pushTo:   null,
    category: "News",
  },

  // ── Products ─────────────────────────────────────────────────────────────────
  {
    key:      "product-desc",
    label:    "Product Description",
    prompt:   "Write a persuasive product description that highlights key features and benefits with a clear value proposition. Use bullet points for features and end with a compelling call-to-action. Product: ",
    hint:     "Describe the product, its features, and target audience",
    pushTo:   "product",
    category: "Products",
  },
  {
    key:      "product-faqs",
    label:    "Product FAQs",
    prompt:   "Generate 6 frequently asked questions and detailed answers for the following product: ",
    hint:     "Describe the product and its common use cases",
    pushTo:   "faq",
    category: "Products",
  },
  {
    key:      "product-features",
    label:    "Feature Highlights",
    prompt:   "Write a compelling feature highlights section for a product page. For each feature, write a short title and a 1–2 sentence benefit-focused description. Product: ",
    hint:     "Describe the product and list its key features",
    pushTo:   "product",
    category: "Products",
  },

  // ── FAQs ─────────────────────────────────────────────────────────────────────
  {
    key:      "faq-generate",
    label:    "Generate FAQs",
    prompt:   "Generate 8 frequently asked questions with clear, helpful answers about the following topic. Cover both beginner and intermediate questions: ",
    hint:     "Enter the subject or product name",
    pushTo:   "faq",
    category: "FAQs",
  },
  {
    key:      "faq-expand",
    label:    "Expand FAQ Answer",
    prompt:   "Rewrite and significantly expand the following FAQ answer to be more thorough, helpful, and easy to understand. Include examples where useful:\n\n",
    hint:     "Paste the existing FAQ question and answer",
    pushTo:   "faq",
    category: "FAQs",
  },

  // ── Content Tools ─────────────────────────────────────────────────────────────
  {
    key:      "tool-rewrite",
    label:    "Rewrite & Improve",
    prompt:   "Rewrite the following content to improve clarity, flow, and engagement. Keep the same core message but make it more compelling:\n\n",
    hint:     "Paste the content you want improved",
    pushTo:   null,
    category: "Content Tools",
  },
  {
    key:      "tool-summarize",
    label:    "Summarize",
    prompt:   "Write a clear, concise summary (3–5 sentences) of the following content:\n\n",
    hint:     "Paste the content to summarise",
    pushTo:   null,
    category: "Content Tools",
  },
  {
    key:      "tool-social",
    label:    "Social Media Captions",
    prompt:   "Write 3 social media captions for the following content — one for LinkedIn (professional tone), one for Twitter/X (concise, punchy), and one for Instagram (engaging, with hashtags):\n\n",
    hint:     "Paste or describe the content to promote",
    pushTo:   null,
    category: "Content Tools",
  },
  {
    key:      "tool-newsletter",
    label:    "Newsletter Intro",
    prompt:   "Write an engaging email newsletter introduction (150–200 words) that hooks readers and sets up the following content: ",
    hint:     "Describe the newsletter topic or paste the main content",
    pushTo:   null,
    category: "Content Tools",
  },
];

const CATEGORY_ORDER = ["Blog Posts", "Articles", "News", "Products", "FAQs", "Content Tools"];

const CATEGORY_ICON: Record<string, React.ComponentType<{ className?: string }>> = {
  "Blog Posts":    FileText,
  "Articles":      BookOpen,
  "News":          Newspaper,
  "Products":      Package,
  "FAQs":          HelpCircle,
  "Content Tools": Wand2,
};

const PUSH_CONFIG: Record<NonNullable<ContentTarget>, { label: string; className: string }> = {
  blog:    { label: "Open as Blog Post",   className: "bg-primary text-primary-foreground hover:bg-primary/90" },
  article: { label: "Open as Article",     className: "bg-blue-600 text-white hover:bg-blue-700" },
  news:    { label: "Open as News Item",   className: "bg-amber-600 text-white hover:bg-amber-700" },
  faq:     { label: "Open as FAQ",         className: "bg-violet-600 text-white hover:bg-violet-700" },
  product: { label: "Open as Product",     className: "bg-emerald-600 text-white hover:bg-emerald-700" },
};

// ── Server fn ─────────────────────────────────────────────────────────────────

const generateContent = createServerFn({ method: "POST" })
  .validator((input: { prompt: string }) => input)
  .handler(async ({ data }) => {
    const SUPABASE_URL = process.env.SUPABASE_URL ?? "";
    const request = getRequest();
    const authHeader = request?.headers?.get("authorization") ?? "";
    try {
      const resp = await fetch(`${SUPABASE_URL}/functions/v1/ai-generate`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          ...(authHeader ? { Authorization: authHeader } : {}),
        },
        body: JSON.stringify({ prompt: data.prompt }),
      });
      if (!resp.ok) {
        const text = await resp.text();
        throw new Error(`AI service error: ${text}`);
      }
      const json = await resp.json();
      return { content: json.result ?? json.content ?? json.text ?? JSON.stringify(json) };
    } catch (err) {
      throw new Error(err instanceof Error ? err.message : "AI request failed");
    }
  });

// ── Markdown renderer ─────────────────────────────────────────────────────────

function inlineFmt(text: string): React.ReactNode {
  // Split on **bold**, *italic*, `code`
  const parts = text.split(/(\*\*[^*]+\*\*|\*[^*]+\*|`[^`]+`)/g);
  return (
    <>
      {parts.map((part, i) => {
        if (/^\*\*[^*]+\*\*$/.test(part))
          return <strong key={i} className="font-semibold text-foreground">{part.slice(2, -2)}</strong>;
        if (/^\*[^*]+\*$/.test(part))
          return <em key={i}>{part.slice(1, -1)}</em>;
        if (/^`[^`]+`$/.test(part))
          return <code key={i} className="rounded bg-muted px-1 py-0.5 font-mono text-[11px]">{part.slice(1, -1)}</code>;
        return <span key={i}>{part}</span>;
      })}
    </>
  );
}

function RenderedMarkdown({ text }: { text: string }) {
  const nodes: React.ReactNode[] = [];
  const lines = text.split("\n");
  let i = 0;

  while (i < lines.length) {
    const line = lines[i];

    // Fenced code block
    if (line.startsWith("```")) {
      const lang = line.slice(3).trim();
      const codeLines: string[] = [];
      i++;
      while (i < lines.length && !lines[i].startsWith("```")) {
        codeLines.push(lines[i]);
        i++;
      }
      nodes.push(
        <div key={`code-${i}`} className="my-3 overflow-hidden rounded-lg border border-border">
          {lang && (
            <div className="border-b border-border bg-muted px-3 py-1.5 font-mono text-[10px] text-muted-foreground">
              {lang}
            </div>
          )}
          <pre className="overflow-x-auto bg-zinc-950 px-4 py-3 font-mono text-[11px] leading-5 text-zinc-100">
            <code>{codeLines.join("\n")}</code>
          </pre>
        </div>,
      );
      i++;
      continue;
    }

    // H3
    const h3 = line.match(/^###\s+(.+)/);
    if (h3) {
      nodes.push(<h3 key={i} className="mb-1 mt-4 text-sm font-semibold text-foreground">{inlineFmt(h3[1])}</h3>);
      i++; continue;
    }

    // H2
    const h2 = line.match(/^##\s+(.+)/);
    if (h2) {
      nodes.push(<h2 key={i} className="mb-1.5 mt-5 text-base font-semibold text-foreground">{inlineFmt(h2[1])}</h2>);
      i++; continue;
    }

    // H1
    const h1 = line.match(/^#\s+(.+)/);
    if (h1) {
      nodes.push(<h1 key={i} className="mb-2 mt-6 text-lg font-bold text-foreground">{inlineFmt(h1[1])}</h1>);
      i++; continue;
    }

    // Unordered list
    if (/^[-*•]\s/.test(line)) {
      const items: string[] = [];
      while (i < lines.length && /^[-*•]\s/.test(lines[i])) {
        items.push(lines[i].replace(/^[-*•]\s/, ""));
        i++;
      }
      nodes.push(
        <ul key={`ul-${i}`} className="my-2 space-y-1.5 pl-5">
          {items.map((it, j) => (
            <li key={j} className="list-disc text-sm text-foreground/90">{inlineFmt(it)}</li>
          ))}
        </ul>,
      );
      continue;
    }

    // Ordered list
    if (/^\d+\.\s/.test(line)) {
      const items: string[] = [];
      while (i < lines.length && /^\d+\.\s/.test(lines[i])) {
        items.push(lines[i].replace(/^\d+\.\s/, ""));
        i++;
      }
      nodes.push(
        <ol key={`ol-${i}`} className="my-2 space-y-1.5 pl-5">
          {items.map((it, j) => (
            <li key={j} className="list-decimal text-sm text-foreground/90">{inlineFmt(it)}</li>
          ))}
        </ol>,
      );
      continue;
    }

    // Horizontal rule
    if (/^[-_*]{3,}$/.test(line.trim())) {
      nodes.push(<hr key={i} className="my-4 border-border" />);
      i++; continue;
    }

    // Empty line — small spacer
    if (!line.trim()) {
      nodes.push(<div key={`sp-${i}`} className="h-2" />);
      i++; continue;
    }

    // Regular paragraph
    nodes.push(
      <p key={i} className="text-sm leading-relaxed text-foreground/90">{inlineFmt(line)}</p>,
    );
    i++;
  }

  return <div className="space-y-0.5">{nodes}</div>;
}

// ── Component ─────────────────────────────────────────────────────────────────

function WorkspaceAI() {
  const { id: workspaceId } = Route.useParams();
  const navigate  = useNavigate();
  const [task,    setTask]    = useState<Task>(TASKS[0]);
  const [input,   setInput]   = useState("");
  const [output,  setOutput]  = useState("");
  const [loading, setLoading] = useState(false);
  const [copied,  setCopied]  = useState(false);
  const doGenerate = useServerFn(generateContent);

  async function handleGenerate() {
    if (!input.trim()) return;
    setLoading(true);
    setOutput("");
    try {
      const result = await doGenerate({ data: { prompt: task.prompt + input.trim() } });
      setOutput(result.content);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to generate");
    } finally {
      setLoading(false);
    }
  }

  function copyOutput() {
    navigator.clipboard.writeText(output);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
    toast.success("Copied to clipboard");
  }

  function pushToSection(target: NonNullable<ContentTarget>) {
    // Extract a clean title: first non-empty line, stripped of markdown heading markers
    const firstLine = output
      .split("\n")
      .find((l) => l.trim())
      ?.replace(/^#+\s*/, "")
      .trim() ?? "";
    const title = firstLine.length > 0 && firstLine.length < 160
      ? firstLine
      : input.split("\n")[0]?.trim() ?? "";

    const prefill = { type: target, title, content: output };
    try { sessionStorage.setItem("ai_prefill", JSON.stringify(prefill)); } catch {}

    const routes: Record<NonNullable<ContentTarget>, string> = {
      blog:    `/admin/workspaces/${workspaceId}/blogs/new`,
      article: `/admin/workspaces/${workspaceId}/articles/new`,
      news:    `/admin/workspaces/${workspaceId}/news/new`,
      faq:     `/admin/workspaces/${workspaceId}/faqs/new`,
      product: `/admin/workspaces/${workspaceId}/products/new`,
    };
    navigate({ to: routes[target] });
  }

  function selectTask(t: Task) {
    setTask(t);
    setOutput("");
    setInput("");
  }

  const grouped = CATEGORY_ORDER.map((cat) => ({
    cat,
    tasks: TASKS.filter((t) => t.category === cat),
  }));

  return (
    <div className="min-h-full px-4 py-4 sm:px-8 sm:py-8">
      {/* Header */}
      <div className="mb-6">
        <h1 className="text-xl font-semibold">AI Assistant</h1>
        <p className="mt-0.5 text-sm text-muted-foreground">
          Generate content for your blog posts, articles, news, products, and FAQs — then push it straight to the right section.
        </p>
      </div>

      <div className="grid gap-8 lg:grid-cols-[340px_1fr]">

        {/* ── Left: task picker + input ── */}
        <div className="space-y-6">

          {/* Task groups */}
          <div className="space-y-4">
            {grouped.map(({ cat, tasks }) => {
              const Icon = CATEGORY_ICON[cat];
              return (
                <div key={cat}>
                  <p className="mb-2 flex items-center gap-1.5 text-[10px] font-semibold uppercase tracking-widest text-muted-foreground/60">
                    <Icon className="h-3 w-3" />
                    {cat}
                  </p>
                  <div className="flex flex-wrap gap-1.5">
                    {tasks.map((t) => (
                      <button
                        key={t.key}
                        type="button"
                        onClick={() => selectTask(t)}
                        className={cn(
                          "rounded-full px-3 py-1 text-xs font-medium transition-colors",
                          task.key === t.key
                            ? "bg-primary text-primary-foreground shadow-sm"
                            : "border border-border text-muted-foreground hover:border-foreground/30 hover:text-foreground",
                        )}
                      >
                        {t.label}
                      </button>
                    ))}
                  </div>
                </div>
              );
            })}
          </div>

          {/* Input area */}
          <div className="rounded-xl border border-border bg-muted/20 p-4 space-y-3">
            <p className="text-xs text-muted-foreground">
              <span className="font-semibold text-foreground">{task.label}</span>
              <span className="mx-1 text-muted-foreground/50">—</span>
              {task.hint}
            </p>
            <Textarea
              value={input}
              onChange={(e) => setInput(e.target.value)}
              placeholder={`${task.hint}…`}
              rows={6}
              className="resize-none bg-background text-sm"
              onKeyDown={(e) => {
                if (e.key === "Enter" && (e.metaKey || e.ctrlKey)) handleGenerate();
              }}
            />
            <div className="flex items-center gap-2">
              <Button onClick={handleGenerate} disabled={loading || !input.trim()} className="gap-2">
                {loading
                  ? <Loader2 className="h-4 w-4 animate-spin" />
                  : <Sparkles className="h-4 w-4" />}
                Generate
              </Button>
              <Button
                variant="ghost"
                onClick={() => { setInput(""); setOutput(""); }}
                disabled={loading}
                className="gap-2"
              >
                <RotateCcw className="h-4 w-4" /> Clear
              </Button>
            </div>
            <p className="text-[10px] text-muted-foreground/50">Cmd/Ctrl + Enter to generate</p>
          </div>
        </div>

        {/* ── Right: output ── */}
        <div className="flex flex-col gap-4">

          {/* Output header */}
          <div className="flex items-center justify-between border-b border-border pb-3">
            <p className="text-[10px] font-semibold uppercase tracking-widest text-muted-foreground/60">Output</p>
            {output && (
              <button
                type="button"
                onClick={copyOutput}
                className="flex items-center gap-1 text-xs text-primary hover:underline"
              >
                {copied
                  ? <><CheckCheck className="h-3 w-3 text-emerald-500" /> Copied!</>
                  : <><Copy className="h-3 w-3" /> Copy</>}
              </button>
            )}
          </div>

          {/* Loading */}
          {loading && (
            <div className="flex items-center gap-2 py-16 text-sm text-muted-foreground">
              <Loader2 className="h-4 w-4 animate-spin" />
              Generating…
            </div>
          )}

          {/* Content */}
          {!loading && output && (
            <>
              <div className="max-h-[62vh] overflow-y-auto rounded-xl border border-border bg-background px-5 py-5">
                <RenderedMarkdown text={output} />
              </div>

              {/* Push-to bar */}
              <div className="flex flex-wrap items-center gap-2 rounded-lg border border-border bg-muted/30 px-4 py-3">
                <span className="shrink-0 text-xs font-medium text-muted-foreground">Send to:</span>
                {task.pushTo && (
                  <button
                    type="button"
                    onClick={() => pushToSection(task.pushTo!)}
                    className={cn(
                      "flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-sm font-medium transition-colors",
                      PUSH_CONFIG[task.pushTo].className,
                    )}
                  >
                    {PUSH_CONFIG[task.pushTo].label}
                    <ArrowRight className="h-3.5 w-3.5" />
                  </button>
                )}
                <button
                  type="button"
                  onClick={copyOutput}
                  className="flex items-center gap-1.5 rounded-lg border border-border bg-background px-3 py-1.5 text-sm font-medium text-muted-foreground hover:bg-muted transition-colors"
                >
                  {copied
                    ? <><CheckCheck className="h-3.5 w-3.5 text-emerald-500" /> Copied</>
                    : <><Copy className="h-3.5 w-3.5" /> Copy text</>}
                </button>
              </div>
            </>
          )}

          {/* Empty state */}
          {!loading && !output && (
            <div className="flex flex-col items-center justify-center py-24 text-center">
              <div className="mb-4 flex h-14 w-14 items-center justify-center rounded-2xl bg-muted">
                <Sparkles className="h-6 w-6 text-muted-foreground/40" />
              </div>
              <p className="text-sm font-medium text-muted-foreground">Select a task and enter your topic</p>
              <p className="mt-1 text-xs text-muted-foreground/60">
                Generated content will appear here, formatted and ready to use
              </p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
