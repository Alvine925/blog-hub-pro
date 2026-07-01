import { createFileRoute } from "@tanstack/react-router";
import { useState, useEffect } from "react";
import { toast } from "sonner";
import { Copy, Play, Loader2, ChevronDown, ChevronUp, ExternalLink } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";

export const Route = createFileRoute("/admin/api-explorer")({
  head: () => ({ meta: [{ title: "API Explorer — Admin" }] }),
  component: ApiExplorerPage,
});

const SUPABASE_URL = (import.meta.env.VITE_SUPABASE_URL as string | undefined) ?? "https://your-project.supabase.co";

type Lang = "curl" | "javascript" | "python";

const ENDPOINTS = [
  {
    id: "list-posts",
    method: "GET",
    path: "/api/v1/posts",
    label: "List Published Posts",
    description: "Returns paginated published blog posts. Supports search, category, and featured filters.",
    params: [
      { name: "limit", default: "20", description: "Max results (1–100)" },
      { name: "offset", default: "0", description: "Pagination offset" },
      { name: "search", default: "", description: "Full-text search query" },
      { name: "category", default: "", description: "Filter by category name" },
      { name: "featured", default: "", description: "\"true\" to show only featured posts" },
    ],
  },
  {
    id: "get-post",
    method: "GET",
    path: "/api/v1/posts/:slug",
    label: "Get Post by Slug",
    description: "Returns a single published blog post by its slug. Also increments the view counter.",
    params: [
      { name: "slug", default: "my-post-slug", description: "The post's URL slug" },
    ],
  },
];

function codeSnippet(lang: Lang, method: string, url: string): string {
  switch (lang) {
    case "curl":
      return `curl -X ${method} "${url}" \\\n  -H "Content-Type: application/json"`;
    case "javascript":
      return `const res = await fetch("${url}", {
  method: "${method}",
  headers: { "Content-Type": "application/json" },
});
const data = await res.json();
console.log(data);`;
    case "python":
      return `import requests

res = requests.${method.toLowerCase()}("${url}")
data = res.json()
print(data)`;
  }
}

function buildUrl(path: string, params: Record<string, string>): string {
  if (path.includes(":slug")) {
    const slug = params["slug"] || "my-post-slug";
    return `${BASE_URL}${path.replace(":slug", slug)}`;
  }
  const qs = new URLSearchParams();
  for (const [k, v] of Object.entries(params)) {
    if (v) qs.set(k, v);
  }
  const qstr = qs.toString();
  return `${BASE_URL}${path}${qstr ? "?" + qstr : ""}`;
}

function CopyBtn({ text, label = "Copy" }: { text: string; label?: string }) {
  return (
    <Button size="sm" variant="ghost" className="h-7 gap-1 text-xs" onClick={() => { navigator.clipboard.writeText(text); toast.success("Copied"); }}>
      <Copy className="h-3 w-3" /> {label}
    </Button>
  );
}

function EndpointRow({ ep }: { ep: (typeof ENDPOINTS)[0] }) {
  const [open, setOpen] = useState(false);
  const [lang, setLang] = useState<Lang>("javascript");
  const [params, setParams] = useState<Record<string, string>>(
    Object.fromEntries(ep.params.map((p) => [p.name, p.default])),
  );
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<string | null>(null);

  const url = buildUrl(ep.path, params);
  const snippet = codeSnippet(lang, ep.method, url);

  async function run() {
    setLoading(true);
    setResult(null);
    try {
      const res = await fetch(url);
      const json = await res.json();
      setResult(JSON.stringify(json, null, 2));
    } catch (err) {
      setResult(`Error: ${String(err)}`);
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="border-b border-border last:border-0 py-4">
      <button className="flex w-full items-center justify-between text-left" onClick={() => setOpen((o) => !o)}>
        <div className="flex items-center gap-3">
          <Badge className="bg-primary text-primary-foreground font-mono text-xs shrink-0">{ep.method}</Badge>
          <code className="text-sm font-mono">{ep.path}</code>
          <span className="text-sm text-muted-foreground hidden sm:block">{ep.label}</span>
        </div>
        {open ? <ChevronUp className="h-4 w-4 text-muted-foreground shrink-0" /> : <ChevronDown className="h-4 w-4 text-muted-foreground shrink-0" />}
      </button>

      {open && (
        <div className="mt-5 space-y-5">
          <p className="text-sm text-muted-foreground">{ep.description}</p>

          <div className="space-y-3">
            <h4 className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Parameters</h4>
            {ep.params.map((p) => (
              <div key={p.name} className="grid grid-cols-3 items-center gap-4">
                <div>
                  <code className="text-xs font-mono">{p.name}</code>
                  <p className="text-xs text-muted-foreground mt-0.5">{p.description}</p>
                </div>
                <div className="col-span-2">
                  <Input value={params[p.name] ?? ""} onChange={(e) => setParams((prev) => ({ ...prev, [p.name]: e.target.value }))} placeholder={p.default || "—"} className="h-8 text-xs font-mono" />
                </div>
              </div>
            ))}
          </div>

          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <div className="flex gap-1">
                {(["javascript", "curl", "python"] as Lang[]).map((l) => (
                  <button key={l} onClick={() => setLang(l)} className={`rounded px-2 py-1 text-xs font-medium transition-colors ${lang === l ? "bg-primary text-primary-foreground" : "text-muted-foreground hover:text-foreground"}`}>
                    {l === "javascript" ? "JS" : l === "curl" ? "cURL" : "Python"}
                  </button>
                ))}
              </div>
              <CopyBtn text={snippet} />
            </div>
            <pre className="overflow-x-auto rounded border border-border bg-slate-950 p-4 text-xs text-slate-100"><code>{snippet}</code></pre>
          </div>

          <div className="space-y-3">
            <div className="flex items-center gap-3">
              <code className="flex-1 rounded border border-border bg-muted px-3 py-1.5 text-xs font-mono truncate">{url}</code>
              <Button size="sm" onClick={run} disabled={loading} className="gap-1.5">
                {loading ? <Loader2 className="h-3 w-3 animate-spin" /> : <Play className="h-3 w-3" />} Run
              </Button>
            </div>
            {result !== null && (
              <pre className="max-h-72 overflow-auto rounded border border-border bg-muted p-4 text-xs font-mono">{result}</pre>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

const GRAPHQL_QUERY = `# Supabase exposes GraphQL automatically via pg_graphql
# Endpoint: ${SUPABASE_URL}/graphql/v1

query GetPublishedPosts {
  blog_postsCollection(
    filter: { status: { eq: "published" } }
    orderBy: [{ published_at: DescNullsLast }]
    first: 10
  ) {
    edges {
      node {
        id
        title
        slug
        excerpt
        category
        views
        published_at
      }
    }
  }
}

# Send with headers:
# apikey: YOUR_SUPABASE_ANON_KEY
# Content-Type: application/json`;

const SDK_SAMPLES: Record<string, string> = {
  JavaScript: `import { createClient } from "@supabase/supabase-js";

const supabase = createClient(
  "${SUPABASE_URL}",
  "YOUR_ANON_KEY"
);

// List published posts
const { data, error } = await supabase
  .from("blog_posts")
  .select("id, title, slug, excerpt, category, published_at, views")
  .eq("status", "published")
  .order("published_at", { ascending: false })
  .limit(10);

// Single post
const { data: post } = await supabase
  .from("blog_posts")
  .select("*")
  .eq("slug", "my-post")
  .eq("status", "published")
  .single();`,

  Python: `from supabase import create_client

supabase = create_client(
    "${SUPABASE_URL}",
    "YOUR_ANON_KEY"
)

# List published posts
response = (
    supabase.table("blog_posts")
    .select("id,title,slug,excerpt,category,published_at,views")
    .eq("status", "published")
    .order("published_at", desc=True)
    .limit(10)
    .execute()
)
print(response.data)`,

  curl: `# List published posts
curl "${SUPABASE_URL}/rest/v1/blog_posts?status=eq.published&select=id,title,slug,excerpt,category,published_at,views&order=published_at.desc&limit=10" \\
  -H "apikey: YOUR_ANON_KEY" \\
  -H "Authorization: Bearer YOUR_ANON_KEY"

# Single post by slug
curl "${SUPABASE_URL}/rest/v1/blog_posts?slug=eq.my-post&status=eq.published&select=*" \\
  -H "apikey: YOUR_ANON_KEY" \\
  -H "Authorization: Bearer YOUR_ANON_KEY"`,
};

function ApiExplorerPage() {
  const [tab, setTab] = useState<"rest" | "graphql" | "sdks">("rest");
  const [sdkLang, setSdkLang] = useState("JavaScript");

  return (
    <div className="max-w-3xl space-y-8">
      <div>
        <h1 className="text-2xl font-bold">API Explorer</h1>
        <p className="text-sm text-muted-foreground">
          Interactive REST playground, GraphQL schema, and SDK samples for every language.
        </p>
      </div>

      <div className="flex gap-1 border-b border-border">
        {(["rest", "graphql", "sdks"] as const).map((t) => (
          <button
            key={t}
            type="button"
            onClick={() => setTab(t)}
            className={`px-4 py-2 text-sm font-medium border-b-2 transition-colors ${tab === t ? "border-primary text-foreground" : "border-transparent text-muted-foreground hover:text-foreground"}`}
          >
            {t === "rest" ? "REST" : t === "graphql" ? "GraphQL" : "SDKs"}
          </button>
        ))}
      </div>

      {tab === "rest" && (
        <div className="space-y-6">
          <div className="space-y-1">
            <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Base URL</p>
            <div className="flex items-center gap-3">
              <code className="flex-1 rounded border border-border bg-muted px-3 py-2 text-sm font-mono">{BASE_URL}</code>
              <CopyBtn text={BASE_URL} />
            </div>
            <p className="text-xs text-muted-foreground">No authentication required for published content.</p>
          </div>

          <div className="border-t border-border">
            {ENDPOINTS.map((ep) => <EndpointRow key={ep.id} ep={ep} />)}
          </div>

          <div className="border-t border-border pt-6 space-y-3">
            <h2 className="text-sm font-semibold uppercase tracking-wide text-muted-foreground">Response Shape</h2>
            <pre className="overflow-x-auto rounded border border-border bg-slate-950 p-4 text-xs text-slate-100">
{`// GET /api/v1/posts
{ "data": [...], "meta": { "total": 42, "limit": 20, "offset": 0 } }

// GET /api/v1/posts/:slug
{ "data": { "id": "...", "title": "...", "content": "..." } }

// Error
{ "error": "Post not found" }`}
            </pre>
          </div>
        </div>
      )}

      {tab === "graphql" && (
        <div className="space-y-6">
          <div className="space-y-2">
            <p className="text-sm">
              Supabase exposes a full GraphQL API via <strong>pg_graphql</strong>. Every table is automatically queryable — zero configuration.
            </p>
            <div className="flex flex-wrap items-center gap-3">
              <code className="rounded bg-muted px-2 py-1 text-xs font-mono break-all">{SUPABASE_URL}/graphql/v1</code>
              <Button size="sm" variant="outline" asChild>
                <a href={`${SUPABASE_URL}/project/default/api/graphiql`} target="_blank" rel="noopener noreferrer">
                  Open GraphiQL <ExternalLink className="ml-1.5 h-3 w-3" />
                </a>
              </Button>
            </div>
          </div>

          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Example Query</p>
              <CopyBtn text={GRAPHQL_QUERY} />
            </div>
            <pre className="overflow-x-auto rounded border border-border bg-slate-950 px-4 py-4 text-xs font-mono text-slate-100 leading-relaxed">{GRAPHQL_QUERY}</pre>
          </div>

          <div className="border-t border-border pt-5">
            <p className="text-sm font-semibold mb-3">Required headers</p>
            <table className="w-full text-xs">
              <thead><tr className="border-b border-border"><th className="py-2 pr-8 text-left font-semibold text-muted-foreground">Header</th><th className="py-2 text-left font-semibold text-muted-foreground">Value</th></tr></thead>
              <tbody>
                <tr className="border-b border-border/50"><td className="py-2 pr-8 font-mono">apikey</td><td className="py-2 text-muted-foreground">Your Supabase anon key</td></tr>
                <tr><td className="py-2 pr-8 font-mono">Content-Type</td><td className="py-2 text-muted-foreground">application/json</td></tr>
              </tbody>
            </table>
          </div>
        </div>
      )}

      {tab === "sdks" && (
        <div className="space-y-5">
          <div className="flex gap-1">
            {Object.keys(SDK_SAMPLES).map((lang) => (
              <button key={lang} type="button" onClick={() => setSdkLang(lang)}
                className={`rounded px-3 py-1.5 text-sm font-medium transition-colors ${sdkLang === lang ? "bg-primary text-primary-foreground" : "bg-muted text-muted-foreground hover:text-foreground"}`}>
                {lang}
              </button>
            ))}
          </div>
          <div className="relative">
            <pre className="overflow-x-auto rounded border border-border bg-slate-950 px-4 py-4 text-xs font-mono text-slate-100 leading-relaxed pr-12">
              {SDK_SAMPLES[sdkLang]}
            </pre>
            <button type="button" onClick={() => { navigator.clipboard.writeText(SDK_SAMPLES[sdkLang]); toast.success("Copied"); }} className="absolute right-3 top-3 text-slate-400 hover:text-slate-100">
              <Copy className="h-3.5 w-3.5" />
            </button>
          </div>
          <div className="border-t border-border pt-4 space-y-2">
            <p className="text-sm font-semibold">Install</p>
            {sdkLang === "JavaScript" && <pre className="rounded border border-border bg-slate-950 px-4 py-3 text-xs font-mono text-slate-100">npm install @supabase/supabase-js</pre>}
            {sdkLang === "Python" && <pre className="rounded border border-border bg-slate-950 px-4 py-3 text-xs font-mono text-slate-100">pip install supabase</pre>}
            {sdkLang === "curl" && <p className="text-xs text-muted-foreground">curl ships pre-installed on macOS and Linux. On Windows, use WSL or download from curl.se.</p>}
          </div>
        </div>
      )}
    </div>
  );
}
