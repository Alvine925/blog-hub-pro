import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { format } from "date-fns";
import {
  CheckCircle, XCircle, AlertTriangle, Trash2, RotateCcw,
  MessageSquare, ExternalLink, ChevronLeft, ChevronRight,
  FileText, Newspaper, BookOpen, ShoppingBag,
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
  type AdminComment,
} from "@/lib/comments.functions";
import {
  listAdminContentCommentsGlobal,
  moderateContentCommentFn,
  deleteContentCommentFn,
  type ContentAdminCommentGlobal,
} from "@/lib/engagement.functions";

export const Route = createFileRoute("/admin/comments")({
  head: () => ({ meta: [{ title: "Comments — Admin" }] }),
  component: CommentsPage,
});

// ── Content type tabs ─────────────────────────────────────────────────────────

type ContentTypeTab = "blogs" | "news" | "articles" | "products";

const CONTENT_TYPE_TABS: {
  id: ContentTypeTab;
  label: string;
  icon: React.ComponentType<{ className?: string }>;
}[] = [
  { id: "blogs",    label: "Blog Posts", icon: FileText    },
  { id: "news",     label: "News",       icon: Newspaper   },
  { id: "articles", label: "Articles",   icon: BookOpen    },
  { id: "products", label: "Products",   icon: ShoppingBag },
];

// ── Status tabs ───────────────────────────────────────────────────────────────

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

// ── Main page ─────────────────────────────────────────────────────────────────

function CommentsPage() {
  const [activeContentType, setActiveContentType] = useState<ContentTypeTab>("blogs");
  const [activeTab, setActiveTab]                 = useState<CommentStatus>("pending");
  const [page, setPage]                           = useState(1);

  function switchContentType(ct: ContentTypeTab) {
    setActiveContentType(ct);
    setPage(1);
  }

  function switchStatus(s: CommentStatus) {
    setActiveTab(s);
    setPage(1);
  }

  return (
    <div className="space-y-6 p-6">
      <div>
        <h1 className="text-2xl font-bold">Comments</h1>
        <p className="mt-0.5 text-sm text-muted-foreground">
          Moderate reader comments across all content types and workspaces.
        </p>
      </div>

      {/* Content type selector */}
      <div className="flex gap-1 rounded-xl border border-border bg-muted/40 p-1 w-fit">
        {CONTENT_TYPE_TABS.map((ct) => {
          const active = activeContentType === ct.id;
          return (
            <button
              key={ct.id}
              onClick={() => switchContentType(ct.id)}
              className={`flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-xs font-medium transition-all ${
                active
                  ? "bg-white shadow-sm text-foreground"
                  : "text-muted-foreground hover:text-foreground"
              }`}
            >
              <ct.icon className="h-3.5 w-3.5" />
              {ct.label}
            </button>
          );
        })}
      </div>

      {activeContentType === "blogs" ? (
        <BlogCommentsPanel
          activeTab={activeTab}
          page={page}
          onTabChange={switchStatus}
          onPageChange={setPage}
        />
      ) : (
        <ContentCommentsPanel
          contentType={activeContentType as "news" | "articles" | "products"}
          activeTab={activeTab}
          page={page}
          onTabChange={switchStatus}
          onPageChange={setPage}
        />
      )}
    </div>
  );
}

// ── Blog comments panel (existing behavior) ───────────────────────────────────

function BlogCommentsPanel({
  activeTab, page, onTabChange, onPageChange,
}: {
  activeTab: CommentStatus;
  page: number;
  onTabChange: (s: CommentStatus) => void;
  onPageChange: (p: number) => void;
}) {
  const listFn     = useServerFn(listAdminComments);
  const moderateFn = useServerFn(moderateComment);
  const deleteFn   = useServerFn(deleteCommentPermanently);
  const countsFn   = useServerFn(getCommentCounts);
  const qc         = useQueryClient();

  const { data: counts } = useQuery({
    queryKey: ["blog-comment-counts"],
    queryFn:  () => countsFn(),
    refetchInterval: 30_000,
  });

  const { data, isLoading } = useQuery({
    queryKey: ["blog-comments", activeTab, page],
    queryFn:  () => listFn({ data: { status: activeTab, page, limit: LIMIT } }),
  });

  const invalidate = () => {
    qc.invalidateQueries({ queryKey: ["blog-comments"] });
    qc.invalidateQueries({ queryKey: ["blog-comment-counts"] });
  };

  const moderateMutation = useMutation({
    mutationFn: ({ id, status }: { id: string; status: CommentStatus }) =>
      moderateFn({ data: { id, status } }),
    onSuccess: (_r, { status }) => { toast.success(`Comment ${status}`); invalidate(); },
    onError:   (e) => toast.error(e instanceof Error ? e.message : "Action failed"),
  });

  const deleteMutation = useMutation({
    mutationFn: (id: string) => deleteFn({ data: { id } }),
    onSuccess: () => { toast.success("Comment deleted permanently"); invalidate(); },
    onError:   (e) => toast.error(e instanceof Error ? e.message : "Delete failed"),
  });

  function actions(id: string, status: CommentStatus) {
    const btn = (label: string, nextStatus: CommentStatus, icon: React.ReactNode) => (
      <Button
        key={label}
        size="sm"
        variant="ghost"
        className="h-7 gap-1 text-xs"
        onClick={() => moderateMutation.mutate({ id, status: nextStatus })}
        disabled={moderateMutation.isPending}
      >
        {icon} {label}
      </Button>
    );
    const btns: React.ReactNode[] = [];
    if (status !== "approved") btns.push(btn("Approve", "approved", <CheckCircle className="h-3 w-3 text-green-600" />));
    if (status !== "rejected") btns.push(btn("Reject",  "rejected", <XCircle    className="h-3 w-3 text-gray-500" />));
    if (status !== "spam")     btns.push(btn("Spam",    "spam",     <AlertTriangle className="h-3 w-3 text-red-500" />));
    if (status !== "trash")    btns.push(btn("Trash",   "trash",    <Trash2    className="h-3 w-3 text-red-500" />));
    if (["trash","rejected","spam"].includes(status))
      btns.push(btn("Restore", "pending", <RotateCcw className="h-3 w-3 text-blue-500" />));
    if (status === "trash") {
      btns.push(
        <Button
          key="delete"
          size="sm"
          variant="ghost"
          className="h-7 gap-1 text-xs text-red-600 hover:text-red-700 hover:bg-red-50"
          onClick={() => confirm("Permanently delete this comment?") && deleteMutation.mutate(id)}
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
    <>
      <StatusTabBar
        tabs={STATUS_TABS}
        counts={counts ?? {}}
        active={activeTab}
        onChange={onTabChange}
      />

      {isLoading ? (
        <LoadingSpinner />
      ) : comments.length === 0 ? (
        <EmptyState label={activeTab} />
      ) : (
        <div className="divide-y divide-border rounded-xl border border-border">
          {comments.map((comment) => (
            <div key={comment.id} className="space-y-2 p-4">
              <div className="flex flex-wrap items-start gap-2">
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
              <p className="text-sm text-foreground/90 pl-10 whitespace-pre-wrap line-clamp-4">
                {comment.content}
              </p>
              <div className="flex flex-wrap gap-1 pl-10">
                {actions(comment.id, comment.status as CommentStatus)}
              </div>
            </div>
          ))}
        </div>
      )}

      <Pagination page={page} totalPages={totalPages} total={total} onChange={onPageChange} />
    </>
  );
}

// ── Content comments panel (news / articles / products) ───────────────────────

function ContentCommentsPanel({
  contentType, activeTab, page, onTabChange, onPageChange,
}: {
  contentType: "news" | "articles" | "products";
  activeTab: CommentStatus;
  page: number;
  onTabChange: (s: CommentStatus) => void;
  onPageChange: (p: number) => void;
}) {
  const listFn     = useServerFn(listAdminContentCommentsGlobal);
  const moderateFn = useServerFn(moderateContentCommentFn);
  const deleteFn   = useServerFn(deleteContentCommentFn);
  const qc         = useQueryClient();

  const { data, isLoading } = useQuery({
    queryKey: ["content-comments-global", contentType, activeTab, page],
    queryFn:  () => listFn({ data: { contentType, status: activeTab, page, limit: LIMIT } }),
  });

  const invalidate = () => qc.invalidateQueries({ queryKey: ["content-comments-global", contentType] });

  const moderateMutation = useMutation({
    mutationFn: ({ comment, status }: { comment: ContentAdminCommentGlobal; status: CommentStatus }) =>
      moderateFn({ data: { commentId: comment.id, workspaceId: comment.workspace_id, contentType, status } }),
    onSuccess: (_r, { status }) => { toast.success(`Comment ${status}`); invalidate(); },
    onError:   (e) => toast.error(e instanceof Error ? e.message : "Action failed"),
  });

  const deleteMutation = useMutation({
    mutationFn: (comment: ContentAdminCommentGlobal) =>
      deleteFn({ data: { commentId: comment.id, workspaceId: comment.workspace_id, contentType } }),
    onSuccess: () => { toast.success("Comment deleted permanently"); invalidate(); },
    onError:   (e) => toast.error(e instanceof Error ? e.message : "Delete failed"),
  });

  function actions(comment: ContentAdminCommentGlobal) {
    const status = comment.status as CommentStatus;
    const btn = (label: string, nextStatus: CommentStatus, icon: React.ReactNode) => (
      <Button
        key={label}
        size="sm"
        variant="ghost"
        className="h-7 gap-1 text-xs"
        onClick={() => moderateMutation.mutate({ comment, status: nextStatus })}
        disabled={moderateMutation.isPending}
      >
        {icon} {label}
      </Button>
    );
    const btns: React.ReactNode[] = [];
    if (status !== "approved") btns.push(btn("Approve", "approved", <CheckCircle className="h-3 w-3 text-green-600" />));
    if (status !== "rejected") btns.push(btn("Reject",  "rejected", <XCircle    className="h-3 w-3 text-gray-500" />));
    if (status !== "spam")     btns.push(btn("Spam",    "spam",     <AlertTriangle className="h-3 w-3 text-red-500" />));
    if (status !== "trash")    btns.push(btn("Trash",   "trash",    <Trash2    className="h-3 w-3 text-red-500" />));
    if (["trash","rejected","spam"].includes(status))
      btns.push(btn("Restore", "pending", <RotateCcw className="h-3 w-3 text-blue-500" />));
    if (status === "trash") {
      btns.push(
        <Button
          key="delete"
          size="sm"
          variant="ghost"
          className="h-7 gap-1 text-xs text-red-600 hover:text-red-700 hover:bg-red-50"
          onClick={() => confirm("Permanently delete this comment?") && deleteMutation.mutate(comment)}
          disabled={deleteMutation.isPending}
        >
          <Trash2 className="h-3 w-3" /> Delete Forever
        </Button>,
      );
    }
    return btns;
  }

  const comments   = data?.rows   ?? [];
  const total      = data?.total  ?? 0;
  const totalPages = Math.ceil(total / LIMIT);

  return (
    <>
      <StatusTabBar
        tabs={STATUS_TABS}
        counts={{}}
        active={activeTab}
        onChange={onTabChange}
      />

      {isLoading ? (
        <LoadingSpinner />
      ) : comments.length === 0 ? (
        <EmptyState label={activeTab} />
      ) : (
        <div className="divide-y divide-border rounded-xl border border-border">
          {comments.map((comment) => (
            <div key={comment.id} className="space-y-2 p-4">
              <div className="flex flex-wrap items-start gap-2">
                <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-muted text-xs font-bold text-muted-foreground">
                  {comment.author_name.slice(0, 2).toUpperCase()}
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="text-sm font-medium">{comment.author_name}</span>
                    <span className="text-xs text-muted-foreground">{comment.author_email}</span>
                    {comment.author_website && (
                      <a
                        href={comment.author_website}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="flex items-center gap-0.5 text-xs text-primary hover:underline"
                      >
                        <ExternalLink className="h-3 w-3" />
                        {comment.author_website.replace(/^https?:\/\//, "").slice(0, 30)}
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
              <p className="text-sm text-foreground/90 pl-10 whitespace-pre-wrap line-clamp-4">
                {comment.content}
              </p>
              <div className="flex flex-wrap gap-1 pl-10">
                {actions(comment)}
              </div>
            </div>
          ))}
        </div>
      )}

      <Pagination page={page} totalPages={totalPages} total={total} onChange={onPageChange} />
    </>
  );
}

// ── Shared sub-components ─────────────────────────────────────────────────────

function StatusTabBar({
  tabs, counts, active, onChange,
}: {
  tabs: { id: CommentStatus; label: string }[];
  counts: Record<string, number>;
  active: CommentStatus;
  onChange: (s: CommentStatus) => void;
}) {
  return (
    <div className="flex gap-1 border-b border-border">
      {tabs.map((tab) => {
        const count = counts[tab.id] ?? 0;
        const isActive = active === tab.id;
        return (
          <button
            key={tab.id}
            onClick={() => onChange(tab.id)}
            className={`flex items-center gap-1.5 border-b-2 px-4 py-2.5 text-sm font-medium transition-colors ${
              isActive
                ? "border-primary text-foreground"
                : "border-transparent text-muted-foreground hover:text-foreground"
            }`}
          >
            {tab.label}
            {count > 0 && (
              <span className={`rounded-full px-1.5 py-0.5 text-[10px] font-bold ${
                isActive ? "bg-primary text-white" : "bg-muted text-muted-foreground"
              }`}>
                {count > 99 ? "99+" : count}
              </span>
            )}
          </button>
        );
      })}
    </div>
  );
}

function LoadingSpinner() {
  return (
    <div className="flex items-center justify-center py-16">
      <div className="h-5 w-5 animate-spin rounded-full border-2 border-border border-t-primary" />
    </div>
  );
}

function EmptyState({ label }: { label: string }) {
  return (
    <div className="flex flex-col items-center justify-center gap-2 py-16 text-muted-foreground">
      <MessageSquare className="h-8 w-8 opacity-30" />
      <p className="text-sm">No {label} comments</p>
    </div>
  );
}

function Pagination({
  page, totalPages, total, onChange,
}: {
  page: number;
  totalPages: number;
  total: number;
  onChange: (p: number) => void;
}) {
  if (totalPages <= 1) return null;
  return (
    <div className="flex items-center justify-between text-sm text-muted-foreground">
      <span>{total} comment{total !== 1 ? "s" : ""}</span>
      <div className="flex items-center gap-1">
        <Button
          size="icon" variant="ghost" className="h-7 w-7"
          disabled={page === 1}
          onClick={() => onChange(page - 1)}
        >
          <ChevronLeft className="h-4 w-4" />
        </Button>
        <span className="text-xs">Page {page} of {totalPages}</span>
        <Button
          size="icon" variant="ghost" className="h-7 w-7"
          disabled={page === totalPages}
          onClick={() => onChange(page + 1)}
        >
          <ChevronRight className="h-4 w-4" />
        </Button>
      </div>
    </div>
  );
}
