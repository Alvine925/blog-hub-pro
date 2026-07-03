import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useState, useMemo, useEffect, useCallback, useRef } from "react";
import { z } from "zod";
import SyntaxHighlighter from "react-syntax-highlighter";
import { atomOneDark } from "react-syntax-highlighter/dist/esm/styles/hljs";
import {
  Copy, Check, Search, BookOpen, Key, Zap, Code2, AlertTriangle,
  Clock, Layers, Star, StarOff, Eye, ChevronRight, ExternalLink,
  Activity, Globe, Shield, Sparkles, FileText, Database, Hash,
  ChevronDown, ChevronUp, Play, Loader2, ArrowLeft, X,
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

export const Route = createFileRoute("/admin/docs")({
  head: () => ({ meta: [{ title: "Developer Docs — Lunar CMS" }] }),
  validateSearch: searchSchema,
  component: DevDocsPortal,
});

// ── Real API base URLs ────────────────────────────────────────────────────────

const SUPABASE_PROJECT_ID = "pzhsjhprnqfhixjkekxr";
const PROD_API_URL = `https://${SUPABASE_PROJECT_ID}.supabase.co/functions/v1/content-router`;

// ── Method badge colors ───────────────────────────────────────────────────────

const METHOD_COLOR: Record<string, string> = {
  GET:    "text-emerald-700 bg-emerald-50 border border-emerald-200",
  POST:   "text-blue-700 bg-blue-50 border border-blue-200",
  PUT:    "text-amber-700 bg-amber-50 border border-amber-200",
  PATCH:  "text-orange-700 bg-orange-50 border border-orange-200",
  DELETE: "text-red-700 bg-red-50 border border-red-200",
};

const SECTION_ICONS: Record<string, React.ComponentType<{ className?: string }>> = {
  overview:        BookOpen,
  authentication:  Shield,
  "api-keys":      Key,
  "first-request": Zap,
  pagination:      Hash,
  filtering:       Layers,
  search:          Search,
  errors:          AlertTriangle,
  "rate-limits":   Activity,
  versioning:      Globe,
  "code-examples": Code2,
  frameworks:      FileText,
  "ai-prompts":    Sparkles,
  endpoints:       Database,
  changelog:       Clock,
};

// ── Section headings for right-side TOC ──────────────────────────────────────

const SECTION_TOC: Record<string, string[]> = {
  overview:        ["Overview", "Base URL", "Production URL", "Example Request", "All Endpoints"],
  authentication:  ["Authentication", "Key Types", "Auth Header", "cURL Example"],
  "api-keys":      ["API Keys", "Key Lifecycle"],
  "first-request": ["First Request", "1. Get a Key", "2. Make a Request", "3. Handle Response"],
  pagination:      ["Pagination", "Parameters", "Example URLs", "Response Meta"],
  filtering:       ["Filtering"],
  search:          ["Search", "Example", "Supported Endpoints"],
  errors:          ["Error Codes", "Error Format"],
  "rate-limits":   ["Rate Limits", "Limits by Key Type", "Response Headers", "Retry Strategy"],
  versioning:      ["Versioning", "Version Status", "Deprecation Policy"],
  "code-examples": ["Code Examples"],
  frameworks:      ["Framework Guides"],
  "ai-prompts":    ["AI Prompts"],
  endpoints:       ["REST Endpoints"],
  changelog:       ["Changelog"],
};

// ── Language mapping for syntax highlighter ───────────────────────────────────

const SH_LANG: Record<string, string> = {
  bash: "bash", shell: "bash", curl: "bash",
  json: "json",
  javascript: "javascript", js: "javascript",
  typescript: "typescript", ts: "typescript",
  python: "python",
  php: "php",
  go: "go",
  csharp: "csharp", cs: "csharp",
};

// ── CopyBtn ───────────────────────────────────────────────────────────────────

function CopyBtn({ text, label = "Copy" }: { text: string; label?: string }) {
  const [copied, setCopied] = useState(false);
  return (
    <button
      type="button"
      onClick={() => {
        navigator.clipboard.writeText(text);
        setCopied(true);
        toast.success("Copied");
        setTimeout(() => setCopied(false), 2000);
      }}
      className="flex items-center gap-1 text-xs text-zinc-400 hover:text-white transition-colors"
    >
      {copied ? <Check className="h-3 w-3 text-emerald-400" /> : <Copy className="h-3 w-3" />}
      {copied ? "Copied" : label}
    </button>
  );
}

// ── CodeBlock with syntax highlighting ───────────────────────────────────────

function CodeBlock({ code, language = "" }: { code: string; language?: string }) {
  const shLang = SH_LANG[language.toLowerCase()] ?? "plaintext";
  const displayLang = language || "code";

  return (
    <div className="rounded-lg overflow-hidden border border-zinc-800 text-sm">
      {/* Header bar */}
      <div className="flex items-center justify-between px-4 py-2 bg-zinc-900 border-b border-zinc-800">
        <span className="text-xs font-mono text-zinc-400">{displayLang}</span>
        <CopyBtn text={code} />
      </div>
      {/* Code */}
      <SyntaxHighlighter
        language={shLang}
        style={atomOneDark}
        customStyle={{
          margin: 0,
          borderRadius: 0,
          background: "#18181b",
          padding: "1rem",
          fontSize: "0.75rem",
          lineHeight: "1.6",
        }}
        wrapLongLines={false}
      >
        {code}
      </SyntaxHighlighter>
    </div>
  );
}

// ── Badge ─────────────────────────────────────────────────────────────────────

function Badge({ text, color = "gray" }: { text: string; color?: "gray" | "green" | "blue" | "amber" | "red" }) {
  const colors = {
    gray:  "bg-zinc-100 text-zinc-600",
    green: "bg-emerald-50 text-emerald-700 border border-emerald-200",
    blue:  "bg-blue-50 text-blue-700 border border-blue-200",
    amber: "bg-amber-50 text-amber-700 border border-amber-200",
    red:   "bg-red-50 text-red-700 border border-red-200",
  };
  return (
    <span className={cn("inline-flex items-center rounded px-1.5 py-0.5 text-[10px] font-semibold font-mono", colors[color])}>
      {text}
    </span>
  );
}

// ── Callout box ───────────────────────────────────────────────────────────────

function Callout({ type, title, children }: { type: "info" | "warning" | "danger"; title: string; children: React.ReactNode }) {
  const styles = {
    info:    "border-blue-200 bg-blue-50 text-blue-900",
    warning: "border-amber-200 bg-amber-50 text-amber-900",
    danger:  "border-red-200 bg-red-50 text-red-900",
  };
  return (
    <div className={cn("rounded-lg border px-4 py-3 text-sm", styles[type])}>
      <p className="font-semibold mb-1">{title}</p>
      <div className="text-[13px] opacity-90">{children}</div>
    </div>
  );
}

// ── Persistent state ──────────────────────────────────────────────────────────

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

// ── DocSidebar ────────────────────────────────────────────────────────────────

function DocSidebar({
  section,
  endpointId,
  onNavigate,
}: {
  section: string;
  endpointId?: string;
  onNavigate: (s: string, epId?: string) => void;
}) {
  const [collapsed, setCollapsed] = useState<Record<string, boolean>>({});
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

  const toggleGroup = (group: string) =>
    setCollapsed((prev) => ({ ...prev, [group]: !prev[group] }));

  return (
    <aside className="w-60 shrink-0 border-r border-zinc-200 bg-white overflow-y-auto flex flex-col">
      {/* Back to dashboard */}
      <div className="shrink-0 border-b border-zinc-100 px-3 py-3">
        <a
          href="/admin/dashboard"
          className="flex items-center gap-2 rounded-md px-2 py-1.5 text-xs font-medium text-zinc-500 hover:bg-zinc-50 hover:text-zinc-900 transition-colors"
        >
          <ArrowLeft className="h-3.5 w-3.5" />
          Back to Dashboard
        </a>
      </div>
      <div className="py-5 px-3 flex-1">
        {Object.entries(grouped).map(([group, items]) => (
          <div key={group} className="mb-5">
            <button
              type="button"
              onClick={() => toggleGroup(group)}
              className="flex w-full items-center justify-between mb-1 px-2"
            >
              <p className="text-[9px] font-bold uppercase tracking-widest text-zinc-400">
                {group}
              </p>
              {collapsed[group]
                ? <ChevronDown className="h-3 w-3 text-zinc-400" />
                : <ChevronUp className="h-3 w-3 text-zinc-400" />}
            </button>

            {!collapsed[group] && items.map((item) => {
              const Icon = SECTION_ICONS[item.id] ?? BookOpen;
              const active = section === item.id && !endpointId;
              return (
                <div key={item.id}>
                  <button
                    type="button"
                    onClick={() => onNavigate(item.id)}
                    className={cn(
                      "flex w-full items-center gap-2 rounded-md px-2 py-1.5 text-sm font-medium transition-colors text-left border-l-2",
                      active
                        ? "border-red-600 bg-red-50 text-red-600"
                        : "border-transparent text-zinc-600 hover:bg-zinc-50 hover:text-zinc-900",
                    )}
                  >
                    <Icon className="h-3.5 w-3.5 shrink-0" />
                    {item.title}
                  </button>

                  {/* Endpoint sub-nav */}
                  {item.id === "endpoints" && isEpSection && (
                    <div className="mt-1 ml-5 space-y-0.5">
                      {Object.entries(epsByCategory).map(([cat, eps]) => (
                        <div key={cat}>
                          <p className="px-2 py-1 text-[9px] font-bold uppercase tracking-widest text-zinc-400">{cat}</p>
                          {eps.map((ep) => (
                            <button
                              key={ep.id}
                              type="button"
                              onClick={() => onNavigate("endpoints", ep.id)}
                              className={cn(
                                "flex w-full items-center gap-1.5 rounded px-2 py-1 text-xs transition-colors text-left border-l-2",
                                endpointId === ep.id
                                  ? "border-red-600 bg-red-50 text-red-700 font-medium"
                                  : "border-transparent text-zinc-500 hover:text-zinc-800",
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

// ── DocToc (right-side table of contents) ─────────────────────────────────────

function DocToc({ section, endpointId }: { section: string; endpointId?: string }) {
  const headings = endpointId
    ? ["Endpoint", "Code Example", "Parameters", "Response", "Errors", "AI Prompt"]
    : SECTION_TOC[section] ?? [];

  if (headings.length === 0) return null;

  return (
    <aside className="w-48 shrink-0 hidden xl:block border-l border-zinc-200 bg-white overflow-y-auto">
      <div className="py-5 px-4">
        <p className="text-[9px] font-bold uppercase tracking-widest text-zinc-400 mb-3">On this page</p>
        <ul className="space-y-1">
          {headings.map((h) => (
            <li key={h}>
              <span className="block text-xs text-zinc-500 hover:text-zinc-900 cursor-default py-0.5 leading-snug">
                {h}
              </span>
            </li>
          ))}
        </ul>
      </div>
    </aside>
  );
}

// ── Section: Overview ─────────────────────────────────────────────────────────

function OverviewSection({ baseUrl }: { baseUrl: string }) {
  const categories = [...new Set(ENDPOINT_REGISTRY.map((e) => CATEGORY_LABELS[e.category]))];
  const firstListEp = ENDPOINT_REGISTRY.find((e) => e.pagination) ?? ENDPOINT_REGISTRY[0];

  const devCurlExample = `curl "${baseUrl}/api/v1${firstListEp.path}?limit=10" \\
  -H "Authorization: Bearer pk_live_your_key_here"`;

  const prodCurlExample = `curl "${PROD_API_URL}${firstListEp.path}?limit=10" \\
  -H "Authorization: Bearer pk_live_your_key_here"`;

  const exampleRes = JSON.stringify(firstListEp.exampleResponse, null, 2);

  return (
    <div className="space-y-10">
      <div>
        <p className="text-xs font-semibold uppercase tracking-widest text-red-600 mb-2">Getting Started</p>
        <h1 className="text-3xl font-bold text-zinc-900 mb-3">Lunar CMS REST API</h1>
        <p className="text-zinc-500 leading-relaxed max-w-2xl">
          The Lunar CMS REST API lets you fetch your workspace content from any application —
          static sites, SPAs, mobile apps, or server-side services. Authenticate with an API key
          and start fetching in minutes.
        </p>
      </div>

      <div className="flex flex-wrap gap-6 text-sm">
        <div className="flex items-center gap-2">
          <Zap className="h-4 w-4 text-red-600" />
          <span className="font-medium text-zinc-800">REST API</span>
          <span className="text-zinc-400">Standard HTTP + JSON</span>
        </div>
        <div className="flex items-center gap-2">
          <Shield className="h-4 w-4 text-red-600" />
          <span className="font-medium text-zinc-800">API Key Auth</span>
          <span className="text-zinc-400">Bearer token</span>
        </div>
        <div className="flex items-center gap-2">
          <Globe className="h-4 w-4 text-red-600" />
          <span className="font-medium text-zinc-800">{ENDPOINT_REGISTRY.length} Endpoints</span>
          <span className="text-zinc-400">across {categories.length} categories</span>
        </div>
      </div>

      <div>
        <h2 className="text-lg font-semibold text-zinc-900 mb-3">Base URL</h2>
        <div className="space-y-2">
          <div>
            <p className="text-xs text-zinc-400 mb-1 font-medium uppercase tracking-wide">Development (Node middleware)</p>
            <div className="flex items-center gap-2 rounded-lg border border-zinc-200 bg-zinc-50 px-3 py-2 font-mono text-sm">
              <span className="text-zinc-500">https://</span>
              <span className="text-zinc-800">{baseUrl.replace(/^https?:\/\//, "")}/api/v1</span>
              <div className="ml-auto"><CopyBtn text={`${baseUrl}/api/v1`} /></div>
            </div>
          </div>
          <div>
            <p className="text-xs text-zinc-400 mb-1 font-medium uppercase tracking-wide">Production (Supabase Edge Function)</p>
            <div className="flex items-center gap-2 rounded-lg border border-zinc-200 bg-zinc-50 px-3 py-2 font-mono text-sm">
              <span className="text-zinc-800 truncate">{PROD_API_URL}</span>
              <div className="ml-auto shrink-0"><CopyBtn text={PROD_API_URL} /></div>
            </div>
          </div>
        </div>
        <p className="mt-2 text-xs text-zinc-400">
          The node middleware ({baseUrl}/api/v1) covers blog engagement endpoints.
          The Supabase edge function handles all content retrieval (blogs, FAQs, news, collections, search, media).
        </p>
      </div>

      <div>
        <h2 className="text-lg font-semibold text-zinc-900 mb-3">Example Request</h2>
        <p className="text-sm text-zinc-500 mb-2">Development:</p>
        <CodeBlock code={devCurlExample} language="bash" />
        <p className="text-sm text-zinc-500 mt-3 mb-2">Production:</p>
        <CodeBlock code={prodCurlExample} language="bash" />
      </div>

      <div>
        <h2 className="text-lg font-semibold text-zinc-900 mb-3">Example Response</h2>
        <CodeBlock code={exampleRes} language="json" />
      </div>

      <div>
        <h2 className="text-lg font-semibold text-zinc-900 mb-4">All Endpoints</h2>
        <div className="rounded-lg border border-zinc-200 overflow-hidden">
          {ENDPOINT_REGISTRY.map((ep, i) => (
            <div key={ep.id} className={cn("flex items-center gap-3 px-4 py-3 text-sm", i > 0 && "border-t border-zinc-100")}>
              <span className={cn("rounded px-1.5 py-0.5 text-[10px] font-bold font-mono shrink-0", METHOD_COLOR[ep.method])}>{ep.method}</span>
              <code className="font-mono text-xs text-zinc-700">/v1{ep.path}</code>
              <span className="text-zinc-400 ml-2 text-xs truncate">{ep.description}</span>
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
  const ep = ENDPOINT_REGISTRY[0];
  return (
    <div className="space-y-10">
      <div>
        <p className="text-xs font-semibold uppercase tracking-widest text-red-600 mb-2">Introduction</p>
        <h1 className="text-3xl font-bold text-zinc-900 mb-3">Authentication</h1>
        <p className="text-zinc-500 leading-relaxed">
          All API requests require a Bearer token in the <code className="font-mono text-xs bg-zinc-100 px-1 rounded">Authorization</code> header.
          Your API key is workspace-scoped — it automatically determines which content is returned.
        </p>
      </div>

      <Callout type="info" title="Key Principle">
        Workspace IDs and Collection IDs are never required in requests. Your API key resolves everything automatically.
      </Callout>

      <div>
        <h2 className="text-lg font-semibold text-zinc-900 mb-4">Key Types</h2>
        <div className="grid grid-cols-2 gap-4">
          {[
            {
              prefix: "pk_live_",
              name: "Publishable Key",
              color: "green" as const,
              desc: "Safe to expose in frontend applications for read-only public content. Ideal for static sites and client-side apps via a proxy.",
              use: "Public read endpoints (blogs, collections, news, FAQs)",
            },
            {
              prefix: "sk_live_",
              name: "Secret Key",
              color: "amber" as const,
              desc: "Higher rate limits and additional capabilities including comment moderation. Never expose in client-side code.",
              use: "Server-side integrations, webhooks, comment moderation",
            },
          ].map((k) => (
            <div key={k.prefix} className="rounded-lg border border-zinc-200 p-4">
              <div className="flex items-center gap-2 mb-2">
                <code className="font-mono text-xs bg-zinc-100 px-2 py-0.5 rounded">{k.prefix}...</code>
                <Badge text={k.name} color={k.color} />
              </div>
              <p className="text-sm text-zinc-500 mb-2">{k.desc}</p>
              <p className="text-xs text-zinc-400"><span className="font-semibold text-zinc-600">Use for:</span> {k.use}</p>
            </div>
          ))}
        </div>
      </div>

      <div>
        <h2 className="text-lg font-semibold text-zinc-900 mb-3">Authorization Header</h2>
        <CodeBlock
          code={`GET ${baseUrl}/api/v1${ep.path} HTTP/1.1\nAuthorization: Bearer pk_live_your_key_here\nContent-Type: application/json`}
          language="http"
        />
      </div>

      <div>
        <h2 className="text-lg font-semibold text-zinc-900 mb-3">cURL Example</h2>
        <CodeBlock
          code={`curl "${baseUrl}/api/v1${ep.path}" \\\n  -H "Authorization: Bearer pk_live_your_key_here"`}
          language="bash"
        />
      </div>

      <div>
        <h2 className="text-lg font-semibold text-zinc-900 mb-3">Authentication Errors</h2>
        <CodeBlock
          code={JSON.stringify({ success: false, error: { code: "INVALID_API_KEY", message: "Invalid or missing API key." } }, null, 2)}
          language="json"
        />
      </div>

      <Callout type="danger" title="Never expose Secret Keys">
        Do not include <code className="font-mono bg-red-100 px-1 rounded">sk_live_</code> keys in client-side code,
        version control, or public repositories. Use environment variables and server-side code only.
      </Callout>
    </div>
  );
}

// ── Section: API Keys ─────────────────────────────────────────────────────────

function ApiKeysSection({}) {
  return (
    <div className="space-y-10">
      <div>
        <p className="text-xs font-semibold uppercase tracking-widest text-red-600 mb-2">Introduction</p>
        <h1 className="text-3xl font-bold text-zinc-900 mb-3">API Keys</h1>
        <p className="text-zinc-500 leading-relaxed">
          Manage your workspace API keys. Keys are workspace-scoped and automatically
          resolve content without requiring workspace or collection IDs in requests.
        </p>
      </div>

      <div className="flex items-center gap-3 rounded-lg border border-zinc-200 bg-zinc-50 p-4">
        <Key className="h-5 w-5 text-red-600 shrink-0" />
        <div className="flex-1">
          <p className="font-semibold text-sm text-zinc-800">Manage API Keys</p>
          <p className="text-xs text-zinc-500">Create, revoke, and manage keys from the API Keys dashboard.</p>
        </div>
        <a
          href={`/admin/api-keys`}
          className="flex items-center gap-1.5 rounded-lg bg-red-600 px-3 py-1.5 text-xs font-semibold text-white hover:bg-red-700 transition-colors"
        >
          <ExternalLink className="h-3 w-3" />
          Go to API Keys
        </a>
      </div>

      <div>
        <h2 className="text-lg font-semibold text-zinc-900 mb-4">Key Format</h2>
        <div className="space-y-2">
          {[
            { prefix: "pk_live_", label: "Publishable", desc: "Read access for public content. Safe for frontend use via proxy." },
            { prefix: "sk_live_", label: "Secret", desc: "Full access including moderation. Server-side only." },
          ].map((k) => (
            <div key={k.prefix} className="flex items-start gap-3 rounded-lg border border-zinc-200 p-3">
              <code className="font-mono text-sm bg-zinc-100 px-2 py-0.5 rounded shrink-0">{k.prefix}{"<payload>"}</code>
              <div>
                <span className="text-sm font-semibold text-zinc-700">{k.label}</span>
                <p className="text-xs text-zinc-500 mt-0.5">{k.desc}</p>
              </div>
            </div>
          ))}
        </div>
      </div>

      <div>
        <h2 className="text-lg font-semibold text-zinc-900 mb-4">Key Lifecycle</h2>
        <div className="space-y-3">
          {[
            { step: "1", title: "Create", desc: "Generate a key from the API Keys dashboard. Choose Publishable for frontend use or Secret for server-side." },
            { step: "2", title: "Store Securely", desc: "Copy the key immediately — it is shown only once. Store it in environment variables, never in source code." },
            { step: "3", title: "Use", desc: 'Include the key in every request: Authorization: Bearer pk_live_your_key' },
            { step: "4", title: "Revoke", desc: "Revoke compromised or unused keys immediately from the API Keys dashboard. Revoked keys reject all requests instantly." },
          ].map((s) => (
            <div key={s.step} className="flex gap-4 items-start py-3 border-b border-zinc-100 last:border-0">
              <div className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-red-100 text-red-700 text-xs font-bold">
                {s.step}
              </div>
              <div>
                <p className="font-semibold text-sm text-zinc-800">{s.title}</p>
                <p className="text-sm text-zinc-500 mt-0.5">{s.desc}</p>
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
  const ep = ENDPOINT_REGISTRY.find((e) => e.pagination) ?? ENDPOINT_REGISTRY[0];
  const snippet = generateSnippet(ep, lang, baseUrl, apiKey || "pk_live_your_key_here");

  return (
    <div className="space-y-10">
      <div>
        <p className="text-xs font-semibold uppercase tracking-widest text-red-600 mb-2">Introduction</p>
        <h1 className="text-3xl font-bold text-zinc-900 mb-3">Making Your First Request</h1>
        <p className="text-zinc-500 leading-relaxed">
          Get up and running in under 2 minutes. Fetch your first blog post with the language of your choice.
        </p>
      </div>

      <div>
        <h2 className="text-lg font-semibold text-zinc-900 mb-3">1. Get an API Key</h2>
        <p className="text-sm text-zinc-500 mb-2">Navigate to the API Keys section and create a Publishable key.</p>
        <div className="rounded-lg border border-zinc-200 bg-zinc-50 px-4 py-3 font-mono text-xs text-zinc-600">
          pk_live_your_key_here
        </div>
      </div>

      <div>
        <h2 className="text-lg font-semibold text-zinc-900 mb-3">2. Make a Request</h2>
        <div className="mb-3 flex flex-wrap gap-1.5">
          {ALL_LANGUAGES.map((l) => (
            <button
              key={l}
              type="button"
              onClick={() => setLang(l)}
              className={cn(
                "rounded px-2.5 py-1 text-xs font-medium transition-colors",
                l === lang ? "bg-red-600 text-white" : "border border-zinc-200 text-zinc-500 hover:text-zinc-800",
              )}
            >
              {LANGUAGE_LABELS[l]}
            </button>
          ))}
        </div>
        <CodeBlock code={snippet} language={lang === "curl" ? "bash" : lang} />
      </div>

      <div>
        <h2 className="text-lg font-semibold text-zinc-900 mb-3">3. Handle the Response</h2>
        <CodeBlock code={JSON.stringify(ep.exampleResponse, null, 2)} language="json" />
      </div>
    </div>
  );
}

// ── Section: Pagination ───────────────────────────────────────────────────────

function PaginationSection({ baseUrl }: { baseUrl: string }) {
  return (
    <div className="space-y-10">
      <div>
        <p className="text-xs font-semibold uppercase tracking-widest text-red-600 mb-2">Reference</p>
        <h1 className="text-3xl font-bold text-zinc-900 mb-3">Pagination</h1>
        <p className="text-zinc-500 leading-relaxed">
          All list endpoints use offset-based pagination via the{" "}
          <code className="font-mono text-xs bg-zinc-100 px-1 rounded">limit</code> and{" "}
          <code className="font-mono text-xs bg-zinc-100 px-1 rounded">offset</code> parameters.
        </p>
      </div>

      <div>
        <h2 className="text-lg font-semibold text-zinc-900 mb-3">Parameters</h2>
        <div className="overflow-hidden rounded-lg border border-zinc-200">
          <table className="w-full text-sm">
            <thead className="bg-zinc-50">
              <tr>
                {["Parameter", "Type", "Default", "Max", "Description"].map((h) => (
                  <th key={h} className="px-4 py-2.5 text-left text-xs font-semibold text-zinc-500">{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {[
                { p: "limit", t: "integer", d: "20", m: "100", desc: "Number of results to return." },
                { p: "offset", t: "integer", d: "0", m: "—", desc: "Number of results to skip. Use offset = page × limit to simulate page-based pagination." },
              ].map((r, i) => (
                <tr key={r.p} className={cn("border-t border-zinc-100", i === 0 && "border-t-0")}>
                  <td className="px-4 py-3"><code className="font-mono text-xs bg-zinc-100 px-1 rounded">{r.p}</code></td>
                  <td className="px-4 py-3 text-zinc-500">{r.t}</td>
                  <td className="px-4 py-3 font-mono text-xs">{r.d}</td>
                  <td className="px-4 py-3 font-mono text-xs">{r.m}</td>
                  <td className="px-4 py-3 text-zinc-500 text-xs">{r.desc}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      <div>
        <h2 className="text-lg font-semibold text-zinc-900 mb-3">Example URLs</h2>
        <div className="space-y-2">
          {[
            { url: `${baseUrl}/api/v1/blogs`, desc: "First 20 results (default)" },
            { url: `${baseUrl}/api/v1/blogs?limit=10`, desc: "First 10 results" },
            { url: `${baseUrl}/api/v1/blogs?limit=10&offset=10`, desc: "Second page of 10 results" },
            { url: `${baseUrl}/api/v1/blogs?limit=100`, desc: "Up to 100 results (max)" },
          ].map(({ url, desc }) => (
            <div key={url} className="flex items-center gap-3 rounded-lg border border-zinc-200 bg-zinc-50 px-3 py-2">
              <code className="font-mono text-xs text-zinc-700 flex-1">{url}</code>
              <span className="text-xs text-zinc-400 shrink-0">{desc}</span>
              <CopyBtn text={url} />
            </div>
          ))}
        </div>
      </div>

      <div>
        <h2 className="text-lg font-semibold text-zinc-900 mb-3">Response Meta Object</h2>
        <CodeBlock code={JSON.stringify({ data: ["..."], meta: { total: 45, limit: 10, offset: 10 } }, null, 2)} language="json" />
        <div className="mt-3 overflow-hidden rounded-lg border border-zinc-200">
          <table className="w-full text-sm">
            <thead className="bg-zinc-50">
              <tr>
                {["Field", "Type", "Description"].map((h) => (
                  <th key={h} className="px-4 py-2.5 text-left text-xs font-semibold text-zinc-500">{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {[
                { f: "total", t: "integer", d: "Total number of matching results across all pages." },
                { f: "limit", t: "integer", d: "Number of results returned in this response." },
                { f: "offset", t: "integer", d: "Number of results skipped before this page." },
              ].map((r, i) => (
                <tr key={r.f} className="border-t border-zinc-100">
                  <td className="px-4 py-3"><code className="font-mono text-xs bg-zinc-100 px-1 rounded">{r.f}</code></td>
                  <td className="px-4 py-3 text-zinc-500">{r.t}</td>
                  <td className="px-4 py-3 text-zinc-500 text-xs">{r.d}</td>
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
    <div className="space-y-10">
      <div>
        <p className="text-xs font-semibold uppercase tracking-widest text-red-600 mb-2">Reference</p>
        <h1 className="text-3xl font-bold text-zinc-900 mb-3">Filtering</h1>
        <p className="text-zinc-500 leading-relaxed">
          Narrow results using filter query parameters. Only filters supported by each
          endpoint are accepted — unsupported filters are silently ignored.
        </p>
      </div>

      {endpointsWithFilters.map((ep) => (
        <div key={ep.id}>
          <h2 className="text-base font-semibold text-zinc-800 mb-3">
            <span className={cn("mr-2 rounded px-1.5 py-0.5 text-[10px] font-bold font-mono", METHOD_COLOR[ep.method])}>{ep.method}</span>
            <code className="font-mono text-sm">/v1{ep.path}</code>
          </h2>
          <div className="flex flex-wrap gap-1.5 mb-3">
            {ep.filters.map((f) => (
              <Badge key={f} text={`?${f}=`} color="gray" />
            ))}
          </div>
          <div className="overflow-hidden rounded-lg border border-zinc-200">
            <table className="w-full text-sm">
              <thead className="bg-zinc-50">
                <tr>
                  {["Filter", "Example", "Description"].map((h) => (
                    <th key={h} className="px-4 py-2.5 text-left text-xs font-semibold text-zinc-500">{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {ep.queryParams.map((p, i) => (
                  <tr key={p.name} className={cn(i > 0 && "border-t border-zinc-100")}>
                    <td className="px-4 py-3"><code className="font-mono text-xs bg-zinc-100 px-1 rounded">{p.name}</code></td>
                    <td className="px-4 py-3"><code className="font-mono text-xs text-zinc-500">?{p.name}={p.example}</code></td>
                    <td className="px-4 py-3 text-zinc-500 text-xs">{p.description}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <div className="mt-2">
            <p className="text-xs text-zinc-400 mb-1">Example URL:</p>
            <div className="flex items-center gap-2 rounded-lg border border-zinc-200 bg-zinc-50 px-3 py-2">
              <code className="font-mono text-xs flex-1 text-zinc-700">
                {baseUrl}/api/v1{ep.path}
                {ep.queryParams[0] ? `?${ep.queryParams[0].name}=${ep.queryParams[0].example}` : ""}
              </code>
              <CopyBtn text={`${baseUrl}/api/v1${ep.path}${ep.queryParams[0] ? `?${ep.queryParams[0].name}=${ep.queryParams[0].example}` : ""}`} />
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
  const firstSearchEp = searchableEndpoints[0];
  const exampleUrl = firstSearchEp
    ? `${baseUrl}/api/v1${firstSearchEp.path}?search=marketing+strategy`
    : `${baseUrl}/api/v1/blogs?search=marketing+strategy`;

  return (
    <div className="space-y-10">
      <div>
        <p className="text-xs font-semibold uppercase tracking-widest text-red-600 mb-2">Reference</p>
        <h1 className="text-3xl font-bold text-zinc-900 mb-3">Search</h1>
        <p className="text-zinc-500 leading-relaxed">
          Use the <code className="font-mono text-xs bg-zinc-100 px-1 rounded">search</code> parameter
          for full-text search on list endpoints. Use <code className="font-mono text-xs bg-zinc-100 px-1 rounded">q</code> on
          the global <code className="font-mono text-xs bg-zinc-100 px-1 rounded">/search</code> endpoint.
        </p>
      </div>

      <div>
        <h2 className="text-lg font-semibold text-zinc-900 mb-3">Example</h2>
        <CodeBlock code={`curl "${exampleUrl}" \\\n  -H "Authorization: Bearer pk_live_your_key_here"`} language="bash" />
      </div>

      <div>
        <h2 className="text-lg font-semibold text-zinc-900 mb-3">Supported Endpoints</h2>
        <div className="space-y-2">
          {searchableEndpoints.map((ep) => (
            <div key={ep.id} className="flex items-center gap-3 rounded-lg border border-zinc-200 px-4 py-3">
              <span className={cn("rounded px-1.5 py-0.5 text-[10px] font-bold font-mono shrink-0", METHOD_COLOR[ep.method])}>{ep.method}</span>
              <code className="font-mono text-xs">/api/v1{ep.path}</code>
              <span className="text-xs text-zinc-400">{ep.description}</span>
            </div>
          ))}
        </div>
      </div>

      <div>
        <h2 className="text-lg font-semibold text-zinc-900 mb-3">Global Search Endpoint</h2>
        <p className="text-sm text-zinc-500 mb-3">
          Use <code className="font-mono text-xs bg-zinc-100 px-1 rounded">GET /api/v1/search?q=</code> to search
          across all content types simultaneously. Requires the <code className="font-mono text-xs bg-zinc-100 px-1 rounded">q</code> parameter.
        </p>
        <CodeBlock
          code={`curl "${baseUrl}/api/v1/search?q=wireless+headphones" \\\n  -H "Authorization: Bearer pk_live_your_key_here"`}
          language="bash"
        />
      </div>
    </div>
  );
}

// ── Section: Errors ───────────────────────────────────────────────────────────

function ErrorsSection() {
  return (
    <div className="space-y-10">
      <div>
        <p className="text-xs font-semibold uppercase tracking-widest text-red-600 mb-2">Reference</p>
        <h1 className="text-3xl font-bold text-zinc-900 mb-3">Error Codes</h1>
        <p className="text-zinc-500 leading-relaxed">
          All errors return JSON with a <code className="font-mono text-xs bg-zinc-100 px-1 rounded">success: false</code> flag
          and an <code className="font-mono text-xs bg-zinc-100 px-1 rounded">error</code> object containing a machine-readable code and message.
        </p>
      </div>

      <div>
        <h2 className="text-lg font-semibold text-zinc-900 mb-3">Error Response Format</h2>
        <CodeBlock
          code={JSON.stringify({ success: false, error: { code: "INVALID_API_KEY", message: "Invalid or missing API key." } }, null, 2)}
          language="json"
        />
      </div>

      <div className="space-y-6">
        {ERROR_DOCS.map((e) => (
          <div key={e.code}>
            <div className="flex items-center gap-3 mb-3">
              <Badge text={String(e.code)} color={e.code >= 500 ? "red" : e.code >= 400 ? "amber" : "gray"} />
              <h3 className="text-base font-semibold text-zinc-800">{e.name}</h3>
            </div>
            <p className="text-sm text-zinc-500 mb-3">{e.description}</p>
            <CodeBlock code={JSON.stringify(e.example, null, 2)} language="json" />
            <div className="mt-2 text-xs text-zinc-500">
              <span className="font-semibold text-zinc-700">Resolution: </span>{e.resolution}
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
    <div className="space-y-10">
      <div>
        <p className="text-xs font-semibold uppercase tracking-widest text-red-600 mb-2">Reference</p>
        <h1 className="text-3xl font-bold text-zinc-900 mb-3">Rate Limits</h1>
        <p className="text-zinc-500 leading-relaxed">
          Rate limits are applied per API key. When exceeded, the API returns a{" "}
          <code className="font-mono text-xs bg-zinc-100 px-1 mx-1 rounded">429 Too Many Requests</code>
          response with a <code className="font-mono text-xs bg-zinc-100 px-1 rounded">Retry-After</code> header.
        </p>
      </div>

      <div>
        <h2 className="text-lg font-semibold text-zinc-900 mb-3">Limits by Key Type</h2>
        <div className="overflow-hidden rounded-lg border border-zinc-200">
          <table className="w-full text-sm">
            <thead className="bg-zinc-50">
              <tr>
                {["Key Type", "Requests / Minute", "Requests / Day"].map((h) => (
                  <th key={h} className="px-4 py-2.5 text-left text-xs font-semibold text-zinc-500">{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {RATE_LIMIT_TIERS.map((t, i) => (
                <tr key={t.keyType} className={cn(i > 0 && "border-t border-zinc-100")}>
                  <td className="px-4 py-3"><code className="font-mono text-xs bg-zinc-100 px-1 rounded">{t.keyType}</code></td>
                  <td className="px-4 py-3">{t.requestsPerMinute.toLocaleString()}</td>
                  <td className="px-4 py-3">{t.requestsPerDay.toLocaleString()}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      <div>
        <h2 className="text-lg font-semibold text-zinc-900 mb-3">Response Headers</h2>
        <CodeBlock
          code={`HTTP/1.1 429 Too Many Requests\nRetry-After: 60\nX-RateLimit-Limit: 60\nX-RateLimit-Remaining: 0\nX-RateLimit-Reset: 1700000060`}
          language="http"
        />
      </div>

      <div>
        <h2 className="text-lg font-semibold text-zinc-900 mb-3">Retry Strategy</h2>
        <CodeBlock
          code={`async function fetchWithRetry(url, options, retries = 3) {
  for (let attempt = 0; attempt < retries; attempt++) {
    const res = await fetch(url, options);
    if (res.status !== 429) return res;

    const retryAfter = parseInt(res.headers.get("Retry-After") ?? "2");
    const wait = Math.min(retryAfter * 1000, (2 ** attempt) * 1000);
    await new Promise(resolve => setTimeout(resolve, wait));
  }
  throw new Error("Rate limit retries exhausted");
}`}
          language="javascript"
        />
      </div>

      <Callout type="info" title="Tip">
        Use ISR (Incremental Static Regeneration) or a caching layer (TanStack Query, SWR) to significantly
        reduce API call volume and stay well within rate limits.
      </Callout>
    </div>
  );
}

// ── Section: Versioning ───────────────────────────────────────────────────────

function VersioningSection({ baseUrl }: { baseUrl: string }) {
  return (
    <div className="space-y-10">
      <div>
        <p className="text-xs font-semibold uppercase tracking-widest text-red-600 mb-2">Reference</p>
        <h1 className="text-3xl font-bold text-zinc-900 mb-3">Versioning</h1>
        <p className="text-zinc-500 leading-relaxed">
          The API version is embedded in the URL path. Currently <code className="font-mono text-xs bg-zinc-100 px-1 rounded">v1</code> is
          the only stable version.
        </p>
      </div>

      <div>
        <h2 className="text-lg font-semibold text-zinc-900 mb-3">Version Status</h2>
        <div className="overflow-hidden rounded-lg border border-zinc-200">
          <table className="w-full text-sm">
            <thead className="bg-zinc-50">
              <tr>
                {["Version", "Status", "Dev Base URL", "Production Base URL"].map((h) => (
                  <th key={h} className="px-4 py-2.5 text-left text-xs font-semibold text-zinc-500">{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              <tr>
                <td className="px-4 py-3"><code className="font-mono text-xs bg-zinc-100 px-1 rounded">v1</code></td>
                <td className="px-4 py-3"><Badge text="Stable" color="green" /></td>
                <td className="px-4 py-3"><code className="font-mono text-xs text-zinc-500">{baseUrl}/api/v1</code></td>
                <td className="px-4 py-3"><code className="font-mono text-xs text-zinc-500 break-all">{PROD_API_URL}</code></td>
              </tr>
            </tbody>
          </table>
        </div>
      </div>

      <div>
        <h2 className="text-lg font-semibold text-zinc-900 mb-2">Deprecation Policy</h2>
        <p className="text-sm text-zinc-500">
          Deprecated versions receive at least 12 months of notice before removal.
          Breaking changes always increment the major version number.
          Non-breaking additions (new fields, new endpoints) may be made without a version bump.
        </p>
      </div>
    </div>
  );
}

// ── Section: Code Examples ────────────────────────────────────────────────────

function CodeExamplesSection({ baseUrl, apiKey }: { baseUrl: string; apiKey: string }) {
  const [lang, setLang] = useState<CodeLanguage>("curl");
  const [epId, setEpId] = useState(ENDPOINT_REGISTRY[0].id);
  const ep = ENDPOINT_REGISTRY.find((e) => e.id === epId) ?? ENDPOINT_REGISTRY[0];
  const snippet = generateSnippet(ep, lang, baseUrl, apiKey || "pk_live_your_key_here");

  return (
    <div className="space-y-10">
      <div>
        <p className="text-xs font-semibold uppercase tracking-widest text-red-600 mb-2">Guides</p>
        <h1 className="text-3xl font-bold text-zinc-900 mb-3">Code Examples</h1>
        <p className="text-zinc-500 leading-relaxed">
          Ready-to-use code snippets for every endpoint in {ALL_LANGUAGES.length} languages.
          {apiKey ? " Using your pasted API key." : " Paste your API key in the top bar to pre-fill examples."}
        </p>
      </div>

      <div className="flex flex-wrap gap-4">
        <div>
          <p className="text-xs font-semibold text-zinc-500 mb-1.5">Endpoint</p>
          <select
            value={epId}
            onChange={(e) => setEpId(e.target.value)}
            className="rounded-lg border border-zinc-200 bg-white px-3 py-1.5 text-sm text-zinc-700 focus:outline-none focus:ring-1 focus:ring-red-500"
          >
            {ENDPOINT_REGISTRY.map((e) => (
              <option key={e.id} value={e.id}>{e.method} /v1{e.path}</option>
            ))}
          </select>
        </div>
      </div>

      <div>
        <p className="text-xs font-semibold text-zinc-500 mb-2">Language</p>
        <div className="flex flex-wrap gap-1.5 mb-4">
          {ALL_LANGUAGES.map((l) => (
            <button
              key={l}
              type="button"
              onClick={() => setLang(l)}
              className={cn(
                "rounded px-2.5 py-1 text-xs font-medium transition-colors",
                l === lang ? "bg-red-600 text-white" : "border border-zinc-200 text-zinc-500 hover:text-zinc-800",
              )}
            >
              {LANGUAGE_LABELS[l]}
            </button>
          ))}
        </div>
        <CodeBlock code={snippet} language={lang === "curl" ? "bash" : lang} />
      </div>
    </div>
  );
}

// ── Section: Framework Guides ─────────────────────────────────────────────────

function FrameworksSection() {
  const [activeId, setActiveId] = useState(FRAMEWORK_GUIDES[0].id);
  const guide = FRAMEWORK_GUIDES.find((g) => g.id === activeId) ?? FRAMEWORK_GUIDES[0];

  return (
    <div className="space-y-10">
      <div>
        <p className="text-xs font-semibold uppercase tracking-widest text-red-600 mb-2">Guides</p>
        <h1 className="text-3xl font-bold text-zinc-900 mb-3">Framework Guides</h1>
        <p className="text-zinc-500 leading-relaxed">
          Integration examples for popular frameworks. Each guide shows environment variable setup
          and a complete fetch example using the real API base URL.
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
              g.id === activeId ? "border-red-600 bg-red-50 text-red-600" : "border-zinc-200 text-zinc-600 hover:text-zinc-900",
            )}
          >
            <span>{g.icon}</span>
            {g.name}
          </button>
        ))}
      </div>

      <div className="space-y-5">
        <div>
          <h3 className="text-sm font-semibold text-zinc-700 mb-2">Environment Variables</h3>
          <CodeBlock code={guide.envSetup} language="bash" />
        </div>
        <div>
          <h3 className="text-sm font-semibold text-zinc-700 mb-2">Fetch Example</h3>
          <CodeBlock code={guide.fetchExample} language="typescript" />
        </div>
        <div className="rounded-lg border border-blue-100 bg-blue-50 px-4 py-3 text-sm text-blue-800">
          <span className="font-semibold">Note: </span>{guide.notes}
        </div>
      </div>
    </div>
  );
}

// ── Section: AI Prompts ───────────────────────────────────────────────────────

function AiPromptsSection({ baseUrl }: { baseUrl: string }) {
  const [activeEpId, setActiveEpId] = useState(ENDPOINT_REGISTRY[0].id);
  const [generatedPrompt, setGeneratedPrompt] = useState<string | null>(null);
  const [selectedPlatform, setSelectedPlatform] = useState("cursor");

  const ep = ENDPOINT_REGISTRY.find((e) => e.id === activeEpId) ?? ENDPOINT_REGISTRY[0];

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
    <div className="space-y-10">
      <div>
        <p className="text-xs font-semibold uppercase tracking-widest text-red-600 mb-2">Guides</p>
        <h1 className="text-3xl font-bold text-zinc-900 mb-3">AI Prompts</h1>
        <p className="text-zinc-500 leading-relaxed">
          Generate implementation prompts for AI coding assistants. Prompts are pre-filled
          with your API details, endpoint reference, and best practices.
        </p>
      </div>

      <div>
        <p className="text-xs font-semibold text-zinc-500 mb-2">Endpoint context</p>
        <select
          value={activeEpId}
          onChange={(e) => { setActiveEpId(e.target.value); setGeneratedPrompt(null); }}
          className="rounded-lg border border-zinc-200 bg-white px-3 py-1.5 text-sm focus:outline-none focus:ring-1 focus:ring-red-500"
        >
          {ENDPOINT_REGISTRY.map((e) => (
            <option key={e.id} value={e.id}>{e.method} /v1{e.path} — {e.title}</option>
          ))}
        </select>
      </div>

      <div>
        <p className="text-xs font-semibold text-zinc-500 mb-3">Generate for</p>
        <div className="flex flex-wrap gap-2">
          {AI_PLATFORMS.slice(0, 4).map((p) => (
            <button
              key={p.id}
              type="button"
              onClick={() => handleGenerate(p.id)}
              className={cn(
                "flex items-center gap-2 rounded-lg border px-3 py-2 text-sm font-medium transition-colors",
                selectedPlatform === p.id && generatedPrompt
                  ? "border-red-600 bg-red-50 text-red-600"
                  : "border-zinc-200 text-zinc-600 hover:text-zinc-900",
              )}
            >
              <Sparkles className="h-3.5 w-3.5" />
              {p.label} Prompt
            </button>
          ))}
        </div>
      </div>

      {generatedPrompt && (
        <div>
          <div className="mb-2 flex items-center justify-between">
            <h2 className="text-base font-semibold text-zinc-800">
              Generated {AI_PLATFORMS.find((p) => p.id === selectedPlatform)?.label} Prompt
            </h2>
            <CopyBtn text={generatedPrompt} label="Copy prompt" />
          </div>
          <div className="overflow-hidden rounded-lg border border-zinc-200">
            <pre className="max-h-96 overflow-y-auto p-4 text-xs font-mono text-zinc-700 whitespace-pre-wrap leading-relaxed bg-zinc-50">
              {generatedPrompt}
            </pre>
          </div>
          <p className="mt-2 text-xs text-zinc-400">
            For more options, visit the{" "}
            <a href={`/admin/integration-center`} className="text-red-600 hover:underline">
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
    <div className="space-y-10">
      <div>
        <p className="text-xs font-semibold uppercase tracking-widest text-red-600 mb-2">Endpoints</p>
        <h1 className="text-3xl font-bold text-zinc-900 mb-3">REST Endpoints</h1>
        <p className="text-zinc-500 leading-relaxed">
          {ENDPOINT_REGISTRY.length} endpoints across {Object.keys(grouped).length} categories.
          All endpoints require Bearer token authentication.
        </p>
      </div>

      {Object.entries(grouped).map(([cat, eps]) => (
        <div key={cat}>
          <h2 className="text-base font-semibold text-zinc-800 mb-3">{cat}</h2>
          <div className="overflow-hidden rounded-lg border border-zinc-200">
            {eps.map((ep, i) => (
              <button
                key={ep.id}
                type="button"
                onClick={() => onSelectEndpoint(ep.id)}
                className={cn(
                  "flex w-full items-center gap-3 px-4 py-3.5 text-left hover:bg-zinc-50 transition-colors",
                  i > 0 && "border-t border-zinc-100",
                )}
              >
                <span className={cn("rounded px-1.5 py-0.5 text-[10px] font-bold font-mono shrink-0", METHOD_COLOR[ep.method])}>{ep.method}</span>
                <code className="font-mono text-xs text-zinc-700 shrink-0">/v1{ep.path}</code>
                <span className="text-sm text-zinc-400 flex-1 truncate">{ep.description}</span>
                {ep.authentication && <Badge text="Auth" color="gray" />}
                {ep.pagination && <Badge text="Paginated" color="gray" />}
                <ChevronRight className="h-4 w-4 text-zinc-300 shrink-0" />
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
}: {
  endpointId: string;
  baseUrl: string;
  apiKey: string;
  isFav: boolean;
  onToggleFav: (id: string) => void;
}) {
  const ep = ENDPOINT_REGISTRY.find((e) => e.id === endpointId);
  const [lang, setLang] = useState<CodeLanguage>("curl");
  const [activeTab, setActiveTab] = useState<"params" | "response" | "errors">("params");

  // ── Try It state ──────────────────────────────────────────────────────────
  const [tryOpen, setTryOpen] = useState(false);
  const [tryValues, setTryValues] = useState<Record<string, string>>({});
  const [tryLoading, setTryLoading] = useState(false);
  const [tryResult, setTryResult] = useState<{ status: number; body: string; ms: number } | null>(null);

  if (!ep) return <div className="p-8 text-zinc-400">Endpoint not found.</div>;

  const params = buildParamList(ep);
  const snippet = generateSnippet(ep, lang, baseUrl, apiKey || "pk_live_your_key_here");
  const responseJson = JSON.stringify(ep.exampleResponse, null, 2);

  // If this endpoint uses content-engagement edge function, show the prod URL too
  const isEdgeFn = !!ep.functionName;
  const edgeFnNote = isEdgeFn
    ? `This endpoint is served by the \`${ep.functionName}\` Supabase Edge Function.\nProduction URL: ${PROD_API_URL}${ep.path}`
    : null;

  function buildTryUrl() {
    let path = ep!.path;
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
    return `${baseUrl}/api/v1${path}${qs.length ? "?" + qs.join("&") : ""}`;
  }

  async function handleTrySend() {
    setTryLoading(true);
    setTryResult(null);
    const t0 = Date.now();
    try {
      const res = await fetch(buildTryUrl(), {
        method: ep!.method,
        headers: {
          ...(apiKey ? { Authorization: `Bearer ${apiKey}` } : {}),
          "Content-Type": "application/json",
        },
      });
      const raw = await res.text();
      let body = raw;
      try { body = JSON.stringify(JSON.parse(raw), null, 2); } catch { /* leave as-is */ }
      setTryResult({ status: res.status, body, ms: Date.now() - t0 });
    } catch (err) {
      setTryResult({ status: 0, body: String(err), ms: Date.now() - t0 });
    }
    setTryLoading(false);
  }

  return (
    <div className="space-y-8">
      {/* Header */}
      <div className="pb-6 border-b border-zinc-100">
        <div className="flex items-start justify-between gap-3">
          <div>
            <div className="flex items-center gap-2 mb-2">
              <span className={cn("rounded px-2 py-0.5 text-xs font-bold font-mono", METHOD_COLOR[ep.method])}>{ep.method}</span>
              <code className="font-mono text-base font-semibold text-zinc-800">/v1{ep.path}</code>
            </div>
            <h1 className="text-2xl font-bold text-zinc-900">{ep.title}</h1>
            <p className="mt-1 text-zinc-500 text-sm leading-relaxed max-w-2xl">{ep.longDescription ?? ep.description}</p>
          </div>
          <button
            type="button"
            onClick={() => onToggleFav(ep.id)}
            className="shrink-0 flex items-center gap-1.5 rounded-lg border border-zinc-200 px-2.5 py-1.5 text-xs text-zinc-500 hover:text-zinc-800 transition-colors"
          >
            {isFav ? <Star className="h-3.5 w-3.5 text-amber-500 fill-amber-500" /> : <StarOff className="h-3.5 w-3.5" />}
            {isFav ? "Saved" : "Save"}
          </button>
        </div>

        <div className="mt-3 flex flex-wrap gap-1.5">
          {ep.authentication && <Badge text="Requires Auth" color="gray" />}
          {ep.pagination && <Badge text="Paginated" color="blue" />}
          {ep.search && <Badge text="Searchable" color="green" />}
          {isEdgeFn && <Badge text="Edge Function" color="amber" />}
          <Badge text={`Added in ${ep.addedInVersion}`} color="gray" />
        </div>
      </div>

      {/* Edge fn note */}
      {edgeFnNote && (
        <Callout type="info" title="Supabase Edge Function">
          <p>This endpoint is served by the <code className="font-mono">{ep.functionName}</code> Supabase Edge Function.</p>
          <p className="mt-1 font-mono text-xs break-all">{PROD_API_URL}{ep.path}</p>
        </Callout>
      )}

      {/* Code Snippet */}
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
        <CodeBlock code={snippet} language={lang === "curl" ? "bash" : lang} />
      </div>

      {/* ── Try It Panel ──────────────────────────────────────────────────── */}
      <div className="rounded-lg border border-zinc-200 overflow-hidden">
        <button
          type="button"
          onClick={() => { setTryOpen((o) => !o); setTryResult(null); }}
          className="flex w-full items-center justify-between px-4 py-3 bg-zinc-50 hover:bg-zinc-100 transition-colors"
        >
          <div className="flex items-center gap-2">
            <Play className="h-4 w-4 text-red-600" />
            <span className="text-sm font-semibold text-zinc-800">Try It</span>
            <span className="text-xs text-zinc-400">— send a live request</span>
          </div>
          {tryOpen
            ? <ChevronUp className="h-4 w-4 text-zinc-400" />
            : <ChevronDown className="h-4 w-4 text-zinc-400" />}
        </button>

        {tryOpen && (
          <div className="px-4 py-4 space-y-4 border-t border-zinc-200 bg-white">
            {/* URL preview */}
            <div className="flex items-center gap-2 rounded-lg border border-zinc-200 bg-zinc-50 px-3 py-2">
              <span className={cn("rounded px-1.5 py-0.5 text-[10px] font-bold font-mono shrink-0", METHOD_COLOR[ep.method])}>{ep.method}</span>
              <code className="font-mono text-xs text-zinc-600 truncate flex-1">{buildTryUrl()}</code>
            </div>

            {/* Auth status */}
            {!apiKey && (
              <div className="flex items-center gap-2 rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-xs text-amber-700">
                <Key className="h-3.5 w-3.5 shrink-0" />
                No API key set — paste one in the top bar to authenticate requests.
              </div>
            )}

            {/* Params */}
            {params.length > 0 && (
              <div className="space-y-2">
                <p className="text-xs font-semibold text-zinc-500">Parameters</p>
                <div className="grid gap-2">
                  {params.map((p) => (
                    <div key={p.name} className="flex items-center gap-3">
                      <div className="w-32 shrink-0">
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

            {/* Send button */}
            <button
              type="button"
              onClick={handleTrySend}
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
                    {tryResult.status === 0 ? "Network Error" : tryResult.status}
                  </span>
                  <span className="text-xs text-zinc-400">{tryResult.ms} ms</span>
                  <button
                    type="button"
                    onClick={() => setTryResult(null)}
                    className="ml-auto text-zinc-400 hover:text-zinc-600"
                  >
                    <X className="h-3.5 w-3.5" />
                  </button>
                </div>
                <pre className="max-h-64 overflow-y-auto rounded-lg border border-zinc-200 bg-zinc-950 p-3 text-xs font-mono text-zinc-100 leading-relaxed whitespace-pre-wrap">
                  {tryResult.body}
                </pre>
              </div>
            )}
          </div>
        )}
      </div>

      {/* ── Tabs ──────────────────────────────────────────────────────────── */}
      <div>
        <div className="flex gap-1 border-b border-zinc-200 mb-4">
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
                activeTab === t.id ? "border-red-600 text-red-600" : "border-transparent text-zinc-500 hover:text-zinc-800",
              )}
            >
              {t.label}
            </button>
          ))}
        </div>

        {activeTab === "params" && (
          params.length === 0 ? (
            <p className="text-sm text-zinc-400">No parameters.</p>
          ) : (
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
                      <td className="px-4 py-3"><Badge text={p.source === "path" ? "path" : "query"} color="gray" /></td>
                      <td className="px-4 py-3 text-zinc-500 text-xs">{formatParamType(p)}</td>
                      <td className="px-4 py-3">
                        {p.required
                          ? <Badge text="required" color="red" />
                          : <Badge text="optional" color="gray" />}
                      </td>
                      <td className="px-4 py-3 font-mono text-xs text-zinc-400">{p.default ?? "—"}</td>
                      <td className="px-4 py-3 text-xs text-zinc-500">{p.description}</td>
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
              <div className="overflow-hidden rounded-lg border border-zinc-200">
                <table className="w-full text-sm">
                  <thead className="bg-zinc-50">
                    <tr>
                      {["Field", "Type", "Nullable", "Description"].map((h) => (
                        <th key={h} className="px-4 py-2.5 text-left text-xs font-semibold text-zinc-500">{h}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {ep.responseFields.map((f, i) => (
                      <tr key={f.name} className={cn(i > 0 && "border-t border-zinc-100")}>
                        <td className="px-4 py-3"><code className="font-mono text-xs bg-zinc-100 px-1 rounded">{f.name}</code></td>
                        <td className="px-4 py-3 text-zinc-500 text-xs">{f.type}</td>
                        <td className="px-4 py-3">{f.nullable ? <Badge text="nullable" color="amber" /> : <span className="text-xs text-zinc-300">—</span>}</td>
                        <td className="px-4 py-3 text-xs text-zinc-500">{f.description}</td>
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
                <div key={code} className="flex items-start gap-3 rounded-lg border border-zinc-200 p-3">
                  <Badge text={String(code)} color={code >= 500 ? "red" : "amber"} />
                  <div>
                    <p className="text-sm font-medium text-zinc-800">{doc.name}</p>
                    <p className="text-xs text-zinc-500 mt-0.5">{doc.resolution}</p>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* AI Prompt shortcut */}
      <div className="rounded-lg border border-zinc-200 bg-zinc-50 p-4">
        <div className="flex items-center gap-2 mb-2">
          <Sparkles className="h-4 w-4 text-red-600" />
          <h2 className="text-sm font-semibold text-zinc-800">Generate AI Prompt</h2>
        </div>
        <p className="text-xs text-zinc-500 mb-3">
          Create an implementation prompt for this endpoint tailored to your AI coding assistant.
        </p>
        <a
          href={`/admin/integration-center`}
          className="inline-flex items-center gap-1.5 rounded-lg bg-red-600 px-3 py-1.5 text-xs font-semibold text-white hover:bg-red-700 transition-colors"
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
    <div className="space-y-10">
      <div>
        <p className="text-xs font-semibold uppercase tracking-widest text-red-600 mb-2">Resources</p>
        <h1 className="text-3xl font-bold text-zinc-900 mb-3">Changelog</h1>
        <p className="text-zinc-500 leading-relaxed">API changes by version, newest first.</p>
      </div>

      <div className="space-y-8">
        {[...CHANGELOG].reverse().map((entry) => (
          <div key={entry.version} className="relative pl-6">
            <div className="absolute left-0 top-2 h-full w-px bg-zinc-200" />
            <div className="absolute left-[-3px] top-2 h-2 w-2 rounded-full bg-red-600" />
            <div className="mb-3 flex items-center gap-3">
              <span className="font-semibold text-sm text-zinc-800">Version {entry.version}</span>
              <Badge text={entry.date} color="gray" />
            </div>
            <div className="space-y-2">
              {entry.changes.map((c, i) => (
                <div key={i} className="flex items-start gap-2">
                  <span className={cn("mt-0.5 inline-flex rounded border px-1.5 py-0.5 text-[9px] font-bold uppercase shrink-0", CHANGE_COLOR[c.type])}>
                    {c.type}
                  </span>
                  <p className="text-sm text-zinc-500">{c.description}</p>
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

function DevDocsPortal() {
  const { section, endpointId } = Route.useSearch();
  const navigate = useNavigate({ from: Route.fullPath });

  const [apiKey, setApiKey] = useState("");
  const [searchQuery, setSearchQuery] = useState("");
  const [searchResults, setSearchResults] = useState<SearchResult[]>([]);
  const [showSearch, setShowSearch] = useState(false);

  const { favs, toggle: toggleFav } = useFavorites("global");
  const { recent, push: pushRecent } = useRecentlyViewed("global");

  // Use window.location.origin for dev; shows real Replit URL
  const baseUrl = typeof window !== "undefined"
    ? window.location.origin
    : "https://your-app.replit.app";

  const goTo = useCallback((s: string, epId?: string) => {
    navigate({ search: { section: s, endpointId: epId } });
    if (epId) pushRecent(epId);
  }, [navigate, pushRecent]);

  useEffect(() => {
    if (!searchQuery.trim()) { setSearchResults([]); return; }
    setSearchResults(searchDocs(searchQuery, 8));
  }, [searchQuery]);

  const recentEps = useMemo(() =>
    recent.map((rid) => ENDPOINT_REGISTRY.find((e) => e.id === rid)).filter(Boolean) as EndpointDefinition[],
    [recent],
  );

  const favEps = useMemo(() =>
    favs.map((fid) => ENDPOINT_REGISTRY.find((e) => e.id === fid)).filter(Boolean) as EndpointDefinition[],
    [favs],
  );

  function renderContent() {
    if (endpointId) {
      return (
        <EndpointDetailSection
          endpointId={endpointId}
          baseUrl={baseUrl}
          apiKey={apiKey}
          isFav={favs.includes(endpointId)}
          onToggleFav={toggleFav}
          
        />
      );
    }

    switch (section) {
      case "overview":       return <OverviewSection baseUrl={baseUrl} />;
      case "authentication": return <AuthSection baseUrl={baseUrl} />;
      case "api-keys":       return <ApiKeysSection  />;
      case "first-request":  return <FirstRequestSection baseUrl={baseUrl} apiKey={apiKey} />;
      case "pagination":     return <PaginationSection baseUrl={baseUrl} />;
      case "filtering":      return <FilteringSection baseUrl={baseUrl} />;
      case "search":         return <SearchSection baseUrl={baseUrl} />;
      case "errors":         return <ErrorsSection />;
      case "rate-limits":    return <RateLimitsSection />;
      case "versioning":     return <VersioningSection baseUrl={baseUrl} />;
      case "code-examples":  return <CodeExamplesSection baseUrl={baseUrl} apiKey={apiKey} />;
      case "frameworks":     return <FrameworksSection />;
      case "ai-prompts":     return <AiPromptsSection baseUrl={baseUrl}  />;
      case "endpoints":      return <EndpointsListSection onSelectEndpoint={(epId) => goTo("endpoints", epId)} />;
      case "changelog":      return <ChangelogSection />;
      default:               return <OverviewSection baseUrl={baseUrl} />;
    }
  }

  return (
    <div className="flex h-full overflow-hidden bg-white">
      {/* Doc sidebar */}
      <DocSidebar section={section ?? "overview"} endpointId={endpointId} onNavigate={goTo} />

      {/* Main area */}
      <div className="flex flex-1 flex-col overflow-hidden">
        {/* Top bar */}
        <div className="flex shrink-0 items-center gap-3 border-b border-zinc-200 bg-white px-6 py-3">
          {/* Search */}
          <div className="relative flex-1 max-w-sm">
            <Search className="absolute left-2.5 top-2 h-4 w-4 text-zinc-400" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => { setSearchQuery(e.target.value); setShowSearch(true); }}
              onFocus={() => setShowSearch(true)}
              onBlur={() => setTimeout(() => setShowSearch(false), 200)}
              placeholder="Search documentation..."
              className="w-full rounded-lg border border-zinc-200 bg-zinc-50 py-1.5 pl-8 pr-3 text-sm focus:outline-none focus:ring-1 focus:ring-red-500"
            />
            {showSearch && searchResults.length > 0 && (
              <div className="absolute top-full left-0 z-50 mt-1 w-80 rounded-lg border border-zinc-200 bg-white shadow-lg">
                {searchResults.map((r) => (
                  <button
                    key={r.id}
                    type="button"
                    onMouseDown={() => { goTo(r.section, r.endpointId); setSearchQuery(""); }}
                    className="flex w-full flex-col gap-0.5 px-3 py-2.5 text-left hover:bg-zinc-50 transition-colors border-b border-zinc-100 last:border-0"
                  >
                    <span className="text-sm font-medium text-zinc-800">{r.title}</span>
                    <span className="text-xs text-zinc-400 truncate">{r.description}</span>
                  </button>
                ))}
              </div>
            )}
          </div>

          {/* API key input */}
          <div className="relative">
            <Key className="absolute left-2.5 top-2 h-3.5 w-3.5 text-zinc-400" />
            <input
              type="text"
              value={apiKey}
              onChange={(e) => setApiKey(e.target.value)}
              placeholder="Paste API key to pre-fill examples"
              className="w-64 rounded-lg border border-zinc-200 bg-zinc-50 py-1.5 pl-8 pr-3 font-mono text-xs focus:outline-none focus:ring-1 focus:ring-red-500"
            />
          </div>

          {/* Prod URL quick-copy */}
          <div className="hidden lg:flex items-center gap-2 text-xs text-zinc-400 border border-zinc-200 rounded-lg px-3 py-1.5">
            <Globe className="h-3.5 w-3.5 text-red-600" />
            <code className="font-mono text-zinc-600 text-[10px] max-w-[200px] truncate">{PROD_API_URL}</code>
            <CopyBtn text={PROD_API_URL} />
          </div>
        </div>

        {/* Content + TOC */}
        <div className="flex flex-1 overflow-hidden">
          {/* Scrollable content */}
          <div className="flex-1 overflow-y-auto">
            <div className="mx-auto max-w-3xl px-8 py-10">
              {/* Recently viewed / favorites on overview */}
              {section === "overview" && !endpointId && (recentEps.length > 0 || favEps.length > 0) && (
                <div className="mb-10 space-y-4">
                  {recentEps.length > 0 && (
                    <div>
                      <div className="mb-2 flex items-center gap-2 text-xs font-semibold text-zinc-400">
                        <Eye className="h-3.5 w-3.5" /> Recently Viewed
                      </div>
                      <div className="flex flex-wrap gap-2">
                        {recentEps.map((ep) => (
                          <button
                            key={ep.id}
                            type="button"
                            onClick={() => goTo("endpoints", ep.id)}
                            className="flex items-center gap-1.5 rounded-lg border border-zinc-200 bg-white px-2.5 py-1.5 text-xs hover:bg-zinc-50 transition-colors"
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
                      <div className="mb-2 flex items-center gap-2 text-xs font-semibold text-zinc-400">
                        <Star className="h-3.5 w-3.5 text-amber-500" /> Favorites
                      </div>
                      <div className="flex flex-wrap gap-2">
                        {favEps.map((ep) => (
                          <button
                            key={ep.id}
                            type="button"
                            onClick={() => goTo("endpoints", ep.id)}
                            className="flex items-center gap-1.5 rounded-lg border border-zinc-200 bg-white px-2.5 py-1.5 text-xs hover:bg-zinc-50 transition-colors"
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

          {/* Right TOC */}
          <DocToc section={section ?? "overview"} endpointId={endpointId} />
        </div>
      </div>
    </div>
  );
}
