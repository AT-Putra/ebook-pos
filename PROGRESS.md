# PROGRESS.md — Live Build State

> Updated at the end of every session (see PRD §19.2). Read this + `CLAUDE.md` + the PRD before
> writing any code. Trust the repo (`git log`, `git status`) over this file if they disagree, then
> fix this file.

| Field | Value |
|---|---|
| PRD version in sync with | 0.18.2 |
| Last updated | 2026-06-22 |
| Overall status | …D10 Program + Card UI + D11 Challenge deployed?; **D11 Challenge + D12 WA automation + D13 external landing pages + D5 WA Logs + D4 Leads list + D6 User mgmt + D14 email fallback + D15 switchable WhatsApp engine (WAHA↔Fonnte) built (green) — pending VPS deploy** |
| Repo working state | green (build passes, tsc clean) |

## How to run
- Install: `npm install`
- Dev: `npm run dev`
- Test: `npm test`
- DB: `npx prisma migrate dev && node prisma/seed.mjs`
- Local stack: `docker compose up -d --build`

## Feature checklist (tick when acceptance criteria in PRD §5 pass AND are verified)
- [x] Scaffold: Next.js + TS + Prisma + zod env validation + Dockerfile/compose/Caddyfile
- [x] F7 — Products + seed
- [x] F1 — Checkout intake (form, tracking ID capture, validation)
- [x] F2 — Order creation + Midtrans Snap transaction
- [x] F3 — Midtrans webhook (signature verify, idempotent forward-only status, PaymentEvent log)
- [x] F4 — WAHA base64 delivery (phone normalization, sendFile, exactly-once)
- [x] F5 — Delivery retry / backoff (cron-style worker)
- [x] F6 — Admin: list orders + manual resend (with corrected number)
- [x] SLC polish pass (friendly WA message, thank-you page, error states, alerts)
- [x] **D1 — Dashboard auth & session** (AdminUser+Session, scrypt, login/logout, `/admin` guard, `admin:create`)
- [x] **D2 — Report metrics API** (`/api/admin/report`, pure aggregation in `lib/report.ts`)
- [x] **D3 — Leads Report dashboard UI** (cards + 14-day table + filter bar; Active/Program stubbed)
- [x] **D3.1 — Dashboard UX polish** (restyled KPI widgets + TanStack `DataTable`: sort/search/paginate + CSV/PDF export) — see PRD §20.8
- [x] **D8 — CORS domain allowlist** (`AllowedOrigin` + `/api/checkout` CORS + `/api/admin/origins` + Pengaturan UI) — PRD §20.9
- [x] **D9 — Checkout rate limit** (`RateLimitConfig` + per-IP limit on `/api/checkout` + `/api/admin/rate-limit` + Pengaturan UI; configurable + disableable) — PRD §20.10
- [x] **D10 — Program management** (Product gains `programName`/`salesStartAt`/`salesEndAt` + `ProductAttachment` + `DeliveryItem`; `/admin/program` list+add+edit modal with e-book PDF upload **+ attachment PDFs** add/remove; `lib/programs.ts` sales-window; checkout `403` after period ends; buyer gets **e-book + all attachments** (per-file exactly-once via `DeliveryItem`); live Program filter on Leads Report; Program is the future Challenge's reference entity) — PRD §20.11 *(built green: 118 tests + tsc + build; pending VPS deploy + migration)*
- [x] **D11 — Challenge module** (§21): `Challenge`/`ChallengeParticipant`/`ChallengeSubmission` + `ParticipantStatus` (migration `20260606010000_add_challenge_module`); **Challenge Configuration** (`/admin/challenge`, `ChallengeConfig.tsx`, per-program config seeded from `docs/challenge-rules.md`); **User/Active** (`/admin/active`, `ParticipantList.tsx` + manage modal: verify proofs, weights, drop, %-loss leaderboard); **WAHA inbound** (`/api/webhooks/waha`, HMAC-SHA512 auth, dedupe on payload.id, media → private `CHALLENGE_MEDIA_DIR`); admin APIs `challenges/[productId]`, `participants[/id][/proof/[kind]]`; `lib/challenge.ts` pure logic + `sendTextHumanized` in `lib/waha.ts`. *(built green: 141 tests + tsc + build; pending VPS deploy + migration)*
- [x] **D12 — Challenge WA automation** (§21.8): auto-create participant on PAID (`AWAITING_INITIAL`); hourly cron `/api/cron/challenge-reminders` sends the rules' reminder schedule (idempotent via `ChallengeReminderLog`) + auto-eliminates (H+15 / day-105); `final_received` on verify-final; `lib/challenge.ts` `computeDueReminders`. *(built green; Active KPI wiring still deferred — open Q#15)*
- [x] **D5 — WA Logs** (§20.13): new `WaMessageLog` audit table (migration `20260622000000_add_wa_message_log`) of every **outbound** WA send (e-book/attachment delivery + challenge reminders) written best-effort from `lib/wa-log.ts` (wired into `delivery.ts` + `challenge-reminders.ts`); `/admin/wa-logs` (`WaLogs.tsx`, PageHeader+DataTable, filters program/status/category/date + **Resend** on FAILED delivery rows); API `GET /api/admin/wa-logs`; backfill `npm run wa-logs:backfill`. Inbound + test-send out of scope. Resolves open Q#10. *(built green: 163 tests + tsc + build; pending VPS deploy + migration)*
- [x] **D4 (Leads half) — Leads list** (§20.14): `/admin/leads` (`LeadsList.tsx`) = log of every checkout submission (any status); API `GET /api/admin/leads` (program/status/date/search filters); DataTable + CSV/PDF export; per-row **Detail** modal + **Resend** (optional corrected WA) reusing `/api/admin/deliveries/[id]/resend`; pure `lib/leads.ts` (`formatIdr`/`leadStatusMeta`, tested). No schema change. PII shown in full. *(built green: 167 tests + tsc + build)*
- [x] **D14 — Email fallback delivery** (§23): when any item fails on a WhatsApp delivery pass, the e-book + attachments are **also** emailed to the buyer (best-effort, idempotent once/order via `Delivery.emailFallbackSentAt`), in **parallel** with the unchanged WhatsApp retry. Provider = **Gmail SMTP + App Password** via `nodemailer`, isolated behind `lib/email.ts` (`isEmailConfigured`, pure `buildEbookEmail`, `sendEbookEmail`); wired into `delivery.ts` (`maybeSendEmailFallback`); `lib/files.ts` gains `readEbookAsBuffer`. Off unless `EMAIL_FALLBACK_ENABLED=true` + `GMAIL_USER`/`GMAIL_APP_PASSWORD` set. New migration `20260623000000_add_email_fallback`. New dep `nodemailer` (+ `@types/nodemailer`). Resolves open Q#3. *(built green; pending VPS deploy + migration)*
- [x] **D15 — Switchable WhatsApp engine: WAHA ↔ Fonnte** (§24): new `lib/messaging.ts` `WaEngine` interface + DB singleton `MessagingConfig` (engine `waha`|`fonnte`, default `waha`, cached 10s) resolved via `getWaEngine()`; `lib/waha.ts` `wahaEngine` (unchanged wire behaviour) + new `lib/fonnte.ts` `fonnteEngine` (`api.fonnte.com/send`, `Authorization` token, bare `628…` target, binary multipart `file` 10 MB cap, server-side `typing`/`delay`). All 4 outbound call-sites (`delivery.ts`, `challenge-reminders.ts`, participant resend, test-send) switched. **Inbound switchable:** new `/api/webhooks/fonnte` (URL `?token=` shared-secret auth — Fonnte has no HMAC — plain-number sender, public-url media) + shared `lib/challenge-inbox.ts` (store/record/advance/ack core, also used by the refactored WAHA webhook). Engine picked in Pengaturan (`MessagingEngineSettings` → `GET`/`PUT /api/admin/messaging`); Fonnte token is a server-only env (`FONNTE_TOKEN`, never in DB/browser). New migration `20260624000000_add_messaging_config`; new optional env `FONNTE_TOKEN`/`FONNTE_WEBHOOK_SECRET`. *(built green: 211 tests + tsc + build; pending VPS deploy + migration)*
- [x] **D16 — E-book as protected download link** (§25): the main e-book is delivered as a WhatsApp **text with a `/download/<token>` link** (universal across WAHA/Fonnte, avoids Fonnte's 10 MB cap); **attachments still sent as files**. Public page `/download/[token]` + `POST /api/download/[token]`: buyer enters their **registered WhatsApp number** → exact match → e-book PDF streams from `EBOOK_FILES_DIR`. **Permanent + unlimited re-download** while `PAID`; phone gate **rate-limited** (`checkDownloadRateLimit`, per token+IP). Token `Delivery.downloadToken` = `randomBytes(16).base64url` (22 chars, 128-bit). Link message = **editable `Product.linkMessageTemplate`** (`{{name}}/{{product}}/{{link}}`, default when blank) edited in Program. `attemptDelivery` sends the e-book via `engine.sendText`, attachments via `engine.sendFile`. **Email fallback unchanged** (attaches real PDFs). New `lib/download.ts` (token/template/link, unit-tested) + `checkDownloadRateLimit`. Migration `20260624010000_add_ebook_download_link`. Invariant #4 reworded. *(built green: 225 tests + tsc + build; pending VPS deploy + migration)*
- [x] **D17 — Conversion postback to ad publisher** (§26): on `PAID`, the Midtrans webhook fires a **fire-and-forget GET postback** to one operator-configured publisher URL so the click can be attributed. **trxid = `Order.trackingId`** (reused from `ref/utm_source/fbclid` — no new field, no landing/checkout change). Macros `{trxid}` (required) / `{amount}` / `{orderid}` via pure `renderPostbackUrl` (URL-encoded, optional macros skipped if absent). `lib/conversion.ts` `sendConversionPostback` is best-effort + idempotent (`Order.conversionPostbackSentAt`), never blocks checkout/delivery; **retried** by the `process-deliveries` cron (`processPendingConversionPostbacks`). Config `ConversionConfig` singleton in Pengaturan (`ConversionPostbackSettings` → `/api/admin/conversion`; validates https + `{trxid}`). Migration `20260624020000_add_conversion_postback` (`Order` audit fields + `ConversionConfig`). No new env. *(built green: 231 tests + tsc + build; pending VPS deploy + migration)*
- [ ] (later) D4 (Purchase half) PAID-only list · D7 Laporan export page

## In progress
- **D11 Challenge module — BUILT (green), not yet deployed.** All steps below done. 141 tests + tsc +
  build green. **Deploy:** `git pull && sudo docker compose up -d --build` **then** run the migration
  (`node_modules/.bin/prisma migrate deploy`); add `CHALLENGE_MEDIA_DIR` volume (now in docker-compose.yml)
  + set `WAHA_WEBHOOK_SECRET` in `.env`; configure the WAHA session webhook (`events:["message"]`,
  `url: https://<app>/api/webhooks/waha`, `hmac.key = WAHA_WEBHOOK_SECRET`). Original build plan:
  1. Schema + migration: `Challenge` (1:1 Product, config + JSON phases/winnerTiers/messageTemplates),
     `ChallengeParticipant` (per PAID order), `ChallengeSubmission` (inbound proof), `ParticipantStatus`
     enum; relations on Product/Customer/Order. Env: `WAHA_WEBHOOK_SECRET`, `CHALLENGE_MEDIA_DIR`.
  2. `src/lib/challenge.ts` — pure `dayOfChallenge`, `currentPhase`, `percentLoss`, `participantView`,
     `defaultChallengeConfig()` (seed from rules). Unit-test phase boundaries + %-loss rounding.
  3. Inbound webhook `POST /api/webhooks/waha` — subscribe WAHA to `message` event; verify HMAC-SHA512
     `X-Webhook-Hmac` over raw body (key=`WAHA_WEBHOOK_SECRET`, constant-time); idempotent on `payload.id`
     (→ `wahaMessageId`); ignore `fromMe`/non-video; match sender→Customer→PAID order→active Challenge;
     download `payload.media.url` with `X-Api-Key` (https), store privately in `CHALLENGE_MEDIA_DIR`
     (reuse `lib/files.ts` pattern); create participant/submission (initial vs final). Ack 200 fast.
  4. Admin API: `GET/PUT /api/admin/challenges/[productId]` (upsert config); `GET /api/admin/participants`
     (?programId &group), `PATCH /api/admin/participants/[id]` (verify initial/final + weight, drop, notes),
     `GET /api/admin/participants/[id]/proof/[kind]` (stream private video, requireAdmin).
  5. UI: `challenge/page.tsx` + `ChallengeConfig.tsx` (program dropdown → config form, §20.12 Card);
     `active/page.tsx` + `ParticipantList.tsx` (DataTable + verify/weight/drop actions + %-loss sort).
     Sidebar: add **Challenge** item; set **Users / Active** `ready: true`.
  6. Tests + tsc + build green; commit; push (pre-push hook). Update all 3 md "done" state.
- **D12 — BUILT (green).** Auto-create on PAID (`AWAITING_INITIAL`) in the Midtrans webhook;
  `lib/challenge.ts` `computeDueReminders` + `renderTemplate`; cron `/api/cron/challenge-reminders`
  (isCron, hourly) sends due reminders once (reserve `ChallengeReminderLog` then send) + auto-eliminates;
  inbound webhook moves `AWAITING_INITIAL → PENDING_INITIAL_REVIEW`; verify-final sends `final_received`.
- **D5 WA Logs — BUILT (green).** `WaMessageLog` table + migration `20260622000000_add_wa_message_log`;
  `lib/wa-log.ts` `logWaSend` (best-effort, never blocks a send) + pure `buildPreview`/`phoneFromChatId`
  (unit-tested); logged from `delivery.ts` (per DeliveryItem) + `challenge-reminders.ts`
  `sendChallengeReminderOnce` (productId threaded from cron + both webhooks); API
  `GET /api/admin/wa-logs` (status/category/programId/from/to/q filters, WIB bounds, 2000-row cap,
  orderCode enrichment); UI `WaLogs.tsx` + `/admin/wa-logs` page; Sidebar **WA Logs** `ready: true`;
  Resend reuses `/api/admin/deliveries/[id]/resend`. Backfill script `scripts/backfill-wa-logs.mjs`
  (`npm run wa-logs:backfill`, idempotent). Scope decided 2026-06-22: outbound only (delivery+reminder),
  inbound + operator test-send excluded.
- **D4 Leads list — BUILT (green).** `/admin/leads` (`LeadsList.tsx`) lists every `Order` (any status)
  via new `GET /api/admin/leads` (filters: programId/status/from/to/q, WIB bounds, 5000-row cap, includes
  customer + delivery summary). DataTable (CSV/PDF) + Detail modal with Resend (optional corrected number).
  Pure `lib/leads.ts` (`formatIdr`/`leadStatusMeta`, unit-tested). Sidebar **Leads** `ready:true`. No
  schema change (reads Order/Customer/Delivery). Scope decided 2026-06-22: all statuses, PII shown full,
  Purchase (PAID-only) still later.
- **D6 User management — BUILT (green).** Admin-account CRUD as a **Pengguna (Admin)** card in
  **Pengaturan** (`UserManager.tsx`): add / rename / reset password / (de)activate. No schema change
  (`AdminUser` already complete). APIs `GET`+`POST /api/admin/users`, `PATCH /api/admin/users/[id]`
  (all `requireAdmin`). Guards: unique username (409), passwords scrypt-hashed (never returned/logged),
  can't deactivate yourself or the last active admin (422); deactivation revokes that user's `Session`s.
  New `currentAdminUser(req)` in `lib/auth.ts`; pure `lib/admin-users.ts` (zod schemas + `serializeAdminUser`
  + `deactivationBlock`, unit-tested, 11 tests). **Purchase (PAID-only) and D7 Laporan: NOT built**
  (owner 2026-06-22 — Leads `Lunas` filter + per-table CSV/PDF export cover them); both sidebar items
  removed. PRD 0.14.0 §20.15. Deploy = image rebuild only.
- **Active KPI — WIRED (green), open Q#15 resolved (2026-06-22).** `Active` / `Conv. Rate Active` KPI
  cards are now LIVE: `getActiveSnapshot(productId?)` in `lib/report.ts` → `ReportData.snapshot`
  (Active = current `RUNNING` `ChallengeParticipant` count; convRateActive = Active ÷ cumulative PAID
  orders, program-scoped). Surfaced on the real-time KPI cards in `LeadsReport.tsx`. Exported `rate()`
  helper, unit-tested. 181 tests + tsc + build green. PRD §20.4. Deploy = image rebuild only.
- **Active / Conv. Rate Active — now FILLED in the 14-day series too (2026-06-22).** The two columns
  in **Leads Report → Performa 14 Hari Terakhir** no longer render "—". New `getActiveSeries(dates,
  productId?)` in `lib/report.ts` counts Active as a **per-day event**, bucketed exactly like
  leads/purchase: a participant is counted on the single WIB day they *became* active (`startAt` =
  initial proof received = challenge day 1), so a day shows a number only when a new active user entered
  (most days 0) — **not** a running cumulative total. Per-day Conv. Rate Active = active ÷ purchases of
  the **same day** (mirrors Conv. Rate = purchase ÷ leads), computed in `getReport`. Pure
  `bucketActiveByDay(startDays)` extracted + unit-tested (3 cases). `LeadsReport.tsx` renders the values;
  TOTAL footer keeps "—". (Reworked 2026-06-22 from an earlier window/cumulative draft per owner: it must
  match the per-day recording of leads/purchase.) 184 tests + tsc + build green. PRD §20.4. Image rebuild only.

## Next up
- **Deploy D11+D12** (owner): `git pull && sudo docker compose up -d --build` → `prisma migrate deploy`
  (applies the challenge migrations incl. the `AWAITING_INITIAL` enum value + `ChallengeReminderLog`).
  Then: set `WAHA_WEBHOOK_SECRET` in `.env`; ensure `/data/challenge-media` exists; configure the WAHA
  session webhook (`events:["message"]`, url `/api/webhooks/waha`, `hmac.key=WAHA_WEBHOOK_SECRET`);
  **add a system cron hitting `GET /api/cron/challenge-reminders` hourly** (Authorization: Bearer
  `CRON_SECRET`), same pattern as `process-deliveries`.
- **Deploy D5 WA Logs** (owner): with the same `git pull && docker compose up -d --build` →
  `prisma migrate deploy` (applies `20260622000000_add_wa_message_log`). Optionally seed history once:
  `npm run wa-logs:backfill` (needs `DATABASE_URL`). No new env/cron/volume.
- **Deploy D5 WA Logs + D4 Leads + D6 User mgmt** (owner): `git pull && docker compose up -d --build`
  (Leads + D6 need no migration; WA Logs needs `prisma migrate deploy` for `WaMessageLog` — already
  applied 2026-06-22 — optional `wa-logs:backfill`).
- Optional later: wire dashboard Active KPIs (open Q#15). **D4 Purchase half + D7 Laporan: dropped**
  (owner 2026-06-22).
- (D10 already deployed by owner.)

## Decisions made (carry forward — do not re-litigate)
- **SLC**, not MVP: one product flow, no customer accounts/login.
- **No object storage.** E-book lives in a private dir `EBOOK_FILES_DIR` (e.g. `/data/ebooks`),
  outside the web root, never served statically.
- **WAHA is a 3rd-party managed service, public HTTPS only.** No VPN/private network available.
  `WAHA_BASE_URL` must be `https://`; deliver the e-book as **base64** (`file.data`) — `file.url` is
  not used (would expose the file). WhatsApp number linked in the provider's dashboard.
- **App runs on a single AlmaLinux 10 VPS** (not serverless) because the e-book is on local disk:
  Docker Compose with Caddy + app + Postgres. Only Caddy (80/443) is public.
- **Payments: Midtrans Snap.** Webhook signature = `SHA512(order_id+status_code+gross_amount+ServerKey)`;
  idempotent, forward-only; delivery only on PAID.
- **Currency: IDR** (integer). **Phone normalization** to `62…@c.us` for Indonesian numbers.
- **Contest/challenge: deferred.** Keep schema extensible (paid-order gate) but build nothing now.
- **Scaffold (2026-06-04):**
  - Next.js 15 (App Router) + TypeScript, standalone output for Docker.
  - Jest + ts-jest for tests; test env vars set in `jest.setup.ts`; test files excluded from tsconfig.
  - `jest.config.js` (plain JS, not TS) — avoids `ts-node` dependency.
  - `.gitignore` extended with `*.pem/*.key/*.crt/*.cert/*.p12/*.pfx` and `jest-cache/`.
  - `postinstall` in package.json runs `prisma generate` automatically after `npm install`.
- **Stack upgrade (2026-06-05):**
  - Next.js 15 → 16, TypeScript 5 → 6, Zod 3 → 4, ESLint 8 → 10.
  - Prisma 6 → 7: `url` removed from schema datasource, moved to `prisma.config.js` (plain JS so the
    runner needs no TS runtime); `PrismaClient` now uses `@prisma/adapter-pg` driver adapter (also in
    `prisma/seed.mjs`); `prisma db seed` removed, seed runs as `node prisma/seed.mjs` directly.
  - Node.js 20 → 22 in Dockerfile; PostgreSQL 16 → 17 in docker-compose.
  - `jest.config.js`: `moduleResolution: node` → `node16`, added `rootDir: './'` (TS 6 required).
  - ts-jest stays at 29.x (ts-jest 30 not yet released).
  - Docker fixes: copy `prisma/` before `npm ci` (postinstall needs the schema); add empty `public/`;
    copy full `node_modules` + `prisma.config.js` into the runner so `prisma migrate deploy` works;
    use `node_modules/.bin/prisma` (not `npx`, which pulls a mismatched version).
- **Dashboard / CMS decisions (2026-06-05 — PRD §20.2):**
  - **Lead** = any checkout submission (`Order`, any status); **Purchase** = `Order.status=PAID`.
    No new lead table — metrics derive from `Order`/`Delivery`.
  - **Active / Conv.Rate Active / Program** = the DEFERRED Challenge module (§15); rendered in the UI
    per the mockup but STUBBED (`0`/`—`) until that module is built. `Diet90` is a placeholder.
  - **Auth** = multi-user username+password; `AdminUser` + `Session` models; scrypt via `node:crypto`;
    HTTP-only cookie session; first account via `npm run admin:create`. Mockup: `docs/mockups/cms.png`.
- **Dashboard tables (D3.1, 2026-06-05 — PRD §20.8):** use **TanStack Table** (`@tanstack/react-table`)
  for sort/search/paginate; **`jspdf` + `jspdf-autotable`** for PDF export, native `Blob` for CSV.
  jQuery DataTables rejected (fights React's render model). Sort by raw value; export reflects current view.
- **Program = a Product, not the Challenge (D10, 2026-06-06 — PRD §20.11):** rather than a new model, a
  "program" is a `Product` row extended with `programName` + a `salesStartAt`/`salesEndAt` window
  (3 nullable columns — no breaking change, single-product seed stays always-on-sale). Keeps checkout
  per-slug and the report filterable by `productId`. The **Program** sidebar/dropdown is this config —
  **separate from** the deferred Challenge module (Active/Conv.Rate Active stay stubbed). PDF upload
  writes privately into `EBOOK_FILES_DIR` (invariant #4/#12). Past `salesEndAt` ⇒ checkout `403`.
- **Attachments + multi-file delivery (D10, 2026-06-06):** a program may carry extra PDFs
  (`ProductAttachment`, e.g. a separate to-do-list) delivered **with** the e-book on purchase. To keep
  exactly-once across files, `Delivery` gets one **`DeliveryItem` per file**, snapshotted at PAID;
  `attemptDelivery` sends each not-yet-`SENT` item, Delivery→SENT only when all sent, retry resends only
  unsent items (invariant #3 is now per-file). Chosen over a JSON `sentFilePaths` list for clean
  per-file error/retry state and to fit the future WA-Logs `DeliveryAttempt` (D5).
- **D10 UI/upload choices (2026-06-06, owner):** Add/Edit is a **modal/drawer overlaying the Program
  page** (not a separate route). **Max upload = 32 MB per PDF** (`MAX_UPLOAD_BYTES`). Caddy needs
  `request_body { max_size 40MB }` and the WAHA provider must accept ~43 MB base64 payloads.
- **Program ↔ Challenge link (D10, 2026-06-06):** the deferred Challenge will reference a program
  (`Contest.programId = Product.id`, entry gated on a PAID order for it). Spec'd as a forward link only;
  do NOT build the challenge now. Keep `Product`/`ProductAttachment` queryable by `productId`.
- **Challenge module D11 (2026-06-06 — PRD §21, owner-confirmed):** `Challenge` is 1:1 with `Product`.
  Proof videos (initial/final weigh-in) are **auto-captured via WAHA inbound webhook** → private
  `CHALLENGE_MEDIA_DIR`; **admin always verifies** + enters weights (no auto-verify). Participant appears
  when the **initial proof arrives** (`PENDING_INITIAL_REVIEW`); status enum is small (PENDING_INITIAL_
  REVIEW / RUNNING / PENDING_FINAL_REVIEW / COMPLETED / DROPPED) with day/phase/overdue **derived** in
  `lib/challenge.ts`. **All config editable** (timeline/video/rewards/templates/contact), seeded from
  `docs/challenge-rules.md`. %-loss formula `(awal−akhir)/awal×100` FIXED. **Scope D11 = 2 menus +
  capture only**; outbound WA reminders + auto phase/elimination cron = **D12**. Rules doc copied into
  the repo (`docs/challenge-rules.md`) as version-controlled source of truth.

## Known issues / TODO
- (none)

## Open questions (block the noted slice until answered — mirror of PRD §16)
- [x] Single product or catalog? → **Single product for v1** (slug: `lose-weight-challenge-1st-edition`; price: IDR 75,000). Resolved 2026-06-04.
- [ ] Tracking-ID semantics: affiliate vs campaign? (reporting only — does not block any slice)
- [ ] Email fallback if WhatsApp delivery permanently fails? (affects F4/F5; tied to file-size limit)
- [ ] PII retention period (UU PDP).
- [ ] 3rd-party WAHA provider: max request body size (caps e-book size for base64), IP allowlist
      support, auth header. (Blocks F4 if a large file exceeds the limit.)
- [x] **WAHA inbound (D11)** → **Resolved (2026-06-06, WAHA docs):** subscribe to `message` event;
      media via `payload.media.url` (download with `X-Api-Key: WAHA_API_KEY`, not base64); auth = HMAC-
      SHA512 in `X-Webhook-Hmac` (key=`WAHA_WEBHOOK_SECRET`); dedupe on `payload.id`; WAHA retries. No
      documented inbound size limit (cap our own storage). PRD §21.6 + §16 Q14.
- [x] Checkout failure policy → **mark FAILED** (not delete). Audit trail preserved. Resolved 2026-06-04.

## Session log
- 2026-06-23 — **Fix: Fonnte inbound webhook JSON bodies (PRD 0.18.2).** Prod log showed
  `[fonnte-inbox] 400 invalid form body` on every sent video — Fonnte POSTs JSON (not multipart), so
  `req.formData()` threw and proof videos were dropped. `/api/webhooks/fonnte` now branches on content-type
  (multipart → formData; else new pure `parseFonnteBody` handling JSON + urlencoded) and logs `ct=/keys=` to
  reveal Fonnte's exact field names. +3 tests for `parseFonnteBody`. Route/lib only — no schema/env. 234
  tests + tsc + build green. (Separate from the Fonnte premium-media constraint — if `keys` lacks `url`,
  the account's package may not forward media URLs.)
- 2026-06-23 — **Reset-test-data script (ops).** Added `scripts/reset-test-data.mjs` (+ `npm run
  reset:test-data`) to wipe production test data: `TRUNCATE` the transactional tables (Customer, Order,
  PaymentEvent, Delivery, DeliveryItem, ChallengeParticipant, ChallengeReminderLog, ChallengeSubmission,
  WaMessageLog) `RESTART IDENTITY CASCADE` + delete proof videos in `CHALLENGE_MEDIA_DIR`. Keeps all config
  (products/programs, challenge config, admin accounts, all Pengaturan) and the e-book PDFs. Safety: refuses
  unless `CONFIRM_RESET=YES`; prints before/after counts. Run via
  `docker compose exec -e CONFIRM_RESET=YES app node scripts/reset-test-data.mjs` (after a `pg_dump` backup).
  Syntax + refusal-path verified; no schema/env change.
- 2026-06-23 — **Inline proof-video player in User/Active (PRD 0.18.1, UX).** The "Kelola" modal's Bukti
  Awal/Akhir now embed a `<video controls>` streaming player (`ParticipantList.tsx` `proofVideo()`) instead
  of a download link. Added **HTTP Range support** (206 / `Accept-Ranges`) to the proof endpoint
  `/api/admin/participants/[id]/proof/[kind]` so playback + seeking work everywhere (Safari/iOS need it);
  kept a small open/download fallback link. UI/route only — no schema/env. 231 tests + tsc + build green.
- 2026-06-23 — **Conversion postback to ad publisher (PRD 0.18.0 §26, slice D17) — BUILT.** Owner wanted a
  S2S conversion callback to a single ad publisher on PAID. Decisions: GET pixel; **trxid = existing
  `Order.trackingId`** (reuse ref/utm/fbclid — no new field, no landing-page/checkout change); `{trxid}`
  required, `{amount}`/`{orderid}` optional; PAID only. Implemented `lib/conversion.ts` (pure
  `renderPostbackUrl` + `validatePostbackUrl`, cached `ConversionConfig`, best-effort idempotent
  `sendConversionPostback` guarded by `Order.conversionPostbackSentAt`, cron sweep
  `processPendingConversionPostbacks`). Fired fire-and-forget from the Midtrans webhook on PAID; retried by
  `process-deliveries` cron. Pengaturan card `ConversionPostbackSettings` → `/api/admin/conversion` (https +
  `{trxid}` validation). Migration `20260624020000_add_conversion_postback` (Order audit fields +
  `ConversionConfig`). No new env. 231 tests + tsc + build green. Plan: `docs/conversion-postback-plan.md`.
  Deploy = rebuild + `prisma migrate deploy`; operator enables + sets URL template in Pengaturan.
- 2026-06-23 — **E-book as protected download link (PRD 0.17.0 §25, slice D16) — BUILT.** Owner wanted
  e-book delivery to work uniformly on both engines despite Fonnte's 10 MB cap. Reviewed via LSP (single
  chokepoint `attemptDelivery`; callers = webhook/cron/resend). Decisions: link permanent + unlimited
  re-download while PAID; phone gate exact-match + rate-limited; email fallback keeps attaching files; link
  message editable per Program; token short → `randomBytes(16).base64url` (22 chars, 128-bit). Implemented:
  `lib/download.ts` (token/template/link helpers), `checkDownloadRateLimit`, `Delivery.downloadToken` +
  `Product.linkMessageTemplate` (migration `20260624010000`), `attemptDelivery` e-book→`sendText` link /
  attachments→`sendFile`, public `/download/[token]` page + `POST /api/download/[token]` (verify+stream),
  Program UI/API field. Invariant #4 reworded (tokenized phone-gated endpoint allowed; still never public/
  static/file-URL). 225 tests + tsc + build green. Plan doc: `docs/ebook-link-delivery-plan.md`. Deploy =
  rebuild + `prisma migrate deploy` (no new env).
- 2026-06-23 — **Caddy domain via `SITE_ADDRESS` env (PRD 0.16.2).** Deploy of 0.16.0/0.16.1 silently
  failed on the VPS: `git pull` aborted because the server's `Caddyfile` had a local edit (real domain) vs
  the repo's `yourdomain.com`, so `docker compose up --build` rebuilt the OLD code (D15 engine-switch card
  never appeared; `migrate deploy` showed only 9 migrations). Fix: `Caddyfile` site address → `{$SITE_ADDRESS}`,
  `caddy` service gets `env_file: .env`; operator sets `SITE_ADDRESS` in `.env` once and the tracked file
  stays generic (no future pull conflict). `.env.example` updated with `SITE_ADDRESS` + the missing D14
  (email) and D15 (Fonnte) vars. **One-time VPS transition:** `sudo git checkout -- Caddyfile && sudo git pull`,
  add `SITE_ADDRESS=domain` to `.env`, then `up -d --build` + `migrate deploy` (will apply the 10th migration
  `20260624000000_add_messaging_config`) + `restart caddy`. Config-only.
- 2026-06-22 — **Pre-production security hardening (PRD 0.16.1).** From a security review (using LSP to
  confirm `checkRateLimit` was only wired to checkout): (1) **admin login now rate-limited** — fixed
  always-on per-IP throttle `checkLoginRateLimit` (8/5min, separate from the disableable checkout config,
  keyed by IP only to avoid lockout-DoS) before the scrypt verify on `/api/admin/auth/login` → `429`.
  (2) **`CRON_SECRET` header-only** (`x-cron-secret`) — dropped the `?secret=` query form (kept it out of
  logs; deployed crontab already uses the header). (3) **`ADMIN_TOKEN`/`CRON_SECRET` compared
  constant-time** (`lib/auth.ts` `safeEqual`). (4) **Caddyfile** gains HSTS / X-Frame-Options:SAMEORIGIN /
  nosniff / Referrer-Policy / CSP frame-ancestors + `request_body max_size 40MB`. No schema/env change.
  Tests: +3 login-throttle, cron-auth test flipped to header-only. 214 tests + tsc + build green.
  **Deploy = image rebuild + the updated `Caddyfile` (reload Caddy).** Other review findings (Fonnte
  webhook token-in-URL — inherent to Fonnte; per-container config cache; resend not resetting `attempts`)
  noted but not changed.
- 2026-06-22 — **Switchable WhatsApp engine: WAHA ↔ Fonnte (PRD 0.16.0 §24, slice D15) — BUILT.** Owner
  asked for a Fonnte engine alongside WAHA, switchable in Pengaturan. Reviewed the 2 outbound paths
  (`sendFile` transactional, `sendTextHumanized` conversational) + the WAHA inbound webhook, then asked 3
  scoping Qs → **outbound + inbound**, **token in env**, **one global engine**. Introduced `lib/messaging.ts`
  (`WaEngine` interface `sendFile`/`sendText` keyed on a normalized `628…` phone + DB singleton
  `MessagingConfig` resolved by `getWaEngine()`, cached 10s like rate-limit). `lib/waha.ts` `wahaEngine`
  (zero wire change) + new `lib/fonnte.ts` `fonnteEngine` (`api.fonnte.com/send`, `Authorization` token,
  bare target, binary multipart `file` 10 MB cap, server-side `typing`/`delay`; pure parse/idempotency
  helpers). All 4 call-sites switched. New `/api/webhooks/fonnte` (URL `?token=` auth — Fonnte has no HMAC)
  + extracted `lib/challenge-inbox.ts` (`findActiveChallengeOrderByWhatsapp` + `storeProofSubmission`)
  shared by both webhooks (WAHA route refactored, keeps its LID wrapper). Pengaturan `MessagingEngineSettings`
  card → `GET`/`PUT /api/admin/messaging` (warns when Fonnte selected but `FONNTE_TOKEN`/`FONNTE_WEBHOOK_SECRET`
  unset; token never returned — inv. #6). New migration `20260624000000_add_messaging_config`; new optional
  env `FONNTE_TOKEN`/`FONNTE_WEBHOOK_SECRET`; invariants #5/#13/#14 reworded engine-aware. 211 tests
  (+`fonnte`/`messaging` suites) + tsc + build green. **Deploy:** rebuild image + run the migration; to use
  Fonnte set the two env vars and point the Fonnte device webhook at
  `https://<app>/api/webhooks/fonnte?token=<FONNTE_WEBHOOK_SECRET>`. WAHA stays the default (no action needed).
- 2026-06-08 — **Prime never-contacted recipients before sending (PRD 0.11.6 §12.2.1).** Root cause of
  "new customer never gets the msg": WhatsApp E2E has no session for a number that never messaged the WAHA
  account first → API accepts the send but it stays `status: PENDING` (delivers fine once the customer
  messages first). Fix: `lib/waha.ts` `primeRecipient(chatId)` (in both `sendFile` + `sendTextHumanized`)
  calls `checkNumberExists` (`GET /api/contacts/check-exists`) to resolve+prime the session, then waits a
  randomized `primeDelayMs` (1.5–3.5s) before sending. Best-effort (never blocks the send). 156 tests + tsc
  + build green. Code-only. Does NOT override WhatsApp anti-spam (number must be a warmed-up account).
- 2026-06-08 — **WAHA send logging enableable in prod (PRD 0.11.5 §12.2.1).** The `[waha-send]` log was
  gated on `NODE_ENV==='development'`, so it never appeared on the prod container (`NODE_ENV=production`).
  `logWahaSendDev` now also enables when env var **`WAHA_LOG_SENDS`** is `1`/`true`. Set it in the prod
  env/compose (then `docker compose up -d`) to debug live sends without rebuilding/changing `NODE_ENV`.
  Off by default in prod. Code-only. 152 tests + tsc green.
- 2026-06-08 — **Dev-only WAHA send logging (PRD 0.11.4 §12.2.1).** `lib/waha.ts` `logWahaSendDev`
  (gated on `NODE_ENV==='development'`) logs `[waha-send] <kind> chatId=…@c.us lid=…@lid response=<json>`
  from `sendFile`/`sendText`; LID resolved best-effort via `resolvePhoneToLid`. No-op in prod/tests.
  Code-only. 152 tests + tsc + build green.
- 2026-06-08 — **Auto-acknowledge proof videos on receipt (PRD 0.11.3 §21.6).** New editable
  `proof_received` template ("Menerima bukti video", placed before `day1` in the config templates +
  TEMPLATE_LABELS; merged into existing challenges via the GET defaults-merge). Inbound webhook sends it
  (humanized, idempotent key `proof_received:<msgId>`, fire-and-forget) when a video is actually stored —
  initial OR final; skipped if blank or video rejected. Reuses `sendChallengeReminderOnce`. Webhook still
  never auto-verifies. 152 tests + tsc + build green. **Code-only deploy (no migration).**
- 2026-06-08 — **Inbound `@lid` proof-video capture (PRD 0.11.2 §21.6).** Prod symptom: buyer's proof
  video logged `[waha-inbox] ignored: not-direct` because WhatsApp sent the sender as `…@lid` (privacy
  id), not `…@c.us`. Added `parseJid` (pure, tested) + `resolveLidToPhone`/`resolvePhoneToLid` (WAHA LIDs
  API, `GET /api/{session}/lids/{lid}` and `/lids/pn/{pn}`, X-Api-Key/https) to `lib/waha.ts`; webhook now
  resolves a LID→phone (fallback: match candidates phone→LID) before the existing PAID-order match. 151
  tests + tsc + build green. **Code-only deploy (no migration).** Buyer must RESEND the video (the
  ignored one wasn't stored and WAHA won't re-deliver it).
- 2026-06-08 — **Instant `after_purchase` on PAID (PRD 0.11.1 §21.8).** Extracted
  `sendChallengeReminderOnce()` from the cron worker (reserve-then-send, idempotent via
  `ChallengeReminderLog`, returns sent/skipped/failed) and call it fire-and-forget from the Midtrans
  webhook right after auto-creating the participant — so the "Setelah pembelian" instruction arrives in
  seconds instead of waiting for the hourly cron tick. The shared log key means the hourly cron never
  double-sends. Worker refactored to use the same helper (behavior unchanged). tsc + 148 tests + build
  green. **Deploy: code-only (`git pull && docker compose up -d --build`), no migration.**
  *(Prod debug this session: the missing e-book/participant was a forgotten `prisma migrate deploy`
  (D12 migration `20260606020000` adding enum `AWAITING_INITIAL` + `ChallengeReminderLog`) + a broken
  challenge-reminders crontab line (typo'd host `ales.` + wrong `Authorization: Bearer` instead of
  `x-cron-secret`). Both fixed on the VM.)*
- 2026-06-08 — **D13 external landing pages wired to checkout (PRD 0.11.0 §22).** The 3 standalone
  pages in `landing-pages/` (`lp1/2/3.html`, hosted on other domains) now POST a real order to
  `{CHECKOUT_API_BASE}/api/checkout` and redirect to the Midtrans `redirectUrl` (was: `wa.me`).
  Replaced each `sendToWhatsApp` with `submitCheckout` (fetch + button loading state + 422/403/429/5xx
  alerts + `?ref`/`utm`/`fbclid`→trackingId); added two operator constants (`CHECKOUT_API_BASE`,
  `PRODUCT_SLUG='lose-weight-challenge-1st-edition'`); **email made required** (Customer/Midtrans need
  it). No app/schema change — reuses the existing checkout contract. Added `landing-pages/README.md`
  (config + CORS allowlist steps). **Operator must add each hosted origin to the CORS allowlist
  (Pengaturan).** Static files, no build step.
- 2026-06-06 — D12 anti-spam pacing: the reminder worker is strictly sequential and now adds a
  randomized **3–7s gap between every message** (`MIN_GAP_MS`/`MAX_GAP_MS` in `lib/challenge-reminders.ts`)
  on top of `sendTextHumanized`'s typing delay — so a single WA number never bursts (≈1 msg / 8–13s even
  for short templates / big cohorts). PRD §21.8 + §12.2.1 noted. tsc + tests + build green.
- 2026-06-06 — **D12 Challenge WA automation BUILT (PRD 0.10.0 §21.8).** Owner decisions: auto-create
  participant on PAID · external cron endpoint · (Active KPIs left deferred). Schema: enum value
  `AWAITING_INITIAL` + `ChallengeReminderLog` (`@@unique([participantId,key])`); migration
  `20260606020000_add_challenge_automation`. Midtrans webhook auto-creates the participant on PAID for a
  challenge-active program. `lib/challenge.ts` +`computeDueReminders` (pure, tested) +`renderTemplate`
  (`{{contact}}`). Cron `GET /api/cron/challenge-reminders` (isCron, hourly): scans AWAITING_INITIAL/
  RUNNING, reserves `ChallengeReminderLog` then sends via `sendTextHumanized`, auto-DROPs at H+15 (no
  initial) / day-105 (no final). Inbound webhook now moves AWAITING_INITIAL→PENDING_INITIAL_REVIEW;
  verify-final sends `final_received`. participantView handles AWAITING_INITIAL ("Menunggu Bukti Awal").
  Deploy adds an hourly cron hitting the new endpoint. tsc + tests + build green.
- 2026-06-06 — D11 add-on (PRD 0.9.1): **test-send for WA templates** in Challenge Configuration. The
  templates card gains a test recipient number + a "Kirim tes" button under each template; it substitutes
  `{{contact}}` and POSTs to new `POST /api/admin/whatsapp/test` (`requireAdmin` → `sendTextHumanized`),
  with per-template status. Lets the operator preview reminders before D12 automation. tsc + build green.
- 2026-06-06 — D11 review/bug-fix pass on the inbound webhook (`/api/webhooks/waha`): (1) classify
  initial vs final by `participant.startAt` (not "has an initial submission") so a **re-sent initial
  proof after a rejection** is still treated as initial, not final; (2) **upsert** the participant by
  orderId + create the submission inside a P2002 try/catch so WAHA's **concurrent retries** can't 500 on
  a unique-violation race (idempotent); (3) match the PAID order **by `customer.whatsapp` directly** so a
  buyer with a second Customer row (same number, different email) still matches. PRD §21.6 updated. 141
  tests + tsc + build green.
- 2026-06-06 — **D11 Challenge module BUILT** (green: 141 tests, tsc, `npm run build`). Schema:
  `Challenge` (1:1 Product, JSON phases/winnerTiers/messageTemplates) + `ChallengeParticipant` (per PAID
  order) + `ChallengeSubmission` + `ParticipantStatus` (migration `20260606010000_add_challenge_module`).
  `lib/challenge.ts` (pure `dayOfChallenge`/`currentPhase`/`percentLoss`/`participantView`/
  `defaultChallengeConfig` seeded from rules) + `lib/challenge-serialize.ts`. `lib/waha.ts` gained
  `verifyWahaSignature` (HMAC-SHA512), `fetchInboundMedia`, and `sendTextHumanized` (§12.2.1 anti-spam) +
  pure `typingDelayMs`. `lib/files.ts` gained `saveChallengeMedia`/`readChallengeMedia` (private
  `CHALLENGE_MEDIA_DIR`). Inbound webhook `/api/webhooks/waha` (HMAC auth, dedupe payload.id, match
  buyer→PAID order→active challenge, download media.url with X-Api-Key, store privately, create
  participant/submission). Admin APIs: `challenges/[productId]` (GET/PUT upsert), `participants`
  (GET ?programId&group), `participants/[id]` (PATCH verify/reject/drop/note), `participants/[id]/proof/
  [kind]` (stream private video). UI: `ChallengeConfig.tsx` + `/admin/challenge`; `ParticipantList.tsx`
  (+manage modal) + `/admin/active`; Sidebar adds Challenge + enables Users/Active. env
  `WAHA_WEBHOOK_SECRET`+`CHALLENGE_MEDIA_DIR` (+ .env.example, docker-compose volume). Tests:
  challenge.test.ts (24) + waha.test.ts. Pending VPS deploy.
- 2026-06-06 — D11 spec: confirmed the **WAHA inbound + send contract** from the provider docs and folded
  it in. Inbound: `message` event, media via `payload.media.url` (download w/ `X-Api-Key`), HMAC-SHA512
  `X-Webhook-Hmac` auth (key=`WAHA_WEBHOOK_SECRET`), dedupe on `payload.id` (§21.6, Q14 resolved). Added
  **§12.2.1 humanized send sequence** (sendSeen → startTyping → wait → stopTyping → sendText) as a
  required anti-spam standard for all reminder/reply sends (`lib/waha.ts` `sendTextHumanized`; CLAUDE
  invariant #14). e-book `sendFile` on PAID stays exempt. Docs only — still awaiting go-ahead to code.
- 2026-06-06 — **Challenge module (D11) specced (PRD 0.9.0 §21)** — docs only, no code yet. Read owner's
  `challenge-rules.docx` and copied it into the repo as `docs/challenge-rules.md` (version-controlled
  source of truth). Two new menus: **Challenge Configuration** (`/admin/challenge`, per-program config,
  all fields editable, seeded from rules) + **User/Active** (`/admin/active`, participant list/status,
  verify proofs, weights, %-loss). Proof videos **auto-captured via WAHA inbound** (`/api/webhooks/waha`)
  → private `CHALLENGE_MEDIA_DIR`; admin verifies. New schema `Challenge`/`ChallengeParticipant`/
  `ChallengeSubmission` + `ParticipantStatus`; new env `WAHA_WEBHOOK_SECRET`, `CHALLENGE_MEDIA_DIR`.
  Owner decisions: WAHA inbound capture · 2 menus + capture only (reminders/cron = D12) · all config
  editable · only started participants appear. Updated PRD (§8/§9/§10/§15/§16/§19.3, new §21, changelog
  0.9.0), CLAUDE.md (invariants #4/#13, layout, build order, deferred), PROGRESS.md, memory. Build plan
  in "In progress". **Awaiting owner go-ahead before coding** + WAHA inbound capability confirmation (Q14).
- 2026-06-06 — **Dashboard UI consistency (PRD 0.8.1 §20.12).** Pengaturan cards were uneven (each
  component set its own width/padding). Added shared `components/admin/Card.tsx` — `Card` (one shell:
  border + 12px radius + uniform padding, optional header), `CardStack` (gap + `CONTENT_MAX_WIDTH`),
  `PageHeader`. Refactored OriginManager + RateLimitSettings onto `Card` (no own width); settings page
  wraps them in `CardStack` so all cards are identical width. `DataTable` shell restyled to match.
  ProgramManager + LeadsReport now use `PageHeader`. **Standing rule:** all menus compose from these
  primitives — no ad-hoc card divs / per-card maxWidth. tsc + build green. Docs: PRD §20.12 + changelog
  0.8.1, CLAUDE.md, PROGRESS.md.
- 2026-06-06 — D10 review/bug-fix pass before push: (1) moved `serializeProgram` to
  `lib/program-serialize.ts` (was imported across route files — fragile); (2) admin create/PATCH now
  **clean up orphaned uploaded PDFs** if the DB write fails (e.g. duplicate slug 409); (3) switched
  `ensureDeliveryItems` from `createMany` to per-row `create` so Prisma reliably fills `DeliveryItem.
  @updatedAt`. 118 tests + tsc + build green.
- 2026-06-06 — **D10 Program management BUILT** (green: 118 tests, tsc, `npm run build`). Schema:
  `Product` +`programName`/`salesStartAt`/`salesEndAt`, new `ProductAttachment` + `DeliveryItem`
  (migration `20260606000000_add_programs_and_attachments`). `lib/programs.ts` (pure `isOnSale`/
  `salesStatus` + WIB date helpers). `lib/files.ts` +`saveUploadedPdf` (PDF magic+size 32 MB, atomic
  temp→rename, random name) +`deleteUploadedFile`. **Multi-file delivery:** `lib/delivery.ts` rewritten
  — `buildDeliverySnapshot`/`allItemsSent` (pure, tested) + per-`DeliveryItem` send (lazy-snapshot on
  first attempt, retry resends only unsent items, Delivery SENT only when all items SENT); resend route
  resets items. Checkout `403` + `[slug]` page hides form when `!isOnSale`. Admin API
  `/api/admin/programs` (GET/POST multipart) + `/[id]` (PATCH/DELETE) + `/[id]/attachments[/attId]`.
  `report.ts` + report route take optional `programId`. UI: `ProgramManager` (DataTable + Add/Edit
  modal w/ ebook + attachments) + `/admin/program`; Sidebar Program `ready`; Leads Report Program
  dropdown live. `next lint` is gone in Next 16 (gate = tests+tsc+docker build). Pending VPS deploy.
- 2026-06-06 — **D10 Program management specced (PRD 0.8.0 §20.11)** — docs only, no code yet (per the
  standing rule: spec in PRD before building). New menu **Program** = product/program configuration:
  list programs in a TanStack `DataTable` (id / product name / program name / period / price / status),
  **Add Program** + **Edit** forms that **upload the PDF e-book** (private, into `EBOOK_FILES_DIR`),
  and a per-program **sales window** (`salesStartAt`/`salesEndAt`, WIB) that **suspends checkout once it
  ends** (`/api/checkout` → `403`, landing page hides the form). `Product` gains 3 nullable columns;
  new `lib/programs.ts` (pure `isOnSale`); admin CRUD `/api/admin/programs[/id]`. The Leads Report
  **Program dropdown goes live** (filters metrics by `productId`); Active/Conv.Rate Active stay stubbed.
  Added invariant #12. **Amended same day** to add **attachments**: a program may include extra PDFs
  (`ProductAttachment`, e.g. a separate to-do-list) uploaded on create / add-removable on edit; on
  purchase the buyer receives **e-book + all attachments**. Delivery reworked to one **`DeliveryItem`
  per file** (snapshot at PAID; retry resends only unsent items) so exactly-once is now per-file
  (invariant #3 updated). Program is also spec'd as the **future Challenge's reference entity** (§15).
  Updated PRD (§9, §10, §12.2, §14→§12.2, §15, §16, §19.3, §20.2/.4/.5, new §20.11, changelog 0.8.0),
  CLAUDE.md, PROGRESS.md. Build plan (9 steps) under "In progress". Next: implement (awaiting go-ahead).
- 2026-06-05 — Responsive dashboard (PRD 0.7.6): new `DashboardShell` client wrapper owns the frame +
  all sidebar CSS; ≤768px the sidebar collapses to an off-canvas drawer (sticky top bar + hamburger +
  overlay), `Sidebar` now takes `open`/`onNavigate`. Login card fluid; Pengaturan tables scroll on
  mobile. 95 tests; tsc + build clean.
- 2026-06-05 — D9 checkout rate limit (PRD 0.7.5 §20.10): `RateLimitConfig` singleton (+migration,
  seeded 10/60s enabled); `lib/rate-limit.ts` (pure `evaluateBucket`, in-memory per-IP buckets,
  10s-cached config, `clientIpFromHeaders`); `/api/checkout` returns 429 + Retry-After when exceeded;
  admin `GET/PUT /api/admin/rate-limit` (clears cache on save); Pengaturan gains a Rate Limit card
  (`RateLimitSettings`) with enable toggle + max + window. Configurable & disableable. 95 tests; build clean.
- 2026-06-05 — D8 CORS domain allowlist (PRD 0.7.4 §20.9): `AllowedOrigin` table (+migration);
  `lib/cors.ts` (normalizeOrigin, live DB check); `/api/checkout` now has an OPTIONS preflight +
  echoes ACAO only for app-origin or active listed origins; admin CRUD `/api/admin/origins[/id]`
  (requireAdmin); Pengaturan page (`/admin/(dashboard)/settings` + `OriginManager`) to add/toggle/
  delete domains; sidebar Pengaturan enabled. Lets external landing pages on other domains POST to
  checkout from the browser. 89 tests; tsc + build clean.
- 2026-06-05 — Second bug-fix pass (PRD 0.7.3), deeper review of core flow: (1) `canTransition`
  rewritten as explicit allow-map — PAID can no longer be overwritten by a late FAILED/EXPIRED/CANCELLED
  (only PAID→REFUNDED); (2) same→same is a true no-op (duplicate settlement won't reset paidAt);
  (3) `attemptDelivery` atomically claims PENDING/FAILED→PROCESSING (fixes double-send race, invariant #3);
  (4) `processDueDeliveries` reclaims stale PROCESSING (>10 min) orphaned by a crash; (5) backoff
  off-by-one fixed (first retry 1 min); (6) `orderCode` crypto-random + collision-retry (`createPendingOrder`);
  (7) webhook signature compare is constant-time. 84 tests; tsc + build clean.
- 2026-06-05 — Bug-fix pass (PRD 0.7.2) after a full review: (1) **proxy** no longer gates
  `/api/admin/*` (cookie-only gate had blocked `ADMIN_TOKEN` bearer callers and left orders/resend
  unreachable); added shared `requireAdmin(req)` (cookie OR bearer) used by report/orders/resend;
  proxy now guards only `/admin/*` UI. (2) `Sukses` metric bucketed by `sentAt` (was `updatedAt`),
  matching §20.4. (3) `/api/admin/report` caps range at 366 days. (4) `admin:create` masks password
  input. 83 tests green; tsc + build clean.
- 2026-06-05 — D3.1 visual polish to match `docs/mockups/cms.png`: dark navy gradient sidebar with
  icon nav + active blue pill + "soon" badges on unbuilt pages; redesigned user block (avatar + name +
  @username + logout); KPI cards now icon-tile-left; uppercase section labels; right-aligned filter
  buttons. Sidebar uses a scoped `<style>` block for hover states. Behavior unchanged (refines §20.8).
- 2026-06-05 — Fix: `buildDateSeries` used `cur.setHours()` (container UTC) → spurious leading day +
  WIB date mislabel. Rewrote to step by whole days anchored on +07:00, taking string args. 83 tests.
  (Diagnosed a "table shows all 0" report — it was correct: all test data was from today, and the
  14-day table is "yesterday and back" per the mockup; today's data shows in the real-time cards.)
- 2026-06-05 — D3.1 specced (PRD v0.7.1, §20.8): dashboard UX polish — restyled KPI widgets +
  reusable TanStack `DataTable` (sort/search/paginate) with CSV + PDF export. Decision: TanStack Table
  + jspdf/jspdf-autotable (jQuery DataTables rejected). Docs updated across PRD/CLAUDE/PROGRESS before
  building, per the standing rule "any added feature ⇒ update all md files first".
- 2026-06-05 — Dashboard D1–D3 built & deployed: auth (AdminUser+Session, scrypt, cookie sessions,
  `/admin` guard via proxy.ts, `admin:create`), metrics API (`/api/admin/report`, WIB-bucketed
  `lib/report.ts`), Leads Report UI (KPI cards + 14-day table + filter). Fixes: Dockerfile copies
  scripts/; middleware→proxy.ts rename (Next 16) + export renamed to `proxy`; (dashboard) route group
  to break login redirect loop; proxy allows `/api/admin/auth/*` through. Added pre-push hook
  (tests+tsc+docker build). 82 tests green.
- 2026-06-05 — Dashboard specced (PRD §20, v0.7.0): multi-user login + Leads Report per
  `docs/mockups/cms.png`. Resolved Lead/Purchase/Active/Program/auth decisions. Added `AdminUser` +
  `Session` to §9, admin routes to §10, slices D1–D3 to §19.3. Docs (PRD/CLAUDE/PROGRESS) updated so a
  new session can build D1. No app code yet — spec only.
- 2026-06-05 — Stack upgrade: Next 16, Prisma 7 (prisma.config.js + pg adapter), Zod 4, TS 6,
  Node 22, PG 17, ESLint 10. Docker fixes (public/ dir, full node_modules copy for Prisma CLI,
  prisma.config.js in runner, seed.mjs uses adapter). Security fix: removed `usermod -aG docker` from
  production runbook. Deployed to VPS; migrations applied + product seeded. 73 tests green.
- 2026-06-03 — Project planned; PRD at v0.6.0; CLAUDE.md and PROGRESS.md created. No code yet.
- 2026-06-04 — Scaffold slice complete: Next.js 15 + TS, Prisma schema (§9 exact), zod env
  validation, Dockerfile (standalone), docker-compose.yml, Caddyfile, Jest test suite (5 tests green).
  Build passes. Committed as `feat(scaffold)`.
- 2026-06-04 — SLC polish complete: root page redirects to product slug, custom 404 page (Indonesian),
  thank-you page shows order code + payment status from Midtrans callback params, README with local
  setup + Docker + cron + admin API docs. 73 tests green. Committed as `chore(polish): SLC pass`.
- 2026-06-04 — F6 complete: `src/app/api/admin/orders/route.ts` (GET with status filter, returns
  orders + delivery state), `src/app/api/admin/deliveries/[id]/resend/route.ts` (POST, optional
  corrected whatsapp, resets delivery to PENDING, calls attemptDelivery). Both admin-token-protected.
  `__tests__/auth.test.ts`: 8 tests for isAdmin/isCron. 73 tests green. Committed as `feat(F6)`.
- 2026-06-04 — F4+F5 complete: `src/lib/files.ts` (readEbookAsBase64 with path-traversal guard),
  `src/lib/waha.ts` (sendFile base64 over HTTPS, enforces https:// invariant at call time),
  `src/lib/delivery.ts` (attemptDelivery exactly-once + BACKOFF_MINUTES schedule,
  processDueDeliveries cron worker), `src/app/api/cron/process-deliveries/route.ts` (cron-protected
  GET), webhook updated to fire-and-forget attemptDelivery on PAID. 65 tests green. Committed as `feat(F4+F5)`.
- 2026-06-04 — F3 complete: `src/app/api/webhooks/midtrans/route.ts` — SHA512 signature verify
  (rejects 403 on mismatch), always persists PaymentEvent audit log, idempotent forward-only status
  via canTransition, creates Delivery row on PAID transition (F4 will add send logic). `src/lib/auth.ts`
  (isAdmin + isCron guards). 59 tests green. Committed as `feat(F3)`.
- 2026-06-04 — F2 complete: `src/lib/orders.ts` (generateOrderCode, canTransition forward-only),
  `src/lib/midtrans.ts` (createSnapTransaction, verifySignature SHA512, mapMidtransStatus),
  `src/app/api/checkout/route.ts` completed (upsert Customer, create Order, call Snap, mark FAILED
  on Snap error per checkout-failure-policy decision). `env.ts` changed to lazy Proxy so build
  doesn't fail when vars are absent. 51 tests green. Committed as `feat(F2)`.
  Decision: checkout failure → mark FAILED (not delete), keeps audit trail.
- 2026-06-04 — F1 complete: `src/app/[slug]/page.tsx` (server, force-dynamic, 404 on inactive),
  `src/components/checkout-form.tsx` (client, shows field errors from 422), `src/app/api/checkout/route.ts`
  (validates input, returns 422 with field errors, stubs 501 for F2), `src/app/thank-you/page.tsx`,
  `src/lib/phone.ts` (Indonesian mobile normalization, rejects landlines), `src/lib/validation.ts`
  (zod checkoutSchema with phone transform). 30 tests green. Phone fix: reject non-628 prefix.
- 2026-06-04 — F7 complete: initial migration SQL generated (`prisma/migrations/20260604000000_init`),
  `prisma/seedData.ts` exports typed SEED_PRODUCTS (importable in tests), `prisma/seed.ts` upserts
  product on `npx prisma db seed`. 11 tests green. Committed as `feat(F7)`.
  Product: slug=`lose-weight-challenge-1st-edition`, price=IDR 75,000.
