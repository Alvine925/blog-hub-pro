import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { queryOptions, useSuspenseQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { useState } from "react";
import { toast } from "sonner";
import { ArrowLeft, Loader2 } from "lucide-react";
import { adminGetArticle, upsertArticle, type Article } from "@/lib/article.functions";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";

const detailQuery = (id: string, workspaceId: string) =>
  queryOptions({
    queryKey: ["admin", "article", id, workspaceId],
    queryFn: () => adminGetArticle({ data: { id, workspaceId } }),
  });

export const Route = createFileRoute("/admin/workspaces/$id/articles/$articleId/edit")({
  loader: ({ context, params }) =>
    context.queryClient.ensureQueryData(detailQuery(params.articleId, params.id)),
  component: ArticleEdit,
});

const ARTICLE_TYPES = [
  { value: "guide",         label: "Guide" },
  { value: "tutorial",      label: "Tutorial" },
  { value: "case-study",    label: "Case Study" },
  { value: "documentation", label: "Documentation" },
  { value: "educational",   label: "Educational" },
] as const;

function ArticleEdit() {
  const { id: workspaceId, articleId } = Route.useParams();
  const isNew = articleId === "new";
  const { data: existing } = useSuspenseQuery(detailQuery(articleId, workspaceId));
  const queryClient = useQueryClient();
  const navigate    = useNavigate();
  const doUpsert    = useServerFn(upsertArticle);

  const [form, setForm] = useState<Partial<Article>>(() => ({
    workspace_id:    workspaceId,
    title:           existing?.title ?? "",
    slug:            existing?.slug ?? "",
    excerpt:         existing?.excerpt ?? "",
    content:         existing?.content ?? "",
    category:        existing?.category ?? "",
    author_name:     existing?.author_name ?? "AI Assistant",
    article_type:    existing?.article_type ?? "guide",
    status:          existing?.status ?? "draft",
    featured:        existing?.featured ?? false,
    seo_title:       existing?.seo_title ?? "",
    meta_description: existing?.meta_description ?? "",
  }));
  const [saving, setSaving] = useState(false);

  function set<K extends keyof typeof form>(key: K, value: typeof form[K]) {
    setForm((prev) => ({ ...prev, [key]: value }));
  }

  async function handleSave(publish = false) {
    setSaving(true);
    try {
      const payload = {
        ...form,
        workspace_id: workspaceId,
        ...(isNew ? {} : { id: articleId }),
        ...(publish ? { status: "published" as const } : {}),
      };
      const saved = await doUpsert({ data: { article: payload as Partial<Article> & { workspace_id: string } } });
      toast.success(isNew ? "Article created" : "Article saved");
      await queryClient.invalidateQueries({ queryKey: ["admin", "articles", workspaceId] });
      navigate({
        to: "/admin/workspaces/$id/articles/$articleId",
        params: { id: workspaceId, articleId: saved.id },
      });
    } catch (e) { toast.error(e instanceof Error ? e.message : "Failed to save"); }
    finally { setSaving(false); }
  }

  return (
    <div className="min-h-full px-8 py-8 max-w-2xl">
      <Link
        to={isNew ? "/admin/workspaces/$id/articles" : "/admin/workspaces/$id/articles/$articleId"}
        params={isNew ? { id: workspaceId } : { id: workspaceId, articleId }}
        className="inline-flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground transition-colors mb-6"
      >
        <ArrowLeft className="h-3.5 w-3.5" /> {isNew ? "Articles" : "Back to article"}
      </Link>

      <h1 className="text-xl font-semibold mb-8">{isNew ? "New Article" : `Edit: ${existing?.title}`}</h1>

      <div className="space-y-6">
        <div className="space-y-2">
          <Label htmlFor="title">Title *</Label>
          <Input id="title" value={form.title ?? ""} onChange={(e) => set("title", e.target.value)} placeholder="Article title" />
        </div>

        <div className="grid grid-cols-2 gap-4">
          <div className="space-y-2">
            <Label htmlFor="article_type">Type</Label>
            <select
              id="article_type"
              value={form.article_type ?? "guide"}
              onChange={(e) => set("article_type", e.target.value as Article["article_type"])}
              className="flex h-9 w-full rounded-md border border-input bg-background px-3 py-1 text-sm shadow-sm transition-colors focus:outline-none focus:ring-1 focus:ring-ring"
            >
              {ARTICLE_TYPES.map((t) => (
                <option key={t.value} value={t.value}>{t.label}</option>
              ))}
            </select>
          </div>
          <div className="space-y-2">
            <Label htmlFor="category">Category</Label>
            <Input id="category" value={form.category ?? ""} onChange={(e) => set("category", e.target.value)} placeholder="e.g. Getting Started" />
          </div>
        </div>

        <div className="space-y-2">
          <Label htmlFor="author_name">Author</Label>
          <Input id="author_name" value={form.author_name ?? ""} onChange={(e) => set("author_name", e.target.value)} />
        </div>

        <div className="space-y-2">
          <Label htmlFor="excerpt">Excerpt</Label>
          <Textarea
            id="excerpt" rows={3}
            value={form.excerpt ?? ""}
            onChange={(e) => set("excerpt", e.target.value)}
            placeholder="Short summary shown in article listings"
          />
        </div>

        <div className="space-y-2">
          <Label htmlFor="content">Content (HTML)</Label>
          <Textarea
            id="content" rows={16} className="font-mono text-xs"
            value={form.content ?? ""}
            onChange={(e) => set("content", e.target.value)}
            placeholder="<h2>Introduction</h2><p>...</p>"
          />
        </div>

        <div className="space-y-2">
          <Label htmlFor="seo_title">SEO Title</Label>
          <Input id="seo_title" value={form.seo_title ?? ""} onChange={(e) => set("seo_title", e.target.value)} />
        </div>

        <div className="space-y-2">
          <Label htmlFor="meta_description">Meta Description</Label>
          <Textarea id="meta_description" rows={2} value={form.meta_description ?? ""} onChange={(e) => set("meta_description", e.target.value)} />
        </div>

        <div className="flex items-center gap-3 py-2">
          <Switch
            id="featured"
            checked={form.featured ?? false}
            onCheckedChange={(v) => set("featured", v)}
          />
          <Label htmlFor="featured" className="cursor-pointer">Featured article</Label>
        </div>

        <div className="flex gap-3 pt-4 border-t border-border">
          <button
            type="button"
            onClick={() => handleSave(false)}
            disabled={saving || !form.title}
            className="flex items-center gap-1.5 rounded-md border border-border px-4 py-2 text-sm font-medium hover:bg-muted transition-colors disabled:opacity-50"
          >
            {saving && <Loader2 className="h-3.5 w-3.5 animate-spin" />}
            Save Draft
          </button>
          <button
            type="button"
            onClick={() => handleSave(true)}
            disabled={saving || !form.title}
            className="flex items-center gap-1.5 rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground hover:bg-primary/90 transition-colors disabled:opacity-50"
          >
            {saving && <Loader2 className="h-3.5 w-3.5 animate-spin" />}
            {isNew ? "Create & Publish" : "Save & Publish"}
          </button>
        </div>
      </div>
    </div>
  );
}
