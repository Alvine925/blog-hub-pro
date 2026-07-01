import { createFileRoute, useNavigate, useSearch } from "@tanstack/react-router";
import { useEffect, useRef, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { upsertOnboardingState, type WebsiteIntelligence } from "@/lib/onboarding.functions";
import { ArrowRight, AlertCircle, Loader2 } from "lucide-react";
import { cn } from "@/lib/utils";
import { toast } from "sonner";

export const Route = createFileRoute("/onboarding/analyzing")({
  validateSearch: (s: Record<string, unknown>) => ({ url: String(s.url ?? "") }),
  head: () => ({ meta: [{ title: "Analysing — Lunar CMS" }] }),
  component: AnalyzingStep,
});

const STAGES = [
  "Crawling your website",
  "Extracting business context",
  "Identifying target audience",
  "Mapping competitors",
  "Finding keyword gaps",
  "Building content opportunities",
];

function AnalyzingStep() {
  const navigate    = useNavigate();
  const { url }     = useSearch({ from: "/onboarding/analyzing" });
  const [stageIdx, setStageIdx]  = useState(0);
  const [status, setStatus]      = useState<"loading" | "done" | "error">("loading");
  const [intelligence, setIntelligence] = useState<WebsiteIntelligence | null>(null);
  const [errorMsg, setErrorMsg]  = useState("");
  const [savedUrl, setSavedUrl]  = useState(url);
  const ran = useRef(false);

  useEffect(() => {
    if (ran.current) return;
    ran.current = true;
    const targetUrl = url || savedUrl;
    if (!targetUrl) { navigate({ to: "/onboarding/website" }); return; }

    const timer = setInterval(() => {
      setStageIdx((p) => (p < STAGES.length - 1 ? p + 1 : p));
    }, 4500);

    supabase.auth.getSession().then(({ data: { session } }) => {
      const userId = session?.user?.id ?? null;

      supabase.functions
        .invoke("analyze-website", { body: { url: targetUrl } })
        .then(async ({ data, error }) => {
          clearInterval(timer);
          setStageIdx(STAGES.length - 1);
          if (error) throw new Error(error.message ?? "Analysis failed");
          if (!data?.success) throw new Error(data?.error ?? "Analysis failed");
          const intel = data.intelligence as WebsiteIntelligence;
          setIntelligence(intel);
          setSavedUrl(targetUrl);
          if (userId) await upsertOnboardingState({ userId, step: "analyzing", website_url: targetUrl, analysis_data: intel });
          setStatus("done");
        })
        .catch((err) => {
          clearInterval(timer);
          setErrorMsg(err.message ?? "Analysis failed. Please try again.");
          setStatus("error");
        });
    });

    return () => clearInterval(timer);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const handleContinue = async () => {
    const { data: { session } } = await supabase.auth.getSession();
    const userId = session?.user?.id;
    if (userId) await upsertOnboardingState({ userId, step: "collections" }).catch(() => {});
    navigate({ to: "/onboarding/collections" });
  };

  // ── Loading ─────────────────────────────────────────────────────────────────
  if (status === "loading") {
    return (
      <div>
        <p className="text-xs font-medium uppercase tracking-widest text-zinc-400">
          Step 2 — Analysis
        </p>
        <h1 className="mt-4 text-4xl font-bold leading-tight tracking-tight text-zinc-900">
          Scanning your website.
        </h1>
        <p className="mt-3 text-base text-zinc-500">
          Analysing{" "}
          <span className="font-medium text-zinc-900">{savedUrl}</span>
          &thinsp;— this takes about 30 seconds.
        </p>

        <div className="mt-12 space-y-0 divide-y divide-zinc-100">
          {STAGES.map((stage, i) => {
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

  // ── Error ────────────────────────────────────────────────────────────────────
  if (status === "error") {
    return (
      <div>
        <p className="text-xs font-medium uppercase tracking-widest text-zinc-400">
          Step 2 — Analysis
        </p>
        <h1 className="mt-4 text-4xl font-bold tracking-tight text-zinc-900">
          Couldn't reach that site.
        </h1>
        <p className="mt-3 text-base leading-relaxed text-zinc-500">
          {errorMsg || "Some websites block automated scanners. Try a different URL or skip this step."}
        </p>

        <div className="mt-10 flex items-center gap-4">
          <button
            onClick={() => navigate({ to: "/onboarding/website" })}
            className="text-sm text-zinc-400 hover:text-zinc-700 transition-colors"
          >
            ← Try another URL
          </button>
          <button
            onClick={async () => { const { data: { session } } = await supabase.auth.getSession(); if (session?.user?.id) await upsertOnboardingState({ userId: session.user.id, step: "collections" }).catch(() => {}); navigate({ to: "/onboarding/collections" }); }}
            className="group flex items-center gap-2 rounded-lg bg-zinc-900 px-6 py-3 text-sm font-semibold text-white transition-colors hover:bg-zinc-700"
          >
            Skip <ArrowRight className="h-4 w-4" />
          </button>
        </div>
      </div>
    );
  }

  // ── Results ──────────────────────────────────────────────────────────────────
  if (!intelligence) return null;

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

      {/* Overview */}
      <div className="mt-10 space-y-0 divide-y divide-zinc-100">
        {[
          ["Company", intelligence.companyName || intelligence.websiteName],
          ["Industry", intelligence.industry],
          ["Audience", intelligence.targetAudience],
          ["Business model", intelligence.businessModel],
          ["Brand voice", intelligence.brandVoice],
          ["Location", intelligence.location || "—"],
        ].map(([label, value]) => (
          <div key={label} className="flex gap-6 py-4">
            <span className="w-32 shrink-0 text-xs font-semibold uppercase tracking-wider text-zinc-400">
              {label}
            </span>
            <span className="text-sm leading-relaxed text-zinc-700">{value}</span>
          </div>
        ))}
      </div>

      {/* Keywords */}
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

      {/* Competitors */}
      {intelligence.competitors?.length > 0 && (
        <div className="mt-8">
          <p className="text-xs font-semibold uppercase tracking-widest text-zinc-400">Competitors</p>
          <div className="mt-3 space-y-2">
            {intelligence.competitors.slice(0, 4).map((c) => (
              <div key={c.name} className="flex items-baseline gap-3 text-sm">
                <span className="font-medium text-zinc-900">{c.name}</span>
                {c.website && (
                  <span className="text-zinc-400 text-xs truncate max-w-[200px]">
                    {c.website.replace(/^https?:\/\//, "")}
                  </span>
                )}
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Content opportunities */}
      {intelligence.contentOpportunities?.length > 0 && (
        <div className="mt-8">
          <p className="text-xs font-semibold uppercase tracking-widest text-zinc-400">Content opportunities</p>
          <ul className="mt-3 space-y-2">
            {intelligence.contentOpportunities.slice(0, 5).map((co) => (
              <li key={co.title} className="flex items-baseline gap-3 text-sm text-zinc-700">
                <span className={cn(
                  "shrink-0 text-[10px] font-semibold uppercase",
                  co.priority === "high" ? "text-emerald-600"
                  : co.priority === "medium" ? "text-amber-600"
                  : "text-zinc-400",
                )}>
                  {co.priority}
                </span>
                {co.title}
              </li>
            ))}
          </ul>
        </div>
      )}

      <div className="mt-12 flex items-center gap-4">
        <button
          onClick={() => navigate({ to: "/onboarding/website" })}
          className="text-sm text-zinc-400 hover:text-zinc-700 transition-colors"
        >
          ← Try another URL
        </button>
        <button
          onClick={handleContinue}
          className="group flex items-center gap-2 rounded-lg bg-zinc-900 px-6 py-3 text-sm font-semibold text-white transition-colors hover:bg-zinc-700"
        >
          Looks good — continue
          <ArrowRight className="h-4 w-4 transition-transform group-hover:translate-x-0.5" />
        </button>
      </div>
    </div>
  );
}
