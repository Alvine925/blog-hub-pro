import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useState } from "react";
import { ArrowRight, Loader2, AlertCircle } from "lucide-react";
import { upsertOnboardingState } from "@/lib/onboarding.functions";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

export const Route = createFileRoute("/onboarding/website")({
  head: () => ({ meta: [{ title: "Your Website — Lunar CMS" }] }),
  component: WebsiteStep,
});

function normalizeUrl(raw: string): string {
  let u = raw.trim().replace(/\/$/, "");
  if (!u.startsWith("http://") && !u.startsWith("https://")) u = "https://" + u;
  try {
    const parsed = new URL(u);
    return parsed.origin;
  } catch {
    return u;
  }
}

const WHAT_WE_SCAN = [
  "Homepage, about, and services pages",
  "Industry, niche, and business model",
  "Target audience and brand voice",
  "Top competitors and their strategies",
  "Keyword opportunities and content gaps",
];

function WebsiteStep() {
  const navigate = useNavigate();
  const [url, setUrl]       = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError]   = useState("");

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    const normalized = normalizeUrl(url);
    try { new URL(normalized); } catch {
      setError("Please enter a valid website URL.");
      return;
    }
    setLoading(true);
    try {
      const { data: { session } } = await supabase.auth.getSession();
      const userId = session?.user?.id;
      if (userId) await upsertOnboardingState({ data: { userId, step: "analyzing", website_url: normalized } });
      navigate({ to: "/onboarding/analyzing", search: { url: normalized } });
    } catch (err) {
      const msg = err instanceof Error ? err.message : "Something went wrong. Please try again.";
      toast.error(msg);
      setError(msg);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div>
      <p className="text-xs font-medium uppercase tracking-widest text-zinc-400">
        Step 1 — Your website
      </p>

      <h1 className="mt-4 text-4xl font-bold leading-tight tracking-tight text-zinc-900">
        What website would you<br />like to manage?
      </h1>

      <p className="mt-4 text-base leading-relaxed text-zinc-500">
        Enter your URL and we'll scan your site to build context for your workspace. This takes about 30 seconds.
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
            onClick={() => navigate({ to: "/onboarding/welcome" })}
            className="text-sm text-zinc-400 hover:text-zinc-700 transition-colors"
          >
            ← Back
          </button>
          <button
            type="submit"
            disabled={loading || !url.trim()}
            className="group flex items-center gap-2 rounded-lg bg-zinc-900 px-6 py-3 text-sm font-semibold text-white transition-colors hover:bg-zinc-700 disabled:opacity-40"
          >
            {loading ? (
              <><Loader2 className="h-4 w-4 animate-spin" /> Saving…</>
            ) : (
              <>Analyse website <ArrowRight className="h-4 w-4 transition-transform group-hover:translate-x-0.5" /></>
            )}
          </button>
        </div>
      </form>

      {/* What we scan — inline list, no card */}
      <div className="mt-16">
        <p className="text-xs font-semibold uppercase tracking-widest text-zinc-400">
          What we scan
        </p>
        <ul className="mt-4 space-y-3">
          {WHAT_WE_SCAN.map((item) => (
            <li key={item} className="flex items-baseline gap-3 text-sm text-zinc-600">
              <span className="mt-1 block h-1 w-1 shrink-0 rounded-full bg-zinc-400" />
              {item}
            </li>
          ))}
        </ul>
      </div>
    </div>
  );
}
