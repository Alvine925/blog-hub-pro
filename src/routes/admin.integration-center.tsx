import { createFileRoute } from "@tanstack/react-router";
import { useState, useCallback } from "react";
import { toast } from "sonner";
import {
  Plug, ChevronRight, ChevronLeft, Check, Copy, Download,
  Sparkles, RefreshCw, FileText, Code2, Edit2, X,
} from "lucide-react";
import { cn } from "@/lib/utils";
import {
  FRAMEWORKS, AI_PLATFORMS, CONTENT_TYPES,
  RENDER_STRATEGIES, STYLING_OPTIONS,
} from "@/lib/prompt-templates";
import {
  generatePrompt, type GeneratorSelections, type GeneratedOutput,
} from "@/lib/PromptGeneratorService";

// ── Route ──────────────────────────────────────────────────────────────────────

export const Route = createFileRoute("/admin/integration-center")({
  head: () => ({ meta: [{ title: "Integration Center — Lunar CMS" }] }),
  component: IntegrationCenter,
});

// ── Dynamic API base URL ───────────────────────────────────────────────────────
// The Lunar CMS REST API is served via Supabase Edge Functions.
// We derive the URL from the Supabase project URL (same host, functions path).
// Users can override this in the UI if they use a custom domain.

function getDefaultApiUrl(): string {
  const supabaseUrl =
    (typeof import.meta !== "undefined" && (import.meta.env?.VITE_SUPABASE_URL as string | undefined)) ??
    "";
  if (supabaseUrl) {
    return `${supabaseUrl.replace(/\/$/, "")}/functions/v1/content-router`;
  }
  // Fallback: leave blank so user is prompted to enter it
  return "";
}

// ── Constants ─────────────────────────────────────────────────────────────────

const STEPS = [
  { id: 1, label: "Framework"   },
  { id: 2, label: "AI Platform" },
  { id: 3, label: "Content"     },
  { id: 4, label: "Rendering"   },
  { id: 5, label: "Styling"     },
  { id: 6, label: "Generate"    },
];

// ── Stepper ───────────────────────────────────────────────────────────────────

function Stepper({ current }: { current: number }) {
  return (
    <div className="flex items-center gap-0">
      {STEPS.map((step, i) => (
        <div key={step.id} className="flex items-center">
          <div className="flex flex-col items-center gap-1">
            <div
              className={cn(
                "flex h-7 w-7 items-center justify-center rounded-full text-xs font-bold transition-all",
                current > step.id
                  ? "bg-primary text-white"
                  : current === step.id
                  ? "bg-primary text-white ring-4 ring-primary/20"
                  : "bg-muted text-muted-foreground",
              )}
            >
              {current > step.id ? <Check className="h-3.5 w-3.5" /> : step.id}
            </div>
            <span
              className={cn(
                "text-[10px] font-medium whitespace-nowrap",
                current >= step.id ? "text-foreground" : "text-muted-foreground",
              )}
            >
              {step.label}
            </span>
          </div>
          {i < STEPS.length - 1 && (
            <div
              className={cn(
                "mb-4 mx-1 h-px w-10 transition-colors",
                current > step.id ? "bg-primary" : "bg-border",
              )}
            />
          )}
        </div>
      ))}
    </div>
  );
}

// ── API URL Banner ─────────────────────────────────────────────────────────────

function ApiUrlBanner({
  apiUrl,
  onChange,
}: {
  apiUrl: string;
  onChange: (url: string) => void;
}) {
  const [editing, setEditing] = useState(false);
  const [draft, setDraft]     = useState(apiUrl);

  function save() {
    const trimmed = draft.trim();
    if (!trimmed) {
      toast.error("API URL cannot be empty");
      return;
    }
    onChange(trimmed);
    setEditing(false);
    toast.success("API URL updated");
  }

  function cancel() {
    setDraft(apiUrl);
    setEditing(false);
  }

  return (
    <div className="flex items-center gap-3 rounded-xl border border-border bg-muted/30 px-4 py-3">
      <div className="flex h-7 w-7 shrink-0 items-center justify-center rounded-lg bg-primary/10">
        <Plug className="h-3.5 w-3.5 text-primary" />
      </div>

      <div className="min-w-0 flex-1">
        <p className="text-[10px] font-semibold uppercase tracking-widest text-muted-foreground/60">
          Lunar CMS API Endpoint
        </p>
        {editing ? (
          <div className="mt-1 flex items-center gap-2">
            <input
              type="url"
              value={draft}
              onChange={(e) => setDraft(e.target.value)}
              onKeyDown={(e) => { if (e.key === "Enter") save(); if (e.key === "Escape") cancel(); }}
              className="flex-1 rounded-lg border border-border bg-white px-3 py-1.5 text-xs font-mono outline-none focus:ring-2 focus:ring-primary/30"
              placeholder="https://your-project.supabase.co/functions/v1/content-router"
              autoFocus
            />
            <button
              type="button"
              onClick={save}
              className="rounded-lg bg-primary px-3 py-1.5 text-xs font-semibold text-white hover:bg-primary/90"
            >
              Save
            </button>
            <button
              type="button"
              onClick={cancel}
              className="rounded-lg border border-border bg-white p-1.5 text-muted-foreground hover:text-foreground"
            >
              <X className="h-3.5 w-3.5" />
            </button>
          </div>
        ) : (
          <div className="mt-0.5 flex items-center gap-2">
            <code className="truncate text-xs text-foreground font-mono">
              {apiUrl || <span className="text-amber-600 font-medium">⚠ No URL set — click Edit to configure</span>}
            </code>
            <button
              type="button"
              onClick={() => { setDraft(apiUrl); setEditing(true); }}
              className="shrink-0 flex items-center gap-1 rounded-md px-2 py-0.5 text-[10px] font-medium text-muted-foreground hover:bg-muted hover:text-foreground transition-colors"
            >
              <Edit2 className="h-3 w-3" /> Edit
            </button>
          </div>
        )}
      </div>
    </div>
  );
}

// ── Step 1 — Framework ────────────────────────────────────────────────────────

function StepFramework({
  selected, onSelect,
}: { selected: string; onSelect: (id: string) => void }) {
  const categories = ["fullstack", "frontend", "backend", "mobile", "cms"] as const;
  const catLabels: Record<string, string> = {
    fullstack: "Full-Stack", frontend: "Frontend", backend: "Backend", mobile: "Mobile", cms: "CMS",
  };

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-lg font-semibold">Choose your framework</h2>
        <p className="mt-1 text-sm text-muted-foreground">
          Select the framework of the external website you want to integrate with.
        </p>
      </div>
      {categories.map((cat) => {
        const items = FRAMEWORKS.filter((f) => f.category === cat);
        if (!items.length) return null;
        return (
          <div key={cat} className="space-y-2">
            <p className="text-[11px] font-semibold uppercase tracking-widest text-muted-foreground">
              {catLabels[cat]}
            </p>
            <div className="grid grid-cols-2 gap-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5">
              {items.map((fw) => (
                <button
                  key={fw.id}
                  type="button"
                  onClick={() => onSelect(fw.id)}
                  className={cn(
                    "flex flex-col items-center gap-2 rounded-xl border p-4 text-center transition-all hover:border-primary/40 hover:bg-primary/5",
                    selected === fw.id
                      ? "border-primary bg-primary/5 ring-2 ring-primary/20"
                      : "border-border bg-white",
                  )}
                >
                  <span className="text-2xl leading-none">{fw.icon}</span>
                  <span className="text-xs font-medium leading-tight">{fw.label}</span>
                  {selected === fw.id && <Check className="h-3.5 w-3.5 text-primary" />}
                </button>
              ))}
            </div>
          </div>
        );
      })}
    </div>
  );
}

// ── Step 2 — AI Platform ──────────────────────────────────────────────────────

function StepAiPlatform({
  selected, onSelect,
}: { selected: string; onSelect: (id: string) => void }) {
  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-lg font-semibold">Choose your AI coding platform</h2>
        <p className="mt-1 text-sm text-muted-foreground">
          The prompt will be fully tailored for this platform's agent workflow.
        </p>
      </div>
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 md:grid-cols-4">
        {AI_PLATFORMS.map((pl) => (
          <button
            key={pl.id}
            type="button"
            onClick={() => onSelect(pl.id)}
            className={cn(
              "flex flex-col items-start gap-2 rounded-xl border p-4 text-left transition-all hover:border-primary/40 hover:bg-primary/5",
              selected === pl.id
                ? "border-primary bg-primary/5 ring-2 ring-primary/20"
                : "border-border bg-white",
            )}
          >
            <div className="flex w-full items-center justify-between">
              <span className="text-xl">{pl.icon}</span>
              {selected === pl.id && <Check className="h-3.5 w-3.5 text-primary" />}
            </div>
            <div>
              <p className="text-sm font-semibold">{pl.label}</p>
              <p className="mt-0.5 text-[11px] text-muted-foreground">{pl.description}</p>
            </div>
          </button>
        ))}
      </div>
    </div>
  );
}

// ── Step 3 — Content Types ────────────────────────────────────────────────────

function StepContent({
  selected, onToggle,
}: { selected: string[]; onToggle: (id: string) => void }) {
  const everything = selected.includes("everything");

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-lg font-semibold">Select content to integrate</h2>
        <p className="mt-1 text-sm text-muted-foreground">
          Choose which content types the prompt should cover. Select multiple.
        </p>
      </div>

      <button
        type="button"
        onClick={() => onToggle("everything")}
        className={cn(
          "flex w-full items-center gap-3 rounded-xl border p-4 text-left transition-all hover:border-primary/40",
          everything ? "border-primary bg-primary/5 ring-2 ring-primary/20" : "border-border bg-white",
        )}
      >
        <div className={cn(
          "flex h-5 w-5 shrink-0 items-center justify-center rounded border transition-colors",
          everything ? "border-primary bg-primary" : "border-border",
        )}>
          {everything && <Check className="h-3 w-3 text-white" />}
        </div>
        <div>
          <p className="text-sm font-semibold">Everything</p>
          <p className="text-xs text-muted-foreground">Include all available content types</p>
        </div>
      </button>

      <div className="relative">
        <div className="absolute inset-x-0 top-1/2 -translate-y-1/2 border-t border-border" />
        <p className="relative z-10 mx-auto w-fit bg-white px-3 text-xs text-muted-foreground">
          or pick individual types
        </p>
      </div>

      <div className="grid grid-cols-1 gap-2 sm:grid-cols-2 md:grid-cols-3">
        {CONTENT_TYPES.map((ct) => {
          const isSelected = selected.includes(ct.id) && !everything;
          const disabled   = everything;
          return (
            <button
              key={ct.id}
              type="button"
              onClick={() => !disabled && onToggle(ct.id)}
              disabled={disabled}
              className={cn(
                "flex items-start gap-3 rounded-xl border p-4 text-left transition-all",
                disabled
                  ? "border-border bg-muted/30 opacity-50 cursor-not-allowed"
                  : isSelected
                  ? "border-primary bg-primary/5 ring-2 ring-primary/20 hover:border-primary"
                  : "border-border bg-white hover:border-primary/40 hover:bg-primary/5",
              )}
            >
              <div className={cn(
                "mt-0.5 flex h-4 w-4 shrink-0 items-center justify-center rounded border transition-colors",
                isSelected ? "border-primary bg-primary" : "border-border",
              )}>
                {isSelected && <Check className="h-2.5 w-2.5 text-white" />}
              </div>
              <div className="min-w-0">
                <p className="text-sm font-medium">{ct.label}</p>
                <p className="mt-0.5 text-[11px] text-muted-foreground leading-tight">{ct.description}</p>
                <code className="mt-1 block text-[10px] text-muted-foreground/70">{ct.endpoint}</code>
              </div>
            </button>
          );
        })}
      </div>
    </div>
  );
}

// ── Step 4 — Rendering Strategy ───────────────────────────────────────────────

function StepRendering({
  selected, onSelect, frameworkId,
}: { selected: string; onSelect: (id: string) => void; frameworkId: string }) {
  const framework = FRAMEWORKS.find((f) => f.id === frameworkId);

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-lg font-semibold">Choose a rendering strategy</h2>
        <p className="mt-1 text-sm text-muted-foreground">
          Determines when and where your content is fetched. The prompt adapts to your choice.
        </p>
      </div>
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
        {RENDER_STRATEGIES.map((rs) => {
          const unavailable =
            (rs.id === "isr" && framework && !framework.supportsISR) ||
            (rs.id === "ssr" && framework && !framework.supportsSSR);

          return (
            <button
              key={rs.id}
              type="button"
              onClick={() => !unavailable && onSelect(rs.id)}
              disabled={unavailable}
              className={cn(
                "flex flex-col items-start gap-2 rounded-xl border p-5 text-left transition-all",
                unavailable
                  ? "border-border bg-muted/30 opacity-40 cursor-not-allowed"
                  : selected === rs.id
                  ? "border-primary bg-primary/5 ring-2 ring-primary/20"
                  : "border-border bg-white hover:border-primary/40 hover:bg-primary/5",
              )}
            >
              <div className="flex w-full items-center justify-between">
                <span className="rounded-md bg-muted px-2 py-0.5 text-xs font-bold tracking-wide">
                  {rs.label}
                </span>
                {selected === rs.id && !unavailable && <Check className="h-4 w-4 text-primary" />}
                {unavailable && <span className="text-[10px] text-muted-foreground">Not supported</span>}
              </div>
              <p className="text-sm font-medium">{rs.badge}</p>
              <p className="text-xs text-muted-foreground leading-relaxed">{rs.description}</p>
            </button>
          );
        })}
      </div>
    </div>
  );
}

// ── Step 5 — Styling ──────────────────────────────────────────────────────────

function StepStyling({
  selected, onSelect,
}: { selected: string; onSelect: (id: string) => void }) {
  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-lg font-semibold">Choose a styling approach</h2>
        <p className="mt-1 text-sm text-muted-foreground">
          The generated prompt will instruct the AI to use this styling system.
        </p>
      </div>
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 md:grid-cols-3">
        {STYLING_OPTIONS.map((so) => (
          <button
            key={so.id}
            type="button"
            onClick={() => onSelect(so.id)}
            className={cn(
              "flex flex-col items-start gap-2 rounded-xl border p-5 text-left transition-all hover:border-primary/40 hover:bg-primary/5",
              selected === so.id
                ? "border-primary bg-primary/5 ring-2 ring-primary/20"
                : "border-border bg-white",
            )}
          >
            <div className="flex w-full items-center justify-between">
              <span className="text-sm font-semibold">{so.label}</span>
              {selected === so.id && <Check className="h-4 w-4 text-primary" />}
            </div>
            <p className="text-xs text-muted-foreground">{so.description}</p>
          </button>
        ))}
      </div>
    </div>
  );
}

// ── Step 6 — Generated Output ─────────────────────────────────────────────────

type Tab = "prompt" | "docs";

function StepGenerate({
  output, onRegenerate,
}: { output: GeneratedOutput; onRegenerate: () => void }) {
  const [tab,    setTab]    = useState<Tab>("prompt");
  const [copied, setCopied] = useState(false);

  const content = tab === "prompt" ? output.prompt : output.documentation;

  function copy() {
    navigator.clipboard.writeText(content).then(() => {
      setCopied(true);
      toast.success("Copied to clipboard");
      setTimeout(() => setCopied(false), 2000);
    });
  }

  function download(ext: "md" | "txt") {
    const blob = new Blob([content], { type: "text/plain" });
    const url  = URL.createObjectURL(blob);
    const a    = document.createElement("a");
    const fw   = output.selections.framework.toLowerCase().replace(/[^a-z0-9]/g, "-");
    const pl   = output.selections.aiPlatform.toLowerCase().replace(/[^a-z0-9]/g, "-");
    a.href     = url;
    a.download = `lunar-cms-${fw}-${pl}-integration.${ext}`;
    a.click();
    URL.revokeObjectURL(url);
    toast.success(`Downloaded as .${ext}`);
  }

  return (
    <div className="space-y-5">
      <div className="flex flex-col gap-1 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <h2 className="text-lg font-semibold">Your integration prompt is ready</h2>
          <p className="mt-0.5 text-sm text-muted-foreground">
            Copy it into {output.selections.aiPlatform} and let the AI handle the rest.
          </p>
        </div>
        <button
          type="button"
          onClick={onRegenerate}
          className="flex shrink-0 items-center gap-2 rounded-lg border border-border bg-white px-3 py-2 text-xs font-medium text-muted-foreground hover:border-primary/40 hover:text-foreground transition-colors"
        >
          <RefreshCw className="h-3.5 w-3.5" /> Start over
        </button>
      </div>

      {/* Summary pills */}
      <div className="flex flex-wrap gap-2">
        {[
          output.selections.framework,
          output.selections.aiPlatform,
          output.selections.renderStrategy,
          output.selections.styling,
        ].map((v) => (
          <span
            key={v}
            className="rounded-full border border-border bg-muted/50 px-2.5 py-0.5 text-[11px] font-medium text-muted-foreground"
          >
            {v}
          </span>
        ))}
        <span className="rounded-full border border-primary/30 bg-primary/5 px-2.5 py-0.5 text-[11px] font-medium text-primary">
          {output.template_version}
        </span>
      </div>

      {/* Tabs */}
      <div className="flex items-center gap-1 rounded-lg border border-border bg-muted/30 p-1 w-fit">
        {(["prompt", "docs"] as Tab[]).map((t) => (
          <button
            key={t}
            type="button"
            onClick={() => setTab(t)}
            className={cn(
              "flex items-center gap-1.5 rounded-md px-3 py-1.5 text-xs font-medium transition-all",
              tab === t
                ? "bg-white shadow-sm text-foreground"
                : "text-muted-foreground hover:text-foreground",
            )}
          >
            {t === "prompt" ? <Sparkles className="h-3 w-3" /> : <FileText className="h-3 w-3" />}
            {t === "prompt" ? "Implementation Prompt" : "Documentation"}
          </button>
        ))}
      </div>

      {/* Actions */}
      <div className="flex items-center gap-2 flex-wrap">
        <button
          type="button"
          onClick={copy}
          className="flex items-center gap-2 rounded-lg bg-primary px-4 py-2 text-sm font-semibold text-white shadow-sm hover:bg-primary/90 transition-colors"
        >
          {copied ? <Check className="h-4 w-4" /> : <Copy className="h-4 w-4" />}
          {copied ? "Copied!" : "Copy to clipboard"}
        </button>
        <button
          type="button"
          onClick={() => download("md")}
          className="flex items-center gap-2 rounded-lg border border-border bg-white px-3 py-2 text-sm font-medium hover:border-primary/40 transition-colors"
        >
          <Download className="h-4 w-4" /> .md
        </button>
        <button
          type="button"
          onClick={() => download("txt")}
          className="flex items-center gap-2 rounded-lg border border-border bg-white px-3 py-2 text-sm font-medium hover:border-primary/40 transition-colors"
        >
          <Download className="h-4 w-4" /> .txt
        </button>
      </div>

      {/* Code block */}
      <div className="relative rounded-xl border border-border bg-zinc-950 overflow-hidden">
        <div className="flex items-center justify-between border-b border-white/10 px-4 py-2.5">
          <div className="flex items-center gap-2">
            <Code2 className="h-3.5 w-3.5 text-zinc-400" />
            <span className="text-xs font-medium text-zinc-400">
              {tab === "prompt" ? "implementation-prompt.md" : "documentation.md"}
            </span>
          </div>
          <span className="text-[10px] text-zinc-600">
            {content.length.toLocaleString()} chars · {content.split("\n").length.toLocaleString()} lines
          </span>
        </div>
        <pre className="max-h-[480px] overflow-auto p-5 text-xs leading-relaxed text-zinc-200 whitespace-pre-wrap font-mono">
          {content}
        </pre>
      </div>
    </div>
  );
}

// ── Main component ─────────────────────────────────────────────────────────────

function IntegrationCenter() {
  const [step,       setStep]       = useState(1);
  const [framework,  setFramework]  = useState("");
  const [aiPlatform, setAiPlatform] = useState("");
  const [content,    setContent]    = useState<string[]>([]);
  const [rendering,  setRendering]  = useState("ssg");
  const [styling,    setStyling]    = useState("tailwind");
  const [output,     setOutput]     = useState<GeneratedOutput | null>(null);
  const [apiUrl,     setApiUrl]     = useState<string>(getDefaultApiUrl);

  function toggleContent(id: string) {
    if (id === "everything") {
      setContent((prev) => prev.includes("everything") ? [] : ["everything"]);
    } else {
      setContent((prev) =>
        prev.includes(id) ? prev.filter((c) => c !== id) : [...prev.filter((c) => c !== "everything"), id],
      );
    }
  }

  const canNext = useCallback(() => {
    if (step === 1) return framework !== "";
    if (step === 2) return aiPlatform !== "";
    if (step === 3) return content.length > 0;
    if (step === 4) return rendering !== "";
    if (step === 5) return styling !== "";
    return true;
  }, [step, framework, aiPlatform, content, rendering, styling]);

  function handleNext() {
    if (step === 5) {
      if (!apiUrl.trim()) {
        toast.error("Please set the API URL before generating the prompt.");
        return;
      }
      const sel: GeneratorSelections = {
        frameworkId:      framework,
        aiPlatformId:     aiPlatform,
        contentTypeIds:   content,
        renderStrategyId: rendering,
        stylingId:        styling,
        apiBaseUrl:       apiUrl.trim(),
      };
      setOutput(generatePrompt(sel));
      setStep(6);
    } else {
      setStep((s) => s + 1);
    }
  }

  function handleBack() {
    setStep((s) => Math.max(1, s - 1));
  }

  function handleRestart() {
    setStep(1);
    setFramework("");
    setAiPlatform("");
    setContent([]);
    setRendering("ssg");
    setStyling("tailwind");
    setOutput(null);
  }

  return (
    <div className="min-h-full px-8 py-8 space-y-6">

      {/* Page header */}
      <div className="flex items-start gap-4">
        <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-primary/10">
          <Plug className="h-5 w-5 text-primary" />
        </div>
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Integration Center</h1>
          <p className="mt-0.5 text-sm text-muted-foreground">
            Generate a tailored AI implementation prompt to integrate any external website with the Lunar CMS API — no manual coding required.
          </p>
        </div>
      </div>

      {/* API URL banner — always visible so users know what URL is baked into the prompt */}
      <ApiUrlBanner apiUrl={apiUrl} onChange={setApiUrl} />

      {/* Stepper */}
      <div className="flex justify-center overflow-x-auto py-2">
        <Stepper current={step} />
      </div>

      {/* Step card */}
      <div className="rounded-2xl border border-border bg-white shadow-sm">
        <div className="p-8">
          {step === 1 && <StepFramework  selected={framework}  onSelect={setFramework}  />}
          {step === 2 && <StepAiPlatform selected={aiPlatform} onSelect={setAiPlatform} />}
          {step === 3 && <StepContent    selected={content}    onToggle={toggleContent}  />}
          {step === 4 && (
            <StepRendering
              selected={rendering}
              onSelect={setRendering}
              frameworkId={framework}
            />
          )}
          {step === 5 && <StepStyling selected={styling} onSelect={setStyling} />}
          {step === 6 && output && (
            <StepGenerate output={output} onRegenerate={handleRestart} />
          )}
        </div>

        {/* Navigation footer */}
        {step < 6 && (
          <div className="flex items-center justify-between border-t border-border px-8 py-4">
            <button
              type="button"
              onClick={handleBack}
              disabled={step === 1}
              className="flex items-center gap-2 rounded-lg border border-border bg-white px-4 py-2 text-sm font-medium text-muted-foreground transition-colors hover:border-primary/40 hover:text-foreground disabled:pointer-events-none disabled:opacity-40"
            >
              <ChevronLeft className="h-4 w-4" />
              Back
            </button>

            <div className="flex items-center gap-3">
              <span className="text-xs text-muted-foreground">
                Step {step} of {STEPS.length}
              </span>
              <button
                type="button"
                onClick={handleNext}
                disabled={!canNext()}
                className="flex items-center gap-2 rounded-lg bg-primary px-5 py-2 text-sm font-semibold text-white shadow-sm transition-colors hover:bg-primary/90 disabled:pointer-events-none disabled:opacity-50"
              >
                {step === 5 ? (
                  <><Sparkles className="h-4 w-4" /> Generate Prompt</>
                ) : (
                  <>Next <ChevronRight className="h-4 w-4" /></>
                )}
              </button>
            </div>
          </div>
        )}
      </div>

      {/* Info cards — only shown on step 1 */}
      {step === 1 && (
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
          {[
            { icon: "🔑", title: "API Key Required",        desc: "Generate an API key from the API Keys section before integrating. Use a Publishable key for public websites." },
            { icon: "⚡", title: "One Prompt, Full Build",  desc: "The generated prompt instructs your chosen AI agent to build the entire CMS integration automatically." },
            { icon: "🔒", title: "Read-Only & Secure",      desc: "Publishable keys expose only published content. Your CMS data and admin remain private." },
          ].map((card) => (
            <div key={card.title} className="rounded-xl border border-border bg-white p-5 space-y-2">
              <span className="text-2xl">{card.icon}</span>
              <p className="text-sm font-semibold">{card.title}</p>
              <p className="text-xs text-muted-foreground leading-relaxed">{card.desc}</p>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
