import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useState } from "react";
import { ArrowRight, Loader2 } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { upsertOnboardingState } from "@/lib/onboarding.functions";

export const Route = createFileRoute("/onboarding/welcome")({
  head: () => ({ meta: [{ title: "Welcome — Lunar CMS" }] }),
  component: WelcomeStep,
});

const STEPS = [
  {
    num: "01",
    title: "Connect your website",
    description: "Enter your URL and we'll scan your content, brand, and business context automatically.",
  },
  {
    num: "02",
    title: "Discover your landscape",
    description: "We identify your competitors, audience, and the content gaps you can win.",
  },
  {
    num: "03",
    title: "Choose what to manage",
    description: "Pick the content types that matter — blogs, pages, docs, or anything else.",
  },
  {
    num: "04",
    title: "Start publishing",
    description: "Your workspace is pre-loaded with topic ideas, categories, and content suggestions.",
  },
];

function WelcomeStep() {
  const navigate = useNavigate();
  const [skipping, setSkipping] = useState(false);

  const skipToDashboard = async () => {
    setSkipping(true);
    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (session?.user?.id && session?.access_token) {
        await upsertOnboardingState({
          data: {
            userId: session.user.id,
            accessToken: session.access_token,
            step: "complete",
            completed_at: new Date().toISOString(),
          },
        });
      }
    } catch { /* non-fatal */ }
    navigate({ to: "/admin/dashboard" });
  };

  return (
    <div>
      <p className="text-xs font-medium uppercase tracking-widest text-zinc-400">
        Getting started
      </p>

      <h1 className="mt-4 text-4xl font-bold leading-[1.08] tracking-tight text-zinc-900 sm:text-5xl">
        Welcome to<br />Lunar CMS.
      </h1>

      <p className="mt-5 text-base leading-relaxed text-zinc-500 sm:text-lg">
        Set up your workspace in 2–3 minutes. We'll handle the research
        so you can focus on writing.
      </p>

      {/* Step list */}
      <div className="mt-10 space-y-0 divide-y divide-zinc-100 sm:mt-12">
        {STEPS.map(({ num, title, description }) => (
          <div key={num} className="flex gap-5 py-4 sm:gap-6 sm:py-5">
            <span className="mt-0.5 min-w-[28px] text-xs font-semibold tabular-nums text-zinc-300">
              {num}
            </span>
            <div>
              <p className="text-sm font-semibold text-zinc-900">{title}</p>
              <p className="mt-1 text-sm leading-relaxed text-zinc-500">{description}</p>
            </div>
          </div>
        ))}
      </div>

      <div className="mt-10 sm:mt-12">
        <button
          onClick={() => navigate({ to: "/onboarding/website" })}
          className="group flex items-center gap-2 rounded-lg bg-zinc-900 px-6 py-3 text-sm font-semibold text-white transition-colors hover:bg-zinc-700"
        >
          Continue
          <ArrowRight className="h-4 w-4 transition-transform group-hover:translate-x-0.5" />
        </button>

        <div className="mt-4 flex items-center gap-4">
          <p className="text-xs text-zinc-400">No credit card required.</p>
          <span className="text-zinc-200">·</span>
          <button
            onClick={skipToDashboard}
            disabled={skipping}
            className="flex items-center gap-1 text-xs text-zinc-400 transition-colors hover:text-zinc-600 disabled:opacity-50"
          >
            {skipping && <Loader2 className="h-3 w-3 animate-spin" />}
            Skip setup
          </button>
        </div>
      </div>
    </div>
  );
}
