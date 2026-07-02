/**
 * EndpointRegistry.ts
 *
 * Single source of truth for every REST endpoint exposed by the Lunar CMS API.
 * The Documentation Engine reads this registry — never hardcode docs elsewhere.
 *
 * To add a new endpoint: append an entry below.
 * Documentation, examples, and code snippets update automatically.
 */

export type HttpMethod = "GET" | "POST" | "PUT" | "PATCH" | "DELETE";

export interface QueryParam {
  name: string;
  type: "string" | "integer" | "boolean" | "enum";
  required: boolean;
  default?: string;
  description: string;
  example: string;
  enumValues?: string[];
}

export interface ResponseField {
  name: string;
  type: string;
  description: string;
  nullable?: boolean;
}

export interface ApiVersion {
  version: "v1" | "v2" | "v3";
  status: "stable" | "beta" | "deprecated";
  deprecatedAt?: string;
  removedAt?: string;
}

export interface EndpointDefinition {
  /** Unique identifier used in URL fragments and bookmarks */
  id: string;
  /** HTTP method */
  method: HttpMethod;
  /** Path relative to /api/v1 */
  path: string;
  /** Human-readable title */
  title: string;
  /** Short description for lists */
  description: string;
  /** Detailed description for endpoint page */
  longDescription?: string;
  /** Category / group in the sidebar */
  category: "posts" | "collections" | "media" | "search" | "engagement" | "meta";
  /** Whether a Bearer token is required */
  authentication: boolean;
  /** Supports pagination (limit, offset) */
  pagination: boolean;
  /** Supports ?search= full-text search */
  search: boolean;
  /** Supported filter query params */
  filters: string[];
  /** Query parameters (excluding pagination/search which are auto-added) */
  queryParams: QueryParam[];
  /** Path params (e.g. :slug) */
  pathParams?: QueryParam[];
  /** Example response JSON */
  exampleResponse: object;
  /** Top-level response fields */
  responseFields?: ResponseField[];
  /** Possible error codes */
  possibleErrors: number[];
  /** API versions this endpoint appears in */
  versions: ApiVersion[];
  /** Added in this version */
  addedInVersion: string;
  /** If true, endpoint has been deprecated */
  deprecated?: boolean;
  /** Tags for documentation search */
  tags: string[];
}

// ── Registry ──────────────────────────────────────────────────────────────────

export const ENDPOINT_REGISTRY: EndpointDefinition[] = [
  // ── Posts ──────────────────────────────────────────────────────────────────
  {
    id: "list-posts",
    method: "GET",
    path: "/blogs",
    title: "List Posts",
    description: "Retrieve a paginated list of published blog posts.",
    longDescription:
      "Returns all published blog posts for the workspace associated with your API key. " +
      "Results are ordered by published date (newest first). Supports pagination via limit/offset, " +
      "full-text search, and filtering by category and featured status.",
    category: "posts",
    authentication: true,
    pagination: true,
    search: true,
    filters: ["category", "featured"],
    queryParams: [
      {
        name: "category",
        type: "string",
        required: false,
        description: "Filter posts by category name. Case-insensitive.",
        example: "Technology",
      },
      {
        name: "featured",
        type: "boolean",
        required: false,
        description: "Return only featured posts when set to true.",
        example: "true",
      },
    ],
    exampleResponse: {
      data: [
        {
          id: "550e8400-e29b-41d4-a716-446655440000",
          title: "Hello World",
          slug: "hello-world",
          excerpt: "Our first blog post.",
          cover_image: "https://example.com/image.jpg",
          category: "General",
          tags: ["intro", "launch"],
          author_name: "Admin",
          featured: false,
          reading_time: 2,
          views: 142,
          published_at: "2025-01-15T10:00:00Z",
          created_at: "2025-01-15T09:00:00Z",
          updated_at: "2025-01-20T08:30:00Z",
        },
      ],
      meta: { total: 45, limit: 20, offset: 0 },
    },
    responseFields: [
      { name: "id", type: "string (UUID)", description: "Post unique identifier." },
      { name: "title", type: "string", description: "Post title." },
      { name: "slug", type: "string", description: "URL-safe unique identifier." },
      { name: "excerpt", type: "string", description: "Short summary (max 300 chars).", nullable: true },
      { name: "cover_image", type: "string", description: "Cover image URL.", nullable: true },
      { name: "category", type: "string", description: "Category name.", nullable: true },
      { name: "tags", type: "string[]", description: "Array of tag strings." },
      { name: "author_name", type: "string", description: "Author display name.", nullable: true },
      { name: "featured", type: "boolean", description: "Whether the post is featured." },
      { name: "reading_time", type: "integer", description: "Estimated reading time in minutes.", nullable: true },
      { name: "views", type: "integer", description: "Total view count." },
      { name: "published_at", type: "string (ISO 8601)", description: "Publication timestamp.", nullable: true },
      { name: "created_at", type: "string (ISO 8601)", description: "Creation timestamp." },
      { name: "updated_at", type: "string (ISO 8601)", description: "Last update timestamp." },
    ],
    possibleErrors: [401, 403, 429, 500],
    versions: [{ version: "v1", status: "stable" }],
    addedInVersion: "v1",
    tags: ["posts", "blogs", "list", "pagination", "search", "filter"],
  },

  {
    id: "get-post",
    method: "GET",
    path: "/blogs/:slug",
    title: "Get Post",
    description: "Retrieve a single published post by its slug.",
    longDescription:
      "Returns a single post including its full HTML content. " +
      "Each successful request increments the post's view counter.",
    category: "posts",
    authentication: true,
    pagination: false,
    search: false,
    filters: [],
    queryParams: [],
    pathParams: [
      {
        name: "slug",
        type: "string",
        required: true,
        description: "The URL-safe identifier of the post.",
        example: "hello-world",
      },
    ],
    exampleResponse: {
      data: {
        id: "550e8400-e29b-41d4-a716-446655440000",
        title: "Hello World",
        slug: "hello-world",
        content: "<h1>Hello World</h1><p>Full HTML content...</p>",
        excerpt: "Our first blog post.",
        cover_image: "https://example.com/image.jpg",
        category: "General",
        tags: ["intro", "launch"],
        author_name: "Admin",
        featured: false,
        reading_time: 2,
        views: 143,
        status: "published",
        published_at: "2025-01-15T10:00:00Z",
        created_at: "2025-01-15T09:00:00Z",
        updated_at: "2025-01-20T08:30:00Z",
      },
    },
    responseFields: [
      { name: "content", type: "string (HTML)", description: "Full post content as HTML." },
      { name: "id", type: "string (UUID)", description: "Post unique identifier." },
      { name: "title", type: "string", description: "Post title." },
      { name: "slug", type: "string", description: "URL-safe unique identifier." },
      { name: "excerpt", type: "string", description: "Short summary.", nullable: true },
      { name: "cover_image", type: "string", description: "Cover image URL.", nullable: true },
      { name: "status", type: "string", description: "Post status (always 'published' for this endpoint)." },
    ],
    possibleErrors: [401, 403, 404, 429, 500],
    versions: [{ version: "v1", status: "stable" }],
    addedInVersion: "v1",
    tags: ["posts", "blogs", "single", "slug", "content"],
  },

  // ── Collections ────────────────────────────────────────────────────────────
  {
    id: "list-collections",
    method: "GET",
    path: "/collections",
    title: "List Collections",
    description: "Retrieve all collections (custom content types) for this workspace.",
    longDescription:
      "Returns the schema and metadata for every collection defined in the workspace. " +
      "Use the collection slug from this response to query entries.",
    category: "collections",
    authentication: true,
    pagination: false,
    search: false,
    filters: [],
    queryParams: [],
    exampleResponse: {
      data: [
        {
          id: "coll_abc123",
          name: "Products",
          slug: "products",
          description: "Our product catalog.",
          schema: [
            { name: "name", type: "text", required: true },
            { name: "price", type: "number", required: true },
            { name: "image", type: "image", required: false },
          ],
          entry_count: 24,
          created_at: "2025-01-01T00:00:00Z",
        },
      ],
    },
    responseFields: [
      { name: "id", type: "string", description: "Collection UUID." },
      { name: "name", type: "string", description: "Human-readable name." },
      { name: "slug", type: "string", description: "URL-safe identifier used in entry queries." },
      { name: "description", type: "string", description: "Optional description.", nullable: true },
      { name: "schema", type: "FieldSchema[]", description: "Array of field definitions." },
      { name: "entry_count", type: "integer", description: "Number of published entries." },
    ],
    possibleErrors: [401, 403, 429, 500],
    versions: [{ version: "v1", status: "stable" }],
    addedInVersion: "v1",
    tags: ["collections", "schema", "content-types"],
  },

  {
    id: "list-collection-entries",
    method: "GET",
    path: "/collections/:slug",
    title: "List Collection Entries",
    description: "Retrieve published entries for a specific collection.",
    longDescription:
      "Returns entries for the given collection, filtered to published status by default. " +
      "The shape of each entry's data object matches the collection schema.",
    category: "collections",
    authentication: true,
    pagination: true,
    search: true,
    filters: ["status"],
    queryParams: [
      {
        name: "status",
        type: "enum",
        required: false,
        default: "published",
        description: "Filter entries by status.",
        example: "published",
        enumValues: ["published", "draft", "archived"],
      },
    ],
    pathParams: [
      {
        name: "slug",
        type: "string",
        required: true,
        description: "The collection slug (from GET /collections).",
        example: "products",
      },
    ],
    exampleResponse: {
      data: [
        {
          id: "entry_xyz789",
          data: { name: "Wireless Headphones", price: 99.99, image: "https://example.com/hp.jpg" },
          status: "published",
          created_at: "2025-02-01T00:00:00Z",
          updated_at: "2025-02-10T12:00:00Z",
        },
      ],
      meta: { total: 24, limit: 20, offset: 0 },
    },
    responseFields: [
      { name: "id", type: "string", description: "Entry UUID." },
      { name: "data", type: "object", description: "Entry fields matching the collection schema." },
      { name: "status", type: "string", description: "Entry status (published | draft | archived)." },
      { name: "created_at", type: "string (ISO 8601)", description: "Creation timestamp." },
      { name: "updated_at", type: "string (ISO 8601)", description: "Last update timestamp." },
    ],
    possibleErrors: [401, 403, 404, 429, 500],
    versions: [{ version: "v1", status: "stable" }],
    addedInVersion: "v1",
    tags: ["collections", "entries", "content", "pagination"],
  },

  // ── Media ──────────────────────────────────────────────────────────────────
  {
    id: "list-media",
    method: "GET",
    path: "/media",
    title: "List Media Assets",
    description: "Retrieve media assets from the workspace media library.",
    longDescription:
      "Returns public media assets (images, documents) stored in the workspace. " +
      "Assets are served via CDN URL.",
    category: "media",
    authentication: true,
    pagination: true,
    search: true,
    filters: ["mime_type", "folder"],
    queryParams: [
      {
        name: "mime_type",
        type: "string",
        required: false,
        description: "Filter by MIME type prefix (e.g. image/, video/).",
        example: "image/",
      },
      {
        name: "folder",
        type: "string",
        required: false,
        description: "Filter assets within a specific folder path.",
        example: "blog-covers",
      },
    ],
    exampleResponse: {
      data: [
        {
          id: "media_abc",
          filename: "hero.jpg",
          url: "https://cdn.example.com/hero.jpg",
          mime_type: "image/jpeg",
          size_bytes: 204800,
          width: 1920,
          height: 1080,
          created_at: "2025-03-01T00:00:00Z",
        },
      ],
      meta: { total: 10, limit: 20, offset: 0 },
    },
    possibleErrors: [401, 403, 429, 500],
    versions: [{ version: "v1", status: "stable" }],
    addedInVersion: "v1",
    tags: ["media", "images", "assets", "library"],
  },

  // ── Search ─────────────────────────────────────────────────────────────────
  {
    id: "global-search",
    method: "GET",
    path: "/search",
    title: "Global Search",
    description: "Full-text search across all published content in the workspace.",
    longDescription:
      "Searches posts and collection entries in a single request. " +
      "Useful for building site-wide search. Results include a content_type discriminator.",
    category: "search",
    authentication: true,
    pagination: true,
    search: false,
    filters: ["content_type"],
    queryParams: [
      {
        name: "q",
        type: "string",
        required: true,
        description: "The search query string.",
        example: "wireless headphones",
      },
      {
        name: "content_type",
        type: "enum",
        required: false,
        description: "Restrict results to a specific content type.",
        example: "post",
        enumValues: ["post", "collection"],
      },
    ],
    exampleResponse: {
      data: [
        {
          content_type: "post",
          slug: "hello-world",
          title: "Hello World",
          excerpt: "Our first blog post.",
          score: 0.95,
        },
      ],
      meta: { total: 3, limit: 20, offset: 0 },
    },
    possibleErrors: [400, 401, 403, 429, 500],
    versions: [{ version: "v1", status: "stable" }],
    addedInVersion: "v1",
    tags: ["search", "full-text", "global", "q"],
  },

  // ── Engagement ─────────────────────────────────────────────────────────────
  {
    id: "get-post-likes",
    method: "GET",
    path: "/blogs/:slug/likes",
    title: "Get Like Status",
    description: "Get the current like count for a post and whether the requesting visitor already liked it.",
    category: "engagement",
    authentication: true,
    pagination: false,
    search: false,
    filters: [],
    queryParams: [],
    pathParams: [
      { name: "slug", type: "string", required: true, description: "The post's URL-safe slug.", example: "hello-world" },
    ],
    exampleResponse: { data: { liked: false, totalLikes: 42 } },
    responseFields: [
      { name: "liked", type: "boolean", description: "Whether the current visitor (X-Visitor-Id) has liked this post." },
      { name: "totalLikes", type: "integer", description: "Total number of likes on the post." },
    ],
    possibleErrors: [401, 403, 404, 429, 500],
    versions: [{ version: "v1", status: "stable" }],
    addedInVersion: "v1",
    tags: ["likes", "engagement"],
  },
  {
    id: "like-post",
    method: "POST",
    path: "/blogs/:slug/likes",
    title: "Like a Post",
    description: "Like a post. Idempotent per visitor (X-Visitor-Id header).",
    longDescription:
      "Requires the write:engagement permission. Identify the visitor with an `X-Visitor-Id` header " +
      "(a stable random ID you generate and persist client-side). Without it, dedup falls back to a " +
      "hash of IP + User-Agent, which is weaker.",
    category: "engagement",
    authentication: true,
    pagination: false,
    search: false,
    filters: [],
    queryParams: [],
    pathParams: [
      { name: "slug", type: "string", required: true, description: "The post's URL-safe slug.", example: "hello-world" },
    ],
    exampleResponse: { data: { liked: true, totalLikes: 43 } },
    possibleErrors: [401, 403, 404, 429, 500],
    versions: [{ version: "v1", status: "stable" }],
    addedInVersion: "v1",
    tags: ["likes", "engagement", "write"],
  },
  {
    id: "unlike-post",
    method: "DELETE",
    path: "/blogs/:slug/likes",
    title: "Unlike a Post",
    description: "Remove the requesting visitor's like from a post.",
    category: "engagement",
    authentication: true,
    pagination: false,
    search: false,
    filters: [],
    queryParams: [],
    pathParams: [
      { name: "slug", type: "string", required: true, description: "The post's URL-safe slug.", example: "hello-world" },
    ],
    exampleResponse: { data: { liked: false, totalLikes: 42 } },
    possibleErrors: [401, 403, 404, 429, 500],
    versions: [{ version: "v1", status: "stable" }],
    addedInVersion: "v1",
    tags: ["likes", "engagement", "write"],
  },
  {
    id: "list-post-comments",
    method: "GET",
    path: "/blogs/:slug/comments",
    title: "List Comments",
    description: "Retrieve approved comments for a post, threaded by reply.",
    category: "engagement",
    authentication: true,
    pagination: true,
    search: false,
    filters: [],
    queryParams: [],
    pathParams: [
      { name: "slug", type: "string", required: true, description: "The post's URL-safe slug.", example: "hello-world" },
    ],
    exampleResponse: {
      data: [
        {
          id: "c1a2b3c4-e29b-41d4-a716-446655440000",
          parent_id: null,
          author_name: "Jane Doe",
          author_website: null,
          content: "Great post!",
          created_at: "2025-01-16T10:00:00Z",
          replies: [],
        },
      ],
      meta: { page: 1, limit: 20, total: 1 },
    },
    possibleErrors: [401, 403, 404, 429, 500],
    versions: [{ version: "v1", status: "stable" }],
    addedInVersion: "v1",
    tags: ["comments", "engagement"],
  },
  {
    id: "create-post-comment",
    method: "POST",
    path: "/blogs/:slug/comments",
    title: "Submit a Comment",
    description: "Submit a comment or reply on a post. Comments default to pending moderation.",
    longDescription:
      "Requires the write:engagement permission. Whether the comment is auto-approved or held for " +
      "moderation depends on the workspace's engagement settings (commentSettings.requireApproval). " +
      "Set `parent_id` to reply to an existing comment, up to the workspace's configured max depth.",
    category: "engagement",
    authentication: true,
    pagination: false,
    search: false,
    filters: [],
    queryParams: [],
    pathParams: [
      { name: "slug", type: "string", required: true, description: "The post's URL-safe slug.", example: "hello-world" },
    ],
    exampleResponse: {
      data: { id: "c1a2b3c4-e29b-41d4-a716-446655440000", status: "pending", created_at: "2025-01-16T10:00:00Z" },
    },
    responseFields: [
      { name: "id", type: "string (UUID)", description: "Comment identifier." },
      { name: "status", type: "string", description: "One of pending, approved (depends on workspace settings)." },
    ],
    possibleErrors: [401, 403, 404, 422, 429, 500],
    versions: [{ version: "v1", status: "stable" }],
    addedInVersion: "v1",
    tags: ["comments", "engagement", "write"],
  },
  {
    id: "moderate-comment",
    method: "PUT",
    path: "/comments/:id",
    title: "Moderate a Comment",
    description: "Change a comment's moderation status. Requires a secret key with manage:comments.",
    category: "engagement",
    authentication: true,
    pagination: false,
    search: false,
    filters: [],
    queryParams: [],
    pathParams: [
      { name: "id", type: "string", required: true, description: "The comment's UUID.", example: "c1a2b3c4-e29b-41d4-a716-446655440000" },
    ],
    exampleResponse: { data: { id: "c1a2b3c4-e29b-41d4-a716-446655440000", status: "approved" } },
    possibleErrors: [400, 401, 403, 404, 429, 500],
    versions: [{ version: "v1", status: "stable" }],
    addedInVersion: "v1",
    tags: ["comments", "moderation", "engagement", "write"],
  },
  {
    id: "delete-comment",
    method: "DELETE",
    path: "/comments/:id",
    title: "Delete a Comment",
    description: "Permanently delete a comment. Requires a secret key with manage:comments.",
    category: "engagement",
    authentication: true,
    pagination: false,
    search: false,
    filters: [],
    queryParams: [],
    pathParams: [
      { name: "id", type: "string", required: true, description: "The comment's UUID.", example: "c1a2b3c4-e29b-41d4-a716-446655440000" },
    ],
    exampleResponse: { data: { id: "c1a2b3c4-e29b-41d4-a716-446655440000", deleted: true } },
    possibleErrors: [400, 401, 403, 404, 429, 500],
    versions: [{ version: "v1", status: "stable" }],
    addedInVersion: "v1",
    tags: ["comments", "moderation", "engagement", "write"],
  },
  {
    id: "record-post-view",
    method: "POST",
    path: "/blogs/:slug/view",
    title: "Record a View",
    description: "Record a page view, deduped per visitor within a 30-minute window.",
    category: "engagement",
    authentication: true,
    pagination: false,
    search: false,
    filters: [],
    queryParams: [],
    pathParams: [
      { name: "slug", type: "string", required: true, description: "The post's URL-safe slug.", example: "hello-world" },
    ],
    exampleResponse: { data: { counted: true, totalViews: 144 } },
    possibleErrors: [401, 403, 404, 429, 500],
    versions: [{ version: "v1", status: "stable" }],
    addedInVersion: "v1",
    tags: ["views", "analytics", "engagement", "write"],
  },
  {
    id: "get-post-share",
    method: "GET",
    path: "/blogs/:slug/share",
    title: "Get Share Metadata",
    description: "Get title/description/image/url metadata for building social share links.",
    category: "engagement",
    authentication: true,
    pagination: false,
    search: false,
    filters: [],
    queryParams: [],
    pathParams: [
      { name: "slug", type: "string", required: true, description: "The post's URL-safe slug.", example: "hello-world" },
    ],
    exampleResponse: {
      data: {
        title: "Hello World",
        description: "Our first blog post.",
        image: "https://example.com/image.jpg",
        url: "https://example.com/hello-world",
        siteName: "Lunar CMS",
      },
    },
    possibleErrors: [401, 403, 404, 429, 500],
    versions: [{ version: "v1", status: "stable" }],
    addedInVersion: "v1",
    tags: ["share", "social", "engagement"],
  },
  {
    id: "record-post-share",
    method: "POST",
    path: "/blogs/:slug/share",
    title: "Record a Share",
    description: "Record a share-button click for a given channel (twitter, facebook, linkedin, whatsapp, email, copy_link).",
    category: "engagement",
    authentication: true,
    pagination: false,
    search: false,
    filters: [],
    queryParams: [],
    pathParams: [
      { name: "slug", type: "string", required: true, description: "The post's URL-safe slug.", example: "hello-world" },
    ],
    exampleResponse: { data: { recorded: true } },
    possibleErrors: [401, 403, 404, 429, 500],
    versions: [{ version: "v1", status: "stable" }],
    addedInVersion: "v1",
    tags: ["share", "social", "engagement", "write"],
  },
  {
    id: "get-post-stats",
    method: "GET",
    path: "/blogs/:slug/stats",
    title: "Get Post Stats",
    description: "Get aggregated engagement stats plus the workspace's feature flags and branding settings.",
    category: "engagement",
    authentication: true,
    pagination: false,
    search: false,
    filters: [],
    queryParams: [],
    pathParams: [
      { name: "slug", type: "string", required: true, description: "The post's URL-safe slug.", example: "hello-world" },
    ],
    exampleResponse: {
      data: {
        stats: { views: 144, likes: 43, comments: 5, shares: 12, readingTime: 4, wordCount: 812 },
        features: { likes: true, comments: true, socialShare: true, relatedPosts: true, viewTracking: true, poweredBy: true },
        branding: { enabled: true, text: "Powered by Lunar CMS", url: "https://lunarcms.com" },
      },
    },
    possibleErrors: [401, 403, 404, 429, 500],
    versions: [{ version: "v1", status: "stable" }],
    addedInVersion: "v1",
    tags: ["stats", "analytics", "engagement", "feature-flags", "branding"],
  },
];

// ── Helpers ───────────────────────────────────────────────────────────────────

export function getEndpointById(id: string): EndpointDefinition | undefined {
  return ENDPOINT_REGISTRY.find((e) => e.id === id);
}

export function getEndpointsByCategory(category: EndpointDefinition["category"]): EndpointDefinition[] {
  return ENDPOINT_REGISTRY.filter((e) => e.category === category);
}

export function getEndpointCategories(): EndpointDefinition["category"][] {
  return [...new Set(ENDPOINT_REGISTRY.map((e) => e.category))];
}

export const CATEGORY_LABELS: Record<EndpointDefinition["category"], string> = {
  posts: "Blog Posts",
  collections: "Collections",
  media: "Media",
  search: "Search",
  engagement: "Engagement",
  meta: "Meta",
};

export const API_VERSIONS = ["v1"] as const;
export type ApiVersionString = (typeof API_VERSIONS)[number];

export const CURRENT_VERSION: ApiVersionString = "v1";
