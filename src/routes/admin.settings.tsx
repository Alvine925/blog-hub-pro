import { createFileRoute } from "@tanstack/react-router";
import { queryOptions, useSuspenseQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { useState } from "react";
import { toast } from "sonner";
import { Loader2, Save } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { getSettings, saveSettings, type SiteSettings } from "@/lib/settings.functions";

const settingsQuery = queryOptions({
  queryKey: ["admin", "settings"],
  queryFn: () => getSettings(),
});

export const Route = createFileRoute("/admin/settings")({
  head: () => ({ meta: [{ title: "Settings — Admin" }] }),
  loader: ({ context }) => context.queryClient.ensureQueryData(settingsQuery),
  component: SettingsPage,
  errorComponent: ({ error }) => (
    <p className="text-sm text-destructive">Failed to load settings: {error.message}</p>
  ),
});

function SettingsPage() {
  const { data: initial } = useSuspenseQuery(settingsQuery);
  const queryClient = useQueryClient();
  const save = useServerFn(saveSettings);

  const [form, setForm] = useState<SiteSettings>({ ...initial });
  const [saving, setSaving] = useState(false);

  function set(key: keyof SiteSettings, value: string) {
    setForm((prev) => ({ ...prev, [key]: value }));
  }

  async function handleSave() {
    setSaving(true);
    try {
      await save({ data: form });
      await queryClient.invalidateQueries({ queryKey: ["admin", "settings"] });
      toast.success("Settings saved");
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Save failed");
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="space-y-10 max-w-2xl">
      <div>
        <h1 className="text-2xl font-bold">Settings</h1>
        <p className="text-sm text-muted-foreground">Configure your site and blog defaults</p>
      </div>

      {/* Site identity */}
      <div className="space-y-5">
        <h2 className="text-sm font-semibold uppercase tracking-wide text-muted-foreground">
          Site Identity
        </h2>
        <div className="space-y-2">
          <Label htmlFor="site_name">Site Name</Label>
          <Input
            id="site_name"
            value={form.site_name}
            onChange={(e) => set("site_name", e.target.value)}
            placeholder="Lunar CMS"
          />
        </div>
        <div className="space-y-2">
          <Label htmlFor="site_description">Site Description</Label>
          <Textarea
            id="site_description"
            value={form.site_description}
            onChange={(e) => set("site_description", e.target.value)}
            rows={2}
            placeholder="A short description of your site"
          />
        </div>
        <div className="space-y-2">
          <Label htmlFor="site_url">Site URL</Label>
          <Input
            id="site_url"
            value={form.site_url}
            onChange={(e) => set("site_url", e.target.value)}
            placeholder="https://yourdomain.com"
          />
          <p className="text-xs text-muted-foreground">Used for sitemap and Open Graph URLs</p>
        </div>
      </div>

      <div className="border-t border-border" />

      {/* Blog defaults */}
      <div className="space-y-5">
        <h2 className="text-sm font-semibold uppercase tracking-wide text-muted-foreground">
          Blog Defaults
        </h2>
        <div className="space-y-2">
          <Label htmlFor="blog_title">Blog Title</Label>
          <Input
            id="blog_title"
            value={form.blog_title}
            onChange={(e) => set("blog_title", e.target.value)}
            placeholder="Blog"
          />
        </div>
        <div className="space-y-2">
          <Label htmlFor="blog_description">Blog Description</Label>
          <Textarea
            id="blog_description"
            value={form.blog_description}
            onChange={(e) => set("blog_description", e.target.value)}
            rows={2}
            placeholder="Ideas, guides and inspiration"
          />
        </div>
        <div className="grid grid-cols-2 gap-4">
          <div className="space-y-2">
            <Label htmlFor="default_author">Default Author</Label>
            <Input
              id="default_author"
              value={form.default_author}
              onChange={(e) => set("default_author", e.target.value)}
              placeholder="Admin"
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="default_category">Default Category</Label>
            <Input
              id="default_category"
              value={form.default_category}
              onChange={(e) => set("default_category", e.target.value)}
              placeholder="General"
            />
          </div>
        </div>
      </div>

      <div className="border-t border-border" />

      {/* Social links */}
      <div className="space-y-5">
        <h2 className="text-sm font-semibold uppercase tracking-wide text-muted-foreground">
          Social Links
        </h2>
        <div className="space-y-2">
          <Label htmlFor="social_twitter">X / Twitter</Label>
          <Input
            id="social_twitter"
            value={form.social_twitter}
            onChange={(e) => set("social_twitter", e.target.value)}
            placeholder="@handle or full URL"
          />
        </div>
        <div className="space-y-2">
          <Label htmlFor="social_github">GitHub</Label>
          <Input
            id="social_github"
            value={form.social_github}
            onChange={(e) => set("social_github", e.target.value)}
            placeholder="https://github.com/yourorg"
          />
        </div>
        <div className="space-y-2">
          <Label htmlFor="social_linkedin">LinkedIn</Label>
          <Input
            id="social_linkedin"
            value={form.social_linkedin}
            onChange={(e) => set("social_linkedin", e.target.value)}
            placeholder="https://linkedin.com/company/yourorg"
          />
        </div>
      </div>

      <div className="pt-2">
        <Button onClick={handleSave} disabled={saving}>
          {saving ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Save className="mr-2 h-4 w-4" />}
          Save Settings
        </Button>
      </div>
    </div>
  );
}
