/**
 * DocumentationRenderer.ts
 *
 * Thin adapter layer between DocumentationService and the UI components.
 * Provides convenience getters so route components stay declarative and thin.
 */

export { DOC_SECTIONS, type DocSection } from "./DocumentationService";
export { CATEGORY_LABELS, ENDPOINT_REGISTRY, type EndpointDefinition } from "./EndpointRegistry";
export { ALL_LANGUAGES, LANGUAGE_LABELS, type CodeLanguage } from "./ExampleGenerator";
export { buildParamList, formatParamType } from "./ParameterParser";

import { DocumentationService } from "./DocumentationService";

/**
 * Create a DocumentationService scoped to the current workspace's base URL.
 * Pass the actual API key when available to pre-fill code snippets.
 */
export function createDocService(
  originOrBaseUrl: string,
  apiKey?: string,
): DocumentationService {
  // Normalise: strip trailing slashes then append /api
  const base = originOrBaseUrl.replace(/\/+$/, "").replace(/\/api$/, "") + "/api";
  return new DocumentationService(base, apiKey);
}
