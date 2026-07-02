# Acme — E-commerce Platform

A full-stack e-commerce platform with a customer storefront, an admin dashboard, Stripe
checkout, and an AI shopping assistant.

**Stack:** NestJS · Prisma · PostgreSQL (pgvector) · Redis · React (Vite) · TypeScript ·
Tailwind · Stripe.

```
ecommerce-website/
├── backend/    NestJS API
├── frontend/   React SPA (storefront + admin)
└── docs/       Architecture & flow documentation
```

## Features

- **Storefront** — catalog browsing, full-text & semantic search, cart, and a Stripe checkout.
- **Admin dashboard** — CRUD for products & categories, order management (status, refunds,
  returns), customer management, and metrics.
- **Auth** — email/password signup with emailed verification, Google OAuth, and role-based
  access (Guest / Customer / Admin). Short-lived JWT access tokens + long-lived opaque,
  rotating refresh tokens.
- **Checkout & payments** — Stripe PaymentIntents with webhook capture, atomic inventory
  reservation (no oversell), and idempotent, retry-safe order/refund handling.
- **AI assistant** — a streaming chat (recommendations + order status) and personalized
  "You might also like" suggestions, backed by pluggable open-source models (Hugging Face /
  OpenAI-compatible). Degrades gracefully to full-text search when no model is configured.
- **Operations** — background job queue (BullMQ, with an inline fallback), behavioral
  analytics stream, structured logging, and health checks.

## Documentation

Detailed flow docs live in [`docs/`](./docs):
[schema](./docs/schema.md) ·
[auth](./docs/auth.md) ·
[cart](./docs/cart.md) ·
[checkout](./docs/checkout.md) ·
[orders](./docs/orders.md) ·
[catalog](./docs/catalog.md) ·
[ai](./docs/ai.md) ·
[background jobs](./docs/background-jobs.md).

## Setup & run

### Prerequisites
- **Node.js 20+**
- **PostgreSQL 14+** with the **`pgvector`** and **`citext`** extensions, and a role that can
  `CREATE EXTENSION`.
  - macOS: `brew install postgresql@16 pgvector`
  - Debian/Ubuntu: `apt install postgresql postgresql-16-pgvector`
  - then `createdb ecommerce`
- **Redis** (optional) — for the job queue. Skip it by setting `QUEUE_ENABLED=false`.
- **SMTP sink** (optional) — to view verification emails, run [Mailpit](https://mailpit.axllent.org)
  (SMTP `:1025`, UI http://localhost:8025), which matches the default `.env`.

### Backend → http://localhost:4000/api
```bash
cd backend
cp .env.example .env          # set DATABASE_URL (Google/Stripe/AI keys optional)
npm install
npm run prisma:generate
npm run prisma:migrate        # create schema + extensions
npm run db:seed               # demo data: catalog, customers, orders
npm run start:dev
```

### Frontend → http://localhost:5173
```bash
cd frontend
cp .env.example .env
npm install
npm run dev
```

### Demo logins
- Admin → `admin@acme.test` / `Admin123!`
- Customer → `olivia.bennett@example.com` / `Password123!`

## Optional integrations
All optional — the app runs (with graceful fallbacks) without them.

- **Stripe** — set `STRIPE_SECRET_KEY` (backend) + `VITE_STRIPE_PUBLISHABLE_KEY` (frontend).
  For webhooks: `stripe listen --forward-to localhost:4000/api/checkout/webhook` and set
  `STRIPE_WEBHOOK_SECRET`. Without keys, checkout uses a demo completion.
- **Google OAuth** — set `GOOGLE_CLIENT_ID` / `GOOGLE_CLIENT_SECRET` and authorize
  `http://localhost:4000/api/auth/google/callback`.
- **AI models** — set `AI_CHAT_PROVIDER` / `AI_EMBEDDING_PROVIDER` (+ HF or OpenAI-compatible
  keys) in `backend/.env`, then backfill embeddings via `POST /api/admin/catalog/reindex`
  (admin) and apply the vector index: `psql "$DATABASE_URL" -f backend/prisma/sql/ai-indexes.sql`.
  See [docs/ai.md](./docs/ai.md).

> All money is stored and transmitted as integer minor units (cents).
