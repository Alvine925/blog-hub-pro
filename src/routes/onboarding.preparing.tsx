import { createFileRoute, useNavigate, useSearch } from "@tanstack/react-router";
import { useEffect, useRef, useState } from "react";
import { Loader2 } from "lucide-react";
import { cn } from "@/lib/utils";
import { supabase } from "@/integrations/supabase/client";
import {
  getOnboardingState,
  createOnboardingWorkspace,
  upsertOnboardingState,
} from "@/lib/onboarding.functions";
import { toast } from "sonner";

export const Route = createFileRoute("/onboarding/preparing")({
  validateSearch: (s: Record<string, unknown>) => ({
    collections: String(s.collections ?? "blogs,pages,media"),
  }),
  head: () => ({ meta: [{ title: "Setting Up — Lunar CMS" }] }),
  component: PreparingStep,
});

const TASKS = [
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
    if (error) console.error(`[preparing] ${name} failed`, error);
  } catch (err) {
    // Content generation is best-effort — never block onboarding completion.
    console.error(`[preparing] ${name} threw`, err);
  }
}

function PreparingStep() {
  const navigate        = useNavigate();
  const { collections } = useSearch({ from: "/onboarding/preparing" });
  const [taskIdx, setTaskIdx] = useState(0);
  const [done, setDone]       = useState(false);
  const [error, setError]     = useState("");
  const [skipping, setSkipping] = useState(false);
  const ran = useRef(false);

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

  useEffect(() => {
    if (ran.current) return;
    ran.current = true;

    const selectedCollections = collections
      ? collections.split(",").filter(Boolean)
      : ["blogs", "pages", "media"];

    const timer = setInterval(() => {
      setTaskIdx((p) => (p < TASKS.length - 1 ? p + 1 : p));
    }, 1400);

    const run = async () => {
      try {
        // Get userId client-side — no server-function auth middleware needed
        const { data: { session } } = await supabase.auth.getSession();
        if (!session) throw new Error("Not authenticated. Please sign in again.");

        const userId = session.user.id;
        const accessToken = session.access_token;
        const state  = await getOnboardingState({ data: { userId, accessToken } });

        let workspaceId: string;

        if (!state?.website_url || !state?.analysis_data) {
          // No analysis data — create a minimal workspace
          const name = "My Workspace";
          const result = await createOnboardingWorkspace({
            data: {
              userId,
              accessToken,
              name,
              websiteUrl: state?.website_url ?? "",
              intelligence: {
                websiteName: name,
                companyName: name,
                industry: "",
                description: "",
                targetAudience: "",
                businessModel: "",
                services: [],
                products: [],
                brandVoice: "Professional",
                primaryTopics: [],
                keywords: [],
                location: null,
                language: "en",
                socialLinks: {},
                competitors: [],
                contentOpportunities: [],
                contentPillars: [],
                suggestedTags: [],
                suggestedCategories: [],
                brandSummary: "",
              },
              selectedCollections,
            },
          });
          workspaceId = result.workspaceId;
        } else {
          const intel = state.analysis_data;
          const name  = intel.companyName || intel.websiteName || "My Workspace";
          const result = await createOnboardingWorkspace({
            data: {
              userId,
              accessToken,
              name,
              websiteUrl: state.website_url,
              intelligence: intel,
              selectedCollections,
            },
          });
          workspaceId = result.workspaceId;
        }

        // ── Generate content per selected type — best-effort, non-blocking ──
        // Blogs/FAQs/News each get ~10 drafts + ~10 leftover suggestions.
        const generationJobs: Promise<void>[] = [];
        if (selectedCollections.includes("blogs")) {
          generationJobs.push(
            invokeEdgeFunction("generate-blog-post", accessToken, {
              workspace_id: workspaceId,
              batch: true,
              count: 10,
            }),
          );
        }
        if (selectedCollections.includes("faqs")) {
          generationJobs.push(
            invokeEdgeFunction("generate-faqs", accessToken, {
              workspace_id: workspaceId,
              count: 10,
              suggestion_count: 10,
            }),
          );
        }
        if (selectedCollections.includes("news")) {
          generationJobs.push(
            invokeEdgeFunction("generate-news", accessToken, {
              workspace_id: workspaceId,
              count: 10,
              suggestion_count: 10,
            }),
          );
        }
        if (selectedCollections.includes("products")) {
          generationJobs.push(
            invokeEdgeFunction("generate-products", accessToken, {
              workspace_id: workspaceId,
              count: 10,
              suggestion_count: 10,
            }),
          );
        }
        if (selectedCollections.includes("articles") || selectedCollections.includes("documentation")) {
          generationJobs.push(
            invokeEdgeFunction("generate-articles", accessToken, {
              workspace_id: workspaceId,
              count: 10,
              suggestion_count: 10,
            }),
          );
        }
        if (generationJobs.length) {
          await Promise.allSettled(generationJobs);
        }

        await upsertOnboardingState({
          data: {
            userId,
            accessToken,
            step: "complete",
            workspace_id: workspaceId,
            completed_at: new Date().toISOString(),
          },
        });

        clearInterval(timer);
        setTaskIdx(TASKS.length - 1);
        setDone(true);
        setTimeout(() => navigate({ to: "/onboarding/complete" }), 900);
      } catch (err) {
        clearInterval(timer);
        const msg = err instanceof Error ? err.message : "Setup failed. Please try again.";
        console.error("[preparing]", err);
        setError(msg);
        toast.error(msg);
      }
    };

    run();
    return () => clearInterval(timer);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  if (error) {
    return (
      <div>
        <p className="text-xs font-medium uppercase tracking-widest text-zinc-400">Setup</p>
        <h1 className="mt-4 text-3xl font-bold text-zinc-900">Something went wrong.</h1>
        <p className="mt-3 text-sm leading-relaxed text-zinc-500">{error}</p>
        <div className="mt-8 flex gap-3">
          <button
            onClick={() => { ran.current = false; setError(""); setTaskIdx(0); setDone(false); }}
            className="rounded-lg bg-zinc-900 px-6 py-3 text-sm font-semibold text-white hover:bg-zinc-700 transition-colors"
          >
            Try again
          </button>
          <button
            onClick={() => navigate({ to: "/admin/dashboard" })}
            className="rounded-lg border border-zinc-200 px-6 py-3 text-sm font-medium text-zinc-700 hover:border-zinc-400 transition-colors"
          >
            Skip to dashboard
          </button>
        </div>
      </div>
    );
  }

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
        {TASKS.map((task, i) => {
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
                    : <span className="block h-1.5 w-1.5 rounded-full bg-zinc-300" />
                }
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

      {!done && (
        <div className="mt-8">
          <button
            onClick={skipToDashboard}
            disabled={skipping}
            className="flex items-center gap-1 text-sm text-zinc-400 transition-colors hover:text-zinc-600 disabled:opacity-50"
          >
            {skipping && <Loader2 className="h-3 w-3 animate-spin" />}
            Skip to dashboard
          </button>
        </div>
      )}
    </div>
  );
}
