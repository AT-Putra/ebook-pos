# CLAUDE.md — E-book Sales & WhatsApp Delivery System

> Auto-loaded by Claude Code every session. Keep under ~200 lines. The full spec is in
> `PRD-ebook-sales-system.md`; live state is in `PROGRESS.md`. **Read both before writing code.**

## What this is
A backend-driven system that sells a single digital e-book and delivers it to the buyer over
WhatsApp. Flow: landing/checkout form → Midtrans payment → on confirmed payment, send the e-book
file to the buyer's WhatsApp via a 3rd-party WAHA service. No contest yet (deferred). Built as
**SLC** (Simple, Lovable, Complete): minimal surface area, but the sell→pay→deliver loop is fully
done, idempotent, and recoverable.

## Stack
- Next.js 16 (App Router) + TypeScript 6
- PostgreSQL 17 + Prisma 7 + `@prisma/adapter-pg` (driver adapter required by Prisma 7)
- Zod 4 for input + env validation
- Midtrans Snap (payments) + webhook
- **Switchable WhatsApp engine (D15, §24): WAHA (default) ↔ Fonnte** — chosen in Pengaturan
  (`MessagingConfig` singleton). WAHA = self-hosted, base64 file payload, `…@c.us`, humanized sendSeen/typing
  sequence + priming + LID resolution. Fonnte = `https://api.fonnte.com/send`, `Authorization: <FONNTE_TOKEN>`,
  bare `628…` target, binary multipart `file` (10 MB cap), server-side `typing`/`delay`. Both HTTPS, never a
  public file URL (inv. #4/#5). Resolve the active engine via `lib/messaging.ts` `getWaEngine()`
- `nodemailer` over Gmail SMTP (App Password) — **email fallback** for failed WA delivery (D14, §23)
- Caddy (reverse proxy + TLS), Docker Compose (Node 22-alpine), AlmaLinux 10 host. `Caddyfile` site
  address is `{$SITE_ADDRESS}` (from `.env`, passed to the caddy service via `env_file`) — keeps the file
  generic in git (no per-deploy domain conflict). It sets production security headers (HSTS,
  `X-Frame-Options`, `nosniff`, `Referrer-Policy`, CSP `frame-ancestors`) + a `request_body max_size 40MB` cap.
- Dashboard tables: TanStack Table (`@tanstack/react-table`); export: `jspdf` + `jspdf-autotable` (PDF), `Blob` (CSV)

## Commands
- Install: `npm install`
- Dev: `npm run dev`
- Build: `npm run build`
- Test: `npm test` (run before AND after each slice)
- Lint/typecheck: `npm run lint` / `npx tsc --noEmit`
- DB migrate (dev): `npx prisma migrate dev`
- DB migrate (deploy): `node_modules/.bin/prisma migrate deploy`
- Seed: `node prisma/seed.mjs` (`prisma db seed` removed in Prisma 7)
- Reset test data (DESTRUCTIVE; keeps config/products/admins/settings): `scripts/reset-test-data.mjs` —
  truncates the transactional tables (Customer/Order/PaymentEvent/Delivery/DeliveryItem/Challenge­Participant/
  ChallengeReminderLog/ChallengeSubmission/WaMessageLog) + deletes proof videos in `CHALLENGE_MEDIA_DIR`.
  Refuses unless `CONFIRM_RESET=YES`. Run: `docker compose exec -e CONFIRM_RESET=YES app node scripts/reset-test-data.mjs` (back up with `pg_dump` first).

## Project layout (see PRD §10)
- `src/app/[slug]/page.tsx` — checkout page; `src/app/api/checkout/route.ts` — create order + Snap
- `src/app/api/webhooks/midtrans/route.ts` — payment notification
- `src/app/api/cron/process-deliveries/route.ts` — retry worker
- `src/app/api/admin/*` — operator endpoints (orders, resend; + `auth/*`, `report` for the dashboard)
- `src/app/admin/*` — operator dashboard / CMS UI; login is outside the `(dashboard)` route group; `src/proxy.ts` gates `/admin/*` (Next 16 renamed middleware→proxy; export the function as `proxy`)
- `src/components/admin/*` — dashboard UI: `DashboardShell` (responsive frame + sidebar CSS; drawer on ≤768px), `Sidebar`, `Card`/`CardStack`/`PageHeader` (shared layout primitives — §20.12), `KpiCard`, `LeadsReport`, `DataTable` (TanStack), `OriginManager`, `RateLimitSettings`, `ProgramManager` (D10: program list/add/edit + PDF upload), `WaLogs` (D5: outbound WA send audit table + filters + Resend), `LeadsList` (D4: log of every checkout submission + filters + Detail/Resend), `UserManager` (D6: admin-account add/rename/reset-password/(de)activate card)
- `src/lib/` — `db`, `env`, `validation`, `orders`, `midtrans`, `waha`, `files`, `phone`, `delivery`, `auth` (+ `password`, `session`, `cookie-names`, `report`, `cors`, `rate-limit`, `programs`, `program-serialize`, `challenge`, `challenge-reminders`, `wa-log`, `leads`, `admin-users`, `email`, `messaging` (D15 engine resolver/registry), `fonnte` (D15 Fonnte adapter + inbound parse), `challenge-inbox` (D15 shared inbound proof-capture core), `download` (D16 e-book download-link token/template/link helpers), `conversion` (D17 ad-publisher S2S postback: config + renderPostbackUrl + send/retry))
- `src/app/admin/(dashboard)/settings/` — Pengaturan: CORS allowlist + checkout rate limit + **WhatsApp engine switch** (D15, §24, `MessagingEngineSettings`) + **conversion postback** (D17, §26, `ConversionPostbackSettings`) + **admin user mgmt** (D6, §20.15, `UserManager`); APIs `/api/admin/origins[/id]`, `/api/admin/rate-limit`, `/api/admin/messaging`, `/api/admin/conversion`, `/api/admin/users[/id]`
- `src/app/api/webhooks/fonnte/route.ts` — **D15 Fonnte inbound** proof-video webhook (active when engine=fonnte). No HMAC from Fonnte → auth via `?token=` shared secret (`FONNTE_WEBHOOK_SECRET`, constant-time, fails closed). Plain-number `sender`, public `url` media. Shares `lib/challenge-inbox.ts` with the WAHA webhook.
- `src/app/download/[token]/` + `src/app/api/download/[token]/route.ts` — **D16 protected e-book download** (§25). Public (NOT admin-gated): the buyer opens the WA link, enters their registered WhatsApp number → exact match → the e-book PDF streams from `EBOOK_FILES_DIR`. Token = `Delivery.downloadToken` (base64url, 128-bit). Rate-limited (`checkDownloadRateLimit`, per token+IP). Link message = editable `Product.linkMessageTemplate` (`lib/download.ts` `renderLinkMessage`). E-book now sent via `engine.sendText` in `delivery.ts`; attachments still `engine.sendFile`.
- `src/app/admin/(dashboard)/program/` — Program (D10): product/program config + e-book PDF upload + **attachment PDFs** (`ProductAttachment`, add/remove) + sales window; APIs `/api/admin/programs[/id]` + `/programs/[id]/attachments[/attId]` (multipart). `lib/programs.ts` = pure sales-window logic. Buyer gets e-book + all attachments on purchase (per-file `DeliveryItem`)
- `src/app/admin/(dashboard)/challenge/` + `/active/` — Challenge module (D11, §21): `challenge/` = per-program challenge config (`Challenge` 1:1 `Product`, all fields editable, seeded from `docs/challenge-rules.md`; templates card has a **test-send**: per-template "Kirim tes" → `POST /api/admin/whatsapp/test`); `active/` = User/Active participant list + status (verify proof videos, enter weights, %-loss leaderboard). Proof videos **auto-captured** via `/api/webhooks/waha` (inbound) into private `CHALLENGE_MEDIA_DIR`. APIs `/api/admin/challenges/[productId]`, `/participants[/id][/proof/[kind]]`, `/whatsapp/test`. `lib/challenge.ts` = pure day/phase/%loss/status logic + `computeDueReminders` (D12). **D12 automation:** Midtrans PAID auto-creates a participant (`AWAITING_INITIAL`) **and instantly sends the `after_purchase` instructions** (via `sendChallengeReminderOnce`, fire-and-forget, idempotent — not waiting for the cron); cron `/api/cron/challenge-reminders` (hourly, `isCron`) sends the rest of the reminder schedule once each (idempotent via `ChallengeReminderLog`) + auto-eliminates; `final_received` sent on verify-final. Reminder send = shared `sendChallengeReminderOnce` (reserve-then-send) used by both webhook + cron. Rules: `docs/challenge-rules.md`.
- `src/app/admin/(dashboard)/wa-logs/` — **WA Logs (D5, §20.13):** outbound WA send audit (`WaLogs.tsx`).
  API `GET /api/admin/wa-logs` (filters: status/category/programId/from/to/q). Backed by `WaMessageLog`
  (immutable, FK-decoupled). `lib/wa-log.ts` `logWaSend` is **best-effort** (never blocks/fails a send),
  called from `delivery.ts` (per `DeliveryItem`) + `challenge-reminders.ts` (per reminder). Scope =
  **outbound only** (e-book/attachment delivery + challenge reminders); inbound + the operator test-send
  are NOT logged. Resend on FAILED delivery rows reuses `/api/admin/deliveries/[id]/resend`. Backfill:
  `npm run wa-logs:backfill`.
- `src/app/admin/(dashboard)/leads/` — **Leads (D4, §20.14):** log of **every checkout submission**
  (`Order`, any status — Lead = any submission, §20.2) via `LeadsList.tsx`. API `GET /api/admin/leads`
  (filters: programId/status/from/to/q). **No schema change** (reads `Order`/`Customer`/`Delivery`).
  Per-row **Detail** modal + **Resend** (optional corrected WA) reuses `/api/admin/deliveries/[id]/resend`.
  Pure `lib/leads.ts` (`formatIdr`/`leadStatusMeta`). PII shown full. Purchase (PAID-only) page = later.
- `landing-pages/` (D13, §22) — 3 standalone marketing pages (`lp1/2/3.html`) hosted on OTHER domains.
  Each POSTs a real order to `{CHECKOUT_API_BASE}/api/checkout` (`submitCheckout`) then redirects to the
  Midtrans `redirectUrl` — reuses the existing checkout contract (no app/schema change). Operator sets
  two constants (`CHECKOUT_API_BASE`, `PRODUCT_SLUG`) + **adds each hosted origin to the CORS allowlist**
  (Pengaturan, invariant #10). Email is required on these pages. Setup: `landing-pages/README.md`.
- `prisma/schema.prisma`, `prisma/seed.mjs`, `prisma.config.js`

## NON-NEGOTIABLE INVARIANTS (do not violate)
1. **Midtrans webhook**: verify `signature_key == SHA512(order_id + status_code + gross_amount + SERVER_KEY)`
   using the EXACT `gross_amount` string from the payload. Reject mismatches. Log every notification.
2. **Idempotent + forward-only** order status updates. Duplicate/out-of-order notifications must not
   double-update or trigger a second delivery. A late `pending` after `settlement` is ignored.
3. **Exactly-once delivery (per item)**: one `Delivery` row per order (`orderId` unique); within it one
   `DeliveryItem` per file (e-book + each attachment, §20.11). Delivery fires only on the `PAID`
   transition; each item is sent at most once — a retry resends only items not yet `SENT`, and the
   `Delivery` is `SENT` only when every item is `SENT`. Never send any item twice automatically. **D16
   (§25):** the e-book item `SENT` = the **download-link message** was sent (the file itself is fetched
   later via `/api/download/[token]`, re-downloadable); attachment items `SENT` = the file was sent.
4. **Private files**: the e-book/attachments under `EBOOK_FILES_DIR` and challenge **proof videos** under
   `CHALLENGE_MEDIA_DIR` are OUTSIDE the web root. NEVER under `public/`, never served statically, never
   given to a WA provider as a URL. They are streamed ONLY by an authorized handler: proof videos to an
   authenticated admin; the e-book by the **tokenized, phone-gated** `/api/download/[token]` (D16, §25) —
   the unguessable `Delivery.downloadToken` + an exact registered-WhatsApp-number match + rate-limit. The WA
   message carries an app **link**, never a file URL. Attachments are still sent as file attachments.
5. **Active engine over HTTPS only, never a file URL** (engine-aware, §24.6): WAHA `WAHA_BASE_URL` must
   start with `https://` (refuses otherwise); the file goes as base64 in `file.data` (never `file.url`),
   API key in `X-Api-Key`. Fonnte sends to `https://api.fonnte.com/send` with the file as a binary
   multipart `file` (never the public `url` param), token in `Authorization`. Neither engine ever hands
   a private file to the provider as a URL.
6. **No server key / secrets to the client.** Only the Snap token / redirect URL goes to the browser.
7. **Validate all input with zod.** Normalize Indonesian WhatsApp numbers to `62…@c.us`
   (`08…`→`62…`, `8…`→`62…`); reject invalid numbers at checkout.
8. **Currency is IDR**, integer amounts (no decimals).
9. **No customer login** in v1 — checkout is a plain form (name, email, WhatsApp, optional trackingId).
   **Checkout dedup (D18, §27):** a repeat checkout for the same customer (email+whatsapp) + product reuses
   the existing lead — `lib/orders.ts` `decideCheckoutAction`: any PAID → status page (`/thank-you?order_id=`,
   shows purchase date + CS contact, order untouched); latest PENDING(+URL) → resume Snap; EXPIRED/PENDING(no
   URL) → `renewOrderForPayment` (new orderCode, same lead → PENDING) + fresh Snap; FAILED/CANCELLED/REFUNDED
   → new order. `trackingId` set only when previously empty (`shouldSetTracking`), never on PAID. Response
   always returns `redirectUrl` so frontends are unchanged.
10. **CORS on `/api/checkout`** is allowlist-driven (`AllowedOrigin` table, managed in Pengaturan):
    echo `Access-Control-Allow-Origin` only for the app's own origin or an active listed origin,
    checked live via `lib/cors.ts`. Never use `*`. CORS is not an auth/anti-abuse boundary.
11. **Checkout rate limit** (`lib/rate-limit.ts`, `RateLimitConfig` singleton, Pengaturan UI):
    per-IP fixed window, in-memory (per container), configurable + disableable; `429` + `Retry-After`
    when exceeded. Config cached 10s; admin PUT clears the cache. **Admin login** has a SEPARATE,
    always-on per-IP throttle (`checkLoginRateLimit`, fixed 8/5min — NOT the disableable checkout config)
    on `/api/admin/auth/login`, before the scrypt verify (anti-brute-force). Machine secrets
    (`ADMIN_TOKEN`/`CRON_SECRET`) are compared constant-time (`lib/auth.ts` `safeEqual`); `CRON_SECRET`
    is `x-cron-secret` header-only (no `?secret=` query — keeps it out of logs).
12. **Sales window (`lib/programs.ts` `isOnSale`)**: a program with a `salesEndAt` in the past (or a
    future `salesStartAt`, or `isActive=false`) is NOT buyable — `/api/checkout` returns `403` and
    creates no order; the `[slug]` page hides the form. Server check is authoritative. Dates are WIB
    (start = 00:00:00, end = 23:59:59.999 inclusive); null bound = unbounded. Uploaded PDFs follow
    invariant #4 (private, traversal-safe name, atomic write, never `public/`).
13. **Challenge (§21)**: one `Challenge` per program (`productId @unique`), one `ChallengeParticipant`
    per PAID `Order` (`orderId @unique`). **Inbound auth is per engine** (§24.4): `/api/webhooks/waha`
    subscribes to WAHA's **`message`** event, auth = **HMAC-SHA512** of the raw body in header
    `X-Webhook-Hmac` (key = `WAHA_WEBHOOK_SECRET`); `/api/webhooks/fonnte` (Fonnte exposes no HMAC) auth =
    a **shared secret in the URL** `?token=` compared constant-time to `FONNTE_WEBHOOK_SECRET`. Both
    fail closed when their secret is unset and are **idempotent** on the stored provider message id
    (→ `ChallengeSubmission.wahaMessageId`; WAHA `payload.id`, Fonnte `id`-or-hash). The store/record/
    advance/ack core is shared via `lib/challenge-inbox.ts`. WAHA inbound
    media arrives as `payload.media.url` — download it with `X-Api-Key: WAHA_API_KEY` (https only) and
    store under `CHALLENGE_MEDIA_DIR` (invariant #4). **Sender id may be a privacy `…@lid` (not a phone
    number)** — `lib/waha.ts` `parseJid`/`resolveLidToPhone`/`resolvePhoneToLid` map it via WAHA's LIDs
    API so the inbound match still works (§21.6). %-loss formula `(awal−akhir)/awal×100` is FIXED.
    The webhook **never auto-verifies** (admin reviews), but **does auto-acknowledge** a stored video via
    the editable `proof_received` template ("Menerima bukti video", before `day1`) — humanized, idempotent
    (`ChallengeReminderLog` key `proof_received:<msgId>`), skipped if blank/rejected (§21.6, 0.11.3).
    Outbound WA reminders + auto phase/elimination cron are D12. Challenge is additive: never touches the
    buyer checkout/delivery flow.
14. **Humanized WA sends (§12.2.1, anti-spam — ALWAYS; engine-aware §24.6)**: every conversational/reminder
    text send goes through the active engine's `sendText` (`getWaEngine()`). For **WAHA** that is
    `lib/waha.ts` `sendTextHumanized`: `sendSeen` → `startTyping` →
    wait a random interval scaled to message length → `stopTyping` → `sendText` (all `X-Api-Key`, https).
    The transactional e-book `sendFile` on PAID is exempt (may still typing-indicate). **Recipient priming:**
    BOTH send paths call `primeRecipient(chatId)` first — `checkNumberExists` (`GET /api/contacts/check-exists`)
    to resolve + prime the E2E session for a never-contacted number (else the send is accepted but stuck
    `PENDING`/undelivered), then a randomized `primeDelayMs` (1.5–3.5s). Best-effort, never blocks the send.
    Debug: `[waha-send]` log turns on with `NODE_ENV=development` OR env `WAHA_LOG_SENDS=1`. For **Fonnte**
    humanization is delegated to its server-side `typing`/`delay` params (no priming/LID needed — bare number).

## Status mapping (Midtrans → OrderStatus)
`settlement`/`capture+accept` → PAID · `capture+challenge` → PENDING (no delivery) · `pending` → PENDING ·
`deny` → FAILED · `cancel` → CANCELLED · `expire` → EXPIRED · `refund`/`partial_refund` → REFUNDED.
Delivery happens ONLY on PAID.
**Transitions** (`lib/orders.ts` `canTransition`): explicit allow-map, NOT a linear rank. PENDING→any
final; **PAID→REFUNDED only** (never overwritten by a late failure); failure/refund states terminal;
same→same is a no-op. **Delivery** (`lib/delivery.ts`): `attemptDelivery` atomically claims
`PENDING/FAILED→PROCESSING` (no double-send), then sends each not-yet-`SENT` `DeliveryItem` in
`sortOrder` (e-book first, then attachments); `Delivery`→`SENT` only when all items sent. Cron reclaims
stale `PROCESSING` (>10 min); backoff `[1,5,15,60,360]` min, first retry at 1 min. `DeliveryItem` rows
are snapshotted from the product's e-book + `ProductAttachment`s when the `Delivery` is created on PAID.

## Build order (vertical slices — see PRD §19.3)
scaffold + schema + env → F7 products/seed → F1 checkout form → F2 order+Snap →
F3 webhook → F4 WAHA base64 delivery → F5 retry/backoff → F6 admin+resend → SLC polish.
**Done & deployed (F1–F7 + polish + D1–D3.1 dashboard + D8 CORS + D9 rate limit + D10 Program + §20.12 Card UI).**
**Built, pending deploy: D11 Challenge module** (§21) + **D12 Challenge WA automation** (§21.8) —
config + User/Active + WAHA inbound capture; **auto-create participant on PAID** (`AWAITING_INITIAL`);
hourly cron `/api/cron/challenge-reminders` sends the reminder schedule (idempotent via `ChallengeReminderLog`)
+ auto-eliminates (H+15 no-initial / day-105 no-final); `final_received` sent by the verify-final action.
Deploy needs the migrations, `CHALLENGE_MEDIA_DIR` volume, `WAHA_WEBHOOK_SECRET`, the WAHA session webhook
→ `/api/webhooks/waha`, **and a system cron hitting `/api/cron/challenge-reminders` hourly**.
Rules source of truth: `docs/challenge-rules.md`.
**Built, pending deploy: D5 WA Logs** (§20.13) — `WaMessageLog` audit table (migration
`20260622000000_add_wa_message_log`) of every outbound WA send; `/admin/wa-logs` with filters + Resend;
backfill via `npm run wa-logs:backfill`. Deploy needs only the migration (no new env/cron/volume).
**Built, pending deploy: D4 Leads list** (§20.14) — `/admin/leads`, log of every checkout submission;
no schema change (rebuild image only).
**Built, pending deploy: D6 User management** (§20.15) — admin-account CRUD card in Pengaturan
(add/rename/reset-password/(de)activate); APIs `/api/admin/users[/id]`; no schema change (rebuild only).
**Built, pending deploy: D17 Conversion postback to ad publisher** (§26) — on the `PAID` transition the
Midtrans webhook fires a **fire-and-forget GET postback** to a single operator-configured publisher URL
(`lib/conversion.ts` `sendConversionPostback`, idempotent via `Order.conversionPostbackSentAt`, best-effort,
retried by the `process-deliveries` cron). **trxid = `Order.trackingId`** (reused — no new field/landing
change). Macros `{trxid}` (required) / `{amount}` / `{orderid}` via pure `renderPostbackUrl`. Config =
`ConversionConfig` singleton set in Pengaturan (`ConversionPostbackSettings` → `/api/admin/conversion`,
https + `{trxid}` validated). Migration `20260624020000_add_conversion_postback`; no new env. Plan:
`docs/conversion-postback-plan.md`.
**Built, pending deploy: D16 E-book as protected download link** (§25) — the e-book is delivered as a WA
text with a `/download/<token>` link (universal across WAHA/Fonnte, no 10 MB cap); attachments still sent
as files. Buyer enters their registered WhatsApp number on the public page → exact match → PDF streams.
Permanent + unlimited re-download while PAID; phone gate rate-limited. Token `Delivery.downloadToken`
(base64url 128-bit); link message = editable `Product.linkMessageTemplate`. Email fallback unchanged
(attaches files). New `lib/download.ts`, public `/download/[token]` + `/api/download/[token]`. Migration
`20260624010000_add_ebook_download_link`. Deploy = rebuild + migrate (no new env). Plan:
`docs/ebook-link-delivery-plan.md`.
**Built, pending deploy: D15 Switchable WhatsApp engine** (§24) — WAHA ↔ Fonnte, chosen in Pengaturan
(`MessagingEngineSettings` → `/api/admin/messaging`, `MessagingConfig` singleton). `lib/messaging.ts`
resolves the active engine (`getWaEngine()`); `lib/waha.ts` `wahaEngine` + new `lib/fonnte.ts` `fonnteEngine`
implement a shared `WaEngine` (`sendFile`/`sendText`, keyed on a normalized `628…` phone). All 4 outbound
call-sites switched. New `/api/webhooks/fonnte` inbound (token-auth) + shared `lib/challenge-inbox.ts`.
Deploy needs migration `20260624000000_add_messaging_config` + (for Fonnte) env `FONNTE_TOKEN`,
`FONNTE_WEBHOOK_SECRET`, and the Fonnte device webhook → `/api/webhooks/fonnte?token=<FONNTE_WEBHOOK_SECRET>`.
**Built, pending deploy: D14 Email fallback** (§23) — when a WhatsApp delivery item fails, the e-book +
attachments are **also** emailed to the buyer (best-effort, idempotent once/order via
`Delivery.emailFallbackSentAt`), **in parallel** with the unchanged WA retry. Gmail SMTP + App Password
via `nodemailer`, isolated behind `lib/email.ts`; wired into `delivery.ts` `maybeSendEmailFallback`.
Off unless `EMAIL_FALLBACK_ENABLED=true` + `GMAIL_USER`/`GMAIL_APP_PASSWORD` set. Deploy needs the
migration `20260623000000_add_email_fallback`, the new env, and `npm install` (new dep `nodemailer`).
**Dropped (owner 2026-06-22): D4 Purchase half (PAID-only) + D7 Laporan export page** — Leads' `Lunas`
filter + per-table CSV/PDF export cover them; their sidebar items were removed.
Each slice: ends green (builds + tests pass), is committed, then PROGRESS.md is updated.

## Dashboard notes (PRD §20)
- Mockup: `docs/mockups/cms.png`. Indonesian UI. Login-gated `/admin/*`.
- **Lead** = any checkout submission (`Order`, any status); **Purchase** = `Order.status=PAID`.
  Metrics come from existing `Order`/`Delivery` — see §20.4 for exact, WIB-bucketed definitions.
- **Active / Conv.Rate Active** KPIs: **LIVE since D6 (2026-06-22, §20.4)** — `getActiveSnapshot(productId?)`
  in `lib/report.ts` → `ReportData.snapshot` (Active = current `RUNNING` `ChallengeParticipant` count;
  Conv.Rate Active = Active ÷ cumulative PAID orders, program-scoped). Shown as a **live snapshot** on the
  real-time KPI cards. The **14-day series table also fills these columns** (since 2026-06-22) via
  `getActiveSeries(dates, productId?)` as a per-day **event count** — bucketed the same way as leads/purchase:
  a participant is counted on the single WIB day they *became* active (`startAt` = initial proof received =
  challenge day 1), so a day shows a number only when a new participant entered Active (most days 0). Per-day
  Conv.Rate Active = active ÷ purchases of the **same day** (mirrors Conv.Rate = purchase ÷ leads). Pure
  `bucketActiveByDay()` is unit-tested; the TOTAL row keeps "—" for both.
- **Program** is NOT the challenge — it is the sellable-e-book config (D10, §20.11): main e-book +
  optional **attachment PDFs** + sales window. The sidebar Program page and the Leads Report **Program
  dropdown are real/live** as of D10: the dropdown filters every metric by program/product
  (`/api/admin/report?programId=…`); "Semua program" = no filter. The future **Challenge** module will
  reference a program (`Contest.programId = Product.id`, entry gated on a PAID order) — keep it queryable.
- Auth: multi-user username+password, scrypt via `node:crypto`, DB-backed `Session` (HTTP-only cookie).
  First account via `npm run admin:create`. Never commit a default password. Put metric math in pure
  functions in `lib/report.ts` (unit-tested, no DB).
- **Auth gating:** `src/proxy.ts` guards ONLY the `/admin/*` UI pages (redirect to login). Every
  `/api/admin/*` route self-authenticates with `requireAdmin(req)` from `lib/auth.ts` — accepts a
  valid session cookie OR the `ADMIN_TOKEN` bearer. Do NOT gate `/api/admin/*` in the proxy (that
  blocks bearer/machine callers). `/api/cron/*` uses `isCron` (`x-cron-secret` header-only,
  constant-time), not requireAdmin. The login route self-rate-limits (`checkLoginRateLimit`).
- **UI consistency (§20.12) — REQUIRED for every menu:** compose pages from `PageHeader` + `CardStack` +
  `Card` (and `DataTable` for tables) from `components/admin/Card.tsx`. All cards must be the same size
  (one shell: `1px #e7ebf0` border, 12px radius, uniform padding); page width = the single
  `CONTENT_MAX_WIDTH`. Do NOT hand-roll card `<div>`s or set per-card `maxWidth`. `KpiCard` stat tiles
  are the only exempt widget (kept uniform among themselves).
- Tables use the reusable `DataTable` (TanStack Table) — sort by raw value (dates/numbers, not strings),
  global search, pagination; CSV via `Blob`, PDF via `jspdf-autotable`. Export reflects the current view.
  TOTAL row renders in the table footer (outside the paged/sorted body). jQuery DataTables is banned (fights React).

## Working rules
- Read files before editing; never assume prior content.
- Small diffs, one slice per commit. Commit messages reference the feature: `feat(F3): …`.
- Every finished feature gets at least one test. Run tests before and after each slice.
- A feature is "done" only when its PRD §5 acceptance criteria are ticked AND verified.
- If you make a design decision, record it in PROGRESS.md and fold it into the PRD (bump version).
- Don't introduce dependencies or version bumps without noting them in PROGRESS.md. Commit the lockfile.
- **Any added/changed feature ⇒ update ALL three md files (PRD, PROGRESS.md, CLAUDE.md) to match —**
  spec it in the PRD (bump version + changelog) BEFORE building, so a fresh session can work from the docs.

## Deferred (do NOT build now)
- **Dashboard Active / Conv.Rate Active KPIs** — ✅ **DONE (D6, 2026-06-22)**, no longer deferred; live off
  `ChallengeParticipant` (`getActiveSnapshot`, §20.4). Open Q#15 resolved.
- Winner-announcement automation (the reward winners are read off the %-loss leaderboard manually).
- **Dropped (owner 2026-06-22): D4 Purchase half (PAID-only) + D7 Laporan export page** — do NOT build
  unless re-requested. (D5 WA Logs §20.13 + D4 Leads §20.14 + D6 user mgmt §20.15 now BUILT.)

## Open questions (resolve before the affected slice — see PRD §16)
Single product vs catalog · tracking-ID semantics · email fallback if WhatsApp permanently fails ·
PII retention period · 3rd-party WAHA provider limits (max request body size, IP allowlist, auth).

## LSP
When tracing where a symbol is defined or finding all references to it, use LSP (goToDefinition, findReferences, hover) instead of Grep. LSP gives exact results; Grep gives text matches.

Use Grep/Glob for discovery (finding files, searching patterns). Use LSP for understanding (definitions, references, type info).

After locating a file with Grep/Glob, use LSP to navigate within it rather than reading the whole file.
