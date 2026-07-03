import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { queryOptions, useSuspenseQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { useState } from "react";
import { toast } from "sonner";
import { ArrowLeft, Loader2 } from "lucide-react";
import { adminGetNews, upsertNews, type NewsItem } from "@/lib/news.functions";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";

const detailQuery = (id: string, workspaceId: string) =>
  queryOptions({
    queryKey: ["admin", "news", id, workspaceId],
    queryFn:  () => adminGetNews({ data: { id, workspaceId } }),
  });

export const Route = createFileRoute("/admin/workspaces/$id/news/$newsId/edit")({
  loader: ({ context, params }) =>
    context.queryClient.ensureQueryData(detailQuery(params.newsId, params.id)),
  component: NewsEdit,
  errorComponent: ({ error }) => <p className="p-8 text-sm text-red-600">{error.message}</p>,
});

function NewsEdit() {
  const { id: workspaceId, newsId } = Route.useParams();
  const { data: initial } = useSuspenseQuery(detailQuery(newsId, workspaceId));
  const queryClient = useQueryClient();
  const navigate    = useNavigate();
  const doUpsert    = useServerFn(upsertNews);

  const [form, setForm] = useState<Partial<NewsItem>>({ ...initial });
  const [saving, setSaving] = useState(false);

  function set<K extends keyof NewsItem>(key: K, value: NewsItem[K]) {
    setForm((prev) => ({ ...prev, [key]: value }));
  }

  async function handleSave() {
    if (!form.title?.trim()) { toast.error("Title is required"); return; }
    setSaving(true);
    try {
      await doUpsert({
        data: {
          id:               newsId,
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
          status:           form.status ?? "draft",
          seo_title:        form.seo_title ?? null,
          meta_description: form.meta_description ?? null,
        },
      });
      toast.success("News item saved");
      await queryClient.invalidateQueries({ queryKey: ["admin", "news", newsId, workspaceId] });
      await queryClient.invalidateQueries({ queryKey: ["admin", "news", workspaceId] });
      navigate({ to: "/admin/workspaces/$id/news/$newsId", params: { id: workspaceId, newsId } });
    } catch (e) { toast.error(e instanceof Error ? e.message : "Failed to save"); }
    finally { setSaving(false); }
  }

  return (
    <div className="min-h-full px-8 py-8 max-w-2xl">
      <Link
        to="/admin/workspaces/$id/news/$newsId"
        params={{ id: workspaceId, newsId }}
        className="inline-flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground transition-colors mb-6"
      >
        <ArrowLeft className="h-3.5 w-3.5" /> Back to news item
      </Link>

      <h1 className="text-xl font-semibold mb-8">Edit News Item</h1>

      <div className="space-y-6">
        <div className="space-y-2">
          <Label htmlFor="title">Title *</Label>
          <Input id="title" value={form.title ?? ""} onChange={(e) => set("title", e.target.value)} autoFocus />
        </div>

        <div className="grid grid-cols-2 gap-4">
          <div className="space-y-2">
            <Label htmlFor="category">Category</Label>
            <Input id="category" value={form.category ?? ""} onChange={(e) => set("category", e.target.value)} />
          </div>
          <div className="space-y-2">
            <Label htmlFor="status">Status</Label>
            <select
              id="status"
              value={form.status ?? "draft"}
              onChange={(e) => set("status", e.target.value as NewsItem["status"])}
              className="flex h-9 w-full rounded-md border border-input bg-background px-3 py-1 text-sm shadow-sm focus:outline-none focus:ring-1 focus:ring-ring"
            >
              <option value="draft">Draft</option>
              <option value="published">Published</option>
              <option value="scheduled">Scheduled</option>
            </select>
          </div>
        </div>

        <div className="space-y-2">
          <Label htmlFor="source_name">Source Name</Label>
          <Input id="source_name" value={form.source_name ?? ""} onChange={(e) => set("source_name", e.target.value || null)} />
        </div>

        <div className="space-y-2">
          <Label htmlFor="source_url">Source URL</Label>
          <Input id="source_url" value={form.source_url ?? ""} onChange={(e) => set("source_url", e.target.value || null)} />
        </div>

        <div className="space-y-2">
          <Label htmlFor="excerpt">Excerpt</Label>
          <Textarea id="excerpt" rows={3} value={form.excerpt ?? ""} onChange={(e) => set("excerpt", e.target.value)} />
        </div>

        <div className="space-y-2">
          <Label htmlFor="content">Content (HTML)</Label>
          <Textarea id="content" rows={16} className="font-mono text-xs" value={form.content ?? ""} onChange={(e) => set("content", e.target.value)} />
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
          <Link
            to="/admin/workspaces/$id/news/$newsId"
            params={{ id: workspaceId, newsId }}
            className="rounded-md border border-border px-4 py-2 text-sm font-medium hover:bg-muted transition-colors"
          >
            Cancel
          </Link>
          <button
            type="button" onClick={handleSave} disabled={saving}
            className="flex items-center gap-1.5 rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground hover:bg-primary/90 transition-colors disabled:opacity-50"
          >
            {saving && <Loader2 className="h-3.5 w-3.5 animate-spin" />} Save Changes
          </button>
        </div>
      </div>
    </div>
  );
}
