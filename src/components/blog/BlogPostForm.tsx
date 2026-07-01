import { useState, useRef, useEffect } from "react";
import { useNavigate } from "@tanstack/react-router";
import { useMutation } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { toast } from "sonner";
import { marked } from "marked";
import { supabase } from "@/integrations/supabase/client";
import { Loader2, Upload, Eye, X, FileCode, Sparkles, Wand2 } from "lucide-react";


import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Badge } from "@/components/ui/badge";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
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
  type BlogPost,
} from "@/lib/blog-types";
import {
  upsertPost,
  uploadCoverImage,
  checkSlugAvailable,
} from "@/lib/blog.functions";

interface BlogPostFormProps {
  initial?: BlogPost;
}

export function BlogPostForm({ initial }: BlogPostFormProps) {
  const navigate = useNavigate();
  const upsert = useServerFn(upsertPost);
  const upload = useServerFn(uploadCoverImage);
  const checkSlug = useServerFn(checkSlugAvailable);
  const fileRef = useRef<HTMLInputElement>(null);

  const [title, setTitle] = useState(initial?.title ?? "");
  const [slug, setSlug] = useState(initial?.slug ?? "");
  const [slugTouched, setSlugTouched] = useState(Boolean(initial));
  const [excerpt, setExcerpt] = useState(initial?.excerpt ?? "");
  const [category, setCategory] = useState(initial?.category ?? "General");
  const [tags, setTags] = useState<string[]>(initial?.tags ?? []);
  const [tagInput, setTagInput] = useState("");
  const [coverImage, setCoverImage] = useState(initial?.cover_image ?? "");
  const [content, setContent] = useState(initial?.content ?? "");
  const [seoTitle, setSeoTitle] = useState(initial?.seo_title ?? "");
  const [metaDescription, setMetaDescription] = useState(
    initial?.meta_description ?? "",
  );
  const [authorName, setAuthorName] = useState(initial?.author_name ?? "Admin");
  const [featured, setFeatured] = useState(initial?.featured ?? false);
  const [published, setPublished] = useState(initial?.status === "published");
  const [uploading, setUploading] = useState(false);
  const [previewOpen, setPreviewOpen] = useState(false);
  const [slugStatus, setSlugStatus] = useState<"idle" | "checking" | "ok" | "taken">(
    "idle",
  );
  const [markdownOpen, setMarkdownOpen] = useState(false);
  const [markdownText, setMarkdownText] = useState("");
  const [refining, setRefining] = useState(false);

  function importMarkdown() {
    if (!markdownText.trim()) {
      toast.error("Paste some markdown first");
      return;
    }
    try {
      const html = marked.parse(markdownText, { async: false }) as string;
      setContent(html);
      setMarkdownOpen(false);
      setMarkdownText("");
      toast.success("Markdown imported into the editor");
    } catch {
      toast.error("Could not parse the markdown");
    }
  }

  function handleMarkdownFile(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    e.target.value = ""; // allow re-selecting the same file
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => setMarkdownText(String(reader.result ?? ""));
    reader.onerror = () => toast.error("Could not read the file");
    reader.readAsText(file);
  }


  async function refineWithAI(
    mode: "improve" | "grammar" | "shorten" | "expand" | "seo",
  ) {
    const current = content.trim();
    if (!current) {
      toast.error("Add some content before refining");
      return;
    }
    setRefining(true);
    const toastId = toast.loading("AI is refining your content…");
    try {
      const { data, error } = await supabase.functions.invoke("refine-content", {
        body: { content: current, title, mode },
      });
      if (error) throw new Error(error.message);
      if (data?.error) throw new Error(data.error);
      if (!data?.refined) throw new Error("No content returned");
      setContent(data.refined as string);
      toast.success("Content refined by AI", { id: toastId });
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "AI refine failed", {
        id: toastId,
      });
    } finally {
      setRefining(false);
    }
  }


  // Auto-generate slug from the title until the user edits it manually.
  useEffect(() => {
    if (!slugTouched) setSlug(slugify(title));
  }, [title, slugTouched]);

  // Validate slug uniqueness (debounced).
  useEffect(() => {
    if (!slug) {
      setSlugStatus("idle");
      return;
    }
    setSlugStatus("checking");
    const t = setTimeout(async () => {
      try {
        const { available } = await checkSlug({
          data: { slug: slugify(slug), excludeId: initial?.id },
        });
        setSlugStatus(available ? "ok" : "taken");
      } catch {
        setSlugStatus("idle");
      }
    }, 400);
    return () => clearTimeout(t);
  }, [slug, checkSlug, initial?.id]);

  function addTag() {
    const value = tagInput.trim().replace(/,/g, "");
    if (value && !tags.includes(value)) setTags([...tags, value]);
    setTagInput("");
  }

  async function handleFile(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    if (file.size > 5 * 1024 * 1024) {
      toast.error("Image must be smaller than 5MB.");
      return;
    }
    setUploading(true);
    try {
      const base64 = await new Promise<string>((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = () => resolve(reader.result as string);
        reader.onerror = reject;
        reader.readAsDataURL(file);
      });
      const { url } = await upload({
        data: { fileBase64: base64, fileName: file.name, contentType: file.type },
      });
      setCoverImage(url);
      toast.success("Cover image uploaded");
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Upload failed");
    } finally {
      setUploading(false);
      if (fileRef.current) fileRef.current.value = "";
    }
  }

  const mutation = useMutation({
    mutationFn: (status: "draft" | "published") =>
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
          status,
        },
      }),
    onSuccess: (_res, status) => {
      toast.success(
        status === "published" ? "Post published" : "Draft saved",
      );
      navigate({ to: "/admin/blogs" });
    },
    onError: (err) =>
      toast.error(err instanceof Error ? err.message : "Save failed"),
  });

  function submit(status: "draft" | "published") {
    if (!title.trim()) {
      toast.error("Title is required");
      return;
    }
    if (slugStatus === "taken") {
      toast.error("Slug is already in use");
      return;
    }
    mutation.mutate(status);
  }

  const readingTime = estimateReadingTime(content);
  const saving = mutation.isPending;

  return (
    <div className="grid gap-6 lg:grid-cols-3">
      {/* Main column */}
      <div className="space-y-6 lg:col-span-2">
        <Card>
          <CardContent className="space-y-4 pt-6">
            <div className="space-y-2">
              <Label htmlFor="title">Title</Label>
              <Input
                id="title"
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                placeholder="How to Plan a Wedding"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="slug">Slug</Label>
              <Input
                id="slug"
                value={slug}
                onChange={(e) => {
                  setSlugTouched(true);
                  setSlug(e.target.value);
                }}
                placeholder="how-to-plan-a-wedding"
              />
              <p className="text-xs text-muted-foreground">
                URL: /blogs/{slugify(slug || title) || "…"}{" "}
                {slugStatus === "checking" && "· checking…"}
                {slugStatus === "ok" && "· available ✓"}
                {slugStatus === "taken" && (
                  <span className="text-destructive">· already taken</span>
                )}
              </p>
            </div>
            <div className="space-y-2">
              <Label htmlFor="excerpt">Excerpt</Label>
              <Textarea
                id="excerpt"
                value={excerpt}
                onChange={(e) => setExcerpt(e.target.value)}
                rows={2}
                placeholder="Short summary shown on cards and search results."
              />
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between gap-2 space-y-0">
            <CardTitle className="text-base">Content</CardTitle>
            <div className="flex items-center gap-2">
              <Button
                type="button"
                size="sm"
                variant="outline"
                onClick={() => setMarkdownOpen(true)}
              >
                <FileCode className="mr-2 h-4 w-4" /> Import Markdown
              </Button>
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button type="button" size="sm" variant="default" disabled={refining}>
                    {refining ? (
                      <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    ) : (
                      <Sparkles className="mr-2 h-4 w-4" />
                    )}
                    Refine with AI
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end">
                  <DropdownMenuItem onClick={() => refineWithAI("improve")}>
                    <Wand2 className="mr-2 h-4 w-4" /> Improve writing
                  </DropdownMenuItem>
                  <DropdownMenuItem onClick={() => refineWithAI("grammar")}>
                    Fix grammar & spelling
                  </DropdownMenuItem>
                  <DropdownMenuItem onClick={() => refineWithAI("shorten")}>
                    Make it shorter
                  </DropdownMenuItem>
                  <DropdownMenuItem onClick={() => refineWithAI("expand")}>
                    Expand with detail
                  </DropdownMenuItem>
                  <DropdownMenuItem onClick={() => refineWithAI("seo")}>
                    Optimize for SEO
                  </DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>
            </div>
          </CardHeader>
          <CardContent>
            <RichTextEditor value={content} onChange={setContent} />
            <p className="mt-2 text-xs text-muted-foreground">
              ~{readingTime} min read
            </p>
          </CardContent>
        </Card>


        <Card>
          <CardHeader>
            <CardTitle className="text-base">SEO</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="seoTitle">SEO Title</Label>
              <Input
                id="seoTitle"
                value={seoTitle}
                onChange={(e) => setSeoTitle(e.target.value)}
                placeholder="Defaults to the post title if empty"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="metaDescription">Meta Description</Label>
              <Textarea
                id="metaDescription"
                value={metaDescription}
                onChange={(e) => setMetaDescription(e.target.value)}
                rows={2}
                placeholder="Defaults to the excerpt if empty"
              />
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Sidebar column */}
      <div className="space-y-6">
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Publish</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="flex items-center justify-between">
              <Label htmlFor="published">Published</Label>
              <Switch
                id="published"
                checked={published}
                onCheckedChange={setPublished}
              />
            </div>
            <div className="flex items-center justify-between">
              <Label htmlFor="featured">Featured</Label>
              <Switch id="featured" checked={featured} onCheckedChange={setFeatured} />
            </div>
            <div className="flex flex-col gap-2 pt-2">
              <Button
                onClick={() => submit(published ? "published" : "draft")}
                disabled={saving}
              >
                {saving && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                {published ? "Publish" : "Save Draft"}
              </Button>
              <Button
                variant="outline"
                onClick={() => submit("draft")}
                disabled={saving}
              >
                Save as Draft
              </Button>
              <Button
                variant="ghost"
                onClick={() => setPreviewOpen(true)}
                type="button"
              >
                <Eye className="mr-2 h-4 w-4" /> Preview
              </Button>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-base">Organization</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-2">
              <Label>Category</Label>
              <Select value={category} onValueChange={setCategory}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {BLOG_CATEGORIES.map((c) => (
                    <SelectItem key={c} value={c}>
                      {c}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label htmlFor="author">Author</Label>
              <Input
                id="author"
                value={authorName}
                onChange={(e) => setAuthorName(e.target.value)}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="tags">Tags</Label>
              <Input
                id="tags"
                value={tagInput}
                onChange={(e) => setTagInput(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter" || e.key === ",") {
                    e.preventDefault();
                    addTag();
                  }
                }}
                placeholder="Type a tag and press Enter"
              />
              {tags.length > 0 && (
                <div className="flex flex-wrap gap-1.5 pt-1">
                  {tags.map((t) => (
                    <Badge key={t} variant="secondary" className="gap-1">
                      {t}
                      <button
                        type="button"
                        onClick={() => setTags(tags.filter((x) => x !== t))}
                        aria-label={`Remove ${t}`}
                      >
                        <X className="h-3 w-3" />
                      </button>
                    </Badge>
                  ))}
                </div>
              )}
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-base">Cover Image</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            {coverImage ? (
              <div className="relative overflow-hidden rounded-md border border-border">
                <img
                  src={coverImage}
                  alt="Cover preview"
                  className="aspect-video w-full object-cover"
                />
                <Button
                  size="icon"
                  variant="secondary"
                  className="absolute right-2 top-2 h-7 w-7"
                  onClick={() => setCoverImage("")}
                  type="button"
                >
                  <X className="h-4 w-4" />
                </Button>
              </div>
            ) : (
              <div className="flex aspect-video items-center justify-center rounded-md border border-dashed border-border text-sm text-muted-foreground">
                No cover image
              </div>
            )}
            <Input
              value={coverImage}
              onChange={(e) => setCoverImage(e.target.value)}
              placeholder="Paste image URL"
            />
            <input
              ref={fileRef}
              type="file"
              accept="image/*"
              className="hidden"
              onChange={handleFile}
            />
            <Button
              variant="outline"
              className="w-full"
              onClick={() => fileRef.current?.click()}
              disabled={uploading}
              type="button"
            >
              {uploading ? (
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              ) : (
                <Upload className="mr-2 h-4 w-4" />
              )}
              Upload Image
            </Button>
          </CardContent>
        </Card>
      </div>

      <Dialog open={markdownOpen} onOpenChange={setMarkdownOpen}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle>Import Markdown</DialogTitle>
          </DialogHeader>
          <p className="text-sm text-muted-foreground">
            Paste Markdown below. It will be converted to rich text and replace
            the current editor content.
          </p>
          <Textarea
            value={markdownText}
            onChange={(e) => setMarkdownText(e.target.value)}
            rows={14}
            placeholder={"# My heading\n\nWrite your post in **markdown**…"}
            className="font-mono text-sm"
          />
          <div className="flex justify-end gap-2">
            <Button variant="outline" type="button" onClick={() => setMarkdownOpen(false)}>
              Cancel
            </Button>
            <Button type="button" onClick={importMarkdown}>
              <FileCode className="mr-2 h-4 w-4" /> Import
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      <Dialog open={previewOpen} onOpenChange={setPreviewOpen}>

        <DialogContent className="max-h-[85vh] max-w-3xl overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Preview</DialogTitle>
          </DialogHeader>
          {coverImage && (
            <img
              src={coverImage}
              alt=""
              className="aspect-video w-full rounded-md object-cover"
            />
          )}
          <Badge variant="secondary" className="w-fit">
            {category}
          </Badge>
          <h1 className="text-3xl font-bold">{title || "Untitled"}</h1>
          {excerpt && <p className="text-muted-foreground">{excerpt}</p>}
          <div
            className="blog-content"
            dangerouslySetInnerHTML={{ __html: content }}
          />
        </DialogContent>
      </Dialog>
    </div>
  );
}
