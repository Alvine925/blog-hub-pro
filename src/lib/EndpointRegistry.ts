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
  category: "posts" | "faqs" | "news" | "articles" | "products" | "collections" | "media" | "search" | "engagement" | "content-engagement" | "meta";
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
  /** Supabase edge function name (for edge-function-based endpoints) */
  functionName?: string;
  /** Example request body (for POST/PUT endpoints) */
  requestBody?: object;
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
          updated_at: "2025-01-20T08:30:00Z",
          social: {
            title: "Hello World",
            description: "Our first blog post.",
            image: "https://example.com/image.jpg",
            alt: null,
            hashtags: ["intro", "launch"],
            twitterCard: "summary_large_image",
            type: "article",
          },
        },
      ],
      meta: { total: 45, limit: 20, offset: 0 },
    },
    responseFields: [
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
      { name: "updated_at", type: "string (ISO 8601)", description: "Last update timestamp." },
      { name: "social", type: "object", description: "Resolved social sharing metadata. Use this to populate Open Graph and Twitter Card meta tags. See Social Sharing guide." },
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
        published_at: "2025-01-15T10:00:00Z",
        updated_at: "2025-01-20T08:30:00Z",
        social: {
          title: "Hello World",
          description: "Our first blog post.",
          image: "https://example.com/image.jpg",
          alt: null,
          hashtags: ["intro", "launch"],
          twitterCard: "summary_large_image",
          type: "article",
        },
      },
    },
    responseFields: [
      { name: "content", type: "string (HTML)", description: "Full post content as HTML." },
      { name: "title", type: "string", description: "Post title." },
      { name: "slug", type: "string", description: "URL-safe unique identifier." },
      { name: "excerpt", type: "string", description: "Short summary.", nullable: true },
      { name: "cover_image", type: "string", description: "Cover image URL.", nullable: true },
      { name: "social", type: "object", description: "Resolved social sharing metadata. Populate og:title, og:description, og:image, og:type, twitter:card from these fields." },
    ],
    possibleErrors: [401, 403, 404, 429, 500],
    versions: [{ version: "v1", status: "stable" }],
    addedInVersion: "v1",
    tags: ["posts", "blogs", "single", "slug", "content"],
  },

  // ── FAQs ───────────────────────────────────────────────────────────────────
  {
    id: "list-faqs",
    method: "GET",
    path: "/faqs",
    title: "List FAQs",
    description: "Retrieve published FAQs, ordered by sort order.",
    longDescription:
      "Returns all published FAQ entries for the workspace associated with your API key. " +
      "Results are ordered by their configured sort_order. Supports filtering by category and featured status, " +
      "plus full-text search across question and answer text.",
    category: "faqs",
    authentication: true,
    pagination: true,
    search: true,
    filters: ["category", "featured"],
    queryParams: [
      {
        name: "category",
        type: "string",
        required: false,
        description: "Filter FAQs by category name. Case-insensitive.",
        example: "Billing",
      },
      {
        name: "featured",
        type: "boolean",
        required: false,
        description: "Return only featured FAQs when set to true.",
        example: "true",
      },
    ],
    exampleResponse: {
      data: [
        {
          id: "550e8400-e29b-41d4-a716-446655440111",
          question: "How do I reset my password?",
          answer: "Go to Settings > Security and click 'Reset Password'.",
          category: "Account",
          featured: false,
          sort_order: 1,
          updated_at: "2025-01-20T08:30:00Z",
          social: {
            title: "How do I reset my password?",
            description: "Go to Settings > Security and click 'Reset Password'.",
            image: null,
            alt: null,
            hashtags: [],
            twitterCard: "summary_large_image",
            type: "website",
          },
        },
      ],
      meta: { total: 12, limit: 50, offset: 0 },
    },
    responseFields: [
      { name: "id", type: "string (UUID)", description: "FAQ unique identifier." },
      { name: "question", type: "string", description: "The FAQ question." },
      { name: "answer", type: "string", description: "The FAQ answer." },
      { name: "category", type: "string", description: "Category name.", nullable: true },
      { name: "featured", type: "boolean", description: "Whether the FAQ is featured." },
      { name: "sort_order", type: "integer", description: "Manual sort position (ascending)." },
      { name: "updated_at", type: "string (ISO 8601)", description: "Last update timestamp." },
      { name: "social", type: "object", description: "Resolved social sharing metadata." },
    ],
    possibleErrors: [401, 403, 429, 500],
    versions: [{ version: "v1", status: "stable" }],
    addedInVersion: "v1",
    tags: ["faqs", "list", "pagination", "search", "filter"],
  },

  // ── News ───────────────────────────────────────────────────────────────────
  {
    id: "list-news",
    method: "GET",
    path: "/news",
    title: "List News",
    description: "Retrieve a paginated list of published news items.",
    longDescription:
      "Returns all published news items for the workspace, ordered by published date (newest first). " +
      "Supports pagination, full-text search, and filtering by category, breaking, and featured status.",
    category: "news",
    authentication: true,
    pagination: true,
    search: true,
    filters: ["category", "breaking", "featured"],
    queryParams: [
      {
        name: "category",
        type: "string",
        required: false,
        description: "Filter news by category name. Case-insensitive.",
        example: "Industry",
      },
      {
        name: "breaking",
        type: "boolean",
        required: false,
        description: "Return only breaking news when set to true.",
        example: "true",
      },
      {
        name: "featured",
        type: "boolean",
        required: false,
        description: "Return only featured news when set to true.",
        example: "true",
      },
    ],
    exampleResponse: {
      data: [
        {
          slug: "industry-update-q1",
          title: "Industry Update: Q1 Trends",
          excerpt: "A roundup of the latest developments in the industry.",
          cover_image: "https://example.com/news.jpg",
          category: "Industry",
          source_name: "TechCrunch",
          source_url: "https://techcrunch.com/article",
          breaking: false,
          featured: true,
          views: 87,
          published_at: "2025-02-01T09:00:00Z",
          updated_at: "2025-02-01T09:00:00Z",
          social: {
            title: "Industry Update: Q1 Trends",
            description: "A roundup of the latest developments in the industry.",
            image: "https://example.com/news.jpg",
            alt: null,
            hashtags: [],
            twitterCard: "summary_large_image",
            type: "article",
          },
        },
      ],
      meta: { total: 15, limit: 20, offset: 0 },
    },
    responseFields: [
      { name: "slug", type: "string", description: "URL-safe unique identifier." },
      { name: "title", type: "string", description: "News item title." },
      { name: "excerpt", type: "string", description: "Short summary.", nullable: true },
      { name: "cover_image", type: "string", description: "Cover image URL.", nullable: true },
      { name: "category", type: "string", description: "Category name.", nullable: true },
      { name: "source_name", type: "string", description: "Original source name, if aggregated.", nullable: true },
      { name: "source_url", type: "string", description: "Original source URL, if aggregated.", nullable: true },
      { name: "breaking", type: "boolean", description: "Whether flagged as breaking news." },
      { name: "featured", type: "boolean", description: "Whether the news item is featured." },
      { name: "views", type: "integer", description: "Total view count." },
      { name: "published_at", type: "string (ISO 8601)", description: "Publication timestamp.", nullable: true },
      { name: "updated_at", type: "string (ISO 8601)", description: "Last update timestamp." },
      { name: "social", type: "object", description: "Resolved social sharing metadata. Use to populate Open Graph and Twitter Card tags." },
    ],
    possibleErrors: [401, 403, 429, 500],
    versions: [{ version: "v1", status: "stable" }],
    addedInVersion: "v1",
    tags: ["news", "list", "pagination", "search", "filter"],
  },

  {
    id: "get-news",
    method: "GET",
    path: "/news/:slug",
    title: "Get News Item",
    description: "Retrieve a single published news item by its slug.",
    longDescription:
      "Returns a single news item including its full HTML content. " +
      "Each successful request increments the item's view counter.",
    category: "news",
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
        description: "The URL-safe identifier of the news item.",
        example: "industry-update-q1",
      },
    ],
    exampleResponse: {
      data: {
        slug: "industry-update-q1",
        title: "Industry Update: Q1 Trends",
        content: "<h1>Industry Update</h1><p>Full HTML content...</p>",
        excerpt: "A roundup of the latest developments in the industry.",
        category: "Industry",
        breaking: false,
        featured: true,
        views: 88,
        published_at: "2025-02-01T09:00:00Z",
        updated_at: "2025-02-01T09:00:00Z",
        social: {
          title: "Industry Update: Q1 Trends",
          description: "A roundup of the latest developments in the industry.",
          image: null,
          alt: null,
          hashtags: [],
          twitterCard: "summary_large_image",
          type: "article",
        },
      },
    },
    responseFields: [
      { name: "content", type: "string (HTML)", description: "Full news content as HTML." },
      { name: "social", type: "object", description: "Resolved social sharing metadata." },
    ],
    possibleErrors: [401, 403, 404, 429, 500],
    versions: [{ version: "v1", status: "stable" }],
    addedInVersion: "v1",
    tags: ["news", "single", "slug", "content"],
  },

  {
    id: "get-breaking-news",
    method: "GET",
    path: "/news/breaking",
    title: "Get Breaking News",
    description: "Retrieve currently flagged breaking news items.",
    category: "news",
    authentication: true,
    pagination: false,
    search: false,
    filters: [],
    queryParams: [
      {
        name: "limit",
        type: "integer",
        required: false,
        default: "10",
        description: "Maximum number of items to return (1-50).",
        example: "5",
      },
    ],
    exampleResponse: {
      data: [
        {
          slug: "market-shakeup",
          title: "Major Market Shakeup Announced",
          excerpt: "A significant development just broke in the industry.",
          breaking: true,
          published_at: "2025-02-05T14:00:00Z",
        },
      ],
      meta: { total: 1 },
    },
    possibleErrors: [401, 403, 429, 500],
    versions: [{ version: "v1", status: "stable" }],
    addedInVersion: "v1",
    tags: ["news", "breaking"],
  },

  {
    id: "get-latest-news",
    method: "GET",
    path: "/news/latest",
    title: "Get Latest News",
    description: "Retrieve the most recently published news items.",
    category: "news",
    authentication: true,
    pagination: false,
    search: false,
    filters: [],
    queryParams: [
      {
        name: "limit",
        type: "integer",
        required: false,
        default: "10",
        description: "Maximum number of items to return (1-50).",
        example: "5",
      },
    ],
    exampleResponse: {
      data: [
        {
          slug: "industry-update-q1",
          title: "Industry Update: Q1 Trends",
          published_at: "2025-02-01T09:00:00Z",
        },
      ],
      meta: { total: 1 },
    },
    possibleErrors: [401, 403, 429, 500],
    versions: [{ version: "v1", status: "stable" }],
    addedInVersion: "v1",
    tags: ["news", "latest"],
  },

  // ── Articles ───────────────────────────────────────────────────────────────
  {
    id: "list-articles",
    method: "GET",
    path: "/articles",
    title: "List Articles",
    description: "Retrieve a paginated list of published articles.",
    longDescription:
      "Returns all published articles for the workspace, ordered by published date (newest first). " +
      "Supports pagination, full-text search, and filtering by category, featured status, and article type.",
    category: "articles",
    authentication: true,
    pagination: true,
    search: true,
    filters: ["category", "featured", "article_type"],
    queryParams: [
      { name: "category", type: "string", required: false, description: "Filter by category name.", example: "Technology" },
      { name: "featured", type: "boolean", required: false, description: "Return only featured articles.", example: "true" },
      { name: "article_type", type: "string", required: false, description: "Filter by article type (guide, tutorial, etc.).", example: "guide" },
    ],
    exampleResponse: {
      data: [
        {
          id: "art_001",
          slug: "getting-started-guide",
          title: "Getting Started Guide",
          excerpt: "Everything you need to know to get started.",
          cover_image: "https://example.com/article.jpg",
          category: "Guides",
          tags: ["beginner", "guide"],
          author_name: "Admin",
          article_type: "guide",
          featured: true,
          reading_time: 8,
          views: 1203,
          published_at: "2025-03-01T09:00:00Z",
          updated_at: "2025-03-05T12:00:00Z",
          social: {
            title: "Getting Started Guide",
            description: "Everything you need to know to get started.",
            image: "https://example.com/article.jpg",
            alt: null,
            hashtags: ["beginner", "guide"],
            twitterCard: "summary_large_image",
            type: "article",
          },
        },
      ],
      meta: { total: 25, limit: 20, offset: 0 },
    },
    responseFields: [
      { name: "id", type: "string (UUID)", description: "Article unique identifier." },
      { name: "slug", type: "string", description: "URL-safe unique identifier." },
      { name: "title", type: "string", description: "Article title." },
      { name: "excerpt", type: "string", description: "Short summary.", nullable: true },
      { name: "cover_image", type: "string", description: "Cover image URL.", nullable: true },
      { name: "category", type: "string", description: "Category name.", nullable: true },
      { name: "tags", type: "string[]", description: "Array of tag strings." },
      { name: "author_name", type: "string", description: "Author display name.", nullable: true },
      { name: "article_type", type: "string", description: "Article type (guide, tutorial, case-study, etc.)." },
      { name: "featured", type: "boolean", description: "Whether the article is featured." },
      { name: "reading_time", type: "integer", description: "Estimated reading time in minutes.", nullable: true },
      { name: "views", type: "integer", description: "Total view count." },
      { name: "published_at", type: "string (ISO 8601)", description: "Publication timestamp.", nullable: true },
      { name: "updated_at", type: "string (ISO 8601)", description: "Last update timestamp." },
      { name: "social", type: "object", description: "Resolved social sharing metadata. Use to populate Open Graph and Twitter Card tags." },
    ],
    possibleErrors: [401, 403, 429, 500],
    versions: [{ version: "v1", status: "stable" }],
    addedInVersion: "v1",
    tags: ["articles", "list", "pagination", "search", "filter"],
  },

  {
    id: "get-article",
    method: "GET",
    path: "/articles/:slug",
    title: "Get Article",
    description: "Retrieve a single published article by its slug.",
    longDescription:
      "Returns a single article including its full HTML content. " +
      "Each successful request increments the article's view counter.",
    category: "articles",
    authentication: true,
    pagination: false,
    search: false,
    filters: [],
    queryParams: [],
    pathParams: [
      { name: "slug", type: "string", required: true, description: "The URL-safe identifier of the article.", example: "getting-started-guide" },
    ],
    exampleResponse: {
      data: {
        id: "art_001",
        slug: "getting-started-guide",
        title: "Getting Started Guide",
        content: "<h1>Getting Started</h1><p>Full HTML content...</p>",
        excerpt: "Everything you need to know to get started.",
        cover_image: "https://example.com/article.jpg",
        category: "Guides",
        tags: ["beginner", "guide"],
        author_name: "Admin",
        article_type: "guide",
        featured: true,
        reading_time: 8,
        views: 1204,
        published_at: "2025-03-01T09:00:00Z",
        updated_at: "2025-03-05T12:00:00Z",
        social: {
          title: "Getting Started Guide",
          description: "Everything you need to know to get started.",
          image: "https://example.com/article.jpg",
          alt: null,
          hashtags: ["beginner", "guide"],
          twitterCard: "summary_large_image",
          type: "article",
        },
      },
    },
    responseFields: [
      { name: "content", type: "string (HTML)", description: "Full article content as HTML." },
      { name: "social", type: "object", description: "Resolved social sharing metadata." },
    ],
    possibleErrors: [401, 403, 404, 429, 500],
    versions: [{ version: "v1", status: "stable" }],
    addedInVersion: "v1",
    tags: ["articles", "single", "slug", "content"],
  },

  // ── Products ────────────────────────────────────────────────────────────────
  {
    id: "list-products",
    method: "GET",
    path: "/products",
    title: "List Products",
    description: "Retrieve a paginated list of published products.",
    longDescription:
      "Returns all published products for the workspace, ordered by sort_order. " +
      "Supports pagination, full-text search, and filtering by category, brand, and featured status.",
    category: "products",
    authentication: true,
    pagination: true,
    search: true,
    filters: ["category", "featured", "brand"],
    queryParams: [
      { name: "category", type: "string", required: false, description: "Filter by category name.", example: "Electronics" },
      { name: "featured", type: "boolean", required: false, description: "Return only featured products.", example: "true" },
      { name: "brand", type: "string", required: false, description: "Filter by brand name.", example: "Acme" },
    ],
    exampleResponse: {
      data: [
        {
          id: "prod_001",
          slug: "wireless-headphones-pro",
          name: "Wireless Headphones Pro",
          description: "Premium wireless headphones with noise cancellation.",
          cover_image: "https://example.com/headphones.jpg",
          category: "Electronics",
          brand: "Acme",
          price: 149.99,
          currency: "USD",
          status: "published",
          featured: true,
          views: 4891,
          sort_order: 1,
          updated_at: "2025-04-01T00:00:00Z",
          social: {
            title: "Wireless Headphones Pro",
            description: "Premium wireless headphones with noise cancellation.",
            image: "https://example.com/headphones.jpg",
            alt: null,
            hashtags: [],
            twitterCard: "summary_large_image",
            type: "product",
          },
        },
      ],
      meta: { total: 48, limit: 20, offset: 0 },
    },
    responseFields: [
      { name: "id", type: "string (UUID)", description: "Product unique identifier." },
      { name: "slug", type: "string", description: "URL-safe unique identifier." },
      { name: "name", type: "string", description: "Product name." },
      { name: "description", type: "string", description: "Short product description.", nullable: true },
      { name: "cover_image", type: "string", description: "Primary product image URL.", nullable: true },
      { name: "category", type: "string", description: "Category name.", nullable: true },
      { name: "brand", type: "string", description: "Brand name.", nullable: true },
      { name: "price", type: "number", description: "Product price.", nullable: true },
      { name: "currency", type: "string", description: "ISO 4217 currency code." },
      { name: "featured", type: "boolean", description: "Whether the product is featured." },
      { name: "views", type: "integer", description: "Total view count." },
      { name: "updated_at", type: "string (ISO 8601)", description: "Last update timestamp." },
      { name: "social", type: "object", description: "Resolved social sharing metadata with og:type=product." },
    ],
    possibleErrors: [401, 403, 429, 500],
    versions: [{ version: "v1", status: "stable" }],
    addedInVersion: "v1",
    tags: ["products", "list", "pagination", "search", "filter", "ecommerce"],
  },

  {
    id: "get-product",
    method: "GET",
    path: "/products/:slug",
    title: "Get Product",
    description: "Retrieve a single published product by its slug.",
    longDescription:
      "Returns a single product including full content, gallery, specifications, and features. " +
      "Each successful request increments the product's view counter.",
    category: "products",
    authentication: true,
    pagination: false,
    search: false,
    filters: [],
    queryParams: [],
    pathParams: [
      { name: "slug", type: "string", required: true, description: "The URL-safe identifier of the product.", example: "wireless-headphones-pro" },
    ],
    exampleResponse: {
      data: {
        id: "prod_001",
        slug: "wireless-headphones-pro",
        name: "Wireless Headphones Pro",
        content: "<h2>About this product</h2><p>Full HTML content...</p>",
        description: "Premium wireless headphones with noise cancellation.",
        cover_image: "https://example.com/headphones.jpg",
        gallery: ["https://example.com/h1.jpg", "https://example.com/h2.jpg"],
        price: 149.99,
        currency: "USD",
        featured: true,
        views: 4892,
        updated_at: "2025-04-01T00:00:00Z",
        social: {
          title: "Wireless Headphones Pro",
          description: "Premium wireless headphones with noise cancellation.",
          image: "https://example.com/headphones.jpg",
          alt: null,
          hashtags: [],
          twitterCard: "summary_large_image",
          type: "product",
        },
      },
    },
    responseFields: [
      { name: "content", type: "string (HTML)", description: "Full product content as HTML.", nullable: true },
      { name: "gallery", type: "string[]", description: "Array of additional image URLs." },
      { name: "specifications", type: "object[]", description: "Array of specification key/value objects." },
      { name: "features", type: "string[]", description: "Array of feature bullet points." },
      { name: "social", type: "object", description: "Resolved social sharing metadata with og:type=product." },
    ],
    possibleErrors: [401, 403, 404, 429, 500],
    versions: [{ version: "v1", status: "stable" }],
    addedInVersion: "v1",
    tags: ["products", "single", "slug", "ecommerce"],
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

  // ── content-engagement: News ─────────────────────────────────────────────

  {
    id: "get-news-likes", method: "GET", path: "/news/:slug/likes",
    title: "Get News Likes", category: "content-engagement", authentication: true,
    description: "Returns the total like count for a news item and whether the current visitor has liked it.",
    pagination: false, search: false, filters: [], queryParams: [],
    pathParams: [{ name: "slug", type: "string", required: true, description: "News item slug.", example: "product-launch-2026" }],
    exampleResponse: { data: { liked: false, totalLikes: 28 } },
    possibleErrors: [401, 403, 404, 429, 500],
    versions: [{ version: "v1", status: "stable" }], addedInVersion: "v1",
    tags: ["likes", "engagement", "news"],
  },
  {
    id: "like-news", method: "POST", path: "/news/:slug/likes",
    title: "Like a News Item", category: "content-engagement", authentication: true,
    description: "Like a news item. Idempotent per visitor. Requires `write:engagement` permission.",
    pagination: false, search: false, filters: [], queryParams: [],
    pathParams: [{ name: "slug", type: "string", required: true, description: "News item slug.", example: "product-launch-2026" }],
    exampleResponse: { data: { liked: true, totalLikes: 29 } },
    possibleErrors: [401, 403, 404, 429, 500],
    versions: [{ version: "v1", status: "stable" }], addedInVersion: "v1",
    tags: ["likes", "engagement", "news", "write"],
  },
  {
    id: "get-news-comments", method: "GET", path: "/news/:slug/comments",
    title: "List News Comments", category: "content-engagement", authentication: true,
    description: "Returns approved, threaded comments for a news item. Supports pagination.",
    pagination: true, search: false, filters: [],
    queryParams: [
      { name: "page", type: "integer", required: false, description: "Page number.", example: "1" },
      { name: "limit", type: "integer", required: false, description: "Items per page (max 100).", example: "20" },
    ],
    pathParams: [{ name: "slug", type: "string", required: true, description: "News item slug.", example: "product-launch-2026" }],
    exampleResponse: { data: [], meta: { page: 1, limit: 20, total: 0 } },
    possibleErrors: [401, 403, 404, 429, 500],
    versions: [{ version: "v1", status: "stable" }], addedInVersion: "v1",
    tags: ["comments", "engagement", "news"],
  },
  {
    id: "post-news-comment", method: "POST", path: "/news/:slug/comments",
    title: "Submit a News Comment", category: "content-engagement", authentication: true,
    description: "Submit a comment on a news item. Requires `write:engagement`. Auto-approval depends on workspace settings.",
    pagination: false, search: false, filters: [], queryParams: [],
    pathParams: [{ name: "slug", type: "string", required: true, description: "News item slug.", example: "product-launch-2026" }],
    requestBody: { name: "string (required)", email: "string (required)", content: "string (required)", parent_id: "uuid (optional)" },
    exampleResponse: { data: { id: "...", author_name: "Jane", content: "Great news!", status: "pending" } },
    possibleErrors: [401, 403, 404, 422, 429, 500],
    versions: [{ version: "v1", status: "stable" }], addedInVersion: "v1",
    tags: ["comments", "engagement", "news", "write"],
  },
  {
    id: "record-news-view", method: "POST", path: "/news/:slug/view",
    title: "Record News View", category: "content-engagement", authentication: true,
    description: "Records a page view for a news item, deduplicated per visitor per 30 minutes.",
    pagination: false, search: false, filters: [], queryParams: [],
    pathParams: [{ name: "slug", type: "string", required: true, description: "News item slug.", example: "product-launch-2026" }],
    requestBody: { referrer: "string (optional)" },
    exampleResponse: { data: { counted: true, totalViews: 512 } },
    possibleErrors: [401, 403, 404, 429, 500],
    versions: [{ version: "v1", status: "stable" }], addedInVersion: "v1",
    tags: ["views", "analytics", "engagement", "news", "write"],
  },
  {
    id: "get-news-stats", method: "GET", path: "/news/:slug/stats",
    title: "Get News Stats", category: "content-engagement", authentication: true,
    description: "Aggregated engagement stats (views, likes, comments, shares) plus workspace feature flags and branding for a news item.",
    pagination: false, search: false, filters: [], queryParams: [],
    pathParams: [{ name: "slug", type: "string", required: true, description: "News item slug.", example: "product-launch-2026" }],
    exampleResponse: { data: { stats: { views: 512, likes: 28, comments: 4, shares: 9 }, features: { likes: true, comments: true }, branding: { enabled: true, text: "Powered by Lunar CMS" } } },
    possibleErrors: [401, 403, 404, 429, 500],
    versions: [{ version: "v1", status: "stable" }], addedInVersion: "v1",
    tags: ["stats", "analytics", "engagement", "news"],
  },

  // ── content-engagement: Articles ─────────────────────────────────────────

  {
    id: "get-article-likes", method: "GET", path: "/articles/:slug/likes",
    title: "Get Article Likes", category: "content-engagement", authentication: true,
    description: "Returns the total like count for an article and whether the current visitor has liked it.",
    pagination: false, search: false, filters: [], queryParams: [],
    pathParams: [{ name: "slug", type: "string", required: true, description: "Article slug.", example: "getting-started-guide" }],
    exampleResponse: { data: { liked: false, totalLikes: 74 } },
    possibleErrors: [401, 403, 404, 429, 500],
    versions: [{ version: "v1", status: "stable" }], addedInVersion: "v1",
    tags: ["likes", "engagement", "articles"],
  },
  {
    id: "get-article-comments", method: "GET", path: "/articles/:slug/comments",
    title: "List Article Comments", category: "content-engagement", authentication: true,
    description: "Returns approved, threaded comments for an article. Supports pagination.",
    pagination: true, search: false, filters: [],
    queryParams: [
      { name: "page", type: "integer", required: false, description: "Page number.", example: "1" },
      { name: "limit", type: "integer", required: false, description: "Items per page (max 100).", example: "20" },
    ],
    pathParams: [{ name: "slug", type: "string", required: true, description: "Article slug.", example: "getting-started-guide" }],
    exampleResponse: { data: [], meta: { page: 1, limit: 20, total: 0 } },
    possibleErrors: [401, 403, 404, 429, 500],
    versions: [{ version: "v1", status: "stable" }], addedInVersion: "v1",
    tags: ["comments", "engagement", "articles"],
  },
  {
    id: "record-article-view", method: "POST", path: "/articles/:slug/view",
    title: "Record Article View", category: "content-engagement", authentication: true,
    description: "Records a page view for an article, deduplicated per visitor per 30 minutes.",
    pagination: false, search: false, filters: [], queryParams: [],
    pathParams: [{ name: "slug", type: "string", required: true, description: "Article slug.", example: "getting-started-guide" }],
    requestBody: { referrer: "string (optional)" },
    exampleResponse: { data: { counted: true, totalViews: 1203 } },
    possibleErrors: [401, 403, 404, 429, 500],
    versions: [{ version: "v1", status: "stable" }], addedInVersion: "v1",
    tags: ["views", "analytics", "engagement", "articles", "write"],
  },
  {
    id: "get-article-stats", method: "GET", path: "/articles/:slug/stats",
    title: "Get Article Stats", category: "content-engagement", authentication: true,
    description: "Aggregated engagement stats plus workspace feature flags and branding for an article.",
    pagination: false, search: false, filters: [], queryParams: [],
    pathParams: [{ name: "slug", type: "string", required: true, description: "Article slug.", example: "getting-started-guide" }],
    exampleResponse: { data: { stats: { views: 1203, likes: 74, comments: 11, shares: 22 }, features: { likes: true, comments: true }, branding: { enabled: true, text: "Powered by Lunar CMS" } } },
    possibleErrors: [401, 403, 404, 429, 500],
    versions: [{ version: "v1", status: "stable" }], addedInVersion: "v1",
    tags: ["stats", "analytics", "engagement", "articles"],
  },
  {
    id: "get-article-related", method: "GET", path: "/articles/:slug/related",
    title: "Get Related Articles", category: "content-engagement", authentication: true,
    description: "Returns related articles from the same category, ordered by views.",
    pagination: false, search: false, filters: [],
    queryParams: [{ name: "limit", type: "integer", required: false, description: "Max results (1–20, default 5).", example: "5" }],
    pathParams: [{ name: "slug", type: "string", required: true, description: "Article slug.", example: "getting-started-guide" }],
    exampleResponse: { data: [], meta: { total: 0 } },
    possibleErrors: [401, 403, 404, 429, 500],
    versions: [{ version: "v1", status: "stable" }], addedInVersion: "v1",
    tags: ["related", "articles", "engagement"],
  },

  // ── content-engagement: Products ─────────────────────────────────────────

  {
    id: "get-product-likes", method: "GET", path: "/products/:slug/likes",
    title: "Get Product Likes", category: "content-engagement", authentication: true,
    description: "Returns the total like count for a product and whether the current visitor has liked it.",
    pagination: false, search: false, filters: [], queryParams: [],
    pathParams: [{ name: "slug", type: "string", required: true, description: "Product slug.", example: "wireless-headphones-pro" }],
    exampleResponse: { data: { liked: false, totalLikes: 142 } },
    possibleErrors: [401, 403, 404, 429, 500],
    versions: [{ version: "v1", status: "stable" }], addedInVersion: "v1",
    tags: ["likes", "engagement", "products"],
  },
  {
    id: "get-product-comments", method: "GET", path: "/products/:slug/comments",
    title: "List Product Comments", category: "content-engagement", authentication: true,
    description: "Returns approved, threaded comments for a product. Supports pagination.",
    pagination: true, search: false, filters: [],
    queryParams: [
      { name: "page", type: "integer", required: false, description: "Page number.", example: "1" },
      { name: "limit", type: "integer", required: false, description: "Items per page (max 100).", example: "20" },
    ],
    pathParams: [{ name: "slug", type: "string", required: true, description: "Product slug.", example: "wireless-headphones-pro" }],
    exampleResponse: { data: [], meta: { page: 1, limit: 20, total: 0 } },
    possibleErrors: [401, 403, 404, 429, 500],
    versions: [{ version: "v1", status: "stable" }], addedInVersion: "v1",
    tags: ["comments", "engagement", "products"],
  },
  {
    id: "record-product-view", method: "POST", path: "/products/:slug/view",
    title: "Record Product View", category: "content-engagement", authentication: true,
    description: "Records a page view for a product, deduplicated per visitor per 30 minutes.",
    pagination: false, search: false, filters: [], queryParams: [],
    pathParams: [{ name: "slug", type: "string", required: true, description: "Product slug.", example: "wireless-headphones-pro" }],
    requestBody: { referrer: "string (optional)" },
    exampleResponse: { data: { counted: true, totalViews: 4891 } },
    possibleErrors: [401, 403, 404, 429, 500],
    versions: [{ version: "v1", status: "stable" }], addedInVersion: "v1",
    tags: ["views", "analytics", "engagement", "products", "write"],
  },
  {
    id: "get-product-stats", method: "GET", path: "/products/:slug/stats",
    title: "Get Product Stats", category: "content-engagement", authentication: true,
    description: "Aggregated engagement stats plus workspace feature flags and branding for a product.",
    pagination: false, search: false, filters: [], queryParams: [],
    pathParams: [{ name: "slug", type: "string", required: true, description: "Product slug.", example: "wireless-headphones-pro" }],
    exampleResponse: { data: { stats: { views: 4891, likes: 142, comments: 37, shares: 65 }, features: { likes: true, comments: true }, branding: { enabled: true, text: "Powered by Lunar CMS" } } },
    possibleErrors: [401, 403, 404, 429, 500],
    versions: [{ version: "v1", status: "stable" }], addedInVersion: "v1",
    tags: ["stats", "analytics", "engagement", "products"],
  },
  {
    id: "get-product-related", method: "GET", path: "/products/:slug/related",
    title: "Get Related Products", category: "content-engagement", authentication: true,
    description: "Returns related products from the same category, ordered by views.",
    pagination: false, search: false, filters: [],
    queryParams: [{ name: "limit", type: "integer", required: false, description: "Max results (1–20, default 5).", example: "5" }],
    pathParams: [{ name: "slug", type: "string", required: true, description: "Product slug.", example: "wireless-headphones-pro" }],
    exampleResponse: { data: [], meta: { total: 0 } },
    possibleErrors: [401, 403, 404, 429, 500],
    versions: [{ version: "v1", status: "stable" }], addedInVersion: "v1",
    tags: ["related", "products", "engagement"],
  },
  {
    id: "moderate-content-comment", method: "PUT", path: "/comments/:type/:id",
    title: "Moderate a Comment", category: "content-engagement", authentication: true,
    description: "Update a comment's moderation status. Requires a **secret key** with `manage:comments` permission. `:type` = `news` | `articles` | `products`.",
    pagination: false, search: false, filters: [], queryParams: [],
    pathParams: [
      { name: "type", type: "string", required: true, description: "Content type: news, articles, or products.", example: "articles" },
      { name: "id", type: "string", required: true, description: "Comment UUID.", example: "c1d2..." },
    ],
    requestBody: { status: "pending | approved | rejected | spam | trash" },
    exampleResponse: { data: { id: "c1d2...", status: "approved" } },
    possibleErrors: [400, 401, 403, 404, 429, 500],
    versions: [{ version: "v1", status: "stable" }], addedInVersion: "v1",
    tags: ["comments", "moderation", "engagement", "write"],
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
  faqs: "FAQs",
  news: "News",
  articles: "Articles",
  products: "Products",
  collections: "Collections",
  media: "Media",
  search: "Search",
  engagement: "Engagement",
  "content-engagement": "Content Engagement",
  meta: "Meta",
};

export const API_VERSIONS = ["v1"] as const;
export type ApiVersionString = (typeof API_VERSIONS)[number];

export const CURRENT_VERSION: ApiVersionString = "v1";
