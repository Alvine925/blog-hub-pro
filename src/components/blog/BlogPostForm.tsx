import { useState, useRef, useEffect } from "react";
import { useNavigate } from "@tanstack/react-router";
import { useMutation, useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { toast } from "sonner";
import { marked } from "marked";
import { supabase } from "@/integrations/supabase/client";

import {
  Loader2, Upload, Eye, X, FileCode, Sparkles, Wand2, Clock,
  History, ChevronDown, ChevronUp, ImageIcon,
} from "lucide-react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Badge } from "@/components/ui/badge";
import { DraftFromIdeaPanel } from "@/components/blog/DraftFromIdeaPanel";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { RichTextEditor } from "@/components/blog/RichTextEditor";

import {
  BLOG_CATEGORIES,
  slugify,
  estimateReadingTime,
  formatBlogDate,
  type BlogPost,
} from "@/lib/blog-types";
import {
  upsertPost,
  uploadCoverImage,
  checkSlugAvailable,
} from "@/lib/blog.functions";
import { listPostVersions } from "@/lib/version.functions";

async function getAuthHeaders(): Promise<Record<string, string>> {
  const { data: { session } } = await supabase.auth.getSession();
  return session?.access_token ? { Authorization: `Bearer ${session.access_token}` } : {};
}

interface BlogPostFormProps {
  initial?: BlogPost;
  /** When set, redirects back to the workspace blogs list after save */
  workspaceId?: string;
}

export function BlogPostForm({ initial, workspaceId }: BlogPostFormProps) {
  const navigate = useNavigate();
  const upsert = useServerFn(upsertPost);
  const upload = useServerFn(uploadCoverImage);
  const checkSlug = useServerFn(checkSlugAvailable);
  const fileRef = useRef<HTMLInputElement>(null);

  // Core fields
  const [title, setTitle] = useState(initial?.title ?? "");
  const [slug, setSlug] = useState(initial?.slug ?? "");
  const [slugTouched, setSlugTouched] = useState(Boolean(initial));
  const [excerpt, setExcerpt] = useState(initial?.excerpt ?? "");
  const [category, setCategory] = useState(initial?.category ?? "General");
  const [tags, setTags] = useState<string[]>(initial?.tags ?? []);
  const [tagInput, setTagInput] = useState("");
  const [coverImage, setCoverImage] = useState(initial?.cover_image ?? "");
  const [content, setContent] = useState(initial?.content ?? "");
  const [authorName, setAuthorName] = useState(initial?.author_name ?? "Admin");
  const [featured, setFeatured] = useState(initial?.featured ?? false);

  // Publish mode
  const [publishMode, setPublishMode] = useState<"draft" | "publish" | "schedule">(
    initial?.status === "published" ? "publish"
    : initial?.status === "scheduled" ? "schedule"
    : "draft",
  );
  const [scheduledAt, setScheduledAt] = useState<string>(() => {
    if (initial?.scheduled_at) {
      const d = new Date(initial.scheduled_at);
      const pad = (n: number) => String(n).padStart(2, "0");
      return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
    }
    const d = new Date(Date.now() + 3600_000);
    const pad = (n: number) => String(n).padStart(2, "0");
    return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
  });

  // Basic SEO
  const [seoTitle, setSeoTitle] = useState(initial?.seo_title ?? "");
  const [metaDescription, setMetaDescription] = useState(initial?.meta_description ?? "");
  const [focusKeyword, setFocusKeyword] = useState(initial?.focus_keyword ?? "");

  // Extended SEO
  const [ogImage, setOgImage] = useState(initial?.og_image ?? "");
  const [ogTitle, setOgTitle] = useState(initial?.og_title ?? "");
  const [ogDescription, setOgDescription] = useState(initial?.og_description ?? "");
  const [twitterCard, setTwitterCard] = useState(initial?.twitter_card ?? "summary_large_image");
  const [canonicalUrl, setCanonicalUrl] = useState(initial?.canonical_url ?? "");
  const [robots, setRobots] = useState(initial?.robots ?? "index, follow");

  // UI state
  const [uploading, setUploading] = useState(false);
  const [generatingImage, setGeneratingImage] = useState(false);
  const [previewOpen, setPreviewOpen] = useState(false);
  const [slugStatus, setSlugStatus] = useState<"idle" | "checking" | "ok" | "taken">("idle");
  const [markdownOpen, setMarkdownOpen] = useState(false);
  const [markdownText, setMarkdownText] = useState("");
  const [refining, setRefining] = useState(false);
  const [seoOpen, setSeoOpen] = useState(false);
  const [historyOpen, setHistoryOpen] = useState(false);

  // Version history
  const { data: versions } = useQuery({
    queryKey: ["post-versions", initial?.id],
    queryFn: () => listPostVersions({ data: { postId: initial!.id } }),
    enabled: Boolean(initial?.id),
  });

  async function importMarkdown() {
    if (!markdownText.trim()) { toast.error("Paste some markdown first"); return; }
    let html: string;
    try {
      html = marked.parse(markdownText, { async: false }) as string;
    } catch {
      toast.error("Could not parse the markdown"); return;
    }
    setContent(html);
    setMarkdownOpen(false);
    setMarkdownText("");
    const toastId = toast.loading("Importing & generating title/slug/excerpt…");
    try {
      const { data, error } = await supabase.functions.invoke("refine-content", {
        body: { content: html, action: "metadata" },
        headers: await getAuthHeaders(),
      });
      if (error) throw new Error(error.message);
      if (data?.error) throw new Error(data.error);
      if (data?.title) { setTitle(data.title as string); if (!slugTouched) setSlug(slugify(data.title as string)); }
      if (data?.excerpt) setExcerpt(data.excerpt as string);
      if (Array.isArray(data?.tags) && data.tags.length) {
        setTags((prev) => { const m = [...prev]; for (const t of data.tags as string[]) { if (t && !m.includes(t)) m.push(t); } return m; });
      }
      toast.success("Markdown imported and details generated by AI", { id: toastId });
    } catch (err) {
      toast.error(err instanceof Error ? `Imported, but AI details failed: ${err.message}` : "Imported, but AI details failed", { id: toastId });
    }
  }

  function handleMarkdownFile(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    e.target.value = "";
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => setMarkdownText(String(reader.result ?? ""));
    reader.onerror = () => toast.error("Could not read the file");
    reader.readAsText(file);
  }

  async function refineWithAI(mode: "improve" | "grammar" | "shorten" | "expand" | "seo") {
    const current = content.trim();
    if (!current) { toast.error("Add some content before refining"); return; }
    setRefining(true);
    const toastId = toast.loading("AI is refining your content…");
    try {
      const { data, error } = await supabase.functions.invoke("refine-content", {
        body: { content: current, title, mode },
        headers: await getAuthHeaders(),
      });
      if (error) throw new Error(error.message);
      if (data?.error) throw new Error(data.error);
      if (!data?.refined) throw new Error("No content returned");
      setContent(data.refined as string);
      toast.success("Content refined by AI", { id: toastId });
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "AI refine failed", { id: toastId });
    } finally {
      setRefining(false);
    }
  }

  useEffect(() => {
    if (!slugTouched) setSlug(slugify(title));
  }, [title, slugTouched]);

  useEffect(() => {
    if (!slug) { setSlugStatus("idle"); return; }
    setSlugStatus("checking");
    const t = setTimeout(async () => {
      try {
        const { available } = await checkSlug({ data: { slug: slugify(slug), excludeId: initial?.id } });
        setSlugStatus(available ? "ok" : "taken");
      } catch { setSlugStatus("idle"); }
    }, 400);
    return () => clearTimeout(t);
  }, [slug, checkSlug, initial?.id]);

  function addTag() {
    const value = tagInput.trim().replace(/,/g, "");
    if (value && !tags.includes(value)) setTags([...tags, value]);
    setTagInput("");
  }

  async function generateCoverImage() {
    if (!title.trim() && !content.trim()) {
      toast.error("Add a title or some content first so AI can generate a relevant image");
      return;
    }
    setGeneratingImage(true);
    const toastId = toast.loading("Generating cover image…");
    try {
      const { data, error } = await supabase.functions.invoke("generate-cover-image", {
        body: {
          title:   title.trim() || "Blog post",
          excerpt: excerpt.trim() || null,
          topic:   tags[0] ?? null,
          category,
          post_id: initial?.id ?? null,
        },
        headers: await getAuthHeaders(),
      });
      if (error) throw new Error(error.message);
      if (data?.error) throw new Error(data.error);
      if (!data?.image_url) {
        const reasons: string[] = [];
        if (data?.hf_error)   reasons.push(`HuggingFace: ${data.hf_error}`);
        if (data?.serp_error) reasons.push(`SERP: ${data.serp_error}`);
        const detail = reasons.length ? `\n${reasons.join("\n")}` : "";
        throw new Error(`Image generation returned nothing.${detail}`);
      }
      setCoverImage(data.image_url as string);
      const source = data.source === "ai_generated" ? "AI image generated ✓" : "Cover image found ✓";
      toast.success(source, { id: toastId });
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Image generation failed", { id: toastId });
    } finally {
      setGeneratingImage(false);
    }
  }

  async function handleFile(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    if (file.size > 5 * 1024 * 1024) { toast.error("Image must be smaller than 5MB."); return; }
    setUploading(true);
    try {
      const base64 = await new Promise<string>((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = () => resolve(reader.result as string);
        reader.onerror = reject;
        reader.readAsDataURL(file);
      });
      const { url } = await upload({ data: { fileBase64: base64, fileName: file.name, contentType: file.type } });
      setCoverImage(url);
      toast.success("Cover image uploaded");
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Upload failed");
    } finally {
      setUploading(false);
      if (fileRef.current) fileRef.current.value = "";
    }
  }

  const isEdit = Boolean(initial?.id);

  const mutation = useMutation({
    mutationFn: (opts: { status: "draft" | "published" | "scheduled"; scheduledAt?: string }) =>
      upsert({
        data: {
          id: initial?.id,
          title,
          slug: slugify(slug || title),
          excerpt,
          content,
          cover_image: coverImage || null,
          category,
          tags,
          author_name: authorName,
          seo_title: seoTitle || null,
          meta_description: metaDescription || null,
          featured,
          status: opts.status,
          scheduled_at: opts.scheduledAt ?? null,
          og_image: ogImage || null,
          og_title: ogTitle || null,
          og_description: ogDescription || null,
          twitter_card: twitterCard || "summary_large_image",
          canonical_url: canonicalUrl || null,
          robots: robots || "index, follow",
          focus_keyword: focusKeyword || null,
        },
      }),
    onSuccess: (_res, opts) => {
      toast.success(
        opts.status === "published" ? (isEdit ? "Changes saved" : "Post published")
        : opts.status === "scheduled" ? "Post scheduled"
        : "Draft saved",
      );
      // In edit mode stay on the page; only navigate away when creating
      if (!isEdit) {
        if (workspaceId) {
          navigate({ to: "/admin/workspaces/$id/blogs", params: { id: workspaceId } });
        } else {
          navigate({ to: "/admin/blogs" });
        }
      }
    },
    onError: (err) => toast.error(err instanceof Error ? err.message : "Save failed"),
  });

  function submit() {
    if (!title.trim()) { toast.error("Title is required"); return; }
    if (slugStatus === "taken") { toast.error("Slug is already in use"); return; }
    if (publishMode === "schedule") {
      if (!scheduledAt) { toast.error("Please pick a date and time to schedule"); return; }
      const dt = new Date(scheduledAt);
      if (isNaN(dt.getTime()) || dt <= new Date()) { toast.error("Scheduled time must be in the future"); return; }
      mutation.mutate({ status: "scheduled", scheduledAt: dt.toISOString() });
      return;
    }
    mutation.mutate({ status: publishMode === "publish" ? "published" : "draft" });
  }

  const readingTime = estimateReadingTime(content);
  const saving = mutation.isPending;

  return (
    <div className="grid gap-8 lg:grid-cols-3">
      {/* ── Main column ─────────────────────────────── */}
      <div className="space-y-8 lg:col-span-2">

        {/* Draft from idea — new posts only */}
        {!isEdit && (
          <div className="flex items-center gap-3 rounded-xl border border-dashed border-primary/30 bg-primary/5 px-4 py-3">
            <div className="flex-1 min-w-0">
              <p className="text-sm font-medium text-primary">Have an idea?</p>
              <p className="text-xs text-muted-foreground">Describe it and AI will draft a title, outline, and opening paragraph instantly.</p>
            </div>
            <DraftFromIdeaPanel
              onDraftReady={({ title: t, excerpt: e, content: c }) => {
                setTitle(t);
                setExcerpt(e);
                setContent(c);
              }}
            />
          </div>
        )}

        {/* Post basics */}
        <div className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="title">Title</Label>
            <Input id="title" value={title} onChange={(e) => setTitle(e.target.value)} placeholder="How to Plan a Wedding" />
          </div>
          <div className="space-y-2">
            <Label htmlFor="slug">Slug</Label>
            <Input
              id="slug"
              value={slug}
              onChange={(e) => { setSlugTouched(true); setSlug(e.target.value); }}
              placeholder="how-to-plan-a-wedding"
            />
            <p className="text-xs text-muted-foreground">
              URL: /blogs/{slugify(slug || title) || "…"}{" "}
              {slugStatus === "checking" && "· checking…"}
              {slugStatus === "ok" && "· available ✓"}
              {slugStatus === "taken" && <span className="text-destructive">· already taken</span>}
            </p>
          </div>
          <div className="space-y-2">
            <Label htmlFor="excerpt">Excerpt</Label>
            <Textarea id="excerpt" value={excerpt} onChange={(e) => setExcerpt(e.target.value)} rows={2} placeholder="Short summary shown on cards and search results." />
          </div>
        </div>

        <div className="border-t border-border" />

        {/* Content */}
        <div className="space-y-3">
          <div className="flex items-center justify-between">
            <h3 className="text-sm font-semibold">Content</h3>
            <div className="flex items-center gap-2">
              <Button type="button" size="sm" variant="outline" onClick={() => setMarkdownOpen(true)}>
                <FileCode className="mr-2 h-4 w-4" /> Import Markdown
              </Button>
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button type="button" size="sm" variant="default" disabled={refining}>
                    {refining ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Sparkles className="mr-2 h-4 w-4" />}
                    Refine with AI
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end">
                  <DropdownMenuItem onClick={() => refineWithAI("improve")}><Wand2 className="mr-2 h-4 w-4" /> Improve writing</DropdownMenuItem>
                  <DropdownMenuItem onClick={() => refineWithAI("grammar")}>Fix grammar & spelling</DropdownMenuItem>
                  <DropdownMenuItem onClick={() => refineWithAI("shorten")}>Make it shorter</DropdownMenuItem>
                  <DropdownMenuItem onClick={() => refineWithAI("expand")}>Expand with detail</DropdownMenuItem>
                  <DropdownMenuItem onClick={() => refineWithAI("seo")}>Optimize for SEO</DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>
            </div>
          </div>
          <RichTextEditor value={content} onChange={setContent} />
          <p className="text-xs text-muted-foreground">~{readingTime} min read</p>
        </div>

        <div className="border-t border-border" />

        {/* SEO — collapsible */}
        <div className="space-y-0">
          <button
            type="button"
            className="flex w-full items-center justify-between py-1 text-sm font-semibold"
            onClick={() => setSeoOpen((o) => !o)}
          >
            SEO &amp; Open Graph
            {seoOpen ? <ChevronUp className="h-4 w-4 text-muted-foreground" /> : <ChevronDown className="h-4 w-4 text-muted-foreground" />}
          </button>

          {seoOpen && (
            <div className="space-y-4 pt-4">
              <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Basic SEO</p>
              <div className="space-y-2">
                <Label htmlFor="focusKeyword">Focus Keyword</Label>
                <Input id="focusKeyword" value={focusKeyword} onChange={(e) => setFocusKeyword(e.target.value)} placeholder="e.g. wedding planning tips" />
              </div>
              <div className="space-y-2">
                <Label htmlFor="seoTitle">SEO Title</Label>
                <Input id="seoTitle" value={seoTitle} onChange={(e) => setSeoTitle(e.target.value)} placeholder="Defaults to the post title if empty" />
                <p className="text-xs text-muted-foreground">{seoTitle.length} / 60 chars recommended</p>
              </div>
              <div className="space-y-2">
                <Label htmlFor="metaDescription">Meta Description</Label>
                <Textarea id="metaDescription" value={metaDescription} onChange={(e) => setMetaDescription(e.target.value)} rows={2} placeholder="Defaults to the excerpt if empty" />
                <p className="text-xs text-muted-foreground">{metaDescription.length} / 160 chars recommended</p>
              </div>
              <div className="space-y-2">
                <Label htmlFor="canonicalUrl">Canonical URL</Label>
                <Input id="canonicalUrl" value={canonicalUrl} onChange={(e) => setCanonicalUrl(e.target.value)} placeholder="https://yourdomain.com/blogs/slug (leave empty to use default)" />
              </div>
              <div className="space-y-2">
                <Label>Robots</Label>
                <Select value={robots} onValueChange={setRobots}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="index, follow">index, follow</SelectItem>
                    <SelectItem value="noindex, follow">noindex, follow</SelectItem>
                    <SelectItem value="index, nofollow">index, nofollow</SelectItem>
                    <SelectItem value="noindex, nofollow">noindex, nofollow</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div className="border-t border-border pt-4">
                <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground mb-4">Open Graph / Social</p>
              </div>
              <div className="space-y-2">
                <Label htmlFor="ogTitle">OG Title</Label>
                <Input id="ogTitle" value={ogTitle} onChange={(e) => setOgTitle(e.target.value)} placeholder="Defaults to SEO title if empty" />
              </div>
              <div className="space-y-2">
                <Label htmlFor="ogDescription">OG Description</Label>
                <Textarea id="ogDescription" value={ogDescription} onChange={(e) => setOgDescription(e.target.value)} rows={2} placeholder="Defaults to meta description if empty" />
              </div>
              <div className="space-y-2">
                <Label htmlFor="ogImage">OG Image URL</Label>
                <Input id="ogImage" value={ogImage} onChange={(e) => setOgImage(e.target.value)} placeholder="https://… (defaults to cover image if empty)" />
              </div>
              <div className="space-y-2">
                <Label>Twitter Card</Label>
                <Select value={twitterCard} onValueChange={setTwitterCard}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="summary_large_image">Summary Large Image</SelectItem>
                    <SelectItem value="summary">Summary</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* ── Sidebar ──────────────────────────────────── */}
      <div className="space-y-8">

        {/* Publish */}
        <div className="space-y-4">
          <h3 className="text-sm font-semibold">Publish</h3>
          <div className="grid grid-cols-3 gap-1 rounded-lg border border-border bg-muted p-1">
            {([{ id: "draft", label: "Draft" }, { id: "publish", label: "Now" }, { id: "schedule", label: "Schedule" }] as const).map((m) => (
              <button
                key={m.id}
                type="button"
                onClick={() => setPublishMode(m.id)}
                className={`rounded-md px-2 py-1.5 text-xs font-medium transition-colors ${
                  publishMode === m.id ? "bg-background text-foreground shadow-sm" : "text-muted-foreground hover:text-foreground"
                }`}
              >
                {m.id === "schedule" && <Clock className="mr-1 inline h-3 w-3" />}
                {m.label}
              </button>
            ))}
          </div>

          {publishMode === "schedule" && (
            <div className="space-y-1.5">
              <Label htmlFor="scheduledAt" className="text-xs text-muted-foreground">Publish at (your local time)</Label>
              <input
                id="scheduledAt"
                type="datetime-local"
                value={scheduledAt}
                onChange={(e) => setScheduledAt(e.target.value)}
                min={new Date(Date.now() + 60_000).toISOString().slice(0, 16)}
                className="w-full rounded-md border border-border bg-background px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-ring"
              />
            </div>
          )}

          <div className="flex items-center justify-between">
            <Label htmlFor="featured">Featured</Label>
            <Switch id="featured" checked={featured} onCheckedChange={setFeatured} />
          </div>

          <div className="flex flex-col gap-2 pt-1">
            <Button onClick={submit} disabled={saving}>
              {saving && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              {isEdit
                ? publishMode === "schedule" ? "Schedule" : "Save Changes"
                : publishMode === "publish" ? "Publish Now"
                : publishMode === "schedule" ? "Schedule"
                : "Save Draft"}
            </Button>
            <Button variant="ghost" onClick={() => setPreviewOpen(true)} type="button">
              <Eye className="mr-2 h-4 w-4" /> Preview
            </Button>
          </div>
        </div>

        <div className="border-t border-border" />

        {/* Organization */}
        <div className="space-y-4">
          <h3 className="text-sm font-semibold">Organization</h3>
          <div className="space-y-2">
            <Label>Category</Label>
            <Select value={category} onValueChange={setCategory}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                {BLOG_CATEGORIES.map((c) => <SelectItem key={c} value={c}>{c}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-2">
            <Label htmlFor="author">Author</Label>
            <Input id="author" value={authorName} onChange={(e) => setAuthorName(e.target.value)} />
          </div>
          <div className="space-y-2">
            <Label htmlFor="tags">Tags</Label>
            <Input
              id="tags"
              value={tagInput}
              onChange={(e) => setTagInput(e.target.value)}
              onKeyDown={(e) => { if (e.key === "Enter" || e.key === ",") { e.preventDefault(); addTag(); } }}
              placeholder="Type a tag and press Enter"
            />
            {tags.length > 0 && (
              <div className="flex flex-wrap gap-1.5 pt-1">
                {tags.map((t) => (
                  <Badge key={t} variant="secondary" className="gap-1">
                    {t}
                    <button type="button" onClick={() => setTags(tags.filter((x) => x !== t))} aria-label={`Remove ${t}`}>
                      <X className="h-3 w-3" />
                    </button>
                  </Badge>
                ))}
              </div>
            )}
          </div>
        </div>

        <div className="border-t border-border" />

        {/* Cover Image */}
        <div className="space-y-3">
          <h3 className="text-sm font-semibold">Cover Image</h3>
          {coverImage ? (
            <div className="relative overflow-hidden rounded-md border border-border">
              <img
                src={coverImage}
                alt="Cover preview"
                className="aspect-video w-full object-cover"
                onError={(e) => {
                  const img = e.currentTarget;
                  img.style.display = "none";
                  const parent = img.parentElement;
                  if (parent && !parent.querySelector(".cover-error")) {
                    const err = document.createElement("div");
                    err.className = "cover-error flex aspect-video items-center justify-center text-xs text-destructive p-3 text-center";
                    err.textContent = "⚠ Image failed to load — the URL may be hotlink-blocked. Try uploading the image directly or paste a different URL.";
                    parent.insertBefore(err, img);
                  }
                }}
              />
              <Button size="icon" variant="secondary" className="absolute right-2 top-2 h-7 w-7" onClick={() => setCoverImage("")} type="button">
                <X className="h-4 w-4" />
              </Button>
            </div>
          ) : (
            <div className="flex aspect-video items-center justify-center rounded-md border border-dashed border-border text-sm text-muted-foreground">
              No cover image
            </div>
          )}
          <Input value={coverImage} onChange={(e) => setCoverImage(e.target.value)} placeholder="Paste image URL" />
          <input ref={fileRef} type="file" accept="image/*" className="hidden" onChange={handleFile} />
          <div className="flex gap-2">
            <Button
              variant="outline"
              className="flex-1"
              onClick={() => fileRef.current?.click()}
              disabled={uploading || generatingImage}
              type="button"
            >
              {uploading ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Upload className="mr-2 h-4 w-4" />}
              Upload
            </Button>
            <Button
              variant="outline"
              className="flex-1"
              onClick={generateCoverImage}
              disabled={uploading || generatingImage}
              type="button"
            >
              {generatingImage
                ? <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                : <ImageIcon className="mr-2 h-4 w-4" />}
              {generatingImage ? "Generating…" : "Generate"}
            </Button>
          </div>
        </div>

        {/* Version history (edit only) */}
        {initial?.id && (
          <>
            <div className="border-t border-border" />
            <div className="space-y-3">
              <button
                type="button"
                className="flex w-full items-center justify-between text-sm font-semibold"
                onClick={() => setHistoryOpen((o) => !o)}
              >
                <span className="flex items-center gap-2">
                  <History className="h-4 w-4" /> Version History
                  {versions && versions.length > 0 && (
                    <Badge variant="secondary" className="text-xs">{versions.length}</Badge>
                  )}
                </span>
                {historyOpen ? <ChevronUp className="h-4 w-4 text-muted-foreground" /> : <ChevronDown className="h-4 w-4 text-muted-foreground" />}
              </button>
              {historyOpen && (
                <div className="space-y-0">
                  {!versions || versions.length === 0 ? (
                    <p className="text-xs text-muted-foreground">No saved versions yet. Versions are saved automatically each time you update this post.</p>
                  ) : (
                    versions.map((v) => (
                      <div key={v.id} className="border-b border-border/50 py-2.5 last:border-0">
                        <div className="flex items-start justify-between gap-2">
                          <div className="min-w-0">
                            <p className="truncate text-xs font-medium">{v.title || "Untitled"}</p>
                            <p className="text-xs text-muted-foreground">{formatBlogDate(v.created_at)}</p>
                          </div>
                          <Badge variant="secondary" className="shrink-0 text-xs">{v.status}</Badge>
                        </div>
                      </div>
                    ))
                  )}
                </div>
              )}
            </div>
          </>
        )}
      </div>

      {/* Import Markdown dialog */}
      <Dialog open={markdownOpen} onOpenChange={setMarkdownOpen}>
        <DialogContent className="max-w-2xl">
          <DialogHeader><DialogTitle>Import Markdown</DialogTitle></DialogHeader>
          <p className="text-sm text-muted-foreground">
            Upload a <code>.md</code> file or paste Markdown below. It will be converted to rich text and replace the current editor content.
          </p>
          <input
            type="file"
            accept=".md,.markdown,text/markdown,text/plain"
            onChange={handleMarkdownFile}
            className="block w-full text-sm text-muted-foreground file:mr-3 file:rounded-md file:border-0 file:bg-primary file:px-3 file:py-2 file:text-sm file:font-medium file:text-primary-foreground hover:file:bg-primary/90"
          />
          <Textarea
            value={markdownText}
            onChange={(e) => setMarkdownText(e.target.value)}
            rows={12}
            placeholder={"# My heading\n\nWrite your post in **markdown**…"}
            className="font-mono text-sm"
          />
          <div className="flex justify-end gap-2">
            <Button variant="outline" type="button" onClick={() => setMarkdownOpen(false)}>Cancel</Button>
            <Button type="button" onClick={importMarkdown}><FileCode className="mr-2 h-4 w-4" /> Import</Button>
          </div>
        </DialogContent>
      </Dialog>

      {/* Preview dialog */}
      <Dialog open={previewOpen} onOpenChange={setPreviewOpen}>
        <DialogContent className="max-h-[85vh] max-w-3xl overflow-y-auto">
          <DialogHeader><DialogTitle>Preview</DialogTitle></DialogHeader>
          {coverImage && <img src={coverImage} alt="" className="aspect-video w-full rounded-md object-cover" />}
          <Badge variant="secondary" className="w-fit">{category}</Badge>
          <h1 className="text-3xl font-bold">{title || "Untitled"}</h1>
          {excerpt && <p className="text-muted-foreground">{excerpt}</p>}
          <div className="blog-content" dangerouslySetInnerHTML={{ __html: content }} />
        </DialogContent>
      </Dialog>
    </div>
  );
}
