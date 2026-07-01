import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Moon, Eye, EyeOff, Loader2 } from "lucide-react";
import { toast } from "sonner";

export const Route = createFileRoute("/login")({
  head: () => ({ meta: [{ title: "Sign In — Lunar CMS" }] }),
  component: LoginPage,
});

function LoginPage() {
  const navigate = useNavigate();
  const [email, setEmail]           = useState("");
  const [password, setPassword]     = useState("");
  const [showPw, setShowPw]         = useState(false);
  const [loading, setLoading]       = useState(false);
  const [googleLoading, setGoogleLoading] = useState(false);
  const [githubLoading, setGithubLoading] = useState(false);

  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => {
      if (session) navigate({ to: "/" });
    });
  }, [navigate]);

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    const { error } = await supabase.auth.signInWithPassword({ email, password });
    setLoading(false);
    if (error) { toast.error(error.message); return; }
    navigate({ to: "/" });
  };

  const handleGoogle = async () => {
    setGoogleLoading(true);
    const { error } = await supabase.auth.signInWithOAuth({
      provider: "google",
      options: { redirectTo: `${window.location.origin}/` },
    });
    if (error) { toast.error(error.message); setGoogleLoading(false); }
  };

  const handleGitHub = async () => {
    setGithubLoading(true);
    const { error } = await supabase.auth.signInWithOAuth({
      provider: "github",
      options: { redirectTo: `${window.location.origin}/` },
    });
    if (error) { toast.error(error.message); setGithubLoading(false); }
  };

  return (
    <div className="flex min-h-screen bg-white">
      {/* Left — brand column */}
      <div className="hidden w-[42%] flex-col justify-between bg-zinc-950 px-12 py-10 lg:flex">
        <div className="flex items-center gap-2">
          <Moon className="h-4 w-4 text-white" />
          <span className="text-sm font-semibold tracking-tight text-white">Lunar CMS</span>
        </div>

        <div>
          <blockquote className="text-2xl font-medium leading-snug text-white">
            "We went from idea to live content in under ten minutes."
          </blockquote>
          <p className="mt-5 text-sm text-zinc-500">
            Sarah K. &mdash; Marketing Director, Growthly
          </p>
        </div>

        <p className="text-xs text-zinc-700">© 2025 Lunar CMS</p>
      </div>

      {/* Right — form column */}
      <div className="flex flex-1 flex-col items-center justify-center px-8 py-16">
        <div className="w-full max-w-sm">
          {/* Mobile logo */}
          <div className="mb-10 flex items-center gap-2 lg:hidden">
            <Moon className="h-4 w-4 text-zinc-900" />
            <span className="text-sm font-semibold tracking-tight text-zinc-900">Lunar CMS</span>
          </div>

          <h1 className="text-3xl font-bold tracking-tight text-zinc-900">Sign in</h1>
          <p className="mt-1.5 text-sm text-zinc-500">Welcome back.</p>

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
              Continue with Google
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
              Continue with GitHub
            </button>
          </div>

          <div className="my-7 flex items-center gap-3">
            <div className="h-px flex-1 bg-zinc-100" />
            <span className="text-xs text-zinc-400">or with email</span>
            <div className="h-px flex-1 bg-zinc-100" />
          </div>

          <form onSubmit={handleLogin} className="space-y-5">
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
              <div className="flex items-center justify-between">
                <label className="text-xs font-semibold uppercase tracking-widest text-zinc-400">
                  Password
                </label>
                <a href="#" className="text-xs text-zinc-400 hover:text-zinc-700 transition-colors">
                  Forgot?
                </a>
              </div>
              <div className="relative mt-2">
                <input
                  type={showPw ? "text" : "password"}
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  required
                  placeholder="••••••••"
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
            </div>

            <div className="pt-2">
              <button
                type="submit"
                disabled={loading}
                className="flex w-full items-center justify-center gap-2 rounded-lg bg-zinc-900 px-4 py-3 text-sm font-semibold text-white transition-colors hover:bg-zinc-700 disabled:opacity-50"
              >
                {loading && <Loader2 className="h-4 w-4 animate-spin" />}
                Sign in
              </button>
            </div>
          </form>

          <p className="mt-8 text-center text-sm text-zinc-500">
            No account?{" "}
            <Link to="/signup" className="font-medium text-zinc-900 hover:underline">
              Create one free →
            </Link>
          </p>
        </div>
      </div>
    </div>
  );
}
