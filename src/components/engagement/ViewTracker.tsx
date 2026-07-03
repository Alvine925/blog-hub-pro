/**
 * ViewTracker — invisible component that fires a view event on mount.
 * Respects the 30-min server-side deduplication window.
 *
 * Usage (drop once per page):
 *   <ViewTracker baseUrl="..." apiKey="pk_live_..." slug="my-post" contentType="blogs" />
 */

import { useEffect } from "react";
import type { EngagementContentType } from "./LikeButton";

function getVisitorId(): string {
  const KEY = "lc_visitor_id";
  let id = localStorage.getItem(KEY);
  if (!id) { id = crypto.randomUUID(); localStorage.setItem(KEY, id); }
  return id;
}

interface ViewTrackerProps {
  baseUrl:     string;
  apiKey:      string;
  slug:        string;
  contentType: EngagementContentType;
  /** Delay in ms before firing the view (default 2000ms — avoids counting bounces) */
  delay?: number;
}

export function ViewTracker({ baseUrl, apiKey, slug, contentType, delay = 2000 }: ViewTrackerProps) {
  useEffect(() => {
    const viewUrl = contentType === "blogs"
      ? `${baseUrl}/blogs/${slug}/view`
      : `${baseUrl}/${contentType}/${slug}/view`;

    const timer = setTimeout(() => {
      fetch(viewUrl, {
        method: "POST",
        headers: {
          Authorization:  `Bearer ${apiKey}`,
          "Content-Type": "application/json",
          "X-Visitor-Id": getVisitorId(),
        },
      }).catch(() => { /* fire-and-forget */ });
    }, delay);

    return () => clearTimeout(timer);
  }, [baseUrl, apiKey, slug, contentType, delay]);

  return null; // renders nothing
}
