import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useState, useMemo, useEffect, useRef, useCallback } from "react";
import { z } from "zod";
import {
  BookOpen, Key, Shield, Zap, Hash, Layers, Search, AlertTriangle,
  Activity, Globe, Code2, FileText, Sparkles, Clock, ChevronRight,
  Copy, Check, Menu, X, Database, ArrowLeft, ExternalLink, ChevronDown,
  Terminal, Package, HelpCircle, Rocket, Star, Webhook,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { toast } from "sonner";
import { ENDPOINT_REGISTRY, CATEGORY_LABELS } from "@/lib/EndpointRegistry";
import { generateSnippet, ALL_LANGUAGES, LANGUAGE_LABELS, type CodeLanguage } from "@/lib/ExampleGenerator";
import { buildParamList } from "@/lib/ParameterParser";
import {
  DOC_SECTIONS,
  ERROR_DOCS,
  RATE_LIMIT_TIERS,
  CHANGELOG,
  FRAMEWORK_GUIDES,
} from "@/lib/DocumentationService";
import { searchDocs } from "@/lib/DocumentationSearch";

// ─── Route ────────────────────────────────────────────────────────────────────

const searchSchema = z.object({
  section:    z.string().optional().default("introduction"),
  endpointId: z.string().optional(),
  q:          z.string().optional(),
});

export const Route = createFileRoute("/admin/docs")({
  head: () => ({ meta: [{ title: "Developer Docs — Lunar CMS" }] }),
  validateSearch: searchSchema,
  component: DevDocsPortal,
});

// ─── Nav structure ────────────────────────────────────────────────────────────

interface NavLeaf  { type: "leaf";  id: string; label: string; icon?: React.ComponentType<{ className?: string }> }
interface NavGroup { type: "group"; label: string; items: NavLeaf[]; defaultOpen?: boolean }
type NavEntry = NavGroup;

const NAV_STRUCTURE: NavEntry[] = [
  {
    type: "group", label: "Getting Started", defaultOpen: true,
    items: [
      { type: "leaf", id: "introduction",   label: "Introduction",      icon: BookOpen },
      { type: "leaf", id: "quick-start",    label: "Quick Start",       icon: Rocket   },
      { type: "leaf", id: "authentication", label: "Authentication",    icon: Shield   },
      { type: "leaf", id: "api-keys",       label: "API Keys",          icon: Key      },
      { type: "leaf", id: "first-request",  label: "First Request",     icon: Zap      },
    ],
  },
  {
    type: "group", label: "REST API", defaultOpen: true,
    items: [
      { type: "leaf", id: "endpoints",      label: "All Endpoints",     icon: Database },
      { type: "leaf", id: "pagination",     label: "Pagination",        icon: Hash     },
      { type: "leaf", id: "filtering",      label: "Filtering",         icon: Layers   },
      { type: "leaf", id: "search-api",     label: "Search",            icon: Search   },
      { type: "leaf", id: "rate-limits",    label: "Rate Limits",       icon: Activity },
      { type: "leaf", id: "versioning",     label: "Versioning",        icon: Globe    },
    ],
  },
  {
    type: "group", label: "Error Reference", defaultOpen: false,
    items: [
      { type: "leaf", id: "errors",         label: "HTTP Error Codes",  icon: AlertTriangle },
    ],
  },
  {
    type: "group", label: "Guides", defaultOpen: true,
    items: [
      { type: "leaf", id: "code-examples",  label: "Code Examples",     icon: Code2    },
      { type: "leaf", id: "frameworks",     label: "Framework Guides",  icon: FileText },
      { type: "leaf", id: "ai-prompts",     label: "AI Prompts",        icon: Sparkles },
    ],
  },
  {
    type: "group", label: "Resources", defaultOpen: false,
    items: [
      { type: "leaf", id: "faq",            label: "Developer FAQ",     icon: HelpCircle },
      { type: "leaf", id: "changelog",      label: "Changelog",         icon: Clock    },
      { type: "leaf", id: "sdk",            label: "SDKs",              icon: Package  },
      { type: "leaf", id: "webhooks",       label: "Webhooks",          icon: Webhook  },
    ],
  },
];

const METHOD_COLOR: Record<string, string> = {
  GET:    "text-emerald-700 bg-emerald-50 border border-emerald-200",
  POST:   "text-blue-700   bg-blue-50   border border-blue-200",
  PUT:    "text-amber-700  bg-amber-50  border border-amber-200",
  PATCH:  "text-orange-700 bg-orange-50 border border-orange-200",
  DELETE: "text-red-700    bg-red-50    border border-red-200",
};

// ─── Tiny reusable components ─────────────────────────────────────────────────

function CopyButton({ text }: { text: string }) {
  const [copied, setCopied] = useState(false);
  return (
    <button
      type="button"
      onClick={() => {
        navigator.clipboard.writeText(text);
        setCopied(true);
        toast.success("Copied!");
        setTimeout(() => setCopied(false), 2000);
      }}
      className="flex items-center gap-1 text-xs text-zinc-400 hover:text-zinc-200 transition-colors"
    >
      {copied ? <Check className="h-3 w-3 text-emerald-400" /> : <Copy className="h-3 w-3" />}
      {copied ? "Copied" : "Copy"}
    </button>
  );
}

function CodeBlock({ code, language = "", className }: { code: string; language?: string; className?: string }) {
  return (
    <div className={cn("group relative rounded-xl bg-zinc-950 border border-zinc-800 overflow-hidden", className)}>
      {language && (
        <div className="flex items-center justify-between px-4 py-2 border-b border-zinc-800 bg-zinc-900">
          <span className="text-[10px] font-medium text-zinc-400 uppercase tracking-wider font-mono">{language}</span>
          <CopyButton text={code} />
        </div>
      )}
      {!language && (
        <div className="absolute right-3 top-3 opacity-0 group-hover:opacity-100 transition-opacity z-10">
          <CopyButton text={code} />
        </div>
      )}
      <pre className="overflow-x-auto p-4 text-sm text-zinc-100 font-mono leading-relaxed">
        <code>{code}</code>
      </pre>
    </div>
  );
}

function SectionCard({ children, className }: { children: React.ReactNode; className?: string }) {
  return (
    <div className={cn("bg-white border border-zinc-200 rounded-xl p-6 shadow-sm", className)}>
      {children}
    </div>
  );
}

function MethodBadge({ method }: { method: string }) {
  return (
    <span className={cn("inline-flex items-center rounded px-1.5 py-0.5 text-[11px] font-bold font-mono", METHOD_COLOR[method] ?? "bg-muted text-muted-foreground")}>
      {method}
    </span>
  );
}

function StatusBadge({ label, color = "zinc" }: { label: string; color?: "zinc" | "green" | "blue" | "amber" | "red" | "purple" }) {
  const colors = {
    zinc:   "bg-zinc-100 text-zinc-600",
    green:  "bg-emerald-50 text-emerald-700 border border-emerald-200",
    blue:   "bg-blue-50 text-blue-700 border border-blue-200",
    amber:  "bg-amber-50 text-amber-700 border border-amber-200",
    red:    "bg-red-50 text-red-700 border border-red-200",
    purple: "bg-purple-50 text-purple-700 border border-purple-200",
  };
  return <span className={cn("inline-flex items-center rounded px-1.5 py-0.5 text-[10px] font-semibold", colors[color])}>{label}</span>;
}

function InfoBox({ type = "info", children, className }: { type?: "info" | "warning" | "tip"; children: React.ReactNode; className?: string }) {
  const styles = {
    info:    "bg-blue-50 border-blue-200 text-blue-800",
    warning: "bg-amber-50 border-amber-200 text-amber-800",
    tip:     "bg-emerald-50 border-emerald-200 text-emerald-800",
  };
  return (
    <div className={cn("rounded-lg border px-4 py-3 text-sm", styles[type])}>
      {children}
    </div>
  );
}

function SectionHeading({ id, children }: { id: string; children: React.ReactNode }) {
  return (
    <h2 id={id} className="text-lg font-semibold text-zinc-900 flex items-center gap-2 scroll-mt-20">
      {children}
    </h2>
  );
}

function ParamTable({ params }: { params: ReturnType<typeof buildParamList> }) {
  if (!params.length) return <p className="text-sm text-zinc-500">No parameters.</p>;
  return (
    <div className="overflow-x-auto rounded-lg border border-zinc-200">
      <table className="w-full text-sm">
        <thead>
          <tr className="bg-zinc-50 border-b border-zinc-200">
            <th className="px-3 py-2 text-left text-xs font-semibold text-zinc-500 uppercase tracking-wider">Name</th>
            <th className="px-3 py-2 text-left text-xs font-semibold text-zinc-500 uppercase tracking-wider">Type</th>
            <th className="px-3 py-2 text-left text-xs font-semibold text-zinc-500 uppercase tracking-wider">Required</th>
            <th className="px-3 py-2 text-left text-xs font-semibold text-zinc-500 uppercase tracking-wider">Description</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-zinc-100">
          {params.map((p) => (
            <tr key={p.name} className="hover:bg-zinc-50/50">
              <td className="px-3 py-2 font-mono text-xs text-zinc-900 font-medium">{p.name}</td>
              <td className="px-3 py-2 font-mono text-xs text-purple-600">{p.type}</td>
              <td className="px-3 py-2">
                {p.required
                  ? <StatusBadge label="required" color="red" />
                  : <StatusBadge label="optional" color="zinc" />}
              </td>
              <td className="px-3 py-2 text-xs text-zinc-600">{p.description}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

// ─── Sidebar ──────────────────────────────────────────────────────────────────

function DocSidebar({
  section,
  endpointId,
  onNavigate,
  collapsed,
  onToggle,
}: {
  section: string;
  endpointId?: string;
  onNavigate: (s: string, epId?: string) => void;
  collapsed: boolean;
  onToggle: () => void;
}) {
  const [openGroups, setOpenGroups] = useState<Record<string, boolean>>(() =>
    Object.fromEntries(NAV_STRUCTURE.map((g) => [g.label, g.defaultOpen ?? false]))
  );
  const epsByCategory = useMemo(() => {
    const g: Record<string, typeof ENDPOINT_REGISTRY> = {};
    for (const ep of ENDPOINT_REGISTRY) {
      const label = CATEGORY_LABELS[ep.category];
      g[label] = [...(g[label] ?? []), ep];
    }
    return g;
  }, []);

  const toggleGroup = (label: string) =>
    setOpenGroups((prev) => ({ ...prev, [label]: !prev[label] }));

  return (
    <aside
      className={cn(
        "fixed left-0 top-14 bottom-0 z-30 flex flex-col bg-white border-r border-zinc-200 transition-all duration-200 overflow-y-auto",
        collapsed ? "w-0 overflow-hidden" : "w-60",
      )}
    >
      <div className="py-4 px-3 min-w-60">
        {NAV_STRUCTURE.map((group) => {
          const isOpen = openGroups[group.label] ?? group.defaultOpen ?? false;
          return (
            <div key={group.label} className="mb-3">
              <button
                type="button"
                onClick={() => toggleGroup(group.label)}
                className="flex w-full items-center justify-between px-2 py-1 mb-0.5"
              >
                <span className="text-[10px] font-bold uppercase tracking-widest text-zinc-400">
                  {group.label}
                </span>
                <ChevronDown className={cn("h-3 w-3 text-zinc-400 transition-transform", isOpen && "rotate-180")} />
              </button>
              {isOpen && (
                <div className="space-y-0.5">
                  {group.items.map((item) => {
                    const Icon = item.icon;
                    const isEndpointsPage = item.id === "endpoints";
                    const active = section === item.id && !endpointId;
                    return (
                      <div key={item.id}>
                        <button
                          type="button"
                          onClick={() => onNavigate(item.id)}
                          className={cn(
                            "flex w-full items-center gap-2 rounded-lg px-2 py-1.5 text-sm font-medium transition-colors text-left",
                            active
                              ? "bg-violet-50 text-violet-700"
                              : "text-zinc-600 hover:bg-zinc-50 hover:text-zinc-900",
                          )}
                        >
                          {Icon && <Icon className="h-3.5 w-3.5 shrink-0" />}
                          {item.label}
                        </button>
                        {isEndpointsPage && (section === "endpoints" || !!endpointId) && (
                          <div className="ml-4 mt-0.5 space-y-0.5 border-l border-zinc-100 pl-3">
                            {Object.entries(epsByCategory).map(([cat, eps]) => (
                              <div key={cat}>
                                <p className="py-1 text-[9px] font-bold uppercase tracking-widest text-zinc-400">{cat}</p>
                                {eps.map((ep) => (
                                  <button
                                    key={ep.id}
                                    type="button"
                                    onClick={() => onNavigate("endpoints", ep.id)}
                                    className={cn(
                                      "flex w-full items-center gap-1.5 rounded px-1.5 py-1 text-xs transition-colors text-left",
                                      endpointId === ep.id
                                        ? "text-violet-700 font-semibold"
                                        : "text-zinc-500 hover:text-zinc-800",
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
              )}
            </div>
          );
        })}
      </div>
    </aside>
  );
}

// ─── Table of Contents ────────────────────────────────────────────────────────

interface TocEntry { id: string; label: string }

function DocTOC({ entries, activeId }: { entries: TocEntry[]; activeId: string }) {
  if (!entries.length) return null;
  return (
    <aside className="w-52 shrink-0 sticky top-20 self-start hidden xl:block">
      <p className="mb-3 text-[10px] font-bold uppercase tracking-widest text-zinc-400">On this page</p>
      <nav className="space-y-1">
        {entries.map((e) => (
          <a
            key={e.id}
            href={`#${e.id}`}
            className={cn(
              "block rounded px-2 py-1 text-xs transition-colors",
              activeId === e.id
                ? "text-violet-700 font-semibold bg-violet-50"
                : "text-zinc-500 hover:text-zinc-800",
            )}
          >
            {e.label}
          </a>
        ))}
      </nav>
    </aside>
  );
}

// ─── Section: Introduction ────────────────────────────────────────────────────

function IntroductionSection({ onNavigate }: { onNavigate: (s: string) => void }) {
  const categories = [...new Set(ENDPOINT_REGISTRY.map((e) => CATEGORY_LABELS[e.category]))];
  return (
    <div className="space-y-5">
      <div>
        <div className="flex items-center gap-2 mb-3">
          <StatusBadge label="v1" color="green" />
          <StatusBadge label="Stable" color="blue" />
        </div>
        <h1 className="text-3xl font-bold text-zinc-900 tracking-tight">Lunar CMS Developer Docs</h1>
        <p className="mt-3 text-zinc-500 text-base leading-relaxed max-w-2xl">
          The Lunar CMS REST API gives you programmatic access to all your workspace content — blogs, articles, products, FAQs, and more.
          Authenticate with an API key and start fetching in minutes.
        </p>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        {[
          { icon: Zap,      label: "REST + JSON",                desc: "Standard HTTP responses",          section: "endpoints"     },
          { icon: Shield,   label: "API Key Auth",               desc: "Bearer token authentication",      section: "authentication" },
          { icon: Database, label: `${ENDPOINT_REGISTRY.length} Endpoints`, desc: `Across ${categories.length} content types`, section: "endpoints" },
        ].map((f) => (
          <button
            key={f.label}
            type="button"
            onClick={() => onNavigate(f.section)}
            className="text-left rounded-xl border border-zinc-200 bg-white p-4 shadow-sm hover:border-violet-300 hover:shadow-md transition-all group"
          >
            <f.icon className="h-5 w-5 text-violet-600 mb-2 group-hover:scale-110 transition-transform" />
            <p className="font-semibold text-sm text-zinc-900">{f.label}</p>
            <p className="text-xs text-zinc-500 mt-0.5">{f.desc}</p>
          </button>
        ))}
      </div>

      <SectionCard>
        <SectionHeading id="what-is-lunar">What is Lunar CMS?</SectionHeading>
        <p className="mt-2 text-sm text-zinc-600 leading-relaxed">
          Lunar CMS is a headless content management system. You manage content through the admin dashboard, and your website or app
          fetches that content through the REST API. This separation lets you use any frontend framework — Next.js, React, Vue, Astro,
          SvelteKit, Laravel, Flutter, or plain HTML.
        </p>
        <div className="mt-4 grid grid-cols-1 sm:grid-cols-2 gap-3">
          {[
            { title: "Headless Architecture",  desc: "Content and presentation are decoupled. Change your frontend any time without touching content." },
            { title: "Multi-workspace",         desc: "Each workspace has isolated content and its own set of API keys." },
            { title: "Publishable & Secret Keys", desc: "pk_live_ keys for frontend, sk_live_ keys for trusted backend servers." },
            { title: "Real-time Content",      desc: "Changes in the dashboard reflect immediately via the API." },
          ].map((i) => (
            <div key={i.title} className="rounded-lg border border-zinc-100 bg-zinc-50 p-3">
              <p className="text-xs font-semibold text-zinc-800">{i.title}</p>
              <p className="text-xs text-zinc-500 mt-0.5 leading-relaxed">{i.desc}</p>
            </div>
          ))}
        </div>
      </SectionCard>

      <SectionCard>
        <SectionHeading id="base-url">Base URL</SectionHeading>
        <p className="mt-2 text-sm text-zinc-600">All API requests should be made to:</p>
        <div className="mt-3 flex items-center gap-2 rounded-lg border border-zinc-200 bg-zinc-50 px-3 py-2.5 font-mono text-sm">
          <Globe className="h-4 w-4 text-zinc-400 shrink-0" />
          <span className="text-zinc-900">https://your-domain.com/api/v1</span>
          <div className="ml-auto">
            <CopyButton text="https://your-domain.com/api/v1" />
          </div>
        </div>
        <InfoBox type="tip" className="mt-3">
          Replace <code className="font-mono text-xs bg-emerald-100 px-1 rounded">your-domain.com</code> with your actual Lunar CMS deployment URL. Each workspace is identified by its API key, not by a separate URL.
        </InfoBox>
      </SectionCard>

      <SectionCard>
        <SectionHeading id="next-steps">Next Steps</SectionHeading>
        <div className="mt-3 space-y-2">
          {[
            { label: "Get your API key",           section: "api-keys",       desc: "Create a publishable or secret key in the API Keys section" },
            { label: "Authenticate your requests", section: "authentication", desc: "Learn how to include your API key in every request" },
            { label: "Make your first request",    section: "first-request",  desc: "Fetch your first content in under a minute" },
            { label: "Browse the API Reference",   section: "endpoints",      desc: `Explore all ${ENDPOINT_REGISTRY.length} available endpoints` },
          ].map((step) => (
            <button
              key={step.label}
              type="button"
              onClick={() => onNavigate(step.section)}
              className="flex w-full items-center gap-3 rounded-lg border border-zinc-100 p-3 text-left hover:border-violet-200 hover:bg-violet-50/30 transition-colors group"
            >
              <ChevronRight className="h-4 w-4 text-violet-500 shrink-0 group-hover:translate-x-0.5 transition-transform" />
              <div>
                <p className="text-sm font-medium text-zinc-900">{step.label}</p>
                <p className="text-xs text-zinc-500">{step.desc}</p>
              </div>
            </button>
          ))}
        </div>
      </SectionCard>
    </div>
  );
}

// ─── Section: Quick Start ─────────────────────────────────────────────────────

function QuickStartSection() {
  const [step, setStep] = useState(0);
  const steps = [
    {
      title: "1. Get an API Key",
      content: (
        <div className="space-y-3">
          <p className="text-sm text-zinc-600">Go to <strong>API Keys</strong> in the sidebar and create a publishable key (<code className="font-mono text-xs bg-zinc-100 px-1 rounded">pk_live_</code>).</p>
          <InfoBox type="tip">Use publishable keys for public frontends. Secret keys should only be used server-side.</InfoBox>
        </div>
      ),
    },
    {
      title: "2. Make a Request",
      content: (
        <CodeBlock
          language="bash"
          code={`curl "https://your-domain.com/api/v1/blogs?limit=5" \\
  -H "Authorization: Bearer pk_live_YOUR_KEY"`}
        />
      ),
    },
    {
      title: "3. Parse the Response",
      content: (
        <CodeBlock
          language="json"
          code={`{
  "success": true,
  "data": [
    {
      "slug": "hello-world",
      "title": "Hello World",
      "excerpt": "My first blog post",
      "published_at": "2025-01-15T12:00:00Z"
    }
  ],
  "meta": { "page": 1, "limit": 5, "total": 42, "totalPages": 9 }
}`}
        />
      ),
    },
    {
      title: "4. Display in Your App",
      content: (
        <CodeBlock
          language="javascript"
          code={`const res = await fetch("https://your-domain.com/api/v1/blogs", {
  headers: { Authorization: "Bearer pk_live_YOUR_KEY" },
});
const { data: posts } = await res.json();

posts.forEach(post => {
  console.log(post.title, post.slug);
});`}
        />
      ),
    },
  ];
  return (
    <div className="space-y-5">
      <div>
        <h1 className="text-2xl font-bold text-zinc-900">Quick Start</h1>
        <p className="mt-2 text-zinc-500 text-sm">Get your first content in under 2 minutes.</p>
      </div>
      <div className="flex gap-2 flex-wrap">
        {steps.map((s, i) => (
          <button
            key={i}
            type="button"
            onClick={() => setStep(i)}
            className={cn(
              "text-xs px-3 py-1.5 rounded-full border font-medium transition-colors",
              step === i ? "bg-violet-600 text-white border-violet-600" : "border-zinc-200 text-zinc-600 hover:border-violet-300",
            )}
          >
            {s.title}
          </button>
        ))}
      </div>
      <SectionCard>{steps[step].content}</SectionCard>
      <div className="flex gap-2">
        {step > 0 && (
          <button type="button" onClick={() => setStep(step - 1)} className="text-sm text-zinc-500 hover:text-zinc-800 transition-colors">
            ← Previous
          </button>
        )}
        {step < steps.length - 1 && (
          <button type="button" onClick={() => setStep(step + 1)} className="ml-auto text-sm font-medium text-violet-600 hover:text-violet-800 transition-colors">
            Next →
          </button>
        )}
      </div>
    </div>
  );
}

// ─── Section: Authentication ──────────────────────────────────────────────────

function AuthenticationSection() {
  return (
    <div className="space-y-5">
      <div>
        <h1 className="text-2xl font-bold text-zinc-900">Authentication</h1>
        <p className="mt-2 text-zinc-500 text-sm">All API requests require an API key passed as a Bearer token.</p>
      </div>

      <SectionCard>
        <SectionHeading id="bearer-token">Bearer Token</SectionHeading>
        <p className="mt-2 text-sm text-zinc-600">Include your API key in the <code className="font-mono text-xs bg-zinc-100 px-1 rounded">Authorization</code> header of every request:</p>
        <CodeBlock className="mt-3" language="http" code={`GET /api/v1/blogs HTTP/1.1
Host: your-domain.com
Authorization: Bearer pk_live_YOUR_KEY
Content-Type: application/json`} />
      </SectionCard>

      <SectionCard>
        <SectionHeading id="key-types">Key Types</SectionHeading>
        <div className="mt-3 grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div className="rounded-lg border border-emerald-200 bg-emerald-50/50 p-4">
            <div className="flex items-center gap-2 mb-2">
              <StatusBadge label="pk_live_" color="green" />
              <span className="text-xs font-semibold text-zinc-700">Publishable Key</span>
            </div>
            <ul className="space-y-1 text-xs text-zinc-600">
              <li>✓ Safe to use in client-side code</li>
              <li>✓ Read-only access to published content</li>
              <li>✓ Rate limited at 60 req/min</li>
              <li>✗ Cannot access unpublished content</li>
            </ul>
          </div>
          <div className="rounded-lg border border-blue-200 bg-blue-50/50 p-4">
            <div className="flex items-center gap-2 mb-2">
              <StatusBadge label="sk_live_" color="blue" />
              <span className="text-xs font-semibold text-zinc-700">Secret Key</span>
            </div>
            <ul className="space-y-1 text-xs text-zinc-600">
              <li>✓ Full read/write access</li>
              <li>✓ Access to drafts and unpublished</li>
              <li>✓ Higher rate limits (120 req/min)</li>
              <li>✗ Never expose in client-side code</li>
            </ul>
          </div>
        </div>
      </SectionCard>

      <SectionCard>
        <SectionHeading id="auth-errors">Authentication Errors</SectionHeading>
        <div className="mt-3 space-y-2">
          {[
            { code: "401", reason: "Missing or invalid API key", fix: 'Add `Authorization: Bearer YOUR_KEY` header' },
            { code: "403", reason: "Key doesn't have permission for this resource", fix: "Use a secret key for protected endpoints" },
          ].map((e) => (
            <div key={e.code} className="flex items-start gap-3 rounded-lg border border-red-100 bg-red-50/50 p-3">
              <StatusBadge label={e.code} color="red" />
              <div>
                <p className="text-xs font-medium text-zinc-800">{e.reason}</p>
                <p className="text-xs text-zinc-500 mt-0.5">{e.fix}</p>
              </div>
            </div>
          ))}
        </div>
      </SectionCard>

      <SectionCard>
        <SectionHeading id="security">Security Best Practices</SectionHeading>
        <ul className="mt-3 space-y-2 text-sm text-zinc-600">
          {[
            "Never commit API keys to version control — use environment variables",
            "Use publishable keys for client-side code; secret keys stay server-side",
            "Rotate keys immediately if you suspect they've been compromised",
            "Use different keys for development and production",
          ].map((tip) => (
            <li key={tip} className="flex items-start gap-2">
              <Shield className="h-4 w-4 text-violet-500 shrink-0 mt-0.5" />
              {tip}
            </li>
          ))}
        </ul>
      </SectionCard>
    </div>
  );
}

// ─── Section: API Keys ────────────────────────────────────────────────────────

function ApiKeysSection() {
  return (
    <div className="space-y-5">
      <div>
        <h1 className="text-2xl font-bold text-zinc-900">API Keys</h1>
        <p className="mt-2 text-zinc-500 text-sm">Create and manage API keys to authenticate requests.</p>
      </div>

      <SectionCard>
        <SectionHeading id="creating-keys">Creating Keys</SectionHeading>
        <ol className="mt-3 space-y-3">
          {[
            "Navigate to the workspace you want to create a key for",
            "Click API Keys in the workspace sidebar",
            "Click New API Key and give it a descriptive name",
            "Choose the key type: publishable or secret",
            "Copy the key immediately — it won't be shown again",
          ].map((step, i) => (
            <li key={i} className="flex items-start gap-3 text-sm text-zinc-600">
              <span className="flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-violet-100 text-violet-700 text-xs font-bold">
                {i + 1}
              </span>
              {step}
            </li>
          ))}
        </ol>
      </SectionCard>

      <SectionCard>
        <SectionHeading id="key-lifecycle">Key Lifecycle</SectionHeading>
        <div className="mt-3 grid grid-cols-2 sm:grid-cols-4 gap-3">
          {[
            { label: "Create", icon: "✦", desc: "Generate new keys from the dashboard" },
            { label: "Store",  icon: "🔒", desc: "Store in env variables, never in code" },
            { label: "Use",    icon: "→",  desc: "Include in Authorization header" },
            { label: "Revoke", icon: "✗",  desc: "Instantly disable compromised keys" },
          ].map((step) => (
            <div key={step.label} className="rounded-lg border border-zinc-100 bg-zinc-50 p-3 text-center">
              <div className="text-lg mb-1">{step.icon}</div>
              <p className="text-xs font-semibold text-zinc-800">{step.label}</p>
              <p className="text-[11px] text-zinc-500 mt-1 leading-tight">{step.desc}</p>
            </div>
          ))}
        </div>
      </SectionCard>

      <SectionCard>
        <SectionHeading id="env-vars">Environment Variables</SectionHeading>
        <p className="mt-2 text-sm text-zinc-600">Always store API keys in environment variables:</p>
        <CodeBlock className="mt-3" language="bash" code={`# .env.local (never commit this file)
LUNAR_API_KEY=pk_live_xxxxxxxxxxxxxxxx
LUNAR_API_URL=https://your-domain.com/api/v1`} />
      </SectionCard>
    </div>
  );
}

// ─── Section: First Request ───────────────────────────────────────────────────

function FirstRequestSection() {
  const [lang, setLang] = useState<CodeLanguage>("curl");
  const firstEp = ENDPOINT_REGISTRY[0];
  const snippet = generateSnippet(firstEp, lang, "https://your-domain.com/api/v1", "pk_live_YOUR_KEY");
  return (
    <div className="space-y-5">
      <div>
        <h1 className="text-2xl font-bold text-zinc-900">Your First Request</h1>
        <p className="mt-2 text-zinc-500 text-sm">Make your first API call and get content back.</p>
      </div>

      <SectionCard>
        <SectionHeading id="endpoint">Endpoint</SectionHeading>
        <div className="mt-3 flex items-center gap-2 rounded-lg border border-zinc-200 bg-zinc-50 px-3 py-2 font-mono text-sm">
          <MethodBadge method="GET" />
          <span className="text-zinc-900">/api/v1/blogs</span>
        </div>
      </SectionCard>

      <SectionCard>
        <SectionHeading id="code-example">Code Example</SectionHeading>
        <div className="mt-3 flex gap-1.5 flex-wrap">
          {ALL_LANGUAGES.map((l) => (
            <button
              key={l}
              type="button"
              onClick={() => setLang(l)}
              className={cn(
                "text-xs px-2.5 py-1 rounded-full border transition-colors font-medium",
                lang === l ? "bg-zinc-900 text-white border-zinc-900" : "border-zinc-200 text-zinc-600 hover:border-zinc-400",
              )}
            >
              {LANGUAGE_LABELS[l]}
            </button>
          ))}
        </div>
        <CodeBlock className="mt-3" language={LANGUAGE_LABELS[lang]} code={snippet} />
      </SectionCard>

      <SectionCard>
        <SectionHeading id="response">Response</SectionHeading>
        <CodeBlock
          className="mt-3"
          language="json"
          code={JSON.stringify(firstEp.exampleResponse, null, 2)}
        />
      </SectionCard>
    </div>
  );
}

// ─── Section: Endpoints ───────────────────────────────────────────────────────

function EndpointsSection({ endpointId, onSelectEndpoint }: { endpointId?: string; onSelectEndpoint: (id: string) => void }) {
  const [lang, setLang] = useState<CodeLanguage>("curl");
  const ep = endpointId ? ENDPOINT_REGISTRY.find((e) => e.id === endpointId) : null;

  const epsByCategory = useMemo(() => {
    const g: Record<string, typeof ENDPOINT_REGISTRY> = {};
    for (const e of ENDPOINT_REGISTRY) {
      const label = CATEGORY_LABELS[e.category];
      g[label] = [...(g[label] ?? []), e];
    }
    return g;
  }, []);

  if (ep) {
    const params = buildParamList(ep);
    const snippet = generateSnippet(ep, lang, "https://your-domain.com/api/v1", "pk_live_YOUR_KEY");
    return (
      <div className="space-y-5">
        <div className="flex items-center gap-2">
          <button type="button" onClick={() => onSelectEndpoint("")} className="text-xs text-zinc-400 hover:text-zinc-700 flex items-center gap-1">
            <ArrowLeft className="h-3.5 w-3.5" /> All Endpoints
          </button>
        </div>
        <div>
          <div className="flex items-center gap-2 flex-wrap">
            <MethodBadge method={ep.method} />
            <h1 className="text-xl font-bold text-zinc-900 font-mono">{ep.path}</h1>
            {ep.deprecated && <StatusBadge label="Deprecated" color="amber" />}
          </div>
          <p className="mt-2 text-zinc-500 text-sm">{ep.description}</p>
          {ep.longDescription && <p className="mt-1 text-zinc-500 text-sm">{ep.longDescription}</p>}
        </div>

        <div className="flex gap-3 flex-wrap">
          <StatusBadge label={ep.authentication ? "Auth required" : "Public"} color={ep.authentication ? "amber" : "green"} />
          {ep.pagination && <StatusBadge label="Paginated" color="blue" />}
          {ep.search && <StatusBadge label="Searchable" color="purple" />}
          <StatusBadge label={`Added ${ep.addedInVersion}`} color="zinc" />
        </div>

        <SectionCard>
          <SectionHeading id="request-url">Request URL</SectionHeading>
          <div className="mt-2 flex items-center gap-2 rounded-lg border border-zinc-200 bg-zinc-50 px-3 py-2 font-mono text-sm overflow-x-auto">
            <MethodBadge method={ep.method} />
            <span className="text-zinc-600">https://your-domain.com/api/v1</span>
            <span className="text-zinc-900 font-medium">{ep.path}</span>
          </div>
        </SectionCard>

        <SectionCard>
          <SectionHeading id="parameters">Parameters</SectionHeading>
          <div className="mt-3">
            <ParamTable params={params} />
          </div>
        </SectionCard>

        <SectionCard>
          <SectionHeading id="code-examples">Code Examples</SectionHeading>
          <div className="mt-3 flex gap-1.5 flex-wrap">
            {ALL_LANGUAGES.map((l) => (
              <button
                key={l}
                type="button"
                onClick={() => setLang(l)}
                className={cn(
                  "text-xs px-2.5 py-1 rounded-full border transition-colors font-medium",
                  lang === l ? "bg-zinc-900 text-white border-zinc-900" : "border-zinc-200 text-zinc-600 hover:border-zinc-400",
                )}
              >
                {LANGUAGE_LABELS[l]}
              </button>
            ))}
          </div>
          <CodeBlock className="mt-3" language={LANGUAGE_LABELS[lang]} code={snippet} />
        </SectionCard>

        <SectionCard>
          <SectionHeading id="response">Example Response</SectionHeading>
          <CodeBlock className="mt-3" language="json" code={JSON.stringify(ep.exampleResponse, null, 2)} />
        </SectionCard>

        {ep.possibleErrors.length > 0 && (
          <SectionCard>
            <SectionHeading id="errors">Possible Errors</SectionHeading>
            <div className="mt-3 flex gap-2 flex-wrap">
              {ep.possibleErrors.map((code) => (
                <StatusBadge key={code} label={String(code)} color={code >= 500 ? "red" : code >= 400 ? "amber" : "green"} />
              ))}
            </div>
          </SectionCard>
        )}
      </div>
    );
  }

  return (
    <div className="space-y-5">
      <div>
        <h1 className="text-2xl font-bold text-zinc-900">REST Endpoints</h1>
        <p className="mt-2 text-zinc-500 text-sm">
          {ENDPOINT_REGISTRY.length} endpoints across {Object.keys(epsByCategory).length} categories.
          All endpoints return JSON.
        </p>
      </div>
      {Object.entries(epsByCategory).map(([cat, eps]) => (
        <SectionCard key={cat}>
          <SectionHeading id={cat.toLowerCase().replace(/\s+/g, "-")}>{cat}</SectionHeading>
          <div className="mt-3 space-y-2">
            {eps.map((ep) => (
              <button
                key={ep.id}
                type="button"
                onClick={() => onSelectEndpoint(ep.id)}
                className="flex w-full items-start gap-3 rounded-lg border border-zinc-100 p-3 text-left hover:border-violet-200 hover:bg-violet-50/30 transition-colors group"
              >
                <MethodBadge method={ep.method} />
                <div className="flex-1 min-w-0">
                  <span className="text-sm font-mono text-zinc-900 font-medium">{ep.path}</span>
                  <p className="text-xs text-zinc-500 mt-0.5">{ep.description}</p>
                </div>
                <ChevronRight className="h-4 w-4 text-zinc-300 group-hover:text-violet-400 shrink-0 mt-0.5 transition-colors" />
              </button>
            ))}
          </div>
        </SectionCard>
      ))}
    </div>
  );
}

// ─── Section: Pagination ──────────────────────────────────────────────────────

function PaginationSection() {
  return (
    <div className="space-y-5">
      <div>
        <h1 className="text-2xl font-bold text-zinc-900">Pagination</h1>
        <p className="mt-2 text-zinc-500 text-sm">List endpoints use offset-based pagination via <code className="font-mono text-xs bg-zinc-100 px-1 rounded">limit</code> and <code className="font-mono text-xs bg-zinc-100 px-1 rounded">page</code> query parameters.</p>
      </div>

      <SectionCard>
        <SectionHeading id="parameters">Parameters</SectionHeading>
        <div className="mt-3 overflow-x-auto rounded-lg border border-zinc-200">
          <table className="w-full text-sm">
            <thead><tr className="bg-zinc-50 border-b"><th className="px-3 py-2 text-left text-xs font-semibold text-zinc-500">Param</th><th className="px-3 py-2 text-left text-xs font-semibold text-zinc-500">Type</th><th className="px-3 py-2 text-left text-xs font-semibold text-zinc-500">Default</th><th className="px-3 py-2 text-left text-xs font-semibold text-zinc-500">Max</th><th className="px-3 py-2 text-left text-xs font-semibold text-zinc-500">Description</th></tr></thead>
            <tbody className="divide-y divide-zinc-100">
              {[
                { name: "limit",  type: "integer", default: "20",  max: "100",  desc: "Number of items to return" },
                { name: "page",   type: "integer", default: "1",   max: "—",    desc: "Page number (1-based)" },
                { name: "offset", type: "integer", default: "0",   max: "—",    desc: "Number of items to skip (alternative to page)" },
              ].map((r) => (
                <tr key={r.name} className="hover:bg-zinc-50/50">
                  <td className="px-3 py-2 font-mono text-xs font-medium text-zinc-900">{r.name}</td>
                  <td className="px-3 py-2 font-mono text-xs text-purple-600">{r.type}</td>
                  <td className="px-3 py-2 font-mono text-xs text-zinc-500">{r.default}</td>
                  <td className="px-3 py-2 font-mono text-xs text-zinc-500">{r.max}</td>
                  <td className="px-3 py-2 text-xs text-zinc-600">{r.desc}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </SectionCard>

      <SectionCard>
        <SectionHeading id="example">Example</SectionHeading>
        <CodeBlock className="mt-3" language="bash" code={`# Page 2, 10 items per page
curl "https://your-domain.com/api/v1/blogs?limit=10&page=2" \\
  -H "Authorization: Bearer pk_live_YOUR_KEY"`} />
      </SectionCard>

      <SectionCard>
        <SectionHeading id="response-meta">Response Meta</SectionHeading>
        <CodeBlock className="mt-3" language="json" code={`{
  "success": true,
  "data": [ /* ... items ... */ ],
  "meta": {
    "page": 2,
    "limit": 10,
    "total": 87,
    "totalPages": 9
  }
}`} />
      </SectionCard>
    </div>
  );
}

// ─── Section: Filtering ───────────────────────────────────────────────────────

function FilteringSection() {
  return (
    <div className="space-y-5">
      <div>
        <h1 className="text-2xl font-bold text-zinc-900">Filtering</h1>
        <p className="mt-2 text-zinc-500 text-sm">Use query parameters to filter results by category, status, date, and more.</p>
      </div>

      <SectionCard>
        <SectionHeading id="common-filters">Common Filters</SectionHeading>
        <div className="mt-3 space-y-2">
          {[
            { param: "category", example: "?category=technology", desc: "Filter by content category" },
            { param: "status",   example: "?status=published",    desc: "Filter by publish status (published, draft)" },
            { param: "tag",      example: "?tag=javascript",      desc: "Filter by tag" },
            { param: "author",   example: "?author=john-doe",     desc: "Filter by author slug" },
          ].map((f) => (
            <div key={f.param} className="rounded-lg border border-zinc-100 bg-zinc-50 p-3">
              <div className="flex items-center gap-2 flex-wrap">
                <code className="text-xs font-mono font-semibold text-violet-700 bg-violet-50 px-1.5 py-0.5 rounded">{f.param}</code>
                <code className="text-xs font-mono text-zinc-500">{f.example}</code>
              </div>
              <p className="text-xs text-zinc-600 mt-1">{f.desc}</p>
            </div>
          ))}
        </div>
      </SectionCard>

      <SectionCard>
        <SectionHeading id="combining-filters">Combining Filters</SectionHeading>
        <CodeBlock className="mt-3" language="bash" code={`curl "https://your-domain.com/api/v1/blogs?category=tech&limit=5&page=1" \\
  -H "Authorization: Bearer pk_live_YOUR_KEY"`} />
        <InfoBox type="info" className="mt-3">Filters are AND'd together. An item must match all filters to appear in results.</InfoBox>
      </SectionCard>
    </div>
  );
}

// ─── Section: Search API ──────────────────────────────────────────────────────

function SearchApiSection() {
  return (
    <div className="space-y-5">
      <div>
        <h1 className="text-2xl font-bold text-zinc-900">Search</h1>
        <p className="mt-2 text-zinc-500 text-sm">Full-text search across all published content in a workspace.</p>
      </div>

      <SectionCard>
        <SectionHeading id="endpoint">Endpoint</SectionHeading>
        <div className="mt-3 flex items-center gap-2 rounded-lg border border-zinc-200 bg-zinc-50 px-3 py-2 font-mono text-sm">
          <MethodBadge method="GET" />
          <span>/api/v1/search?q=your+query</span>
        </div>
      </SectionCard>

      <SectionCard>
        <SectionHeading id="example">Example</SectionHeading>
        <CodeBlock className="mt-3" language="bash" code={`curl "https://your-domain.com/api/v1/search?q=javascript&limit=10" \\
  -H "Authorization: Bearer pk_live_YOUR_KEY"`} />
      </SectionCard>

      <SectionCard>
        <SectionHeading id="response">Response</SectionHeading>
        <CodeBlock className="mt-3" language="json" code={`{
  "success": true,
  "data": [
    {
      "type": "blog",
      "slug": "intro-to-javascript",
      "title": "Introduction to JavaScript",
      "excerpt": "Learn the basics of JavaScript...",
      "score": 0.95
    }
  ],
  "meta": { "page": 1, "limit": 10, "total": 3, "totalPages": 1 }
}`} />
      </SectionCard>
    </div>
  );
}

// ─── Section: Error Codes ─────────────────────────────────────────────────────

function ErrorsSection() {
  return (
    <div className="space-y-5">
      <div>
        <h1 className="text-2xl font-bold text-zinc-900">HTTP Error Codes</h1>
        <p className="mt-2 text-zinc-500 text-sm">All errors follow a consistent JSON structure with a machine-readable error code.</p>
      </div>

      <SectionCard>
        <SectionHeading id="error-format">Error Format</SectionHeading>
        <CodeBlock className="mt-3" language="json" code={`{
  "success": false,
  "error": {
    "code": "INVALID_API_KEY",
    "message": "Invalid or missing API key.",
    "status": 401
  }
}`} />
      </SectionCard>

      {ERROR_DOCS.map((err) => (
        <SectionCard key={err.code}>
          <div className="flex items-center gap-3">
            <StatusBadge label={String(err.code)} color={err.code >= 500 ? "red" : err.code >= 400 ? "amber" : "green"} />
            <SectionHeading id={`error-${err.code}`}>{err.name}</SectionHeading>
          </div>
          <p className="mt-2 text-sm text-zinc-600">{err.description}</p>
          <CodeBlock className="mt-3" language="json" code={JSON.stringify(err.example, null, 2)} />
          <InfoBox type="tip" className="mt-3">
            <strong>Resolution:</strong> {err.resolution}
          </InfoBox>
        </SectionCard>
      ))}
    </div>
  );
}

// ─── Section: Rate Limits ─────────────────────────────────────────────────────

function RateLimitsSection() {
  return (
    <div className="space-y-5">
      <div>
        <h1 className="text-2xl font-bold text-zinc-900">Rate Limits</h1>
        <p className="mt-2 text-zinc-500 text-sm">Rate limits protect the API and ensure fair access for all users.</p>
      </div>

      <SectionCard>
        <SectionHeading id="limits-table">Rate Limit Tiers</SectionHeading>
        <div className="mt-3 overflow-x-auto rounded-lg border border-zinc-200">
          <table className="w-full text-sm">
            <thead><tr className="bg-zinc-50 border-b"><th className="px-3 py-2 text-left text-xs font-semibold text-zinc-500">Key Type</th><th className="px-3 py-2 text-left text-xs font-semibold text-zinc-500">Req / Minute</th><th className="px-3 py-2 text-left text-xs font-semibold text-zinc-500">Req / Day</th></tr></thead>
            <tbody className="divide-y divide-zinc-100">
              {RATE_LIMIT_TIERS.map((t) => (
                <tr key={t.keyType}>
                  <td className="px-3 py-2 text-xs font-medium text-zinc-900 font-mono">{t.keyType}</td>
                  <td className="px-3 py-2 text-xs text-zinc-600">{t.requestsPerMinute}</td>
                  <td className="px-3 py-2 text-xs text-zinc-600">{t.requestsPerDay.toLocaleString()}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </SectionCard>

      <SectionCard>
        <SectionHeading id="rate-limit-headers">Response Headers</SectionHeading>
        <div className="mt-3 space-y-2">
          {[
            { header: "X-RateLimit-Limit",     desc: "Maximum requests allowed in the current window" },
            { header: "X-RateLimit-Remaining", desc: "Requests remaining in the current window" },
            { header: "X-RateLimit-Reset",     desc: "Unix timestamp when the window resets" },
            { header: "Retry-After",            desc: "Seconds to wait before retrying (on 429)" },
          ].map((h) => (
            <div key={h.header} className="rounded-lg border border-zinc-100 bg-zinc-50 p-3 flex items-start gap-3">
              <code className="text-xs font-mono font-medium text-violet-700 shrink-0">{h.header}</code>
              <p className="text-xs text-zinc-600">{h.desc}</p>
            </div>
          ))}
        </div>
      </SectionCard>

      <SectionCard>
        <SectionHeading id="backoff">Exponential Backoff</SectionHeading>
        <CodeBlock className="mt-3" language="javascript" code={`async function fetchWithRetry(url, options, maxRetries = 3) {
  for (let attempt = 0; attempt < maxRetries; attempt++) {
    const res = await fetch(url, options);
    if (res.status !== 429) return res;
    const retryAfter = res.headers.get("Retry-After") ?? 1;
    await new Promise(r => setTimeout(r, retryAfter * 1000 * Math.pow(2, attempt)));
  }
  throw new Error("Max retries exceeded");
}`} />
      </SectionCard>
    </div>
  );
}

// ─── Section: Versioning ──────────────────────────────────────────────────────

function VersioningSection() {
  return (
    <div className="space-y-5">
      <div>
        <h1 className="text-2xl font-bold text-zinc-900">Versioning</h1>
        <p className="mt-2 text-zinc-500 text-sm">The API is versioned to ensure backwards compatibility as new features are added.</p>
      </div>

      <SectionCard>
        <SectionHeading id="version-strategy">Version Strategy</SectionHeading>
        <p className="mt-2 text-sm text-zinc-600">The API version is included in the URL path:</p>
        <div className="mt-3 space-y-2">
          {[
            { url: "/api/v1/blogs", status: "stable",     note: "Current stable version" },
            { url: "/api/v2/blogs", status: "coming-soon", note: "Future version" },
          ].map((v) => (
            <div key={v.url} className="flex items-center gap-3 rounded-lg border border-zinc-100 bg-zinc-50 px-3 py-2">
              <code className="font-mono text-sm text-zinc-900">{v.url}</code>
              <StatusBadge label={v.status} color={v.status === "stable" ? "green" : "zinc"} />
              <span className="text-xs text-zinc-500">{v.note}</span>
            </div>
          ))}
        </div>
      </SectionCard>

      <SectionCard>
        <SectionHeading id="deprecation">Deprecation Policy</SectionHeading>
        <ul className="mt-3 space-y-2 text-sm text-zinc-600">
          <li className="flex items-start gap-2"><ChevronRight className="h-4 w-4 text-violet-400 mt-0.5 shrink-0" />Breaking changes are always introduced in a new major version</li>
          <li className="flex items-start gap-2"><ChevronRight className="h-4 w-4 text-violet-400 mt-0.5 shrink-0" />Deprecated versions are supported for at least 12 months after announcement</li>
          <li className="flex items-start gap-2"><ChevronRight className="h-4 w-4 text-violet-400 mt-0.5 shrink-0" />Deprecation notices are sent via the Changelog and email notifications</li>
        </ul>
      </SectionCard>
    </div>
  );
}

// ─── Section: Code Examples ───────────────────────────────────────────────────

function CodeExamplesSection() {
  const [lang, setLang] = useState<CodeLanguage>("curl");
  const [epIdx, setEpIdx] = useState(0);
  const ep = ENDPOINT_REGISTRY[epIdx];
  const snippet = generateSnippet(ep, lang, "https://your-domain.com/api/v1", "pk_live_YOUR_KEY");
  return (
    <div className="space-y-5">
      <div>
        <h1 className="text-2xl font-bold text-zinc-900">Code Examples</h1>
        <p className="mt-2 text-zinc-500 text-sm">Ready-to-use code snippets in 8 languages for every endpoint.</p>
      </div>

      <SectionCard>
        <SectionHeading id="select-endpoint">Select Endpoint</SectionHeading>
        <select
          value={epIdx}
          onChange={(e) => setEpIdx(Number(e.target.value))}
          className="mt-2 w-full rounded-lg border border-zinc-200 bg-zinc-50 px-3 py-2 text-sm text-zinc-900 focus:outline-none focus:ring-2 focus:ring-violet-500"
        >
          {ENDPOINT_REGISTRY.map((e, i) => (
            <option key={e.id} value={i}>{e.method} {e.path} — {e.title}</option>
          ))}
        </select>
      </SectionCard>

      <SectionCard>
        <SectionHeading id="language">Language</SectionHeading>
        <div className="mt-3 flex gap-1.5 flex-wrap">
          {ALL_LANGUAGES.map((l) => (
            <button
              key={l}
              type="button"
              onClick={() => setLang(l)}
              className={cn(
                "text-xs px-2.5 py-1 rounded-full border font-medium transition-colors",
                lang === l ? "bg-zinc-900 text-white border-zinc-900" : "border-zinc-200 text-zinc-600 hover:border-zinc-400",
              )}
            >
              {LANGUAGE_LABELS[l]}
            </button>
          ))}
        </div>
        <CodeBlock className="mt-3" language={LANGUAGE_LABELS[lang]} code={snippet} />
      </SectionCard>
    </div>
  );
}

// ─── Section: Framework Guides ────────────────────────────────────────────────

function FrameworksSection() {
  const [selected, setSelected] = useState(FRAMEWORK_GUIDES[0].id);
  const guide = FRAMEWORK_GUIDES.find((g) => g.id === selected) ?? FRAMEWORK_GUIDES[0];

  const extraGuides = [
    { id: "vue",       name: "Vue",       icon: "💚", note: "Use Composition API with useFetch from @vueuse/core for automatic caching." },
    { id: "nuxt",      name: "Nuxt",      icon: "🟢", note: "Use useAsyncData in pages. The Nuxt server handles secret key protection." },
    { id: "laravel",   name: "Laravel",   icon: "🔴", note: "Use Http::withHeaders()->get() from the Laravel HTTP client in controllers." },
    { id: "python",    name: "Python",    icon: "🐍", note: "Use the requests or httpx library. Store keys in .env loaded by python-dotenv." },
    { id: "flutter",   name: "Flutter",   icon: "💙", note: "Use the http package or dio. Never hardcode API keys in Flutter apps." },
  ];

  return (
    <div className="space-y-5">
      <div>
        <h1 className="text-2xl font-bold text-zinc-900">Framework Guides</h1>
        <p className="mt-2 text-zinc-500 text-sm">Integration examples for popular frameworks and languages.</p>
      </div>

      <div className="flex gap-2 flex-wrap">
        {FRAMEWORK_GUIDES.map((g) => (
          <button
            key={g.id}
            type="button"
            onClick={() => setSelected(g.id)}
            className={cn(
              "flex items-center gap-1.5 text-sm px-3 py-1.5 rounded-lg border font-medium transition-colors",
              selected === g.id ? "bg-zinc-900 text-white border-zinc-900" : "border-zinc-200 text-zinc-600 hover:border-zinc-400",
            )}
          >
            <span>{g.icon}</span>
            {g.name}
          </button>
        ))}
      </div>

      <SectionCard>
        <SectionHeading id="env-setup">Environment Setup</SectionHeading>
        <CodeBlock className="mt-3" language="bash" code={guide.envSetup} />
      </SectionCard>

      <SectionCard>
        <SectionHeading id="fetch-example">Fetching Content</SectionHeading>
        <CodeBlock className="mt-3" language={guide.name} code={guide.fetchExample} />
        <InfoBox type="tip" className="mt-3">{guide.notes}</InfoBox>
      </SectionCard>

      <SectionCard>
        <SectionHeading id="more-frameworks">More Frameworks</SectionHeading>
        <div className="mt-3 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
          {extraGuides.map((g) => (
            <div key={g.id} className="rounded-lg border border-zinc-100 bg-zinc-50 p-3">
              <div className="flex items-center gap-2 mb-1">
                <span>{g.icon}</span>
                <span className="text-sm font-semibold text-zinc-800">{g.name}</span>
              </div>
              <p className="text-xs text-zinc-500 leading-relaxed">{g.note}</p>
            </div>
          ))}
        </div>
      </SectionCard>
    </div>
  );
}

// ─── Section: AI Prompts ──────────────────────────────────────────────────────

function AiPromptsSection() {
  const platforms = [
    {
      name: "Cursor",    icon: "⌨️",
      prompt: `You are integrating Lunar CMS into a Next.js app.
API Base URL: https://your-domain.com/api/v1
API Key: pk_live_YOUR_KEY (add to .env.local as LUNAR_API_KEY)

Task: Create a complete blog listing page that:
1. Fetches /api/v1/blogs?limit=12 in a Server Component
2. Renders a responsive grid of blog cards
3. Shows title, excerpt, published_at, and cover image
4. Links each card to /blog/[slug]
5. Handles loading and error states
6. Implements pagination using the meta.totalPages from the API response

Each API response has shape: { success: boolean, data: [...], meta: { page, limit, total, totalPages } }`,
    },
    {
      name: "Claude",    icon: "🟠",
      prompt: `I'm building a website powered by Lunar CMS. Help me integrate the REST API.

API Base: https://your-domain.com/api/v1
Auth: Authorization: Bearer pk_live_YOUR_KEY

Available endpoints:
- GET /blogs — list blog posts (supports ?limit=, ?page=, ?category=, ?search=)
- GET /blogs/:slug — single blog post
- GET /faqs — list FAQs
- GET /search?q= — global search

Please create:
1. A TypeScript service class (LunarCmsService) for fetching content
2. React hooks for each content type with SWR or React Query
3. TypeScript interfaces matching the API response shapes
4. Error boundary components for API failures`,
    },
    {
      name: "GPT / Codex", icon: "🟢",
      prompt: `Integrate Lunar CMS REST API into my project.

Base URL: https://your-domain.com/api/v1
API Key env var: LUNAR_API_KEY

Generate a complete data fetching layer:
- Typed API client with all endpoints
- Automatic retry with exponential backoff
- Response caching (stale-while-revalidate)
- Error handling with typed error responses
- Environment-based base URL configuration

API responses always follow: { success: boolean, data: T | T[], error?: { code: string, message: string }, meta?: { page, limit, total, totalPages } }`,
    },
    {
      name: "Bolt / Lovable", icon: "⚡",
      prompt: `Build a complete blog website frontend for a Lunar CMS backend.

API: https://your-domain.com/api/v1
API Key: pk_live_YOUR_KEY

Requirements:
- Home page: latest 6 blog posts in a card grid
- Blog listing page: all posts with search, category filter, pagination
- Blog detail page: full post content, related posts
- Use Tailwind CSS for styling
- Mobile responsive
- SEO-friendly with proper meta tags
- Fast loading with appropriate caching`,
    },
    {
      name: "Replit Agent", icon: "🔄",
      prompt: `Create a Lunar CMS powered blog website.

The Lunar CMS REST API is at: https://your-domain.com/api/v1
API Key (add to Secrets as LUNAR_API_KEY): pk_live_YOUR_KEY

Build with:
- React + Vite frontend
- Express proxy server (to keep API key server-side)
- Tailwind CSS styling
- Pages: Home, Blog List, Blog Detail, Search

API endpoints you'll use:
GET /api/v1/blogs?limit=10&page=1 — list posts
GET /api/v1/blogs/:slug — single post  
GET /api/v1/search?q=term — search`,
    },
    {
      name: "GitHub Copilot", icon: "🐙",
      prompt: `// Lunar CMS Integration
// API Base: https://your-domain.com/api/v1
// Auth: Bearer token from env.LUNAR_API_KEY
//
// Create a complete TypeScript API client with:
// - Typed request/response interfaces
// - Async methods for each endpoint
// - Error handling
// - Pagination helpers
//
// Endpoints:
// GET /blogs — BlogPost[]
// GET /blogs/:slug — BlogPost
// GET /faqs — FAQ[]
// GET /search?q= — SearchResult[]
//
// BlogPost shape:
// { slug, title, excerpt, content, cover_image, category, published_at, author }`,
    },
  ];

  const [selected, setSelected] = useState(0);
  return (
    <div className="space-y-5">
      <div>
        <h1 className="text-2xl font-bold text-zinc-900">AI Implementation Prompts</h1>
        <p className="mt-2 text-zinc-500 text-sm">Ready-to-use prompts for AI coding tools. Paste one into your preferred AI assistant to generate a complete integration.</p>
      </div>

      <div className="flex gap-2 flex-wrap">
        {platforms.map((p, i) => (
          <button
            key={p.name}
            type="button"
            onClick={() => setSelected(i)}
            className={cn(
              "flex items-center gap-1.5 text-sm px-3 py-1.5 rounded-lg border font-medium transition-colors",
              selected === i ? "bg-violet-600 text-white border-violet-600" : "border-zinc-200 text-zinc-600 hover:border-violet-300",
            )}
          >
            <span>{p.icon}</span>
            {p.name}
          </button>
        ))}
      </div>

      <SectionCard>
        <div className="flex items-center justify-between mb-3">
          <SectionHeading id="prompt">{platforms[selected].icon} {platforms[selected].name} Prompt</SectionHeading>
          <button
            type="button"
            onClick={() => {
              navigator.clipboard.writeText(platforms[selected].prompt);
              toast.success("Prompt copied!");
            }}
            className="flex items-center gap-1.5 text-xs font-medium text-violet-600 hover:text-violet-800 transition-colors border border-violet-200 bg-violet-50 rounded-lg px-2.5 py-1"
          >
            <Copy className="h-3.5 w-3.5" /> Copy Prompt
          </button>
        </div>
        <CodeBlock code={platforms[selected].prompt} />
      </SectionCard>

      <InfoBox type="tip">
        Replace <code className="font-mono text-xs bg-emerald-100 px-1 rounded">your-domain.com</code> with your actual deployment URL and <code className="font-mono text-xs bg-emerald-100 px-1 rounded">pk_live_YOUR_KEY</code> with a real API key before using these prompts.
      </InfoBox>
    </div>
  );
}

// ─── Section: FAQ ─────────────────────────────────────────────────────────────

function FaqSection() {
  const [open, setOpen] = useState<number | null>(null);
  const [query, setQuery] = useState("");
  const faqs = [
    { q: "How do I authenticate with the API?",                   a: 'Include your API key in the Authorization header as a Bearer token: `Authorization: Bearer pk_live_YOUR_KEY`. Get your key from the API Keys section of your workspace.' },
    { q: "What is the difference between publishable and secret keys?", a: "Publishable keys (pk_live_) are safe for client-side use and only access published content. Secret keys (sk_live_) are for server-side use, have higher rate limits, and can access draft content." },
    { q: "How do I paginate through results?",                    a: "Add `?limit=20&page=2` to your request. The response meta object contains `total`, `totalPages`, `page`, and `limit` so you can build pagination UI." },
    { q: "Can I filter blog posts by category?",                  a: "Yes. Use `?category=your-category` as a query parameter. Multiple filters can be combined: `?category=tech&limit=10`." },
    { q: "How do I implement full-text search?",                   a: "Use the `/api/v1/search?q=your+query` endpoint. It searches across all published content types and returns scored results." },
    { q: "Is the API key safe to use in client-side JavaScript?", a: "Only publishable keys (pk_live_) are safe in the browser. Secret keys should only be used in server-side code (Node.js, serverless functions, etc.)." },
    { q: "How do I cache API responses?",                         a: "In Next.js use `next: { revalidate: 300 }` for ISR. In other frameworks, use stale-while-revalidate headers or a caching library like SWR or React Query." },
    { q: "What happens when I hit the rate limit?",               a: "The API returns a 429 response with a Retry-After header. Implement exponential backoff and retry after the indicated delay. Upgrade to a higher-tier plan for higher limits." },
    { q: "How do I get a single blog post by its slug?",          a: "Use `GET /api/v1/blogs/:slug` replacing `:slug` with the post's slug value, e.g., `/api/v1/blogs/hello-world`." },
    { q: "Can I use the API to create or update content?",        a: "Write access (POST, PUT, DELETE) is only available via secret keys on specific endpoints. Most public-facing use cases require read-only publishable keys." },
    { q: "How do I handle 404 errors for blog posts?",            a: "Check the `success` field in the response. When false, the `error.code` will be `NOT_FOUND`. Return a custom 404 page in your frontend." },
    { q: "Does the API support CORS?",                            a: "Yes. The API includes CORS headers that allow browser-side requests from any origin when using publishable keys." },
  ];
  const filtered = faqs.filter((f) =>
    !query || f.q.toLowerCase().includes(query.toLowerCase()) || f.a.toLowerCase().includes(query.toLowerCase())
  );
  return (
    <div className="space-y-5">
      <div>
        <h1 className="text-2xl font-bold text-zinc-900">Developer FAQ</h1>
        <p className="mt-2 text-zinc-500 text-sm">Answers to the most common questions.</p>
      </div>

      <div className="relative">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-zinc-400" />
        <input
          type="text"
          placeholder="Search FAQ…"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          className="w-full rounded-xl border border-zinc-200 bg-white pl-9 pr-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-violet-500"
        />
      </div>

      <div className="space-y-2">
        {filtered.map((faq, i) => (
          <SectionCard key={i} className="p-0 overflow-hidden">
            <button
              type="button"
              onClick={() => setOpen(open === i ? null : i)}
              className="flex w-full items-center justify-between px-5 py-4 text-left"
            >
              <span className="text-sm font-medium text-zinc-900">{faq.q}</span>
              <ChevronDown className={cn("h-4 w-4 text-zinc-400 transition-transform shrink-0", open === i && "rotate-180")} />
            </button>
            {open === i && (
              <div className="px-5 pb-4 text-sm text-zinc-600 leading-relaxed border-t border-zinc-100 pt-3">
                {faq.a}
              </div>
            )}
          </SectionCard>
        ))}
        {filtered.length === 0 && (
          <p className="text-center text-sm text-zinc-400 py-8">No results for "{query}"</p>
        )}
      </div>
    </div>
  );
}

// ─── Section: Changelog ───────────────────────────────────────────────────────

function ChangelogSection() {
  const typeColors: Record<string, string> = {
    added:      "bg-emerald-50 text-emerald-700 border border-emerald-200",
    updated:    "bg-blue-50 text-blue-700 border border-blue-200",
    deprecated: "bg-amber-50 text-amber-700 border border-amber-200",
    breaking:   "bg-red-50 text-red-700 border border-red-200",
  };
  return (
    <div className="space-y-5">
      <div>
        <h1 className="text-2xl font-bold text-zinc-900">Changelog</h1>
        <p className="mt-2 text-zinc-500 text-sm">All notable changes to the Lunar CMS REST API.</p>
      </div>
      {CHANGELOG.slice().reverse().map((entry) => (
        <SectionCard key={entry.version}>
          <div className="flex items-center gap-3 mb-3">
            <SectionHeading id={entry.version}>{entry.version}</SectionHeading>
            <StatusBadge label={entry.date} color="zinc" />
          </div>
          <ul className="space-y-2">
            {entry.changes.map((c, i) => (
              <li key={i} className="flex items-start gap-2.5">
                <span className={cn("inline-flex items-center rounded px-1.5 py-0.5 text-[10px] font-semibold shrink-0 mt-0.5", typeColors[c.type])}>
                  {c.type}
                </span>
                <span className="text-sm text-zinc-600">{c.description}</span>
              </li>
            ))}
          </ul>
        </SectionCard>
      ))}
    </div>
  );
}

// ─── Section: SDK (Coming Soon) ───────────────────────────────────────────────

function SdkSection() {
  const sdks = [
    { lang: "JavaScript / TypeScript", icon: "📦", status: "coming-soon", desc: "npm install @lunar-cms/sdk" },
    { lang: "PHP",                     icon: "🐘", status: "coming-soon", desc: "composer require lunar-cms/sdk" },
    { lang: "Python",                  icon: "🐍", status: "coming-soon", desc: "pip install lunar-cms"          },
    { lang: "Flutter / Dart",          icon: "💙", status: "coming-soon", desc: "pub add lunar_cms"              },
    { lang: "Node.js",                 icon: "🟢", status: "coming-soon", desc: "npm install @lunar-cms/node"    },
    { lang: "Ruby",                    icon: "💎", status: "coming-soon", desc: "gem install lunar-cms"          },
  ];
  return (
    <div className="space-y-5">
      <div>
        <h1 className="text-2xl font-bold text-zinc-900">SDKs</h1>
        <p className="mt-2 text-zinc-500 text-sm">Official client libraries are in development. In the meantime, the REST API works great with any HTTP client.</p>
      </div>
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
        {sdks.map((sdk) => (
          <SectionCard key={sdk.lang} className="opacity-75">
            <div className="flex items-center gap-2 mb-2">
              <span className="text-2xl">{sdk.icon}</span>
              <div>
                <p className="text-sm font-semibold text-zinc-800">{sdk.lang}</p>
                <code className="text-[11px] text-zinc-500 font-mono">{sdk.desc}</code>
              </div>
            </div>
            <StatusBadge label="Coming Soon" color="zinc" />
          </SectionCard>
        ))}
      </div>
      <InfoBox type="info">
        Want to be notified when SDKs launch? Star the repository or follow the <strong>Changelog</strong> for updates.
      </InfoBox>
    </div>
  );
}

// ─── Section: Webhooks (Coming Soon) ─────────────────────────────────────────

function WebhooksSection() {
  return (
    <div className="space-y-5">
      <div>
        <div className="flex items-center gap-2 mb-2">
          <h1 className="text-2xl font-bold text-zinc-900">Webhooks</h1>
          <StatusBadge label="Coming Soon" color="amber" />
        </div>
        <p className="mt-2 text-zinc-500 text-sm">Webhooks will let you receive real-time notifications when content changes in Lunar CMS.</p>
      </div>
      <SectionCard>
        <SectionHeading id="planned-events">Planned Events</SectionHeading>
        <div className="mt-3 grid grid-cols-1 sm:grid-cols-2 gap-3">
          {[
            { event: "post.published",   desc: "A blog post was published" },
            { event: "post.updated",     desc: "A blog post was updated"   },
            { event: "post.deleted",     desc: "A blog post was deleted"   },
            { event: "media.uploaded",   desc: "A media file was uploaded" },
            { event: "comment.created",  desc: "A new comment was added"   },
            { event: "workspace.updated", desc: "Workspace settings changed" },
          ].map((e) => (
            <div key={e.event} className="flex items-start gap-2 rounded-lg border border-zinc-100 bg-zinc-50 p-3">
              <code className="text-xs font-mono text-violet-700 shrink-0">{e.event}</code>
              <p className="text-xs text-zinc-500">{e.desc}</p>
            </div>
          ))}
        </div>
      </SectionCard>
      <SectionCard>
        <SectionHeading id="planned-payload">Planned Payload Shape</SectionHeading>
        <CodeBlock className="mt-3" language="json" code={`{
  "event": "post.published",
  "timestamp": "2025-06-01T10:30:00Z",
  "workspace_id": "ws_xxx",
  "data": {
    "slug": "new-post",
    "title": "New Post Title"
  }
}`} />
      </SectionCard>
    </div>
  );
}

// ─── Top Nav ──────────────────────────────────────────────────────────────────

function DocTopNav({
  onToggleSidebar,
  sidebarCollapsed,
  query,
  onSearch,
  searchResults,
  onSelectResult,
}: {
  onToggleSidebar: () => void;
  sidebarCollapsed: boolean;
  query: string;
  onSearch: (q: string) => void;
  searchResults: ReturnType<typeof searchDocs>;
  onSelectResult: (section: string, endpointId?: string) => void;
}) {
  const [focused, setFocused] = useState(false);
  return (
    <header className="fixed top-0 left-0 right-0 z-40 flex h-14 items-center gap-3 border-b border-zinc-200 bg-white px-4">
      <button
        type="button"
        onClick={onToggleSidebar}
        className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg border border-zinc-200 text-zinc-500 hover:bg-zinc-50 transition-colors"
      >
        {sidebarCollapsed ? <Menu className="h-4 w-4" /> : <X className="h-4 w-4" />}
      </button>

      <Link to="/admin/dashboard" className="flex items-center gap-2 text-sm text-zinc-500 hover:text-zinc-900 transition-colors shrink-0">
        <ArrowLeft className="h-3.5 w-3.5" />
        <span className="hidden sm:inline">Dashboard</span>
      </Link>

      <div className="mx-2 h-4 w-px bg-zinc-200 shrink-0" />

      <div className="flex items-center gap-2 shrink-0">
        <div className="flex h-7 w-7 items-center justify-center rounded-full bg-violet-600 text-white text-[11px] font-bold">
          L
        </div>
        <span className="font-semibold text-sm text-zinc-900 hidden sm:inline">Lunar CMS</span>
        <span className="text-zinc-400 text-sm hidden sm:inline">/</span>
        <span className="text-sm text-zinc-600 hidden sm:inline">Docs</span>
      </div>

      <div className="flex-1 max-w-md mx-auto relative">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-zinc-400 pointer-events-none" />
        <input
          type="text"
          placeholder="Search docs…"
          value={query}
          onChange={(e) => onSearch(e.target.value)}
          onFocus={() => setFocused(true)}
          onBlur={() => setTimeout(() => setFocused(false), 200)}
          className="w-full rounded-lg border border-zinc-200 bg-zinc-50 pl-9 pr-4 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-violet-500 focus:border-violet-300"
        />
        {focused && query && searchResults.length > 0 && (
          <div className="absolute top-full left-0 right-0 mt-1 rounded-xl border border-zinc-200 bg-white shadow-lg z-50 max-h-64 overflow-y-auto">
            {searchResults.slice(0, 8).map((r) => (
              <button
                key={r.id}
                type="button"
                onMouseDown={() => {
                  onSelectResult(r.section, r.endpointId);
                  onSearch("");
                }}
                className="flex w-full items-start gap-2 px-3 py-2 text-left hover:bg-zinc-50 transition-colors border-b border-zinc-50 last:border-0"
              >
                <span className="text-[10px] bg-zinc-100 text-zinc-600 rounded px-1 py-0.5 shrink-0 mt-0.5 font-medium">{r.section}</span>
                <div>
                  <p className="text-xs font-medium text-zinc-900">{r.title}</p>
                  {r.description && <p className="text-[11px] text-zinc-500 mt-0.5 line-clamp-1">{r.description}</p>}
                </div>
              </button>
            ))}
          </div>
        )}
        {focused && query && searchResults.length === 0 && (
          <div className="absolute top-full left-0 right-0 mt-1 rounded-xl border border-zinc-200 bg-white shadow-lg z-50 px-3 py-4 text-center text-xs text-zinc-400">
            No results for "{query}"
          </div>
        )}
      </div>

      <div className="flex items-center gap-2 ml-auto shrink-0">
        <StatusBadge label="v1 · Stable" color="green" />
        <Link
          to="/admin/api-explorer"
          className="hidden sm:flex items-center gap-1.5 text-xs font-medium text-violet-600 hover:text-violet-800 border border-violet-200 bg-violet-50 rounded-lg px-2.5 py-1.5 transition-colors"
        >
          <Terminal className="h-3.5 w-3.5" /> API Explorer
          <ExternalLink className="h-3 w-3" />
        </Link>
      </div>
    </header>
  );
}

// ─── TOC per section ──────────────────────────────────────────────────────────

const SECTION_TOC: Record<string, TocEntry[]> = {
  introduction:   [{ id: "what-is-lunar", label: "What is Lunar CMS?" }, { id: "base-url", label: "Base URL" }, { id: "next-steps", label: "Next Steps" }],
  authentication: [{ id: "bearer-token", label: "Bearer Token" }, { id: "key-types", label: "Key Types" }, { id: "auth-errors", label: "Auth Errors" }, { id: "security", label: "Security" }],
  "api-keys":     [{ id: "creating-keys", label: "Creating Keys" }, { id: "key-lifecycle", label: "Lifecycle" }, { id: "env-vars", label: "Env Variables" }],
  "first-request":[{ id: "endpoint", label: "Endpoint" }, { id: "code-example", label: "Code Example" }, { id: "response", label: "Response" }],
  endpoints:      [],
  pagination:     [{ id: "parameters", label: "Parameters" }, { id: "example", label: "Example" }, { id: "response-meta", label: "Response Meta" }],
  filtering:      [{ id: "common-filters", label: "Common Filters" }, { id: "combining-filters", label: "Combining Filters" }],
  "search-api":   [{ id: "endpoint", label: "Endpoint" }, { id: "example", label: "Example" }, { id: "response", label: "Response" }],
  errors:         [{ id: "error-format", label: "Error Format" }, ...ERROR_DOCS.map((e) => ({ id: `error-${e.code}`, label: `${e.code} ${e.name}` }))],
  "rate-limits":  [{ id: "limits-table", label: "Rate Limits" }, { id: "rate-limit-headers", label: "Headers" }, { id: "backoff", label: "Exponential Backoff" }],
  versioning:     [{ id: "version-strategy", label: "Version Strategy" }, { id: "deprecation", label: "Deprecation" }],
  "code-examples":[{ id: "select-endpoint", label: "Select Endpoint" }, { id: "language", label: "Language" }],
  frameworks:     [{ id: "env-setup", label: "Env Setup" }, { id: "fetch-example", label: "Fetch Content" }, { id: "more-frameworks", label: "More Frameworks" }],
  "ai-prompts":   [{ id: "prompt", label: "Prompt" }],
  faq:            [],
  changelog:      CHANGELOG.slice().reverse().map((e) => ({ id: e.version, label: e.version })),
  sdk:            [],
  webhooks:       [{ id: "planned-events", label: "Planned Events" }, { id: "planned-payload", label: "Payload Shape" }],
};

// ─── Main Portal ──────────────────────────────────────────────────────────────

function DevDocsPortal() {
  const navigate = useNavigate();
  const { section, endpointId, q: initialQ } = Route.useSearch();
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);
  const [searchQuery, setSearchQuery] = useState(initialQ ?? "");
  const [activeHeading, setActiveHeading] = useState("");

  const searchResults = useMemo(
    () => (searchQuery.trim().length > 1 ? searchDocs(searchQuery) : []),
    [searchQuery],
  );

  const onNavigate = useCallback(
    (s: string, epId?: string) => {
      navigate({ to: "/admin/docs", search: { section: s, endpointId: epId } });
      window.scrollTo({ top: 0, behavior: "smooth" });
    },
    [navigate],
  );

  const tocEntries = useMemo(() => {
    if (endpointId) return [
      { id: "request-url", label: "Request URL" },
      { id: "parameters", label: "Parameters" },
      { id: "code-examples", label: "Code Examples" },
      { id: "response", label: "Response" },
    ];
    return SECTION_TOC[section] ?? [];
  }, [section, endpointId]);

  // Observe headings for TOC highlighting
  useEffect(() => {
    const observer = new IntersectionObserver(
      (entries) => {
        const visible = entries.filter((e) => e.isIntersecting);
        if (visible.length > 0) setActiveHeading(visible[0].target.id);
      },
      { rootMargin: "-20% 0px -70% 0px" },
    );
    const headings = document.querySelectorAll("[id]");
    headings.forEach((h) => observer.observe(h));
    return () => observer.disconnect();
  }, [section, endpointId]);

  function renderSection() {
    switch (section) {
      case "introduction":   return <IntroductionSection onNavigate={onNavigate} />;
      case "quick-start":    return <QuickStartSection />;
      case "authentication": return <AuthenticationSection />;
      case "api-keys":       return <ApiKeysSection />;
      case "first-request":  return <FirstRequestSection />;
      case "endpoints":      return <EndpointsSection endpointId={endpointId} onSelectEndpoint={(id) => onNavigate("endpoints", id || undefined)} />;
      case "pagination":     return <PaginationSection />;
      case "filtering":      return <FilteringSection />;
      case "search-api":     return <SearchApiSection />;
      case "errors":         return <ErrorsSection />;
      case "rate-limits":    return <RateLimitsSection />;
      case "versioning":     return <VersioningSection />;
      case "code-examples":  return <CodeExamplesSection />;
      case "frameworks":     return <FrameworksSection />;
      case "ai-prompts":     return <AiPromptsSection />;
      case "faq":            return <FaqSection />;
      case "changelog":      return <ChangelogSection />;
      case "sdk":            return <SdkSection />;
      case "webhooks":       return <WebhooksSection />;
      default:               return <IntroductionSection onNavigate={onNavigate} />;
    }
  }

  return (
    <div className="min-h-screen bg-zinc-50">
      <DocTopNav
        onToggleSidebar={() => setSidebarCollapsed((p) => !p)}
        sidebarCollapsed={sidebarCollapsed}
        query={searchQuery}
        onSearch={setSearchQuery}
        searchResults={searchResults}
        onSelectResult={onNavigate}
      />

      <DocSidebar
        section={section}
        endpointId={endpointId}
        onNavigate={onNavigate}
        collapsed={sidebarCollapsed}
        onToggle={() => setSidebarCollapsed((p) => !p)}
      />

      <div
        className={cn(
          "pt-14 transition-all duration-200",
          sidebarCollapsed ? "pl-0" : "pl-60",
        )}
      >
        <div className="mx-auto max-w-5xl px-6 py-8 flex gap-8">
          <main className="flex-1 min-w-0">
            {renderSection()}
          </main>
          <DocTOC entries={tocEntries} activeId={activeHeading} />
        </div>
      </div>
    </div>
  );
}
