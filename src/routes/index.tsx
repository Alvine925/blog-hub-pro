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

      // Invited users must set a permanent password before entering the app
      if (session.user.user_metadata?.password_change_required === true) {
        navigate({ to: "/set-password" });
        return;
      }

      // Check if user is a workspace-only member — skip onboarding, go to their workspace
      try {
        const { data: cmsUser } = await supabase
          .from("cms_users" as never)
          .select("platform_role")
          .eq("id", session.user.id)
          .maybeSingle();

        const cu = cmsUser as { platform_role: string } | null;

        if (cu?.platform_role === "member") {
          const { data: memberships } = await supabase
            .from("workspace_members" as never)
            .select("workspace_id")
            .eq("user_id", session.user.id)
            .eq("status", "active")
            .order("created_at", { ascending: true })
            .limit(1);

          const first = (memberships as { workspace_id: string }[] | null)?.[0];
          if (first) {
            navigate({ to: `/admin/workspaces/${first.workspace_id}` as "/" });
          } else {
            navigate({ to: "/admin/dashboard" });
          }
          return;
        }
      } catch {
        // cms_users table may not exist yet in dev — fall through
      }

      // Platform admins / superadmins → check onboarding
      try {
        const { data } = await supabase
          .from("user_onboarding" as never)
          .select("step, completed_at")
          .eq("user_id", session.user.id)
          .maybeSingle();

        const row = data as { step: string; completed_at: string | null } | null;
        if (!row || row.step !== "complete" || !row.completed_at) {
          navigate({ to: "/onboarding/welcome" });
        } else {
          navigate({ to: "/admin/dashboard" });
        }
      } catch {
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
