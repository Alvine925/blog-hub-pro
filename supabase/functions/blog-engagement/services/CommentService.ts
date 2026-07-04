/**
 * CommentService.ts — public comment submission + moderation-status reads.
 *
 * Public write endpoint always creates comments with status "pending" (or
 * "approved" when the workspace disables the approval requirement).
 * Moderation transitions (approve/reject/spam/trash/delete) require a
 * secret key with the "manage:comments" permission — see index.ts guard.
 */
import { getDb } from "../db.ts";
import { sanitizeCommentContent, sanitizeText, sanitizeUrl, isValidEmail } from "../../_shared/sanitize.ts";
import { bumpDaily } from "./PostLookup.ts";

export interface PublicComment {
  id: string;
  parent_id: string | null;
  author_name: string;
  author_website: string | null;
  content: string;
  created_at: string;
}

export interface CommentTree extends PublicComment {
  replies: CommentTree[];
}

const COMMENT_PUBLIC_COLS = "id, parent_id, author_name, author_website, content, created_at, status";

function toPublicComment(row: Record<string, unknown>): PublicComment {
  return {
    id: row.id as string,
    parent_id: (row.parent_id as string | null) ?? null,
    author_name: (row.author_name as string) || "Anonymous",
    author_website: (row.author_website as string | null) ?? null,
    content: (row.content as string) || "",
    created_at: row.created_at as string,
  };
}

function buildTree(rows: PublicComment[]): CommentTree[] {
  const byId = new Map<string, CommentTree>();
  const roots: CommentTree[] = [];

  for (const row of rows) byId.set(row.id, { ...row, replies: [] });

  for (const row of rows) {
    const node = byId.get(row.id)!;
    if (row.parent_id && byId.has(row.parent_id)) {
      byId.get(row.parent_id)!.replies.push(node);
    } else {
      roots.push(node);
    }
  }

  return roots;
}

export async function listApprovedComments(
  postId: string,
  page: number,
  limit: number,
): Promise<{ rows: CommentTree[]; total: number }> {
  const db = getDb();
  const offset = (page - 1) * limit;

  const { data, count, error } = await db
    .from("blog_comments")
    .select(COMMENT_PUBLIC_COLS, { count: "exact" })
    .eq("blog_post_id", postId)
    .eq("status", "approved")
    .order("created_at", { ascending: true })
    .range(offset, offset + limit - 1);

  if (error) throw new Error(error.message);

  const flat = (data ?? []).map((r) => toPublicComment(r as Record<string, unknown>));
  return { rows: buildTree(flat), total: count ?? 0 };
}

export interface SubmitCommentParams {
  postId: string;
  workspaceId: string | null;
  parentId?: string | null;
  name: string;
  email: string;
  website?: string | null;
  content: string;
  visitorId: string | null;
  ip: string | null;
  userAgent: string | null;
  requireApproval: boolean;
  maxDepth: number;
}

export type SubmitCommentResult =
  | { ok: true; comment: { id: string; status: string; created_at: string } }
  | { ok: false; error: string };

async function sha256hex(str: string): Promise<string> {
  const buf = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(str));
  return Array.from(new Uint8Array(buf)).map((b) => b.toString(16).padStart(2, "0")).join("");
}

async function commentDepth(db: ReturnType<typeof getDb>, parentId: string): Promise<number> {
  let depth = 1;
  let current: string | null = parentId;
  while (current) {
    const { data } = await db.from("blog_comments").select("parent_id").eq("id", current).maybeSingle();
    const next = (data as Record<string, unknown> | null)?.parent_id as string | null | undefined;
    if (!next) break;
    depth += 1;
    current = next;
    if (depth > 20) break; // safety cap
  }
  return depth;
}

export async function submitComment(params: SubmitCommentParams): Promise<SubmitCommentResult> {
  const name = sanitizeText(params.name, 100);
  const email = params.email?.trim().slice(0, 254) ?? "";
  const website = sanitizeUrl(params.website ?? null);
  const content = sanitizeCommentContent(params.content, 5000);

  if (!name) return { ok: false, error: "Name is required." };
  if (!email || !isValidEmail(email)) return { ok: false, error: "A valid email is required." };
  if (!content) return { ok: false, error: "Comment content is required." };

  const db = getDb();

  if (params.parentId) {
    const { data: parent, error: parentErr } = await db
      .from("blog_comments")
      .select("id, blog_post_id, status")
      .eq("id", params.parentId)
      .maybeSingle();
    if (parentErr) throw new Error(parentErr.message);
    if (!parent || (parent as Record<string, unknown>).blog_post_id !== params.postId) {
      return { ok: false, error: "Parent comment not found on this post." };
    }
    const depth = await commentDepth(db, params.parentId);
    if (depth >= params.maxDepth) {
      return { ok: false, error: "Maximum reply depth exceeded." };
    }
  }

  const ipHash = params.ip ? await sha256hex(params.ip) : null;
  const status = params.requireApproval ? "pending" : "approved";

  const { data, error } = await db
    .from("blog_comments")
    .insert({
      blog_post_id: params.postId,
      workspace_id: params.workspaceId,
      parent_id: params.parentId ?? null,
      author_name: name,
      author_email: email,
      author_website: website,
      content,
      status,
      visitor_id: params.visitorId,
      ip_hash: ipHash,
      user_agent: params.userAgent,
    })
    .select("id, status, created_at")
    .single();

  if (error) throw new Error(error.message);

  if (status === "approved") {
    bumpDaily(params.postId, params.workspaceId, "comments");
  }

  const result = { ok: true, comment: data as { id: string; status: string; created_at: string } };

  // Fire-and-forget: notify workspace admins/editors of the new comment
  notifyOnComment({
    workspaceId: params.workspaceId,
    postId: params.postId,
    commentId: (data as { id: string }).id,
    authorName: name,
    authorEmail: email,
    content,
  }).catch(() => {/* non-fatal — never block the response */});

  return result;
}

/** Insert an in-app notification and send emails to workspace admins/editors. */
async function notifyOnComment(opts: {
  workspaceId: string | null;
  postId: string;
  commentId: string;
  authorName: string;
  authorEmail: string;
  content: string;
}): Promise<void> {
  if (!opts.workspaceId) return; // can't target workspace

  const db = getDb();

  // 1. Get the post title for context
  const { data: post } = await db
    .from("blog_posts")
    .select("title, slug")
    .eq("id", opts.postId)
    .maybeSingle();
  const postTitle = (post as Record<string, string> | null)?.title ?? "a post";

  // 2. Insert one in-app notification scoped to this workspace
  await db.from("notifications").insert({
    workspace_id: opts.workspaceId,
    type: "comment",
    title: `New comment on "${postTitle}"`,
    body: `${opts.authorName} wrote: "${opts.content.slice(0, 120)}${opts.content.length > 120 ? "…" : ""}"`,
    action_url: "/admin/comments",
    action_label: "Review comment",
    metadata: { comment_id: opts.commentId, post_id: opts.postId, author_email: opts.authorEmail },
  });

  // 3. Fetch workspace admin/editor emails for the email blast
  const { data: members } = await db
    .from("workspace_members")
    .select("email, name")
    .eq("workspace_id", opts.workspaceId)
    .in("workspace_role", ["workspace_admin", "editor"])
    .eq("status", "active");

  const recipients = ((members ?? []) as { email: string; name: string | null }[])
    .filter((m) => m.email);

  if (!recipients.length) return;

  // 4. Send email notification via the transactional email function
  const supabaseUrl = Deno.env.get("SUPABASE_URL") ?? "";
  const serviceKey  = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "";
  const siteUrl     = Deno.env.get("SITE_URL") ?? supabaseUrl;

  await fetch(`${supabaseUrl}/functions/v1/send-transactional-email`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${serviceKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      type: "comment",
      to: recipients.map((r) => ({ email: r.email, name: r.name ?? undefined })),
      data: {
        postTitle,
        authorName: opts.authorName,
        commentContent: opts.content,
        commentId: opts.commentId,
        moderateUrl: `${siteUrl}/admin/comments`,
      },
    }),
  });
}

export async function countApprovedComments(postId: string): Promise<number> {
  const { count, error } = await getDb()
    .from("blog_comments")
    .select("id", { count: "exact", head: true })
    .eq("blog_post_id", postId)
    .eq("status", "approved");
  if (error) throw new Error(error.message);
  return count ?? 0;
}

// ── Moderation (secret key + manage:comments only) ──────────────────────────

const MODERATION_STATUSES = new Set(["pending", "approved", "rejected", "spam", "trash"]);

export async function moderateComment(
  commentId: string,
  workspaceId: string,
  status: string,
): Promise<{ ok: boolean; error?: string }> {
  if (!MODERATION_STATUSES.has(status)) {
    return { ok: false, error: "Invalid status." };
  }

  const db = getDb();
  const { data: existing, error: findErr } = await db
    .from("blog_comments")
    .select("id, status, blog_post_id, workspace_id")
    .eq("id", commentId)
    .eq("workspace_id", workspaceId)
    .maybeSingle();
  if (findErr) throw new Error(findErr.message);
  if (!existing) return { ok: false, error: "Comment not found." };

  const wasApproved = (existing as Record<string, unknown>).status === "approved";

  const { error } = await db
    .from("blog_comments")
    .update({ status, moderated_at: new Date().toISOString() })
    .eq("id", commentId);
  if (error) throw new Error(error.message);

  if (!wasApproved && status === "approved") {
    bumpDaily((existing as Record<string, unknown>).blog_post_id as string, workspaceId, "comments");
  }

  return { ok: true };
}

export async function deleteComment(
  commentId: string,
  workspaceId: string,
): Promise<{ ok: boolean; error?: string }> {
  const db = getDb();
  const { error } = await db
    .from("blog_comments")
    .delete()
    .eq("id", commentId)
    .eq("workspace_id", workspaceId);
  if (error) throw new Error(error.message);
  return { ok: true };
}
