import { createFileRoute } from "@tanstack/react-router";
import { createServerFn } from "@tanstack/react-start";
import { useServerFn } from "@tanstack/react-start";
import { queryOptions, useSuspenseQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { toast } from "sonner";
import { Trash2, Copy, ImageIcon, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";

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

function MediaLibrary() {
  const { data: items } = useSuspenseQuery(mediaQuery);
  const queryClient = useQueryClient();
  const del = useServerFn(deleteMedia);
  const [pending, setPending] = useState<MediaItem | null>(null);
  const [deleting, setDeleting] = useState(false);

  function copyUrl(url: string) {
    navigator.clipboard.writeText(url).then(() => toast.success("URL copied"));
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

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold">Media Library</h1>
        <p className="text-sm text-muted-foreground">
          {items.length} file{items.length === 1 ? "" : "s"} in your blog-images bucket
        </p>
      </div>

      {items.length === 0 ? (
        <div className="flex flex-col items-center justify-center gap-3 rounded-lg border border-dashed border-border py-24 text-center">
          <ImageIcon className="h-10 w-10 text-muted-foreground" />
          <p className="text-muted-foreground">No images uploaded yet.</p>
          <p className="text-sm text-muted-foreground">
            Upload cover images while creating blog posts.
          </p>
        </div>
      ) : (
        <div className="grid gap-4 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4">
          {items.map((item) => (
            <div
              key={item.path}
              className="group overflow-hidden rounded-lg border border-border bg-background"
            >
              <div className="relative aspect-video overflow-hidden bg-muted">
                <img
                  src={item.url}
                  alt={item.name}
                  loading="lazy"
                  className="h-full w-full object-cover transition-transform duration-200 group-hover:scale-105"
                />
                <div className="absolute inset-0 flex items-center justify-center gap-2 bg-black/50 opacity-0 transition-opacity group-hover:opacity-100">
                  <Button
                    size="icon"
                    variant="secondary"
                    className="h-8 w-8"
                    onClick={() => copyUrl(item.url)}
                    title="Copy URL"
                  >
                    <Copy className="h-4 w-4" />
                  </Button>
                  <Button
                    size="icon"
                    variant="destructive"
                    className="h-8 w-8"
                    onClick={() => setPending(item)}
                    title="Delete"
                  >
                    <Trash2 className="h-4 w-4" />
                  </Button>
                </div>
              </div>
              <div className="p-2">
                <p className="truncate text-xs font-medium">{item.name}</p>
                <p className="text-xs text-muted-foreground">{formatBytes(item.size)}</p>
              </div>
            </div>
          ))}
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
