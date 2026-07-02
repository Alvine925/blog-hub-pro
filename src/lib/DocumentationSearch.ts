/**
 * DocumentationSearch.ts
 *
 * Builds a client-side search index from the EndpointRegistry and
 * documentation content. Returns ranked results with section routing info.
 */

import { ENDPOINT_REGISTRY } from "./EndpointRegistry";
import { DOC_SECTIONS, ERROR_DOCS, FRAMEWORK_GUIDES } from "./DocumentationService";
import { buildParamList } from "./ParameterParser";

export interface SearchResult {
  id: string;
  title: string;
  description: string;
  section: string;
  endpointId?: string;
  score: number;
}

interface IndexEntry {
  id: string;
  title: string;
  description: string;
  section: string;
  endpointId?: string;
  searchText: string;
}

// ── Build the search index ────────────────────────────────────────────────────

function buildIndex(): IndexEntry[] {
  const entries: IndexEntry[] = [];

  // Documentation sections
  for (const s of DOC_SECTIONS) {
    entries.push({
      id: `section-${s.id}`,
      title: s.title,
      description: `Documentation section: ${s.title}`,
      section: s.id,
      searchText: `${s.title} ${s.group}`.toLowerCase(),
    });
  }

  // Endpoints
  for (const ep of ENDPOINT_REGISTRY) {
    const params = buildParamList(ep);
    const paramText = params.map((p) => `${p.name} ${p.description}`).join(" ");
    const tagText = ep.tags.join(" ");

    entries.push({
      id: `endpoint-${ep.id}`,
      title: `${ep.method} /${ep.path.replace(/^\//, "")}`,
      description: ep.description,
      section: "endpoints",
      endpointId: ep.id,
      searchText: [
        ep.method,
        ep.path,
        ep.title,
        ep.description,
        ep.longDescription ?? "",
        paramText,
        tagText,
        ep.category,
      ]
        .join(" ")
        .toLowerCase(),
    });

    // Individual param entries
    for (const p of params) {
      entries.push({
        id: `param-${ep.id}-${p.name}`,
        title: `${p.name} (${ep.title})`,
        description: p.description,
        section: "endpoints",
        endpointId: ep.id,
        searchText: `${p.name} ${p.description} ${ep.title} parameter`.toLowerCase(),
      });
    }
  }

  // Error codes
  for (const e of ERROR_DOCS) {
    entries.push({
      id: `error-${e.code}`,
      title: `${e.code} ${e.name}`,
      description: e.description,
      section: "errors",
      searchText: `${e.code} ${e.name} ${e.description} ${e.resolution} error`.toLowerCase(),
    });
  }

  // Framework guides
  for (const f of FRAMEWORK_GUIDES) {
    entries.push({
      id: `framework-${f.id}`,
      title: `${f.name} Integration`,
      description: `${f.notes}`,
      section: "frameworks",
      searchText: `${f.name} framework integration guide ${f.notes}`.toLowerCase(),
    });
  }

  // Auth section keywords
  entries.push({
    id: "auth-bearer",
    title: "Bearer Authentication",
    description: "How to authenticate using API keys in the Authorization header.",
    section: "authentication",
    searchText: "authentication bearer token api key authorization header pk_live sk_live publishable secret",
  });

  entries.push({
    id: "pagination-guide",
    title: "Pagination Guide",
    description: "Using page and limit parameters to paginate API results.",
    section: "pagination",
    searchText: "pagination page limit total totalPages offset cursor",
  });

  entries.push({
    id: "ai-prompts-guide",
    title: "AI Prompts",
    description: "Generate AI implementation prompts for Cursor, Lovable, Windsurf, and Bolt.",
    section: "ai-prompts",
    searchText: "ai prompts cursor lovable windsurf bolt implementation generator",
  });

  return entries;
}

// Lazy singleton index
let _index: IndexEntry[] | null = null;
function getIndex(): IndexEntry[] {
  if (!_index) _index = buildIndex();
  return _index;
}

// ── Scoring ───────────────────────────────────────────────────────────────────

function score(entry: IndexEntry, query: string): number {
  const q = query.toLowerCase().trim();
  if (!q) return 0;

  const tokens = q.split(/\s+/);
  let total = 0;

  for (const token of tokens) {
    // Exact title match → highest score
    if (entry.title.toLowerCase() === token) total += 10;
    else if (entry.title.toLowerCase().includes(token)) total += 5;
    // Search text match
    if (entry.searchText.includes(token)) total += 2;
    // Method match (GET, POST)
    if (token.length === 3 && entry.searchText.startsWith(token)) total += 3;
  }

  return total;
}

// ── Public API ────────────────────────────────────────────────────────────────

export function searchDocs(query: string, limit = 8): SearchResult[] {
  if (!query.trim()) return [];

  const index = getIndex();

  return index
    .map((entry) => ({ ...entry, score: score(entry, query) }))
    .filter((e) => e.score > 0)
    .sort((a, b) => b.score - a.score)
    .slice(0, limit)
    .map(({ searchText: _s, ...rest }) => rest);
}
