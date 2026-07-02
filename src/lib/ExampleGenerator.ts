/**
 * ExampleGenerator.ts
 *
 * Generates code examples for every supported language from an
 * EndpointDefinition. Called by the DocumentationService and rendered
 * in the UI — no hardcoded snippets anywhere else.
 */

import type { EndpointDefinition } from "./EndpointRegistry";
import { buildExampleUrl } from "./ParameterParser";

export type CodeLanguage =
  | "curl"
  | "javascript"
  | "typescript"
  | "python"
  | "php"
  | "nodejs"
  | "go"
  | "csharp";

export const LANGUAGE_LABELS: Record<CodeLanguage, string> = {
  curl: "cURL",
  javascript: "JavaScript",
  typescript: "TypeScript",
  python: "Python",
  php: "PHP",
  nodejs: "Node.js",
  go: "Go",
  csharp: "C#",
};

export const ALL_LANGUAGES: CodeLanguage[] = [
  "curl",
  "javascript",
  "typescript",
  "python",
  "php",
  "nodejs",
  "go",
  "csharp",
];

// ── Snippet builders ──────────────────────────────────────────────────────────

function curlSnippet(url: string, method: string, apiKey: string): string {
  return `curl -X ${method} \\
  "${url}" \\
  -H "Authorization: Bearer ${apiKey}" \\
  -H "Content-Type: application/json"`;
}

function javascriptSnippet(url: string, method: string, apiKey: string): string {
  return `const response = await fetch("${url}", {
  method: "${method}",
  headers: {
    "Authorization": "Bearer ${apiKey}",
    "Content-Type": "application/json",
  },
});

const data = await response.json();
console.log(data);`;
}

function typescriptSnippet(url: string, method: string, apiKey: string): string {
  return `interface ApiResponse<T> {
  success: boolean;
  data: T;
  meta?: { page: number; limit: number; total: number; totalPages: number };
}

const response = await fetch("${url}", {
  method: "${method}",
  headers: {
    "Authorization": \`Bearer \${process.env.LUNAR_API_KEY}\`,
    "Content-Type": "application/json",
  },
});

if (!response.ok) {
  throw new Error(\`API error: \${response.status}\`);
}

const data: ApiResponse<unknown> = await response.json();
console.log(data);`;
}

function pythonSnippet(url: string, method: string, apiKey: string): string {
  return `import requests

headers = {
    "Authorization": f"Bearer ${apiKey}",
    "Content-Type": "application/json",
}

response = requests.${method.toLowerCase()}(
    "${url}",
    headers=headers,
)

response.raise_for_status()
data = response.json()
print(data)`;
}

function phpSnippet(url: string, method: string, apiKey: string): string {
  return `<?php

$curl = curl_init();

curl_setopt_array($curl, [
    CURLOPT_URL => "${url}",
    CURLOPT_CUSTOMREQUEST => "${method}",
    CURLOPT_RETURNTRANSFER => true,
    CURLOPT_HTTPHEADER => [
        "Authorization: Bearer ${apiKey}",
        "Content-Type: application/json",
    ],
]);

$response = curl_exec($curl);
curl_close($curl);

$data = json_decode($response, true);
print_r($data);`;
}

function nodejsSnippet(url: string, method: string, apiKey: string): string {
  return `const https = require("https");
const { URL } = require("url");

const endpoint = new URL("${url}");

const options = {
  hostname: endpoint.hostname,
  path: endpoint.pathname + endpoint.search,
  method: "${method}",
  headers: {
    "Authorization": "Bearer ${apiKey}",
    "Content-Type": "application/json",
  },
};

const req = https.request(options, (res) => {
  let body = "";
  res.on("data", (chunk) => { body += chunk; });
  res.on("end", () => {
    const data = JSON.parse(body);
    console.log(data);
  });
});

req.on("error", console.error);
req.end();`;
}

function goSnippet(url: string, method: string, apiKey: string): string {
  return `package main

import (
	"encoding/json"
	"fmt"
	"io"
	"net/http"
)

func main() {
	req, err := http.NewRequest("${method}", "${url}", nil)
	if err != nil {
		panic(err)
	}

	req.Header.Set("Authorization", "Bearer ${apiKey}")
	req.Header.Set("Content-Type", "application/json")

	client := &http.Client{}
	resp, err := client.Do(req)
	if err != nil {
		panic(err)
	}
	defer resp.Body.Close()

	body, _ := io.ReadAll(resp.Body)

	var data map[string]interface{}
	json.Unmarshal(body, &data)
	fmt.Printf("%+v\\n", data)
}`;
}

function csharpSnippet(url: string, method: string, apiKey: string): string {
  const methodCall =
    method === "GET"
      ? `client.GetAsync("${url}")`
      : `client.SendAsync(new HttpRequestMessage(new HttpMethod("${method}"), "${url}"))`;

  return `using System.Net.Http;
using System.Net.Http.Headers;
using System.Text.Json;

var client = new HttpClient();
client.DefaultRequestHeaders.Authorization =
    new AuthenticationHeaderValue("Bearer", "${apiKey}");

var response = await ${methodCall};
response.EnsureSuccessStatusCode();

var json = await response.Content.ReadAsStringAsync();
var data = JsonSerializer.Deserialize<JsonElement>(json);
Console.WriteLine(data);`;
}

// ── Public API ────────────────────────────────────────────────────────────────

export function generateSnippet(
  endpoint: EndpointDefinition,
  language: CodeLanguage,
  baseUrl: string,
  apiKey = "YOUR_API_KEY",
): string {
  const url = buildExampleUrl(baseUrl, endpoint);
  const method = endpoint.method;

  switch (language) {
    case "curl":        return curlSnippet(url, method, apiKey);
    case "javascript":  return javascriptSnippet(url, method, apiKey);
    case "typescript":  return typescriptSnippet(url, method, apiKey);
    case "python":      return pythonSnippet(url, method, apiKey);
    case "php":         return phpSnippet(url, method, apiKey);
    case "nodejs":      return nodejsSnippet(url, method, apiKey);
    case "go":          return goSnippet(url, method, apiKey);
    case "csharp":      return csharpSnippet(url, method, apiKey);
  }
}

export function generateAllSnippets(
  endpoint: EndpointDefinition,
  baseUrl: string,
  apiKey?: string,
): Record<CodeLanguage, string> {
  return Object.fromEntries(
    ALL_LANGUAGES.map((lang) => [lang, generateSnippet(endpoint, lang, baseUrl, apiKey)]),
  ) as Record<CodeLanguage, string>;
}
