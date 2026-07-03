/**
 * ShareModal — social sharing panel + share-click tracking.
 * Works with blog-engagement and content-engagement APIs.
 *
 * Usage:
 *   <ShareButton baseUrl="..." apiKey="pk_live_..." slug="my-post"
 *                contentType="blogs" title="My Post" url="https://mysite.com/blog/my-post" />
 */

import { useState } from "react";
import { Share2, Twitter, Linkedin, Facebook, Mail, Link2, CheckCheck, X } from "lucide-react";
import { cn } from "@/lib/utils";
import type { EngagementContentType } from "./LikeButton";

interface ShareButtonProps {
  baseUrl:      string;
  apiKey:       string;
  slug:         string;
  contentType:  EngagementContentType;
  title:        string;
  url:          string;
  description?: string;
  className?:   string;
  size?:        "sm" | "md" | "lg";
}

interface ShareChannel {
  key:    string;
  label:  string;
  icon:   React.ElementType;
  color:  string;
  build:  (url: string, title: string, desc: string) => string;
}

const CHANNELS: ShareChannel[] = [
  {
    key: "x", label: "X / Twitter", icon: Twitter,
    color: "hover:bg-black hover:text-white",
    build: (u, t) => `https://x.com/intent/tweet?url=${encodeURIComponent(u)}&text=${encodeURIComponent(t)}`,
  },
  {
    key: "linkedin", label: "LinkedIn", icon: Linkedin,
    color: "hover:bg-[#0077B5] hover:text-white",
    build: (u, t) => `https://www.linkedin.com/shareArticle?mini=true&url=${encodeURIComponent(u)}&title=${encodeURIComponent(t)}`,
  },
  {
    key: "facebook", label: "Facebook", icon: Facebook,
    color: "hover:bg-[#1877F2] hover:text-white",
    build: (u) => `https://www.facebook.com/sharer/sharer.php?u=${encodeURIComponent(u)}`,
  },
  {
    key: "email", label: "Email", icon: Mail,
    color: "hover:bg-muted",
    build: (u, t, d) => `mailto:?subject=${encodeURIComponent(t)}&body=${encodeURIComponent(`${d}\n\n${u}`)}`,
  },
];

export function ShareButton({
  baseUrl, apiKey, slug, contentType,
  title, url, description = "", className, size = "md",
}: ShareButtonProps) {
  const [open,   setOpen]   = useState(false);
  const [copied, setCopied] = useState(false);

  const shareUrl = contentType === "blogs"
    ? `${baseUrl}/blogs/${slug}/share`
    : `${baseUrl}/${contentType}/${slug}/share`;

  async function trackShare(channel: string) {
    try {
      await fetch(shareUrl, {
        method: "POST",
        headers: { Authorization: `Bearer ${apiKey}`, "Content-Type": "application/json" },
        body: JSON.stringify({ channel }),
      });
    } catch { /* fire-and-forget */ }
  }

  async function copyLink() {
    try {
      await navigator.clipboard.writeText(url);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
      trackShare("copy");
    } catch { /* ignore */ }
  }

  const sizeCls = size === "sm"
    ? "h-7 gap-1.5 px-2.5 text-xs"
    : size === "lg"
    ? "h-10 gap-2 px-5 text-base"
    : "h-9 gap-2 px-4 text-sm";

  return (
    <div className="relative">
      {/* Trigger */}
      <button
        type="button"
        onClick={() => setOpen(!open)}
        className={cn(
          "inline-flex items-center rounded-full border border-border bg-background font-medium",
          "text-muted-foreground hover:text-foreground hover:bg-muted transition-all",
          "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
          sizeCls,
          className,
        )}
      >
        <Share2 className={size === "sm" ? "h-3.5 w-3.5" : "h-4 w-4"} />
        <span>Share</span>
      </button>

      {/* Dropdown */}
      {open && (
        <>
          {/* Backdrop */}
          <div
            className="fixed inset-0 z-40"
            onClick={() => setOpen(false)}
          />
          <div className="absolute left-0 z-50 mt-2 w-64 rounded-xl border border-border bg-popover p-3 shadow-lg">
            <div className="flex items-center justify-between mb-3">
              <span className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                Share this
              </span>
              <button
                type="button"
                onClick={() => setOpen(false)}
                className="rounded p-0.5 text-muted-foreground hover:text-foreground"
              >
                <X className="h-3.5 w-3.5" />
              </button>
            </div>

            {/* Social channels */}
            <div className="space-y-1">
              {CHANNELS.map((ch) => (
                <a
                  key={ch.key}
                  href={ch.build(url, title, description)}
                  target="_blank"
                  rel="noopener noreferrer"
                  onClick={() => { trackShare(ch.key); setOpen(false); }}
                  className={cn(
                    "flex items-center gap-3 rounded-lg px-3 py-2 text-sm transition-colors",
                    ch.color,
                  )}
                >
                  <ch.icon className="h-4 w-4 shrink-0" />
                  {ch.label}
                </a>
              ))}
            </div>

            {/* Copy link */}
            <div className="mt-3 border-t border-border pt-3">
              <button
                type="button"
                onClick={copyLink}
                className="flex w-full items-center gap-3 rounded-lg px-3 py-2 text-sm hover:bg-muted transition-colors"
              >
                {copied
                  ? <CheckCheck className="h-4 w-4 shrink-0 text-emerald-600" />
                  : <Link2 className="h-4 w-4 shrink-0" />
                }
                {copied ? "Link copied!" : "Copy link"}
              </button>
            </div>

            {/* URL preview */}
            <div className="mt-2 truncate rounded bg-muted px-2 py-1 text-[10px] font-mono text-muted-foreground">
              {url}
            </div>
          </div>
        </>
      )}
    </div>
  );
}
