import { createFileRoute, Outlet, useNavigate, useRouterState } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Loader2, Moon } from "lucide-react";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/onboarding")({
  head: () => ({ meta: [{ title: "Getting Started — Lunar CMS" }] }),
  component: OnboardingLayout,
});

const STEPS = [
  { key: "welcome",     label: "Welcome" },
  { key: "website",    label: "Website" },
  { key: "analyzing",  label: "Analysis" },
  { key: "collections", label: "Content" },
  { key: "preparing",  label: "Setup" },
  { key: "complete",   label: "Done" },
] as const;

function currentStepIndex(pathname: string): number {
  const segment = pathname.split("/").pop() ?? "";
  const idx = STEPS.findIndex((s) => s.key === segment);
  return idx === -1 ? 0 : idx;
}

function OnboardingLayout() {
  const navigate  = useNavigate();
  const [checking, setChecking] = useState(true);
  const pathname  = useRouterState({ select: (s) => s.location.pathname });
  const stepIdx   = currentStepIndex(pathname);
  const isComplete = STEPS[stepIdx]?.key === "complete";

  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => {
      if (!session) navigate({ to: "/login" });
      else setChecking(false);
    });
  }, [navigate]);

  if (checking) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-white">
        <Loader2 className="h-5 w-5 animate-spin text-zinc-400" />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-white">
      {/* Header */}
      <header className="flex items-center justify-between px-4 py-5 sm:px-8 sm:py-6">
        {/* Logo */}
        <div className="flex items-center gap-2">
          <Moon className="h-4 w-4 text-zinc-900" />
          <span className="text-sm font-semibold tracking-tight text-zinc-900">Lunar CMS</span>
        </div>

        {/* Step progress dots — shrink connector lines on mobile */}
        <div className="flex items-center">
          {STEPS.map((step, i) => (
            <div key={step.key} className="flex items-center">
              <div
                className={cn(
                  "h-[7px] w-[7px] rounded-full transition-all duration-300",
                  i < stepIdx
                    ? "bg-zinc-900"
                    : i === stepIdx
                    ? "bg-zinc-900 ring-2 ring-zinc-900 ring-offset-2"
                    : "bg-zinc-200",
                )}
              />
              {i < STEPS.length - 1 && (
                <div
                  className={cn(
                    "h-px transition-colors duration-300",
                    "w-4 sm:w-10",
                    i < stepIdx ? "bg-zinc-900" : "bg-zinc-200",
                  )}
                />
              )}
            </div>
          ))}
        </div>

        {/* Right side: skip button (hidden on complete step) or step counter */}
        <div className="flex items-center gap-3">
          <span className="hidden text-xs text-zinc-400 sm:inline">
            {stepIdx + 1} / {STEPS.length}
          </span>

          {!isComplete && (
            <button
              onClick={() => navigate({ to: "/admin/dashboard" })}
              className="text-xs text-zinc-400 transition-colors hover:text-zinc-700"
            >
              Skip setup →
            </button>
          )}
        </div>
      </header>

      {/* Content */}
      <main className="mx-auto max-w-xl px-5 py-10 sm:px-8 sm:py-16">
        <Outlet />
      </main>
    </div>
  );
}
