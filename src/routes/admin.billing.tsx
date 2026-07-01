import { createFileRoute } from "@tanstack/react-router";
import { createServerFn } from "@tanstack/react-start";
import { queryOptions, useSuspenseQuery } from "@tanstack/react-query";
import { Check, Zap, Lock, CreditCard, TrendingUp, HardDrive, Code2 } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

interface BillingPlan {
  id: string;
  slug: string;
  name: string;
  description: string | null;
  price_usd: number;
  interval: string;
  max_posts: number | null;
  max_workspaces: number | null;
  max_storage_gb: number | null;
  max_api_calls: number | null;
  max_team_members: number | null;
  features: string[];
}

interface BillingUsage {
  post_count: number;
  storage_bytes: number;
  api_call_count: number;
  member_count: number;
}

const getBillingData = createServerFn({ method: "GET" }).handler(async () => {
  const { getAdminClient } = await import("@/lib/supabase.server");
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const supabase = (await getAdminClient()) as any;

  // Resolve workspace server-side so usage rows are always scoped to this tenant
  const { data: ws } = await supabase
    .from("workspaces").select("id").eq("slug", "default").single();
  const workspaceId: string | null = ws?.id ?? null;

  // billing_plans are global (no workspace column) — safe to read without filter
  const plansResult = await supabase
    .from("billing_plans").select("*").eq("is_active", true).order("price_usd");

  // billing_usage and subscriptions are scoped to the resolved workspace
  const usageQuery = supabase
    .from("billing_usage")
    .select("post_count, storage_bytes, api_call_count, member_count")
    .order("period_start", { ascending: false })
    .limit(1)
    .maybeSingle();

  const usageResult = workspaceId
    ? await usageQuery.eq("workspace_id", workspaceId)
    : await usageQuery.is("workspace_id", null);

  return {
    plans: (plansResult.data ?? []) as BillingPlan[],
    currentPlanSlug: "free" as string,
    usage: (usageResult.data ?? { post_count: 0, storage_bytes: 0, api_call_count: 0, member_count: 1 }) as BillingUsage,
  };
});

const billingQuery = queryOptions({
  queryKey: ["admin", "billing"],
  queryFn: () => getBillingData(),
});

export const Route = createFileRoute("/admin/billing")({
  head: () => ({ meta: [{ title: "Billing — Admin" }] }),
  loader: ({ context }) => context.queryClient.ensureQueryData(billingQuery),
  component: BillingPage,
  errorComponent: ({ error }) => (
    <p className="text-sm text-destructive">Failed to load billing: {error.message}</p>
  ),
});

function formatBytes(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  if (bytes < 1024 * 1024 * 1024) return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
  return `${(bytes / (1024 * 1024 * 1024)).toFixed(2)} GB`;
}

function UsageBar({ current, max, label }: { current: number; max: number | null; label: string }) {
  const pct = max ? Math.min((current / max) * 100, 100) : 0;
  const isNearLimit = pct > 80;
  return (
    <div className="space-y-1.5">
      <div className="flex justify-between text-xs">
        <span className="text-muted-foreground">{label}</span>
        <span className={cn("font-medium", isNearLimit ? "text-amber-600" : "")}>
          {current} {max ? `/ ${max}` : "(unlimited)"}
        </span>
      </div>
      {max && (
        <div className="h-1.5 overflow-hidden rounded-full bg-muted">
          <div
            className={cn("h-full rounded-full transition-all", isNearLimit ? "bg-amber-500" : "bg-primary")}
            style={{ width: `${pct}%` }}
          />
        </div>
      )}
    </div>
  );
}

function BillingPage() {
  const { data } = useSuspenseQuery(billingQuery);
  const { plans, currentPlanSlug, usage } = data;

  const currentPlan = plans.find((p) => p.slug === currentPlanSlug) ?? plans[0];
  const proPlan = plans.find((p) => p.slug === "pro");

  return (
    <div className="space-y-10 max-w-4xl">
      <div>
        <h1 className="text-2xl font-bold">Billing &amp; Plan</h1>
        <p className="text-sm text-muted-foreground">Manage your subscription and monitor usage</p>
      </div>

      {/* Current plan banner */}
      {currentPlan && (
        <div className="rounded-xl border border-border bg-background p-6 shadow-sm">
          <div className="flex items-start justify-between gap-4">
            <div className="flex items-center gap-4">
              <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-primary/10">
                <CreditCard className="h-6 w-6 text-primary" />
              </div>
              <div>
                <div className="flex items-center gap-2">
                  <p className="text-lg font-bold">{currentPlan.name}</p>
                  <Badge variant="secondary" className="bg-green-50 text-green-700 border-green-200">Active</Badge>
                </div>
                <p className="text-sm text-muted-foreground">{currentPlan.description}</p>
              </div>
            </div>
            <div className="text-right shrink-0">
              <p className="text-2xl font-bold">
                {currentPlan.price_usd === 0 ? "Free" : `$${currentPlan.price_usd}`}
              </p>
              {currentPlan.price_usd > 0 && (
                <p className="text-xs text-muted-foreground">per {currentPlan.interval}</p>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Usage this period */}
      <div className="rounded-xl border border-border bg-background p-6 shadow-sm">
        <div className="flex items-center gap-2 mb-5">
          <TrendingUp className="h-4 w-4 text-primary" />
          <h2 className="text-sm font-semibold">Usage This Period</h2>
        </div>
        <div className="grid gap-5 sm:grid-cols-2">
          <UsageBar label="Blog Posts" current={usage.post_count} max={currentPlan?.max_posts ?? null} />
          <UsageBar label="API Calls" current={usage.api_call_count} max={currentPlan?.max_api_calls ?? null} />
          <div className="space-y-1.5">
            <div className="flex justify-between text-xs">
              <span className="text-muted-foreground flex items-center gap-1"><HardDrive className="h-3 w-3" /> Storage Used</span>
              <span className="font-medium">
                {formatBytes(usage.storage_bytes)} / {currentPlan?.max_storage_gb ? `${currentPlan.max_storage_gb} GB` : "Unlimited"}
              </span>
            </div>
            {currentPlan?.max_storage_gb && (
              <div className="h-1.5 overflow-hidden rounded-full bg-muted">
                <div
                  className="h-full rounded-full bg-primary transition-all"
                  style={{ width: `${Math.min((usage.storage_bytes / (currentPlan.max_storage_gb * 1024 * 1024 * 1024)) * 100, 100)}%` }}
                />
              </div>
            )}
          </div>
          <div className="space-y-1.5">
            <div className="flex justify-between text-xs">
              <span className="text-muted-foreground flex items-center gap-1"><Code2 className="h-3 w-3" /> Team Members</span>
              <span className="font-medium">
                {usage.member_count} / {currentPlan?.max_team_members ?? "Unlimited"}
              </span>
            </div>
          </div>
        </div>
      </div>

      {/* Plan comparison */}
      <div>
        <h2 className="mb-4 text-sm font-semibold">Plans</h2>
        <div className="grid gap-4 sm:grid-cols-3">
          {plans.map((plan) => {
            const isCurrent = plan.slug === currentPlanSlug;
            const isPro = plan.slug === "pro";
            return (
              <div
                key={plan.id}
                className={cn(
                  "relative rounded-xl border p-5 transition-shadow hover:shadow-sm",
                  isPro ? "border-primary shadow-sm ring-1 ring-primary/20" : "border-border bg-background",
                  isCurrent ? "bg-primary/5" : "bg-background",
                )}
              >
                {isPro && (
                  <div className="absolute -top-3 left-1/2 -translate-x-1/2">
                    <Badge className="bg-primary text-primary-foreground text-[10px] px-2">Recommended</Badge>
                  </div>
                )}
                <div className="mb-4">
                  <h3 className="font-bold text-base">{plan.name}</h3>
                  <p className="mt-0.5 text-xs text-muted-foreground">{plan.description}</p>
                  <div className="mt-3">
                    <span className="text-2xl font-bold">
                      {plan.price_usd === 0 ? "$0" : `$${plan.price_usd}`}
                    </span>
                    <span className="text-xs text-muted-foreground"> / {plan.interval}</span>
                  </div>
                </div>

                <ul className="space-y-2 mb-5">
                  {(plan.features as string[]).slice(0, 5).map((f) => (
                    <li key={f} className="flex items-start gap-2 text-xs">
                      {isPro
                        ? <Zap className="h-3.5 w-3.5 shrink-0 text-primary mt-0.5" />
                        : <Check className="h-3.5 w-3.5 shrink-0 text-green-500 mt-0.5" />}
                      {f}
                    </li>
                  ))}
                  {(plan.features as string[]).length > 5 && (
                    <li className="text-xs text-muted-foreground pl-5">+{(plan.features as string[]).length - 5} more</li>
                  )}
                </ul>

                {isCurrent ? (
                  <Button variant="secondary" className="w-full" disabled size="sm">Current plan</Button>
                ) : plan.slug === "enterprise" ? (
                  <Button variant="outline" className="w-full" size="sm">Contact us</Button>
                ) : (
                  <Button className="w-full" size="sm" disabled>
                    <Lock className="mr-2 h-3.5 w-3.5" /> Upgrade
                  </Button>
                )}
              </div>
            );
          })}
        </div>
        {proPlan && (
          <p className="mt-3 text-center text-xs text-muted-foreground">
            Payment processing coming soon. Contact us to upgrade early.
          </p>
        )}
      </div>
    </div>
  );
}
