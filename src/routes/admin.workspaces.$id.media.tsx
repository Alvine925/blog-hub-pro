import { createFileRoute } from "@tanstack/react-router";
import { createServerFn } from "@tanstack/react-start";
import { queryOptions, useSuspenseQuery, useQueryClient } from "@tanstack/react-query";
import { useRef, useState } from "react";
import { toast } from "sonner";
import { Upload, Copy, Trash2, ImageIcon, Loader2 } from "lucide-react";
import { cn } from "@/lib/utils";
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
} from "@/components/ui/alert-dialog";

interface MediaFile {
  id: string;
  file_name: string;
  storage_path: string;
  mime_type: string;
  size_bytes: number;
  width_px: number | null;
  height_px: number | null;
  created_at: string;
  public_url?: string;
}

const listMedia = createServerFn({ method: "GET" })
  .validator((input: { workspaceId: string }) => input)
  .handler(async ({ data }): Promise<MediaFile[]> => {
    const { getAdminClient } = await import("../../lib/supabase.server");
    const db = getAdminClient() as any;
    const { data: files, error } = await db
      .from("media_files")
      .select("*")
      .eq("workspace_id", data.workspaceId)
      .order("created_at", { ascending: false })
      .limit(100);
    if (error) throw new Error(error.message);
    return (files ?? []).map((f: any) => ({
      ...f,
      public_url: `${import.meta.env.VITE_SUPABASE_URL}/storage/v1/object/public/${f.bucket}/${f.storage_path}`,
    }));
  });

const deleteMedia = createServerFn({ method: "POST" })
  .validator((input: { id: string }) => input)
  .handler(async ({ data }) => {
    const { getAdminClient } = await import("../../lib/supabase.server");
    const db = getAdminClient() as any;
    const { error } = await db.from("media_files").delete().eq("id", data.id);
    if (error) throw new Error(error.message);
    return { ok: true };
  });

const mediaQuery = (id: string) =>
  queryOptions({ queryKey: ["workspace-media", id], queryFn: () => listMedia({ data: { workspaceId: id } }) });

export const Route = createFileRoute("/admin/workspaces/$id/media")({
  loader: ({ context, params }) => context.queryClient.ensureQueryData(mediaQuery(params.id)),
  component: WorkspaceMedia,
  errorComponent: ({ error }) => <p className="p-8 text-sm text-red-600">{error.message}</p>,
});

function fmtSize(bytes: number) {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / 1024 / 1024).toFixed(1)} MB`;
}

function WorkspaceMedia() {
  const { id } = Route.useParams();
  const { data: files, refetch } = useSuspenseQuery(mediaQuery(id));
  const queryClient = useQueryClient();
  const fileRef = useRef<HTMLInputElement>(null);
  const [uploading, setUploading] = useState(false);
  const [pendingDelete, setPendingDelete] = useState<MediaFile | null>(null);
  const [deleting, setDeleting] = useState(false);
  const [selected, setSelected] = useState<MediaFile | null>(null);

  async function handleUpload(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    setUploading(true);
    try {
      const { uploadCoverImage } = await import("@/lib/blog.functions");
      const result = await uploadCoverImage({ data: { fileName: file.name, contentType: file.type, base64: await toBase64(file) } });
      if (result?.url) {
        toast.success("File uploaded");
        await queryClient.invalidateQueries({ queryKey: ["workspace-media", id] });
        refetch();
      }
    } catch (err) {
      toast.error("Upload failed — " + (err instanceof Error ? err.message : "Unknown error"));
    } finally {
      setUploading(false);
      if (fileRef.current) fileRef.current.value = "";
    }
  }

  async function handleDelete() {
    if (!pendingDelete) return;
    setDeleting(true);
    try {
      await deleteMedia({ data: { id: pendingDelete.id } });
      toast.success("File deleted");
      setPendingDelete(null);
      setSelected(null);
      await queryClient.invalidateQueries({ queryKey: ["workspace-media", id] });
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed");
    } finally { setDeleting(false); }
  }

  function copyUrl(url: string) {
    navigator.clipboard.writeText(url);
    toast.success("URL copied");
  }

  return (
    <div className="min-h-full px-8 py-8">
      {/* Header */}
      <div className="mb-8 flex items-center justify-between">
        <div>
          <h1 className="text-xl font-semibold">Media Library</h1>
          <p className="mt-0.5 text-sm text-muted-foreground">{files.length} files</p>
        </div>
        <div className="flex items-center gap-2">
          <input
            ref={fileRef}
            type="file"
            accept="image/*"
            className="hidden"
            onChange={handleUpload}
          />
          <button
            type="button"
            onClick={() => fileRef.current?.click()}
            disabled={uploading}
            className="flex items-center gap-1.5 rounded-md bg-primary px-3 py-1.5 text-sm font-medium text-primary-foreground hover:bg-primary/90 disabled:opacity-60 transition-colors"
          >
            {uploading ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Upload className="h-3.5 w-3.5" />}
            Upload
          </button>
        </div>
      </div>

      {files.length === 0 ? (
        <div
          className="flex flex-col items-center gap-3 py-20 border-y border-border text-center cursor-pointer hover:bg-muted/20 transition-colors"
          onClick={() => fileRef.current?.click()}
        >
          <ImageIcon className="h-8 w-8 text-muted-foreground/30" />
          <p className="text-sm text-muted-foreground">No media yet. Click to upload.</p>
        </div>
      ) : (
        <div className="grid grid-cols-3 gap-3 sm:grid-cols-4 md:grid-cols-5 lg:grid-cols-6 xl:grid-cols-8">
          {files.map((file) => (
            <button
              key={file.id}
              type="button"
              onClick={() => setSelected(file)}
              className={cn(
                "group relative aspect-square overflow-hidden border bg-muted transition-all hover:border-primary/40",
                selected?.id === file.id && "border-primary ring-1 ring-primary",
              )}
            >
              {file.mime_type.startsWith("image/") && file.public_url ? (
                <img
                  src={file.public_url}
                  alt={file.file_name}
                  className="h-full w-full object-cover"
                  loading="lazy"
                />
              ) : (
                <div className="flex h-full w-full items-center justify-center">
                  <ImageIcon className="h-6 w-6 text-muted-foreground/40" />
                </div>
              )}
              <div className="absolute inset-x-0 bottom-0 bg-gradient-to-t from-black/60 to-transparent p-1.5 opacity-0 group-hover:opacity-100 transition-opacity">
                <p className="truncate text-[10px] text-white">{file.file_name}</p>
              </div>
            </button>
          ))}
        </div>
      )}

      {/* Selected panel */}
      {selected && (
        <div className="mt-6 flex gap-5 border-t border-border pt-5">
          {selected.mime_type.startsWith("image/") && selected.public_url && (
            <img
              src={selected.public_url}
              alt={selected.file_name}
              className="h-24 w-24 shrink-0 object-cover border border-border"
            />
          )}
          <div className="flex-1 min-w-0 space-y-1">
            <p className="text-sm font-medium truncate">{selected.file_name}</p>
            <p className="text-xs text-muted-foreground">{fmtSize(selected.size_bytes)} · {selected.mime_type}</p>
            {selected.width_px && <p className="text-xs text-muted-foreground">{selected.width_px}×{selected.height_px}px</p>}
            {selected.public_url && (
              <p className="text-xs text-muted-foreground font-mono truncate max-w-xs">{selected.public_url}</p>
            )}
            <div className="flex gap-2 pt-1">
              {selected.public_url && (
                <button
                  type="button"
                  onClick={() => copyUrl(selected.public_url!)}
                  className="flex items-center gap-1 text-xs text-primary hover:underline"
                >
                  <Copy className="h-3 w-3" /> Copy URL
                </button>
              )}
              <button
                type="button"
                onClick={() => setPendingDelete(selected)}
                className="flex items-center gap-1 text-xs text-red-600 hover:underline"
              >
                <Trash2 className="h-3 w-3" /> Delete
              </button>
            </div>
          </div>
        </div>
      )}

      <AlertDialog open={!!pendingDelete} onOpenChange={(o) => !o && setPendingDelete(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete "{pendingDelete?.file_name}"?</AlertDialogTitle>
            <AlertDialogDescription>This file will be permanently removed from the media library.</AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleDelete}
              disabled={deleting}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}

async function toBase64(file: File): Promise<string> {
  return new Promise((res, rej) => {
    const reader = new FileReader();
    reader.onload = () => res((reader.result as string).split(",")[1]);
    reader.onerror = rej;
    reader.readAsDataURL(file);
  });
}
