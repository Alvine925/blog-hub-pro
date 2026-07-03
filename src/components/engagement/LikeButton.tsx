/**
 * LikeButton — works with both blog-engagement and content-engagement APIs.
 *
 * Usage:
 *   <LikeButton baseUrl="https://xyz.supabase.co/functions/v1/blog-engagement"
 *               apiKey="pk_live_..." slug="my-post" contentType="blogs" />
 *
 *   <LikeButton baseUrl="https://xyz.supabase.co/functions/v1/content-engagement"
 *               apiKey="pk_live_..." slug="my-article" contentType="articles" />
 */

import { useState, useEffect, useCallback } from "react";
import { Heart } from "lucide-react";
import { cn } from "@/lib/utils";

function getVisitorId(): string {
  const KEY = "lc_visitor_id";
  let id = localStorage.getItem(KEY);
  if (!id) {
    id = crypto.randomUUID();
    localStorage.setItem(KEY, id);
  }
  return id;
}

export type EngagementContentType = "blogs" | "news" | "articles" | "products";

interface LikeButtonProps {
  baseUrl:      string;
  apiKey:       string;
  slug:         string;
  contentType:  EngagementContentType;
  className?:   string;
  showCount?:   boolean;
  size?:        "sm" | "md" | "lg";
}

const SIZE_MAP = {
  sm: { icon: "h-3.5 w-3.5", text: "text-xs", btn: "h-7 gap-1.5 px-2.5 text-xs" },
  md: { icon: "h-4 w-4",     text: "text-sm", btn: "h-9 gap-2 px-4 text-sm"     },
  lg: { icon: "h-5 w-5",     text: "text-base", btn: "h-10 gap-2 px-5 text-base" },
};

export function LikeButton({
  baseUrl, apiKey, slug, contentType,
  className, showCount = true, size = "md",
}: LikeButtonProps) {
  const [liked,   setLiked]   = useState(false);
  const [count,   setCount]   = useState(0);
  const [loading, setLoading] = useState(true);
  const [busy,    setBusy]    = useState(false);
  const sz = SIZE_MAP[size];

  // Build the likes URL depending on content type
  const likesUrl = contentType === "blogs"
    ? `${baseUrl}/blogs/${slug}/likes`
    : `${baseUrl}/${contentType}/${slug}/likes`;

  const headers = useCallback(() => ({
    Authorization:  `Bearer ${apiKey}`,
    "Content-Type": "application/json",
    "X-Visitor-Id": getVisitorId(),
  }), [apiKey]);

  useEffect(() => {
    let cancelled = false;
    fetch(likesUrl, { headers: headers() })
      .then((r) => r.json())
      .then((d) => {
        if (cancelled) return;
        setCount(d.data?.likes ?? 0);
        setLiked(d.data?.liked ?? false);
      })
      .catch(() => {})
      .finally(() => { if (!cancelled) setLoading(false); });
    return () => { cancelled = true; };
  }, [likesUrl, headers]);

  async function toggle() {
    if (busy) return;
    setBusy(true);
    const method = liked ? "DELETE" : "POST";
    try {
      const res  = await fetch(likesUrl, { method, headers: headers() });
      const data = await res.json();
      setCount(data.data?.likes ?? count);
      setLiked(data.data?.liked ?? !liked);
    } catch { /* ignore */ }
    finally { setBusy(false); }
  }

  return (
    <button
      type="button"
      onClick={toggle}
      disabled={loading || busy}
      className={cn(
        "inline-flex items-center rounded-full border font-medium transition-all",
        "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
        liked
          ? "border-rose-300 bg-rose-50 text-rose-600 hover:bg-rose-100"
          : "border-border bg-background text-muted-foreground hover:text-foreground hover:bg-muted",
        busy && "opacity-60 cursor-wait",
        sz.btn,
        className,
      )}
    >
      <Heart className={cn(sz.icon, liked && "fill-rose-500")} />
      {showCount && <span className={sz.text}>{loading ? "…" : count}</span>}
    </button>
  );
}
