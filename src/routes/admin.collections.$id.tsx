import { createFileRoute, Link } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { queryOptions, useSuspenseQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { toast } from "sonner";
import {
  Plus, Trash2, Loader2, ChevronLeft, Save, GripVertical, X,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import {
  getCollection, listCollectionEntries, updateCollectionSchema,
  upsertCollectionEntry, deleteCollectionEntry,
  type Collection, type CollectionEntry, type CollectionField, type FieldType,
} from "@/lib/collection.functions";

const FIELD_TYPES: { value: FieldType; label: string }[] = [
  { value: "text", label: "Short Text" },
  { value: "textarea", label: "Long Text" },
  { value: "number", label: "Number" },
  { value: "boolean", label: "Toggle" },
  { value: "date", label: "Date" },
  { value: "select", label: "Select" },
  { value: "image", label: "Image URL" },
];

function colQuery(id: string) {
  return queryOptions({ queryKey: ["admin", "collection", id], queryFn: () => getCollection({ data: { id } }) });
}
function entriesQuery(id: string) {
  return queryOptions({ queryKey: ["admin", "collection_entries", id], queryFn: () => listCollectionEntries({ data: { collectionId: id } }) });
}

export const Route = createFileRoute("/admin/collections/$id")({
  head: () => ({ meta: [{ title: "Collection — Admin" }] }),
  loader: ({ context, params }) => Promise.all([
    context.queryClient.ensureQueryData(colQuery(params.id)),
    context.queryClient.ensureQueryData(entriesQuery(params.id)),
  ]),
  component: CollectionDetail,
  errorComponent: ({ error }) => (
    <p className="text-sm text-destructive">Failed: {error.message}</p>
  ),
});

function FieldRow({
  field, index, onChange, onRemove,
}: {
  field: CollectionField;
  index: number;
  onChange: (i: number, f: CollectionField) => void;
  onRemove: (i: number) => void;
}) {
  return (
    <div className="flex items-start gap-3 border-b border-border/50 py-3 last:border-0">
      <GripVertical className="h-4 w-4 text-muted-foreground mt-2 shrink-0 cursor-grab" />
      <div className="grid flex-1 gap-3 sm:grid-cols-[1fr_1fr_auto_auto]">
        <div className="space-y-1">
          <Label className="text-xs">Label</Label>
          <Input
            value={field.label}
            onChange={(e) => onChange(index, { ...field, label: e.target.value, name: e.target.value.toLowerCase().replace(/\s+/g, "_").replace(/[^a-z0-9_]/g, "") })}
            placeholder="Field label"
            className="h-8 text-sm"
          />
        </div>
        <div className="space-y-1">
          <Label className="text-xs">Type</Label>
          <Select value={field.type} onValueChange={(v) => onChange(index, { ...field, type: v as FieldType })}>
            <SelectTrigger className="h-8 text-sm"><SelectValue /></SelectTrigger>
            <SelectContent>
              {FIELD_TYPES.map((t) => <SelectItem key={t.value} value={t.value}>{t.label}</SelectItem>)}
            </SelectContent>
          </Select>
        </div>
        <div className="flex items-end gap-1.5 pb-0.5">
          <label className="flex items-center gap-1.5 cursor-pointer text-xs">
            <input
              type="checkbox"
              checked={field.required}
              onChange={(e) => onChange(index, { ...field, required: e.target.checked })}
              className="rounded"
            />
            Required
          </label>
        </div>
        <div className="flex items-end pb-0.5">
          <button type="button" onClick={() => onRemove(index)} className="text-muted-foreground hover:text-destructive transition-colors">
            <X className="h-4 w-4" />
          </button>
        </div>
      </div>
    </div>
  );
}

function EntryForm({
  collection, entry, onSave, onCancel,
}: {
  collection: Collection;
  entry?: CollectionEntry;
  onSave: () => void;
  onCancel: () => void;
}) {
  const upsert = useServerFn(upsertCollectionEntry);
  const [values, setValues] = useState<Record<string, unknown>>(entry?.data ?? {});
  const [status, setStatus] = useState<"draft" | "published">(entry?.status ?? "draft");
  const [busy, setBusy] = useState(false);

  async function handleSave() {
    setBusy(true);
    try {
      await upsert({ data: { id: entry?.id, collection_id: collection.id, data: values, status } });
      toast.success(entry ? "Entry updated" : "Entry created");
      onSave();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Failed");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="space-y-5 border-t border-border pt-6">
      <h3 className="font-semibold">{entry ? "Edit Entry" : "New Entry"}</h3>
      {collection.schema.length === 0 ? (
        <p className="text-sm text-muted-foreground">Add fields to the schema before creating entries.</p>
      ) : (
        <div className="space-y-4">
          {collection.schema.map((field) => (
            <div key={field.name} className="space-y-1.5">
              <Label htmlFor={`f-${field.name}`}>
                {field.label}
                {field.required && <span className="text-destructive ml-1">*</span>}
                <span className="ml-2 text-xs text-muted-foreground font-normal">{FIELD_TYPES.find((t) => t.value === field.type)?.label}</span>
              </Label>
              {field.type === "boolean" ? (
                <label className="flex items-center gap-2 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={Boolean(values[field.name])}
                    onChange={(e) => setValues((v) => ({ ...v, [field.name]: e.target.checked }))}
                    className="rounded"
                  />
                  <span className="text-sm">{field.label}</span>
                </label>
              ) : field.type === "textarea" ? (
                <textarea
                  id={`f-${field.name}`}
                  value={String(values[field.name] ?? "")}
                  onChange={(e) => setValues((v) => ({ ...v, [field.name]: e.target.value }))}
                  className="flex min-h-[80px] w-full rounded-md border border-input bg-transparent px-3 py-2 text-sm shadow-sm placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
                  placeholder={field.label}
                />
              ) : (
                <Input
                  id={`f-${field.name}`}
                  type={field.type === "number" ? "number" : field.type === "date" ? "date" : "text"}
                  value={String(values[field.name] ?? "")}
                  onChange={(e) => setValues((v) => ({ ...v, [field.name]: field.type === "number" ? Number(e.target.value) : e.target.value }))}
                  placeholder={field.label}
                />
              )}
            </div>
          ))}
          <div className="space-y-1.5">
            <Label>Status</Label>
            <Select value={status} onValueChange={(v) => setStatus(v as "draft" | "published")}>
              <SelectTrigger className="w-36"><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="draft">Draft</SelectItem>
                <SelectItem value="published">Published</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </div>
      )}
      <div className="flex gap-2">
        <Button onClick={handleSave} disabled={busy || collection.schema.length === 0}>
          {busy ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Save className="mr-2 h-4 w-4" />}
          {entry ? "Update" : "Create"}
        </Button>
        <Button variant="ghost" onClick={onCancel}>Cancel</Button>
      </div>
    </div>
  );
}

function CollectionDetail() {
  const { id } = Route.useParams();
  const { data: collection } = useSuspenseQuery(colQuery(id));
  const { data: entries } = useSuspenseQuery(entriesQuery(id));
  const queryClient = useQueryClient();
  const updateSchema = useServerFn(updateCollectionSchema);
  const delEntry = useServerFn(deleteCollectionEntry);

  const [tab, setTab] = useState<"schema" | "entries">("schema");
  const [fields, setFields] = useState<CollectionField[]>(collection.schema);
  const [schemaBusy, setSchemaBusy] = useState(false);
  const [editingEntry, setEditingEntry] = useState<CollectionEntry | "new" | null>(null);
  const [pendingDeleteEntry, setPendingDeleteEntry] = useState<CollectionEntry | null>(null);
  const [busyId, setBusyId] = useState<string | null>(null);

  async function refreshEntries() {
    await queryClient.invalidateQueries({ queryKey: ["admin", "collection_entries", id] });
  }
  async function refreshCollection() {
    await queryClient.invalidateQueries({ queryKey: ["admin", "collection", id] });
  }

  function addField() {
    setFields((f) => [...f, { name: `field_${f.length + 1}`, label: `Field ${f.length + 1}`, type: "text", required: false }]);
  }

  function changeField(i: number, field: CollectionField) {
    setFields((prev) => prev.map((f, idx) => (idx === i ? field : f)));
  }

  function removeField(i: number) {
    setFields((prev) => prev.filter((_, idx) => idx !== i));
  }

  async function saveSchema() {
    setSchemaBusy(true);
    try {
      await updateSchema({ data: { id, name: collection.name, description: collection.description ?? undefined, schema: fields } });
      toast.success("Schema saved");
      await refreshCollection();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Failed");
    } finally {
      setSchemaBusy(false);
    }
  }

  async function handleDeleteEntry() {
    if (!pendingDeleteEntry) return;
    setBusyId(pendingDeleteEntry.id);
    try {
      await delEntry({ data: { id: pendingDeleteEntry.id } });
      toast.success("Entry deleted");
      setPendingDeleteEntry(null);
      await refreshEntries();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Failed");
    } finally {
      setBusyId(null);
    }
  }

  return (
    <div className="max-w-3xl space-y-8">
      <div className="flex items-center gap-3">
        <Button variant="ghost" size="icon" asChild>
          <Link to="/admin/collections"><ChevronLeft className="h-4 w-4" /></Link>
        </Button>
        <div>
          <h1 className="text-2xl font-bold">{collection.name}</h1>
          {collection.description && <p className="text-sm text-muted-foreground">{collection.description}</p>}
        </div>
      </div>

      <div className="flex gap-1 border-b border-border">
        {(["schema", "entries"] as const).map((t) => (
          <button
            key={t}
            type="button"
            onClick={() => { setTab(t); setEditingEntry(null); }}
            className={`px-4 py-2 text-sm font-medium border-b-2 transition-colors capitalize ${tab === t ? "border-primary text-foreground" : "border-transparent text-muted-foreground hover:text-foreground"}`}
          >
            {t}
            {t === "entries" && <Badge variant="secondary" className="ml-2 text-[10px]">{entries.length}</Badge>}
          </button>
        ))}
      </div>

      {tab === "schema" && (
        <div className="space-y-4">
          <p className="text-sm text-muted-foreground">
            Define the fields for this content type. Changes are saved manually.
          </p>
          {fields.length === 0 ? (
            <p className="text-sm text-muted-foreground py-6 text-center border-t border-border">No fields yet. Add one below.</p>
          ) : (
            <div className="border-t border-border">
              {fields.map((field, i) => (
                <FieldRow key={i} field={field} index={i} onChange={changeField} onRemove={removeField} />
              ))}
            </div>
          )}
          <div className="flex gap-2 pt-2">
            <Button variant="outline" size="sm" onClick={addField}>
              <Plus className="mr-2 h-3.5 w-3.5" /> Add Field
            </Button>
            <Button size="sm" onClick={saveSchema} disabled={schemaBusy}>
              {schemaBusy ? <Loader2 className="mr-2 h-3.5 w-3.5 animate-spin" /> : <Save className="mr-2 h-3.5 w-3.5" />}
              Save Schema
            </Button>
          </div>
        </div>
      )}

      {tab === "entries" && (
        <div className="space-y-6">
          {editingEntry ? (
            <EntryForm
              collection={collection}
              entry={editingEntry === "new" ? undefined : editingEntry}
              onSave={async () => { setEditingEntry(null); await refreshEntries(); }}
              onCancel={() => setEditingEntry(null)}
            />
          ) : (
            <>
              <div className="flex justify-end">
                <Button size="sm" onClick={() => setEditingEntry("new")}>
                  <Plus className="mr-2 h-3.5 w-3.5" /> New Entry
                </Button>
              </div>
              {entries.length === 0 ? (
                <p className="text-sm text-muted-foreground py-10 text-center border-t border-border">No entries yet.</p>
              ) : (
                <div className="border-t border-border">
                  {entries.map((entry) => {
                    const preview = collection.schema[0] ? String(entry.data[collection.schema[0].name] ?? "—") : entry.id.slice(0, 8);
                    return (
                      <div key={entry.id} className="flex items-center gap-4 border-b border-border py-3 last:border-0">
                        <div className="flex-1 min-w-0">
                          <p className="text-sm font-medium truncate">{preview}</p>
                          <p className="text-xs text-muted-foreground">{new Date(entry.created_at).toLocaleDateString()}</p>
                        </div>
                        <Badge variant={entry.status === "published" ? "default" : "secondary"} className="text-xs">{entry.status}</Badge>
                        <Button size="sm" variant="ghost" onClick={() => setEditingEntry(entry)}>Edit</Button>
                        <Button size="icon" variant="ghost" className="text-destructive hover:text-destructive" onClick={() => setPendingDeleteEntry(entry)} disabled={busyId === entry.id}>
                          <Trash2 className="h-3.5 w-3.5" />
                        </Button>
                      </div>
                    );
                  })}
                </div>
              )}
            </>
          )}
        </div>
      )}

      <AlertDialog open={Boolean(pendingDeleteEntry)} onOpenChange={(o) => !o && setPendingDeleteEntry(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete this entry?</AlertDialogTitle>
            <AlertDialogDescription>This action cannot be undone.</AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={handleDeleteEntry} className="bg-destructive text-destructive-foreground hover:bg-destructive/90">Delete</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
