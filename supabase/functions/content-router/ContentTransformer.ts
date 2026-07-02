/**
 * ContentTransformer.ts — re-exports from the shared centralized transformer.
 *
 * The canonical implementation lives in ../_shared/transformer.ts so that
 * every gateway (api-gateway, content-router, and future functions) uses
 * one single source of truth for response sanitization.
 *
 * All existing imports of ContentTransformer inside this package continue
 * to work without any changes.
 */
export * from "../_shared/transformer.ts";
