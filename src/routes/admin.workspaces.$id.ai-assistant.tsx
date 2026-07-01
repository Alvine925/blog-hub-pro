import { createFileRoute } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { createServerFn } from "@tanstack/react-start";
import { useState } from "react";
import { toast } from "sonner";
import { Sparkles, Loader2, Copy, RotateCcw } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { supabase } from "@/integrations/supabase/client";

export const Route = createFileRoute("/admin/workspaces/$id/ai-assistant")({
  head: () => ({ meta: [{ title: "AI Assistant" }] }),
  component: WorkspaceAI,
});

const TASKS = [
  { key: "article",    label: "Generate Article",     prompt: "Write a complete blog article about: " },
  { key: "rewrite",    label: "Rewrite",               prompt: "Rewrite the following content to improve clarity and engagement:\n\n" },
  { key: "summarize",  label: "Summarize",             prompt: "Summarize the following content in 2-3 sentences:\n\n" },
  { key: "seo",        label: "Generate SEO Meta",     prompt: "Generate SEO title and meta description for an article about: " },
  { key: "faq",        label: "Generate FAQs",         prompt: "Generate 5 FAQ questions and answers about: " },
  { key: "categories", label: "Suggest Categories",    prompt: "Suggest 5 relevant blog categories for content about: " },
  { key: "tags",       label: "Suggest Tags",          prompt: "Suggest 10 relevant tags for an article about: " },
];

const generateContent = createServerFn({ method: "POST" })
  .validator((input: { prompt: string; accessToken: string }) => input)
  .handler(async ({ data }) => {
    const SUPABASE_URL = process.env.SUPABASE_URL ?? "";
    try {
      const resp = await fetch(`${SUPABASE_URL}/functions/v1/ai-generate`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "Authorization": `Bearer ${data.accessToken}`,
        },
        body: JSON.stringify({ prompt: data.prompt }),
      });
      if (!resp.ok) {
        const text = await resp.text();
        throw new Error(`AI service error: ${text}`);
      }
      const json = await resp.json();
      return { content: json.content ?? json.text ?? JSON.stringify(json) };
    } catch (err) {
      throw new Error(err instanceof Error ? err.message : "AI request failed");
    }
  });

function WorkspaceAI() {
  const [task, setTask] = useState(TASKS[0]);
  const [input, setInput] = useState("");
  const [output, setOutput] = useState("");
  const [loading, setLoading] = useState(false);
  const doGenerate = useServerFn(generateContent);

  async function handleGenerate() {
    if (!input.trim()) return;
    setLoading(true);
    setOutput("");
    try {
      const { data: { session } } = await supabase.auth.getSession();
      const token = session?.access_token ?? "";
      const result = await doGenerate({ data: { prompt: task.prompt + input.trim(), accessToken: token } });
      setOutput(result.content);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed");
    } finally { setLoading(false); }
  }

  function copyOutput() {
    navigator.clipboard.writeText(output);
    toast.success("Copied to clipboard");
  }

  return (
    <div className="min-h-full px-8 py-8">
      {/* Header */}
      <div className="mb-8">
        <h1 className="text-xl font-semibold">AI Assistant</h1>
        <p className="mt-0.5 text-sm text-muted-foreground">Generate and improve content using AI.</p>
      </div>

      <div className="grid gap-8 lg:grid-cols-[1fr_1fr]">
        {/* Input panel */}
        <div>
          {/* Task selector */}
          <div className="mb-5 border-b border-border pb-4">
            <p className="mb-2 text-[10px] font-semibold uppercase tracking-widest text-muted-foreground/60">Task</p>
            <div className="flex flex-wrap gap-1.5">
              {TASKS.map((t) => (
                <button
                  key={t.key}
                  type="button"
                  onClick={() => setTask(t)}
                  className={
                    task.key === t.key
                      ? "rounded px-2.5 py-1 text-xs font-medium bg-primary text-primary-foreground"
                      : "rounded px-2.5 py-1 text-xs font-medium border border-border text-muted-foreground hover:text-foreground hover:border-foreground/30 transition-colors"
                  }
                >
                  {t.label}
                </button>
              ))}
            </div>
          </div>

          {/* Prompt prefix hint */}
          <p className="mb-2 text-xs text-muted-foreground">
            <span className="font-medium text-foreground">Prompt:</span> {task.prompt}…
          </p>

          {/* Input */}
          <Textarea
            value={input}
            onChange={(e) => setInput(e.target.value)}
            placeholder="Enter your topic or content here…"
            rows={8}
            className="resize-none font-mono text-sm"
            onKeyDown={(e) => { if (e.key === "Enter" && (e.metaKey || e.ctrlKey)) handleGenerate(); }}
          />
          <p className="mt-1.5 text-[10px] text-muted-foreground">Cmd/Ctrl + Enter to generate</p>

          <div className="mt-3 flex gap-2">
            <Button onClick={handleGenerate} disabled={loading || !input.trim()}>
              {loading ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Sparkles className="mr-2 h-4 w-4" />}
              Generate
            </Button>
            <Button
              variant="ghost"
              onClick={() => { setInput(""); setOutput(""); }}
              disabled={loading}
            >
              <RotateCcw className="mr-2 h-4 w-4" /> Clear
            </Button>
          </div>
        </div>

        {/* Output panel */}
        <div>
          <div className="mb-3 flex items-center justify-between border-b border-border pb-3">
            <p className="text-[10px] font-semibold uppercase tracking-widest text-muted-foreground/60">Output</p>
            {output && (
              <button
                type="button"
                onClick={copyOutput}
                className="flex items-center gap-1 text-xs text-primary hover:underline"
              >
                <Copy className="h-3 w-3" /> Copy
              </button>
            )}
          </div>

          {loading && (
            <div className="flex items-center gap-2 py-8 text-sm text-muted-foreground">
              <Loader2 className="h-4 w-4 animate-spin" />
              Generating…
            </div>
          )}

          {!loading && output && (
            <div className="whitespace-pre-wrap text-sm leading-relaxed text-foreground">
              {output}
            </div>
          )}

          {!loading && !output && (
            <div className="py-12 text-center text-sm text-muted-foreground">
              Output will appear here
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
