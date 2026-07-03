/**
 * GenericComment.ts — threaded comments with moderation for any content type.
 */
import { getDb } from "../db.ts";
import { bumpDaily } from "./GenericLookup.ts";
import { sanitizeCommentContent, sanitizeText, sanitizeUrl, isValidEmail } from "../../_shared/sanitize.ts";
import type { ContentTypeConfig } from "./ContentType.ts";

export interface CommentRow {
  id:             string;
  parent_id:      string | null;
  author_name:    string;
  author_website: string | null;
  content:        string;
  status:         string;
  created_at:     string;
  replies?:       CommentRow[];
}

export interface CommentsResult {
  rows:  CommentRow[];
  total: number;
}

const COMMENT_COLS =
  "id, parent_id, author_name, author_website, content, status, created_at";

export async function listApprovedComments(
  config: ContentTypeConfig,
  contentId: string,
  page: number,
  limit: number,
): Promise<CommentsResult> {
  const db = getDb() as any;
  const offset = (page - 1) * limit;

  const { data: roots, count, error } = await db
    .from(config.commentsTable)
    .select(COMMENT_COLS, { count: "exact" })
    .eq(config.idCol, contentId)
    .eq("status", "approved")
    .is("parent_id", null)
    .order("created_at", { ascending: true })
    .range(offset, offset + limit - 1);

  if (error) throw new Error(error.message);

  const rootRows = (roots ?? []) as CommentRow[];
  if (rootRows.length === 0) return { rows: [], total: count ?? 0 };

  const rootIds = rootRows.map((r) => r.id);
  const { data: replies } = await db
    .from(config.commentsTable)
    .select(COMMENT_COLS)
    .in("parent_id", rootIds)
    .eq("status", "approved")
    .order("created_at", { ascending: true });

  const replyMap: Record<string, CommentRow[]> = {};
  for (const r of (replies ?? []) as CommentRow[]) {
    if (!replyMap[r.parent_id!]) replyMap[r.parent_id!] = [];
    replyMap[r.parent_id!].push(r);
  }

  return {
    rows: rootRows.map((r) => ({ ...r, replies: replyMap[r.id] ?? [] })),
    total: count ?? 0,
  };
}

export interface SubmitCommentResult {
  ok:       boolean;
  comment?: CommentRow;
  error?:   string;
}

export async function submitComment(
  config: ContentTypeConfig,
  opts: {
    contentId:       string;
    workspaceId:     string;
    parentId:        string | null;
    name:            string;
    email:           string;
    website:         string | null;
    content:         string;
    visitorId:       string;
    ip:              string | null;
    userAgent:       string | null;
    requireApproval: boolean;
    maxDepth:        number;
  },
): Promise<SubmitCommentResult> {
  const db = getDb() as any;

  const name    = sanitizeText(opts.name, 100);
  const content = sanitizeCommentContent(opts.content, 5000);
  const website = opts.website ? sanitizeUrl(opts.website) : null;

  if (!name)    return { ok: false, error: "Name is required." };
  if (!content) return { ok: false, error: "Comment content is required." };
  if (!isValidEmail(opts.email)) return { ok: false, error: "A valid email is required." };

  if (opts.parentId) {
    const { data: parent } = await db
      .from(config.commentsTable)
      .select("id, parent_id")
      .eq("id", opts.parentId)
      .eq(config.idCol, opts.contentId)
      .maybeSingle();
    if (!parent) return { ok: false, error: "Parent comment not found." };
    if ((parent as Record<string, unknown>).parent_id) {
      return { ok: false, error: `Max nesting depth of ${opts.maxDepth} reached.` };
    }
  }

  const ipHash = opts.ip
    ? await crypto.subtle
        .digest("SHA-256", new TextEncoder().encode(opts.ip + opts.userAgent + new Date().toDateString()))
        .then((b) => Array.from(new Uint8Array(b)).map((x) => x.toString(16).padStart(2, "0")).join(""))
    : null;

  const status = opts.requireApproval ? "pending" : "approved";

  const { data: inserted, error } = await db
    .from(config.commentsTable)
    .insert({
      [config.idCol]: opts.contentId,
      workspace_id:   opts.workspaceId,
      parent_id:      opts.parentId,
      author_name:    name,
      author_email:   opts.email,
      author_website: website,
      content,
      status,
      visitor_id:     opts.visitorId,
      ip_hash:        ipHash,
      user_agent:     opts.userAgent,
    })
    .select(COMMENT_COLS)
    .single();

  if (error) return { ok: false, error: error.message };

  if (status === "approved") {
    bumpDaily(config, opts.contentId, opts.workspaceId, "comments");
  }

  return { ok: true, comment: inserted as CommentRow };
}

export async function moderateComment(
  config: ContentTypeConfig,
  commentId: string,
  workspaceId: string,
  status: string,
): Promise<{ ok: boolean; error?: string }> {
  const ALLOWED = ["pending", "approved", "rejected", "spam", "trash"];
  if (!ALLOWED.includes(status)) {
    return { ok: false, error: `Invalid status. Must be one of: ${ALLOWED.join(", ")}.` };
  }

  const db = getDb() as any;
  const { data: existing } = await db
    .from(config.commentsTable)
    .select("id")
    .eq("id", commentId)
    .eq("workspace_id", workspaceId)
    .maybeSingle();
  if (!existing) return { ok: false, error: "Comment not found." };

  const { error } = await db
    .from(config.commentsTable)
    .update({ status, moderated_at: new Date().toISOString() })
    .eq("id", commentId)
    .eq("workspace_id", workspaceId);

  if (error) return { ok: false, error: error.message };
  return { ok: true };
}

export async function deleteComment(
  config: ContentTypeConfig,
  commentId: string,
  workspaceId: string,
): Promise<{ ok: boolean; error?: string }> {
  const db = getDb() as any;
  const { data: existing } = await db
    .from(config.commentsTable)
    .select("id")
    .eq("id", commentId)
    .eq("workspace_id", workspaceId)
    .maybeSingle();
  if (!existing) return { ok: false, error: "Comment not found." };

  const { error } = await db
    .from(config.commentsTable)
    .delete()
    .eq("id", commentId)
    .eq("workspace_id", workspaceId);

  if (error) return { ok: false, error: error.message };
  return { ok: true };
}

export async function countApprovedComments(
  config: ContentTypeConfig,
  contentId: string,
): Promise<number> {
  const { count, error } = await (getDb() as any)
    .from(config.commentsTable)
    .select("id", { count: "exact", head: true })
    .eq(config.idCol, contentId)
    .eq("status", "approved");
  if (error) throw new Error(error.message);
  return count ?? 0;
}
