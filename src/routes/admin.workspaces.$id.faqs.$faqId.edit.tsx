import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { queryOptions, useSuspenseQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { useState } from "react";
import { toast } from "sonner";
import { ArrowLeft, Loader2 } from "lucide-react";
import { adminGetFaq, upsertFaq, type Faq } from "@/lib/faq.functions";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";

const detailQuery = (id: string, workspaceId: string) =>
  queryOptions({
    queryKey: ["admin", "faq", id, workspaceId],
    queryFn:  () => adminGetFaq({ data: { id, workspaceId } }),
  });

export const Route = createFileRoute("/admin/workspaces/$id/faqs/$faqId/edit")({
  loader: ({ context, params }) =>
    context.queryClient.ensureQueryData(detailQuery(params.faqId, params.id)),
  component: FaqEdit,
  errorComponent: ({ error }) => <p className="p-8 text-sm text-red-600">{error.message}</p>,
});

function FaqEdit() {
  const { id: workspaceId, faqId } = Route.useParams();
  const { data: initial } = useSuspenseQuery(detailQuery(faqId, workspaceId));
  const queryClient = useQueryClient();
  const navigate    = useNavigate();
  const doUpsert    = useServerFn(upsertFaq);

  const [form, setForm] = useState<Partial<Faq>>({ ...initial });
  const [saving, setSaving] = useState(false);

  function set<K extends keyof Faq>(key: K, value: Faq[K]) {
    setForm((prev) => ({ ...prev, [key]: value }));
  }

  async function handleSave() {
    if (!form.question?.trim()) { toast.error("Question is required"); return; }
    if (!form.answer?.trim())   { toast.error("Answer is required");   return; }
    setSaving(true);
    try {
      await doUpsert({
        data: {
          id:               faqId,
          workspaceId,
          question:         form.question ?? "",
          answer:           form.answer ?? "",
          category:         form.category ?? "General",
          sort_order:       form.sort_order ?? 0,
          featured:         form.featured ?? false,
          status:           form.status ?? "draft",
          seo_title:        form.seo_title ?? null,
          meta_description: form.meta_description ?? null,
        },
      });
      toast.success("FAQ saved");
      await queryClient.invalidateQueries({ queryKey: ["admin", "faq", faqId, workspaceId] });
      await queryClient.invalidateQueries({ queryKey: ["admin", "faqs", workspaceId] });
      navigate({ to: "/admin/workspaces/$id/faqs/$faqId", params: { id: workspaceId, faqId } });
    } catch (e) { toast.error(e instanceof Error ? e.message : "Failed to save"); }
    finally { setSaving(false); }
  }

  return (
    <div className="min-h-full px-4 py-4 sm:px-8 sm:py-8 max-w-2xl">
      <Link
        to="/admin/workspaces/$id/faqs/$faqId"
        params={{ id: workspaceId, faqId }}
        className="inline-flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground transition-colors mb-6"
      >
        <ArrowLeft className="h-3.5 w-3.5" /> Back to FAQ
      </Link>

      <h1 className="text-xl font-semibold mb-8">Edit FAQ</h1>

      <div className="space-y-6">
        <div className="space-y-2">
          <Label htmlFor="question">Question *</Label>
          <Input id="question" value={form.question ?? ""} onChange={(e) => set("question", e.target.value)} autoFocus />
        </div>

        <div className="space-y-2">
          <Label htmlFor="answer">Answer *</Label>
          <Textarea id="answer" rows={10} value={form.answer ?? ""} onChange={(e) => set("answer", e.target.value)} />
        </div>

        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <div className="space-y-2">
            <Label htmlFor="category">Category</Label>
            <Input id="category" value={form.category ?? ""} onChange={(e) => set("category", e.target.value)} />
          </div>
          <div className="space-y-2">
            <Label htmlFor="sort_order">Sort Order</Label>
            <Input
              id="sort_order"
              type="number"
              value={form.sort_order ?? 0}
              onChange={(e) => set("sort_order", parseInt(e.target.value, 10) || 0)}
            />
          </div>
        </div>

        <div className="space-y-2">
          <Label htmlFor="status">Status</Label>
          <select
            id="status"
            value={form.status ?? "draft"}
            onChange={(e) => set("status", e.target.value as Faq["status"])}
            className="flex h-9 w-full rounded-md border border-input bg-background px-3 py-1 text-sm shadow-sm focus:outline-none focus:ring-1 focus:ring-ring"
          >
            <option value="draft">Draft</option>
            <option value="published">Published</option>
          </select>
        </div>

        <div className="space-y-2">
          <Label htmlFor="seo_title">SEO Title</Label>
          <Input id="seo_title" value={form.seo_title ?? ""} onChange={(e) => set("seo_title", e.target.value || null)} />
        </div>

        <div className="space-y-2">
          <Label htmlFor="meta_description">Meta Description</Label>
          <Textarea id="meta_description" rows={2} value={form.meta_description ?? ""} onChange={(e) => set("meta_description", e.target.value || null)} />
        </div>

        <div className="flex items-center gap-3 py-2">
          <Switch id="featured" checked={form.featured ?? false} onCheckedChange={(v) => set("featured", v)} />
          <Label htmlFor="featured" className="cursor-pointer">Featured FAQ</Label>
        </div>

        <div className="flex gap-3 pt-4 border-t border-border">
          <Link
            to="/admin/workspaces/$id/faqs/$faqId"
            params={{ id: workspaceId, faqId }}
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
