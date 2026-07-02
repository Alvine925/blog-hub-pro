import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { toast } from "sonner";
import {
  CheckCircle, XCircle, AlertTriangle, Trash2, RotateCcw,
  MessageSquare, Clock, Loader2, ExternalLink, ChevronLeft, ChevronRight,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  getAdminComments,
  moderateCommentFn,
  deleteCommentFn,
  type AdminComment,
} from "@/lib/engagement.functions";
import { format } from "date-fns";

// ── Route ─────────────────────────────────────────────────────────────────────

export const Route = createFileRoute("/admin/workspaces/$id/comments")({
  component: CommentsPage,
  errorComponent: ({ error }) => (
    <p className="p-8 text-sm text-red-600">{error.message}</p>
  ),
});

// ── Constants ─────────────────────────────────────────────────────────────────

type CommentStatus = "pending" | "approved" | "rejected" | "spam" | "trash";

const TABS: { label: string; value: CommentStatus; icon: React.ComponentType<{ className?: string }> }[] = [
  { label: "Pending",  value: "pending",  icon: Clock         },
  { label: "Approved", value: "approved", icon: CheckCircle   },
  { label: "Rejected", value: "rejected", icon: XCircle       },
  { label: "Spam",     value: "spam",     icon: AlertTriangle },
  { label: "Trash",    value: "trash",    icon: Trash2        },
];

const STATUS_BADGE: Record<CommentStatus, string> = {
  pending:  "bg-yellow-100 text-yellow-800",
  approved: "bg-green-100 text-green-800",
  rejected: "bg-red-100 text-red-700",
  spam:     "bg-orange-100 text-orange-800",
  trash:    "bg-gray-100 text-gray-600",
};

// Actions available per status
const ACTIONS: Record<CommentStatus, { label: string; targetStatus?: CommentStatus; isDelete?: boolean; icon: React.ComponentType<{ className?: string }>; variant: "default" | "destructive" | "outline" | "secondary" | "ghost" }[]> = {
  pending: [
    { label: "Approve", targetStatus: "approved", icon: CheckCircle, variant: "default"     },
    { label: "Reject",  targetStatus: "rejected", icon: XCircle,     variant: "outline"     },
    { label: "Spam",    targetStatus: "spam",     icon: AlertTriangle,variant: "outline"    },
  ],
  approved: [
    { label: "Reject",  targetStatus: "rejected", icon: XCircle,     variant: "outline"     },
    { label: "Spam",    targetStatus: "spam",     icon: AlertTriangle,variant: "outline"    },
    { label: "Trash",   targetStatus: "trash",    icon: Trash2,      variant: "destructive" },
  ],
  rejected: [
    { label: "Approve", targetStatus: "approved", icon: CheckCircle, variant: "default"     },
    { label: "Spam",    targetStatus: "spam",     icon: AlertTriangle,variant: "outline"    },
    { label: "Trash",   targetStatus: "trash",    icon: Trash2,      variant: "destructive" },
  ],
  spam: [
    { label: "Approve", targetStatus: "approved", icon: CheckCircle, variant: "default"     },
    { label: "Trash",   targetStatus: "trash",    icon: Trash2,      variant: "destructive" },
  ],
  trash: [
    { label: "Restore", targetStatus: "pending",  icon: RotateCcw,   variant: "outline"    },
    { label: "Delete permanently", isDelete: true,icon: Trash2,      variant: "destructive" },
  ],
};

// ── Page ──────────────────────────────────────────────────────────────────────

function CommentsPage() {
  const { id: workspaceId } = Route.useParams();
  const [activeTab, setActiveTab] = useState<CommentStatus>("pending");
  const [page, setPage] = useState(1);
  const LIMIT = 20;

  const doGetComments  = useServerFn(getAdminComments);
  const doModerate     = useServerFn(moderateCommentFn);
  const doDelete       = useServerFn(deleteCommentFn);
  const queryClient    = useQueryClient();

  const { data, isLoading } = useQuery({
    queryKey: ["admin", "comments", workspaceId, activeTab, page],
    queryFn: () => doGetComments({ data: { workspaceId, status: activeTab, page, limit: LIMIT } }),
  });

  const comments  = data?.rows ?? [];
  const total     = data?.total ?? 0;
  const totalPages = Math.ceil(total / LIMIT);

  const invalidate = () =>
    queryClient.invalidateQueries({ queryKey: ["admin", "comments", workspaceId] });

  const moderateMutation = useMutation({
    mutationFn: ({ commentId, status }: { commentId: string; status: CommentStatus }) =>
      doModerate({ data: { commentId, workspaceId, status } }),
    onSuccess: (_, { status }) => {
      toast.success(`Comment marked as ${status}`);
      invalidate();
    },
    onError: (err) => toast.error(err instanceof Error ? err.message : "Failed"),
  });

  const deleteMutation = useMutation({
    mutationFn: (commentId: string) =>
      doDelete({ data: { commentId, workspaceId } }),
    onSuccess: () => {
      toast.success("Comment permanently deleted");
      invalidate();
    },
    onError: (err) => toast.error(err instanceof Error ? err.message : "Failed"),
  });

  function handleTabChange(tab: CommentStatus) {
    setActiveTab(tab);
    setPage(1);
  }

  const busy = moderateMutation.isPending || deleteMutation.isPending;

  return (
    <div className="min-h-full px-8 py-8">
      {/* Header */}
      <div className="mb-6">
        <h1 className="text-xl font-semibold">Comments</h1>
        <p className="mt-0.5 text-sm text-muted-foreground">
          Moderate reader comments across all blog posts.
        </p>
      </div>

      {/* Tabs */}
      <div className="mb-6 flex items-center gap-1 border-b border-border">
        {TABS.map((tab) => (
          <button
            key={tab.value}
            onClick={() => handleTabChange(tab.value)}
            className={[
              "flex items-center gap-1.5 px-4 py-2.5 text-sm font-medium border-b-2 transition-colors -mb-px",
              activeTab === tab.value
                ? "border-primary text-primary"
                : "border-transparent text-muted-foreground hover:text-foreground",
            ].join(" ")}
          >
            <tab.icon className="h-3.5 w-3.5" />
            {tab.label}
          </button>
        ))}
      </div>

      {/* Loading */}
      {isLoading && (
        <div className="flex items-center justify-center py-20">
          <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
        </div>
      )}

      {/* Empty */}
      {!isLoading && comments.length === 0 && (
        <div className="flex flex-col items-center justify-center py-20 text-center">
          <MessageSquare className="mb-3 h-10 w-10 text-muted-foreground/30" />
          <p className="font-medium text-muted-foreground">No {activeTab} comments</p>
          <p className="mt-1 text-sm text-muted-foreground/60">
            {activeTab === "pending"
              ? "All comments are moderated — new ones will appear here."
              : `No comments with status "${activeTab}".`}
          </p>
        </div>
      )}

      {/* Comment list */}
      {!isLoading && comments.length > 0 && (
        <div className="space-y-3">
          {comments.map((comment) => (
            <CommentCard
              key={comment.id}
              comment={comment}
              status={activeTab}
              busy={busy}
              onModerate={(status) =>
                moderateMutation.mutate({ commentId: comment.id, status })
              }
              onDelete={() => deleteMutation.mutate(comment.id)}
            />
          ))}
        </div>
      )}

      {/* Pagination */}
      {totalPages > 1 && (
        <div className="mt-6 flex items-center justify-between">
          <p className="text-xs text-muted-foreground">
            Page {page} of {totalPages} — {total} comment{total !== 1 ? "s" : ""}
          </p>
          <div className="flex items-center gap-2">
            <Button
              size="sm"
              variant="outline"
              disabled={page <= 1}
              onClick={() => setPage((p) => p - 1)}
            >
              <ChevronLeft className="h-3.5 w-3.5" />
              Previous
            </Button>
            <Button
              size="sm"
              variant="outline"
              disabled={page >= totalPages}
              onClick={() => setPage((p) => p + 1)}
            >
              Next
              <ChevronRight className="h-3.5 w-3.5" />
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}

// ── Comment card ──────────────────────────────────────────────────────────────

function CommentCard({
  comment,
  status,
  busy,
  onModerate,
  onDelete,
}: {
  comment: AdminComment;
  status: CommentStatus;
  busy: boolean;
  onModerate: (status: CommentStatus) => void;
  onDelete: () => void;
}) {
  const actions = ACTIONS[status] ?? [];

  return (
    <div className="rounded-lg border border-border bg-white p-5">
      <div className="flex items-start gap-4">
        {/* Avatar */}
        <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-muted text-sm font-semibold text-muted-foreground">
          {comment.author_name.slice(0, 1).toUpperCase()}
        </div>

        {/* Content */}
        <div className="min-w-0 flex-1">
          {/* Meta row */}
          <div className="mb-2 flex flex-wrap items-center gap-x-3 gap-y-1">
            <span className="font-medium text-sm">{comment.author_name}</span>
            <span className="text-xs text-muted-foreground">{comment.author_email}</span>
            {comment.author_website && (
              <a
                href={comment.author_website}
                target="_blank"
                rel="noopener noreferrer"
                className="flex items-center gap-0.5 text-xs text-muted-foreground hover:text-primary"
              >
                {comment.author_website} <ExternalLink className="h-3 w-3" />
              </a>
            )}
            <span className="text-xs text-muted-foreground">
              {format(new Date(comment.created_at), "MMM d, yyyy 'at' h:mm a")}
            </span>
            {comment.parent_id && (
              <Badge variant="secondary" className="text-[10px] px-1.5 py-0">Reply</Badge>
            )}
          </div>

          {/* Post link */}
          {comment.post_title && (
            <p className="mb-2 text-xs text-muted-foreground">
              On:{" "}
              <span className="font-medium text-foreground">{comment.post_title}</span>
            </p>
          )}

          {/* Comment body */}
          <p className="text-sm text-foreground leading-relaxed whitespace-pre-wrap break-words">
            {comment.content}
          </p>
        </div>

        {/* Status badge */}
        <span
          className={[
            "shrink-0 rounded-full px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide",
            STATUS_BADGE[status],
          ].join(" ")}
        >
          {status}
        </span>
      </div>

      {/* Actions */}
      <div className="mt-4 flex items-center gap-2 border-t border-border pt-3">
        {actions.map((action) => (
          <Button
            key={action.label}
            size="sm"
            variant={action.variant}
            disabled={busy}
            onClick={() =>
              action.isDelete ? onDelete() : onModerate(action.targetStatus!)
            }
            className="h-7 text-xs"
          >
            <action.icon className="mr-1 h-3 w-3" />
            {action.label}
          </Button>
        ))}
      </div>
    </div>
  );
}
