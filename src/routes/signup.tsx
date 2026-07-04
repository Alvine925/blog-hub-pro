import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Moon, Eye, EyeOff, Loader2, ChevronLeft, ChevronRight } from "lucide-react";
import { toast } from "sonner";

export const Route = createFileRoute("/signup")({
  head: () => ({ meta: [{ title: "Create Account — Lunar CMS" }] }),
  component: SignupPage,
});

const SLIDES = [
  {
    image: "https://images.unsplash.com/photo-1542744094-24638eff58bb?auto=format&fit=crop&w=900&q=80",
    quote: "From idea to published in minutes. Lunar CMS changed how we think about content.",
    author: "Amara O.",
    role: "Lead Developer, Solstice Agency",
  },
  {
    image: "https://images.unsplash.com/photo-1522202176988-66273c2fd55f?auto=format&fit=crop&w=900&q=80",
    quote: "Our whole team — writers, editors, devs — finally works in one place. No more handoffs.",
    author: "Tom R.",
    role: "CTO, Fieldnotes",
  },
  {
    image: "https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?auto=format&fit=crop&w=900&q=80",
    quote: "Setting up the API took twenty minutes. Our blog was live the same afternoon.",
    author: "Marcus L.",
    role: "Founder, Brightpath",
  },
  {
    image: "https://images.unsplash.com/photo-1531746790731-6c087fecd65a?auto=format&fit=crop&w=900&q=80",
    quote: "The multi-workspace model is exactly what agencies need. We manage twelve clients from one dashboard.",
    author: "Priya S.",
    role: "Growth Lead, Arclight",
  },
  {
    image: "https://images.unsplash.com/photo-1600880292203-757bb62b4baf?auto=format&fit=crop&w=900&q=80",
    quote: "Engagement analytics out of the box. We finally know what content actually performs.",
    author: "Daniel M.",
    role: "Head of Content, Prismatic",
  },
];

function SignupPage() {
  const navigate = useNavigate();
  const [fullName, setFullName]           = useState("");
  const [email, setEmail]                 = useState("");
  const [password, setPassword]           = useState("");
  const [showPw, setShowPw]               = useState(false);
  const [agreed, setAgreed]               = useState(false);
  const [loading, setLoading]             = useState(false);
  const [googleLoading, setGoogleLoading] = useState(false);
  const [githubLoading, setGithubLoading] = useState(false);
  const [current, setCurrent]             = useState(0);
  const [animating, setAnimating]         = useState(false);

  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => {
      if (session) navigate({ to: "/" });
    });
  }, [navigate]);

  useEffect(() => {
    const timer = setInterval(() => goTo((prev) => (prev + 1) % SLIDES.length), 5000);
    return () => clearInterval(timer);
  }, []);

  function goTo(indexOrUpdater: number | ((prev: number) => number)) {
    if (animating) return;
    setAnimating(true);
    setCurrent(typeof indexOrUpdater === "function" ? indexOrUpdater : () => indexOrUpdater);
    setTimeout(() => setAnimating(false), 600);
  }

  const handleSignup = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!agreed) { toast.error("Please agree to the Terms and Privacy Policy to continue."); return; }
    if (password.length < 6) { toast.error("Password must be at least 6 characters"); return; }
    setLoading(true);
    const { error } = await supabase.auth.signUp({
      email,
      password,
      options: { data: { full_name: fullName } },
    });
    setLoading(false);
    if (error) { toast.error(error.message); return; }
    navigate({ to: "/onboarding/welcome" });
  };

  const handleGoogle = async () => {
    if (!agreed) { toast.error("Please agree to the Terms and Privacy Policy to continue."); return; }
    setGoogleLoading(true);
    const { error } = await supabase.auth.signInWithOAuth({
      provider: "google",
      options: { redirectTo: `${window.location.origin}/onboarding/welcome` },
    });
    if (error) { toast.error(error.message); setGoogleLoading(false); }
  };

  const handleGitHub = async () => {
    if (!agreed) { toast.error("Please agree to the Terms and Privacy Policy to continue."); return; }
    setGithubLoading(true);
    const { error } = await supabase.auth.signInWithOAuth({
      provider: "github",
      options: { redirectTo: `${window.location.origin}/onboarding/welcome` },
    });
    if (error) { toast.error(error.message); setGithubLoading(false); }
  };

  const strength = (() => {
    if (!password) return 0;
    let s = 0;
    if (password.length >= 8) s++;
    if (/[A-Z]/.test(password)) s++;
    if (/[0-9]/.test(password)) s++;
    if (/[^A-Za-z0-9]/.test(password)) s++;
    return s;
  })();

  const slide = SLIDES[current];

  return (
    <div className="flex min-h-screen bg-white">
      {/* Left — form column */}
      <div className="flex flex-1 flex-col items-center justify-center px-8 py-16 overflow-y-auto">
        <div className="w-full max-w-sm">
          {/* Mobile logo */}
          <div className="mb-10 flex items-center gap-2 lg:hidden">
            <Moon className="h-4 w-4 text-zinc-900" />
            <span className="text-sm font-semibold tracking-tight text-zinc-900">Lunar CMS</span>
          </div>

          <h1 className="text-3xl font-bold tracking-tight text-zinc-900">Create account</h1>
          <p className="mt-1.5 text-sm text-zinc-500">Free to get started. No credit card required.</p>

          {/* OAuth */}
          <div className="mt-8 space-y-3">
            <button
              onClick={handleGoogle}
              disabled={googleLoading}
              className="flex w-full items-center justify-center gap-3 rounded-lg border border-zinc-200 bg-white px-4 py-2.5 text-sm font-medium text-zinc-700 transition-colors hover:bg-zinc-50 disabled:opacity-50"
            >
              {googleLoading ? <Loader2 className="h-4 w-4 animate-spin" /> : (
                <svg className="h-4 w-4" viewBox="0 0 24 24">
                  <path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" fill="#4285F4" />
                  <path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" fill="#34A853" />
                  <path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" fill="#FBBC05" />
                  <path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" fill="#EA4335" />
                </svg>
              )}
              Sign up with Google
            </button>

            <button
              onClick={handleGitHub}
              disabled={githubLoading}
              className="flex w-full items-center justify-center gap-3 rounded-lg border border-zinc-200 bg-white px-4 py-2.5 text-sm font-medium text-zinc-700 transition-colors hover:bg-zinc-50 disabled:opacity-50"
            >
              {githubLoading ? <Loader2 className="h-4 w-4 animate-spin" /> : (
                <svg className="h-4 w-4 fill-current" viewBox="0 0 24 24">
                  <path d="M12 0C5.37 0 0 5.37 0 12c0 5.31 3.435 9.795 8.205 11.385.6.105.825-.255.825-.57 0-.285-.015-1.23-.015-2.235-3.015.555-3.795-.735-4.035-1.41-.135-.345-.72-1.41-1.23-1.695-.42-.225-1.02-.78-.015-.795.945-.015 1.62.87 1.845 1.23 1.08 1.815 2.805 1.305 3.495.99.105-.78.42-1.305.765-1.605-2.67-.3-5.46-1.335-5.46-5.925 0-1.305.465-2.385 1.23-3.225-.12-.3-.54-1.53.12-3.18 0 0 1.005-.315 3.3 1.23.96-.27 1.98-.405 3-.405s2.04.135 3 .405c2.295-1.56 3.3-1.23 3.3-1.23.66 1.65.24 2.88.12 3.18.765.84 1.23 1.905 1.23 3.225 0 4.605-2.805 5.625-5.475 5.925.435.375.81 1.095.81 2.22 0 1.605-.015 2.895-.015 3.3 0 .315.225.69.825.57A12.02 12.02 0 0 0 24 12c0-6.63-5.37-12-12-12z" />
                </svg>
              )}
              Sign up with GitHub
            </button>
          </div>

          <div className="my-7 flex items-center gap-3">
            <div className="h-px flex-1 bg-zinc-100" />
            <span className="text-xs text-zinc-400">or with email</span>
            <div className="h-px flex-1 bg-zinc-100" />
          </div>

          <form onSubmit={handleSignup} className="space-y-5">
            <div>
              <label className="block text-xs font-semibold uppercase tracking-widest text-zinc-400">
                Full name
              </label>
              <input
                type="text"
                value={fullName}
                onChange={(e) => setFullName(e.target.value)}
                required
                placeholder="Jane Smith"
                className="mt-2 w-full border-0 border-b-2 border-zinc-200 bg-transparent pb-2.5 text-base text-zinc-900 placeholder:text-zinc-300 focus:border-zinc-900 focus:outline-none transition-colors"
              />
            </div>

            <div>
              <label className="block text-xs font-semibold uppercase tracking-widest text-zinc-400">
                Email
              </label>
              <input
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required
                placeholder="you@company.com"
                className="mt-2 w-full border-0 border-b-2 border-zinc-200 bg-transparent pb-2.5 text-base text-zinc-900 placeholder:text-zinc-300 focus:border-zinc-900 focus:outline-none transition-colors"
              />
            </div>

            <div>
              <label className="block text-xs font-semibold uppercase tracking-widest text-zinc-400">
                Password
              </label>
              <div className="relative mt-2">
                <input
                  type={showPw ? "text" : "password"}
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  required
                  placeholder="Min. 6 characters"
                  className="w-full border-0 border-b-2 border-zinc-200 bg-transparent pb-2.5 pr-8 text-base text-zinc-900 placeholder:text-zinc-300 focus:border-zinc-900 focus:outline-none transition-colors"
                />
                <button
                  type="button"
                  onClick={() => setShowPw(!showPw)}
                  className="absolute right-0 top-0 text-zinc-400 hover:text-zinc-700"
                >
                  {showPw ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                </button>
              </div>

              {password && (
                <div className="mt-2.5 flex gap-1">
                  {[1, 2, 3, 4].map((i) => (
                    <div
                      key={i}
                      className={`h-0.5 flex-1 rounded-full transition-colors ${
                        i <= strength
                          ? strength <= 1 ? "bg-red-400" : strength <= 2 ? "bg-amber-400" : "bg-emerald-500"
                          : "bg-zinc-200"
                      }`}
                    />
                  ))}
                </div>
              )}
            </div>

            {/* Terms checkbox */}
            <div className="flex items-start gap-3 pt-1">
              <button
                type="button"
                role="checkbox"
                aria-checked={agreed}
                onClick={() => setAgreed(!agreed)}
                className={`mt-0.5 flex h-4 w-4 flex-shrink-0 items-center justify-center rounded border-2 transition-colors ${
                  agreed ? "border-zinc-900 bg-zinc-900" : "border-zinc-300 bg-white"
                }`}
              >
                {agreed && (
                  <svg className="h-2.5 w-2.5 text-white" viewBox="0 0 12 12" fill="none">
                    <path d="M2 6l3 3 5-5" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
                  </svg>
                )}
              </button>
              <p className="text-xs leading-relaxed text-zinc-500">
                I agree to the{" "}
                <Link to="/terms" className="font-medium text-zinc-900 underline underline-offset-2 hover:text-zinc-700">
                  Terms of Service
                </Link>{" "}
                and{" "}
                <Link to="/privacy" className="font-medium text-zinc-900 underline underline-offset-2 hover:text-zinc-700">
                  Privacy Policy
                </Link>
              </p>
            </div>

            <div className="pt-1">
              <button
                type="submit"
                disabled={loading}
                className="flex w-full items-center justify-center gap-2 rounded-lg bg-zinc-900 px-4 py-3 text-sm font-semibold text-white transition-colors hover:bg-zinc-700 disabled:opacity-50"
              >
                {loading && <Loader2 className="h-4 w-4 animate-spin" />}
                Create account
              </button>
            </div>
          </form>

          <p className="mt-6 text-center text-sm text-zinc-500">
            Already have an account?{" "}
            <Link to="/login" className="font-medium text-zinc-900 hover:underline">
              Sign in →
            </Link>
          </p>
        </div>
      </div>

      {/* Right — carousel */}
      <div className="relative hidden w-[42%] overflow-hidden lg:block">
        {SLIDES.map((s, i) => (
          <div
            key={i}
            className="absolute inset-0 transition-opacity duration-700"
            style={{ opacity: i === current ? 1 : 0 }}
          >
            <img src={s.image} alt="" className="h-full w-full object-cover" />
          </div>
        ))}

        <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-black/40 to-black/30" />

        <div className="absolute left-10 top-10 flex items-center gap-2">
          <Moon className="h-4 w-4 text-white" />
          <span className="text-sm font-semibold tracking-tight text-white">Lunar CMS</span>
        </div>

        <div className="absolute bottom-10 left-0 right-0 px-10">
          <div
            key={current}
            style={{ animation: "fadeSlideUp 0.5s ease forwards" }}
          >
            <blockquote className="text-xl font-medium leading-snug text-white">
              &ldquo;{slide.quote}&rdquo;
            </blockquote>
            <div className="mt-4">
              <p className="text-sm font-semibold text-white">{slide.author}</p>
              <p className="text-xs text-white/60">{slide.role}</p>
            </div>
          </div>

          <div className="mt-6 flex items-center gap-4">
            <div className="flex gap-1.5">
              {SLIDES.map((_, i) => (
                <button
                  key={i}
                  onClick={() => goTo(i)}
                  className={`h-1 rounded-full transition-all duration-300 ${
                    i === current ? "w-6 bg-white" : "w-1.5 bg-white/40"
                  }`}
                />
              ))}
            </div>
            <div className="ml-auto flex gap-2">
              <button
                onClick={() => goTo((current - 1 + SLIDES.length) % SLIDES.length)}
                className="flex h-8 w-8 items-center justify-center rounded-full border border-white/30 text-white/70 transition hover:border-white hover:text-white"
              >
                <ChevronLeft className="h-4 w-4" />
              </button>
              <button
                onClick={() => goTo((current + 1) % SLIDES.length)}
                className="flex h-8 w-8 items-center justify-center rounded-full border border-white/30 text-white/70 transition hover:border-white hover:text-white"
              >
                <ChevronRight className="h-4 w-4" />
              </button>
            </div>
          </div>
        </div>

        <p className="absolute bottom-3 left-10 text-xs text-white/30">© 2025 Lunar CMS</p>
      </div>

      <style>{`
        @keyframes fadeSlideUp {
          from { opacity: 0; transform: translateY(12px); }
          to   { opacity: 1; transform: translateY(0); }
        }
      `}</style>
    </div>
  );
}
