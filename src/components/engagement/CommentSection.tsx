/**
 * CommentSection — displays approved comments and a submission form.
 * Works with blog-engagement and content-engagement APIs.
 *
 * Usage:
 *   <CommentSection baseUrl="..." apiKey="pk_live_..." slug="my-post"
 *                   contentType="blogs" />
 */

import { useState, useEffect, useCallback } from "react";
import { MessageSquare, Send, CornerDownRight } from "lucide-react";
import { cn } from "@/lib/utils";
import type { EngagementContentType } from "./LikeButton";

interface Comment {
  id:         string;
  parent_id:  string | null;
  name:       string;
  website:    string | null;
  content:    string;
  created_at: string;
}

interface CommentSectionProps {
  baseUrl:     string;
  apiKey:      string;
  slug:        string;
  contentType: EngagementContentType;
  className?:  string;
  /** Avatar colour accent for comment authors (tailwind bg class) */
  accentColor?: string;
  allowGuest?: boolean;
}

function timeAgo(iso: string): string {
  const diff = (Date.now() - new Date(iso).getTime()) / 1000;
  if (diff < 60)      return "just now";
  if (diff < 3600)    return `${Math.floor(diff / 60)}m ago`;
  if (diff < 86400)   return `${Math.floor(diff / 3600)}h ago`;
  if (diff < 604800)  return `${Math.floor(diff / 86400)}d ago`;
  return new Date(iso).toLocaleDateString();
}

function Avatar({ name, accent }: { name: string; accent: string }) {
  return (
    <div className={cn(
      "flex h-7 w-7 shrink-0 items-center justify-center rounded-full text-[11px] font-bold text-white",
      accent,
    )}>
      {name.slice(0, 2).toUpperCase()}
    </div>
  );
}

export function CommentSection({
  baseUrl, apiKey, slug, contentType,
  className, accentColor = "bg-violet-500", allowGuest = true,
}: CommentSectionProps) {
  const [comments, setComments] = useState<Comment[]>([]);
  const [total,    setTotal]    = useState(0);
  const [loading,  setLoading]  = useState(true);
  const [replyTo,  setReplyTo]  = useState<string | null>(null);

  // Form state
  const [name,    setName]    = useState("");
  const [email,   setEmail]   = useState("");
  const [website, setWebsite] = useState("");
  const [body,    setBody]    = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [submitted,  setSubmitted]  = useState(false);
  const [error,      setError]      = useState("");

  const commentsUrl = contentType === "blogs"
    ? `${baseUrl}/blogs/${slug}/comments`
    : `${baseUrl}/${contentType}/${slug}/comments`;

  const authHeader = useCallback(() => ({
    Authorization:  `Bearer ${apiKey}`,
    "Content-Type": "application/json",
  }), [apiKey]);

  function loadComments() {
    setLoading(true);
    fetch(`${commentsUrl}?limit=50`, { headers: authHeader() })
      .then((r) => r.json())
      .then((d) => {
        setComments(d.data?.comments ?? []);
        setTotal(d.data?.total ?? 0);
      })
      .catch(() => {})
      .finally(() => setLoading(false));
  }

  useEffect(() => { loadComments(); }, [commentsUrl]);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!name.trim() || !body.trim()) { setError("Name and comment are required."); return; }
    setError("");
    setSubmitting(true);
    try {
      const res = await fetch(commentsUrl, {
        method: "POST",
        headers: authHeader(),
        body: JSON.stringify({
          name: name.trim(),
          email: email.trim() || undefined,
          website: website.trim() || undefined,
          content: body.trim(),
          parent_id: replyTo,
        }),
      });
      if (!res.ok) {
        const d = await res.json().catch(() => ({})) as Record<string, unknown>;
        throw new Error((d.error as Record<string, string>)?.message ?? "Submission failed");
      }
      setSubmitted(true);
      setName(""); setEmail(""); setWebsite(""); setBody(""); setReplyTo(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Submission failed");
    } finally {
      setSubmitting(false);
    }
  }

  // Build threaded tree
  const rootComments  = comments.filter((c) => !c.parent_id);
  const replies       = (parentId: string) => comments.filter((c) => c.parent_id === parentId);

  function CommentCard({ comment, depth = 0 }: { comment: Comment; depth?: number }) {
    const childComments = replies(comment.id);
    return (
      <div className={cn("flex gap-3", depth > 0 && "ml-8 mt-3")}>
        <Avatar name={comment.name} accent={accentColor} />
        <div className="flex-1 min-w-0">
          <div className="flex items-baseline gap-2 flex-wrap">
            {comment.website ? (
              <a href={comment.website} target="_blank" rel="noopener noreferrer"
                className="text-sm font-semibold hover:underline">
                {comment.name}
              </a>
            ) : (
              <span className="text-sm font-semibold">{comment.name}</span>
            )}
            <span className="text-xs text-muted-foreground">{timeAgo(comment.created_at)}</span>
          </div>
          <p className="mt-1 text-sm leading-relaxed whitespace-pre-wrap break-words text-foreground/90">
            {comment.content}
          </p>
          <button
            type="button"
            className="mt-1.5 flex items-center gap-1 text-xs text-muted-foreground hover:text-primary transition-colors"
            onClick={() => setReplyTo(replyTo === comment.id ? null : comment.id)}
          >
            <CornerDownRight className="h-3 w-3" />
            {replyTo === comment.id ? "Cancel reply" : "Reply"}
          </button>
          {replyTo === comment.id && (
            <div className="mt-3">
              <CommentForm isReply />
            </div>
          )}
          {childComments.map((c) => (
            <CommentCard key={c.id} comment={c} depth={depth + 1} />
          ))}
        </div>
      </div>
    );
  }

  function CommentForm({ isReply = false }: { isReply?: boolean }) {
    return (
      <form onSubmit={handleSubmit} className="space-y-3">
        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className="mb-1 block text-xs font-medium text-muted-foreground">
              Name <span className="text-red-500">*</span>
            </label>
            <input
              value={name} onChange={(e) => setName(e.target.value)}
              placeholder="Your name"
              className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-ring"
              maxLength={100}
            />
          </div>
          <div>
            <label className="mb-1 block text-xs font-medium text-muted-foreground">Email (private)</label>
            <input
              type="email" value={email} onChange={(e) => setEmail(e.target.value)}
              placeholder="you@example.com"
              className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-ring"
              maxLength={200}
            />
          </div>
        </div>
        <div>
          <label className="mb-1 block text-xs font-medium text-muted-foreground">Website</label>
          <input
            value={website} onChange={(e) => setWebsite(e.target.value)}
            placeholder="https://yoursite.com"
            className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-ring"
            maxLength={200}
          />
        </div>
        <div>
          <label className="mb-1 block text-xs font-medium text-muted-foreground">
            Comment <span className="text-red-500">*</span>
          </label>
          <textarea
            value={body} onChange={(e) => setBody(e.target.value)}
            rows={4}
            placeholder={isReply ? "Write a reply…" : "Share your thoughts…"}
            className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-ring resize-none"
            maxLength={5000}
          />
        </div>
        {error && <p className="text-xs text-destructive">{error}</p>}
        <button
          type="submit"
          disabled={submitting}
          className="inline-flex items-center gap-2 rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground hover:bg-primary/90 disabled:opacity-60 transition-colors"
        >
          <Send className="h-3.5 w-3.5" />
          {submitting ? "Submitting…" : "Post Comment"}
        </button>
      </form>
    );
  }

  return (
    <section className={cn("space-y-8", className)}>
      {/* Header */}
      <div className="flex items-center gap-2">
        <MessageSquare className="h-4 w-4 text-muted-foreground" />
        <h2 className="text-lg font-semibold">
          {loading ? "Comments" : `${total} Comment${total !== 1 ? "s" : ""}`}
        </h2>
      </div>

      {/* Comment list */}
      {loading ? (
        <div className="space-y-4">
          {[1, 2, 3].map((i) => (
            <div key={i} className="flex gap-3 animate-pulse">
              <div className="h-7 w-7 rounded-full bg-muted" />
              <div className="flex-1 space-y-2">
                <div className="h-3 w-24 rounded bg-muted" />
                <div className="h-3 w-full rounded bg-muted" />
                <div className="h-3 w-3/4 rounded bg-muted" />
              </div>
            </div>
          ))}
        </div>
      ) : rootComments.length === 0 ? (
        <p className="text-sm text-muted-foreground py-4">
          No comments yet. Be the first to share your thoughts!
        </p>
      ) : (
        <div className="space-y-6">
          {rootComments.map((c) => <CommentCard key={c.id} comment={c} />)}
        </div>
      )}

      {/* Submission form or success */}
      <div className="border-t border-border pt-6">
        {submitted ? (
          <div className="rounded-lg border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-800">
            ✓ Thanks for your comment! It's awaiting moderation and will appear shortly.
          </div>
        ) : allowGuest ? (
          <div>
            <h3 className="mb-4 text-sm font-semibold text-muted-foreground uppercase tracking-wide">
              Leave a comment
            </h3>
            <CommentForm />
          </div>
        ) : null}
      </div>
    </section>
  );
}
