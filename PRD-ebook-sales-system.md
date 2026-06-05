# PRD — E-book Sales & WhatsApp Delivery System

> **Living document.** Update the changelog and version whenever scope, schema, or
> acceptance criteria change. Sections tagged `[STABLE]` are agreed; `[DRAFT]` may still move;
> `[OPEN]` needs a decision (see §16).

| Field | Value |
|---|---|
| Version | 0.6.0 |
| Status | Draft — ready for implementation |
| Owner | Product owner (you) |
| Last updated | 2026-06-03 |
| Build philosophy | **SLC** — Simple, Lovable, Complete |
| Target implementer | AI coding agent |

### Changelog
- **0.6.0** (2026-06-03) — Added §19 Build &amp; resume protocol (source-of-truth hierarchy, session start/end routines, build order, commit discipline). Companion files: `CLAUDE.md` (auto-loaded project rules for Claude Code) and `PROGRESS.md` (live build state).
- **0.5.0** (2026-06-03) — **WAHA is a 3rd-party managed service, public HTTPS only (no VPN/private network).** App is back to a single host (Caddy + app + Postgres). `WAHA_BASE_URL` must be `https://`; base64 is the **only** delivery method (`file.url` removed); added provider request-size limit and 3rd-party-processor privacy notes; §18 rewritten for one App host + external WAHA.
- **0.4.0** (2026-06-03) — **WAHA moved to a separate machine.** App host now runs Caddy + app + Postgres; WAHA runs on its own host reached over a private/encrypted link. Added transport-security requirement (the base64 e-book now crosses the network) and split §18 into App host / WAHA host.
- **0.3.0** (2026-06-03) — Added deployment target: **AlmaLinux 10 VPS** running Docker Compose (Caddy + app + WAHA + Postgres). Added §18 deployment runbook covering Docker CE install, SELinux `:Z` volumes, firewalld, TLS, and WAHA session setup.
- **0.2.0** (2026-06-03) — Removed object storage. E-book is now stored on a **private local directory** on the app server and sent to WAHA as base64. App must run on a persistent (non-serverless) host co-located with WAHA.
- **0.1.0** (2026-06-03) — Initial PRD. Scope: sales intake + Midtrans payment + WhatsApp (WAHA) delivery. Challenge/contest module explicitly deferred.

---

## 1. Overview `[STABLE]`

A backend-driven system that **sells a digital e-book and delivers it to the buyer over WhatsApp**.
A buyer arrives on a product landing page, submits their details, pays via **Midtrans**, and the
system automatically sends the e-book file to their **WhatsApp** number using a self-hosted
**WAHA** (WhatsApp HTTP API) instance.

This PRD covers **only the sales + delivery system**. There is no full storefront, no customer
login, and no contest yet. The contest/challenge feature is a planned future module; the data
model leaves a clean seam for it (§15) but it is **not** built now.

### SLC interpretation (the bar for "done")
- **Simple** — one product flow, one checkout form (no accounts), one payment gateway, one
  delivery channel. No feature exists that isn't required to sell and deliver an e-book.
- **Lovable** — delivery is fast and reliable; the WhatsApp message is friendly; the buyer gets
  a clear confirmation; failures are retried automatically and recoverable by an operator.
- **Complete** — the full loop (intake → pay → verify → deliver → confirm) works end-to-end,
  is idempotent, handles payment and delivery failures, and an operator can see and re-send.

---

## 2. Goals & Non-Goals `[STABLE]`

**Goals**
1. Capture buyer data: **name, email, WhatsApp number, tracking ID**.
2. Take payment for an e-book via **Midtrans Snap**.
3. On confirmed payment, deliver the e-book file to the buyer's **WhatsApp** via **WAHA**.
4. Be reliable and idempotent: never double-charge-record, never double-deliver, retry on failure.
5. Give an operator basic visibility and a manual re-send tool.

**Non-Goals (this version)**
- No contest/challenge logic, leaderboard, or scoring.
- No customer accounts, login, or self-serve portal.
- No full storefront / marketing site (only the single product landing/checkout page).
- No refunds automation (status is recorded; refund processing is manual in Midtrans).
- No multi-currency (IDR only).

---

## 3. Scope & Actors `[STABLE]`

**Actors**
- **Buyer** — fills the form and pays. Identified by email + WhatsApp; not authenticated.
- **Operator (admin)** — you; views orders/deliveries, triggers manual re-send. Protected by a token.
- **System** — backend orchestrating Midtrans and WAHA.
- **Midtrans** — payment gateway (external). Sends payment notifications (webhook).
- **WAHA** — self-hosted WhatsApp HTTP API (separate Docker service) that sends the file.

---

## 4. Primary User Flow `[STABLE]`

1. Buyer opens `/{product-slug}` (optionally with `?ref=<trackingId>` in the URL).
2. Buyer submits **name, email, WhatsApp number** (tracking ID captured automatically if present).
3. System validates input, normalizes the WhatsApp number, upserts a `Customer`, creates an
   `Order` (status `PENDING`), and requests a **Midtrans Snap** transaction.
4. Buyer completes payment in the Midtrans Snap UI (popup or redirect).
5. Midtrans calls the **payment notification webhook**. System verifies the signature, records the
   event, and updates the order status idempotently.
6. On `PAID`, the system creates a `Delivery` and sends the e-book file to WhatsApp via WAHA.
7. Buyer receives the file on WhatsApp; the thank-you page confirms the order.
8. Failed deliveries are retried automatically (cron + backoff); the operator can re-send manually.

---

## 5. Functional Requirements & Acceptance Criteria `[STABLE]`

Acceptance criteria are written as testable statements. `[ ]` = must pass before Done.

### F1 — Checkout intake
- [ ] `GET /{slug}` renders a checkout form for an **active** product; unknown/inactive slug → 404 page.
- [ ] If the URL has `?ref=<value>`, the value is captured and submitted as `trackingId` (hidden field).
- [ ] Form requires `name`, `email` (valid format), `whatsapp` (valid Indonesian mobile). `trackingId` optional.
- [ ] Submitting calls `POST /api/checkout`; invalid input returns `422` with field-level errors and no order is created.
- [ ] On success the buyer is taken to the Midtrans Snap payment UI (token returned to client).

### F2 — Order creation + Midtrans Snap
- [ ] A valid checkout upserts a `Customer` (by normalized `whatsapp`+`email`) and creates one `Order` with a unique `orderCode`.
- [ ] `orderCode` is used as Midtrans `order_id` and is globally unique.
- [ ] `amountIdr` equals the product `priceIdr`; `gross_amount` sent to Midtrans equals `amountIdr`.
- [ ] The system stores the returned `snapToken` and `snapRedirectUrl` on the order.
- [ ] Server key is **never** exposed to the client; only the Snap token / redirect URL is returned.

### F3 — Payment notification webhook
- [ ] `POST /api/webhooks/midtrans` verifies `signature_key == SHA512(order_id + status_code + gross_amount + serverKey)` using the **exact** `gross_amount` string from the payload. Mismatch → `403`, nothing updated.
- [ ] Unknown `order_id` → `404` (logged), nothing updated.
- [ ] Every received notification is persisted as a `PaymentEvent` (raw payload + signature validity) for audit.
- [ ] Status mapping is applied (see §12.1). Updates are **idempotent** and **forward-only** (a late `pending` after `settlement` does not downgrade the order).
- [ ] A `capture` with `fraud_status = challenge` keeps the order `PENDING` (no delivery) until resolved.
- [ ] The endpoint returns `200` quickly even if downstream delivery is slow or fails.

### F4 — E-book delivery via WAHA
- [ ] Delivery is triggered **only** when an order transitions to `PAID` and no `SENT` delivery exists for it.
- [ ] Exactly one `Delivery` row exists per order (`orderId` unique); the e-book is **never sent twice** automatically.
- [ ] The WhatsApp number is normalized to `{62…}@c.us` (see §12.2) before sending.
- [ ] The system reads the e-book from the private directory (`EBOOK_FILES_DIR/<filePath>`) and sends it via `POST {WAHA}/api/sendFile` as base64 (`file.data`) with a friendly caption.
- [ ] On success: `Delivery.status = SENT`, `wahaMessageId` and `sentAt` stored.
- [ ] On failure: `attempts` incremented, `lastError` stored, `nextRetryAt` set with exponential backoff.

### F5 — Delivery reliability / retry
- [ ] `GET /api/cron/process-deliveries` (cron-protected) processes deliveries where `status in (PENDING, FAILED)` and `nextRetryAt <= now` and `attempts < maxAttempts`.
- [ ] Backoff schedule is exponential (e.g., 1m, 5m, 15m, 1h, 6h) up to `maxAttempts` (default 5).
- [ ] After `maxAttempts`, status becomes terminal `FAILED` and the order is flagged for operator attention.
- [ ] Processing is concurrency-safe (a delivery already `PROCESSING`/`SENT` is not picked up again).

### F6 — Operator visibility & manual re-send
- [ ] `GET /api/admin/orders` (admin-protected) lists orders with status, customer, delivery state, tracking ID; supports filter by status.
- [ ] `POST /api/admin/deliveries/{id}/resend` re-attempts delivery; accepts an optional corrected `whatsapp` to override a wrong number.
- [ ] All admin endpoints reject requests without a valid admin token (`401`).

### F7 — Product management (minimal)
- [ ] Products are seeded/managed via `prisma/seed.ts` and/or DB; no admin UI required in v1.
- [ ] Each product has `slug`, `name`, `priceIdr`, `filePath` (relative to `EBOOK_FILES_DIR`), `fileName`, `mimeType`, `isActive`.

---

## 6. Tech Stack `[STABLE]`

| Layer | Choice | Notes |
|---|---|---|
| Framework | **Next.js (App Router) + TypeScript** | Landing page + API route handlers in one codebase |
| Validation | **zod** | Request bodies + env validation |
| Database | **PostgreSQL** | Managed (Neon/Supabase) or Docker locally |
| ORM | **Prisma** | Schema in §9 |
| Payments | **Midtrans Snap** | Server-side transaction creation + webhook |
| WhatsApp delivery | **WAHA** (`devlikeapro/waha`) | **Separate Docker service**, not on Vercel |
| File storage | **Local private directory on the app server** | E-book files on a mounted volume, outside the web root, never served statically |
| Background retries | In-process scheduler / system cron → delivery worker | Backoff-driven retries (HTTP cron endpoint optional) |
| Hosting | **AlmaLinux 10 VPS** (App host) running Docker Compose: Caddy + app + Postgres | Only Caddy (80/443) is public. **WAHA is an external 3rd-party HTTPS service** — see §18 |

> **Architecture note:** The app runs as a long-running container (not serverless) because the e-book
> is stored on the **app's local disk** and serverless filesystems are ephemeral/read-only. WAHA is
> **not** self-hosted here — it is a 3rd-party managed service reachable only over the **public
> internet via HTTPS**. The app reads the e-book from its private volume and sends it to WAHA as
> base64 over TLS (`X-Api-Key`). The e-book is never served publicly and never given to WAHA as a URL.

---

## 7. System Architecture `[STABLE]`

```
Buyer ──(1) GET /{slug}──────────────► Next.js (landing/checkout)
Buyer ──(2) POST /api/checkout───────► Next.js ──► Midtrans Snap API ──► {token, redirect_url}
Buyer ──(3) pays in Snap UI──────────► Midtrans
Midtrans ─(4) POST webhook───────────► Next.js /api/webhooks/midtrans
                                         │ verify signature, persist PaymentEvent,
                                         │ update Order (idempotent), create Delivery
                                         ▼
                                       Delivery worker ──► 3rd-party WAHA (HTTPS) /api/sendFile ──► Buyer's WhatsApp
                                         ▲                    (file.data = base64; TLS over public internet)
Scheduler ─(5) process-deliveries───────┘ retries FAILED/PENDING with backoff
Operator ──► /api/admin/* (token-protected): view orders, manual resend
```

---

## 8. Environment Variables `[STABLE]`

Provide a `.env.example` with these keys (no real secrets committed):

```dotenv
# App
APP_BASE_URL=https://yourdomain.com
NODE_ENV=development

# Database
DATABASE_URL=postgresql://user:pass@host:5432/ebook

# Midtrans
MIDTRANS_SERVER_KEY=
MIDTRANS_CLIENT_KEY=
MIDTRANS_IS_PRODUCTION=false   # false => sandbox endpoints

# WAHA (3rd-party managed service — public HTTPS only; no private network / VPN available)
WAHA_BASE_URL=https://your-instance.waha-provider.example   # MUST be https://
WAHA_API_KEY=
WAHA_SESSION=default

# E-book files (local, private)
EBOOK_FILES_DIR=/data/ebooks   # mounted private volume; MUST be outside the web root / public dir

# Security
ADMIN_TOKEN=          # bearer token for /api/admin/*
CRON_SECRET=          # only needed if you trigger retries via an HTTP cron endpoint
```

> All env access goes through a zod-validated `src/lib/env.ts`; the app must fail fast on startup
> if a required variable is missing. **`WAHA_BASE_URL` must start with `https://`** — the app should
> refuse to start (or refuse to send) if it is plain `http://`, since the API key and base64 e-book
> would otherwise cross the public internet in cleartext.

---

## 9. Data Schema (Prisma) `[STABLE]`

```prisma
// prisma/schema.prisma
generator client { provider = "prisma-client-js" }
datasource db { provider = "postgresql"; url = env("DATABASE_URL") }

model Product {
  id          String   @id @default(cuid())
  slug        String   @unique
  name        String
  description String?
  priceIdr    Int                       // IDR, no decimals (e.g. 100000)
  filePath    String                    // path to the e-book RELATIVE to EBOOK_FILES_DIR, e.g. "my-ebook.pdf"
  fileName    String                    // filename shown to the buyer, e.g. "my-ebook.pdf"
  mimeType    String   @default("application/pdf")
  isActive    Boolean  @default(true)
  createdAt   DateTime @default(now())
  updatedAt   DateTime @updatedAt
  orders      Order[]
}

model Customer {
  id        String   @id @default(cuid())
  name      String
  email     String
  whatsapp  String                       // normalized digits, no '+', e.g. "628123456789"
  createdAt DateTime @default(now())
  updatedAt DateTime @updatedAt
  orders    Order[]
  @@unique([email, whatsapp])
  @@index([whatsapp])
}

enum OrderStatus { PENDING PAID FAILED EXPIRED CANCELLED REFUNDED }

model Order {
  id                    String       @id @default(cuid())
  orderCode             String       @unique   // == Midtrans order_id
  customerId            String
  productId             String
  amountIdr             Int
  currency              String       @default("IDR")
  status                OrderStatus  @default(PENDING)
  trackingId            String?                  // attribution / referral id (nullable)
  snapToken             String?
  snapRedirectUrl       String?
  midtransTransactionId String?
  paymentType           String?
  paidAt                DateTime?
  createdAt             DateTime     @default(now())
  updatedAt             DateTime     @updatedAt
  customer              Customer     @relation(fields: [customerId], references: [id])
  product               Product      @relation(fields: [productId], references: [id])
  delivery              Delivery?
  events                PaymentEvent[]
  @@index([status])
  @@index([trackingId])
}

model PaymentEvent {                       // immutable audit log of every notification
  id                String   @id @default(cuid())
  orderId           String
  transactionStatus String
  fraudStatus       String?
  statusCode        String?
  signatureValid    Boolean
  rawPayload        Json
  createdAt         DateTime @default(now())
  order             Order    @relation(fields: [orderId], references: [id])
  @@index([orderId])
}

enum DeliveryStatus { PENDING PROCESSING SENT FAILED }

model Delivery {
  id            String         @id @default(cuid())
  orderId       String         @unique     // one delivery per order => no double-send
  channel       String         @default("whatsapp")
  status        DeliveryStatus @default(PENDING)
  attempts      Int            @default(0)
  maxAttempts   Int            @default(5)
  nextRetryAt   DateTime?
  wahaMessageId String?
  lastError     String?
  sentAt        DateTime?
  createdAt     DateTime       @default(now())
  updatedAt     DateTime       @updatedAt
  order         Order          @relation(fields: [orderId], references: [id])
  @@index([status, nextRetryAt])
}
```

---

## 10. File / Project Structure `[STABLE]`

```
ebook-sales/
├── prisma/
│   ├── schema.prisma
│   └── seed.ts                                  # seed product(s)
├── src/
│   ├── app/
│   │   ├── layout.tsx
│   │   ├── page.tsx                             # default / redirect
│   │   ├── [slug]/page.tsx                      # product landing + checkout form
│   │   ├── thank-you/page.tsx                   # post-payment confirmation
│   │   └── api/
│   │       ├── checkout/route.ts                # POST: create order + Snap token
│   │       ├── webhooks/midtrans/route.ts       # POST: payment notification
│   │       ├── cron/process-deliveries/route.ts # GET: retry due deliveries
│   │       └── admin/
│   │           ├── orders/route.ts              # GET: list/filter orders
│   │           └── deliveries/[id]/resend/route.ts  # POST: manual re-send
│   ├── components/
│   │   └── checkout-form.tsx
│   ├── lib/
│   │   ├── db.ts            # Prisma singleton
│   │   ├── env.ts           # zod-validated env
│   │   ├── validation.ts    # zod request schemas
│   │   ├── orders.ts        # order creation + status transitions
│   │   ├── midtrans.ts      # Snap create + signature verify + status map
│   │   ├── waha.ts          # WAHA client (sendFile / sendText)
│   │   ├── files.ts         # resolve + read e-book from EBOOK_FILES_DIR (private)
│   │   ├── phone.ts         # WhatsApp number normalization
│   │   ├── delivery.ts      # idempotent send + retry orchestration
│   │   └── auth.ts          # admin token + cron secret guards
│   └── types/index.ts
├── Dockerfile               # builds the Next.js app image
├── Caddyfile                # reverse proxy + auto TLS (80/443 → app)
├── docker-compose.yml       # app host: caddy + app + postgres (WAHA runs separately, see §18)
├── .env.example
├── package.json
├── tsconfig.json
└── README.md
```

---

## 11. API Endpoint Specs `[STABLE]`

### POST `/api/checkout`
**Request**
```json
{ "productSlug": "my-ebook", "name": "Budi", "email": "budi@mail.com",
  "whatsapp": "08123456789", "trackingId": "aff-123" }
```
**Behaviour**: validate (zod) → normalize phone → upsert Customer → create Order(PENDING) with unique `orderCode` → create Midtrans Snap transaction → store token → return token.
**200 Response**
```json
{ "orderCode": "ORD-20260603-AB12CD", "snapToken": "xxx", "redirectUrl": "https://app.sandbox.midtrans.com/snap/v2/vtweb/xxx" }
```
**Errors**: `422` validation (field errors), `404` unknown/inactive product, `502` Midtrans failure (no order left in a usable state — mark order FAILED or delete; document choice).

### POST `/api/webhooks/midtrans`
**Request**: Midtrans notification JSON (`order_id`, `status_code`, `gross_amount`, `signature_key`, `transaction_status`, `fraud_status`, `transaction_id`, `payment_type`, …).
**Behaviour**: verify signature → find order → persist `PaymentEvent` → map + idempotent forward-only update → on `PAID` create Delivery + trigger send → return `200`.
**Responses**: `200` (processed/duplicate-ignored), `403` (bad signature), `404` (unknown order).

### GET `/api/cron/process-deliveries`
**Auth**: `CRON_SECRET` (header `x-cron-secret` or `?secret=`).
**Behaviour**: select due deliveries, mark `PROCESSING`, send via WAHA, update status/backoff.
**200 Response**: `{ "processed": 3, "sent": 2, "failed": 1 }`

### GET `/api/admin/orders?status=PAID`
**Auth**: `Authorization: Bearer <ADMIN_TOKEN>`. Returns orders + delivery state.

### POST `/api/admin/deliveries/{id}/resend`
**Auth**: admin token. Optional body `{ "whatsapp": "08987654321" }` to correct the number. Resets the delivery to `PENDING` and re-attempts.

---

## 12. Integration Specs `[STABLE]`

### 12.1 Midtrans

**Create Snap transaction** (server-side, `src/lib/midtrans.ts`):
- Endpoint: `https://app.sandbox.midtrans.com/snap/v1/transactions` (sandbox) or
  `https://app.midtrans.com/snap/v1/transactions` (production), chosen by `MIDTRANS_IS_PRODUCTION`.
- Auth: HTTP Basic, username = `MIDTRANS_SERVER_KEY`, password empty → header
  `Authorization: Basic base64(serverKey + ":")`.
- Body:
```json
{
  "transaction_details": { "order_id": "ORD-...", "gross_amount": 100000 },
  "item_details": [{ "id": "<productId>", "price": 100000, "quantity": 1, "name": "<product name>" }],
  "customer_details": { "first_name": "Budi", "email": "budi@mail.com", "phone": "628123456789" },
  "callbacks": { "finish": "https://yourdomain.com/thank-you" }
}
```
- Response: `{ "token": "...", "redirect_url": "..." }`.

**Webhook signature verification** (mandatory):
```
expected = SHA512(order_id + status_code + gross_amount + MIDTRANS_SERVER_KEY)
reject if expected !== payload.signature_key
```
Use the **exact** `gross_amount` string Midtrans sends (e.g. `"100000.00"`), not a re-formatted value.

**Status mapping → OrderStatus**:
| transaction_status | fraud_status | OrderStatus |
|---|---|---|
| `capture` | `accept` | PAID |
| `capture` | `challenge` | PENDING (manual review) |
| `settlement` | — | PAID |
| `pending` | — | PENDING |
| `deny` | — | FAILED |
| `cancel` | — | CANCELLED |
| `expire` | — | EXPIRED |
| `refund` / `partial_refund` | — | REFUNDED |

**Idempotency**: notifications may arrive more than once or out of order. Key off `orderCode`,
apply forward-only transitions, and never trigger a second delivery.
**Hardening (recommended)**: on `PAID`, additionally verify by calling Midtrans GET status API
before delivering, since frontend callbacks are user-modifiable.

### 12.2 WAHA

- Base URL `WAHA_BASE_URL`; auth header `X-Api-Key: <WAHA_API_KEY>`; session `WAHA_SESSION` (default `default`).
- `chatId = "<normalizedDigits>@c.us"`.
- **Send the e-book** — `POST {WAHA_BASE_URL}/api/sendFile`. Read the file from
  `EBOOK_FILES_DIR/<product.filePath>` and inline it as base64 in `file.data` (no public URL):
```json
{
  "session": "default",
  "chatId": "628123456789@c.us",
  "file": { "mimetype": "application/pdf", "filename": "my-ebook.pdf",
            "data": "<base64-encoded file contents>" },
  "caption": "Terima kasih atas pembelianmu! 🎉 Berikut e-book kamu."
}
```
  Base64 is the **only** delivery method in this build. WAHA is a 3rd-party service reachable only
  over the public internet, so the request (API key + full e-book payload) **must** go over `https://`
  — TLS is the sole protection for the file and key in transit; never call WAHA over plain `http://`.
  The `file.url` approach is **not** usable here, because a URL the 3rd-party WAHA could fetch would
  mean exposing the e-book publicly. Base64 inflates the payload ~33%, so confirm the provider's
  **maximum request body size** fits your largest e-book (a 20 MB PDF ≈ ~27 MB encoded); if a file is
  too large for the provider's limit, it cannot be delivered this way.
- Optionally also `POST /api/sendText` for a friendly intro message before the file.
- A successful response includes a message id → store as `wahaMessageId`.
- **Session health**: the WhatsApp number is linked once in the **provider's dashboard** (no QR
  handling on our side). If the provider's session drops, sends fail → deliveries go to retry.
  Surface send failures to the operator so a re-link in the provider dashboard can be triggered.

**Phone normalization (`src/lib/phone.ts`)** — Indonesian numbers:
1. Strip spaces, dashes, parentheses, and a leading `+`.
2. Leading `0` → replace with `62`. Leading `8` (no `0`/`62`) → prefix `62`. Leading `62` → keep.
3. Result must be digits only, length ~10–15. Reject otherwise (`422` at checkout).
4. `chatId = normalized + "@c.us"`.

---

## 13. Non-Functional Requirements `[STABLE]`

- **Security**: Midtrans signature verification is mandatory; the e-book directory lives outside the
  web root and is **never served statically** (verify it is not under Next.js `public/`); files reach
  the buyer only via the server-to-server WAHA request; the app→WAHA call (carrying the API key and
  the base64 e-book) **must use `https://`** since WAHA is a public 3rd-party endpoint — never plain
  HTTP; if the provider supports IP allowlisting, restrict it to the App host's egress IP; the WAHA
  API key is a secret stored only in env; admin endpoints require `ADMIN_TOKEN`; all inputs validated
  with zod; secrets only in env; HTTPS only for the webhook.
- **Idempotency & integrity**: duplicate/out-of-order Midtrans notifications never create double
  entries or double deliveries; one `Delivery` per `Order`.
- **Reliability**: delivery retries with exponential backoff up to `maxAttempts`; failures are
  visible and operator-recoverable.
- **Privacy (Indonesia UU PDP)**: collect only name/email/WhatsApp/trackingId; show a brief consent
  note + link to a privacy statement at checkout; define a data-retention period `[OPEN]`. Note that
  the 3rd-party WAHA provider acts as a **processor** — it sees the buyer's WhatsApp number and the
  e-book file — so choose a provider you trust and, where required, put a data-processing agreement
  in place.
- **Observability**: every notification logged as `PaymentEvent`; every delivery attempt logged on
  `Delivery` (`attempts`, `lastError`); structured server logs.
- **Performance**: webhook persists + acks `200` quickly; the actual send runs without blocking the ack.

---

## 14. Error Handling & Edge Cases `[STABLE]`

| Case | Expected behaviour |
|---|---|
| Duplicate notification | Idempotent: recorded as event, no duplicate state change, no re-send |
| Late `pending` after `settlement` | Ignored (forward-only) |
| `deny` / `expire` / `cancel` | Order set to FAILED/EXPIRED/CANCELLED; **no delivery** |
| `capture` + `challenge` | Order stays PENDING; no delivery until resolved |
| Refund after delivery | Order → REFUNDED; file already sent (cannot recall) — operator note |
| Invalid WhatsApp number | Rejected at checkout (`422`); if discovered at send time → delivery FAILED + operator alert + manual resend with corrected number |
| WAHA session down | Send fails → retried by cron; operator alerted; resumes when the number is re-linked in the provider dashboard |
| E-book exceeds provider's request-size limit | Send rejected; mark delivery FAILED + operator alert (file too large for base64 over this provider) |
| 3rd-party WAHA rate-limited / 5xx | Treated as transient; retried with backoff up to `maxAttempts` |
| `WAHA_BASE_URL` is not `https://` | App refuses to start / refuses to send (no cleartext API key or e-book) |
| Midtrans create fails at checkout | Return `502`; order not left in a payable-but-broken state |
| Buyer buys twice | Two orders, two deliveries — both valid |

---

## 15. Future Extension — Challenge Module (NOT built now) `[DRAFT]`

The current model already captures everything needed to gate a future contest on a **paid order**.
When the challenge is added, introduce (without changing existing tables):
- `Contest` (window, product link, prize), `ContestEntry` (links to a paid `Order`/`Customer`),
  and a `Score`/leaderboard store (Postgres window functions, optionally Redis sorted set later).
- Eligibility rule: a customer may enter only if they have a `PAID` `Order` for the contest's product.
- Keep scoring **server-authoritative** (see prior design discussion).

**Extension seam in this build**: do not couple delivery logic to order creation tightly; keep
`Customer`↔`Order` clean and queryable by `productId` + `status = PAID`.

---

## 16. Open Questions `[OPEN]`

1. **Single product or catalog?** Schema supports many; confirm whether v1 ships one product only.
2. **Tracking ID semantics** — affiliate code, ad-campaign id, or both? Affects future reporting (not behaviour now).
3. **Email fallback** — if WhatsApp delivery permanently fails, should the system also email the e-book? (Currently out of scope.)
4. **Data retention period** for buyer PII (UU PDP).
5. **3rd-party WAHA provider** — which provider, its **max request body size** (limits e-book size for base64), whether it supports **IP allowlisting**, its auth header, and whether a data-processing agreement is needed.
6. **Checkout failure policy** — on Midtrans create failure, delete the PENDING order or mark it FAILED?

---

## 17. Definition of Done `[STABLE]`

- [ ] Buyer can complete the full flow on a deployed environment: form → Midtrans → WhatsApp delivery → thank-you page.
- [ ] All F1–F7 acceptance criteria pass.
- [ ] Midtrans signature verification + idempotent, forward-only status updates implemented and tested.
- [ ] Exactly-once delivery guaranteed per order; automatic retry with backoff working.
- [ ] Operator can list orders and manually re-send (incl. corrected number).
- [ ] `.env.example`, `docker-compose.yml` (WAHA), Prisma migrations, and seed all present.
- [ ] README documents local setup (Postgres + WAHA session QR + Midtrans sandbox + cron).
- [ ] No secrets committed; e-book directory is outside the web root and not served statically (not publicly reachable).

---

## 18. Deployment Runbook — App Host + 3rd-party WAHA `[STABLE]`

You deploy **one host** (the App host, AlmaLinux 10 VPS). **WAHA is an external 3rd-party managed
service** consumed over public HTTPS — there is no WAHA infrastructure for you to run.

### 18.1 Topology
**App host (AlmaLinux 10 VPS)** — Docker Compose: `caddy` + `app` + `postgres`. Public on 80/443.
- **caddy** — ports 80/443, automatic TLS (Let's Encrypt), reverse-proxies to `app`.
- **app** — Next.js (built from `Dockerfile`); mounts the private e-book volume; reads env. The
  delivery worker calls the 3rd-party WAHA at `WAHA_BASE_URL` (HTTPS) with `X-Api-Key`.
- **postgres** — data on a volume; not published to the host.

**WAHA (3rd party)** — external HTTPS endpoint + API key. The WhatsApp number is linked in the
provider's dashboard. No VPN/private network is available, so the app→WAHA call goes over the public
internet and **must** use `https://`; TLS is the only thing protecting the API key and the base64
e-book in transit.

### 18.2 App host — preparation (run once)
```bash
# System + the kernel module Docker's bridge needs (missing on minimal/cloud images)
sudo dnf -y update
sudo dnf -y install dnf-plugins-core kernel-modules-extra
sudo reboot                      # reboot if kernel / kernel-modules-extra were updated

# Docker CE (Podman is the EL default; we use Docker CE from the official repo)
sudo dnf -y remove podman runc || true
sudo dnf config-manager --add-repo https://download.docker.com/linux/rhel/docker-ce.repo
sudo dnf -y install docker-ce docker-ce-cli containerd.io docker-buildx-plugin docker-compose-plugin
sudo systemctl enable --now docker
# Note: do NOT add your user to the docker group on production.
# docker group = effective root (privilege escalation via /var/run/docker.sock).
# Use `sudo docker compose ...` for all commands instead.

# Firewall: expose ONLY http/https publicly
sudo firewall-cmd --permanent --add-service=http --add-service=https
sudo firewall-cmd --reload
# Do NOT open 5432 (Postgres). (Outbound HTTPS to the WAHA provider is allowed by default.)

# Private e-book directory (upload files here via scp/sftp)
sudo mkdir -p /data/ebooks
```

> **SELinux stays enforcing.** Do not disable it. Bind-mounted volumes must carry the `:Z` flag or
> SELinux blocks the container from reading them. If the `kernel-modules-extra` reboot is skipped,
> Docker may fail to start its bridge network (`xt_addrtype` error in `journalctl -u docker`).
> **Podman alternative:** `sudo dnf install podman podman-compose`, run rootless; same files + `:Z`.

### 18.3 App host — docker-compose.yml (shape)
```yaml
services:
  caddy:
    image: caddy:2
    ports: ["80:80", "443:443"]
    volumes:
      - ./Caddyfile:/etc/caddy/Caddyfile:Z
      - caddy_data:/data
    depends_on: [app]
    restart: unless-stopped
  app:
    build: .
    env_file: .env                       # WAHA_BASE_URL = the 3rd-party HTTPS endpoint
    volumes:
      - /data/ebooks:/data/ebooks:Z      # EBOOK_FILES_DIR, private, SELinux-labelled
    depends_on: [postgres]
    restart: unless-stopped              # no host port; reached via caddy only
  postgres:
    image: postgres:16
    environment:
      - POSTGRES_PASSWORD=${POSTGRES_PASSWORD}
      - POSTGRES_DB=ebook
    volumes:
      - pgdata:/var/lib/postgresql/data
    restart: unless-stopped              # no host port
volumes:
  caddy_data:
  pgdata:
```
`.env`: `DATABASE_URL=postgresql://postgres:<pw>@postgres:5432/ebook`,
`EBOOK_FILES_DIR=/data/ebooks`, and `WAHA_BASE_URL=https://your-instance.waha-provider.example`.

**Caddyfile:**
```
yourdomain.com {
    reverse_proxy app:3000
}
```

### 18.4 3rd-party WAHA — provider setup (no infra to run)
- In the provider's dashboard, **link the seller's WhatsApp number** (scan QR / pair there).
- Copy the instance's **HTTPS base URL** → `WAHA_BASE_URL` (must be `https://`).
- Copy/generate the **API key** → `WAHA_API_KEY`.
- If the provider supports **IP allowlisting**, restrict access to the App host's egress IP.
- Verify reachability from the App host:
  ```bash
  curl -fsS -H "X-Api-Key: $WAHA_API_KEY" "$WAHA_BASE_URL/api/sessions"
  ```

### 18.5 App host — bring-up
```bash
sudo docker compose up -d --build
sudo docker compose exec app node_modules/.bin/prisma migrate deploy
sudo docker compose exec app node prisma/seed.mjs
```

> `prisma db seed` was removed in Prisma 7. Run the seed script directly.
> Do NOT use `npx prisma` — npx pulls the latest registry version which may differ from the
> installed version. Use the local binary at `node_modules/.bin/prisma` instead.

### 18.6 Final wiring
- Point the domain's DNS **A record** at the App host IP (Caddy then issues TLS automatically).
- In the **Midtrans dashboard**, set the Payment Notification URL to
  `https://yourdomain.com/api/webhooks/midtrans`.
- Upload the e-book file(s) to `/data/ebooks` and set each product's `filePath`.
- Run a **sandbox** end-to-end test before going live.

### 18.7 Deploy checklist
- [ ] `kernel-modules-extra` installed + host rebooted; `docker info` shows the engine running.
- [ ] SELinux `Enforcing`; all bind mounts use `:Z`; the app can read `/data/ebooks`.
- [ ] firewalld exposes only 80/443; Postgres (5432) not internet-reachable.
- [ ] `WAHA_BASE_URL` is `https://`; the `curl` health check to WAHA succeeds from the App host.
- [ ] (If available) provider IP allowlist restricted to the App host egress IP.
- [ ] WhatsApp number linked in the provider dashboard; a test send reaches WhatsApp.
- [ ] Largest e-book confirmed under the provider's max request body size.
- [ ] Caddy serves valid HTTPS for the domain; the webhook URL responds over HTTPS.
- [ ] Midtrans (sandbox first) end-to-end: pay → webhook → delivery succeeds.
- [ ] All services `restart: unless-stopped` and `docker` enabled on boot.

---

## 19. Build & Resume Protocol `[STABLE]`

This project is built across multiple sessions. Because the assistant has **no memory between
sessions**, project state must live in durable files, not in chat. These four artifacts are the
source of truth, in priority order:

1. **`CLAUDE.md`** (repo root) — immutable project rules, stack, commands, and invariants.
   Auto-loaded by Claude Code at the start of every session. Keep it under ~200 lines.
2. **This PRD** — the full spec and acceptance criteria. Nothing is built that isn't here.
3. **`PROGRESS.md`** (repo root) — the live build state: what's done, what's in progress, what's
   next, decisions, and known issues. Updated at the end of every session.
4. **Git history + tests** — the un-forgettable record of what actually exists and works.

### 19.1 Session-start routine (every session)
1. Read `CLAUDE.md`, then `PROGRESS.md`, then this PRD's §5 acceptance criteria.
2. Inspect the actual repo state (`git log --oneline -10`, `git status`) — trust the code, not a summary.
3. Reconcile: confirm `PROGRESS.md` matches reality; fix it if it drifted.
4. Continue from the single item under "In progress" in `PROGRESS.md`. **Read files before editing them**; never assume prior content.

### 19.2 Session-end routine (before stopping / running low on context)
1. Get the repo to a **working state** (it builds and existing tests pass).
2. Commit with a clear message referencing the feature (e.g., `feat(F3): midtrans webhook signature verify`).
3. Update `PROGRESS.md`: tick completed acceptance criteria, set the next "In progress" item, log any decisions/assumptions and known issues.
4. If a design decision was made, also fold it into this PRD (bump version + changelog) — chat-only decisions are lost.

### 19.3 Build order (vertical slices, each independently testable)
Build feature-by-feature so an interruption between slices is always clean. Suggested order:
`scaffold + Prisma schema + env validation` → **F7** products/seed → **F1** checkout form →
**F2** order + Midtrans Snap → **F3** webhook (signature, idempotency, status map) →
**F4** WAHA base64 delivery → **F5** retry/backoff → **F6** admin view + manual resend → polish/SLC pass.
Each slice ends green (builds + tests pass) and is committed before the next begins.

### 19.4 Anti-regression rules
- Every completed feature gets at least one test; run the suite before and after each slice.
- Commit the lockfile; never change dependency versions mid-build without recording it in `PROGRESS.md`.
- Small diffs over large rewrites; one slice per commit.
- The acceptance criteria in §5 are the contract — a feature is "done" only when its boxes are ticked **and** verified.

### 19.5 Resuming in this chat interface (if not using Claude Code)
A new conversation starts blank. To resume: upload the current repo (zip) + `PROGRESS.md` + this PRD,
and instruct the assistant to run the §19.1 routine before writing any code.
