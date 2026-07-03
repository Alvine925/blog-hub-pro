import { createFileRoute } from "@tanstack/react-router";
import { useState, useMemo } from "react";
import { z } from "zod";
import SyntaxHighlighter from "react-syntax-highlighter";
import { atomOneDark } from "react-syntax-highlighter/dist/esm/styles/hljs";
import {
  Copy, Check, Play, Loader2, Key, Globe, ChevronDown, ChevronUp,
  ArrowLeft, Search, X,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { toast } from "sonner";

import { ENDPOINT_REGISTRY, CATEGORY_LABELS, type EndpointDefinition } from "@/lib/EndpointRegistry";
import { generateSnippet, ALL_LANGUAGES, LANGUAGE_LABELS, type CodeLanguage } from "@/lib/ExampleGenerator";
import { buildParamList } from "@/lib/ParameterParser";

// ── Route ─────────────────────────────────────────────────────────────────────

const searchSchema = z.object({ endpointId: z.string().optional() });

export const Route = createFileRoute("/admin/api-explorer")({
  head: () => ({ meta: [{ title: "API Explorer — Lunar CMS" }] }),
  validateSearch: searchSchema,
  component: ApiExplorerPage,
});

// ── Constants ─────────────────────────────────────────────────────────────────

const SUPABASE_PROJECT_ID = "pzhsjhprnqfhixjkekxr";
const PROD_BASE_URL = `https://${SUPABASE_PROJECT_ID}.supabase.co/functions/v1/content-router`;
const BASE_URL = typeof window !== "undefined" ? window.location.origin : "";

const METHOD_COLOR: Record<string, string> = {
  GET:    "text-emerald-700 bg-emerald-50 border border-emerald-200",
  POST:   "text-blue-700   bg-blue-50   border border-blue-200",
  PUT:    "text-amber-700  bg-amber-50  border border-amber-200",
  PATCH:  "text-orange-700 bg-orange-50 border border-orange-200",
  DELETE: "text-red-700    bg-red-50    border border-red-200",
};

// ── CopyBtn ───────────────────────────────────────────────────────────────────

function CopyBtn({ text, label = "Copy" }: { text: string; label?: string }) {
  const [copied, setCopied] = useState(false);
  return (
    <button
      type="button"
      onClick={() => {
        navigator.clipboard.writeText(text);
        toast.success("Copied");
        setCopied(true);
        setTimeout(() => setCopied(false), 2000);
      }}
      className="flex items-center gap-1 text-xs text-zinc-400 hover:text-zinc-700 transition-colors"
    >
      {copied ? <Check className="h-3 w-3 text-emerald-500" /> : <Copy className="h-3 w-3" />}
      {label}
    </button>
  );
}

// ── Main component ─────────────────────────────────────────────────────────────

function ApiExplorerPage() {
  const { endpointId: initialId } = Route.useSearch();

  const [selectedId, setSelectedId] = useState<string>(
    initialId ?? ENDPOINT_REGISTRY[0]?.id ?? ""
  );
  const [apiKey, setApiKey] = useState("");
  const [lang, setLang] = useState<CodeLanguage>("curl");
  const [filter, setFilter] = useState("");

  // Try It state
  const [tryValues, setTryValues] = useState<Record<string, string>>({});
  const [tryLoading, setTryLoading] = useState(false);
  const [tryResult, setTryResult] = useState<{ status: number; body: string; ms: number } | null>(null);

  const ep = ENDPOINT_REGISTRY.find((e) => e.id === selectedId) ?? ENDPOINT_REGISTRY[0];

  const grouped = useMemo(() => {
    const g: Record<string, EndpointDefinition[]> = {};
    const q = filter.toLowerCase();
    for (const e of ENDPOINT_REGISTRY) {
      if (q && !e.path.toLowerCase().includes(q) && !e.title.toLowerCase().includes(q)) continue;
      const label = CATEGORY_LABELS[e.category] ?? e.category;
      g[label] = [...(g[label] ?? []), e];
    }
    return g;
  }, [filter]);

  const params = ep ? buildParamList(ep) : [];
  const snippet = ep ? generateSnippet(ep, lang, BASE_URL, apiKey || "pk_live_your_key_here") : "";

  function buildUrl() {
    if (!ep) return "";
    let path = ep.path;
    const qs: string[] = [];
    for (const p of params) {
      const val = tryValues[p.name] ?? p.default ?? "";
      if (!val) continue;
      if (p.source === "path") {
        path = path.replace(`:${p.name}`, encodeURIComponent(val));
      } else {
        qs.push(`${p.name}=${encodeURIComponent(val)}`);
      }
    }
    return `${BASE_URL}/api/v1${path}${qs.length ? "?" + qs.join("&") : ""}`;
  }

  async function handleSend() {
    if (!ep) return;
    setTryLoading(true);
    setTryResult(null);
    const t0 = Date.now();
    try {
      const res = await fetch(buildUrl(), {
        method: ep.method,
        headers: {
          ...(apiKey ? { Authorization: `Bearer ${apiKey}` } : {}),
          "Content-Type": "application/json",
        },
      });
      const raw = await res.text();
      let body = raw;
      try { body = JSON.stringify(JSON.parse(raw), null, 2); } catch { /* leave raw */ }
      setTryResult({ status: res.status, body, ms: Date.now() - t0 });
    } catch (err) {
      setTryResult({ status: 0, body: String(err), ms: Date.now() - t0 });
    }
    setTryLoading(false);
  }

  function selectEndpoint(id: string) {
    setSelectedId(id);
    setTryValues({});
    setTryResult(null);
  }

  return (
    <div className="flex h-full overflow-hidden bg-white">

      {/* ── Left sidebar ───────────────────────────────────────────────────── */}
      <aside className="w-64 shrink-0 border-r border-zinc-200 bg-white flex flex-col overflow-hidden">
        {/* Back link + header */}
        <div className="shrink-0 border-b border-zinc-100 px-3 py-3 space-y-3">
          <a
            href="/admin/dashboard"
            className="flex items-center gap-2 rounded-md px-2 py-1.5 text-xs font-medium text-zinc-500 hover:bg-zinc-50 hover:text-zinc-900 transition-colors"
          >
            <ArrowLeft className="h-3.5 w-3.5" />
            Back to Dashboard
          </a>
          <div className="px-2">
            <h1 className="text-sm font-bold text-zinc-900">API Explorer</h1>
            <p className="text-[11px] text-zinc-400 mt-0.5">Test endpoints live</p>
          </div>
          {/* Filter */}
          <div className="relative px-2">
            <Search className="absolute left-4 top-2 h-3.5 w-3.5 text-zinc-400" />
            <input
              type="text"
              value={filter}
              onChange={(e) => setFilter(e.target.value)}
              placeholder="Filter endpoints…"
              className="w-full rounded-lg border border-zinc-200 bg-zinc-50 py-1.5 pl-7 pr-3 text-xs focus:outline-none focus:ring-1 focus:ring-red-500"
            />
          </div>
        </div>

        {/* Endpoint list */}
        <div className="flex-1 overflow-y-auto py-3 px-2">
          {Object.entries(grouped).map(([cat, eps]) => (
            <div key={cat} className="mb-4">
              <p className="px-2 mb-1 text-[9px] font-bold uppercase tracking-widest text-zinc-400">{cat}</p>
              {eps.map((e) => (
                <button
                  key={e.id}
                  type="button"
                  onClick={() => selectEndpoint(e.id)}
                  className={cn(
                    "flex w-full items-center gap-2 rounded-md px-2 py-1.5 text-left transition-colors border-l-2",
                    selectedId === e.id
                      ? "border-red-600 bg-red-50"
                      : "border-transparent hover:bg-zinc-50",
                  )}
                >
                  <span className={cn("rounded px-1 py-0.5 text-[9px] font-bold font-mono shrink-0", METHOD_COLOR[e.method])}>
                    {e.method}
                  </span>
                  <span className={cn("truncate font-mono text-[11px]", selectedId === e.id ? "text-red-700 font-semibold" : "text-zinc-600")}>
                    {e.path}
                  </span>
                </button>
              ))}
            </div>
          ))}
          {Object.keys(grouped).length === 0 && (
            <p className="px-4 text-xs text-zinc-400">No endpoints match "{filter}"</p>
          )}
        </div>
      </aside>

      {/* ── Main content ───────────────────────────────────────────────────── */}
      <div className="flex flex-1 flex-col overflow-hidden">

        {/* Top bar */}
        <div className="shrink-0 flex items-center gap-3 border-b border-zinc-200 bg-white px-6 py-3">
          {/* API key */}
          <div className="relative">
            <Key className="absolute left-2.5 top-2 h-3.5 w-3.5 text-zinc-400" />
            <input
              type="text"
              value={apiKey}
              onChange={(e) => setApiKey(e.target.value)}
              placeholder="Paste API key to authenticate requests"
              className="w-80 rounded-lg border border-zinc-200 bg-zinc-50 py-1.5 pl-8 pr-3 font-mono text-xs focus:outline-none focus:ring-1 focus:ring-red-500"
            />
          </div>

          {/* Prod URL */}
          <div className="hidden lg:flex items-center gap-2 text-xs text-zinc-400 border border-zinc-200 rounded-lg px-3 py-1.5 ml-auto">
            <Globe className="h-3.5 w-3.5 text-red-600" />
            <code className="font-mono text-zinc-600 text-[10px] max-w-[260px] truncate">{PROD_BASE_URL}</code>
            <CopyBtn text={PROD_BASE_URL} />
          </div>
        </div>

        {/* Scrollable body */}
        <div className="flex-1 overflow-y-auto">
          {ep ? (
            <div className="mx-auto max-w-3xl px-8 py-10 space-y-8">

              {/* Endpoint header */}
              <div className="pb-6 border-b border-zinc-100">
                <div className="flex items-center gap-2 mb-2">
                  <span className={cn("rounded px-2 py-0.5 text-xs font-bold font-mono", METHOD_COLOR[ep.method])}>{ep.method}</span>
                  <code className="font-mono text-base font-semibold text-zinc-800">/api/v1{ep.path}</code>
                </div>
                <h1 className="text-2xl font-bold text-zinc-900">{ep.title}</h1>
                <p className="mt-1 text-zinc-500 text-sm leading-relaxed">{ep.longDescription ?? ep.description}</p>
              </div>

              {/* ── Try It ─────────────────────────────────────────────────── */}
              <div className="rounded-lg border border-red-200 overflow-hidden">
                <div className="flex items-center gap-2 px-4 py-3 bg-red-50 border-b border-red-100">
                  <Play className="h-4 w-4 text-red-600" />
                  <h2 className="text-sm font-semibold text-red-700">Try It</h2>
                  <span className="text-xs text-red-400">— live request</span>
                </div>

                <div className="px-4 py-4 space-y-4 bg-white">
                  {/* Live URL */}
                  <div className="flex items-center gap-2 rounded-lg border border-zinc-200 bg-zinc-50 px-3 py-2">
                    <span className={cn("rounded px-1.5 py-0.5 text-[10px] font-bold font-mono shrink-0", METHOD_COLOR[ep.method])}>{ep.method}</span>
                    <code className="font-mono text-xs text-zinc-600 truncate flex-1">{buildUrl()}</code>
                    <CopyBtn text={buildUrl()} />
                  </div>

                  {/* Auth warning */}
                  {!apiKey && (
                    <div className="flex items-center gap-2 rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-xs text-amber-700">
                      <Key className="h-3.5 w-3.5 shrink-0" />
                      No API key — paste one in the bar above to authenticate.
                    </div>
                  )}

                  {/* Params */}
                  {params.length > 0 && (
                    <div className="space-y-2">
                      <p className="text-xs font-semibold text-zinc-500">Parameters</p>
                      <div className="grid gap-2">
                        {params.map((p) => (
                          <div key={p.name} className="flex items-center gap-3">
                            <div className="w-36 shrink-0">
                              <code className="text-xs font-mono text-zinc-700">{p.name}</code>
                              {p.required && <span className="ml-1 text-[9px] text-red-500 font-bold">*</span>}
                              <p className="text-[10px] text-zinc-400">{p.source === "path" ? "path" : "query"}</p>
                            </div>
                            <input
                              type="text"
                              value={tryValues[p.name] ?? p.default ?? ""}
                              onChange={(e) => setTryValues((v) => ({ ...v, [p.name]: e.target.value }))}
                              placeholder={p.default ?? p.description ?? p.name}
                              className="flex-1 rounded-lg border border-zinc-200 bg-zinc-50 px-3 py-1.5 font-mono text-xs focus:outline-none focus:ring-1 focus:ring-red-500"
                            />
                          </div>
                        ))}
                      </div>
                    </div>
                  )}

                  {/* Send */}
                  <button
                    type="button"
                    onClick={handleSend}
                    disabled={tryLoading}
                    className="flex items-center gap-2 rounded-lg bg-red-600 px-4 py-2 text-sm font-semibold text-white hover:bg-red-700 disabled:opacity-60 transition-colors"
                  >
                    {tryLoading
                      ? <Loader2 className="h-4 w-4 animate-spin" />
                      : <Play className="h-4 w-4" />}
                    {tryLoading ? "Sending…" : "Send Request"}
                  </button>

                  {/* Response */}
                  {tryResult && (
                    <div className="space-y-2">
                      <div className="flex items-center gap-3">
                        <span className={cn(
                          "rounded-full px-2.5 py-0.5 text-xs font-bold",
                          tryResult.status === 0 ? "bg-red-100 text-red-700" :
                          tryResult.status < 300 ? "bg-emerald-100 text-emerald-700" :
                          tryResult.status < 400 ? "bg-blue-100 text-blue-700" :
                          "bg-red-100 text-red-700",
                        )}>
                          {tryResult.status === 0 ? "Network Error" : `${tryResult.status}`}
                        </span>
                        <span className="text-xs text-zinc-400">{tryResult.ms} ms</span>
                        <CopyBtn text={tryResult.body} label="Copy response" />
                        <button type="button" onClick={() => setTryResult(null)} className="ml-auto text-zinc-400 hover:text-zinc-600">
                          <X className="h-3.5 w-3.5" />
                        </button>
                      </div>
                      <pre className="max-h-72 overflow-y-auto rounded-lg border border-zinc-200 bg-zinc-950 p-3 text-xs font-mono text-zinc-100 leading-relaxed whitespace-pre-wrap">
                        {tryResult.body}
                      </pre>
                    </div>
                  )}
                </div>
              </div>

              {/* ── Code Example ───────────────────────────────────────────── */}
              <div>
                <div className="mb-3 flex items-center justify-between">
                  <h2 className="text-sm font-semibold text-zinc-700">Code Example</h2>
                  <div className="flex flex-wrap gap-1">
                    {ALL_LANGUAGES.map((l) => (
                      <button
                        key={l}
                        type="button"
                        onClick={() => setLang(l)}
                        className={cn(
                          "rounded px-2 py-0.5 text-xs font-medium transition-colors",
                          l === lang ? "bg-red-600 text-white" : "border border-zinc-200 text-zinc-500 hover:text-zinc-800",
                        )}
                      >
                        {LANGUAGE_LABELS[l]}
                      </button>
                    ))}
                  </div>
                </div>
                <div className="relative group rounded-lg overflow-hidden border border-zinc-800">
                  <div className="flex items-center justify-between px-4 py-2 bg-zinc-900 border-b border-zinc-800">
                    <span className="text-[10px] font-semibold uppercase tracking-widest text-zinc-500">
                      {LANGUAGE_LABELS[lang]}
                    </span>
                    <CopyBtn text={snippet} />
                  </div>
                  <SyntaxHighlighter
                    language={lang === "curl" ? "bash" : lang}
                    style={atomOneDark}
                    customStyle={{ margin: 0, padding: "1rem", fontSize: "0.75rem", background: "#18181b", lineHeight: "1.6" }}
                    wrapLongLines
                  >
                    {snippet}
                  </SyntaxHighlighter>
                </div>
              </div>

              {/* ── Parameters table ────────────────────────────────────────── */}
              {params.length > 0 && (
                <div>
                  <h2 className="text-sm font-semibold text-zinc-700 mb-3">Parameters</h2>
                  <div className="overflow-hidden rounded-lg border border-zinc-200">
                    <table className="w-full text-sm">
                      <thead className="bg-zinc-50">
                        <tr>
                          {["Name", "In", "Type", "Required", "Default", "Description"].map((h) => (
                            <th key={h} className="px-4 py-2.5 text-left text-xs font-semibold text-zinc-500">{h}</th>
                          ))}
                        </tr>
                      </thead>
                      <tbody>
                        {params.map((p, i) => (
                          <tr key={`${p.name}-${i}`} className={cn(i > 0 && "border-t border-zinc-100")}>
                            <td className="px-4 py-3"><code className="font-mono text-xs bg-zinc-100 px-1 rounded">{p.name}</code></td>
                            <td className="px-4 py-3 text-xs text-zinc-400">{p.source === "path" ? "path" : "query"}</td>
                            <td className="px-4 py-3 text-zinc-500 text-xs">{p.type}</td>
                            <td className="px-4 py-3">
                              {p.required
                                ? <span className="rounded-full bg-red-50 border border-red-200 text-red-700 text-[10px] font-semibold px-2 py-0.5">required</span>
                                : <span className="text-xs text-zinc-300">optional</span>}
                            </td>
                            <td className="px-4 py-3 font-mono text-xs text-zinc-400">{p.default ?? "—"}</td>
                            <td className="px-4 py-3 text-xs text-zinc-500">{p.description}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              )}

              {/* ── Example response ────────────────────────────────────────── */}
              <div>
                <h2 className="text-sm font-semibold text-zinc-700 mb-3">Example Response</h2>
                <div className="relative rounded-lg overflow-hidden border border-zinc-800">
                  <div className="flex items-center justify-between px-4 py-2 bg-zinc-900 border-b border-zinc-800">
                    <span className="text-[10px] font-semibold uppercase tracking-widest text-zinc-500">JSON</span>
                    <CopyBtn text={JSON.stringify(ep.exampleResponse, null, 2)} />
                  </div>
                  <SyntaxHighlighter
                    language="json"
                    style={atomOneDark}
                    customStyle={{ margin: 0, padding: "1rem", fontSize: "0.75rem", background: "#18181b", lineHeight: "1.6" }}
                    wrapLongLines
                  >
                    {JSON.stringify(ep.exampleResponse, null, 2)}
                  </SyntaxHighlighter>
                </div>
              </div>

            </div>
          ) : (
            <div className="flex h-full items-center justify-center text-zinc-400 text-sm">
              Select an endpoint from the sidebar
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
