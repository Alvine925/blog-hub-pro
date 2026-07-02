/**
 * ViewService.ts — records a page view and increments the denormalized
 * `blog_posts.views` counter, deduped per visitor within a rolling window.
 */
import { getDb } from "../db.ts";
import { classifyDevice } from "../../_shared/visitor.ts";
import { bumpDaily } from "./PostLookup.ts";

const DEDUP_WINDOW_MINUTES = 30;

export interface RecordViewParams {
  postId: string;
  workspaceId: string | null;
  visitorId: string;
  referrer: string | null;
  userAgent: string | null;
}

export interface RecordViewResult {
  counted: boolean;
  totalViews: number;
}

export async function recordView(params: RecordViewParams): Promise<RecordViewResult> {
  const db = getDb();

  const since = new Date(Date.now() - DEDUP_WINDOW_MINUTES * 60_000).toISOString();
  const { data: recent, error: recentErr } = await db
    .from("blog_views")
    .select("id")
    .eq("blog_post_id", params.postId)
    .eq("visitor_id", params.visitorId)
    .gte("created_at", since)
    .limit(1)
    .maybeSingle();
  if (recentErr) throw new Error(recentErr.message);

  if (recent) {
    const { data: post } = await db
      .from("blog_posts")
      .select("views")
      .eq("id", params.postId)
      .maybeSingle();
    return { counted: false, totalViews: Number((post as Record<string, unknown> | null)?.views) || 0 };
  }

  const { error: insertErr } = await db.from("blog_views").insert({
    blog_post_id: params.postId,
    workspace_id: params.workspaceId,
    visitor_id: params.visitorId,
    referrer: params.referrer,
    device_type: classifyDevice(params.userAgent),
    user_agent: params.userAgent,
  });
  if (insertErr) throw new Error(insertErr.message);

  const { data: updated, error: rpcErr } = await db
    .from("blog_posts")
    .select("views")
    .eq("id", params.postId)
    .maybeSingle();
  if (rpcErr) throw new Error(rpcErr.message);

  const newTotal = (Number((updated as Record<string, unknown> | null)?.views) || 0) + 1;
  const { error: updateErr } = await db
    .from("blog_posts")
    .update({ views: newTotal })
    .eq("id", params.postId);
  if (updateErr) throw new Error(updateErr.message);

  bumpDaily(params.postId, params.workspaceId, "views");

  return { counted: true, totalViews: newTotal };
}
