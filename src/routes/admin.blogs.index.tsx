import { createFileRoute, Link } from "@tanstack/react-router";
import { queryOptions, useSuspenseQuery } from "@tanstack/react-query";
import { Eye, FileText, Clock, BarChart2, ExternalLink, FolderOpen } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from "@/components/ui/table";
import { adminListPosts } from "@/lib/blog.functions";
import { formatBlogDate, type BlogPostSummary } from "@/lib/blog-types";

const listQuery = queryOptions({
  queryKey: ["admin", "blog_posts"],
  queryFn: () => adminListPosts(),
});

export const Route = createFileRoute("/admin/blogs/")({
  loader: ({ context }) => context.queryClient.ensureQueryData(listQuery),
  component: AdminBlogList,
  errorComponent: ({ error }) => (
    <p className="text-sm text-destructive">Failed to load posts: {error.message}</p>
  ),
});

function StatusBadge({ post }: { post: BlogPostSummary }) {
  if (post.status === "published") return <Badge>published</Badge>;
  if (post.status === "scheduled") {
    return (
      <Badge className="bg-amber-500 text-white hover:bg-amber-500/90 gap-1">
        <Clock className="h-3 w-3" /> scheduled
      </Badge>
    );
  }
  return <Badge variant="secondary">draft</Badge>;
}

function AdminBlogList() {
  const { data: posts } = useSuspenseQuery(listQuery);

  return (
    <div className="space-y-6">
      <div className="flex items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold">Blog Posts</h1>
          <p className="text-sm text-muted-foreground">
            {posts.length} post{posts.length === 1 ? "" : "s"} across all workspaces —
            read-only view. To create or edit posts, open the workspace they belong to.
          </p>
        </div>
        <Button asChild variant="outline" size="sm" className="gap-2 shrink-0">
          <Link to="/admin/workspaces">
            <FolderOpen className="h-4 w-4" /> Go to Workspaces
          </Link>
        </Button>
      </div>

      {posts.length === 0 ? (
        <div className="flex flex-col items-center justify-center gap-4 py-24 text-center border-t border-border">
          <FileText className="h-10 w-10 text-muted-foreground" />
          <div className="space-y-1">
            <p className="font-medium">No blog posts yet</p>
            <p className="text-sm text-muted-foreground">Create posts from inside a workspace.</p>
          </div>
          <Button asChild variant="outline" className="gap-2">
            <Link to="/admin/workspaces">
              <FolderOpen className="h-4 w-4" /> Open a Workspace
            </Link>
          </Button>
        </div>
      ) : (
        <div className="overflow-x-auto">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="w-[70px]">Cover</TableHead>
                <TableHead>Title</TableHead>
                <TableHead>Workspace</TableHead>
                <TableHead>Category</TableHead>
                <TableHead>Status</TableHead>
                <TableHead>Date</TableHead>
                <TableHead className="text-right">Views</TableHead>
                <TableHead className="text-right">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {posts.map((post) => (
                <TableRow key={post.id}>
                  <TableCell>
                    {post.cover_image ? (
                      <img src={post.cover_image} alt="" className="h-10 w-14 rounded object-cover" />
                    ) : (
                      <div className="h-10 w-14 rounded bg-muted" />
                    )}
                  </TableCell>
                  <TableCell className="max-w-[280px]">
                    <span className="font-medium">{post.title || "Untitled"}</span>
                    {post.featured && (
                      <Badge variant="outline" className="ml-2">Featured</Badge>
                    )}
                  </TableCell>
                  <TableCell>
                    {post.workspace_id ? (
                      <Link
                        to="/admin/workspaces/$id/blogs"
                        params={{ id: post.workspace_id }}
                        className="text-sm text-primary hover:underline flex items-center gap-1"
                      >
                        {post.workspace?.name ?? "Workspace"}
                        <ExternalLink className="h-3 w-3" />
                      </Link>
                    ) : (
                      <span className="text-sm text-muted-foreground">{post.workspace?.name ?? "—"}</span>
                    )}
                  </TableCell>
                  <TableCell className="text-sm">{post.category}</TableCell>
                  <TableCell><StatusBadge post={post} /></TableCell>
                  <TableCell className="text-muted-foreground text-sm">
                    {post.status === "scheduled" && post.scheduled_at
                      ? `📅 ${formatBlogDate(post.scheduled_at)}`
                      : formatBlogDate(post.published_at) || "—"}
                  </TableCell>
                  <TableCell className="text-right tabular-nums">{post.views}</TableCell>
                  <TableCell>
                    <div className="flex items-center justify-end gap-1">
                      {/* Stats — always available */}
                      <Button size="icon" variant="ghost" asChild title="View stats">
                        <Link to="/admin/blog-stats/$postId" params={{ postId: post.id }}>
                          <BarChart2 className="h-4 w-4" />
                        </Link>
                      </Button>

                      {/* Public preview — published only */}
                      {post.status === "published" && (
                        <Button size="icon" variant="ghost" asChild title="Preview post">
                          <Link to="/blogs/$slug" params={{ slug: post.slug }} target="_blank">
                            <Eye className="h-4 w-4" />
                          </Link>
                        </Button>
                      )}

                      {/* Edit — opens inside the post's workspace */}
                      {post.workspace_id && (
                        <Button size="sm" variant="ghost" asChild title="Edit in workspace" className="gap-1.5 text-xs">
                          <Link
                            to="/admin/workspaces/$id/blogs/$postId/edit"
                            params={{ id: post.workspace_id, postId: post.id }}
                          >
                            <FolderOpen className="h-3.5 w-3.5" />
                            Edit
                          </Link>
                        </Button>
                      )}
                    </div>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      )}

      {/* Info callout */}
      <div className="rounded-xl border border-border/60 bg-muted/20 px-4 py-3">
        <p className="text-xs text-muted-foreground">
          <span className="font-semibold text-foreground">This is a read-only view.</span>{" "}
          To create, edit, publish, schedule, or delete a post, navigate to its workspace.
          Click the workspace name or <strong>Edit</strong> button above to jump directly there.
        </p>
      </div>
    </div>
  );
}
