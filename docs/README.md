# Documentation

Reference docs for the e-commerce platform. Each file documents one area with diagrams,
step-by-step flows, and links into the source.

| Doc | Covers |
| --- | --- |
| [schema.md](./schema.md) | Database schema — models, enums, relations, indexes, conventions. |
| [auth.md](./auth.md) | Authentication & authorization — JWT access + opaque rotating refresh tokens, OAuth, email verification, password reset, roles & guards. |
| [cart.md](./cart.md) | Cart — guest vs user carts, add/update/remove, availability, guest→user merge. |
| [checkout.md](./checkout.md) | Checkout — cart → order, stock reservation, Stripe PaymentIntent, webhook capture, idempotency, expiry. |
| [orders.md](./orders.md) | Admin order management — status, refunds (reserve-then-execute + reconciliation), returns, event timeline. |
| [catalog.md](./catalog.md) | Catalog — categories, products, variants, images, index-on-write (full-text + embeddings), storefront browsing. |
| [ai.md](./ai.md) | AI — chat assistant pipeline, recommendations, pluggable model providers, graceful degradation. |
| [background-jobs.md](./background-jobs.md) | Operations — job queue + inline fallback, cron schedulers, analytics events, observability/health. |

Setup and run instructions live in the [root README](../README.md).
