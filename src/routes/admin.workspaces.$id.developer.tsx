import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useState, useMemo, useEffect, useCallback } from "react";
import { z } from "zod";
import {
  Copy, Check, Search, BookOpen, Key, Zap, Code2, AlertTriangle,
  Clock, Layers, Star, StarOff, Eye, ChevronRight, ExternalLink,
  Activity, Globe, Shield, Sparkles, FileText, Database, Hash,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { toast } from "sonner";

import { createDocService, DOC_SECTIONS, CATEGORY_LABELS, ALL_LANGUAGES, LANGUAGE_LABELS } from "@/lib/DocumentationRenderer";
import { ENDPOINT_REGISTRY, type EndpointDefinition } from "@/lib/EndpointRegistry";
import { generateSnippet, type CodeLanguage } from "@/lib/ExampleGenerator";
import { buildParamList, formatParamType } from "@/lib/ParameterParser";
import { searchDocs, type SearchResult } from "@/lib/DocumentationSearch";
import {
  DOC_SECTIONS as ALL_SECTIONS,
  ERROR_DOCS,
  RATE_LIMIT_TIERS,
  CHANGELOG,
  FRAMEWORK_GUIDES,
} from "@/lib/DocumentationService";
import { generatePrompt } from "@/lib/PromptGeneratorService";
import { AI_PLATFORMS } from "@/lib/prompt-templates";

// ── Route ─────────────────────────────────────────────────────────────────────

const searchSchema = z.object({
  section:    z.string().optional().default("overview"),
  endpointId: z.string().optional(),
});

export const Route = createFileRoute("/admin/workspaces/$id/developer")({
  head: () => ({ meta: [{ title: "Developer Docs" }] }),
  validateSearch: searchSchema,
  component: DeveloperDocs,
});

// ── Helpers ───────────────────────────────────────────────────────────────────

const METHOD_COLOR: Record<string, string> = {
  GET:    "text-emerald-700 bg-emerald-50 border border-emerald-200",
  POST:   "text-blue-700 bg-blue-50 border border-blue-200",
  PUT:    "text-amber-700 bg-amber-50 border border-amber-200",
  PATCH:  "text-orange-700 bg-orange-50 border border-orange-200",
  DELETE: "text-red-700 bg-red-50 border border-red-200",
};

const SECTION_ICONS: Record<string, React.ComponentType<{ className?: string }>> = {
  overview:       BookOpen,
  authentication: Shield,
  "api-keys":     Key,
  "first-request":Zap,
  pagination:     Hash,
  filtering:      Layers,
  search:         Search,
  errors:         AlertTriangle,
  "rate-limits":  Activity,
  versioning:     Globe,
  "code-examples":Code2,
  frameworks:     FileText,
  "ai-prompts":   Sparkles,
  endpoints:      Database,
  changelog:      Clock,
};

function CopyBtn({ text, label = "Copy" }: { text: string; label?: string }) {
  const [copied, setCopied] = useState(false);
  return (
    <button
      type="button"
      onClick={() => {
        navigator.clipboard.writeText(text);
        setCopied(true);
        toast.success("Copied to clipboard");
        setTimeout(() => setCopied(false), 2000);
      }}
      className="flex items-center gap-1.5 text-xs text-muted-foreground hover:text-foreground transition-colors"
    >
      {copied ? <Check className="h-3.5 w-3.5 text-emerald-500" /> : <Copy className="h-3.5 w-3.5" />}
      {copied ? "Copied!" : label}
    </button>
  );
}

function CodeBlock({ code, language = "" }: { code: string; language?: string }) {
  return (
    <div className="group relative">
      <div className="absolute right-3 top-3 opacity-0 group-hover:opacity-100 transition-opacity z-10">
        <CopyBtn text={code} />
      </div>
      <pre className="overflow-x-auto rounded-lg border border-border bg-zinc-950 p-4 text-xs text-zinc-100 font-mono leading-relaxed">
        <code>{code}</code>
      </pre>
    </div>
  );
}

function Badge({ text, color = "gray" }: { text: string; color?: "gray" | "green" | "blue" | "amber" | "red" }) {
  const colors = {
    gray:  "bg-muted text-muted-foreground",
    green: "bg-emerald-50 text-emerald-700 border border-emerald-200",
    blue:  "bg-blue-50 text-blue-700 border border-blue-200",
    amber: "bg-amber-50 text-amber-700 border border-amber-200",
    red:   "bg-red-50 text-red-700 border border-red-200",
  };
  return <span className={cn("inline-flex items-center rounded px-1.5 py-0.5 text-[10px] font-semibold font-mono", colors[color])}>{text}</span>;
}

// ── Persistent state (favorites + recently viewed) ────────────────────────────

function useFavorites(workspaceId: string) {
  const KEY = `lunar-doc-favorites-${workspaceId}`;
  const [favs, setFavs] = useState<string[]>(() => {
    try { return JSON.parse(localStorage.getItem(KEY) ?? "[]"); } catch { return []; }
  });
  const toggle = useCallback((epId: string) => {
    setFavs((prev) => {
      const next = prev.includes(epId) ? prev.filter((f) => f !== epId) : [...prev, epId];
      localStorage.setItem(KEY, JSON.stringify(next));
      return next;
    });
  }, [KEY]);
  return { favs, toggle };
}

function useRecentlyViewed(workspaceId: string) {
  const KEY = `lunar-doc-recent-${workspaceId}`;
  const [recent, setRecent] = useState<string[]>(() => {
    try { return JSON.parse(localStorage.getItem(KEY) ?? "[]"); } catch { return []; }
  });
  const push = useCallback((epId: string) => {
    setRecent((prev) => {
      const next = [epId, ...prev.filter((r) => r !== epId)].slice(0, 5);
      localStorage.setItem(KEY, JSON.stringify(next));
      return next;
    });
  }, [KEY]);
  return { recent, push };
}

// ── Sidebar ───────────────────────────────────────────────────────────────────

function DocSidebar({
  section,
  endpointId,
  onNavigate,
}: {
  section: string;
  endpointId?: string;
  onNavigate: (s: string, epId?: string) => void;
}) {
  const grouped = useMemo(() => {
    const g: Record<string, typeof ALL_SECTIONS> = {};
    for (const s of ALL_SECTIONS) {
      g[s.group] = [...(g[s.group] ?? []), s];
    }
    return g;
  }, []);

  const epsByCategory = useMemo(() => {
    const g: Record<string, EndpointDefinition[]> = {};
    for (const ep of ENDPOINT_REGISTRY) {
      const label = CATEGORY_LABELS[ep.category];
      g[label] = [...(g[label] ?? []), ep];
    }
    return g;
  }, []);

  const isEpSection = section === "endpoints" || !!endpointId;

  return (
    <aside className="w-56 shrink-0 border-r border-border bg-white overflow-y-auto">
      <div className="py-4 px-3">
        {Object.entries(grouped).map(([group, items]) => (
          <div key={group} className="mb-5">
            <p className="mb-1 px-2 text-[9px] font-bold uppercase tracking-widest text-muted-foreground/60">
              {group}
            </p>
            {items.map((item) => {
              const Icon = SECTION_ICONS[item.id] ?? BookOpen;
              const active = section === item.id && !endpointId;
              return (
                <div key={item.id}>
                  <button
                    type="button"
                    onClick={() => onNavigate(item.id)}
                    className={cn(
                      "flex w-full items-center gap-2 rounded-md px-2 py-1.5 text-sm font-medium transition-colors text-left",
                      active
                        ? "bg-primary/10 text-primary"
                        : "text-muted-foreground hover:bg-muted hover:text-foreground",
                    )}
                  >
                    <Icon className="h-3.5 w-3.5 shrink-0" />
                    {item.title}
                  </button>

                  {/* Endpoints sub-nav */}
                  {item.id === "endpoints" && isEpSection && (
                    <div className="mt-1 ml-5 space-y-0.5">
                      {Object.entries(epsByCategory).map(([cat, eps]) => (
                        <div key={cat}>
                          <p className="px-2 py-1 text-[9px] font-bold uppercase tracking-widest text-muted-foreground/50">{cat}</p>
                          {eps.map((ep) => (
                            <button
                              key={ep.id}
                              type="button"
                              onClick={() => onNavigate("endpoints", ep.id)}
                              className={cn(
                                "flex w-full items-center gap-1.5 rounded px-2 py-1 text-xs transition-colors text-left",
                                endpointId === ep.id
                                  ? "bg-primary/10 text-primary font-medium"
                                  : "text-muted-foreground hover:text-foreground",
                              )}
                            >
                              <span className={cn("rounded px-1 py-0.5 text-[9px] font-bold font-mono shrink-0", METHOD_COLOR[ep.method])}>
                                {ep.method}
                              </span>
                              <span className="truncate font-mono text-[10px]">{ep.path}</span>
                            </button>
                          ))}
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        ))}
      </div>
    </aside>
  );
}

// ── Section: Overview ─────────────────────────────────────────────────────────

function OverviewSection({ baseUrl }: { baseUrl: string }) {
  const categories = [...new Set(ENDPOINT_REGISTRY.map((e) => CATEGORY_LABELS[e.category]))];
  // Derive example from the first list endpoint in the registry — stays in sync automatically
  const firstListEp = ENDPOINT_REGISTRY.find((e) => e.pagination) ?? ENDPOINT_REGISTRY[0];
  const exampleReq = `curl "${baseUrl}/api/v1${firstListEp.path}?limit=10" \\
  -H "Authorization: Bearer YOUR_API_KEY"`;
  const exampleRes = JSON.stringify(firstListEp.exampleResponse, null, 2);

  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-2xl font-bold">Getting Started</h1>
        <p className="mt-2 text-muted-foreground">
          The Lunar CMS REST API lets you fetch your workspace content from any application.
          Authenticate with an API key and start fetching in minutes.
        </p>
      </div>

      <div className="grid grid-cols-3 gap-4">
        {[
          { icon: Zap, label: "REST API", desc: "Standard HTTP + JSON" },
          { icon: Shield, label: "API Key Auth", desc: "Bearer token authentication" },
          { icon: Globe, label: `${ENDPOINT_REGISTRY.length} Endpoints`, desc: `Across ${categories.length} categories` },
        ].map((f) => (
          <div key={f.label} className="rounded-lg border border-border bg-muted/30 p-4">
            <f.icon className="h-5 w-5 text-primary mb-2" />
            <p className="font-semibold text-sm">{f.label}</p>
            <p className="text-xs text-muted-foreground mt-0.5">{f.desc}</p>
          </div>
        ))}
      </div>

      <div>
        <h2 className="text-base font-semibold mb-1">Base URL</h2>
        <div className="flex items-center gap-2 rounded-lg border border-border bg-muted/50 px-3 py-2 font-mono text-sm">
          <span className="text-muted-foreground">https://</span>
          <span>{baseUrl.replace(/^https?:\/\//, "")}/v1</span>
          <div className="ml-auto"><CopyBtn text={`${baseUrl}/v1`} /></div>
        </div>
      </div>

      <div>
        <h2 className="text-base font-semibold mb-3">Supported Formats</h2>
        <div className="flex gap-2">
          {["JSON", "REST", "HTTP/1.1", "HTTP/2"].map((f) => (
            <Badge key={f} text={f} color="gray" />
          ))}
        </div>
      </div>

      <div>
        <h2 className="text-base font-semibold mb-3">Example Request</h2>
        <CodeBlock code={exampleReq} language="bash" />
      </div>

      <div>
        <h2 className="text-base font-semibold mb-3">Example Response</h2>
        <CodeBlock code={exampleRes} language="json" />
      </div>

      <div>
        <h2 className="text-base font-semibold mb-3">Available Endpoints</h2>
        <div className="rounded-lg border border-border overflow-hidden">
          {ENDPOINT_REGISTRY.map((ep, i) => (
            <div key={ep.id} className={cn("flex items-center gap-3 px-4 py-3 text-sm", i > 0 && "border-t border-border")}>
              <span className={cn("rounded px-1.5 py-0.5 text-[10px] font-bold font-mono shrink-0", METHOD_COLOR[ep.method])}>{ep.method}</span>
              <code className="font-mono text-xs text-foreground">/v1{ep.path}</code>
              <span className="text-muted-foreground ml-2 text-xs truncate">{ep.description}</span>
              <Badge text={CATEGORY_LABELS[ep.category]} color="gray" />
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

// ── Section: Authentication ───────────────────────────────────────────────────

function AuthSection({ baseUrl }: { baseUrl: string }) {
  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-2xl font-bold">Authentication</h1>
        <p className="mt-2 text-muted-foreground">
          All API requests require a Bearer token in the Authorization header. Your API key
          is workspace-scoped — it automatically determines which content is returned.
        </p>
      </div>

      <div className="rounded-lg border border-blue-200 bg-blue-50 p-4 text-sm text-blue-800">
        <p className="font-semibold mb-1">🔑 Key Principle</p>
        <p>Workspace IDs and Collection IDs are never required. Your API key resolves everything automatically.</p>
      </div>

      <div>
        <h2 className="text-base font-semibold mb-3">Key Types</h2>
        <div className="grid grid-cols-2 gap-4">
          {[
            {
              prefix: "pk_live_",
              name: "Publishable Key",
              color: "green" as const,
              desc: "Safe to use in frontend applications for read-only public content. Ideal for static sites and client-side apps via a proxy.",
              use: "Public read endpoints (blogs, collections)",
            },
            {
              prefix: "sk_live_",
              name: "Secret Key",
              color: "amber" as const,
              desc: "Higher rate limits and additional capabilities. Never expose in client-side code — use server-side only.",
              use: "Server-side integrations, webhooks, admin operations",
            },
          ].map((k) => (
            <div key={k.prefix} className="rounded-lg border border-border p-4">
              <div className="flex items-center gap-2 mb-2">
                <code className="font-mono text-xs bg-muted px-2 py-0.5 rounded">{k.prefix}...</code>
                <Badge text={k.name} color={k.color} />
              </div>
              <p className="text-sm text-muted-foreground mb-2">{k.desc}</p>
              <p className="text-xs text-muted-foreground"><span className="font-semibold">Use for:</span> {k.use}</p>
            </div>
          ))}
        </div>
      </div>

      <div>
        <h2 className="text-base font-semibold mb-3">Authorization Header</h2>
        {(() => {
          const ep = ENDPOINT_REGISTRY[0];
          return (
            <CodeBlock code={`GET ${baseUrl}/api/v1${ep.path} HTTP/1.1\nAuthorization: Bearer YOUR_API_KEY\nContent-Type: application/json`} />
          );
        })()}
      </div>

      <div>
        <h2 className="text-base font-semibold mb-3">cURL Example</h2>
        {(() => {
          const ep = ENDPOINT_REGISTRY[0];
          return (
            <CodeBlock code={`curl "${baseUrl}/api/v1${ep.path}" \\\n  -H "Authorization: Bearer pk_live_your_key_here"`} language="bash" />
          );
        })()}
      </div>

      <div className="rounded-lg border border-red-200 bg-red-50 p-4 text-sm text-red-800">
        <p className="font-semibold mb-1">⚠ Never expose Secret Keys</p>
        <p>Do not include <code className="font-mono bg-red-100 px-1 rounded">sk_live_</code> keys in client-side code, version control, or public repositories. Use environment variables and server-side code only.</p>
      </div>
    </div>
  );
}

// ── Section: API Keys ─────────────────────────────────────────────────────────

function ApiKeysSection({ workspaceId }: { workspaceId: string }) {
  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-2xl font-bold">API Keys</h1>
        <p className="mt-2 text-muted-foreground">
          Manage your workspace API keys. Keys are workspace-scoped and automatically
          resolve content without requiring workspace or collection IDs in requests.
        </p>
      </div>

      <div className="flex items-center gap-3 rounded-lg border border-border bg-muted/30 p-4">
        <Key className="h-5 w-5 text-primary shrink-0" />
        <div className="flex-1">
          <p className="font-semibold text-sm">Manage API Keys</p>
          <p className="text-xs text-muted-foreground">Create, revoke, and manage keys from the API Keys dashboard.</p>
        </div>
        <a
          href={`/admin/workspaces/${workspaceId}/api-keys`}
          className="flex items-center gap-1.5 rounded-lg bg-primary px-3 py-1.5 text-xs font-semibold text-white hover:bg-primary/90 transition-colors"
        >
          <ExternalLink className="h-3 w-3" />
          Go to API Keys
        </a>
      </div>

      <div>
        <h2 className="text-base font-semibold mb-3">Key Lifecycle</h2>
        <div className="space-y-3">
          {[
            { step: "1", title: "Create", desc: "Generate a key from the API Keys dashboard. Choose Publishable for frontend use or Secret for server-side." },
            { step: "2", title: "Store Securely", desc: "Copy the key immediately — it is shown only once. Store it in environment variables, never in source code." },
            { step: "3", title: "Use", desc: 'Include the key in every request: Authorization: Bearer YOUR_KEY' },
            { step: "4", title: "Revoke", desc: "Revoke compromised or unused keys immediately from the API Keys dashboard. Revoked keys reject all requests instantly." },
          ].map((s) => (
            <div key={s.step} className="flex gap-4 rounded-lg border border-border p-4">
              <div className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-primary/10 text-primary text-sm font-bold">
                {s.step}
              </div>
              <div>
                <p className="font-semibold text-sm">{s.title}</p>
                <p className="text-sm text-muted-foreground mt-0.5">{s.desc}</p>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

// ── Section: First Request ────────────────────────────────────────────────────

function FirstRequestSection({ baseUrl, apiKey }: { baseUrl: string; apiKey: string }) {
  const [lang, setLang] = useState<CodeLanguage>("curl");
  // Use the first list endpoint from the registry (stays in sync with EndpointRegistry)
  const ep = ENDPOINT_REGISTRY.find((e) => e.pagination) ?? ENDPOINT_REGISTRY[0];
  const snippet = generateSnippet(ep, lang, baseUrl, apiKey || "YOUR_API_KEY");

  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-2xl font-bold">Making Your First Request</h1>
        <p className="mt-2 text-muted-foreground">
          Get up and running in under 2 minutes. Fetch your first blog post with the language of your choice.
        </p>
      </div>

      <div>
        <h2 className="text-base font-semibold mb-3">1. Get an API Key</h2>
        <p className="text-sm text-muted-foreground mb-2">Navigate to the API Keys section and create a Publishable key.</p>
        <div className="rounded-lg border border-border bg-muted/30 px-4 py-3 font-mono text-xs">
          pk_live_your_key_here
        </div>
      </div>

      <div>
        <h2 className="text-base font-semibold mb-3">2. Make a Request</h2>
        <div className="mb-3 flex flex-wrap gap-1.5">
          {ALL_LANGUAGES.map((l) => (
            <button
              key={l}
              type="button"
              onClick={() => setLang(l)}
              className={cn(
                "rounded px-2.5 py-1 text-xs font-medium transition-colors",
                l === lang ? "bg-primary text-white" : "border border-border text-muted-foreground hover:text-foreground",
              )}
            >
              {LANGUAGE_LABELS[l]}
            </button>
          ))}
        </div>
        <CodeBlock code={snippet} />
      </div>

      <div>
        <h2 className="text-base font-semibold mb-3">3. Handle the Response</h2>
        <CodeBlock code={JSON.stringify(ep.exampleResponse, null, 2)} language="json" />
      </div>
    </div>
  );
}

// ── Section: Pagination ───────────────────────────────────────────────────────

function PaginationSection({ baseUrl }: { baseUrl: string }) {
  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-2xl font-bold">Pagination</h1>
        <p className="mt-2 text-muted-foreground">
          All list endpoints use offset-based pagination via the{" "}
          <code className="font-mono text-xs bg-muted px-1 rounded">limit</code> and{" "}
          <code className="font-mono text-xs bg-muted px-1 rounded">offset</code> parameters.
        </p>
      </div>

      <div>
        <h2 className="text-base font-semibold mb-3">Parameters</h2>
        <div className="overflow-hidden rounded-lg border border-border">
          <table className="w-full text-sm">
            <thead className="bg-muted/50">
              <tr>
                {["Parameter", "Type", "Default", "Max", "Description"].map((h) => (
                  <th key={h} className="px-4 py-2.5 text-left text-xs font-semibold text-muted-foreground">{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {[
                { p: "limit", t: "integer", d: "20", m: "100", desc: "Number of results to return." },
                { p: "offset", t: "integer", d: "0", m: "—", desc: "Number of results to skip. Use offset = page * limit to simulate page-based pagination." },
              ].map((r, i) => (
                <tr key={r.p} className={cn(i > 0 && "border-t border-border")}>
                  <td className="px-4 py-3"><code className="font-mono text-xs bg-muted px-1 rounded">{r.p}</code></td>
                  <td className="px-4 py-3 text-muted-foreground">{r.t}</td>
                  <td className="px-4 py-3 font-mono text-xs">{r.d}</td>
                  <td className="px-4 py-3 font-mono text-xs">{r.m}</td>
                  <td className="px-4 py-3 text-muted-foreground text-xs">{r.desc}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      <div>
        <h2 className="text-base font-semibold mb-3">Example URLs</h2>
        <div className="space-y-2">
          {[
            { url: `${baseUrl}/api/v1/posts`, desc: "First 20 results (default)" },
            { url: `${baseUrl}/api/v1/posts?limit=10`, desc: "First 10 results" },
            { url: `${baseUrl}/api/v1/posts?limit=10&offset=10`, desc: "Second page of 10 results" },
            { url: `${baseUrl}/api/v1/posts?limit=100`, desc: "Up to 100 results (max)" },
          ].map(({ url, desc }) => (
            <div key={url} className="flex items-center gap-3 rounded-lg border border-border bg-muted/30 px-3 py-2">
              <code className="font-mono text-xs text-foreground flex-1">{url}</code>
              <span className="text-xs text-muted-foreground shrink-0">{desc}</span>
              <CopyBtn text={url} />
            </div>
          ))}
        </div>
      </div>

      <div>
        <h2 className="text-base font-semibold mb-3">Response Meta Object</h2>
        <CodeBlock code={JSON.stringify({ data: ["..."], meta: { total: 45, limit: 10, offset: 10 } }, null, 2)} language="json" />
        <div className="mt-3 overflow-hidden rounded-lg border border-border">
          <table className="w-full text-sm">
            <thead className="bg-muted/50">
              <tr>
                {["Field", "Type", "Description"].map((h) => (
                  <th key={h} className="px-4 py-2.5 text-left text-xs font-semibold text-muted-foreground">{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {[
                { f: "total", t: "integer", d: "Total number of matching results across all pages." },
                { f: "limit", t: "integer", d: "Number of results returned in this response." },
                { f: "offset", t: "integer", d: "Number of results skipped before this page." },
              ].map((r, i) => (
                <tr key={r.f} className={cn(i > 0 && "border-t border-border")}>
                  <td className="px-4 py-3"><code className="font-mono text-xs bg-muted px-1 rounded">{r.f}</code></td>
                  <td className="px-4 py-3 text-muted-foreground">{r.t}</td>
                  <td className="px-4 py-3 text-muted-foreground text-xs">{r.d}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}

// ── Section: Filtering ────────────────────────────────────────────────────────

function FilteringSection({ baseUrl }: { baseUrl: string }) {
  const endpointsWithFilters = ENDPOINT_REGISTRY.filter((e) => e.filters.length > 0);

  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-2xl font-bold">Filtering</h1>
        <p className="mt-2 text-muted-foreground">
          Narrow results using filter query parameters. Only filters supported by each
          endpoint are accepted — unsupported filters are silently ignored.
        </p>
      </div>

      {endpointsWithFilters.map((ep) => (
        <div key={ep.id}>
          <h2 className="text-base font-semibold mb-3">
            <span className={cn("mr-2 rounded px-1.5 py-0.5 text-[10px] font-bold font-mono", METHOD_COLOR[ep.method])}>{ep.method}</span>
            <code className="font-mono text-sm">/v1{ep.path}</code>
          </h2>
          <div className="flex flex-wrap gap-1.5 mb-3">
            {ep.filters.map((f) => (
              <Badge key={f} text={`?${f}=`} color="gray" />
            ))}
          </div>
          <div className="overflow-hidden rounded-lg border border-border">
            <table className="w-full text-sm">
              <thead className="bg-muted/50">
                <tr>
                  {["Filter", "Example", "Description"].map((h) => (
                    <th key={h} className="px-4 py-2.5 text-left text-xs font-semibold text-muted-foreground">{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {ep.queryParams.map((p, i) => (
                  <tr key={p.name} className={cn(i > 0 && "border-t border-border")}>
                    <td className="px-4 py-3"><code className="font-mono text-xs bg-muted px-1 rounded">{p.name}</code></td>
                    <td className="px-4 py-3"><code className="font-mono text-xs text-muted-foreground">?{p.name}={p.example}</code></td>
                    <td className="px-4 py-3 text-muted-foreground text-xs">{p.description}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <div className="mt-3">
            <p className="text-xs text-muted-foreground mb-2">Example URL:</p>
            <div className="flex items-center gap-2 rounded-lg border border-border bg-muted/30 px-3 py-2">
              <code className="font-mono text-xs flex-1">
                {baseUrl}/v1{ep.path}
                {ep.queryParams[0] ? `?${ep.queryParams[0].name}=${ep.queryParams[0].example}` : ""}
              </code>
              <CopyBtn text={`${baseUrl}/v1${ep.path}${ep.queryParams[0] ? `?${ep.queryParams[0].name}=${ep.queryParams[0].example}` : ""}`} />
            </div>
          </div>
        </div>
      ))}
    </div>
  );
}

// ── Section: Search ───────────────────────────────────────────────────────────

function SearchSection({ baseUrl }: { baseUrl: string }) {
  const searchableEndpoints = ENDPOINT_REGISTRY.filter((e) => e.search);
  // Derive example URL from first searchable endpoint in the registry
  const firstSearchEp = searchableEndpoints[0];
  const exampleParam = firstSearchEp ? "search" : "q";
  const examplePath = firstSearchEp ? `/api/v1${firstSearchEp.path}` : "/api/v1/posts";
  const exampleUrl = `${baseUrl}${examplePath}?${exampleParam}=marketing+strategy`;
  // Example response derived from registry
  const exampleRes = firstSearchEp
    ? JSON.stringify(firstSearchEp.exampleResponse, null, 2)
    : JSON.stringify({ data: [{ slug: "marketing-101", title: "Marketing 101", excerpt: "..." }], meta: { total: 1, limit: 20, offset: 0 } }, null, 2);

  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-2xl font-bold">Search</h1>
        <p className="mt-2 text-muted-foreground">
          Use the <code className="font-mono text-xs bg-muted px-1 rounded">search</code> parameter
          for full-text search on list endpoints. Use <code className="font-mono text-xs bg-muted px-1 rounded">q</code> on
          the global <code className="font-mono text-xs bg-muted px-1 rounded">/search</code> endpoint.
        </p>
      </div>

      <div>
        <h2 className="text-base font-semibold mb-3">Example</h2>
        <CodeBlock code={`curl "${exampleUrl}" \\\n  -H "Authorization: Bearer YOUR_API_KEY"`} language="bash" />
      </div>

      <div>
        <h2 className="text-base font-semibold mb-3">Supported Endpoints</h2>
        <div className="space-y-2">
          {searchableEndpoints.map((ep) => (
            <div key={ep.id} className="flex items-center gap-3 rounded-lg border border-border px-4 py-3">
              <span className={cn("rounded px-1.5 py-0.5 text-[10px] font-bold font-mono shrink-0", METHOD_COLOR[ep.method])}>{ep.method}</span>
              <code className="font-mono text-xs">/api/v1{ep.path}</code>
              <span className="text-xs text-muted-foreground">{ep.description}</span>
            </div>
          ))}
        </div>
      </div>

      <div>
        <h2 className="text-base font-semibold mb-3">Expected Response</h2>
        <CodeBlock code={exampleRes} language="json" />
      </div>
    </div>
  );
}

// ── Section: Errors ───────────────────────────────────────────────────────────

function ErrorsSection() {
  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-2xl font-bold">Error Codes</h1>
        <p className="mt-2 text-muted-foreground">
          All errors return JSON with a <code className="font-mono text-xs bg-muted px-1 rounded">success: false</code> flag
          and an <code className="font-mono text-xs bg-muted px-1 rounded">error</code> object containing a code and message.
        </p>
      </div>

      <div>
        <h2 className="text-base font-semibold mb-3">Error Response Format</h2>
        <CodeBlock code={JSON.stringify({ success: false, error: { code: "INVALID_API_KEY", message: "Invalid or missing API key." } }, null, 2)} language="json" />
      </div>

      <div className="space-y-6">
        {ERROR_DOCS.map((e) => (
          <div key={e.code} className="rounded-lg border border-border overflow-hidden">
            <div className={cn("flex items-center gap-3 px-4 py-3", e.code >= 500 ? "bg-red-50 border-b border-red-200" : e.code >= 400 ? "bg-amber-50 border-b border-amber-200" : "bg-muted border-b border-border")}>
              <Badge text={String(e.code)} color={e.code >= 500 ? "red" : e.code >= 400 ? "amber" : "gray"} />
              <span className="font-semibold text-sm">{e.name}</span>
            </div>
            <div className="p-4 space-y-3">
              <p className="text-sm text-muted-foreground">{e.description}</p>
              <div>
                <p className="text-xs font-semibold text-muted-foreground mb-1.5">Example Response</p>
                <CodeBlock code={JSON.stringify(e.example, null, 2)} language="json" />
              </div>
              <div className="rounded-lg bg-muted/50 px-3 py-2 text-xs text-muted-foreground">
                <span className="font-semibold text-foreground">Resolution: </span>{e.resolution}
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

// ── Section: Rate Limits ──────────────────────────────────────────────────────

function RateLimitsSection() {
  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-2xl font-bold">Rate Limits</h1>
        <p className="mt-2 text-muted-foreground">
          Rate limits are applied per API key. When exceeded, the API returns a
          <code className="font-mono text-xs bg-muted px-1 mx-1 rounded">429 Too Many Requests</code>
          response with a <code className="font-mono text-xs bg-muted px-1 rounded">Retry-After</code> header.
        </p>
      </div>

      <div>
        <h2 className="text-base font-semibold mb-3">Limits by Key Type</h2>
        <div className="overflow-hidden rounded-lg border border-border">
          <table className="w-full text-sm">
            <thead className="bg-muted/50">
              <tr>
                {["Key Type", "Requests / Minute", "Requests / Day"].map((h) => (
                  <th key={h} className="px-4 py-2.5 text-left text-xs font-semibold text-muted-foreground">{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {RATE_LIMIT_TIERS.map((t, i) => (
                <tr key={t.keyType} className={cn(i > 0 && "border-t border-border")}>
                  <td className="px-4 py-3"><code className="font-mono text-xs bg-muted px-1 rounded">{t.keyType}</code></td>
                  <td className="px-4 py-3">{t.requestsPerMinute.toLocaleString()}</td>
                  <td className="px-4 py-3">{t.requestsPerDay.toLocaleString()}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      <div>
        <h2 className="text-base font-semibold mb-3">Response Headers</h2>
        <CodeBlock code={`HTTP/1.1 429 Too Many Requests\nRetry-After: 60\nX-RateLimit-Limit: 60\nX-RateLimit-Remaining: 0\nX-RateLimit-Reset: 1700000060`} />
      </div>

      <div>
        <h2 className="text-base font-semibold mb-3">Recommended: Exponential Backoff</h2>
        <CodeBlock code={`async function fetchWithRetry(url, options, retries = 3) {
  for (let attempt = 0; attempt < retries; attempt++) {
    const res = await fetch(url, options);
    if (res.status !== 429) return res;

    const retryAfter = parseInt(res.headers.get("Retry-After") ?? "2");
    const wait = Math.min(retryAfter * 1000, (2 ** attempt) * 1000);
    await new Promise(resolve => setTimeout(resolve, wait));
  }
  throw new Error("Rate limit retries exhausted");
}`} language="javascript" />
      </div>

      <div className="rounded-lg border border-blue-200 bg-blue-50 p-4 text-sm text-blue-800">
        <p className="font-semibold mb-1">💡 Tip</p>
        <p>Use ISR (Incremental Static Regeneration) or a caching layer (e.g. TanStack Query, SWR) to significantly reduce API call volume and avoid rate limits.</p>
      </div>
    </div>
  );
}

// ── Section: Versioning ───────────────────────────────────────────────────────

function VersioningSection({ baseUrl }: { baseUrl: string }) {
  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-2xl font-bold">Versioning</h1>
        <p className="mt-2 text-muted-foreground">
          The API version is specified in the URL path. Currently, v1 is the stable version.
        </p>
      </div>

      <div>
        <h2 className="text-base font-semibold mb-3">Version Status</h2>
        <div className="overflow-hidden rounded-lg border border-border">
          <table className="w-full text-sm">
            <thead className="bg-muted/50">
              <tr>
                {["Version", "Status", "Base URL"].map((h) => (
                  <th key={h} className="px-4 py-2.5 text-left text-xs font-semibold text-muted-foreground">{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {[
                { v: "v1", status: "Stable", color: "green" as const, url: `${baseUrl}/v1` },
              ].map((r, i) => (
                <tr key={r.v} className={cn(i > 0 && "border-t border-border")}>
                  <td className="px-4 py-3"><code className="font-mono text-xs bg-muted px-1 rounded">{r.v}</code></td>
                  <td className="px-4 py-3"><Badge text={r.status} color={r.color} /></td>
                  <td className="px-4 py-3"><code className="font-mono text-xs text-muted-foreground">{r.url}</code></td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      <div className="rounded-lg border border-border bg-muted/30 p-4 text-sm">
        <p className="font-semibold mb-1">Deprecation Policy</p>
        <p className="text-muted-foreground">Deprecated versions receive 12 months notice before removal. Breaking changes always bump the major version.</p>
      </div>
    </div>
  );
}

// ── Section: Code Examples ────────────────────────────────────────────────────

function CodeExamplesSection({ baseUrl, apiKey }: { baseUrl: string; apiKey: string }) {
  const [lang, setLang] = useState<CodeLanguage>("curl");
  const [epId, setEpId] = useState(ENDPOINT_REGISTRY[0].id);
  const ep = ENDPOINT_REGISTRY.find((e) => e.id === epId) ?? ENDPOINT_REGISTRY[0];
  const snippet = generateSnippet(ep, lang, baseUrl, apiKey || "YOUR_API_KEY");

  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-2xl font-bold">Code Examples</h1>
        <p className="mt-2 text-muted-foreground">
          Ready-to-use code snippets for every endpoint in {ALL_LANGUAGES.length} languages.
        </p>
      </div>

      <div className="flex flex-wrap gap-2">
        <div>
          <p className="text-xs font-semibold text-muted-foreground mb-1.5">Endpoint</p>
          <select
            value={epId}
            onChange={(e) => setEpId(e.target.value)}
            className="rounded-lg border border-border bg-background px-3 py-1.5 text-sm text-foreground focus:outline-none focus:ring-1 focus:ring-primary"
          >
            {ENDPOINT_REGISTRY.map((e) => (
              <option key={e.id} value={e.id}>{e.method} /v1{e.path}</option>
            ))}
          </select>
        </div>
      </div>

      <div>
        <p className="text-xs font-semibold text-muted-foreground mb-2">Language</p>
        <div className="flex flex-wrap gap-1.5 mb-4">
          {ALL_LANGUAGES.map((l) => (
            <button
              key={l}
              type="button"
              onClick={() => setLang(l)}
              className={cn(
                "rounded px-2.5 py-1 text-xs font-medium transition-colors",
                l === lang ? "bg-primary text-white" : "border border-border text-muted-foreground hover:text-foreground",
              )}
            >
              {LANGUAGE_LABELS[l]}
            </button>
          ))}
        </div>
        <CodeBlock code={snippet} />
      </div>
    </div>
  );
}

// ── Section: Framework Guides ─────────────────────────────────────────────────

function FrameworksSection() {
  const [activeId, setActiveId] = useState(FRAMEWORK_GUIDES[0].id);
  const guide = FRAMEWORK_GUIDES.find((g) => g.id === activeId) ?? FRAMEWORK_GUIDES[0];

  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-2xl font-bold">Framework Guides</h1>
        <p className="mt-2 text-muted-foreground">
          Integration examples for popular frameworks. Each guide shows environment setup and a complete fetch example.
        </p>
      </div>

      <div className="flex flex-wrap gap-2">
        {FRAMEWORK_GUIDES.map((g) => (
          <button
            key={g.id}
            type="button"
            onClick={() => setActiveId(g.id)}
            className={cn(
              "flex items-center gap-2 rounded-lg border px-3 py-2 text-sm font-medium transition-colors",
              g.id === activeId ? "border-primary bg-primary/10 text-primary" : "border-border text-muted-foreground hover:text-foreground",
            )}
          >
            <span>{g.icon}</span>
            {g.name}
          </button>
        ))}
      </div>

      <div className="space-y-4">
        <div>
          <h3 className="text-sm font-semibold mb-2">Environment Variables</h3>
          <CodeBlock code={guide.envSetup} language="bash" />
        </div>
        <div>
          <h3 className="text-sm font-semibold mb-2">Fetch Example</h3>
          <CodeBlock code={guide.fetchExample} language="typescript" />
        </div>
        <div className="rounded-lg border border-blue-200 bg-blue-50 px-4 py-3 text-sm text-blue-800">
          <span className="font-semibold">Note: </span>{guide.notes}
        </div>
      </div>
    </div>
  );
}

// ── Section: AI Prompts ───────────────────────────────────────────────────────

function AiPromptsSection({ baseUrl, workspaceId }: { baseUrl: string; workspaceId: string }) {
  const [activeEpId, setActiveEpId] = useState(ENDPOINT_REGISTRY[0].id);
  const [generatedPrompt, setGeneratedPrompt] = useState<string | null>(null);
  const [selectedPlatform, setSelectedPlatform] = useState("cursor");

  const ep = ENDPOINT_REGISTRY.find((e) => e.id === activeEpId) ?? ENDPOINT_REGISTRY[0];

  // Map EndpointRegistry category → PromptGeneratorService contentTypeId
  const CATEGORY_TO_CONTENT_TYPE: Record<string, string> = {
    posts: "blogs",
    collections: "collections",
    media: "media",
  };

  function handleGenerate(platformId: string) {
    setSelectedPlatform(platformId);
    const contentTypeId = CATEGORY_TO_CONTENT_TYPE[ep.category] ?? "everything";
    const output = generatePrompt({
      frameworkId: "nextjs",
      aiPlatformId: platformId,
      contentTypeIds: [contentTypeId],
      renderStrategyId: "ssr",
      stylingId: "tailwind",
      apiBaseUrl: baseUrl,
      apiKeyPlaceholder: "pk_live_your_key_here",
    });
    setGeneratedPrompt(output.prompt);
    toast.success(`${AI_PLATFORMS.find((p) => p.id === platformId)?.label} prompt generated`);
  }

  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-2xl font-bold">AI Prompts</h1>
        <p className="mt-2 text-muted-foreground">
          Generate implementation prompts for AI coding assistants. Prompts are pre-filled
          with your API details, endpoint reference, and best practices.
        </p>
      </div>

      <div>
        <p className="text-xs font-semibold text-muted-foreground mb-2">Endpoint context</p>
        <select
          value={activeEpId}
          onChange={(e) => { setActiveEpId(e.target.value); setGeneratedPrompt(null); }}
          className="rounded-lg border border-border bg-background px-3 py-1.5 text-sm focus:outline-none focus:ring-1 focus:ring-primary"
        >
          {ENDPOINT_REGISTRY.map((e) => (
            <option key={e.id} value={e.id}>{e.method} /v1{e.path} — {e.title}</option>
          ))}
        </select>
      </div>

      <div>
        <p className="text-xs font-semibold text-muted-foreground mb-3">Generate for</p>
        <div className="flex flex-wrap gap-2">
          {AI_PLATFORMS.slice(0, 4).map((p) => (
            <button
              key={p.id}
              type="button"
              onClick={() => handleGenerate(p.id)}
              className={cn(
                "flex items-center gap-2 rounded-lg border px-3 py-2 text-sm font-medium transition-colors",
                selectedPlatform === p.id && generatedPrompt
                  ? "border-primary bg-primary/10 text-primary"
                  : "border-border text-muted-foreground hover:text-foreground hover:border-border",
              )}
            >
              <Sparkles className="h-3.5 w-3.5" />
              Generate {p.label} Prompt
            </button>
          ))}
        </div>
      </div>

      {generatedPrompt && (
        <div>
          <div className="mb-2 flex items-center justify-between">
            <h2 className="text-base font-semibold">
              Generated {AI_PLATFORMS.find((p) => p.id === selectedPlatform)?.label} Prompt
            </h2>
            <div className="flex gap-2">
              <CopyBtn text={generatedPrompt} label="Copy prompt" />
            </div>
          </div>
          <div className="overflow-hidden rounded-lg border border-border">
            <pre className="max-h-96 overflow-y-auto p-4 text-xs font-mono text-foreground whitespace-pre-wrap leading-relaxed bg-muted/20">
              {generatedPrompt}
            </pre>
          </div>
          <p className="mt-2 text-xs text-muted-foreground">
            For more options, visit the{" "}
            <a href={`/admin/workspaces/${workspaceId}/integration-center`} className="text-primary hover:underline">
              Integration Center
            </a>
            .
          </p>
        </div>
      )}
    </div>
  );
}

// ── Section: Endpoints (list) ─────────────────────────────────────────────────

function EndpointsListSection({ onSelectEndpoint }: { onSelectEndpoint: (id: string) => void }) {
  const grouped: Record<string, EndpointDefinition[]> = {};
  for (const ep of ENDPOINT_REGISTRY) {
    const label = CATEGORY_LABELS[ep.category];
    grouped[label] = [...(grouped[label] ?? []), ep];
  }

  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-2xl font-bold">REST Endpoints</h1>
        <p className="mt-2 text-muted-foreground">
          {ENDPOINT_REGISTRY.length} endpoints across {Object.keys(grouped).length} categories.
          All endpoints require Bearer token authentication.
        </p>
      </div>

      {Object.entries(grouped).map(([cat, eps]) => (
        <div key={cat}>
          <h2 className="text-base font-semibold mb-3">{cat}</h2>
          <div className="overflow-hidden rounded-lg border border-border">
            {eps.map((ep, i) => (
              <button
                key={ep.id}
                type="button"
                onClick={() => onSelectEndpoint(ep.id)}
                className={cn(
                  "flex w-full items-center gap-3 px-4 py-3.5 text-left hover:bg-muted/50 transition-colors",
                  i > 0 && "border-t border-border",
                )}
              >
                <span className={cn("rounded px-1.5 py-0.5 text-[10px] font-bold font-mono shrink-0", METHOD_COLOR[ep.method])}>{ep.method}</span>
                <code className="font-mono text-xs text-foreground shrink-0">/v1{ep.path}</code>
                <span className="text-sm text-muted-foreground flex-1 truncate">{ep.description}</span>
                {ep.authentication && <Badge text="Auth" color="gray" />}
                {ep.pagination && <Badge text="Paginated" color="gray" />}
                <ChevronRight className="h-4 w-4 text-muted-foreground shrink-0" />
              </button>
            ))}
          </div>
        </div>
      ))}
    </div>
  );
}

// ── Section: Endpoint Detail ──────────────────────────────────────────────────

function EndpointDetailSection({
  endpointId,
  baseUrl,
  apiKey,
  isFav,
  onToggleFav,
  workspaceId,
}: {
  endpointId: string;
  baseUrl: string;
  apiKey: string;
  isFav: boolean;
  onToggleFav: (id: string) => void;
  workspaceId: string;
}) {
  const ep = ENDPOINT_REGISTRY.find((e) => e.id === endpointId);
  const [lang, setLang] = useState<CodeLanguage>("curl");
  const [activeTab, setActiveTab] = useState<"params" | "response" | "errors">("params");

  if (!ep) return <div className="p-8 text-muted-foreground">Endpoint not found.</div>;

  const params = buildParamList(ep);
  const snippet = generateSnippet(ep, lang, baseUrl, apiKey || "YOUR_API_KEY");
  const responseJson = JSON.stringify(ep.exampleResponse, null, 2);

  return (
    <div className="space-y-8">
      {/* Header */}
      <div>
        <div className="flex items-start justify-between gap-3">
          <div>
            <div className="flex items-center gap-2 mb-2">
              <span className={cn("rounded px-2 py-0.5 text-xs font-bold font-mono", METHOD_COLOR[ep.method])}>{ep.method}</span>
              <code className="font-mono text-base font-semibold">/v1{ep.path}</code>
            </div>
            <h1 className="text-xl font-bold">{ep.title}</h1>
            <p className="mt-1 text-muted-foreground text-sm">{ep.longDescription ?? ep.description}</p>
          </div>
          <button
            type="button"
            onClick={() => onToggleFav(ep.id)}
            className="shrink-0 flex items-center gap-1.5 rounded-lg border border-border px-2.5 py-1.5 text-xs text-muted-foreground hover:text-foreground transition-colors"
          >
            {isFav ? <Star className="h-3.5 w-3.5 text-amber-500 fill-amber-500" /> : <StarOff className="h-3.5 w-3.5" />}
            {isFav ? "Saved" : "Save"}
          </button>
        </div>

        {/* Badges */}
        <div className="mt-3 flex flex-wrap gap-1.5">
          {ep.authentication && <Badge text="Requires Auth" color="gray" />}
          {ep.pagination && <Badge text="Paginated" color="blue" />}
          {ep.search && <Badge text="Searchable" color="green" />}
          <Badge text={`v${ep.addedInVersion.replace("v", "")}`} color="gray" />
        </div>
      </div>

      {/* Code Snippet */}
      <div>
        <div className="mb-3 flex items-center justify-between">
          <h2 className="text-sm font-semibold">Code Example</h2>
          <div className="flex flex-wrap gap-1">
            {ALL_LANGUAGES.map((l) => (
              <button
                key={l}
                type="button"
                onClick={() => setLang(l)}
                className={cn(
                  "rounded px-2 py-0.5 text-xs font-medium transition-colors",
                  l === lang ? "bg-primary text-white" : "border border-border text-muted-foreground hover:text-foreground",
                )}
              >
                {LANGUAGE_LABELS[l]}
              </button>
            ))}
          </div>
        </div>
        <CodeBlock code={snippet} />
      </div>

      {/* Tabs */}
      <div>
        <div className="flex gap-1 border-b border-border mb-4">
          {([
            { id: "params",   label: `Parameters (${params.length})` },
            { id: "response", label: "Response" },
            { id: "errors",   label: `Errors (${ep.possibleErrors.length})` },
          ] as const).map((t) => (
            <button
              key={t.id}
              type="button"
              onClick={() => setActiveTab(t.id)}
              className={cn(
                "px-3 py-2 text-sm font-medium transition-colors border-b-2 -mb-px",
                activeTab === t.id ? "border-primary text-primary" : "border-transparent text-muted-foreground hover:text-foreground",
              )}
            >
              {t.label}
            </button>
          ))}
        </div>

        {activeTab === "params" && (
          params.length === 0 ? (
            <p className="text-sm text-muted-foreground">No parameters.</p>
          ) : (
            <div className="overflow-hidden rounded-lg border border-border">
              <table className="w-full text-sm">
                <thead className="bg-muted/50">
                  <tr>
                    {["Name", "In", "Type", "Required", "Default", "Description"].map((h) => (
                      <th key={h} className="px-4 py-2.5 text-left text-xs font-semibold text-muted-foreground">{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {params.map((p, i) => (
                    <tr key={`${p.name}-${i}`} className={cn(i > 0 && "border-t border-border")}>
                      <td className="px-4 py-3"><code className="font-mono text-xs bg-muted px-1 rounded">{p.name}</code></td>
                      <td className="px-4 py-3"><Badge text={p.source === "path" ? "path" : "query"} color="gray" /></td>
                      <td className="px-4 py-3 text-muted-foreground text-xs">{formatParamType(p)}</td>
                      <td className="px-4 py-3">
                        {p.required
                          ? <Badge text="required" color="red" />
                          : <Badge text="optional" color="gray" />}
                      </td>
                      <td className="px-4 py-3 font-mono text-xs text-muted-foreground">{p.default ?? "—"}</td>
                      <td className="px-4 py-3 text-xs text-muted-foreground">{p.description}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )
        )}

        {activeTab === "response" && (
          <div className="space-y-4">
            <CodeBlock code={responseJson} language="json" />
            {ep.responseFields && ep.responseFields.length > 0 && (
              <div className="overflow-hidden rounded-lg border border-border">
                <table className="w-full text-sm">
                  <thead className="bg-muted/50">
                    <tr>
                      {["Field", "Type", "Nullable", "Description"].map((h) => (
                        <th key={h} className="px-4 py-2.5 text-left text-xs font-semibold text-muted-foreground">{h}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {ep.responseFields.map((f, i) => (
                      <tr key={f.name} className={cn(i > 0 && "border-t border-border")}>
                        <td className="px-4 py-3"><code className="font-mono text-xs bg-muted px-1 rounded">{f.name}</code></td>
                        <td className="px-4 py-3 text-muted-foreground text-xs">{f.type}</td>
                        <td className="px-4 py-3">{f.nullable ? <Badge text="nullable" color="amber" /> : <span className="text-xs text-muted-foreground">—</span>}</td>
                        <td className="px-4 py-3 text-xs text-muted-foreground">{f.description}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        )}

        {activeTab === "errors" && (
          <div className="space-y-3">
            {ep.possibleErrors.map((code) => {
              const doc = ERROR_DOCS.find((e) => e.code === code);
              if (!doc) return null;
              return (
                <div key={code} className="flex items-start gap-3 rounded-lg border border-border p-3">
                  <Badge text={String(code)} color={code >= 500 ? "red" : "amber"} />
                  <div>
                    <p className="text-sm font-medium">{doc.name}</p>
                    <p className="text-xs text-muted-foreground mt-0.5">{doc.resolution}</p>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* AI Prompt for this endpoint */}
      <div className="rounded-lg border border-border p-4">
        <div className="flex items-center gap-2 mb-3">
          <Sparkles className="h-4 w-4 text-primary" />
          <h2 className="text-sm font-semibold">Generate AI Prompt</h2>
        </div>
        <p className="text-xs text-muted-foreground mb-3">
          Create an AI implementation prompt tailored to this endpoint using the Integration Center.
        </p>
        <a
          href={`/admin/workspaces/${workspaceId}/integration-center`}
          className="inline-flex items-center gap-1.5 rounded-lg bg-primary px-3 py-1.5 text-xs font-semibold text-white hover:bg-primary/90 transition-colors"
        >
          <ExternalLink className="h-3 w-3" />
          Open Integration Center
        </a>
      </div>
    </div>
  );
}

// ── Section: Changelog ────────────────────────────────────────────────────────

function ChangelogSection() {
  const CHANGE_COLOR = {
    added:      "text-emerald-700 bg-emerald-50 border-emerald-200",
    updated:    "text-blue-700 bg-blue-50 border-blue-200",
    deprecated: "text-amber-700 bg-amber-50 border-amber-200",
    breaking:   "text-red-700 bg-red-50 border-red-200",
  };

  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-2xl font-bold">Changelog</h1>
        <p className="mt-2 text-muted-foreground">API changes by version, newest first.</p>
      </div>

      <div className="space-y-6">
        {[...CHANGELOG].reverse().map((entry) => (
          <div key={entry.version} className="relative pl-5">
            <div className="absolute left-0 top-2 h-full w-0.5 bg-border" />
            <div className="absolute left-[-3px] top-2 h-2 w-2 rounded-full bg-primary" />
            <div className="mb-2 flex items-center gap-3">
              <span className="font-semibold text-sm">Version {entry.version}</span>
              <Badge text={entry.date} color="gray" />
            </div>
            <div className="space-y-2">
              {entry.changes.map((c, i) => (
                <div key={i} className="flex items-start gap-2">
                  <span className={cn("mt-0.5 inline-flex rounded border px-1.5 py-0.5 text-[9px] font-bold uppercase shrink-0", CHANGE_COLOR[c.type])}>
                    {c.type}
                  </span>
                  <p className="text-sm text-muted-foreground">{c.description}</p>
                </div>
              ))}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

// ── Main Component ────────────────────────────────────────────────────────────

function DeveloperDocs() {
  const { id } = Route.useParams();
  const { section, endpointId } = Route.useSearch();
  const navigate = useNavigate({ from: Route.fullPath });

  const [apiKey, setApiKey] = useState("");
  const [searchQuery, setSearchQuery] = useState("");
  const [searchResults, setSearchResults] = useState<SearchResult[]>([]);
  const [showSearch, setShowSearch] = useState(false);

  const { favs, toggle: toggleFav } = useFavorites(id);
  const { recent, push: pushRecent } = useRecentlyViewed(id);

  const baseUrl = typeof window !== "undefined"
    ? window.location.origin
    : "https://your-domain.com";

  const goTo = useCallback((s: string, epId?: string) => {
    navigate({ search: { section: s, endpointId: epId } });
    if (epId) pushRecent(epId);
  }, [navigate, pushRecent]);

  // Search
  useEffect(() => {
    if (!searchQuery.trim()) { setSearchResults([]); return; }
    setSearchResults(searchDocs(searchQuery, 8));
  }, [searchQuery]);

  const recentEps = useMemo(() =>
    recent.map((id) => ENDPOINT_REGISTRY.find((e) => e.id === id)).filter(Boolean) as EndpointDefinition[],
    [recent],
  );

  const favEps = useMemo(() =>
    favs.map((id) => ENDPOINT_REGISTRY.find((e) => e.id === id)).filter(Boolean) as EndpointDefinition[],
    [favs],
  );

  // Render active section
  function renderContent() {
    if (endpointId) {
      return (
        <EndpointDetailSection
          endpointId={endpointId}
          baseUrl={baseUrl}
          apiKey={apiKey}
          isFav={favs.includes(endpointId)}
          onToggleFav={toggleFav}
          workspaceId={id}
        />
      );
    }

    switch (section) {
      case "overview":       return <OverviewSection baseUrl={baseUrl} />;
      case "authentication": return <AuthSection baseUrl={baseUrl} />;
      case "api-keys":       return <ApiKeysSection workspaceId={id} />;
      case "first-request":  return <FirstRequestSection baseUrl={baseUrl} apiKey={apiKey} />;
      case "pagination":     return <PaginationSection baseUrl={baseUrl} />;
      case "filtering":      return <FilteringSection baseUrl={baseUrl} />;
      case "search":         return <SearchSection baseUrl={baseUrl} />;
      case "errors":         return <ErrorsSection />;
      case "rate-limits":    return <RateLimitsSection />;
      case "versioning":     return <VersioningSection baseUrl={baseUrl} />;
      case "code-examples":  return <CodeExamplesSection baseUrl={baseUrl} apiKey={apiKey} />;
      case "frameworks":     return <FrameworksSection />;
      case "ai-prompts":     return <AiPromptsSection baseUrl={baseUrl} workspaceId={id} />;
      case "endpoints":      return <EndpointsListSection onSelectEndpoint={(epId) => goTo("endpoints", epId)} />;
      case "changelog":      return <ChangelogSection />;
      default:               return <OverviewSection baseUrl={baseUrl} />;
    }
  }

  return (
    <div className="flex h-full overflow-hidden">
      {/* Doc sidebar */}
      <DocSidebar section={section ?? "overview"} endpointId={endpointId} onNavigate={goTo} />

      {/* Main */}
      <div className="flex flex-1 flex-col overflow-hidden">
        {/* Top bar */}
        <div className="flex shrink-0 items-center gap-3 border-b border-border bg-white px-6 py-3">
          <div className="relative flex-1 max-w-sm">
            <Search className="absolute left-2.5 top-2 h-4 w-4 text-muted-foreground" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => { setSearchQuery(e.target.value); setShowSearch(true); }}
              onFocus={() => setShowSearch(true)}
              onBlur={() => setTimeout(() => setShowSearch(false), 200)}
              placeholder="Search documentation..."
              className="w-full rounded-lg border border-border bg-muted/50 py-1.5 pl-8 pr-3 text-sm focus:outline-none focus:ring-1 focus:ring-primary"
            />
            {showSearch && searchResults.length > 0 && (
              <div className="absolute top-full left-0 z-50 mt-1 w-80 rounded-lg border border-border bg-white shadow-lg">
                {searchResults.map((r) => (
                  <button
                    key={r.id}
                    type="button"
                    onMouseDown={() => { goTo(r.section, r.endpointId); setSearchQuery(""); }}
                    className="flex w-full flex-col gap-0.5 px-3 py-2.5 text-left hover:bg-muted transition-colors border-b border-border last:border-0"
                  >
                    <span className="text-sm font-medium text-foreground">{r.title}</span>
                    <span className="text-xs text-muted-foreground truncate">{r.description}</span>
                  </button>
                ))}
              </div>
            )}
          </div>

          {/* API key input */}
          <input
            type="text"
            value={apiKey}
            onChange={(e) => setApiKey(e.target.value)}
            placeholder="Paste API key to pre-fill examples"
            className="w-64 rounded-lg border border-border bg-muted/50 px-3 py-1.5 font-mono text-xs focus:outline-none focus:ring-1 focus:ring-primary"
          />
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto">
          <div className="mx-auto max-w-3xl px-8 py-8">
            {/* Overview homepage extras */}
            {section === "overview" && !endpointId && (
              <div className="mb-8 space-y-6">
                {recentEps.length > 0 && (
                  <div>
                    <div className="mb-2 flex items-center gap-2 text-xs font-semibold text-muted-foreground">
                      <Eye className="h-3.5 w-3.5" /> Recently Viewed
                    </div>
                    <div className="flex flex-wrap gap-2">
                      {recentEps.map((ep) => (
                        <button
                          key={ep.id}
                          type="button"
                          onClick={() => goTo("endpoints", ep.id)}
                          className="flex items-center gap-1.5 rounded-lg border border-border bg-white px-2.5 py-1.5 text-xs hover:bg-muted transition-colors"
                        >
                          <span className={cn("rounded px-1 py-0.5 text-[9px] font-bold font-mono", METHOD_COLOR[ep.method])}>{ep.method}</span>
                          <code className="font-mono">/v1{ep.path}</code>
                        </button>
                      ))}
                    </div>
                  </div>
                )}
                {favEps.length > 0 && (
                  <div>
                    <div className="mb-2 flex items-center gap-2 text-xs font-semibold text-muted-foreground">
                      <Star className="h-3.5 w-3.5 text-amber-500" /> Favorites
                    </div>
                    <div className="flex flex-wrap gap-2">
                      {favEps.map((ep) => (
                        <button
                          key={ep.id}
                          type="button"
                          onClick={() => goTo("endpoints", ep.id)}
                          className="flex items-center gap-1.5 rounded-lg border border-border bg-white px-2.5 py-1.5 text-xs hover:bg-muted transition-colors"
                        >
                          <span className={cn("rounded px-1 py-0.5 text-[9px] font-bold font-mono", METHOD_COLOR[ep.method])}>{ep.method}</span>
                          <code className="font-mono">/v1{ep.path}</code>
                        </button>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            )}

            {renderContent()}
          </div>
        </div>
      </div>
    </div>
  );
}
