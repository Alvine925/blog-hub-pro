import { createFileRoute } from "@tanstack/react-router";
import { Check, Zap, Lock } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";

export const Route = createFileRoute("/admin/billing")({
  head: () => ({ meta: [{ title: "Billing — Admin" }] }),
  component: BillingPage,
});

const FREE_FEATURES = [
  "Up to 100 blog posts",
  "1 workspace",
  "Media storage (1 GB)",
  "REST API access",
  "Webhooks (3 endpoints)",
  "Analytics (last 30 days)",
  "Version history (10 versions)",
];

const PRO_FEATURES = [
  "Unlimited blog posts",
  "Unlimited workspaces",
  "Media storage (50 GB)",
  "REST + GraphQL API",
  "Unlimited webhooks",
  "Analytics (all time, exports)",
  "Full version history",
  "Custom domain",
  "Team members (up to 10)",
  "Priority support",
];

function BillingPage() {
  return (
    <div className="max-w-3xl space-y-12">
      <div>
        <h1 className="text-2xl font-bold">Billing &amp; Plan</h1>
        <p className="text-sm text-muted-foreground">Manage your subscription and usage.</p>
      </div>

      <div className="space-y-3">
        <h2 className="text-sm font-semibold uppercase tracking-wide text-muted-foreground">Current Plan</h2>
        <div className="flex items-center gap-4 border-t border-border pt-4">
          <div className="flex-1">
            <div className="flex items-center gap-2">
              <span className="text-xl font-bold">Free</span>
              <Badge variant="secondary">Active</Badge>
            </div>
            <p className="text-sm text-muted-foreground mt-1">No payment method required. Free forever.</p>
          </div>
          <div className="text-right">
            <p className="text-2xl font-bold">$0</p>
            <p className="text-xs text-muted-foreground">per month</p>
          </div>
        </div>
      </div>

      <div className="border-t border-border" />

      <div className="grid gap-8 sm:grid-cols-2">
        <div className="space-y-4">
          <h2 className="text-sm font-semibold uppercase tracking-wide text-muted-foreground">Free — Current</h2>
          <ul className="space-y-2.5">
            {FREE_FEATURES.map((f) => (
              <li key={f} className="flex items-start gap-2 text-sm">
                <Check className="h-4 w-4 text-green-500 shrink-0 mt-0.5" />
                {f}
              </li>
            ))}
          </ul>
        </div>

        <div className="space-y-4">
          <div className="flex items-center gap-2">
            <h2 className="text-sm font-semibold uppercase tracking-wide text-muted-foreground">Pro</h2>
            <Badge className="bg-primary/10 text-primary border-primary/20 text-[10px]">Recommended</Badge>
          </div>
          <ul className="space-y-2.5">
            {PRO_FEATURES.map((f) => (
              <li key={f} className="flex items-start gap-2 text-sm">
                <Zap className="h-4 w-4 text-primary shrink-0 mt-0.5" />
                {f}
              </li>
            ))}
          </ul>
          <div className="pt-2">
            <p className="text-2xl font-bold">$29 <span className="text-sm font-normal text-muted-foreground">/ month</span></p>
            <Button className="mt-3 w-full" disabled>
              <Lock className="mr-2 h-4 w-4" /> Upgrade to Pro
            </Button>
            <p className="mt-2 text-xs text-center text-muted-foreground">
              Payment processing coming soon. Contact us to upgrade early.
            </p>
          </div>
        </div>
      </div>

      <div className="border-t border-border" />

      <div className="space-y-4">
        <h2 className="text-sm font-semibold uppercase tracking-wide text-muted-foreground">Usage This Month</h2>
        <div className="grid gap-4 sm:grid-cols-3">
          {[
            { label: "Blog Posts", value: "—", limit: "100" },
            { label: "Storage", value: "—", limit: "1 GB" },
            { label: "API Calls", value: "—", limit: "10,000" },
          ].map((u) => (
            <div key={u.label} className="border-b border-border pb-4 sm:border-0">
              <p className="text-xs text-muted-foreground uppercase tracking-wide">{u.label}</p>
              <p className="mt-1 text-2xl font-bold">{u.value}</p>
              <p className="text-xs text-muted-foreground">of {u.limit} limit</p>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
