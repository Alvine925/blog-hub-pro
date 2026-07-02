/**
 * PageService.ts — retrieves pages from the CMS.
 *
 * NOTE: The current schema does not include a dedicated `pages` table.
 * This service returns empty results gracefully until the table is created.
 * When a `pages` table is added (mirroring blog_posts with status/slug),
 * replace the stub queries below with real ones.
 */
import { type PublicPage } from "../ContentTransformer.ts";

export interface PageListResult {
  rows:  PublicPage[];
  total: number;
}

export async function listPages(
  _workspaceId: string,
  _params: { page: number; limit: number },
): Promise<PageListResult> {
  // Stub: pages table not yet in schema
  return { rows: [], total: 0 };
}

export async function getPageBySlug(
  _workspaceId: string,
  _slug: string,
): Promise<PublicPage | null> {
  // Stub: pages table not yet in schema
  return null;
}
