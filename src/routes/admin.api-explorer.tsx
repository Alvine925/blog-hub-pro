import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import { toast } from "sonner";
import { Copy, Play, Loader2, ChevronDown, ChevronUp } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";

export const Route = createFileRoute("/admin/api-explorer")({
  head: () => ({ meta: [{ title: "API Explorer — Admin" }] }),
  component: ApiExplorerPage,
});

const BASE_URL = typeof window !== "undefined" ? window.location.origin : "";

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
      return `curl -X ${method} "${url}" \\
  -H "Content-Type: application/json"`;
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
  const base = BASE_URL;
  if (path.includes(":slug")) {
    const slug = params["slug"] || "my-post-slug";
    return `${base}${path.replace(":slug", slug)}`;
  }
  const qs = new URLSearchParams();
  for (const [k, v] of Object.entries(params)) {
    if (v) qs.set(k, v);
  }
  const qstr = qs.toString();
  return `${base}${path}${qstr ? "?" + qstr : ""}`;
}

function EndpointCard({ ep }: { ep: (typeof ENDPOINTS)[0] }) {
  const [open, setOpen] = useState(false);
  const [lang, setLang] = useState<Lang>("javascript");
  const [params, setParams] = useState<Record<string, string>>(
    Object.fromEntries(ep.params.map((p) => [p.name, p.default])),
  );
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<string | null>(null);

  const url = buildUrl(ep.path, params);
  const snippet = codeSnippet(lang, ep.method, url);

  function copySnippet() {
    navigator.clipboard.writeText(snippet);
    toast.success("Copied to clipboard");
  }

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
    <div className="border-b border-border last:border-0 py-5">
      <button
        className="flex w-full items-center justify-between text-left"
        onClick={() => setOpen((o) => !o)}
      >
        <div className="flex items-center gap-3">
          <Badge className="bg-green-100 text-green-700 hover:bg-green-100 font-mono text-xs">
            {ep.method}
          </Badge>
          <code className="text-sm font-mono text-foreground">{ep.path}</code>
          <span className="text-sm text-muted-foreground">{ep.label}</span>
        </div>
        {open ? (
          <ChevronUp className="h-4 w-4 text-muted-foreground" />
        ) : (
          <ChevronDown className="h-4 w-4 text-muted-foreground" />
        )}
      </button>

      {open && (
        <div className="mt-5 space-y-5">
          <p className="text-sm text-muted-foreground">{ep.description}</p>

          {/* Parameters */}
          <div className="space-y-3">
            <h4 className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
              Parameters
            </h4>
            <div className="space-y-2">
              {ep.params.map((p) => (
                <div key={p.name} className="grid grid-cols-3 items-center gap-4">
                  <div>
                    <code className="text-xs font-mono text-foreground">{p.name}</code>
                    <p className="text-xs text-muted-foreground mt-0.5">{p.description}</p>
                  </div>
                  <div className="col-span-2">
                    <Input
                      value={params[p.name] ?? ""}
                      onChange={(e) =>
                        setParams((prev) => ({ ...prev, [p.name]: e.target.value }))
                      }
                      placeholder={p.default || "—"}
                      className="h-8 text-xs font-mono"
                    />
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Code snippet */}
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <div className="flex gap-1">
                {(["javascript", "curl", "python"] as Lang[]).map((l) => (
                  <button
                    key={l}
                    onClick={() => setLang(l)}
                    className={`rounded px-2 py-1 text-xs font-medium transition-colors ${
                      lang === l
                        ? "bg-primary text-primary-foreground"
                        : "text-muted-foreground hover:text-foreground"
                    }`}
                  >
                    {l === "javascript" ? "JavaScript" : l === "curl" ? "cURL" : "Python"}
                  </button>
                ))}
              </div>
              <Button size="sm" variant="ghost" className="h-7 gap-1 text-xs" onClick={copySnippet}>
                <Copy className="h-3 w-3" /> Copy
              </Button>
            </div>
            <pre className="overflow-x-auto rounded-lg bg-slate-950 p-4 text-xs text-slate-100">
              <code>{snippet}</code>
            </pre>
          </div>

          {/* Try it */}
          <div className="space-y-3">
            <div className="flex items-center gap-3">
              <code className="flex-1 rounded border border-border bg-muted px-3 py-1.5 text-xs font-mono text-muted-foreground truncate">
                {url}
              </code>
              <Button size="sm" onClick={run} disabled={loading} className="gap-1.5">
                {loading ? (
                  <Loader2 className="h-3 w-3 animate-spin" />
                ) : (
                  <Play className="h-3 w-3" />
                )}
                Run
              </Button>
            </div>
            {result !== null && (
              <pre className="max-h-72 overflow-auto rounded-lg border border-border bg-muted p-4 text-xs font-mono">
                {result}
              </pre>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

function ApiExplorerPage() {
  function copyBaseUrl() {
    navigator.clipboard.writeText(BASE_URL);
    toast.success("Base URL copied");
  }

  return (
    <div className="space-y-10 max-w-3xl">
      <div>
        <h1 className="text-2xl font-bold">API Explorer</h1>
        <p className="text-sm text-muted-foreground">
          Test and explore the Lunar CMS REST API
        </p>
      </div>

      <div className="space-y-2">
        <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
          Base URL
        </p>
        <div className="flex items-center gap-3">
          <code className="flex-1 rounded border border-border bg-muted px-3 py-2 text-sm font-mono">
            {BASE_URL}
          </code>
          <Button variant="outline" size="sm" onClick={copyBaseUrl}>
            <Copy className="h-4 w-4" />
          </Button>
        </div>
        <p className="text-xs text-muted-foreground">
          All endpoints are publicly accessible — no authentication required for read operations.
        </p>
      </div>

      <div className="border-t border-border" />

      <div className="space-y-1">
        <h2 className="text-sm font-semibold uppercase tracking-wide text-muted-foreground mb-4">
          Endpoints
        </h2>
        {ENDPOINTS.map((ep) => (
          <EndpointCard key={ep.id} ep={ep} />
        ))}
      </div>

      <div className="border-t border-border" />

      <div className="space-y-3">
        <h2 className="text-sm font-semibold uppercase tracking-wide text-muted-foreground">
          Response Format
        </h2>
        <pre className="overflow-x-auto rounded-lg bg-slate-950 p-4 text-xs text-slate-100">
          <code>{`// GET /api/v1/posts
{
  "data": [ { "id": "...", "title": "...", "slug": "...", ... } ],
  "meta": { "total": 42, "limit": 20, "offset": 0 }
}

// GET /api/v1/posts/:slug
{
  "data": { "id": "...", "title": "...", "content": "...", ... }
}

// Error response
{
  "error": "Post not found"
}`}</code>
        </pre>
      </div>
    </div>
  );
}
