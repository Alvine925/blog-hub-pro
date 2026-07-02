import { createFileRoute, Link } from "@tanstack/react-router";
import { queryOptions, useSuspenseQuery, useQueryClient } from "@tanstack/react-query";
import { useState, useEffect, useCallback, useRef } from "react";
import {
  RefreshCw, Download, Search, ChevronLeft, ChevronRight,
  CheckCircle2, AlertCircle, XCircle, Clock, Zap, ArrowRight,
} from "lucide-react";
import { listApiRequestLogs, type ApiRequestLog } from "@/lib/apikey.functions";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

type StatusClass = "all" | "2xx" | "4xx" | "5xx";

const PAGE_SIZE = 50;

function makeQuery(page: number, status_class: StatusClass, path_filter: string) {
  return queryOptions({
    queryKey: ["admin", "api-logs", page, status_class, path_filter],
    queryFn: () =>
      listApiRequestLogs({
        data: {
          limit: PAGE_SIZE,
          offset: page * PAGE_SIZE,
          status_class,
          path_filter,
        },
      }),
    staleTime: 10_000,
  });
}

export const Route = createFileRoute("/admin/api-logs")({
  head: () => ({ meta: [{ title: "Request Logs — Lunar CMS" }] }),
  loader: ({ context }) =>
    context.queryClient.ensureQueryData(makeQuery(0, "all", "")),
  component: ApiLogsPage,
  errorComponent: ({ error }) => (
    <p className="p-8 text-sm text-destructive">{error.message}</p>
  ),
});

// ── helpers ─────────────────────────────────────────────────────────────────

function fmtTs(iso: string) {
  const d = new Date(iso);
  const date = d.toLocaleDateString("en-US", { month: "short", day: "numeric" });
  const time = d.toLocaleTimeString("en-US", { hour: "2-digit", minute: "2-digit", second: "2-digit", hour12: false });
  return { date, time };
}

function StatusBadge({ code }: { code: number | null }) {
  if (code == null) return <span className="text-xs text-muted-foreground">—</span>;
  const cls =
    code < 300 ? "bg-emerald-50 text-emerald-700" :
    code < 400 ? "bg-sky-50 text-sky-700" :
    code < 500 ? "bg-amber-50 text-amber-700" :
                 "bg-red-50 text-red-700";
  return (
    <span className={cn("inline-flex items-center rounded px-1.5 py-0.5 text-[11px] font-bold tabular-nums", cls)}>
      {code}
    </span>
  );
}

function MethodBadge({ method }: { method: string }) {
  const cls: Record<string, string> = {
    GET:    "text-sky-600",
    POST:   "text-emerald-600",
    PUT:    "text-amber-600",
    PATCH:  "text-violet-600",
    DELETE: "text-red-600",
  };
  return (
    <span className={cn("text-[11px] font-bold uppercase tabular-nums w-10 shrink-0", cls[method] ?? "text-muted-foreground")}>
      {method}
    </span>
  );
}

function DurationBadge({ ms }: { ms: number | null }) {
  if (ms == null) return <span className="text-xs text-muted-foreground">—</span>;
  const cls = ms < 200 ? "text-emerald-600" : ms < 800 ? "text-amber-600" : "text-red-600";
  return <span className={cn("text-xs tabular-nums font-medium", cls)}>{ms}ms</span>;
}

function StatusClassIcon({ code }: { code: number | null }) {
  if (code == null) return <Clock className="h-3.5 w-3.5 text-muted-foreground/40" />;
  if (code < 300) return <CheckCircle2 className="h-3.5 w-3.5 text-emerald-500" />;
  if (code < 500) return <AlertCircle className="h-3.5 w-3.5 text-amber-500" />;
  return <XCircle className="h-3.5 w-3.5 text-red-500" />;
}

function exportCsv(rows: ApiRequestLog[]) {
  const headers = ["requested_at", "method", "path", "status_code", "duration_ms", "key_name", "key_prefix", "error"];
  const lines = [
    headers.join(","),
    ...rows.map((r) =>
      [
        r.requested_at,
        r.method,
        `"${r.path}"`,
        r.status_code ?? "",
        r.duration_ms ?? "",
        `"${r.key_name ?? ""}"`,
        r.key_prefix ?? "",
        `"${(r.error ?? "").replace(/"/g, '""')}"`,
      ].join(","),
    ),
  ];
  const blob = new Blob([lines.join("\n")], { type: "text/csv" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = `api-logs-${new Date().toISOString().slice(0, 10)}.csv`;
  a.click();
  URL.revokeObjectURL(url);
}

// ── detail drawer ────────────────────────────────────────────────────────────

function LogDetailDrawer({ log, onClose }: { log: ApiRequestLog; onClose: () => void }) {
  const { date, time } = fmtTs(log.requested_at);
  return (
    <div className="fixed inset-y-0 right-0 z-50 flex w-96 flex-col bg-background shadow-2xl border-l border-border">
      <div className="flex items-center justify-between border-b border-border px-5 py-3">
        <h2 className="text-sm font-semibold">Request detail</h2>
        <button onClick={onClose} className="text-muted-foreground hover:text-foreground text-lg leading-none">×</button>
      </div>
      <div className="flex-1 overflow-y-auto px-5 py-4 space-y-5 text-sm">
        <Row label="Time">{date} {time}</Row>
        <Row label="Method"><MethodBadge method={log.method} /></Row>
        <Row label="Path"><code className="text-xs break-all">{log.path}</code></Row>
        <Row label="Status"><StatusBadge code={log.status_code} /></Row>
        <Row label="Duration"><DurationBadge ms={log.duration_ms} /></Row>
        {log.key_name && <Row label="API Key">{log.key_name} <span className="text-muted-foreground ml-1 font-mono text-xs">{log.key_prefix}…</span></Row>}
        {log.ip_address && <Row label="IP">{log.ip_address}</Row>}
        {log.user_agent && (
          <div>
            <p className="text-[10px] font-semibold uppercase tracking-widest text-muted-foreground/60 mb-1">User-Agent</p>
            <p className="text-xs break-all text-muted-foreground">{log.user_agent}</p>
          </div>
        )}
        {log.error && (
          <div>
            <p className="text-[10px] font-semibold uppercase tracking-widest text-red-500 mb-1">Error</p>
            <pre className="text-xs text-red-600 bg-red-50 rounded p-3 overflow-x-auto whitespace-pre-wrap break-all">{log.error}</pre>
          </div>
        )}
        {log.workspace_id && <Row label="Workspace ID"><code className="text-xs">{log.workspace_id}</code></Row>}
        {log.api_key_id && <Row label="Key ID"><code className="text-xs">{log.api_key_id}</code></Row>}
      </div>
    </div>
  );
}

function Row({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="flex items-start gap-3">
      <span className="w-20 shrink-0 text-[10px] font-semibold uppercase tracking-widest text-muted-foreground/60 mt-0.5">{label}</span>
      <div className="flex-1 min-w-0">{children}</div>
    </div>
  );
}

// ── main page ─────────────────────────────────────────────────────────────────

function ApiLogsPage() {
  const queryClient = useQueryClient();
  const [page, setPage] = useState(0);
  const [statusClass, setStatusClass] = useState<StatusClass>("all");
  const [pathFilter, setPathFilter] = useState("");
  const [debouncedPath, setDebouncedPath] = useState("");
  const [autoRefresh, setAutoRefresh] = useState(false);
  const [selected, setSelected] = useState<ApiRequestLog | null>(null);
  const [refreshing, setRefreshing] = useState(false);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);

  // Debounce path filter
  useEffect(() => {
    const id = setTimeout(() => { setDebouncedPath(pathFilter); setPage(0); }, 400);
    return () => clearTimeout(id);
  }, [pathFilter]);

  const q = makeQuery(page, statusClass, debouncedPath);
  const { data } = useSuspenseQuery(q);

  const refresh = useCallback(async () => {
    setRefreshing(true);
    await queryClient.invalidateQueries({ queryKey: ["admin", "api-logs"] });
    setRefreshing(false);
  }, [queryClient]);

  // Auto-refresh every 10s
  useEffect(() => {
    if (timerRef.current) clearInterval(timerRef.current);
    if (autoRefresh) timerRef.current = setInterval(refresh, 10_000);
    return () => { if (timerRef.current) clearInterval(timerRef.current); };
  }, [autoRefresh, refresh]);

  const totalPages = Math.max(1, Math.ceil(data.total / PAGE_SIZE));

  const statusTabs: { label: string; value: StatusClass; color: string }[] = [
    { label: "All",  value: "all",  color: "" },
    { label: "2xx",  value: "2xx",  color: "text-emerald-600" },
    { label: "4xx",  value: "4xx",  color: "text-amber-600"   },
    { label: "5xx",  value: "5xx",  color: "text-red-600"     },
  ];

  return (
    <div className="min-h-full flex flex-col">
      {/* Header */}
      <div className="flex items-start justify-between gap-4 px-8 py-7 border-b border-border">
        <div>
          <h1 className="text-xl font-semibold flex items-center gap-2">
            <Zap className="h-5 w-5 text-primary" /> Request Logs
          </h1>
          <p className="mt-0.5 text-sm text-muted-foreground">
            Live view of every API call routed through the gateway.
            {" "}<Link to="/admin/api-keys" className="text-primary hover:underline">Manage keys →</Link>
          </p>
        </div>

        <div className="flex items-center gap-2 shrink-0">
          {/* Auto-refresh toggle */}
          <button
            type="button"
            onClick={() => setAutoRefresh((v) => !v)}
            className={cn(
              "flex items-center gap-1.5 rounded-md border px-3 py-1.5 text-xs font-medium transition-colors",
              autoRefresh
                ? "border-primary bg-primary/5 text-primary"
                : "border-border text-muted-foreground hover:text-foreground",
            )}
            title={autoRefresh ? "Auto-refresh on (10s)" : "Auto-refresh off"}
          >
            <span className={cn(
              "inline-block h-1.5 w-1.5 rounded-full",
              autoRefresh ? "bg-primary animate-pulse" : "bg-muted-foreground/40",
            )} />
            Live
          </button>

          <Button
            variant="outline"
            size="sm"
            onClick={refresh}
            disabled={refreshing}
            className="gap-1.5"
          >
            <RefreshCw className={cn("h-3.5 w-3.5", refreshing && "animate-spin")} />
            Refresh
          </Button>

          <Button
            variant="outline"
            size="sm"
            onClick={() => exportCsv(data.rows)}
            disabled={data.rows.length === 0}
            className="gap-1.5"
          >
            <Download className="h-3.5 w-3.5" />
            Export CSV
          </Button>
        </div>
      </div>

      {/* Filters row */}
      <div className="flex items-center gap-3 border-b border-border px-8 py-3">
        {/* Status tabs */}
        <div className="flex items-center rounded-md border border-border overflow-hidden shrink-0">
          {statusTabs.map((t) => (
            <button
              key={t.value}
              type="button"
              onClick={() => { setStatusClass(t.value); setPage(0); }}
              className={cn(
                "px-3 py-1 text-xs font-semibold border-r border-border last:border-r-0 transition-colors",
                statusClass === t.value
                  ? "bg-foreground text-background"
                  : "bg-background text-muted-foreground hover:bg-muted/40",
                t.color,
              )}
            >
              {t.label}
            </button>
          ))}
        </div>

        {/* Path search */}
        <div className="relative flex-1 max-w-xs">
          <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground/50" />
          <Input
            placeholder="Filter by path…"
            value={pathFilter}
            onChange={(e) => setPathFilter(e.target.value)}
            className="pl-8 h-8 text-xs"
          />
        </div>

        <span className="ml-auto text-xs text-muted-foreground shrink-0 tabular-nums">
          {data.total.toLocaleString()} request{data.total !== 1 ? "s" : ""}
        </span>
      </div>

      {/* Table */}
      <div className="flex-1 overflow-x-auto">
        {data.rows.length === 0 ? (
          <div className="flex flex-col items-center gap-3 py-24 text-center">
            <Zap className="h-8 w-8 text-muted-foreground/20" />
            <p className="text-sm text-muted-foreground">No requests logged yet.</p>
            <p className="text-xs text-muted-foreground max-w-xs">
              Requests made to the API gateway via your Edge Function will appear here automatically.
            </p>
            <Link
              to="/admin/api-keys"
              className="mt-2 flex items-center gap-1 text-xs text-primary hover:underline"
            >
              Get an API key <ArrowRight className="h-3 w-3" />
            </Link>
          </div>
        ) : (
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-border text-left">
                <th className="w-6 px-4 py-2.5" />
                <th className="px-4 py-2.5 text-[10px] font-bold uppercase tracking-widest text-muted-foreground/60">Time</th>
                <th className="px-4 py-2.5 text-[10px] font-bold uppercase tracking-widest text-muted-foreground/60">Method</th>
                <th className="px-4 py-2.5 text-[10px] font-bold uppercase tracking-widest text-muted-foreground/60">Path</th>
                <th className="px-4 py-2.5 text-[10px] font-bold uppercase tracking-widest text-muted-foreground/60">Status</th>
                <th className="px-4 py-2.5 text-[10px] font-bold uppercase tracking-widest text-muted-foreground/60">Duration</th>
                <th className="px-4 py-2.5 text-[10px] font-bold uppercase tracking-widest text-muted-foreground/60 hidden lg:table-cell">Key</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border/50">
              {data.rows.map((row) => {
                const { date, time } = fmtTs(row.requested_at);
                const isSelected = selected?.id === row.id;
                return (
                  <tr
                    key={row.id}
                    onClick={() => setSelected(isSelected ? null : row)}
                    className={cn(
                      "cursor-pointer transition-colors hover:bg-muted/30",
                      isSelected && "bg-primary/5",
                      row.status_code != null && row.status_code >= 500 && "bg-red-50/40 hover:bg-red-50/60",
                    )}
                  >
                    <td className="w-6 px-4 py-2.5">
                      <StatusClassIcon code={row.status_code} />
                    </td>
                    <td className="px-4 py-2.5 text-xs text-muted-foreground whitespace-nowrap tabular-nums">
                      <span className="text-foreground">{time}</span>
                      <span className="ml-1.5 text-muted-foreground/50">{date}</span>
                    </td>
                    <td className="px-4 py-2.5">
                      <MethodBadge method={row.method} />
                    </td>
                    <td className="px-4 py-2.5 max-w-[260px] truncate font-mono text-xs text-muted-foreground">
                      {row.path}
                    </td>
                    <td className="px-4 py-2.5">
                      <StatusBadge code={row.status_code} />
                    </td>
                    <td className="px-4 py-2.5">
                      <DurationBadge ms={row.duration_ms} />
                    </td>
                    <td className="px-4 py-2.5 hidden lg:table-cell">
                      {row.key_name ? (
                        <span className="text-xs">
                          {row.key_name}
                          <span className="ml-1 font-mono text-muted-foreground/50 text-[10px]">{row.key_prefix}…</span>
                        </span>
                      ) : (
                        <span className="text-xs text-muted-foreground/40">—</span>
                      )}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        )}
      </div>

      {/* Pagination */}
      {totalPages > 1 && (
        <div className="flex items-center justify-between border-t border-border px-8 py-3">
          <span className="text-xs text-muted-foreground">
            Page {page + 1} of {totalPages}
          </span>
          <div className="flex items-center gap-1">
            <Button
              variant="outline"
              size="sm"
              onClick={() => setPage((p) => Math.max(0, p - 1))}
              disabled={page === 0}
            >
              <ChevronLeft className="h-3.5 w-3.5" />
            </Button>
            <Button
              variant="outline"
              size="sm"
              onClick={() => setPage((p) => Math.min(totalPages - 1, p + 1))}
              disabled={page >= totalPages - 1}
            >
              <ChevronRight className="h-3.5 w-3.5" />
            </Button>
          </div>
        </div>
      )}

      {/* Detail drawer overlay */}
      {selected && (
        <>
          <div
            className="fixed inset-0 z-40 bg-black/20"
            onClick={() => setSelected(null)}
          />
          <LogDetailDrawer log={selected} onClose={() => setSelected(null)} />
        </>
      )}
    </div>
  );
}
