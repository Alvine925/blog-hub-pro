import { createFileRoute } from "@tanstack/react-router";
import { queryOptions, useSuspenseQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { useState } from "react";
import { toast } from "sonner";
import { Save, Loader2 } from "lucide-react";
import { getSettings, saveSettings } from "@/lib/settings.functions";
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

function WorkspaceSettings() {
  const { data: settings } = useSuspenseQuery(settingsQuery);
  const queryClient = useQueryClient();
  const doSave = useServerFn(saveSettings);

  const [form, setForm] = useState({
    site_name: (settings as any)?.site_name ?? "",
    site_description: (settings as any)?.site_description ?? "",
    site_url: (settings as any)?.site_url ?? "",
    logo_url: (settings as any)?.logo_url ?? "",
    favicon_url: (settings as any)?.favicon_url ?? "",
    posts_per_page: String((settings as any)?.posts_per_page ?? 10),
    seo_title_template: (settings as any)?.seo_title_template ?? "",
    seo_default_description: (settings as any)?.seo_default_description ?? "",
    twitter_handle: (settings as any)?.twitter_handle ?? "",
    og_image_url: (settings as any)?.og_image_url ?? "",
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

  return (
    <div className="min-h-full px-8 py-8">
      <div className="mb-8">
        <h1 className="text-xl font-semibold">Settings</h1>
        <p className="mt-0.5 text-sm text-muted-foreground">Configure your workspace and site settings.</p>
      </div>

      <form onSubmit={handleSubmit} className="max-w-2xl space-y-5">
        {/* General */}
        <div className="mb-2 border-b border-border pb-2">
          <h2 className="text-[11px] font-semibold uppercase tracking-widest text-muted-foreground">General</h2>
        </div>

        <Field
          label="Site Name"
          id="site_name"
          value={form.site_name}
          onChange={(v) => update("site_name", v)}
          placeholder="My Awesome Blog"
        />
        <Field
          label="Site Description"
          id="site_description"
          type="textarea"
          value={form.site_description}
          onChange={(v) => update("site_description", v)}
          placeholder="A short description of your site"
        />
        <Field
          label="Site URL"
          id="site_url"
          type="url"
          value={form.site_url}
          onChange={(v) => update("site_url", v)}
          placeholder="https://yourdomain.com"
        />
        <Field
          label="Posts Per Page"
          id="posts_per_page"
          type="number"
          value={form.posts_per_page}
          onChange={(v) => update("posts_per_page", v)}
        />

        {/* SEO */}
        <div className="mb-2 border-b border-border pb-2 pt-4">
          <h2 className="text-[11px] font-semibold uppercase tracking-widest text-muted-foreground">SEO</h2>
        </div>

        <Field
          label="SEO Title Template"
          id="seo_title_template"
          value={form.seo_title_template}
          onChange={(v) => update("seo_title_template", v)}
          placeholder="{title} | {site_name}"
          hint="Use {title} and {site_name} as placeholders."
        />
        <Field
          label="Default Meta Description"
          id="seo_default_description"
          type="textarea"
          value={form.seo_default_description}
          onChange={(v) => update("seo_default_description", v)}
          placeholder="Default description for pages without a custom one"
        />
        <Field
          label="Default OG Image URL"
          id="og_image_url"
          type="url"
          value={form.og_image_url}
          onChange={(v) => update("og_image_url", v)}
          placeholder="https://yourdomain.com/og.png"
        />

        {/* Social */}
        <div className="mb-2 border-b border-border pb-2 pt-4">
          <h2 className="text-[11px] font-semibold uppercase tracking-widest text-muted-foreground">Social</h2>
        </div>

        <Field
          label="Twitter / X Handle"
          id="twitter_handle"
          value={form.twitter_handle}
          onChange={(v) => update("twitter_handle", v)}
          placeholder="@yourhandle"
        />

        <div className="pt-2">
          <Button type="submit" disabled={busy}>
            {busy ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Save className="mr-2 h-4 w-4" />}
            Save settings
          </Button>
        </div>
      </form>
    </div>
  );
}
