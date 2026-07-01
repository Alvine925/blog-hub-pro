import { createFileRoute } from "@tanstack/react-router";
import { createServerFn } from "@tanstack/react-start";
import { useServerFn } from "@tanstack/react-start";
import { queryOptions, useSuspenseQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { toast } from "sonner";
import {
  Trash2, Copy, ImageIcon, Loader2, Search, Grid3X3, List,
  Upload, FolderOpen, Filter,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { cn } from "@/lib/utils";

interface MediaItem {
  name: string;
  path: string;
  url: string;
  size: number;
  created_at: string;
}

const listMedia = createServerFn({ method: "GET" }).handler(
  async (): Promise<MediaItem[]> => {
    const { getAdminClient, BLOG_BUCKET } = await import("../lib/supabase.server");
    const supabase = await getAdminClient();

    const { data, error } = await supabase.storage
      .from(BLOG_BUCKET)
      .list("covers", { limit: 200, sortBy: { column: "created_at", order: "desc" } });

    if (error) throw new Error(error.message);
    if (!data) return [];

    const items: MediaItem[] = [];
    for (const file of data) {
      if (!file.name || file.name === ".emptyFolderPlaceholder") continue;
      const path = `covers/${file.name}`;
      const { data: signed } = await supabase.storage
        .from(BLOG_BUCKET)
        .createSignedUrl(path, 3600);
      if (signed?.signedUrl) {
        items.push({
          name: file.name,
          path,
          url: signed.signedUrl,
          size: file.metadata?.size ?? 0,
          created_at: file.created_at ?? "",
        });
      }
    }
    return items;
  },
);

const deleteMedia = createServerFn({ method: "POST" })
  .validator((input: { path: string }) => input)
  .handler(async ({ data }): Promise<{ ok: true }> => {
    const { getAdminClient, BLOG_BUCKET } = await import("../lib/supabase.server");
    const supabase = await getAdminClient();
    const { error } = await supabase.storage.from(BLOG_BUCKET).remove([data.path]);
    if (error) throw new Error(error.message);
    return { ok: true };
  });

const mediaQuery = queryOptions({
  queryKey: ["admin", "media"],
  queryFn: () => listMedia(),
});

export const Route = createFileRoute("/admin/media")({
  head: () => ({ meta: [{ title: "Media Library — Admin" }] }),
  loader: ({ context }) => context.queryClient.ensureQueryData(mediaQuery),
  component: MediaLibrary,
  errorComponent: ({ error }) => (
    <p className="text-sm text-destructive">Failed to load media: {error.message}</p>
  ),
});

function formatBytes(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

function formatDate(dateStr: string) {
  if (!dateStr) return "";
  return new Date(dateStr).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" });
}

function MediaLibrary() {
  const { data: items } = useSuspenseQuery(mediaQuery);
  const queryClient = useQueryClient();
  const del = useServerFn(deleteMedia);
  const [pending, setPending] = useState<MediaItem | null>(null);
  const [deleting, setDeleting] = useState(false);
  const [search, setSearch] = useState("");
  const [view, setView] = useState<"grid" | "list">("grid");

  function copyUrl(url: string) {
    navigator.clipboard.writeText(url).then(() => toast.success("URL copied to clipboard"));
  }

  async function confirmDelete() {
    if (!pending) return;
    setDeleting(true);
    try {
      await del({ data: { path: pending.path } });
      toast.success("File deleted");
      setPending(null);
      await queryClient.invalidateQueries({ queryKey: ["admin", "media"] });
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Delete failed");
    } finally {
      setDeleting(false);
    }
  }

  const filtered = items.filter((item) =>
    !search || item.name.toLowerCase().includes(search.toLowerCase()),
  );

  const totalSize = items.reduce((sum, i) => sum + i.size, 0);

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold">Media Library</h1>
          <p className="text-sm text-muted-foreground">
            {items.length} file{items.length !== 1 ? "s" : ""} · {formatBytes(totalSize)} used
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Button variant="outline" size="sm" className="gap-2">
            <Upload className="h-3.5 w-3.5" /> Upload
          </Button>
        </div>
      </div>

      {/* Toolbar */}
      {items.length > 0 && (
        <div className="flex items-center gap-3">
          <div className="relative flex-1 max-w-xs">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground" />
            <Input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search files…"
              className="pl-9 h-9 text-sm"
            />
          </div>
          <div className="flex rounded-lg border border-border overflow-hidden">
            <button
              type="button"
              onClick={() => setView("grid")}
              className={cn(
                "flex h-9 w-9 items-center justify-center transition-colors",
                view === "grid" ? "bg-primary text-primary-foreground" : "text-muted-foreground hover:bg-accent",
              )}
            >
              <Grid3X3 className="h-4 w-4" />
            </button>
            <button
              type="button"
              onClick={() => setView("list")}
              className={cn(
                "flex h-9 w-9 items-center justify-center transition-colors",
                view === "list" ? "bg-primary text-primary-foreground" : "text-muted-foreground hover:bg-accent",
              )}
            >
              <List className="h-4 w-4" />
            </button>
          </div>
        </div>
      )}

      {items.length === 0 ? (
        <div className="flex flex-col items-center justify-center gap-4 rounded-xl border border-dashed border-border py-24 text-center">
          <div className="flex h-16 w-16 items-center justify-center rounded-full bg-muted">
            <ImageIcon className="h-8 w-8 text-muted-foreground" />
          </div>
          <div>
            <p className="font-semibold">No images yet</p>
            <p className="mt-1 text-sm text-muted-foreground">Upload cover images while creating blog posts.</p>
          </div>
          <Button variant="outline" className="gap-2">
            <Upload className="h-4 w-4" /> Upload your first image
          </Button>
        </div>
      ) : filtered.length === 0 ? (
        <div className="py-12 text-center">
          <p className="text-sm text-muted-foreground">No files match "{search}"</p>
        </div>
      ) : view === "grid" ? (
        <div className="grid gap-3 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5">
          {filtered.map((item) => (
            <div
              key={item.path}
              className="group overflow-hidden rounded-xl border border-border bg-background shadow-sm transition-shadow hover:shadow-md"
            >
              <div className="relative aspect-video overflow-hidden bg-muted">
                <img
                  src={item.url}
                  alt={item.name}
                  loading="lazy"
                  className="h-full w-full object-cover transition-transform duration-300 group-hover:scale-105"
                />
                <div className="absolute inset-0 flex items-center justify-center gap-2 bg-black/50 opacity-0 transition-opacity group-hover:opacity-100">
                  <Button
                    size="icon"
                    variant="secondary"
                    className="h-8 w-8 shadow-sm"
                    onClick={() => copyUrl(item.url)}
                    title="Copy URL"
                  >
                    <Copy className="h-4 w-4" />
                  </Button>
                  <Button
                    size="icon"
                    variant="destructive"
                    className="h-8 w-8 shadow-sm"
                    onClick={() => setPending(item)}
                    title="Delete"
                  >
                    <Trash2 className="h-4 w-4" />
                  </Button>
                </div>
              </div>
              <div className="p-2.5">
                <p className="truncate text-xs font-medium">{item.name}</p>
                <p className="text-[10px] text-muted-foreground mt-0.5">{formatBytes(item.size)} · {formatDate(item.created_at)}</p>
              </div>
            </div>
          ))}
        </div>
      ) : (
        <div className="rounded-xl border border-border bg-background shadow-sm overflow-hidden">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-border bg-muted/30">
                <th className="px-4 py-3 text-left text-xs font-semibold text-muted-foreground">File</th>
                <th className="px-4 py-3 text-left text-xs font-semibold text-muted-foreground">Size</th>
                <th className="px-4 py-3 text-left text-xs font-semibold text-muted-foreground">Uploaded</th>
                <th className="px-4 py-3 text-right text-xs font-semibold text-muted-foreground">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border/60">
              {filtered.map((item) => (
                <tr key={item.path} className="hover:bg-muted/20 transition-colors">
                  <td className="px-4 py-3">
                    <div className="flex items-center gap-3">
                      <img src={item.url} alt={item.name} className="h-8 w-12 rounded object-cover shrink-0" />
                      <span className="font-medium truncate max-w-[200px]">{item.name}</span>
                    </div>
                  </td>
                  <td className="px-4 py-3 text-muted-foreground">{formatBytes(item.size)}</td>
                  <td className="px-4 py-3 text-muted-foreground">{formatDate(item.created_at)}</td>
                  <td className="px-4 py-3">
                    <div className="flex justify-end gap-1">
                      <Button size="icon" variant="ghost" className="h-7 w-7" onClick={() => copyUrl(item.url)} title="Copy URL">
                        <Copy className="h-3.5 w-3.5" />
                      </Button>
                      <Button size="icon" variant="ghost" className="h-7 w-7 text-destructive hover:text-destructive hover:bg-destructive/10" onClick={() => setPending(item)} title="Delete">
                        <Trash2 className="h-3.5 w-3.5" />
                      </Button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      <AlertDialog open={Boolean(pending)} onOpenChange={(o) => !o && setPending(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete this file?</AlertDialogTitle>
            <AlertDialogDescription>
              "{pending?.name}" will be permanently deleted from storage. Any posts using
              this image will lose it.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={confirmDelete}
              disabled={deleting}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              {deleting && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
