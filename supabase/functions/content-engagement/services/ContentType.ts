/**
 * ContentType.ts — table-name config for each supported content type.
 *
 * Every key maps a URL segment (news / articles / products) to the exact
 * Postgres table names used by the engagement tables created in migration
 * 20260703000020_news_articles_products_engagement.sql.
 */

export type ContentTypeName = "news" | "articles" | "products";

export interface ContentTypeConfig {
  contentTable:  string;   // the main content table (news, articles, products)
  idCol:         string;   // FK column name in engagement tables
  titleCol:      string;   // column used for og:title / share title
  slugCol:       string;   // always "slug"
  likesTable:    string;
  commentsTable: string;
  viewsTable:    string;
  sharesTable:   string;
  dailyTable:    string;
  bumpFn:        string;   // bump_<type>_engagement_daily
  label:         string;   // human label e.g. "News"
}

export const CONTENT_TYPES: Record<ContentTypeName, ContentTypeConfig> = {
  news: {
    contentTable:  "news",
    idCol:         "news_id",
    titleCol:      "title",
    slugCol:       "slug",
    likesTable:    "news_likes",
    commentsTable: "news_comments",
    viewsTable:    "news_views",
    sharesTable:   "news_shares",
    dailyTable:    "news_engagement_daily",
    bumpFn:        "bump_news_engagement_daily",
    label:         "News",
  },
  articles: {
    contentTable:  "articles",
    idCol:         "article_id",
    titleCol:      "title",
    slugCol:       "slug",
    likesTable:    "articles_likes",
    commentsTable: "articles_comments",
    viewsTable:    "articles_views",
    sharesTable:   "articles_shares",
    dailyTable:    "articles_engagement_daily",
    bumpFn:        "bump_articles_engagement_daily",
    label:         "Article",
  },
  products: {
    contentTable:  "products",
    idCol:         "product_id",
    titleCol:      "name",
    slugCol:       "slug",
    likesTable:    "products_likes",
    commentsTable: "products_comments",
    viewsTable:    "products_views",
    sharesTable:   "products_shares",
    dailyTable:    "products_engagement_daily",
    bumpFn:        "bump_products_engagement_daily",
    label:         "Product",
  },
};

export function resolveType(segment: string): ContentTypeConfig | null {
  return CONTENT_TYPES[segment as ContentTypeName] ?? null;
}
