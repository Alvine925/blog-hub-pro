import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useState } from "react";
import { ArrowRight, Loader2, Check } from "lucide-react";
import { cn } from "@/lib/utils";
import { upsertOnboardingState } from "@/lib/onboarding.functions";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

export const Route = createFileRoute("/onboarding/collections")({
  head: () => ({ meta: [{ title: "Content Types — Lunar CMS" }] }),
  component: CollectionsStep,
});

const OPTIONS = [
  { id: "blogs",         label: "Blog posts",      description: "Articles, news, and updates", required: true },
  { id: "pages",         label: "Pages",            description: "Static website pages", required: true },
  { id: "media",         label: "Media library",    description: "Images and file uploads", required: true },
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
] as const;

type CollectionId = typeof OPTIONS[number]["id"];

function CollectionsStep() {
  const navigate = useNavigate();
  const [selected, setSelected] = useState<Set<CollectionId>>(
    new Set(["blogs", "pages", "media"]),
  );
  const [loading, setLoading] = useState(false);

  const toggle = (id: CollectionId, required?: boolean) => {
    if (required) return;
    setSelected((prev) => {
      const next = new Set(prev);
      next.has(id) ? next.delete(id) : next.add(id);
      return next;
    });
  };

  const handleContinue = async () => {
    setLoading(true);
    try {
      const { data: { session } } = await supabase.auth.getSession();
      const userId = session?.user?.id;
      const accessToken = session?.access_token;
      if (userId && accessToken) await upsertOnboardingState({ data: { userId, accessToken, step: "preparing" } });
      navigate({ to: "/onboarding/preparing", search: { collections: [...selected].join(",") } });
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to continue");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div>
      <p className="text-xs font-medium uppercase tracking-widest text-zinc-400">
        Step 3 — Content types
      </p>

      <h1 className="mt-4 text-4xl font-bold leading-tight tracking-tight text-zinc-900">
        What would you like<br />to manage?
      </h1>

      <p className="mt-4 text-base leading-relaxed text-zinc-500">
        Blogs, pages, and media are always included. Select anything else you need — you can change this later.
      </p>

      {/* Option list — no cards, just rows */}
      <div className="mt-10 space-y-0 divide-y divide-zinc-100">
        {OPTIONS.map((opt) => {
          const isSelected = selected.has(opt.id);
          return (
            <button
              key={opt.id}
              onClick={() => toggle(opt.id, (opt as { required?: boolean }).required)}
              className={cn(
                "flex w-full items-center justify-between py-4 text-left transition-colors",
                (opt as { required?: boolean }).required ? "cursor-default" : "hover:bg-transparent",
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
                {(opt as { required?: boolean }).required && (
                  <span className="ml-2 text-[10px] font-semibold uppercase tracking-wider text-zinc-400">
                    always on
                  </span>
                )}
              </div>

              <div className={cn(
                "flex h-5 w-5 shrink-0 items-center justify-center rounded border transition-all",
                isSelected
                  ? "border-zinc-900 bg-zinc-900"
                  : "border-zinc-300 bg-white",
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
          onClick={() => navigate({ to: "/onboarding/analyzing" })}
          className="text-sm text-zinc-400 hover:text-zinc-700 transition-colors"
        >
          ← Back
        </button>
        <button
          onClick={handleContinue}
          disabled={loading}
          className="group flex items-center gap-2 rounded-lg bg-zinc-900 px-6 py-3 text-sm font-semibold text-white transition-colors hover:bg-zinc-700 disabled:opacity-40"
        >
          {loading
            ? <><Loader2 className="h-4 w-4 animate-spin" /> Setting up…</>
            : <>Set up workspace <ArrowRight className="h-4 w-4 transition-transform group-hover:translate-x-0.5" /></>
          }
        </button>
      </div>
    </div>
  );
}
