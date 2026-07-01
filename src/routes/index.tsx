import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Loader2 } from "lucide-react";

export const Route = createFileRoute("/")({
  component: IndexPage,
});

function IndexPage() {
  const navigate = useNavigate();

  useEffect(() => {
    supabase.auth.getSession().then(async ({ data: { session } }) => {
      if (!session) {
        navigate({ to: "/login" });
        return;
      }

      // Check onboarding state
      try {
        const { getAdminClient } = await import("@/lib/supabase.server");
        // Can't use server client on client side — use supabase client directly
        const { data } = await supabase
          .from("user_onboarding" as never)
          .select("step, completed_at")
          .eq("user_id", session.user.id)
          .maybeSingle();

        const row = data as { step: string; completed_at: string | null } | null;
        if (!row || row.step !== "complete" || !row.completed_at) {
          // No onboarding record or incomplete
          navigate({ to: "/onboarding/welcome" });
        } else {
          navigate({ to: "/admin/dashboard" });
        }
      } catch {
        // If onboarding table doesn't exist yet or any error, go to dashboard
        navigate({ to: "/admin/dashboard" });
      }
    });
  }, [navigate]);

  return (
    <div className="flex min-h-screen items-center justify-center">
      <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
    </div>
  );
}
