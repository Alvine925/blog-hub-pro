import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { toast } from "sonner";
import { ArrowLeft, Loader2 } from "lucide-react";
import { upsertFaq, type Faq } from "@/lib/faq.functions";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";

export const Route = createFileRoute("/admin/workspaces/$id/faqs/new")({
  component: FaqNew,
});

function FaqNew() {
  const { id: workspaceId } = Route.useParams();
  const navigate    = useNavigate();
  const queryClient = useQueryClient();
  const doUpsert    = useServerFn(upsertFaq);

  const [form, setForm] = useState<Partial<Faq>>({
    workspace_id:    workspaceId,
    question:        "",
    answer:          "",
    category:        "General",
    sort_order:      0,
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
    if (!form.question?.trim()) { toast.error("Question is required"); return; }
    if (!form.answer?.trim())   { toast.error("Answer is required");   return; }
    setSaving(true);
    try {
      const saved = await doUpsert({
        data: {
          workspaceId,
          question:         form.question ?? "",
          answer:           form.answer ?? "",
          category:         form.category ?? "General",
          sort_order:       form.sort_order ?? 0,
          featured:         form.featured ?? false,
          status:           publish ? "published" : "draft",
          seo_title:        form.seo_title ?? null,
          meta_description: form.meta_description ?? null,
        },
      });
      toast.success("FAQ created");
      await queryClient.invalidateQueries({ queryKey: ["admin", "faqs", workspaceId] });
      navigate({
        to: "/admin/workspaces/$id/faqs/$faqId",
        params: { id: workspaceId, faqId: saved.id },
      });
    } catch (e) { toast.error(e instanceof Error ? e.message : "Failed to create"); }
    finally { setSaving(false); }
  }

  return (
    <div className="min-h-full px-4 py-4 sm:px-8 sm:py-8 max-w-2xl">
      <Link
        to="/admin/workspaces/$id/faqs"
        params={{ id: workspaceId }}
        className="inline-flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground transition-colors mb-6"
      >
        <ArrowLeft className="h-3.5 w-3.5" /> FAQs
      </Link>

      <h1 className="text-xl font-semibold mb-8">New FAQ</h1>

      <div className="space-y-6">
        <div className="space-y-2">
          <Label htmlFor="question">Question *</Label>
          <Input id="question" value={form.question ?? ""} onChange={(e) => set("question", e.target.value)} placeholder="What is...?" autoFocus />
        </div>

        <div className="space-y-2">
          <Label htmlFor="answer">Answer *</Label>
          <Textarea id="answer" rows={8} value={form.answer ?? ""} onChange={(e) => set("answer", e.target.value)} placeholder="The answer to the question..." />
        </div>

        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <div className="space-y-2">
            <Label htmlFor="category">Category</Label>
            <Input id="category" value={form.category ?? ""} onChange={(e) => set("category", e.target.value)} placeholder="e.g. Billing" />
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
