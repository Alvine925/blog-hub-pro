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
  { key: "welcome",    label: "Welcome" },
  { key: "website",   label: "Website" },
  { key: "analyzing", label: "Analysis" },
  { key: "collections", label: "Content" },
  { key: "preparing", label: "Setup" },
  { key: "complete",  label: "Done" },
] as const;

function currentStepIndex(pathname: string): number {
  const segment = pathname.split("/").pop() ?? "";
  const idx = STEPS.findIndex((s) => s.key === segment);
  return idx === -1 ? 0 : idx;
}

function OnboardingLayout() {
  const navigate   = useNavigate();
  const [checking, setChecking] = useState(true);
  const pathname   = useRouterState({ select: (s) => s.location.pathname });
  const stepIdx    = currentStepIndex(pathname);

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
      <header className="flex items-center justify-between px-8 py-6">
        <div className="flex items-center gap-2">
          <Moon className="h-4 w-4 text-zinc-900" />
          <span className="text-sm font-semibold tracking-tight text-zinc-900">Lunar CMS</span>
        </div>

        {/* Step progress — minimal line + dots */}
        <div className="flex items-center gap-0">
          {STEPS.map((step, i) => (
            <div key={step.key} className="flex items-center">
              <div
                className={cn(
                  "h-[7px] w-[7px] rounded-full transition-all duration-300",
                  i < stepIdx  ? "bg-zinc-900"
                  : i === stepIdx ? "bg-zinc-900 ring-2 ring-zinc-900 ring-offset-2"
                  : "bg-zinc-200",
                )}
              />
              {i < STEPS.length - 1 && (
                <div className={cn(
                  "h-px w-10 transition-colors duration-300",
                  i < stepIdx ? "bg-zinc-900" : "bg-zinc-200",
                )} />
              )}
            </div>
          ))}
        </div>

        <span className="text-xs text-zinc-400">
          {stepIdx + 1} / {STEPS.length}
        </span>
      </header>

      {/* Content — centred, max-width */}
      <main className="mx-auto max-w-xl px-8 py-16">
        <Outlet />
      </main>
    </div>
  );
}
