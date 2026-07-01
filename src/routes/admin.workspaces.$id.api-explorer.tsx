import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import { Copy, Check, Code2 } from "lucide-react";
import { cn } from "@/lib/utils";
import { toast } from "sonner";

export const Route = createFileRoute("/admin/workspaces/$id/api-explorer")({
  head: () => ({ meta: [{ title: "API Explorer" }] }),
  component: WorkspaceApiExplorer,
});

const BASE_URL = typeof window !== "undefined"
  ? `${window.location.origin}/api`
  : "https://your-domain.com/api";

type Lang = "curl" | "js" | "python" | "go";

const ENDPOINTS = [
  {
    method: "GET",
    path: "/posts",
    description: "List all published blog posts",
    params: "?page=1&limit=10",
    response: `{
  "posts": [
    {
      "id": "...",
      "title": "My First Post",
      "slug": "my-first-post",
      "status": "published",
      "views": 1234,
      "created_at": "2024-01-01T00:00:00Z"
    }
  ],
  "total": 42,
  "page": 1,
  "limit": 10
}`,
  },
  {
    method: "GET",
    path: "/posts/:slug",
    description: "Get a single post by slug",
    params: "",
    response: `{
  "id": "...",
  "title": "My First Post",
  "slug": "my-first-post",
  "content": "<p>...</p>",
  "excerpt": "...",
  "cover_image_url": "...",
  "status": "published",
  "views": 1234,
  "tags": ["tech", "tutorial"],
  "created_at": "2024-01-01T00:00:00Z",
  "updated_at": "2024-01-01T00:00:00Z"
}`,
  },
  {
    method: "GET",
    path: "/collections",
    description: "List all collections (content types)",
    params: "",
    response: `{
  "collections": [
    {
      "id": "...",
      "name": "Products",
      "slug": "products",
      "schema": [...]
    }
  ]
}`,
  },
  {
    method: "GET",
    path: "/collections/:slug/entries",
    description: "List entries in a collection",
    params: "?status=published",
    response: `{
  "entries": [
    {
      "id": "...",
      "data": { ... },
      "status": "published",
      "created_at": "..."
    }
  ]
}`,
  },
];

function getSnippet(endpoint: typeof ENDPOINTS[0], lang: Lang, apiKey: string): string {
  const url = `${BASE_URL}${endpoint.path}${endpoint.params}`;
  const auth = `Authorization: Bearer ${apiKey || "YOUR_API_KEY"}`;

  switch (lang) {
    case "curl":
      return `curl -X ${endpoint.method} \\
  "${url}" \\
  -H "${auth}" \\
  -H "Content-Type: application/json"`;

    case "js":
      return `const res = await fetch("${url}", {
  method: "${endpoint.method}",
  headers: {
    "${auth.split(": ")[0]}": "${auth.split(": ").slice(1).join(": ")}",
    "Content-Type": "application/json",
  },
});
const data = await res.json();
console.log(data);`;

    case "python":
      return `import requests

response = requests.${endpoint.method.toLowerCase()}(
    "${url}",
    headers={
        "${auth.split(": ")[0]}": "${auth.split(": ").slice(1).join(": ")}",
        "Content-Type": "application/json",
    },
)
data = response.json()
print(data)`;

    case "go":
      return `package main

import (
    "fmt"
    "net/http"
    "io"
)

func main() {
    req, _ := http.NewRequest("${endpoint.method}", "${url}", nil)
    req.Header.Set("${auth.split(": ")[0]}", "${auth.split(": ").slice(1).join(": ")}")
    req.Header.Set("Content-Type", "application/json")

    client := &http.Client{}
    resp, _ := client.Do(req)
    defer resp.Body.Close()

    body, _ := io.ReadAll(resp.Body)
    fmt.Println(string(body))
}`;
  }
}

const METHOD_COLOR: Record<string, string> = {
  GET:    "text-emerald-600 bg-emerald-50",
  POST:   "text-blue-600 bg-blue-50",
  PUT:    "text-amber-600 bg-amber-50",
  DELETE: "text-red-600 bg-red-50",
};

const LANG_LABELS: Record<Lang, string> = {
  curl: "cURL", js: "JavaScript", python: "Python", go: "Go",
};

function CopyBtn({ text }: { text: string }) {
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
      className="flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground transition-colors"
    >
      {copied ? <Check className="h-3 w-3 text-emerald-500" /> : <Copy className="h-3 w-3" />}
      {copied ? "Copied" : "Copy"}
    </button>
  );
}

function WorkspaceApiExplorer() {
  const [lang, setLang] = useState<Lang>("curl");
  const [apiKey, setApiKey] = useState("");
  const [activeEndpoint, setActiveEndpoint] = useState(0);

  const ep = ENDPOINTS[activeEndpoint];

  return (
    <div className="min-h-full px-8 py-8">
      <div className="mb-8">
        <h1 className="text-xl font-semibold">API Explorer</h1>
        <p className="mt-0.5 text-sm text-muted-foreground">Browse endpoints and generate code snippets for the Lunar Content API.</p>
      </div>

      {/* Auth */}
      <div className="mb-8 border-b border-border pb-6">
        <h2 className="mb-2 text-[11px] font-semibold uppercase tracking-widest text-muted-foreground">Authentication</h2>
        <p className="mb-3 text-sm text-muted-foreground">
          All API requests require a Bearer token in the <code className="font-mono text-xs bg-muted px-1 py-0.5 rounded">Authorization</code> header.
          Use an API key from the API Keys section.
        </p>
        <div className="flex items-center gap-2">
          <input
            type="text"
            value={apiKey}
            onChange={(e) => setApiKey(e.target.value)}
            placeholder="Paste your API key to populate code examples"
            className="w-96 rounded border border-border bg-background px-3 py-1.5 font-mono text-xs text-foreground placeholder:text-muted-foreground/60 focus:outline-none focus:ring-1 focus:ring-primary"
          />
        </div>
      </div>

      <div className="grid gap-8 lg:grid-cols-[200px_1fr]">
        {/* Endpoint list */}
        <div>
          <h2 className="mb-2 text-[11px] font-semibold uppercase tracking-widest text-muted-foreground">Endpoints</h2>
          {ENDPOINTS.map((e, i) => (
            <button
              key={e.path}
              type="button"
              onClick={() => setActiveEndpoint(i)}
              className={cn(
                "w-full text-left border-l-2 py-2 px-3 transition-colors",
                i === activeEndpoint
                  ? "border-primary text-foreground font-medium"
                  : "border-transparent text-muted-foreground hover:text-foreground hover:border-border",
              )}
            >
              <span className={cn(
                "mr-2 rounded px-1.5 py-0.5 text-[10px] font-bold font-mono",
                METHOD_COLOR[e.method],
              )}>
                {e.method}
              </span>
              <span className="text-xs font-mono">{e.path}</span>
            </button>
          ))}
        </div>

        {/* Detail */}
        <div className="space-y-6">
          {/* Endpoint info */}
          <div className="border-b border-border pb-5">
            <div className="flex items-center gap-2 mb-1">
              <span className={cn(
                "rounded px-2 py-0.5 text-xs font-bold font-mono",
                METHOD_COLOR[ep.method],
              )}>
                {ep.method}
              </span>
              <code className="font-mono text-sm">{BASE_URL}{ep.path}{ep.params}</code>
            </div>
            <p className="text-sm text-muted-foreground">{ep.description}</p>
          </div>

          {/* Language selector */}
          <div>
            <div className="mb-3 flex items-center gap-1.5">
              {(Object.keys(LANG_LABELS) as Lang[]).map((l) => (
                <button
                  key={l}
                  type="button"
                  onClick={() => setLang(l)}
                  className={cn(
                    "rounded px-2.5 py-1 text-xs font-medium transition-colors",
                    l === lang
                      ? "bg-primary text-primary-foreground"
                      : "border border-border text-muted-foreground hover:text-foreground",
                  )}
                >
                  {LANG_LABELS[l]}
                </button>
              ))}
            </div>

            {/* Code */}
            <div className="group relative">
              <div className="absolute right-3 top-3 opacity-0 group-hover:opacity-100 transition-opacity">
                <CopyBtn text={getSnippet(ep, lang, apiKey)} />
              </div>
              <pre className="overflow-x-auto rounded border border-border bg-zinc-950 p-4 text-xs text-zinc-100 font-mono leading-relaxed">
                {getSnippet(ep, lang, apiKey)}
              </pre>
            </div>
          </div>

          {/* Response */}
          <div>
            <div className="mb-2 flex items-center justify-between">
              <h3 className="text-[11px] font-semibold uppercase tracking-widest text-muted-foreground">Example Response</h3>
              <CopyBtn text={ep.response} />
            </div>
            <pre className="overflow-x-auto rounded border border-border bg-zinc-950 p-4 text-xs text-zinc-100 font-mono leading-relaxed">
              {ep.response}
            </pre>
          </div>
        </div>
      </div>
    </div>
  );
}
