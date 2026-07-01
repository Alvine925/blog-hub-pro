---
name: Webhook Dispatcher Pattern
description: How webhooks are dispatched from server functions without blocking the response.
---

## Rule
Call `dispatchWebhooks` via a fire-and-forget dynamic import — never `await` it inside a server function handler:

```ts
import("./webhook.functions").then(({ dispatchWebhooks }) =>
  dispatchWebhooks(event, payload).catch(() => {})
);
```

**Why:** Dispatching webhooks involves outbound HTTP (up to 10s per endpoint) plus a Supabase `insert` to `webhook_logs`. Blocking the server function on this would make every blog save/delete slow and potentially time out under load.

**How to apply:** Always wrap in dynamic import + `.then()` pattern. The `dispatchWebhooks` itself is wrapped in try/catch and uses `Promise.allSettled` so individual failures never crash the caller.

Both the `webhooks` and `webhook_logs` tables need the migration `20260701140000_webhooks.sql` applied before webhook features work. Until then, `listWebhooks` gracefully returns `[]`.
