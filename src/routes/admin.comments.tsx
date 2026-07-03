import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/start";
import { format } from "date-fns";
import {
  CheckCircle, XCircle, AlertTriangle, Trash2, RotateCcw,
  MessageSquare, ExternalLink, ChevronLeft, ChevronRight,
} from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  listAdminComments,
  moderateComment,
  deleteCommentPermanently,
  getCommentCounts,
  type CommentStatus,
} from "@/lib/comments.functions";

export const Route = createFileRoute("/admin/comments")({
  head: () => ({ meta: [{ title: "Comments — Admin" }] }),
  component: CommentsPage,
});

const STATUS_TABS: { id: CommentStatus; label: string }[] = [
  { id: "pending",  label: "Pending"  },
  { id: "approved", label: "Approved" },
  { id: "rejected", label: "Rejected" },
  { id: "spam",     label: "Spam"     },
  { id: "trash",    label: "Trash"    },
];

const STATUS_BADGE: Record<CommentStatus, { label: string; className: string }> = {
  pending:  { label: "Pending",  className: "bg-yellow-100 text-yellow-800 border-yellow-200" },
  approved: { label: "Approved", className: "bg-green-100 text-green-800 border-green-200"   },
  rejected: { label: "Rejected", className: "bg-gray-100  text-gray-800  border-gray-200"    },
  spam:     { label: "Spam",     className: "bg-red-100   text-red-800   border-red-200"      },
  trash:    { label: "Trash",    className: "bg-red-50    text-red-600   border-red-100"      },
};

const LIMIT = 25;

function CommentsPage() {
  const [activeTab, setActiveTab]   = useState<CommentStatus>("pending");
  const [page, setPage]             = useState(1);
  const listFn    = useServerFn(listAdminComments);
  const moderateFn = useServerFn(moderateComment);
  const deleteFn  = useServerFn(deleteCommentPermanently);
  const countsFn  = useServerFn(getCommentCounts);
  const qc        = useQueryClient();

  const { data: counts } = useQuery({
    queryKey: ["comment-counts"],
    queryFn:  () => countsFn(),
    refetchInterval: 30_000,
  });

  const { data, isLoading } = useQuery({
    queryKey: ["comments", activeTab, page],
    queryFn:  () => listFn({ data: { status: activeTab, page, limit: LIMIT } }),
  });

  const invalidate = () => {
    qc.invalidateQueries({ queryKey: ["comments"] });
    qc.invalidateQueries({ queryKey: ["comment-counts"] });
  };

  const moderateMutation = useMutation({
    mutationFn: ({ id, status }: { id: string; status: CommentStatus }) =>
      moderateFn({ data: { id, status } }),
    onSuccess: (_r, { status }) => {
      toast.success(`Comment ${status}`);
      invalidate();
    },
    onError: (e) => toast.error(e instanceof Error ? e.message : "Action failed"),
  });

  const deleteMutation = useMutation({
    mutationFn: (id: string) => deleteFn({ data: { id } }),
    onSuccess: () => { toast.success("Comment deleted permanently"); invalidate(); },
    onError:   (e) => toast.error(e instanceof Error ? e.message : "Delete failed"),
  });

  function actions(id: string, status: CommentStatus) {
    const btn = (label: string, nextStatus: CommentStatus, icon: React.ReactNode, variant = "ghost" as const) => (
      <Button
        key={label}
        size="sm"
        variant={variant}
        className="h-7 gap-1 text-xs"
        onClick={() => moderateMutation.mutate({ id, status: nextStatus })}
        disabled={moderateMutation.isPending}
      >
        {icon} {label}
      </Button>
    );

    const btns: React.ReactNode[] = [];
    if (status !== "approved") btns.push(btn("Approve", "approved", <CheckCircle className="h-3 w-3 text-green-600" />));
    if (status !== "rejected") btns.push(btn("Reject",  "rejected", <XCircle className="h-3 w-3 text-gray-500" />));
    if (status !== "spam")     btns.push(btn("Spam",    "spam",     <AlertTriangle className="h-3 w-3 text-red-500" />));
    if (status !== "trash")    btns.push(btn("Trash",   "trash",    <Trash2 className="h-3 w-3 text-red-500" />));
    if (status === "trash" || status === "rejected" || status === "spam")
      btns.push(btn("Restore", "pending", <RotateCcw className="h-3 w-3 text-blue-500" />));

    if (status === "trash") {
      btns.push(
        <Button
          key="delete"
          size="sm"
          variant="ghost"
          className="h-7 gap-1 text-xs text-red-600 hover:text-red-700 hover:bg-red-50"
          onClick={() => {
            if (confirm("Permanently delete this comment? This cannot be undone.")) {
              deleteMutation.mutate(id);
            }
          }}
          disabled={deleteMutation.isPending}
        >
          <Trash2 className="h-3 w-3" /> Delete Forever
        </Button>,
      );
    }
    return btns;
  }

  const comments   = data?.comments  ?? [];
  const total      = data?.total     ?? 0;
  const totalPages = Math.ceil(total / LIMIT);

  return (
    <div className="space-y-6 p-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">Comments</h1>
          <p className="mt-0.5 text-sm text-muted-foreground">
            Moderate reader comments across all blog posts.
          </p>
        </div>
      </div>

      {/* Status tabs */}
      <div className="flex gap-1 border-b border-border">
        {STATUS_TABS.map((tab) => {
          const count = counts?.[tab.id] ?? 0;
          const active = activeTab === tab.id;
          return (
            <button
              key={tab.id}
              onClick={() => { setActiveTab(tab.id); setPage(1); }}
              className={`flex items-center gap-1.5 border-b-2 px-4 py-2.5 text-sm font-medium transition-colors ${
                active
                  ? "border-primary text-foreground"
                  : "border-transparent text-muted-foreground hover:text-foreground"
              }`}
            >
              {tab.label}
              {count > 0 && (
                <span className={`rounded-full px-1.5 py-0.5 text-[10px] font-bold ${
                  active ? "bg-primary text-white" : "bg-muted text-muted-foreground"
                }`}>
                  {count > 99 ? "99+" : count}
                </span>
              )}
            </button>
          );
        })}
      </div>

      {/* Comment list */}
      {isLoading ? (
        <div className="flex items-center justify-center py-16">
          <div className="h-5 w-5 animate-spin rounded-full border-2 border-border border-t-primary" />
        </div>
      ) : comments.length === 0 ? (
        <div className="flex flex-col items-center justify-center gap-2 py-16 text-muted-foreground">
          <MessageSquare className="h-8 w-8 opacity-30" />
          <p className="text-sm">No {activeTab} comments</p>
        </div>
      ) : (
        <div className="divide-y divide-border rounded-xl border border-border">
          {comments.map((comment) => (
            <div key={comment.id} className="space-y-2 p-4">
              <div className="flex flex-wrap items-start gap-2">
                {/* Author */}
                <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-muted text-xs font-bold text-muted-foreground">
                  {comment.name.slice(0, 2).toUpperCase()}
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="text-sm font-medium">{comment.name}</span>
                    {comment.email && (
                      <span className="text-xs text-muted-foreground">{comment.email}</span>
                    )}
                    {comment.website && (
                      <a
                        href={comment.website}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="flex items-center gap-0.5 text-xs text-primary hover:underline"
                      >
                        <ExternalLink className="h-3 w-3" />
                        {comment.website.replace(/^https?:\/\//, "").slice(0, 30)}
                      </a>
                    )}
                    <Badge
                      variant="outline"
                      className={`text-[10px] px-1.5 py-0 ${STATUS_BADGE[comment.status as CommentStatus].className}`}
                    >
                      {STATUS_BADGE[comment.status as CommentStatus].label}
                    </Badge>
                  </div>
                  <div className="mt-0.5 flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
                    {comment.post_title && (
                      <span className="truncate max-w-[200px]">
                        on <span className="font-medium text-foreground">{comment.post_title}</span>
                      </span>
                    )}
                    <span>{format(new Date(comment.created_at), "MMM d, yyyy · h:mm a")}</span>
                    {comment.parent_id && (
                      <span className="rounded bg-muted px-1 text-[10px]">Reply</span>
                    )}
                  </div>
                </div>
              </div>

              {/* Content */}
              <p className="text-sm text-foreground/90 pl-10 whitespace-pre-wrap line-clamp-4">
                {comment.content}
              </p>

              {/* Actions */}
              <div className="flex flex-wrap gap-1 pl-10">
                {actions(comment.id, comment.status as CommentStatus)}
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Pagination */}
      {totalPages > 1 && (
        <div className="flex items-center justify-between text-sm text-muted-foreground">
          <span>{total} comment{total !== 1 ? "s" : ""}</span>
          <div className="flex items-center gap-1">
            <Button
              size="icon" variant="ghost" className="h-7 w-7"
              disabled={page === 1}
              onClick={() => setPage(page - 1)}
            >
              <ChevronLeft className="h-4 w-4" />
            </Button>
            <span className="text-xs">Page {page} of {totalPages}</span>
            <Button
              size="icon" variant="ghost" className="h-7 w-7"
              disabled={page === totalPages}
              onClick={() => setPage(page + 1)}
            >
              <ChevronRight className="h-4 w-4" />
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}
