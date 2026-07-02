import { createFileRoute } from "@tanstack/react-router";
import { queryOptions, useSuspenseQuery, useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { useState } from "react";
import { toast } from "sonner";
import { Save, Loader2, ToggleLeft, ToggleRight } from "lucide-react";
import { getSettings, saveSettings } from "@/lib/settings.functions";
import { getEngagementSettings, saveEngagementSettings } from "@/lib/engagement.functions";
import type { EngagementSettings } from "@/lib/engagement.functions";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";

const settingsQuery = queryOptions({
  queryKey: ["admin", "settings"],
  queryFn: () => getSettings(),
});

export const Route = createFileRoute("/admin/workspaces/$id/settings")({
  loader: ({ context }) => context.queryClient.ensureQueryData(settingsQuery),
  component: WorkspaceSettings,
  errorComponent: ({ error }) => <p className="p-8 text-sm text-red-600">{error.message}</p>,
});

// ── Field helpers ─────────────────────────────────────────────────────────────

function Field({ label, id, type = "text", placeholder, value, onChange, hint }: {
  label: string; id: string; type?: string; placeholder?: string;
  value: string; onChange: (v: string) => void; hint?: string;
}) {
  return (
    <div className="border-b border-border pb-5">
      <label htmlFor={id} className="block text-sm font-medium mb-1.5">{label}</label>
      {hint && <p className="text-xs text-muted-foreground mb-2">{hint}</p>}
      {type === "textarea" ? (
        <Textarea
          id={id}
          value={value}
          onChange={(e) => onChange(e.target.value)}
          placeholder={placeholder}
          rows={3}
          className="resize-none max-w-lg"
        />
      ) : (
        <Input
          id={id}
          type={type}
          value={value}
          onChange={(e) => onChange(e.target.value)}
          placeholder={placeholder}
          className="max-w-lg"
        />
      )}
    </div>
  );
}

function Toggle({ label, hint, checked, onChange }: {
  label: string; hint?: string; checked: boolean; onChange: (v: boolean) => void;
}) {
  return (
    <div className="flex items-center justify-between py-3 border-b border-border">
      <div>
        <p className="text-sm font-medium">{label}</p>
        {hint && <p className="text-xs text-muted-foreground mt-0.5">{hint}</p>}
      </div>
      <button
        type="button"
        onClick={() => onChange(!checked)}
        className="shrink-0 ml-4"
        aria-checked={checked}
        role="switch"
      >
        {checked ? (
          <ToggleRight className="h-7 w-7 text-primary" />
        ) : (
          <ToggleLeft className="h-7 w-7 text-muted-foreground" />
        )}
      </button>
    </div>
  );
}

function SectionHeader({ title }: { title: string }) {
  return (
    <div className="mb-2 border-b border-border pb-2 pt-6">
      <h2 className="text-[11px] font-semibold uppercase tracking-widest text-muted-foreground">{title}</h2>
    </div>
  );
}

// ── Main component ────────────────────────────────────────────────────────────

function WorkspaceSettings() {
  const { id: workspaceId } = Route.useParams();
  const { data: settings } = useSuspenseQuery(settingsQuery);
  const queryClient = useQueryClient();

  const doSave            = useServerFn(saveSettings);
  const doGetEngagement   = useServerFn(getEngagementSettings);
  const doSaveEngagement  = useServerFn(saveEngagementSettings);

  // ── General / SEO / Social form state ────────────────────────────────────

  const [form, setForm] = useState({
    site_name:             (settings as any)?.site_name ?? "",
    site_description:      (settings as any)?.site_description ?? "",
    site_url:              (settings as any)?.site_url ?? "",
    logo_url:              (settings as any)?.logo_url ?? "",
    favicon_url:           (settings as any)?.favicon_url ?? "",
    posts_per_page:        String((settings as any)?.posts_per_page ?? 10),
    seo_title_template:    (settings as any)?.seo_title_template ?? "",
    seo_default_description:(settings as any)?.seo_default_description ?? "",
    twitter_handle:        (settings as any)?.twitter_handle ?? "",
    og_image_url:          (settings as any)?.og_image_url ?? "",
  });

  const [busy, setBusy] = useState(false);

  function update(key: string, value: string) {
    setForm((prev) => ({ ...prev, [key]: value }));
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    try {
      await doSave({
        data: {
          ...form,
          posts_per_page: parseInt(form.posts_per_page) || 10,
        },
      });
      toast.success("Settings saved");
      await queryClient.invalidateQueries({ queryKey: ["admin", "settings"] });
    } catch (err) { toast.error(err instanceof Error ? err.message : "Failed"); }
    finally { setBusy(false); }
  }

  // ── Engagement form state ─────────────────────────────────────────────────

  const { data: engData, isLoading: engLoading } = useQuery({
    queryKey: ["admin", "engagement-settings", workspaceId],
    queryFn: () => doGetEngagement({ data: { workspaceId } }),
  });

  const DEFAULT_ENG: EngagementSettings = {
    features: { likes: true, comments: true, socialShare: true, relatedPosts: true, viewTracking: true, poweredBy: true },
    branding: { enabled: true, text: "Powered by Lunar CMS", url: "https://lunarcms.com" },
    commentSettings: { requireApproval: true, allowGuest: true, maxDepth: 3 },
  };

  const [eng, setEng] = useState<EngagementSettings | null>(null);
  const [engBusy, setEngBusy] = useState(false);

  // Sync engagement state when data arrives
  const effectiveEng: EngagementSettings = eng ?? engData ?? DEFAULT_ENG;

  function setFeature(key: keyof EngagementSettings["features"], value: boolean) {
    setEng((prev) => ({
      ...(prev ?? effectiveEng),
      features: { ...(prev ?? effectiveEng).features, [key]: value },
    }));
  }

  function setBranding(key: keyof EngagementSettings["branding"], value: boolean | string) {
    setEng((prev) => ({
      ...(prev ?? effectiveEng),
      branding: { ...(prev ?? effectiveEng).branding, [key]: value },
    }));
  }

  function setCommentSetting(key: keyof EngagementSettings["commentSettings"], value: boolean | number) {
    setEng((prev) => ({
      ...(prev ?? effectiveEng),
      commentSettings: { ...(prev ?? effectiveEng).commentSettings, [key]: value },
    }));
  }

  async function handleSaveEngagement() {
    setEngBusy(true);
    try {
      await doSaveEngagement({ data: { workspaceId, ...effectiveEng } });
      toast.success("Engagement settings saved");
      await queryClient.invalidateQueries({ queryKey: ["admin", "engagement-settings", workspaceId] });
    } catch (err) { toast.error(err instanceof Error ? err.message : "Failed"); }
    finally { setEngBusy(false); }
  }

  // ── Render ────────────────────────────────────────────────────────────────

  return (
    <div className="min-h-full px-8 py-8">
      <div className="mb-8">
        <h1 className="text-xl font-semibold">Settings</h1>
        <p className="mt-0.5 text-sm text-muted-foreground">Configure your workspace and site settings.</p>
      </div>

      {/* ── General / SEO / Social ── */}
      <form onSubmit={handleSubmit} className="max-w-2xl space-y-5">
        <SectionHeader title="General" />

        <Field label="Site Name" id="site_name" value={form.site_name}
          onChange={(v) => update("site_name", v)} placeholder="My Awesome Blog" />
        <Field label="Site Description" id="site_description" type="textarea" value={form.site_description}
          onChange={(v) => update("site_description", v)} placeholder="A short description of your site" />
        <Field label="Site URL" id="site_url" type="url" value={form.site_url}
          onChange={(v) => update("site_url", v)} placeholder="https://yourdomain.com" />
        <Field label="Posts Per Page" id="posts_per_page" type="number" value={form.posts_per_page}
          onChange={(v) => update("posts_per_page", v)} />

        <SectionHeader title="SEO" />

        <Field label="SEO Title Template" id="seo_title_template" value={form.seo_title_template}
          onChange={(v) => update("seo_title_template", v)} placeholder="{title} | {site_name}"
          hint="Use {title} and {site_name} as placeholders." />
        <Field label="Default Meta Description" id="seo_default_description" type="textarea" value={form.seo_default_description}
          onChange={(v) => update("seo_default_description", v)} placeholder="Default description for pages without a custom one" />
        <Field label="Default OG Image URL" id="og_image_url" type="url" value={form.og_image_url}
          onChange={(v) => update("og_image_url", v)} placeholder="https://yourdomain.com/og.png" />

        <SectionHeader title="Social" />

        <Field label="Twitter / X Handle" id="twitter_handle" value={form.twitter_handle}
          onChange={(v) => update("twitter_handle", v)} placeholder="@yourhandle" />

        <div className="pt-2">
          <Button type="submit" disabled={busy}>
            {busy ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Save className="mr-2 h-4 w-4" />}
            Save settings
          </Button>
        </div>
      </form>

      {/* ── Engagement settings ── */}
      <div className="mt-10 max-w-2xl">
        <SectionHeader title="Engagement Features" />
        <p className="mb-4 text-xs text-muted-foreground">
          Control which engagement features are exposed through the public REST API.
          External websites read these flags to decide what to render.
        </p>

        {engLoading ? (
          <div className="flex items-center gap-2 py-4 text-sm text-muted-foreground">
            <Loader2 className="h-4 w-4 animate-spin" /> Loading…
          </div>
        ) : (
          <div className="space-y-0">
            <Toggle label="Likes" hint="Allow visitors to like blog posts"
              checked={effectiveEng.features.likes}
              onChange={(v) => setFeature("likes", v)} />
            <Toggle label="Comments" hint="Allow visitors to submit comments"
              checked={effectiveEng.features.comments}
              onChange={(v) => setFeature("comments", v)} />
            <Toggle label="Social Share" hint="Expose social share metadata via API"
              checked={effectiveEng.features.socialShare}
              onChange={(v) => setFeature("socialShare", v)} />
            <Toggle label="Related Posts" hint="Include related posts in API responses"
              checked={effectiveEng.features.relatedPosts}
              onChange={(v) => setFeature("relatedPosts", v)} />
            <Toggle label="View Tracking" hint="Track individual page views"
              checked={effectiveEng.features.viewTracking}
              onChange={(v) => setFeature("viewTracking", v)} />
            <Toggle label="Powered by Lunar CMS" hint="Return branding metadata in API responses"
              checked={effectiveEng.features.poweredBy}
              onChange={(v) => setFeature("poweredBy", v)} />
          </div>
        )}

        <SectionHeader title="Branding" />
        <p className="mb-4 text-xs text-muted-foreground">
          When enabled, the API includes branding metadata that external sites can use to render a footer attribution.
        </p>

        {!engLoading && (
          <div className="space-y-4">
            <Toggle label="Show Powered by Lunar CMS"
              hint="Include branding object in all blog API responses"
              checked={effectiveEng.branding.enabled}
              onChange={(v) => setBranding("enabled", v)} />
            <div className="border-b border-border pb-5">
              <label className="block text-sm font-medium mb-1.5">Branding Text</label>
              <Input
                value={effectiveEng.branding.text}
                onChange={(e) => setBranding("text", e.target.value)}
                placeholder="Powered by Lunar CMS"
                className="max-w-lg"
              />
            </div>
            <div className="border-b border-border pb-5">
              <label className="block text-sm font-medium mb-1.5">Branding URL</label>
              <Input
                value={effectiveEng.branding.url}
                onChange={(e) => setBranding("url", e.target.value)}
                placeholder="https://lunarcms.com"
                className="max-w-lg"
              />
            </div>
          </div>
        )}

        <SectionHeader title="Comment Settings" />

        {!engLoading && (
          <div className="space-y-0">
            <Toggle label="Require Approval"
              hint="New comments are held as pending until approved by an admin"
              checked={effectiveEng.commentSettings.requireApproval}
              onChange={(v) => setCommentSetting("requireApproval", v)} />
            <Toggle label="Allow Guest Comments"
              hint="Allow visitors to comment without an account"
              checked={effectiveEng.commentSettings.allowGuest}
              onChange={(v) => setCommentSetting("allowGuest", v)} />
            <div className="flex items-center justify-between py-3 border-b border-border">
              <div>
                <p className="text-sm font-medium">Max Reply Depth</p>
                <p className="text-xs text-muted-foreground mt-0.5">Maximum nesting level for threaded replies</p>
              </div>
              <Input
                type="number"
                min={1}
                max={10}
                value={effectiveEng.commentSettings.maxDepth}
                onChange={(e) => setCommentSetting("maxDepth", parseInt(e.target.value) || 3)}
                className="w-20 text-center"
              />
            </div>
          </div>
        )}

        <div className="pt-6">
          <Button onClick={handleSaveEngagement} disabled={engBusy || engLoading}>
            {engBusy ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Save className="mr-2 h-4 w-4" />}
            Save engagement settings
          </Button>
        </div>
      </div>
    </div>
  );
}
