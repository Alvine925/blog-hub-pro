import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Loader2, KeyRound, Eye, EyeOff } from "lucide-react";
import { toast } from "sonner";
import { useServerFn } from "@tanstack/react-start";
import { trackUserLogin, markPasswordChanged, sendWelcomeEmail } from "@/lib/workspace-members.functions";

export const Route = createFileRoute("/set-password")({
  head: () => ({ meta: [{ title: "Set Your Password — Lunar CMS" }] }),
  component: SetPasswordPage,
});

function SetPasswordPage() {
  const navigate = useNavigate();
  const doTrackLogin = useServerFn(trackUserLogin);
  const doMarkPasswordChanged = useServerFn(markPasswordChanged);
  const doSendWelcome = useServerFn(sendWelcomeEmail);

  const [password, setPassword]     = useState("");
  const [confirm, setConfirm]       = useState("");
  const [showPw, setShowPw]         = useState(false);
  const [showCf, setShowCf]         = useState(false);
  const [loading, setLoading]       = useState(false);
  const [checking, setChecking]     = useState(true);
  const [userEmail, setUserEmail]   = useState("");

  // Guard: must be logged in and require a password change
  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => {
      if (!session) {
        navigate({ to: "/login" });
        return;
      }
      const needsChange = session.user.user_metadata?.password_change_required === true;
      if (!needsChange) {
        // Already has a real password — go to dashboard
        navigate({ to: "/" });
        return;
      }
      setUserEmail(session.user.email ?? "");
      setChecking(false);
    });
  }, [navigate]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (password.length < 8) {
      toast.error("Password must be at least 8 characters.");
      return;
    }
    if (password !== confirm) {
      toast.error("Passwords don't match.");
      return;
    }

    setLoading(true);

    // 1. Update the password
    const { error: pwErr } = await supabase.auth.updateUser({
      password,
      data: { password_change_required: false },
    });

    if (pwErr) {
      toast.error(pwErr.message);
      setLoading(false);
      return;
    }

    // 2. Get the fresh session (updated after password change)
    const { data: { session } } = await supabase.auth.getSession();

    if (session?.access_token) {
      // 3. Clear password_change_required in cms_users (keeps auth + app DB in sync)
      try {
        await doMarkPasswordChanged({ data: { accessToken: session.access_token } });
      } catch (err) {
        console.warn("markPasswordChanged non-fatal:", err);
      }

      // 4. Activate pending workspace memberships server-side
      try {
        await doTrackLogin({ data: { accessToken: session.access_token } });
      } catch (err) {
        console.warn("trackUserLogin non-fatal:", err);
      }
    }

    // 5. Find workspace to redirect to (must come BEFORE welcome email so we have `first`)
    const { data: memberships } = await supabase
      .from("workspace_members" as never)
      .select("workspace_id")
      .eq("user_id", session?.user?.id ?? "")
      .eq("status", "active")
      .order("created_at", { ascending: true })
      .limit(1);

    const first = (memberships as { workspace_id: string }[] | null)?.[0];

    // 6. Send welcome email for invited user — non-blocking, never blocks navigation
    if (session?.access_token) {
      doSendWelcome({
        data: {
          accessToken: session.access_token,
          type: "welcome_invited",
          dashboardUrl: first
            ? `${window.location.origin}/admin/workspaces/${first.workspace_id}`
            : `${window.location.origin}/`,
        },
      }).catch(() => {/* non-fatal */});
    }

    toast.success("Password set! Welcome to Lunar CMS.");
    setLoading(false);

    // 7. Go straight to their workspace — skip onboarding entirely
    if (first) {
      navigate({ to: `/admin/workspaces/${first.workspace_id}` as "/" });
    } else {
      navigate({ to: "/admin/dashboard" });
    }
  };

  if (checking) {
    return (
      <div className="flex min-h-screen items-center justify-center">
        <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
      </div>
    );
  }

  return (
    <div className="flex min-h-screen items-center justify-center bg-background px-4">
      <div className="w-full max-w-sm space-y-6">
        {/* Logo */}
        <div className="flex items-center gap-2 justify-center text-foreground">
          <span className="text-2xl font-semibold tracking-tight">Lunar CMS</span>
        </div>

        {/* Card */}
        <div className="rounded-xl border bg-card p-8 shadow-sm space-y-5">
          <div className="space-y-1 text-center">
            <div className="flex justify-center mb-3">
              <span className="inline-flex h-12 w-12 items-center justify-center rounded-full bg-primary/10">
                <KeyRound className="h-6 w-6 text-primary" />
              </span>
            </div>
            <h1 className="text-xl font-semibold">Set your password</h1>
            <p className="text-sm text-muted-foreground">
              You were invited to Lunar CMS.
              <br />
              Choose a password to complete your account setup.
            </p>
            {userEmail && (
              <p className="text-xs text-muted-foreground pt-1">
                Signing in as <span className="font-medium">{userEmail}</span>
              </p>
            )}
          </div>

          <form onSubmit={handleSubmit} className="space-y-4">
            {/* New password */}
            <div className="space-y-1.5">
              <label className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
                New password
              </label>
              <div className="relative">
                <input
                  type={showPw ? "text" : "password"}
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  required
                  minLength={8}
                  placeholder="At least 8 characters"
                  autoComplete="new-password"
                  className="w-full rounded-md border bg-background px-3 py-2 pr-10 text-sm outline-none ring-offset-background placeholder:text-muted-foreground focus:ring-2 focus:ring-ring focus:ring-offset-2"
                />
                <button
                  type="button"
                  onClick={() => setShowPw((v) => !v)}
                  className="absolute right-2.5 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
                  tabIndex={-1}
                >
                  {showPw ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                </button>
              </div>
            </div>

            {/* Confirm password */}
            <div className="space-y-1.5">
              <label className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
                Confirm password
              </label>
              <div className="relative">
                <input
                  type={showCf ? "text" : "password"}
                  value={confirm}
                  onChange={(e) => setConfirm(e.target.value)}
                  required
                  placeholder="Repeat your password"
                  autoComplete="new-password"
                  className="w-full rounded-md border bg-background px-3 py-2 pr-10 text-sm outline-none ring-offset-background placeholder:text-muted-foreground focus:ring-2 focus:ring-ring focus:ring-offset-2"
                />
                <button
                  type="button"
                  onClick={() => setShowCf((v) => !v)}
                  className="absolute right-2.5 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
                  tabIndex={-1}
                >
                  {showCf ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                </button>
              </div>
            </div>

            <button
              type="submit"
              disabled={loading}
              className="w-full rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground hover:bg-primary/90 transition-colors disabled:opacity-60 flex items-center justify-center gap-2"
            >
              {loading && <Loader2 className="h-4 w-4 animate-spin" />}
              {loading ? "Setting password…" : "Set password & enter"}
            </button>
          </form>
        </div>

        <p className="text-center text-xs text-muted-foreground">
          Wrong account?{" "}
          <button
            type="button"
            onClick={async () => { await supabase.auth.signOut(); navigate({ to: "/login" }); }}
            className="underline hover:text-foreground"
          >
            Sign out
          </button>
        </p>
      </div>
    </div>
  );
}
