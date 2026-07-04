import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { toast } from "sonner";
import { ArrowLeft, Loader2 } from "lucide-react";
import { upsertNews, type NewsItem } from "@/lib/news.functions";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";

export const Route = createFileRoute("/admin/workspaces/$id/news/new")({
  component: NewsNew,
});

function NewsNew() {
  const { id: workspaceId } = Route.useParams();
  const navigate    = useNavigate();
  const queryClient = useQueryClient();
  const doUpsert    = useServerFn(upsertNews);

  const [form, setForm] = useState<Partial<NewsItem>>({
    workspace_id:    workspaceId,
    title:           "",
    slug:            "",
    excerpt:         "",
    content:         "",
    category:        "General",
    source_name:     null,
    source_url:      null,
    breaking:        false,
    featured:        false,
    status:          "draft",
    seo_title:       null,
    meta_description: null,
  });
  const [saving, setSaving] = useState(false);

  function set<K extends keyof typeof form>(key: K, value: typeof form[K]) {
    setForm((prev) => ({ ...prev, [key]: value }));
  }

  async function handleSave(publish = false) {
    if (!form.title?.trim()) { toast.error("Title is required"); return; }
    setSaving(true);
    try {
      const saved = await doUpsert({
        data: {
          workspaceId,
          title:            form.title ?? "",
          slug:             form.slug ?? "",
          excerpt:          form.excerpt ?? "",
          content:          form.content ?? "",
          category:         form.category ?? "General",
          source_name:      form.source_name ?? null,
          source_url:       form.source_url ?? null,
          breaking:         form.breaking ?? false,
          featured:         form.featured ?? false,
          status:           publish ? "published" : "draft",
          seo_title:        form.seo_title ?? null,
          meta_description: form.meta_description ?? null,
        },
      });
      toast.success("News item created");
      await queryClient.invalidateQueries({ queryKey: ["admin", "news", workspaceId] });
      navigate({
        to: "/admin/workspaces/$id/news/$newsId",
        params: { id: workspaceId, newsId: saved.id },
      });
    } catch (e) { toast.error(e instanceof Error ? e.message : "Failed to create"); }
    finally { setSaving(false); }
  }

  return (
    <div className="min-h-full px-4 py-4 sm:px-8 sm:py-8 max-w-2xl">
      <Link
        to="/admin/workspaces/$id/news"
        params={{ id: workspaceId }}
        className="inline-flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground transition-colors mb-6"
      >
        <ArrowLeft className="h-3.5 w-3.5" /> News
      </Link>

      <h1 className="text-xl font-semibold mb-8">New News Item</h1>

      <div className="space-y-6">
        <div className="space-y-2">
          <Label htmlFor="title">Title *</Label>
          <Input id="title" value={form.title ?? ""} onChange={(e) => set("title", e.target.value)} placeholder="News headline" autoFocus />
        </div>

        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <div className="space-y-2">
            <Label htmlFor="category">Category</Label>
            <Input id="category" value={form.category ?? ""} onChange={(e) => set("category", e.target.value)} placeholder="e.g. Company News" />
          </div>
          <div className="space-y-2">
            <Label htmlFor="source_name">Source Name</Label>
            <Input id="source_name" value={form.source_name ?? ""} onChange={(e) => set("source_name", e.target.value || null)} placeholder="e.g. TechCrunch" />
          </div>
        </div>

        <div className="space-y-2">
          <Label htmlFor="source_url">Source URL</Label>
          <Input id="source_url" value={form.source_url ?? ""} onChange={(e) => set("source_url", e.target.value || null)} placeholder="https://..." />
        </div>

        <div className="space-y-2">
          <Label htmlFor="excerpt">Excerpt</Label>
          <Textarea id="excerpt" rows={3} value={form.excerpt ?? ""} onChange={(e) => set("excerpt", e.target.value)} placeholder="Short summary shown in listings" />
        </div>

        <div className="space-y-2">
          <Label htmlFor="content">Content (HTML)</Label>
          <Textarea id="content" rows={14} className="font-mono text-xs" value={form.content ?? ""} onChange={(e) => set("content", e.target.value)} placeholder="<p>Full article body...</p>" />
        </div>

        <div className="space-y-2">
          <Label htmlFor="seo_title">SEO Title</Label>
          <Input id="seo_title" value={form.seo_title ?? ""} onChange={(e) => set("seo_title", e.target.value || null)} />
        </div>

        <div className="space-y-2">
          <Label htmlFor="meta_description">Meta Description</Label>
          <Textarea id="meta_description" rows={2} value={form.meta_description ?? ""} onChange={(e) => set("meta_description", e.target.value || null)} />
        </div>

        <div className="flex flex-col gap-3 py-2">
          <div className="flex items-center gap-3">
            <Switch id="breaking" checked={form.breaking ?? false} onCheckedChange={(v) => set("breaking", v)} />
            <Label htmlFor="breaking" className="cursor-pointer">Breaking news</Label>
          </div>
          <div className="flex items-center gap-3">
            <Switch id="featured" checked={form.featured ?? false} onCheckedChange={(v) => set("featured", v)} />
            <Label htmlFor="featured" className="cursor-pointer">Featured</Label>
          </div>
        </div>

        <div className="flex gap-3 pt-4 border-t border-border">
          <button
            type="button" onClick={() => handleSave(false)} disabled={saving}
            className="flex items-center gap-1.5 rounded-md border border-border px-4 py-2 text-sm font-medium hover:bg-muted transition-colors disabled:opacity-50"
          >
            {saving && <Loader2 className="h-3.5 w-3.5 animate-spin" />} Save Draft
          </button>
          <button
            type="button" onClick={() => handleSave(true)} disabled={saving}
            className="flex items-center gap-1.5 rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground hover:bg-primary/90 transition-colors disabled:opacity-50"
          >
            {saving && <Loader2 className="h-3.5 w-3.5 animate-spin" />} Create & Publish
          </button>
        </div>
      </div>
    </div>
  );
}
