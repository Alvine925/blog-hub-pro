---
name: Social metadata architecture
description: How the social object is built and exposed in Lunar CMS API responses.
---

## Rule
Every content response (blogs, news, articles, products, FAQs) embeds a `social` object derived from DB columns. Raw social DB columns (`social_title`, `social_description`, `social_image`, `social_image_alt`, `social_hashtags`, `open_graph_type`, `twitter_card`) are in STRIP_FIELDS and never exposed directly.

## Why
Lunar CMS is a content provider. Clients use `social.*` to populate their own Open Graph / Twitter Card meta tags. The API never generates share URLs or links back to Lunar CMS itself.

## How to apply
- `src/lib/SocialMetadata.ts` — Node.js service; `buildSocialMetadata(row, ogType)` resolves the full social object with fallback chain.
- `SOCIAL_DB_COLS` (Set) — use to strip raw social columns from responses.
- `SOCIAL_SELECT_COLS` — append to SELECT strings to fetch DB social columns.
- Fallback permissions default in `api-handler.node.ts` (line ~218) must include ALL read scopes (`read:news`, `read:articles`, `read:products`, `read:faqs`) or new content-type handlers will 403 when key has no explicit permissions field.
- `og:type` defaults: `article` (blogs/news/articles), `product` (products), `website` (FAQs/pages). Override via `open_graph_type` column.
