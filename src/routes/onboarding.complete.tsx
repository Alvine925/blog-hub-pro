import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { ArrowRight } from "lucide-react";
import { getOnboardingState, type WebsiteIntelligence } from "@/lib/onboarding.functions";
import { supabase } from "@/integrations/supabase/client";

export const Route = createFileRoute("/onboarding/complete")({
  head: () => ({ meta: [{ title: "All Done — Lunar CMS" }] }),
  component: CompleteStep,
});

const CHECKLIST = [
  "Account created",
  "Website connected",
  "Workspace created",
  "Collections configured",
  "Content context loaded",
];

function CompleteStep() {
  const navigate = useNavigate();
  const [intel, setIntel] = useState<WebsiteIntelligence | null>(null);

  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => {
      if (!session?.user?.id) return;
      getOnboardingState({ userId: session.user.id })
        .then((s) => { if (s?.analysis_data) setIntel(s.analysis_data); })
        .catch(() => {});
    });
  }, []);

  const opportunities = intel?.contentOpportunities?.slice(0, 4) ?? [];
  const pillars       = intel?.contentPillars?.slice(0, 5) ?? [];

  return (
    <div>
      <p className="text-xs font-medium uppercase tracking-widest text-zinc-400">
        Setup complete
      </p>

      <h1 className="mt-4 text-5xl font-bold leading-[1.08] tracking-tight text-zinc-900">
        You're ready<br />to publish.
      </h1>

      <p className="mt-5 text-lg leading-relaxed text-zinc-500">
        Your workspace is configured. Start with your first blog post or explore the dashboard.
      </p>

      {/* Checklist */}
      <div className="mt-12 space-y-3">
        {CHECKLIST.map((item) => (
          <div key={item} className="flex items-center gap-4 text-sm text-zinc-700">
            <span className="text-zinc-900">✓</span>
            {item}
          </div>
        ))}
      </div>

      {/* Recommended topics */}
      {opportunities.length > 0 && (
        <div className="mt-12">
          <p className="text-xs font-semibold uppercase tracking-widest text-zinc-400">
            Recommended first articles
          </p>
          <ul className="mt-4 space-y-3">
            {opportunities.map((co) => (
              <li key={co.title} className="flex items-baseline gap-3 text-sm text-zinc-700">
                <span className="mt-1 block h-1 w-1 shrink-0 rounded-full bg-zinc-400" />
                {co.title}
              </li>
            ))}
          </ul>
        </div>
      )}

      {/* Content pillars */}
      {pillars.length > 0 && (
        <div className="mt-10">
          <p className="text-xs font-semibold uppercase tracking-widest text-zinc-400">
            Content pillars
          </p>
          <div className="mt-3 flex flex-wrap gap-2">
            {pillars.map((p) => (
              <span key={p} className="rounded-full border border-zinc-200 px-3 py-1 text-xs text-zinc-600">
                {p}
              </span>
            ))}
          </div>
        </div>
      )}

      {/* CTAs */}
      <div className="mt-12 flex flex-col gap-3 sm:flex-row">
        <button
          onClick={() => navigate({ to: "/admin/blogs/new" })}
          className="group flex items-center gap-2 rounded-lg bg-zinc-900 px-6 py-3 text-sm font-semibold text-white transition-colors hover:bg-zinc-700"
        >
          Write your first post
          <ArrowRight className="h-4 w-4 transition-transform group-hover:translate-x-0.5" />
        </button>
        <button
          onClick={() => navigate({ to: "/admin/dashboard" })}
          className="flex items-center gap-2 rounded-lg border border-zinc-200 px-6 py-3 text-sm font-medium text-zinc-700 transition-colors hover:border-zinc-400 hover:text-zinc-900"
        >
          Go to dashboard
        </button>
      </div>
    </div>
  );
}
