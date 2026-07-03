import { useEffect, useRef, useState } from "react";
import { useNavigate } from "@tanstack/react-router";
import { X, ArrowRight, Loader2, AlertCircle, Check } from "lucide-react";
import { cn } from "@/lib/utils";
import { supabase } from "@/integrations/supabase/client";
import { createOnboardingWorkspace, type WebsiteIntelligence } from "@/lib/onboarding.functions";
import { toast } from "sonner";

// ── Types ─────────────────────────────────────────────────────────────────────

type Step = "url" | "analyzing" | "collections" | "creating";

interface WizardState {
  url: string;
  intelligence: WebsiteIntelligence | null;
  selectedCollections: Set<string>;
}

// ── Constants ─────────────────────────────────────────────────────────────────

const STEPS: { key: Step; label: string }[] = [
  { key: "url",         label: "Website" },
  { key: "analyzing",   label: "Analysis" },
  { key: "collections", label: "Content" },
  { key: "creating",    label: "Setup" },
];

const COLLECTION_OPTIONS: { id: string; label: string; description: string; required?: boolean }[] = [
  { id: "blogs",         label: "Blog posts",      description: "Articles, news, and updates",   required: true },
  { id: "pages",         label: "Pages",            description: "Static website pages",          required: true },
  { id: "media",         label: "Media library",    description: "Images and file uploads",       required: true },
  { id: "documentation", label: "Documentation",    description: "Technical docs and guides" },
  { id: "products",      label: "Products",         description: "Product catalogue" },
  { id: "faqs",          label: "FAQs",             description: "Frequently asked questions, auto-generated from your site" },
  { id: "news",          label: "News",             description: "Industry news, auto-researched and written for you" },
  { id: "case-studies",  label: "Case studies",     description: "Client success stories" },
  { id: "testimonials",  label: "Testimonials",     description: "Customer reviews" },
  { id: "team",          label: "Team members",     description: "Staff profiles" },
  { id: "events",        label: "Events",           description: "Upcoming events" },
  { id: "portfolio",     label: "Portfolio",        description: "Work showcase" },
  { id: "services",      label: "Services",         description: "Service offerings" },
];

const ANALYSIS_STAGES = [
  "Crawling your website",
  "Extracting business context",
  "Identifying target audience",
  "Mapping competitors",
  "Finding keyword gaps",
  "Building content opportunities",
];

const SETUP_TASKS = [
  "Creating your workspace",
  "Applying website context",
  "Configuring collections",
  "Building category structure",
  "Generating your content",
  "Researching industry news",
  "Finalising your setup",
];

async function invokeEdgeFunction(
  name: string,
  accessToken: string,
  body: Record<string, unknown>,
): Promise<void> {
  try {
    const { error } = await supabase.functions.invoke(name, {
      body,
      headers: { Authorization: `Bearer ${accessToken}` },
    });
    if (error) console.error(`[CreateWorkspaceWizard] ${name} failed`, error);
  } catch (err) {
    // Content generation is best-effort — never block workspace creation.
    console.error(`[CreateWorkspaceWizard] ${name} threw`, err);
  }
}

// ── Helpers ───────────────────────────────────────────────────────────────────

function normalizeUrl(raw: string): string {
  let u = raw.trim().replace(/\/$/, "");
  if (!u.startsWith("http://") && !u.startsWith("https://")) u = "https://" + u;
  try { return new URL(u).origin; } catch { return u; }
}

function stepIndex(step: Step): number {
  return STEPS.findIndex((s) => s.key === step);
}

// ── UrlStep ───────────────────────────────────────────────────────────────────

function UrlStep({
  onNext,
  onClose,
}: {
  onNext: (url: string) => void;
  onClose: () => void;
}) {
  const [url, setUrl]   = useState("");
  const [error, setError] = useState("");

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const normalized = normalizeUrl(url);
    try { new URL(normalized); } catch {
      setError("Please enter a valid website URL.");
      return;
    }
    onNext(normalized);
  };

  return (
    <div>
      <p className="text-xs font-medium uppercase tracking-widest text-zinc-400">
        Step 1 — Website
      </p>
      <h1 className="mt-4 text-4xl font-bold leading-tight tracking-tight text-zinc-900">
        What website is this<br />workspace for?
      </h1>
      <p className="mt-4 text-base leading-relaxed text-zinc-500">
        Enter the URL and we'll scan your site to build context for the workspace.
        This takes about 30 seconds.
      </p>

      <form onSubmit={handleSubmit} className="mt-10">
        <label className="block text-xs font-semibold uppercase tracking-widest text-zinc-400">
          Website URL
        </label>
        <input
          type="text"
          value={url}
          onChange={(e) => { setUrl(e.target.value); setError(""); }}
          placeholder="https://yourcompany.com"
          autoFocus
          className="mt-2 w-full border-0 border-b-2 border-zinc-200 bg-transparent pb-3 text-lg font-medium text-zinc-900 placeholder:text-zinc-300 focus:border-zinc-900 focus:outline-none transition-colors"
        />
        {error && (
          <div className="mt-3 flex items-center gap-2 text-sm text-red-500">
            <AlertCircle className="h-4 w-4 shrink-0" />
            {error}
          </div>
        )}
        <div className="mt-10 flex items-center gap-4">
          <button
            type="button"
            onClick={onClose}
            className="text-sm text-zinc-400 hover:text-zinc-700 transition-colors"
          >
            Cancel
          </button>
          <button
            type="submit"
            disabled={!url.trim()}
            className="group flex items-center gap-2 rounded-lg bg-zinc-900 px-6 py-3 text-sm font-semibold text-white transition-colors hover:bg-zinc-700 disabled:opacity-40"
          >
            Analyse website
            <ArrowRight className="h-4 w-4 transition-transform group-hover:translate-x-0.5" />
          </button>
          <button
            type="button"
            onClick={() => onNext("")}
            className="text-sm text-zinc-400 hover:text-zinc-700 transition-colors"
          >
            Skip →
          </button>
        </div>
      </form>
    </div>
  );
}

// ── AnalyzingStep ─────────────────────────────────────────────────────────────

function AnalyzingStep({
  url,
  onDone,
  onError,
}: {
  url: string;
  onDone: (intelligence: WebsiteIntelligence) => void;
  onError: (msg: string) => void;
}) {
  const [stageIdx, setStageIdx] = useState(0);
  const ran = useRef(false);

  useEffect(() => {
    if (ran.current) return;
    ran.current = true;

    const timer = setInterval(() => {
      setStageIdx((p) => (p < ANALYSIS_STAGES.length - 1 ? p + 1 : p));
    }, 4000);

    supabase.functions
      .invoke("analyze-website", { body: { url } })
      .then(({ data, error }) => {
        clearInterval(timer);
        setStageIdx(ANALYSIS_STAGES.length - 1);
        if (error) throw new Error(error.message ?? "Analysis failed");
        if (!data?.success) throw new Error(data?.error ?? "Analysis failed");
        onDone(data.intelligence as WebsiteIntelligence);
      })
      .catch((err: Error) => {
        clearInterval(timer);
        onError(err.message ?? "Analysis failed. Please try again.");
      });

    return () => clearInterval(timer);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return (
    <div>
      <p className="text-xs font-medium uppercase tracking-widest text-zinc-400">
        Step 2 — Analysis
      </p>
      <h1 className="mt-4 text-4xl font-bold leading-tight tracking-tight text-zinc-900">
        Scanning your website.
      </h1>
      <p className="mt-3 text-base text-zinc-500">
        Analysing <span className="font-medium text-zinc-900">{url}</span>
        &thinsp;— this takes about 30 seconds.
      </p>
      <div className="mt-12 space-y-0 divide-y divide-zinc-100">
        {ANALYSIS_STAGES.map((stage, i) => {
          const isDone   = i < stageIdx;
          const isActive = i === stageIdx;
          return (
            <div key={stage} className={cn(
              "flex items-center gap-5 py-4 transition-opacity",
              i > stageIdx ? "opacity-30" : "opacity-100",
            )}>
              <div className="w-4 shrink-0 flex items-center justify-center">
                {isDone   ? <span className="text-zinc-900">✓</span>
                 : isActive ? <Loader2 className="h-3.5 w-3.5 animate-spin text-zinc-700" />
                 : <span className="block h-1.5 w-1.5 rounded-full bg-zinc-300" />}
              </div>
              <span className={cn(
                "text-sm",
                isActive  ? "font-semibold text-zinc-900"
                : isDone  ? "text-zinc-500"
                : "text-zinc-400",
              )}>
                {stage}
              </span>
            </div>
          );
        })}
      </div>
    </div>
  );
}

// ── AnalysisResultStep ────────────────────────────────────────────────────────

function AnalysisResultStep({
  intelligence,
  onNext,
  onRetry,
}: {
  intelligence: WebsiteIntelligence;
  onNext: () => void;
  onRetry: () => void;
}) {
  return (
    <div>
      <p className="text-xs font-medium uppercase tracking-widest text-zinc-400">
        Step 2 — Analysis complete
      </p>
      <h1 className="mt-4 text-4xl font-bold leading-tight tracking-tight text-zinc-900">
        Here's what we found.
      </h1>
      <p className="mt-3 text-base text-zinc-500">
        Review the summary below, then continue to choose your content types.
      </p>

      <div className="mt-10 space-y-0 divide-y divide-zinc-100">
        {[
          ["Company",        intelligence.companyName || intelligence.websiteName],
          ["Industry",       intelligence.industry],
          ["Audience",       intelligence.targetAudience],
          ["Business model", intelligence.businessModel],
          ["Brand voice",    intelligence.brandVoice],
          ["Location",       intelligence.location || "—"],
        ].map(([label, value]) => (
          <div key={label} className="flex gap-6 py-4">
            <span className="w-32 shrink-0 text-xs font-semibold uppercase tracking-wider text-zinc-400">
              {label}
            </span>
            <span className="text-sm leading-relaxed text-zinc-700">{value}</span>
          </div>
        ))}
      </div>

      {intelligence.keywords?.length > 0 && (
        <div className="mt-8">
          <p className="text-xs font-semibold uppercase tracking-widest text-zinc-400">Keywords</p>
          <div className="mt-3 flex flex-wrap gap-2">
            {intelligence.keywords.slice(0, 8).map((kw) => (
              <span key={kw} className="rounded-full border border-zinc-200 px-3 py-1 text-xs text-zinc-600">
                {kw}
              </span>
            ))}
          </div>
        </div>
      )}

      <div className="mt-12 flex items-center gap-4">
        <button
          onClick={onRetry}
          className="text-sm text-zinc-400 hover:text-zinc-700 transition-colors"
        >
          ← Try another URL
        </button>
        <button
          onClick={onNext}
          className="group flex items-center gap-2 rounded-lg bg-zinc-900 px-6 py-3 text-sm font-semibold text-white transition-colors hover:bg-zinc-700"
        >
          Looks good — continue
          <ArrowRight className="h-4 w-4 transition-transform group-hover:translate-x-0.5" />
        </button>
      </div>
    </div>
  );
}

// ── CollectionsStep ───────────────────────────────────────────────────────────

function CollectionsStep({
  selected,
  onToggle,
  onNext,
  onBack,
}: {
  selected: Set<string>;
  onToggle: (id: string) => void;
  onNext: () => void;
  onBack: () => void;
}) {
  return (
    <div>
      <p className="text-xs font-medium uppercase tracking-widest text-zinc-400">
        Step 3 — Content types
      </p>
      <h1 className="mt-4 text-4xl font-bold leading-tight tracking-tight text-zinc-900">
        What would you like<br />to manage?
      </h1>
      <p className="mt-4 text-base leading-relaxed text-zinc-500">
        Blogs, pages, and media are always included. Select anything else you
        need — you can change this later.
      </p>

      <div className="mt-10 space-y-0 divide-y divide-zinc-100">
        {COLLECTION_OPTIONS.map((opt) => {
          const isSelected = selected.has(opt.id);
          return (
            <button
              key={opt.id}
              onClick={() => !opt.required && onToggle(opt.id)}
              className={cn(
                "flex w-full items-center justify-between py-4 text-left transition-colors",
                opt.required ? "cursor-default" : "hover:bg-transparent",
              )}
            >
              <div>
                <span className={cn(
                  "text-sm font-medium transition-colors",
                  isSelected ? "text-zinc-900" : "text-zinc-500",
                )}>
                  {opt.label}
                </span>
                <span className="ml-3 text-xs text-zinc-400">{opt.description}</span>
                {opt.required && (
                  <span className="ml-2 text-[10px] font-semibold uppercase tracking-wider text-zinc-400">
                    always on
                  </span>
                )}
              </div>
              <div className={cn(
                "flex h-5 w-5 shrink-0 items-center justify-center rounded border transition-all",
                isSelected ? "border-zinc-900 bg-zinc-900" : "border-zinc-300 bg-white",
              )}>
                {isSelected && <Check className="h-3 w-3 text-white" strokeWidth={3} />}
              </div>
            </button>
          );
        })}
      </div>

      <p className="mt-4 text-xs text-zinc-400">
        {selected.size} type{selected.size !== 1 ? "s" : ""} selected
      </p>

      <div className="mt-10 flex items-center gap-4">
        <button
          onClick={onBack}
          className="text-sm text-zinc-400 hover:text-zinc-700 transition-colors"
        >
          ← Back
        </button>
        <button
          onClick={onNext}
          className="group flex items-center gap-2 rounded-lg bg-zinc-900 px-6 py-3 text-sm font-semibold text-white transition-colors hover:bg-zinc-700"
        >
          Set up workspace
          <ArrowRight className="h-4 w-4 transition-transform group-hover:translate-x-0.5" />
        </button>
      </div>
    </div>
  );
}

// ── CreatingStep ──────────────────────────────────────────────────────────────

function CreatingStep({
  url,
  intelligence,
  selectedCollections,
  onDone,
  onError,
}: {
  url: string;
  intelligence: WebsiteIntelligence | null;
  selectedCollections: string[];
  onDone: (workspaceId: string) => void;
  onError: (msg: string) => void;
}) {
  const [taskIdx, setTaskIdx] = useState(0);
  const [done, setDone]       = useState(false);
  const ran = useRef(false);

  useEffect(() => {
    if (ran.current) return;
    ran.current = true;

    const timer = setInterval(() => {
      setTaskIdx((p) => (p < SETUP_TASKS.length - 1 ? p + 1 : p));
    }, 1200);

    const run = async () => {
      try {
        const { data: { session } } = await supabase.auth.getSession();
        if (!session) throw new Error("Not authenticated. Please sign in again.");

        const userId      = session.user.id;
        const accessToken = session.access_token;

        const intel: WebsiteIntelligence = intelligence ?? {
          websiteName:          "My Workspace",
          companyName:          "My Workspace",
          industry:             "",
          description:          "",
          targetAudience:       "",
          businessModel:        "",
          services:             [],
          products:             [],
          brandVoice:           "Professional",
          primaryTopics:        [],
          keywords:             [],
          location:             null,
          language:             "en",
          socialLinks:          {},
          competitors:          [],
          contentOpportunities: [],
          contentPillars:       [],
          suggestedTags:        [],
          suggestedCategories:  [],
          brandSummary:         "",
        };

        const name = intel.companyName || intel.websiteName || "My Workspace";

        const result = await createOnboardingWorkspace({
          data: { userId, accessToken, name, websiteUrl: url, intelligence: intel, selectedCollections },
        });

        // ── Generate content per selected type — best-effort, non-blocking ──
        // Blogs/FAQs/News each get ~10 drafts + ~10 leftover suggestions.
        const generationJobs: Promise<void>[] = [];
        if (selectedCollections.includes("blogs")) {
          generationJobs.push(
            invokeEdgeFunction("generate-blog-post", accessToken, {
              workspace_id: result.workspaceId,
              batch: true,
              count: 10,
            }),
          );
        }
        if (selectedCollections.includes("faqs")) {
          generationJobs.push(
            invokeEdgeFunction("generate-faqs", accessToken, {
              workspace_id: result.workspaceId,
              count: 10,
              suggestion_count: 10,
            }),
          );
        }
        if (selectedCollections.includes("news")) {
          generationJobs.push(
            invokeEdgeFunction("generate-news", accessToken, {
              workspace_id: result.workspaceId,
              count: 10,
              suggestion_count: 10,
            }),
          );
        }
        if (generationJobs.length) {
          await Promise.allSettled(generationJobs);
        }

        clearInterval(timer);
        setTaskIdx(SETUP_TASKS.length - 1);
        setDone(true);
        setTimeout(() => onDone(result.workspaceId), 600);
      } catch (err) {
        clearInterval(timer);
        const msg = err instanceof Error ? err.message : "Setup failed. Please try again.";
        console.error("[CreateWorkspaceWizard/creating]", err);
        onError(msg);
      }
    };

    run();
    return () => clearInterval(timer);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return (
    <div>
      <p className="text-xs font-medium uppercase tracking-widest text-zinc-400">
        Step 4 — {done ? "Complete" : "Setting up"}
      </p>
      <h1 className="mt-4 text-4xl font-bold leading-tight tracking-tight text-zinc-900">
        {done ? "Your workspace is ready." : "Building your workspace."}
      </h1>
      {!done && (
        <p className="mt-3 text-base text-zinc-500">
          Configuring everything based on your website and selections.
        </p>
      )}
      <div className="mt-12 space-y-0 divide-y divide-zinc-100">
        {SETUP_TASKS.map((task, i) => {
          const isDone   = i < taskIdx || done;
          const isActive = !done && i === taskIdx;
          return (
            <div key={task} className={cn(
              "flex items-center gap-5 py-4 transition-opacity",
              i > taskIdx && !done ? "opacity-30" : "opacity-100",
            )}>
              <div className="w-4 shrink-0 flex items-center justify-center">
                {isDone
                  ? <span className="text-zinc-900 text-sm">✓</span>
                  : isActive
                    ? <Loader2 className="h-3.5 w-3.5 animate-spin text-zinc-700" />
                    : <span className="block h-1.5 w-1.5 rounded-full bg-zinc-300" />}
              </div>
              <span className={cn(
                "text-sm",
                isActive  ? "font-semibold text-zinc-900"
                : isDone  ? "text-zinc-500"
                : "text-zinc-400",
              )}>
                {task}
              </span>
            </div>
          );
        })}
      </div>
    </div>
  );
}

// ── Main Wizard ───────────────────────────────────────────────────────────────

interface CreateWorkspaceWizardProps {
  onClose: () => void;
}

export function CreateWorkspaceWizard({ onClose }: CreateWorkspaceWizardProps) {
  const navigate = useNavigate();

  const [step, setStep]   = useState<Step>("url");
  const [state, setState] = useState<WizardState>({
    url:                  "",
    intelligence:         null,
    selectedCollections:  new Set(["blogs", "pages", "media"]),
  });

  const [analysisError, setAnalysisError] = useState("");
  const [setupError, setSetupError]       = useState("");
  const [analysisDone, setAnalysisDone]   = useState(false);
  const [analysisKey, setAnalysisKey]     = useState(0);
  const [creatingKey, setCreatingKey]     = useState(0);

  const curIdx = stepIndex(step);

  const toggleCollection = (id: string) => {
    setState((prev) => {
      const next = new Set(prev.selectedCollections);
      next.has(id) ? next.delete(id) : next.add(id);
      return { ...prev, selectedCollections: next };
    });
  };

  return (
    <div className="fixed inset-0 z-50 bg-white overflow-y-auto">
      {/* Header */}
      <header className="flex items-center justify-between px-8 py-6">
        <div className="flex items-center gap-0">
          {STEPS.map((s, i) => (
            <div key={s.key} className="flex items-center">
              <div className={cn(
                "h-[7px] w-[7px] rounded-full transition-all duration-300",
                i < curIdx  ? "bg-zinc-900"
                : i === curIdx ? "bg-zinc-900 ring-2 ring-zinc-900 ring-offset-2"
                : "bg-zinc-200",
              )} />
              {i < STEPS.length - 1 && (
                <div className={cn(
                  "h-px w-10 transition-colors duration-300",
                  i < curIdx ? "bg-zinc-900" : "bg-zinc-200",
                )} />
              )}
            </div>
          ))}
        </div>

        <span className="text-xs text-zinc-400">{curIdx + 1} / {STEPS.length}</span>

        {/* Close button — only on steps where it's safe to cancel */}
        {(step === "url" || step === "analyzing" || step === "collections") && (
          <button
            onClick={onClose}
            aria-label="Close"
            className="rounded-full p-1.5 text-zinc-400 hover:bg-zinc-100 hover:text-zinc-700 transition-colors"
          >
            <X className="h-4 w-4" />
          </button>
        )}
        {step === "creating" && <div className="w-7" />}
      </header>

      {/* Content */}
      <main className="mx-auto max-w-xl px-8 py-16">

        {/* URL step */}
        {step === "url" && (
          <UrlStep
            onNext={(url) => {
              setState((p) => ({ ...p, url }));
              if (!url) {
                setStep("collections");
              } else {
                setAnalysisDone(false);
                setAnalysisError("");
                setStep("analyzing");
              }
            }}
            onClose={onClose}
          />
        )}

        {/* Analyzing step */}
        {step === "analyzing" && !analysisDone && !analysisError && (
          <AnalyzingStep
            key={analysisKey}
            url={state.url}
            onDone={(intel) => {
              setState((p) => ({ ...p, intelligence: intel }));
              setAnalysisDone(true);
            }}
            onError={(msg) => setAnalysisError(msg)}
          />
        )}

        {/* Analysis error */}
        {step === "analyzing" && analysisError && (
          <div>
            <p className="text-xs font-medium uppercase tracking-widest text-zinc-400">
              Step 2 — Analysis
            </p>
            <h1 className="mt-4 text-4xl font-bold tracking-tight text-zinc-900">
              Couldn't reach that site.
            </h1>
            <p className="mt-3 text-base leading-relaxed text-zinc-500">
              {analysisError} You can try a different URL or skip the analysis and create the workspace manually.
            </p>
            <div className="mt-10 flex items-center gap-4">
              <button
                onClick={() => { setAnalysisError(""); setStep("url"); }}
                className="text-sm text-zinc-400 hover:text-zinc-700 transition-colors"
              >
                ← Try another URL
              </button>
              <button
                onClick={() => { setAnalysisError(""); setStep("collections"); }}
                className="group flex items-center gap-2 rounded-lg bg-zinc-900 px-6 py-3 text-sm font-semibold text-white transition-colors hover:bg-zinc-700"
              >
                Skip analysis <ArrowRight className="h-4 w-4" />
              </button>
            </div>
          </div>
        )}

        {/* Analysis results */}
        {step === "analyzing" && analysisDone && state.intelligence && (
          <AnalysisResultStep
            intelligence={state.intelligence}
            onNext={() => setStep("collections")}
            onRetry={() => {
              setAnalysisDone(false);
              setAnalysisError("");
              setState((p) => ({ ...p, url: "", intelligence: null }));
              setAnalysisKey((k) => k + 1);
              setStep("url");
            }}
          />
        )}

        {/* Collections step */}
        {step === "collections" && (
          <CollectionsStep
            selected={state.selectedCollections}
            onToggle={toggleCollection}
            onNext={() => { setSetupError(""); setStep("creating"); }}
            onBack={() => {
              if (state.url) {
                setAnalysisDone(!!state.intelligence);
                setAnalysisError("");
                setStep("analyzing");
              } else {
                setStep("url");
              }
            }}
          />
        )}

        {/* Creating step */}
        {step === "creating" && !setupError && (
          <CreatingStep
            key={creatingKey}
            url={state.url}
            intelligence={state.intelligence}
            selectedCollections={[...state.selectedCollections]}
            onDone={(workspaceId) => {
              toast.success("Workspace created!");
              onClose();
              navigate({ to: "/admin/workspaces/$id", params: { id: workspaceId } });
            }}
            onError={(msg) => setSetupError(msg)}
          />
        )}

        {/* Setup error */}
        {step === "creating" && setupError && (
          <div>
            <p className="text-xs font-medium uppercase tracking-widest text-zinc-400">Setup</p>
            <h1 className="mt-4 text-3xl font-bold text-zinc-900">Something went wrong.</h1>
            <p className="mt-3 text-sm leading-relaxed text-zinc-500">{setupError}</p>
            <div className="mt-8 flex gap-3">
              <button
                onClick={() => { setSetupError(""); setCreatingKey((k) => k + 1); }}
                className="rounded-lg bg-zinc-900 px-6 py-3 text-sm font-semibold text-white hover:bg-zinc-700 transition-colors"
              >
                Try again
              </button>
              <button
                onClick={onClose}
                className="rounded-lg border border-zinc-200 px-6 py-3 text-sm font-medium text-zinc-700 hover:border-zinc-400 transition-colors"
              >
                Cancel
              </button>
            </div>
          </div>
        )}
      </main>
    </div>
  );
}
