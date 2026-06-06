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
- 3rd-party WAHA over HTTPS (WhatsApp delivery), base64 file payload
- Caddy (reverse proxy + TLS), Docker Compose (Node 22-alpine), AlmaLinux 10 host
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

## Project layout (see PRD §10)
- `src/app/[slug]/page.tsx` — checkout page; `src/app/api/checkout/route.ts` — create order + Snap
- `src/app/api/webhooks/midtrans/route.ts` — payment notification
- `src/app/api/cron/process-deliveries/route.ts` — retry worker
- `src/app/api/admin/*` — operator endpoints (orders, resend; + `auth/*`, `report` for the dashboard)
- `src/app/admin/*` — operator dashboard / CMS UI; login is outside the `(dashboard)` route group; `src/proxy.ts` gates `/admin/*` (Next 16 renamed middleware→proxy; export the function as `proxy`)
- `src/components/admin/*` — dashboard UI: `DashboardShell` (responsive frame + sidebar CSS; drawer on ≤768px), `Sidebar`, `Card`/`CardStack`/`PageHeader` (shared layout primitives — §20.12), `KpiCard`, `LeadsReport`, `DataTable` (TanStack), `OriginManager`, `RateLimitSettings`, `ProgramManager` (D10: program list/add/edit + PDF upload)
- `src/lib/` — `db`, `env`, `validation`, `orders`, `midtrans`, `waha`, `files`, `phone`, `delivery`, `auth` (+ `password`, `session`, `cookie-names`, `report`, `cors`, `rate-limit`, `programs`, `program-serialize`, `challenge`)
- `src/app/admin/(dashboard)/settings/` — Pengaturan: CORS allowlist + checkout rate limit; APIs `/api/admin/origins[/id]`, `/api/admin/rate-limit`
- `src/app/admin/(dashboard)/program/` — Program (D10): product/program config + e-book PDF upload + **attachment PDFs** (`ProductAttachment`, add/remove) + sales window; APIs `/api/admin/programs[/id]` + `/programs/[id]/attachments[/attId]` (multipart). `lib/programs.ts` = pure sales-window logic. Buyer gets e-book + all attachments on purchase (per-file `DeliveryItem`)
- `src/app/admin/(dashboard)/challenge/` + `/active/` — Challenge module (D11, §21): `challenge/` = per-program challenge config (`Challenge` 1:1 `Product`, all fields editable, seeded from `docs/challenge-rules.md`; templates card has a **test-send**: per-template "Kirim tes" → `POST /api/admin/whatsapp/test`); `active/` = User/Active participant list + status (verify proof videos, enter weights, %-loss leaderboard). Proof videos **auto-captured** via `/api/webhooks/waha` (inbound) into private `CHALLENGE_MEDIA_DIR`. APIs `/api/admin/challenges/[productId]`, `/participants[/id][/proof/[kind]]`, `/whatsapp/test`. `lib/challenge.ts` = pure day/phase/%loss/status logic. **D11 = 2 menus + capture only**; WA reminder automation + auto-transitions = deferred D12. Rules: `docs/challenge-rules.md`.
- `prisma/schema.prisma`, `prisma/seed.mjs`, `prisma.config.js`

## NON-NEGOTIABLE INVARIANTS (do not violate)
1. **Midtrans webhook**: verify `signature_key == SHA512(order_id + status_code + gross_amount + SERVER_KEY)`
   using the EXACT `gross_amount` string from the payload. Reject mismatches. Log every notification.
2. **Idempotent + forward-only** order status updates. Duplicate/out-of-order notifications must not
   double-update or trigger a second delivery. A late `pending` after `settlement` is ignored.
3. **Exactly-once delivery (per file)**: one `Delivery` row per order (`orderId` unique); within it one
   `DeliveryItem` per file (e-book + each attachment, §20.11). Delivery fires only on the `PAID`
   transition; each item is sent at most once — a retry resends only items not yet `SENT`, and the
   `Delivery` is `SENT` only when every item is `SENT`. Never send any file twice automatically.
4. **Private files**: the e-book/attachments under `EBOOK_FILES_DIR` and challenge **proof videos** under
   `CHALLENGE_MEDIA_DIR` are OUTSIDE the web root. NEVER under `public/`, never served statically, never
   given to WAHA as a URL; proof videos are only ever streamed to an authenticated admin.
5. **WAHA over HTTPS only**: `WAHA_BASE_URL` must start with `https://`; the app refuses to start /
   send otherwise. Send the file as base64 in `file.data` (never `file.url`). API key in `X-Api-Key`.
6. **No server key / secrets to the client.** Only the Snap token / redirect URL goes to the browser.
7. **Validate all input with zod.** Normalize Indonesian WhatsApp numbers to `62…@c.us`
   (`08…`→`62…`, `8…`→`62…`); reject invalid numbers at checkout.
8. **Currency is IDR**, integer amounts (no decimals).
9. **No customer login** in v1 — checkout is a plain form (name, email, WhatsApp, optional trackingId).
10. **CORS on `/api/checkout`** is allowlist-driven (`AllowedOrigin` table, managed in Pengaturan):
    echo `Access-Control-Allow-Origin` only for the app's own origin or an active listed origin,
    checked live via `lib/cors.ts`. Never use `*`. CORS is not an auth/anti-abuse boundary.
11. **Checkout rate limit** (`lib/rate-limit.ts`, `RateLimitConfig` singleton, Pengaturan UI):
    per-IP fixed window, in-memory (per container), configurable + disableable; `429` + `Retry-After`
    when exceeded. Config cached 10s; admin PUT clears the cache.
12. **Sales window (`lib/programs.ts` `isOnSale`)**: a program with a `salesEndAt` in the past (or a
    future `salesStartAt`, or `isActive=false`) is NOT buyable — `/api/checkout` returns `403` and
    creates no order; the `[slug]` page hides the form. Server check is authoritative. Dates are WIB
    (start = 00:00:00, end = 23:59:59.999 inclusive); null bound = unbounded. Uploaded PDFs follow
    invariant #4 (private, traversal-safe name, atomic write, never `public/`).
13. **Challenge (§21)**: one `Challenge` per program (`productId @unique`), one `ChallengeParticipant`
    per PAID `Order` (`orderId @unique`). `/api/webhooks/waha` subscribes to WAHA's **`message`** event;
    auth = **HMAC-SHA512** of the raw body in header `X-Webhook-Hmac` (key = `WAHA_WEBHOOK_SECRET`,
    constant-time compare, like Midtrans); **idempotent** on `payload.id` (→ `wahaMessageId`). Inbound
    media arrives as `payload.media.url` — download it with `X-Api-Key: WAHA_API_KEY` (https only) and
    store under `CHALLENGE_MEDIA_DIR` (invariant #4). %-loss formula `(awal−akhir)/awal×100` is FIXED.
    D11 = config + User/Active + inbound capture ONLY (no auto-verify, no auto-reply); outbound WA
    reminders + auto phase/elimination cron are deferred to D12. Challenge is additive: never touches the
    buyer checkout/delivery flow.
14. **Humanized WA sends (§12.2.1, anti-spam — ALWAYS)**: every conversational/reminder text send (D12
    reminders, any reply) MUST go through `lib/waha.ts` `sendTextHumanized`: `sendSeen` → `startTyping` →
    wait a random interval scaled to message length → `stopTyping` → `sendText` (all `X-Api-Key`, https).
    The transactional e-book `sendFile` on PAID is exempt (may still typing-indicate).

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
**Built, pending deploy: D11 Challenge module** (§21) — Challenge Configuration menu + User/Active
participant menu + WAHA **inbound** proof-video capture (`/api/webhooks/waha`). Deploy needs the new
migration, `CHALLENGE_MEDIA_DIR` volume, `WAHA_WEBHOOK_SECRET`, + WAHA session webhook → `/api/webhooks/waha`.
**Deferred: D12** Challenge WA reminder automation + auto phase/elimination cron (§21.8).
Rules source of truth: `docs/challenge-rules.md`.
(Later: D4 leads/purchase lists · D5 WA Logs +`DeliveryAttempt` · D6 user mgmt · D7 Laporan export page.)
Each slice: ends green (builds + tests pass), is committed, then PROGRESS.md is updated.

## Dashboard notes (PRD §20)
- Mockup: `docs/mockups/cms.png`. Indonesian UI. Login-gated `/admin/*`.
- **Lead** = any checkout submission (`Order`, any status); **Purchase** = `Order.status=PAID`.
  Metrics come from existing `Order`/`Delivery` — see §20.4 for exact, WIB-bucketed definitions.
- **Active / Conv.Rate Active** KPIs: stay STUBBED (`0` / `—`) in D11. They become real off
  `ChallengeParticipant` in D12 (Active = `RUNNING` count); don't fabricate data meanwhile.
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
  blocks bearer/machine callers). `/api/cron/*` uses `isCron`, not requireAdmin.
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
**D12 — Challenge WhatsApp automation** (§21.8): the scheduled outbound reminders (rules §7/§8) + the
auto phase/elimination cron + pre-start participant tracking + wiring the dashboard Active KPIs. The
challenge config/User-Active/inbound-capture (D11, §21) IS being built now — keep its schema/status
forward-compatible with D12.

## Open questions (resolve before the affected slice — see PRD §16)
Single product vs catalog · tracking-ID semantics · email fallback if WhatsApp permanently fails ·
PII retention period · 3rd-party WAHA provider limits (max request body size, IP allowlist, auth).
