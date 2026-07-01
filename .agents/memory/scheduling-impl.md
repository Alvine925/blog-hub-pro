---
name: Content scheduling implementation
description: How auto-publish scheduling works without a cron job
---

No cron available on free tier. Auto-publish fires in the dashboard loader via `publishScheduledPosts()` (in `src/lib/schedule.functions.ts`) — a server fn that queries `blog_posts` where `status='scheduled' AND scheduled_at <= now()` and flips them to published.
**Why:** Replit free tier has no background cron. Dashboard load is a natural trigger point.
**How to apply:** If more reliable scheduling is needed, also call `publishScheduledPosts` in the REST API middleware on each request.
