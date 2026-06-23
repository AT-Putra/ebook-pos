# PRD — E-book Sales & WhatsApp Delivery System

> **Living document.** Update the changelog and version whenever scope, schema, or
> acceptance criteria change. Sections tagged `[STABLE]` are agreed; `[DRAFT]` may still move;
> `[OPEN]` needs a decision (see §16).

| Field | Value |
|---|---|
| Version | 0.18.1 |
| Status | Core flow + dashboard (D1–D3.1) + CORS (D8) + rate limit (D9) + Program (D10) + Card UI (§20.12) + Challenge (D11), deployed; **Challenge WA automation (D12) + external landing pages (D13) + WA Logs (D5) + Leads list (D4) + User mgmt (D6) + email fallback (D14) built (green) — pending VPS deploy + migration** |
| Owner | Product owner (you) |
| Last updated | 2026-06-22 |
| Build philosophy | **SLC** — Simple, Lovable, Complete |
| Target implementer | AI coding agent |

### Changelog
- **0.18.1** (2026-06-23) — **Inline proof-video player in User/Active (UX).** In the participant "Kelola"
  modal, **Bukti Awal / Bukti Akhir** now show an **embedded `<video controls>` player** (streaming) instead
  of a plain download link, so the operator can review the proof in place. The auth-gated proof endpoint
  `GET /api/admin/participants/[id]/proof/[kind]` now serves **HTTP Range requests** (206 partial content,
  `Accept-Ranges`) so playback + seeking work in every browser (Safari/iOS require it); a small "buka di tab
  baru / unduh" link is kept as a fallback. UI/route only — no schema/env/migration. §21.
- **0.18.0** (2026-06-23) — **S2S conversion postback to ad publisher (slice D17) — BUILT.** On the `PAID`
  transition the app fires a **server-to-server GET "pixel"** to a single configurable ad-publisher URL,
  passing back the click id so the publisher can attribute the sale. **trxid = the existing
  `Order.trackingId`** (captured from `?ref`/`?utm_source`/`?fbclid`) — **no new DB field, no landing-page
  or checkout change**. The operator sets an `https://` URL **template** in **Pengaturan** (new
  `ConversionPostbackSettings` card → `GET`/`PUT /api/admin/conversion`, `ConversionConfig` singleton);
  macros: **`{trxid}` required**, **`{amount}`/`{orderid}` optional** (`renderPostbackUrl` URL-encodes +
  replaces only what's present). Send is **fire-and-forget, idempotent once per order** (guarded by
  `Order.conversionPostbackSentAt`), **best-effort** (never blocks/fails checkout or delivery), and **retried**
  by the existing `process-deliveries` cron for `PAID` orders with a `trackingId` not yet posted back.
  Fires only when enabled + the order has a non-empty `trackingId` + URL set. New `lib/conversion.ts`. New
  migration `20260624020000_add_conversion_postback` (`Order` gains `conversionPostbackSentAt`/`…Error`/
  `…Attempts`; new `ConversionConfig` table). No new env. Plan: `docs/conversion-postback-plan.md`. §26.
- **0.17.0** (2026-06-23) — **E-book delivered as a protected download link (slice D16) — BUILT.** The main
  e-book is no longer sent as a WhatsApp file attachment; instead the buyer gets a WhatsApp **text with a
  protected download link** (`/download/<token>`) — identical on both engines and **immune to Fonnte's 10 MB
  cap**. **Attachment PDFs still go as file attachments** (small). Opening the link → a public page asks for
  the buyer's **registered WhatsApp number** → on an **exact match** for that order, the **e-book PDF
  streams**. Link is **permanent + unlimited re-downloads** while the order is `PAID`; the phone gate is
  **rate-limited** per `(token+IP)` (`checkDownloadRateLimit`) to stop number enumeration. Token =
  `randomBytes(16).toString('base64url')` (**22 URL-safe chars, 128-bit** — short link, unguessable),
  stored on `Delivery.downloadToken @unique`. The link message is an **editable per-Program template**
  (`Product.linkMessageTemplate`, placeholders `{{name}}/{{product}}/{{link}}`, seeded default) rendered by
  pure `renderLinkMessage`. `attemptDelivery` now sends the e-book item via `engine.sendText` (humanized) and
  attachments via `engine.sendFile`. **Email fallback (D14) unchanged** — still attaches the real PDF files.
  New public routes `GET /download/[token]` (page) + `POST /api/download/[token]` (verify+stream), outside
  admin auth. New `lib/download.ts` (token/template/link helpers) + `checkDownloadRateLimit`. Invariant #4
  reworded: the e-book may be served by the tokenized, phone-gated endpoint — still never `public/`, never a
  static URL, never a file URL to the WA provider. New migration `20260624010000_add_ebook_download_link`
  (`Delivery.downloadToken`, `Product.linkMessageTemplate`). Full design: `docs/ebook-link-delivery-plan.md`.
  §25.
- **0.16.2** (2026-06-23) — **Caddy domain via `SITE_ADDRESS` env (deploy ergonomics).** The `Caddyfile`
  site address is now `{$SITE_ADDRESS}` instead of a hard-coded `yourdomain.com`, and the `caddy` compose
  service gets `env_file: .env`. The operator sets `SITE_ADDRESS=domain.com` in `.env` once; the tracked
  `Caddyfile` stays generic, so `git pull` never conflicts on a server-edited domain (the bug that silently
  blocked the 0.16.0/0.16.1 deploy). Also: `.env.example` now lists the previously-missing `SITE_ADDRESS`,
  email-fallback (D14) and Fonnte (D15) vars. Config-only; deploy = set `SITE_ADDRESS`, rebuild, reload Caddy.
- **0.16.1** (2026-06-22) — **Pre-production security hardening.** From a security review: (1) **admin
  login is now rate-limited** — a fixed, always-on per-IP throttle (`checkLoginRateLimit`, 8 attempts /
  5 min, in `lib/rate-limit.ts`, independent of the admin-configurable checkout limit) runs before the
  scrypt verify on `/api/admin/auth/login`, returning `429 + Retry-After`; keyed by IP only so a legit
  admin can't be locked out by username-spam. (2) **`CRON_SECRET` is now header-only** (`x-cron-secret`) —
  the `?secret=` query form was removed so the secret never lands in access logs (the deployed crontab
  already uses the header). (3) **`ADMIN_TOKEN` / `CRON_SECRET` are compared with `timingSafeEqual`**
  (`lib/auth.ts` `safeEqual`), consistent with the Midtrans/WAHA/password paths. (4) **Caddy now sets
  security headers** (HSTS, `X-Frame-Options: SAMEORIGIN`, `X-Content-Type-Options: nosniff`,
  `Referrer-Policy`, CSP `frame-ancestors 'self'`) and a `request_body max_size 40MB` cap. No schema/env
  change; deploy = image rebuild + the updated `Caddyfile`. Tests +3 (login throttle) and the cron-auth
  test flipped to header-only. 214 tests + tsc + build green.
- **0.16.0** (2026-06-22) — **Switchable WhatsApp engine: WAHA ↔ Fonnte (slice D15) — BUILT.** The
  WhatsApp channel is no longer hard-wired to WAHA. A new `lib/messaging.ts` defines a small **`WaEngine`**
  interface (`sendFile` + `sendText`, both keyed on a normalized `628…` phone) and a DB-backed singleton
  **`MessagingConfig`** (one row, `engine = 'waha' | 'fonnte'`, default `waha`) that selects the **single
  global active engine** for all OUTBOUND sends. The existing WAHA code becomes the `wahaEngine` adapter
  (unchanged wire behaviour — still `…@c.us`, base64 `file.data`, the humanized sendSeen/typing sequence,
  recipient priming, LID resolution); a new **`lib/fonnte.ts`** is the `fonnteEngine` adapter (single
  endpoint `POST https://api.fonnte.com/send`, header `Authorization: <FONNTE_TOKEN>`, plain `628…` target,
  text via `message`, files via a **binary multipart `file`** upload — never a public `url`, invariant #4 —
  and humanization delegated to Fonnte's server-side `typing`/`delay`). All four send call-sites
  (`delivery.ts`, `challenge-reminders.ts`, the participant resend, the test-send) now resolve the active
  engine via `getWaEngine()` instead of importing `waha` directly. **Inbound is switchable too:** a new
  **`/api/webhooks/fonnte`** route captures challenge proof videos when Fonnte is active — Fonnte sends a
  plain phone `sender` (no `…@lid`, so no LID dance), media as a public `url` (downloaded with no auth
  header), and provides **no HMAC**, so the route authenticates via a **shared-secret token in the webhook
  URL** (`?token=…` constant-time-compared to `FONNTE_WEBHOOK_SECRET`, fails closed when unset). The
  idempotency-critical inbound core (match order → upsert participant → store media → record submission →
  advance status → `proof_received` ack) is extracted to **`lib/challenge-inbox.ts`** and shared by BOTH
  the WAHA and Fonnte webhooks (the WAHA route keeps its LID-resolution wrapper). The engine is chosen in
  **Pengaturan** (new `MessagingEngineSettings` card → APIs `GET`/`PUT /api/admin/messaging`); the Fonnte
  **token is a server-only env var** (`FONNTE_TOKEN`, invariant #6 — never entered/stored in the DB or sent
  to the browser), the settings GET only reports whether it is configured. New migration
  `20260624000000_add_messaging_config`; new optional env `FONNTE_TOKEN` + `FONNTE_WEBHOOK_SECRET` (§8).
  Caveat: **Fonnte caps an attachment at 10 MB** ([file-limitation docs](https://docs.fonnte.com/file-limitation/))
  — a larger e-book fails the Fonnte send (recorded, retried)
  and the §23 email fallback covers the buyer. Invariant #5/#13/#14 reworded to be engine-aware. §24.
- **0.15.0** (2026-06-22) — **Email fallback delivery (slice D14) — BUILT.** When a WhatsApp delivery
  item fails, the e-book + every attachment is **also** emailed to the buyer (best-effort, idempotent —
  once per order via `Delivery.emailFallbackSentAt`), in **parallel** with the normal WhatsApp retry
  (which is byte-for-byte unchanged; WhatsApp stays the primary channel and keeps retrying on its backoff
  schedule). Trigger = any item failing on an `attemptDelivery` pass; the buyer gets a single email with
  the **complete** file set read from the private `EBOOK_FILES_DIR` (binary attachment, never a URL —
  invariant #4). Provider = **Gmail SMTP + App Password** via **`nodemailer`**, isolated behind a new
  `lib/email.ts` (`isEmailConfigured`, pure `buildEbookEmail`, `sendEbookEmail`) so it can be swapped for
  a transactional service later. Off unless `EMAIL_FALLBACK_ENABLED=true` + `GMAIL_USER`/`GMAIL_APP_PASSWORD`
  set (new optional env, §8). A failed email is recorded (`emailFallbackError`) and retried by the cron
  until it succeeds (within the WhatsApp attempt window); it never blocks/fails a WhatsApp send. New
  migration `20260623000000_add_email_fallback` (`Delivery` gains `emailFallbackSentAt`/`emailFallbackError`/
  `emailFallbackAttempts`). New dep `nodemailer` (+ `@types/nodemailer`). Resolves open Q#3. §23.
- **0.14.2** (2026-06-22) — **Active / Conv. Rate Active 14-day series reworked to per-day event semantics** (owner feedback). The columns must be recorded the same way as Leads/Purchase — on the day the event happens — not as a running cumulative window. `getActiveSeries(dates, productId?)` now counts **Active** as a per-day event: each participant is bucketed on the single WIB day of their `startAt` (when they became active), so a day is non-zero only when a new participant entered Active (most days 0). Per-day **Conv. Rate Active** = active ÷ purchases of the **same day** (mirrors Conv. Rate = purchase ÷ leads), computed in `getReport`. Replaces the 0.14.1 window/cumulative draft. Pure `bucketActiveByDay(startDays)` extracted + unit-tested. Image rebuild only. §20.4.
- **0.14.1** (2026-06-22) — **Leads Report 14-day series: Active / Conv. Rate Active columns now filled.** They previously rendered "—" because `RUNNING` was treated as a snapshot-only value. (Superseded by 0.14.2, which switched the per-day definition from a RUNNING-window count to a `startAt` event count.) §20.4.
- **0.14.0** (2026-06-22) — **User management (slice D6) — BUILT.** Admin-account CRUD added as a **Pengguna (Admin)** card inside **Pengaturan** (`/admin/settings`) — the operator can **add** an admin, **rename** one, **reset** a password, and **activate/deactivate** an account (no hard delete; deactivation revokes that user's sessions). **No schema change** — `AdminUser` already carried `username`/`name`/`passwordHash`/`isActive`/`lastLoginAt`. New APIs `GET`+`POST /api/admin/users` and `PATCH /api/admin/users/{id}` (all `requireAdmin`). Guards: usernames are unique (409 on collision), passwords are scrypt-hashed (`lib/password.ts`, never returned to the client / never logged), and a user **cannot deactivate themselves or the last remaining active admin** (prevents lockout). New `currentAdminUser(req)` helper in `lib/auth.ts` (resolves the cookie session's user; bearer callers have none). Pure `lib/admin-users.ts` (zod `createUserSchema`/`updateUserSchema` + `serializeAdminUser` + `deactivationBlock` guard) is unit-tested. UI `components/admin/UserManager.tsx`. Deploy = image rebuild only (no migration/env/cron/volume). The **Purchase** menu (PAID-only) and **Laporan** export page (D7) remain intentionally **not built** — the operator uses the Leads status filter and the per-table CSV/PDF export instead. **Also in this release: the `Active` / `Conv. Rate Active` KPIs are now LIVE** (resolves open Q#15) — `getActiveSnapshot(productId?)` in `lib/report.ts` returns `ReportData.snapshot` (`active` = current `RUNNING` `ChallengeParticipant` count; `convRateActive` = active ÷ cumulative PAID orders, program-scoped), surfaced on the real-time KPI cards. They are a live snapshot (current state), so the 14-day series table's Active columns stay "—". §20.15, §20.4.
- **0.13.0** (2026-06-22) — **Leads menu (slice D4, the Leads half) — BUILT.** New login-gated **Leads** page (`/admin/leads`) — a log of **every checkout submission** (an `Order`, **any status**; Lead = any submission per §20.2). No schema change — reads existing `Order`/`Customer`/`Delivery`. New API `GET /api/admin/leads` (`requireAdmin`) with **program / status / date-range / search** filters (search across order code, tracking id, name, email, WhatsApp; WIB date bounds; 5000-row cap). UI `LeadsList.tsx` = `PageHeader` + filter row + shared `DataTable` (sort/search/paginate, CSV+PDF export) with columns Waktu · Nama · WhatsApp · Email · Program/Produk · Jumlah · Status (badge) · Tracking · Pengiriman · Aksi. A per-row **Detail** modal shows the full order + delivery state and, for orders with a delivery, a **Resend** (optional corrected WhatsApp number) reusing `POST /api/admin/deliveries/{id}/resend`. PII (email/WhatsApp) shown in full (operator follow-up; decided 2026-06-22). Pure `lib/leads.ts` helpers (`formatIdr`, `leadStatusMeta`) unit-tested. The **Purchase** page (PAID-only) remains a later slice. §20.14.
- **0.12.0** (2026-06-22) — **WA Logs menu (slice D5) — BUILT.** New login-gated **WA Logs** page (`/admin/wa-logs`) — an audit trail of every **outbound** WhatsApp send: e-book + attachment **deliveries** and challenge **reminders** (incl. the `after_purchase` instant message + the `proof_received` auto-ack). Backed by a new immutable, FK-decoupled **`WaMessageLog`** table written **best-effort** (logging never blocks/fails a send) from `lib/wa-log.ts`, wired into `delivery.ts` (per `DeliveryItem`) and `challenge-reminders.ts` `sendChallengeReminderOnce` (per reminder). The page uses the standard `PageHeader`+`DataTable` (sort/search/paginate, CSV+PDF export) with **program / status / category / date-range** filters and a **Resend** action on `FAILED` delivery rows (reuses `POST /api/admin/deliveries/{id}/resend`). API `GET /api/admin/wa-logs` (`requireAdmin`). One-off backfill from existing `DeliveryItem`+`ChallengeReminderLog` via `npm run wa-logs:backfill` (idempotent, records the final per-row state). Inbound proof videos + the operator test-send are intentionally **out of scope** (decided 2026-06-22). New migration `20260622000000_add_wa_message_log`; resolves open Q#10. §20.13.
- **0.11.6** (2026-06-08) — **Prime never-contacted recipients before sending (first-contact delivery fix).** Messages to a number that had **never messaged the WAHA account first** were accepted by the API (`status: PENDING`) but never delivered — WhatsApp's E2E encryption has no session for an unknown recipient. Both send paths (`sendFile`, `sendTextHumanized`) now call `primeRecipient(chatId)` first: WAHA's `GET /api/contacts/check-exists` (new `checkNumberExists` helper) performs the on-WhatsApp lookup that resolves the recipient + primes the encryption session, then a short **randomized delay** (`primeDelayMs`, 1500–3500ms) before the actual send. Best-effort — a failed/negative check never blocks the send. Pure helpers unit-tested. No schema/migration. §12.2.1.
- **0.11.5** (2026-06-08) — **WAHA send logging can now be enabled in production.** The `[waha-send]` log (added in 0.11.4) was gated on `NODE_ENV==='development'`, so it never appeared on the prod container (`NODE_ENV=production`). It now also turns on when the **`WAHA_LOG_SENDS`** env var is truthy (`1`/`true`) — set it in the prod env/compose to debug live sends without rebuilding the image or changing `NODE_ENV`. Still off by default in prod (the per-send LID lookup is opt-in). §12.2.1.
- **0.11.4** (2026-06-08) — **Dev-only WAHA send logging.** When `NODE_ENV=development`, every outbound WAHA message (`sendFile`, `sendText`) logs `[waha-send] <kind> chatId=<…@c.us> lid=<…@lid> response=<WAHA JSON>` — the LID is resolved best-effort via `resolvePhoneToLid`. No-op in production; never throws (LID lookup failure logs `-`). Aids debugging the `@c.us`↔`@lid` correlation. §12.2.1.
- **0.11.3** (2026-06-08) — **Auto-acknowledge proof videos on receipt.** When the inbound webhook successfully stores a proof video (initial OR final), it now sends the buyer a confirmation via a new **editable `proof_received` template** ("Menerima bukti video" in the Challenge config "Kontak & Template WhatsApp" section, positioned right before "Hari 1 (mulai)"). Humanized send (§12.2.1), idempotent per message (`ChallengeReminderLog` key `proof_received:<msgId>`), fire-and-forget, only when the video was actually stored (not on oversize/download-fail), and skipped if the template is left blank. Seeded default text; merged into existing challenges via the GET defaults-merge. The webhook still **never auto-verifies** (admin reviews). §21.6.
- **0.11.2** (2026-06-08) — **Inbound proof videos from WhatsApp `@lid` senders now captured.** WhatsApp increasingly sends inbound DMs with a privacy **`…@lid`** sender id instead of `…@c.us`; the inbound webhook was rejecting these as `not-direct`, so proof videos were dropped. Now `parseJid()` classifies the sender and LIDs are resolved to a phone number via WAHA's LIDs API (`resolveLidToPhone`; fallback matches candidate buyers via `resolvePhoneToLid`). Pure `parseJid` unit-tested. No schema/migration. §21.6.
- **0.11.1** (2026-06-08) — **`after_purchase` challenge instructions now sent INSTANTLY on PAID.** Previously the "Setelah pembelian" message only went out on the next hourly `challenge-reminders` cron tick (up to ~1h delay). The Midtrans webhook now sends it immediately when it auto-creates the participant, via a new reusable `sendChallengeReminderOnce()` (extracted from the cron worker) — **idempotent through the same `ChallengeReminderLog`**, so the hourly cron never double-sends. Fire-and-forget (webhook still acks 200 fast); humanized send (§12.2.1). Other reminders (h7/day1/…) stay on the cron. §21.8.
- **0.11.0** (2026-06-08) — **External landing pages wired to checkout (slice D13) — BUILT.** The three standalone marketing pages in `landing-pages/` (`lp1/2/3.html`, hosted on other domains) now POST a real order to `{CHECKOUT_API_BASE}/api/checkout` (`{ productSlug, name, email, whatsapp, trackingId }`) and redirect the buyer to the returned Midtrans `redirectUrl` — replacing the old `wa.me` redirect. Each page has two operator-set constants (`CHECKOUT_API_BASE`, `PRODUCT_SLUG`); email is now **required** (the `Customer` row + Midtrans need it); `?ref`/`?utm_source`/`?fbclid` → `trackingId`. Each hosted origin must be added to the CORS allowlist (Pengaturan, invariant #10). No app/schema change — reuses the existing checkout contract. Setup: `landing-pages/README.md`. §22.
- **0.10.0** (2026-06-06) — **Challenge WhatsApp automation (slice D12) — BUILT.** Auto-creates a participant on **PAID** for a challenge-active program (`AWAITING_INITIAL` = "Menunggu Bukti Awal"); a new cron `GET /api/cron/challenge-reminders` (CRON_SECRET, hourly) sends the rules' reminder schedule via `sendTextHumanized` (each once, idempotent via new `ChallengeReminderLog`) and auto-eliminates at H+15 (no initial proof) / day-105 (no final proof). `final_received` confirmation is sent by the verify-final action. New enum value `AWAITING_INITIAL` + `ChallengeReminderLog` table; `lib/challenge.ts` gains pure `computeDueReminders`/`renderTemplate`. Dashboard Active KPIs remain stubbed (out of scope). §21.8.
- **0.9.1** (2026-06-06) — **Challenge config: test-send for WA templates.** The Challenge Configuration "Kontak & Template WhatsApp" card gains a **test recipient number** field and a **"Kirim tes"** button under each template textarea — it substitutes `{{contact}}` and sends that message via the humanized sequence (§12.2.1) so the operator can preview reminders before the D12 automation. New endpoint `POST /api/admin/whatsapp/test` (`{ whatsapp, text }`, `requireAdmin`). §21.5.
- **0.9.0** (2026-06-06) — **Challenge module (slice D11) — BUILT (green: 141 tests, tsc, build; pending VPS deploy + migration).** The previously-deferred reward challenge (§15) is now built. Two new admin menus: **Challenge Configuration** (`/admin/challenge`) — pick a program, edit its challenge config (timeline, video rules, rewards/winner tiers, WA templates + contact — all editable, seeded from the rules) — and **User/Active** (`/admin/active`) — the list + status of participants. Proof videos (initial/final weigh-in) are **auto-captured via a WAHA inbound webhook** (`/api/webhooks/waha`) into private storage; the admin verifies each video and enters the weight. New schema: `Challenge` (1:1 with a `Product`), `ChallengeParticipant`, `ChallengeSubmission`, `ParticipantStatus` enum. **Scope of D11 = the 2 menus + inbound capture only**; the outbound WhatsApp reminder automation and automatic phase/elimination cron are a **later slice (D12)**. Rules source of truth: `docs/challenge-rules.md`. Full spec: new **§21**. WAHA inbound contract confirmed from the provider docs (event `message`; media via `media.url` downloaded with `X-Api-Key`; HMAC-SHA512 `X-Webhook-Hmac` auth; dedupe on `payload.id`) — §21.6, open question #14 resolved. Added **§12.2.1 humanized send sequence** (sendSeen → startTyping → wait → stopTyping → sendText) as a required anti-spam standard for all conversational/reminder sends.
- **0.8.1** (2026-06-06) — **Dashboard UI consistency (§20.12).** Added a shared **`Card` / `CardStack` / `PageHeader`** primitive set (`src/components/admin/Card.tsx`) so every admin section is the **same width, padding, radius, and shadow** — fixes the uneven cards on the Pengaturan page. A single `CONTENT_MAX_WIDTH` constrains form pages; the `DataTable` shell now matches the card style. **Standing requirement:** all current and future admin menus compose their UI from these primitives (no ad-hoc card `<div>`s). Pengaturan, Program, and Leads Report refactored onto it.
- **0.8.0** (2026-06-06) — **Built (green: 118 tests, tsc, build; pending VPS deploy + migration).** Added **§20.11 Program management (slice D10)**: a login-gated **Program** page (`/admin/program`) to configure the sellable e-books. It lists programs in a TanStack `DataTable` (id, product name, program name, sales period, price, status) with an **Add Program** button and per-row **Edit**; the add/edit form can **upload the PDF e-book**, written privately into `EBOOK_FILES_DIR` (never under `public/`, never served statically — invariant #4). Each program carries a **sales window** (`salesStartAt`/`salesEndAt`, WIB); **once the period ends the e-book can no longer be bought** — the landing page hides the form and `/api/checkout` rejects with `403`. `Product` gains `programName`, `salesStartAt`, `salesEndAt` (§9). The **Program** dropdown on the Leads Report becomes **live** — it filters metrics by program/product via `/api/admin/report?programId=…` (§20.4/§20.5); the challenge-tied **Active / Conv. Rate Active** KPIs stay stubbed (§20.2). New `lib/programs.ts` (pure `isOnSale` / sales-status) + private upload handling in `lib/files.ts`; admin CRUD at `/api/admin/programs[/{id}]`. A program may also carry **extra attachment PDFs** (`ProductAttachment`, e.g. a separate to-do-list PDF) uploadable on create and add/removable on edit; on purchase the buyer receives the **e-book + every attachment** over WhatsApp. To keep delivery exactly-once across multiple files, `Delivery` now has one **`DeliveryItem` per file** (e-book + each attachment), snapshotted at purchase; a retry re-sends only the items not yet `SENT` (invariant #3). The **Program** is the entity the future **Challenge module (§15)** will reference.
- **0.7.6** (2026-06-05) — Dashboard made **responsive**: new `DashboardShell` wraps the sidebar + content; on ≤768px the sidebar collapses into an off-canvas drawer with a sticky top bar + hamburger (overlay to dismiss). Sidebar CSS consolidated into the shell's `<style>` block. Login card and the Pengaturan tables made mobile-friendly (fluid width / horizontal scroll). KPI cards and DataTable already wrapped/scrolled.
- **0.7.5** (2026-06-05) — Added **§20.10 Checkout rate limit (slice D9)**: per-IP fixed-window limit on `/api/checkout`, **configurable and disableable** from the Pengaturan menu. New `RateLimitConfig` singleton table; `lib/rate-limit.ts` (in-memory per-IP buckets + cached config); `/api/checkout` returns `429` + `Retry-After` when exceeded; admin config at `GET/PUT /api/admin/rate-limit`.
- **0.7.4** (2026-06-05) — Added **§20.9 CORS domain allowlist (slice D8)** so external landing pages on other domains can POST to `/api/checkout` from the browser. New `AllowedOrigin` table; `/api/checkout` gains an `OPTIONS` preflight + per-response `Access-Control-Allow-Origin` echoed only for whitelisted (or same-app) origins; admin CRUD at `/api/admin/origins`; managed from the **Pengaturan** dashboard page. CORS is checked **live** against the DB (no restart needed).
- **0.7.3** (2026-06-05) — Second bug-fix pass (state machine + delivery): (1) `canTransition` rewritten as an explicit allowed-transition map — a **PAID order can no longer be overwritten** by a late `FAILED`/`EXPIRED`/`CANCELLED` (only `PAID → REFUNDED`); failure/refund states are terminal. (2) Same→same is now a true **no-op** (duplicate `settlement` no longer re-writes `paidAt`). (3) `attemptDelivery` now **atomically claims** the row (`PENDING/FAILED → PROCESSING` via `updateMany`), closing a double-send race (invariant #3). (4) `processDueDeliveries` **reclaims stale `PROCESSING`** rows (orphaned by a crash, >10 min) so they retry. (5) Backoff off-by-one fixed — first retry is 1 min again. (6) `orderCode` uses crypto randomness + collision retry. (7) webhook signature compare is constant-time.
- **0.7.2** (2026-06-05) — Bug-fix pass: (1) the proxy now guards **only** `/admin/*` UI pages; `/api/admin/*` routes **self-authenticate** via a shared `requireAdmin()` accepting a session cookie **or** the `ADMIN_TOKEN` bearer (previously the proxy's cookie-only gate blocked bearer/machine callers and left orders/resend unreachable). (2) `Sukses` is now bucketed by `sentAt` per §20.4 (was `updatedAt`). (3) `/api/admin/report` caps the range at 366 days. (4) `admin:create` masks the password input. §20.3/§20.5 updated.
- **0.7.1** (2026-06-05) — Added **§20.8 Dashboard UX polish + DataTable (slice D3.1)**: restyled KPI widgets and a reusable sortable/searchable/paginated table on **TanStack Table** with **CSV + PDF export**. New deps: `@tanstack/react-table`, `jspdf`, `jspdf-autotable`. Recorded in §6 tech stack, §19.3 build order, §20.6 acceptance. D1–D3 marked built/deployed.
- **0.7.0** (2026-06-05) — Added **§20 Operator Dashboard / CMS** (multi-user login + Leads Report) per the mockup at `docs/mockups/cms.png`. Resolved dashboard decisions (Lead = any checkout submission; Purchase = PAID order; Active/Program tied to the deferred Challenge module and stubbed for now; multi-user username+password auth). Added `AdminUser` + `Session` to §9, admin UI routes to §10, dashboard slices (D1–D3) to §19.3.
- **0.6.1** (2026-06-05) — Stack upgrade folded into the spec: **Next.js 16, Prisma 7 (+`@prisma/adapter-pg`), Zod 4, TypeScript 6, Node 22, PostgreSQL 17, ESLint 10.** Prisma 7 moves the datasource `url` out of `schema.prisma` into `prisma.config.js` and requires a driver adapter on `PrismaClient`; `prisma db seed` removed (seed runs as `node prisma/seed.mjs`). §6/§9 updated accordingly.
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
- [ ] **Email fallback (D14, §23):** when any item fails on a delivery pass, the e-book + attachments are
      **also** emailed to the buyer (best-effort, idempotent, once per order) — WhatsApp retry is unchanged.

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
| Framework | **Next.js 16 (App Router) + TypeScript 6** | Landing page + API route handlers in one codebase |
| Validation | **Zod 4** | Request bodies + env validation |
| Database | **PostgreSQL 17** | Managed or Docker locally |
| ORM | **Prisma 7 + `@prisma/adapter-pg`** | Schema in §9. **Prisma 7:** datasource `url` lives in `prisma.config.js` (not `schema.prisma`); `PrismaClient` is constructed with the `PrismaPg` driver adapter; `prisma db seed` is removed (run `node prisma/seed.mjs`). |
| Payments | **Midtrans Snap** | Server-side transaction creation + webhook |
| WhatsApp delivery | **WAHA** (3rd-party managed service) | Public HTTPS only — see §12.2 / §18 |
| File storage | **Local private directory on the app server** | E-book files on a mounted volume, outside the web root, never served statically |
| Background retries | System cron → delivery worker (`/api/cron/process-deliveries`) | Backoff-driven retries |
| Dashboard auth | **DB-backed sessions** (`AdminUser` + `Session`), scrypt password hashing via `node:crypto` | Multi-user operator login for the CMS (§20). Dependency-free hashing. |
| Dashboard tables | **TanStack Table** (`@tanstack/react-table`, headless) | Sortable / searchable / paginated tables for the CMS (§20.8). Styled by us. |
| Dashboard export | **jsPDF** (`jspdf` + `jspdf-autotable`) for PDF; native `Blob` for CSV | Client-side CSV + PDF export of the current table view (§20.8). |
| Hosting | **AlmaLinux 10 VPS** running Docker Compose: Caddy + app (Node 22-alpine) + Postgres 17 | Only Caddy (80/443) is public. **WAHA is an external 3rd-party HTTPS service** — see §18 |

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
SITE_ADDRESS=yourdomain.com   # domain Caddy (dipakai Caddyfile sebagai {$SITE_ADDRESS}); tanpa skema

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
WAHA_WEBHOOK_SECRET=  # shared secret to authenticate WAHA -> /api/webhooks/waha inbound calls (§21)

# Fonnte (alternative WhatsApp engine, D15 §24) — optional; only needed when the active engine is 'fonnte'
FONNTE_TOKEN=          # server-only device token (sent as the Authorization header to api.fonnte.com)
FONNTE_WEBHOOK_SECRET= # shared secret in the Fonnte inbound webhook URL: /api/webhooks/fonnte?token=<this>

# Files (local, private)
EBOOK_FILES_DIR=/data/ebooks            # mounted private volume; MUST be outside the web root / public dir
CHALLENGE_MEDIA_DIR=/data/challenge-media  # inbound proof videos; private, outside web root (§21)

# Security
ADMIN_TOKEN=          # bearer token for machine access to /api/admin/* (cron, scripts)
CRON_SECRET=          # only needed if you trigger retries via an HTTP cron endpoint

# Email fallback (D14, §23) — all optional; the fallback is OFF unless EMAIL_FALLBACK_ENABLED=true + creds set
EMAIL_FALLBACK_ENABLED=false                 # true => email the e-book when a WhatsApp send fails
GMAIL_USER=                                  # sending Gmail address (also the SMTP username)
GMAIL_APP_PASSWORD=                          # 16-char Gmail App Password (NOT the account password; needs 2-Step Verification)
EMAIL_FROM=                                  # optional From: header; defaults to GMAIL_USER
```

> **Dashboard auth (§20)** uses DB-backed sessions, not an env secret: the opaque session token
> lives in an HTTP-only cookie and only its hash is stored in the `Session` table, so no
> `SESSION_SECRET` is required. The first operator account is created with the `admin:create`
> script (§20.3) — never commit a default password. `ADMIN_TOKEN` remains for machine/API callers.

> All env access goes through a zod-validated `src/lib/env.ts`; the app must fail fast on startup
> if a required variable is missing. **`WAHA_BASE_URL` must start with `https://`** — the app should
> refuse to start (or refuse to send) if it is plain `http://`, since the API key and base64 e-book
> would otherwise cross the public internet in cleartext.

---

## 9. Data Schema (Prisma) `[STABLE]`

> **Prisma 7 note:** the datasource has **no `url`** in `schema.prisma` — the connection string is
> supplied via `prisma.config.js` (`datasource.url = process.env.DATABASE_URL`) for the CLI, and via
> the `PrismaPg` adapter passed to `new PrismaClient({ adapter })` at runtime (see `src/lib/db.ts`).

```prisma
// prisma/schema.prisma
generator client { provider = "prisma-client-js" }
datasource db { provider = "postgresql" }   // url is in prisma.config.js (Prisma 7)

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
  programName  String?                  // operator-facing program label, e.g. "Diet90" (§20.11)
  salesStartAt DateTime?                // sales window start (WIB); null = no lower bound
  salesEndAt   DateTime?                // sales window end (inclusive, WIB); after this checkout is suspended (§20.11)
  createdAt   DateTime @default(now())
  updatedAt   DateTime @updatedAt
  orders      Order[]
  attachments ProductAttachment[]       // extra private PDFs delivered with the e-book (§20.11)
  challenge   Challenge?                // optional reward challenge for this program (§21)
}

model ProductAttachment {                // additional private PDF(s) given to the buyer after purchase (§20.11)
  id        String   @id @default(cuid())
  productId String
  filePath  String                       // relative to EBOOK_FILES_DIR, e.g. "<cuid>.pdf" (private, like the e-book)
  fileName  String                       // buyer-facing name, e.g. "To-Do List Tantangan.pdf"
  mimeType  String   @default("application/pdf")
  sizeBytes Int?
  sortOrder Int      @default(0)         // delivery order after the main e-book
  createdAt DateTime @default(now())
  product   Product  @relation(fields: [productId], references: [id], onDelete: Cascade)
  @@index([productId])
}

model Customer {
  id        String   @id @default(cuid())
  name      String
  email     String
  whatsapp  String                       // normalized digits, no '+', e.g. "628123456789"
  createdAt DateTime @default(now())
  updatedAt DateTime @updatedAt
  orders    Order[]
  challengeParticipations ChallengeParticipant[]   // §21
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
  challengeParticipant  ChallengeParticipant?      // §21
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
  status        DeliveryStatus @default(PENDING)   // SENT only when every DeliveryItem is SENT
  attempts      Int            @default(0)
  maxAttempts   Int            @default(5)
  nextRetryAt   DateTime?
  wahaMessageId String?                            // first/main message id (kept for back-compat)
  lastError     String?
  sentAt        DateTime?
  createdAt     DateTime       @default(now())
  updatedAt     DateTime       @updatedAt
  order         Order          @relation(fields: [orderId], references: [id])
  items         DeliveryItem[]                     // one per file (e-book + each attachment) (§20.11)
  @@index([status, nextRetryAt])
}

model DeliveryItem {                                // per-file send state — exactly-once per file (§20.11, invariant #3)
  id            String         @id @default(cuid())
  deliveryId    String
  kind          String                             // "ebook" | "attachment"
  filePath      String                             // snapshot of the file at purchase time (relative to EBOOK_FILES_DIR)
  fileName      String                             // buyer-facing name sent over WAHA
  sortOrder     Int            @default(0)          // 0 = e-book first, then attachments
  status        DeliveryStatus @default(PENDING)    // PENDING → SENT | FAILED (no PROCESSING needed; the Delivery claims)
  attempts      Int            @default(0)
  wahaMessageId String?
  lastError     String?
  sentAt        DateTime?
  createdAt     DateTime       @default(now())
  updatedAt     DateTime       @updatedAt
  delivery      Delivery       @relation(fields: [deliveryId], references: [id], onDelete: Cascade)
  @@index([deliveryId, status])
}

// ── Dashboard / CMS (§20) ──────────────────────────────────────────────
model AdminUser {                            // operator accounts for the dashboard
  id           String    @id @default(cuid())
  username     String    @unique
  name         String
  passwordHash String                        // format: "scrypt$<saltHex>$<hashHex>" (node:crypto)
  isActive     Boolean   @default(true)
  lastLoginAt  DateTime?
  createdAt    DateTime  @default(now())
  updatedAt    DateTime  @updatedAt
  sessions     Session[]
}

model Session {                              // DB-backed login sessions (opaque cookie token)
  id        String    @id @default(cuid())
  userId    String
  tokenHash String    @unique                // sha256 of the random token stored in the cookie
  expiresAt DateTime
  createdAt DateTime  @default(now())
  user      AdminUser @relation(fields: [userId], references: [id], onDelete: Cascade)
  @@index([userId])
  @@index([expiresAt])
}

model AllowedOrigin {                         // CORS allowlist for /api/checkout (§20.9)
  id        String   @id @default(cuid())
  origin    String   @unique                  // normalized "scheme://host[:port]"
  label     String?
  isActive  Boolean  @default(true)
  createdAt DateTime @default(now())
  updatedAt DateTime @updatedAt
}

model RateLimitConfig {                        // singleton — checkout rate limit (§20.10)
  id            String   @id @default("default")
  enabled       Boolean  @default(true)
  maxRequests   Int      @default(10)          // per IP per window on /api/checkout
  windowSeconds Int      @default(60)
  updatedAt     DateTime @updatedAt
}

// ── Challenge / reward module (§21) ────────────────────────────────────
model Challenge {                                // one reward challenge per program (Product)
  id                   String   @id @default(cuid())
  productId            String   @unique          // the program this challenge belongs to
  isActive             Boolean  @default(false)   // is the challenge open for this program
  // Timeline (editable; defaults from docs/challenge-rules.md)
  startWindowDays      Int      @default(14)       // days after purchase to send initial proof
  durationDays         Int      @default(90)       // challenge length from the start date
  finalProofWindowDays Int      @default(14)       // days after day-90 to send final proof
  phases               Json                        // [{ name, focus, startDay, endDay }] (3 by default)
  // Video rules
  videoMaxSeconds      Int      @default(30)
  videoMaxSizeMb       Int      @default(10)
  videoFormat          String   @default("mp4")
  // Rewards + winners
  rewardsText          String?                     // free-form prize description
  winnerTiers          Json                        // [{ label, prize, count }]
  // Contact + WA templates (templates used by the deferred D12 automation)
  contactInfo          String?                     // replaces "hub: xxxx" in templates
  messageTemplates     Json                        // { triggerKey: "template text", ... }
  createdAt            DateTime @default(now())
  updatedAt            DateTime @updatedAt
  product              Product  @relation(fields: [productId], references: [id], onDelete: Cascade)
  participants         ChallengeParticipant[]
}

enum ParticipantStatus {
  AWAITING_INITIAL         // bought, awaiting initial proof — auto-created on PAID (Menunggu Bukti Awal) [D12]
  PENDING_INITIAL_REVIEW   // initial proof received, awaiting admin verification (Menunggu Verifikasi)
  RUNNING                  // verified + started; phase derived from startAt (Challenge Berjalan / Fase X)
  PENDING_FINAL_REVIEW     // final proof received, awaiting admin verification
  COMPLETED                // both proofs verified (Selesai / Masuk Penilaian Reward)
  DROPPED                  // gugur/disqualified — see dropReason
}

model ChallengeParticipant {
  id            String            @id @default(cuid())
  challengeId   String
  customerId    String
  orderId       String            @unique          // the PAID order that grants entry (one entry per order)
  status        ParticipantStatus @default(PENDING_INITIAL_REVIEW)
  purchaseAt    DateTime                            // snapshot of order.paidAt (start-window anchor)
  startAt       DateTime?                           // = initial proof received date (challenge day-1)
  initialWeightKg Float?                            // entered by admin from the verified initial video
  finalSubmittedAt DateTime?                        // when final proof was received
  finalWeightKg Float?                              // entered by admin from the verified final video
  percentLoss   Float?                              // computed on completion ((init-final)/init*100)
  dropReason    String?                             // "eliminated_initial" | "eliminated_final" | "disqualified" | free text
  notes         String?
  createdAt     DateTime          @default(now())
  updatedAt     DateTime          @updatedAt
  challenge     Challenge         @relation(fields: [challengeId], references: [id], onDelete: Cascade)
  customer      Customer          @relation(fields: [customerId], references: [id])
  order         Order             @relation(fields: [orderId], references: [id])
  submissions   ChallengeSubmission[]
  reminders     ChallengeReminderLog[]
  @@index([challengeId, status])
}

model ChallengeSubmission {                          // an inbound proof video (auto-captured from WAHA)
  id            String   @id @default(cuid())
  participantId String
  kind          String                              // "initial" | "final"
  receivedAt    DateTime @default(now())
  fromNumber    String                              // sender WhatsApp (normalized)
  wahaMessageId String?  @unique                    // dedupe inbound webhook deliveries
  mediaPath     String?                             // private path under CHALLENGE_MEDIA_DIR (never public/)
  mimeType      String?
  sizeBytes     Int?
  verifiedAt    DateTime?                           // set when admin accepts it
  rejectedReason String?
  rawPayload    Json?
  participant   ChallengeParticipant @relation(fields: [participantId], references: [id], onDelete: Cascade)
  @@index([participantId])
}

model ChallengeReminderLog {                          // idempotency log for sent reminders (D12, §21.8)
  id            String   @id @default(cuid())
  participantId String
  key           String                               // trigger/template key, e.g. "after_purchase","h7","day90"
  sentAt        DateTime @default(now())
  wahaMessageId String?
  error         String?
  participant   ChallengeParticipant @relation(fields: [participantId], references: [id], onDelete: Cascade)
  @@unique([participantId, key])                     // each reminder at most once per participant
}

enum WaLogStatus { SENT FAILED }

model WaMessageLog {                                  // outbound WhatsApp send audit (WA Logs, D5, §20.13)
  id             String      @id @default(cuid())
  category       String                               // "ebook" | "attachment" | "reminder"
  status         WaLogStatus
  chatId         String                               // recipient chatId ("…@c.us")
  toPhone        String?                              // normalized digits when known
  templateKey    String?                              // reminder trigger key (e.g. "after_purchase","h7")
  fileName       String?                              // file sends — buyer-facing filename
  bodyPreview    String?                              // truncated caption/text snippet
  wahaMessageId  String?
  error          String?                              // failure reason when status = FAILED
  orderId        String?                              // plain ids, NO FK — durable audit, survives deletes
  deliveryId     String?                              // delivery rows → Resend from the UI
  deliveryItemId String?
  participantId  String?
  productId      String?                              // for the program filter
  createdAt      DateTime    @default(now())
  @@index([createdAt])
  @@index([category, status])
  @@index([productId])
}
```

---

## 10. File / Project Structure `[STABLE]`

```
ebook-sales/
├── prisma/
│   ├── schema.prisma
│   ├── seed.mjs                                 # seed product(s) — plain ESM, run with `node`
│   └── migrations/
├── prisma.config.js                            # Prisma 7 config: datasource.url = env DATABASE_URL
├── src/
│   ├── app/
│   │   ├── layout.tsx
│   │   ├── page.tsx                             # default / redirect
│   │   ├── [slug]/page.tsx                      # product landing + checkout form
│   │   ├── thank-you/page.tsx                   # post-payment confirmation
│   │   ├── admin/                               # operator dashboard / CMS (§20)
│   │   │   ├── login/page.tsx                   # login form
│   │   │   ├── layout.tsx                       # shell: sidebar nav + auth guard
│   │   │   ├── page.tsx                         # Leads Report (the mockup)
│   │   │   ├── program/page.tsx                 # Program management — list/add/edit, PDF upload [D10]
│   │   │   ├── challenge/page.tsx               # Challenge Configuration (pick program → config) [D11]
│   │   │   └── active/page.tsx                  # User/Active — participant list + status         [D11]
│   │   │       # later slices: leads/, purchases/, wa-logs/, reports/
│   │   └── api/
│   │       ├── checkout/route.ts                # POST: create order + Snap token
│   │       ├── webhooks/midtrans/route.ts       # POST: payment notification
│   │       ├── webhooks/waha/route.ts           # POST: inbound WA proof videos (auto-capture)  [D11]
│   │       ├── cron/process-deliveries/route.ts # GET: retry due deliveries
│   │       ├── cron/challenge-reminders/route.ts # GET: send due WA reminders + auto-eliminate  [D12]
│   │       └── admin/
│   │           ├── auth/login/route.ts          # POST: username+password → session cookie
│   │           ├── auth/logout/route.ts         # POST: clear session
│   │           ├── report/route.ts              # GET: dashboard metrics (today + 14-day series; ?programId filter)
│   │           ├── programs/route.ts            # GET list / POST create (+PDF upload, multipart)  [D10]
│   │           ├── programs/[id]/route.ts       # PATCH update (+optional PDF) / DELETE            [D10]
│   │           ├── challenges/[productId]/route.ts   # GET / PUT upsert a program's challenge config [D11]
│   │           ├── participants/route.ts        # GET: list participants (?programId &state)       [D11]
│   │           ├── participants/[id]/route.ts   # PATCH: verify proof / set weight / drop          [D11]
│   │           ├── participants/[id]/proof/[kind]/route.ts # GET: stream the private proof video    [D11]
│   │           ├── whatsapp/test/route.ts       # POST: send a test WA message (template preview)    [D11]
│   │           ├── orders/route.ts              # GET: list/filter orders
│   │           └── deliveries/[id]/resend/route.ts  # POST: manual re-send
│   ├── components/
│   │   ├── checkout-form.tsx
│   │   └── admin/                               # dashboard UI components (cards, table, filter bar)
│   ├── lib/
│   │   ├── db.ts            # Prisma client (PrismaPg adapter)
│   │   ├── env.ts           # zod-validated env
│   │   ├── validation.ts    # zod request schemas
│   │   ├── orders.ts        # order creation + status transitions
│   │   ├── midtrans.ts      # Snap create + signature verify + status map
│   │   ├── waha.ts          # WAHA client (sendFile / sendText)
│   │   ├── files.ts         # resolve + read e-book from EBOOK_FILES_DIR (private); save uploaded PDF [D10]
│   │   ├── programs.ts      # pure on-sale / sales-window logic (isOnSale, salesStatus)        [D10]
│   │   ├── challenge.ts     # pure challenge logic (day/phase, %loss, status view, defaults)   [D11]
│   │   ├── phone.ts         # WhatsApp number normalization
│   │   ├── delivery.ts      # idempotent send + retry orchestration
│   │   ├── auth.ts          # admin token + cron secret guards
│   │   ├── password.ts      # scrypt hash + verify (node:crypto)        [D1]
│   │   ├── session.ts       # create / validate / destroy login session [D1]
│   │   └── report.ts        # pure metric aggregation functions          [D2]
│   ├── middleware.ts        # gate /admin/* (redirect to /admin/login)   [D1]
│   └── types/index.ts
├── scripts/
│   └── create-admin.mjs     # `npm run admin:create` — make the first operator account [D1]
├── Dockerfile               # builds the Next.js app image (Node 22-alpine)
├── Caddyfile                # reverse proxy + auto TLS (80/443 → app)
├── docker-compose.yml       # app host: caddy + app + postgres (WAHA is 3rd-party, see §18)
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
**Auth**: `CRON_SECRET` via the **`x-cron-secret` header only** (the `?secret=` query form was removed in
0.16.1 so the secret never appears in access logs; compared constant-time).
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
- **Multiple files (D10, §20.11):** a program may include attachment PDFs, so a single delivery sends
  the **e-book + each attachment** as separate `sendFile` calls (e-book first). State is tracked
  per-file via `DeliveryItem`; a retry resends only items not yet `SENT`, so no file goes twice and the
  `Delivery` is `SENT` only once every item succeeds.
- **Session health**: the WhatsApp number is linked once in the **provider's dashboard** (no QR
  handling on our side). If the provider's session drops, sends fail → deliveries go to retry.
  Surface send failures to the operator so a re-link in the provider dashboard can be triggered.

#### 12.2.1 Humanized send sequence (anti-spam) `[STABLE]`
WhatsApp can flag bot-like behavior. **Any conversational/text reply the system sends — especially the
D12 challenge reminders — MUST follow this sequence** (`lib/waha.ts` should expose a `sendTextHumanized`
helper that does it; the existing automatic e-book `sendFile` on PAID is a transactional push and is
exempt, though it may still `startTyping`/`stopTyping`):
1. `POST /api/sendSeen` — mark the incoming message seen (`{ session, chatId, messageIds? }`).
2. `POST /api/startTyping` — `{ session, chatId }`.
3. **Wait a random interval** scaled to the message length (e.g. ~`min(base + perChar·len, cap)` with jitter).
4. `POST /api/stopTyping` — `{ session, chatId }`.
5. `POST /api/sendText` — `{ session, chatId, text }`.
All calls use `X-Api-Key: WAHA_API_KEY` over `https://`. (Endpoints confirmed at
https://waha.devlike.pro/docs/how-to/send-messages/.) **Bulk sends must be strictly sequential** (never
parallel) and additionally spaced by a randomized gap between recipients — see the D12 worker (§21.8) —
so a single WhatsApp number never approaches a per-second send rate.

**Recipient priming (first-contact delivery):** WhatsApp is end-to-end encrypted — to deliver to a number
that has **never contacted** the WAHA account, the engine first needs that recipient's key bundle/session,
or the message is accepted by the API but stuck at `status: PENDING` and never arrives (and starts working
only once the recipient messages first). So **both** send paths call `primeRecipient(chatId)` before sending:
`GET /api/contacts/check-exists` (`checkNumberExists`) — the on-WhatsApp lookup that resolves the recipient
and primes the session — then a short **randomized delay** (`primeDelayMs`, ~1.5–3.5s) before the actual
send. Best-effort: a failed or negative check is logged but never blocks the send (the lookup's priming
side-effect is the point). This does NOT override WhatsApp's own anti-spam — the sender number must still be
a real, warmed-up account.

**Send logging (debug):** both outbound paths (`sendFile`, `sendText`) emit a `[waha-send] <kind>
chatId=<…@c.us> lid=<…@lid> response=<WAHA JSON>` line so the `@c.us`↔`@lid` identity and WAHA's response
can be correlated while debugging. It is **off by default** (the per-send LID lookup is opt-in) and turns
on when `NODE_ENV=development` **or** the env var **`WAHA_LOG_SENDS`** is truthy (`1`/`true`) — set the
latter on the prod container to debug live sends without rebuilding the image or changing `NODE_ENV`. The
LID lookup is best-effort and never throws (logs `-` on failure).

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
| Late `deny`/`expire`/`cancel` after `PAID` | **Ignored** — a PAID order only transitions to `REFUNDED`; never overwritten by a failure state |
| `deny` / `expire` / `cancel` (from PENDING) | Order set to FAILED/EXPIRED/CANCELLED; **no delivery** |
| `capture` + `challenge` | Order stays PENDING; no delivery until resolved |
| Delivery orphaned in `PROCESSING` (crash mid-send) | Reclaimed by the retry worker after 10 min (→ PENDING) and retried |
| Concurrent duplicate webhooks | Delivery row is claimed atomically (`PENDING/FAILED → PROCESSING`); only one send occurs |
| Refund after delivery | Order → REFUNDED; file already sent (cannot recall) — operator note |
| Invalid WhatsApp number | Rejected at checkout (`422`); if discovered at send time → delivery FAILED + operator alert + manual resend with corrected number |
| WAHA session down | Send fails → retried by cron; operator alerted; resumes when the number is re-linked in the provider dashboard |
| E-book exceeds provider's request-size limit | Send rejected; mark delivery FAILED + operator alert (file too large for base64 over this provider) |
| WhatsApp item fails + email configured (D14) | E-book + attachments also emailed to the buyer (best-effort, once per order); WhatsApp retry continues unchanged |
| Email fallback send fails (e.g. Gmail down / >25 MB) | `emailFallbackError` recorded, `emailFallbackSentAt` stays null; retried on the next delivery cron pass; never blocks/fails the WhatsApp send |
| 3rd-party WAHA rate-limited / 5xx | Treated as transient; retried with backoff up to `maxAttempts` |
| `WAHA_BASE_URL` is not `https://` | App refuses to start / refuses to send (no cleartext API key or e-book) |
| Midtrans create fails at checkout | Return `502`; order not left in a payable-but-broken state |
| Buyer buys twice | Two orders, two deliveries — both valid |

---

## 15. Challenge Module — now being built (see §21) `[SUPERSEDED]`

> **Update (2026-06-06):** the challenge is no longer deferred — it is specced in full as **§21
> (slice D11)** and references a program via `Challenge.productId = Product.id`. The notes below are
> the original design seam; §21 is authoritative. Rules source of truth: `docs/challenge-rules.md`.

### 15.0 Original design seam (historical)

The current model already captures everything needed to gate a future contest on a **paid order**.
When the challenge is added, introduce (without changing existing tables):
- `Contest` (window, product link, prize), `ContestEntry` (links to a paid `Order`/`Customer`),
  and a `Score`/leaderboard store (Postgres window functions, optionally Redis sorted set later).
- Eligibility rule: a customer may enter only if they have a `PAID` `Order` for the contest's product.
- Keep scoring **server-authoritative** (see prior design discussion).

**Extension seam in this build**: do not couple delivery logic to order creation tightly; keep
`Customer`↔`Order` clean and queryable by `productId` + `status = PAID`.

**Program link (added 2026-06-06, D10 §20.11):** the contest will reference a **program** — i.e. a
`Product` (now carrying `programName`, a sales window, and attachments). `Contest.programId =
Product.id`; eligibility = a `PAID` `Order` for that `productId`. The Program management page (§20.11)
is where these programs are configured; the deferred Challenge plugs into them later without schema churn.

---

## 16. Open Questions `[OPEN]`

1. ~~**Single product or catalog?**~~ **Resolved (2026-06-04):** single product for v1 (slug `lose-weight-challenge-1st-edition`, IDR 75,000). Schema stays catalog-capable. **Updated (2026-06-06, D10 §20.11):** the dashboard now manages **multiple programs** (a small catalog) — each program is a `Product` with its own slug, PDF, price, and sales window. The buyer flow stays **per-slug** (one landing page per program).
2. **Tracking ID semantics** — affiliate code, ad-campaign id, or both? Affects future reporting (not behaviour now).
3. ~~**Email fallback**~~ **Resolved (2026-06-22, D14 §23).** Yes — when a WhatsApp delivery item fails,
   the e-book + attachments are **also** emailed to the buyer (best-effort, idempotent, once per order),
   in **parallel** with (not instead of) the normal WhatsApp retry. Provider = **Gmail SMTP via App
   Password** (`nodemailer`), isolated behind `lib/email.ts` so it can be swapped later. Off unless
   `EMAIL_FALLBACK_ENABLED=true` + creds set. §23.
4. **Data retention period** for buyer PII (UU PDP).
5. **3rd-party WAHA provider** — which provider, its **max request body size** (limits e-book size for base64), whether it supports **IP allowlisting**, its auth header, and whether a data-processing agreement is needed. **(D10 note):** the upload endpoint caps each PDF at **32 MB** (`MAX_UPLOAD_BYTES`); base64 makes that ~43 MB to WAHA, so confirm the provider allows it, and set Caddy `request_body { max_size 40MB }` on the proxied app so the upload itself isn't rejected at the edge.
6. ~~**Checkout failure policy?**~~ **Resolved (2026-06-04):** mark the order **FAILED** (not delete) — preserves the audit trail.

**Dashboard decisions (resolved 2026-06-05 — see §20.2):**
7. ~~**What is a "Lead"?**~~ Every checkout submission (an `Order`, any status). **Purchase** = `Order.status = PAID`. No new table.
8. ~~**What does "Active" count?**~~ Challenge-program participants — **depends on the deferred Challenge module (§15)**, so **Active / Conv. Rate Active** are rendered in the dashboard but **stubbed (0 / "—")** until that module is built. **Resolved (2026-06-06, D10):** the **Program** sidebar page + Leads Report dropdown are a **separate, real** concept (the sellable-e-book configuration, §20.11) — not the challenge. The dropdown is now **live** and filters report metrics by program/product.
9. ~~**Dashboard login?**~~ **Multi-user username + password**, DB-backed sessions (`AdminUser` + `Session`).
10. ~~**WA Logs accuracy?**~~ **Resolved (2026-06-22, D5).** Instead of the originally-floated `DeliveryAttempt` table, WA Logs is backed by a broader **`WaMessageLog`** audit table that records every **outbound** WhatsApp send (e-book/attachment deliveries **and** challenge reminders) at the moment it happens — written best-effort from `lib/wa-log.ts` so logging never blocks a send. Each send is one log row (`SENT`/`FAILED` + error + `wahaMessageId`), so per-event accuracy now exists going forward; a one-off backfill seeds the final per-row state of pre-existing deliveries/reminders. Dashboard §20.4 WA counts still derive from `Delivery` status (unchanged). Inbound capture + operator test-sends are out of scope. §20.13.

**Challenge decisions (resolved 2026-06-06 — see §21):**
11. ~~**How are proof videos captured?**~~ **Auto-capture via WAHA inbound webhook** (`/api/webhooks/waha`) into private `CHALLENGE_MEDIA_DIR`; admin verifies + enters the weight. (Alternatives: manual admin entry / both — rejected.)
12. ~~**Who appears in User/Active?**~~ **Only participants who started** (their initial proof video has arrived). A row is created when the inbound proof lands; status begins `PENDING_INITIAL_REVIEW`.
13. ~~**D11 scope?**~~ **The 2 menus + inbound capture only.** Outbound WhatsApp reminders + automatic phase/elimination transitions are **deferred to slice D12**.
14. ~~**WAHA inbound capability?**~~ **Resolved (2026-06-06, WAHA docs):** the session subscribes to the **`message`** event and POSTs to our webhook; media arrives as **`payload.media.url`** (a WAHA `/api/files/...` link, downloaded with `X-Api-Key: WAHA_API_KEY`), **not** base64; auth = **HMAC-SHA512** via the `X-Webhook-Hmac` header (configure `webhooks[].hmac.key = WAHA_WEBHOOK_SECRET`); dedupe on `payload.id`; WAHA retries failed deliveries. No documented inbound size limit — we cap our own storage. See §21.6. Any outbound reply must use the humanized send sequence (§12.2.1).
15. ~~**Active KPI wiring**~~ **Resolved (2026-06-22, D6).** The dashboard `Active` / `Conv. Rate Active` KPIs are now **live** off `ChallengeParticipant`: **Active = count of `RUNNING` participants** and **Conv. Rate Active = Active ÷ cumulative PAID orders** (both program-scoped via the program filter). Implemented as `getActiveSnapshot(productId?)` in `lib/report.ts` → `ReportData.snapshot`, surfaced on the real-time KPI cards. The **14-day series table's Active / Conv. Rate Active columns are also filled** (2026-06-22) by `getActiveSeries(dates, productId?)` as a per-day **event count** — each participant bucketed on the WIB day of their `startAt` (became active), like Leads/Purchase; Conv. Rate Active = same-day active ÷ purchase. §20.4.

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

**Done (2026-06-04/05):** scaffold + F1–F7 + SLC polish + **D1–D3** (dashboard auth, metrics API,
Leads Report UI) are built, tested, and deployed; the stack was upgraded to the latest majors
(Next 16 / Prisma 7 / Zod 4 / TS 6 / Node 22 / PG 17).

**Dashboard / CMS (§20) — in progress:** **D3.1** UX polish — restyled KPI widgets + a reusable
sortable/searchable/paginated **DataTable** (TanStack Table) with CSV + PDF export (§20.8).
**Done:** **D8** CORS domain allowlist (§20.9) · **D9** checkout rate limit (§20.10) · **D10** Program
management (§20.11) · **§20.12** shared Card UI system.
**Done:** **D11** Challenge module (§21) — Challenge Configuration + User/Active + WAHA inbound capture.
**D12** Challenge WhatsApp automation (§21.8) — auto-create on PAID + hourly reminder cron + auto-elimination.
**D5** WA Logs (§20.13) — outbound WhatsApp send audit (`WaMessageLog`) + filters + Resend.
**D4 (Leads half)** Leads list (§20.14) — every checkout submission, any status, + filters + Detail/Resend.
**D6** user management (§20.15) — multi-admin CRUD (add/rename/reset-password/(de)activate) as a card in Pengaturan.
**Not built (owner, 2026-06-22):** **D4 (Purchase half)** PAID-only page (Leads' `Lunas` filter covers it) ·
**D7** Laporan export hub (every table already exports CSV/PDF of its current view).

### 19.4 Anti-regression rules
- Every completed feature gets at least one test; run the suite before and after each slice.
- Commit the lockfile; never change dependency versions mid-build without recording it in `PROGRESS.md`.
- Small diffs over large rewrites; one slice per commit.
- The acceptance criteria in §5 are the contract — a feature is "done" only when its boxes are ticked **and** verified.

### 19.5 Resuming in this chat interface (if not using Claude Code)
A new conversation starts blank. To resume: upload the current repo (zip) + `PROGRESS.md` + this PRD,
and instruct the assistant to run the §19.1 routine before writing any code.

---

## 20. Operator Dashboard / CMS `[DRAFT]`

An internal, login-protected CMS for the operator. Indonesian UI. The first and priority page is the
**Leads Report** (mockup: `docs/mockups/cms.png`) — real-time KPIs for today plus a 14-day table.
The sidebar lists future pages (Leads, Purchase, Active, WA Logs, Program, Laporan, Pengaturan); only
the Leads Report is in the initial scope (slices D1–D3, plus the D3.1 UX-polish pass in §20.8). This
module is **additive** — it must not change the buyer-facing flow or any §1–§14 invariant.

### 20.1 Actors & scope
- **Operator** (you / staff): logs in, reads metrics, (later) lists orders, resends, manages users.
- **No buyer access.** The dashboard lives under `/admin/*` and is never linked from the storefront.

### 20.2 Decisions (resolved 2026-06-05)
- **Lead** = every checkout submission = an `Order` row (any status). **Purchase** = `Order.status = PAID`.
  No new "lead" table; metrics are computed from existing `Order` / `Delivery` data.
- **Active** and **Conv. Rate Active** = participants in the **challenge program** (§21). As of **0.14.0
  (D6, 2026-06-22)** these are **LIVE**: Active = current `RUNNING` `ChallengeParticipant` count,
  Conv. Rate Active = Active ÷ cumulative PAID orders (program-scoped), shown as a **live snapshot** on
  the real-time KPI cards. The **14-day series table also fills these columns** (2026-06-22) as a per-day
  **event count** (`getActiveSeries` — bucketed on each participant's `startAt`, like Leads/Purchase), not "—". §20.4.
- **Program** (the sidebar page **and** the Leads Report dropdown) = the **sellable-e-book
  configuration** (slice D10, §20.11) — a different concept from the challenge. As of **0.8.0** the
  dropdown is **live**: it filters the report by program/product. Before D10 it was a disabled `Diet90`
  placeholder and the system was single-product.
- **Auth** = multi-user **username + password** with DB-backed sessions (`AdminUser` + `Session`).

### 20.3 Authentication & sessions (slice D1)
- **Passwords:** hashed with **scrypt via `node:crypto`** (no new dependency). Stored as
  `scrypt$<saltHex>$<hashHex>`. Verify with a constant-time compare (`crypto.timingSafeEqual`).
  Passwords are never logged and never returned by any API.
- **Sessions:** on login, generate a 32-byte random token (`crypto.randomBytes`). Set it in an
  **HTTP-only, Secure, SameSite=Lax** cookie named `admin_session`. Store only `sha256(token)` in the
  `Session` table with a `userId` and `expiresAt` (default **7 days**). On each request, hash the
  cookie token and look it up; reject if missing/expired. Logout deletes the row and clears the cookie.
- **Gate:** `src/proxy.ts` (Next 16 renamed middleware→proxy; export the fn as `proxy`) guards **only
  the `/admin/*` UI pages** — no session cookie ⇒ redirect to `/admin/login`. It does **not** gate
  `/api/admin/*`; each API route self-authenticates with the shared **`requireAdmin(req)`** helper
  (`src/lib/auth.ts`), which accepts **either** a valid session cookie **or** the `ADMIN_TOKEN` bearer.
  This keeps machine/curl/cron callers (bearer) and the dashboard (cookie) both working. (Gating
  `/api/admin/*` in the proxy on the cookie alone previously 401'd bearer callers — see changelog 0.7.2.)
- **First account:** `npm run admin:create` (`scripts/create-admin.mjs`) prompts for username + name +
  password (or reads env), hashes, and inserts an `AdminUser`. **No default password is ever committed.**
- **Login hardening:** generic error on bad credentials (don't reveal which field); basic rate-limit /
  small delay on repeated failures.

### 20.4 Metric definitions (slice D2 — be exact)
All date bucketing is in **Asia/Jakarta (WIB, UTC+7)**. A *period* is an inclusive date range
`[from, to]`. The dashboard shows two things: a **today (real-time)** summary and a **14-day series**
(default: the 14 days ending **yesterday**). Per day `d`:

| Metric | Definition |
|---|---|
| **Leads** | `count(Order)` where `Order.createdAt` falls on `d` |
| **Purchase** | `count(Order)` where `status = PAID` and `paidAt` falls on `d` |
| **Conversion Rate** | `Purchase / Leads` (→ `0%` when `Leads = 0`), shown as a percentage |
| **Revenue** | `sum(amountIdr)` where `status = PAID` and `paidAt` falls on `d` (IDR integer) |
| **Total WA** | `Sukses + Failed` |
| **Sukses** | `count(Delivery)` where `status = SENT` and `sentAt` falls on `d` |
| **Failed** | `count(Delivery)` where `status = FAILED` and `updatedAt` falls on `d` (terminal failures) |
| **Active** | **Real-time KPI card** = live snapshot (D6): `count(ChallengeParticipant)` with `status = RUNNING` (scoped via the participant's challenge → product when `programId` is set). **14-day series column** (2026-06-22) = a **per-day event count** (`getActiveSeries`), bucketed exactly like Leads/Purchase: a participant is counted on the single WIB day they *became* active — `date(startAt)` (initial proof received = challenge day 1). A day shows a number only when a new participant entered Active; it is **not** a running cumulative total. |
| **Conv. Rate Active** | `Active / Purchase`, `→ 0%` when the denominator is 0. The KPI card uses the live snapshot (current `RUNNING` ÷ all-time PAID orders); the **14-day column uses the same-day** active ÷ purchase (mirroring Conv. Rate = purchase ÷ leads). |

> **Active / Conv. Rate Active: live snapshot on the KPI card, per-day event in the series.**
> A participant's `RUNNING` status is current state, so the "Ringkasan Hari Ini (Real Time)" cards show a
> single current number (`ReportData.snapshot`). The 14-day table instead records Active as a **per-day
> event**, just like Leads and Purchase: `getActiveSeries` buckets each participant on the WIB day of their
> `startAt` (when they became active), so a row is non-zero only when a new participant entered Active that
> day — most days are 0. Per-day Conv. Rate Active = that day's active ÷ that day's purchases. The pure
> `bucketActiveByDay()` is unit-tested; the TOTAL footer row keeps "—" for both columns. Snapshot wired in
> D6 (2026-06-22, resolves open Q#15); series columns filled 2026-06-22 (event-bucketed per owner).

- The aggregation logic lives in **pure functions in `src/lib/report.ts`** so it is unit-testable with
  fixtures (cover zero-division, empty days, and WIB day-boundary cases) without a live DB.
- v1 uses live grouped queries (`GROUP BY date`); volume is low. A daily rollup table is a future
  optimization, not needed now.
- **Program filter (D10):** every metric optionally scopes to a single program by threading a
  `productId` into the `Order` (and, via `Order`, `Delivery`) `where` clauses. Omitted ⇒ all programs.
  The pure `report.ts` helpers take an optional `productId` arg; the API exposes it as `?programId=`.
- **WA accuracy caveat:** only the `Delivery` row is timestamped, not each retry attempt, so "Total WA"
  counts deliveries by terminal state, not raw send attempts. Accurate per-attempt logs arrive with the
  `DeliveryAttempt` table in slice D5 (WA Logs) — see §16 Q10.

### 20.5 Routes & API
**UI (App Router):**
- `GET /admin/login` — login form.
- `GET /admin` — Leads Report (cards + 14-day table + filter bar). Auth-gated.
- `GET /admin/wa-logs` — WA Logs (outbound send audit + filters + Resend). Auth-gated. §20.13.
- `GET /admin/leads` — Leads list (every checkout submission, any status; filters + Detail/Resend). Auth-gated. §20.14.
- *(later)* `/admin/purchases`, `/admin/reports`.

**API:**
- `POST /api/admin/auth/login` — body `{ username, password }` → sets `admin_session` cookie; `200`/`401`.
- `POST /api/admin/auth/logout` — clears cookie + deletes session; `200`.
- `GET /api/admin/report?from=YYYY-MM-DD&to=YYYY-MM-DD[&programId=<productId>]` — `requireAdmin`
  (cookie or bearer). Range capped at **366 days** (`400` otherwise). `programId` (optional) scopes
  every metric to one program/product; omitted ⇒ all programs. Returns:
  ```json
  {
    "today": { "date": "2026-06-01", "leads": 250, "purchase": 38, "convRate": 0.152,
               "revenue": 3800000, "active": 0, "convRateActive": 0,
               "totalWa": 40, "sukses": 38, "failed": 2 },
    "series": [ { "date": "2026-05-19", "leads": 0, "purchase": 0, "convRate": 0, "revenue": 0,
                  "active": 0, "convRateActive": 0, "totalWa": 0, "sukses": 0, "failed": 0 } ],
    "snapshot": { "active": 21, "purchases": 120, "convRateActive": 0.175 }
  }
  ```
  `snapshot` = live challenge state (D6, §20.4): `active` = current `RUNNING` participants, `purchases`
  = cumulative PAID orders in scope, `convRateActive` = `active / purchases`. The per-day `active` /
  `convRateActive` fields stay `0` (not day-bucketed).
- **Program management (D10, all `requireAdmin`):**
  - `GET /api/admin/programs` — list every program/product with sales window + computed sale status.
  - `POST /api/admin/programs` — `multipart/form-data`: `name`, `programName`, `slug`, `priceIdr`,
    `description?`, `salesStartAt?`, `salesEndAt?`, a required e-book PDF `file`, and zero or more
    `attachments` PDFs. Saves the PDFs privately and creates the `Product` (+`ProductAttachment` rows).
    `409` on duplicate slug, `422` on invalid input / non-PDF / oversized.
  - `PATCH /api/admin/programs/{id}` — update any field above, optionally **replace** the e-book PDF,
    and **add** attachments (multipart). Same validation. Toggling `isActive` is allowed here.
  - `POST /api/admin/programs/{id}/attachments` — multipart, one or more PDFs → new `ProductAttachment` rows.
  - `DELETE /api/admin/programs/{id}/attachments/{attachmentId}` — remove an attachment (unlink its file).
  - `DELETE /api/admin/programs/{id}` — only when the program has **zero orders** (else `409` — tell
    the operator to deactivate instead, preserving the order/audit history).
- **User management (D6, all `requireAdmin`, §20.15):**
  - `GET /api/admin/users` — list accounts (no `passwordHash`) + the caller's own `currentUserId`.
  - `POST /api/admin/users` — create `{ username, name, password }`; `409` on duplicate username.
  - `PATCH /api/admin/users/{id}` — partial `{ name?, password?, isActive? }` (rename / reset / (de)activate;
    `422` when deactivating yourself or the last active admin).
- Existing `GET /api/admin/orders` and `POST /api/admin/deliveries/{id}/resend` stay (now also accept
  session auth, not only the bearer token).

### 20.6 Acceptance criteria
**D1 — Auth & session**
- [ ] `AdminUser` + `Session` migrated; `admin:create` makes a working account.
- [ ] Correct credentials log in and set an HTTP-only cookie; wrong credentials get a generic `401`.
- [ ] `/admin` is unreachable when logged out (redirect to `/admin/login`); `/api/admin/*` returns `401`.
- [ ] Logout invalidates the session (cookie cleared, row deleted; reuse of the old token fails).
- [ ] Passwords are scrypt-hashed (constant-time verify) and never logged or returned. Tests: hash/verify, session create/validate/expire.

**D2 — Report metrics API**
- [ ] `GET /api/admin/report` returns the `today` + `series` shape above for a valid range; auth-gated.
- [ ] Metric math matches §20.4 exactly, including WIB bucketing and `0%` on zero leads. Tests: pure
      functions in `report.ts` with fixtures.

**D3 — Dashboard UI**
- [ ] `/admin` renders the six KPI cards and the 14-day table from `/api/admin/report`, matching the
      mockup layout; the date-range + (placeholder) Program filter drive the query; Reset restores defaults.
- [ ] **Active**, **Conv. Rate Active**, and **Program** are visibly present but clearly stubbed
      (`0` / `—`) pending the Challenge module — no fabricated numbers.
- [ ] Loading and empty states are handled; no secrets reach the client.

**D3.1 — Dashboard UX polish + DataTable** (see §20.8)
- [ ] KPI cards restyled: icon/accent per card, clear label + value + sub-label, consistent spacing.
- [ ] The 14-day table renders via a reusable `DataTable` (TanStack Table); clicking a column header
      cycles sort asc → desc → none; a numeric/date column sorts correctly (not lexicographically).
- [ ] A global search box filters rows across columns; pagination with a page-size selector works.
- [ ] **Export CSV** and **Export PDF** download the *current* (searched/sorted) view.
- [ ] Active / Conv. Rate Active / Program remain stubbed (`—`); the totals row still reflects the data.
- [ ] Build green, tests green, `tsc --noEmit` clean; lockfile committed with the 3 new deps.

### 20.7 Security & invariants
- All §13 invariants still hold. Dashboard adds: passwords scrypt-hashed and never logged; sessions in
  HTTP-only/Secure cookies; every `/admin/*` page and `/api/admin/*` route is auth-gated; the dashboard
  reads aggregates only and exposes no e-book file, server key, or WAHA key to the browser; all query
  params validated with Zod.

### 20.8 Dashboard UX polish + DataTable (slice D3.1)
The initial D3 dashboard is functionally complete but visually plain. D3.1 makes it lovable without
adding any new data or endpoint — it is a **pure front-end** enhancement of `/admin`.

**Decision (2026-06-05):** use **TanStack Table** (`@tanstack/react-table`, headless) for table
behavior — it is the idiomatic React choice (the jQuery DataTables plugin was rejected as it fights
React's render model). Export uses **`jspdf` + `jspdf-autotable`** for PDF and a native `Blob` for CSV.
All three are client-only and tree-shaken into the dashboard bundle; they never touch the buyer flow.

**KPI widgets.** Restyle the six cards: each gets a small icon, an accent color, the metric value, and
a sub-label. Keep the today/real-time framing. Stubbed cards (Active, Conv. Rate Active) stay visibly
greyed/`—`. No layout regressions vs. the mockup (`docs/mockups/cms.png`).

**Reusable `DataTable` component** (`src/components/admin/DataTable.tsx`), generic over row type:
- **Sortable columns** — click header to cycle asc → desc → none; columns declare their type so dates
  and numbers sort by value, not string. Revenue/percent columns render formatted but sort by raw value.
- **Global search** — a single input filtering across all columns (TanStack `globalFilter`).
- **Pagination** — page controls + a page-size selector (e.g. 10 / 20 / 50; default 20).
- **CSV export** — serialize the current filtered/sorted rows to CSV via a `Blob` download.
- **PDF export** — render the current view to a PDF via `jspdf-autotable` (title + date range + table).
- Props: `columns` (key, header label, accessor, type, optional formatter, sortable flag), `rows`,
  `searchable`, `pageSize`, and optional `exportFileName` + `exportTitle`.

**Applied to the Leads Report.** The 14-day series renders through `DataTable`; the TOTAL row stays
(rendered outside the paginated body, e.g. a table footer, so it isn't sorted/paged away). The KPI
cards and filter bar from D3 are unchanged in behavior.

**Responsive shell (0.7.6).** `DashboardShell` (`src/components/admin/DashboardShell.tsx`, client) owns
the responsive frame + all sidebar CSS. Desktop: fixed 232px sidebar + content. ≤768px: sidebar becomes
an off-canvas drawer (sticky top bar + hamburger + dismiss overlay); `Sidebar` takes `open`/`onNavigate`
(nav clicks close the drawer). Tables scroll horizontally; KPI cards wrap; the login card is fluid.

**Out of scope for D3.1:** server-side pagination (volume is low — all client-side), column show/hide,
saved views. The broader cross-dataset **Laporan** export page remains **D7**.

### 20.9 CORS domain allowlist (slice D8)
External landing pages hosted on **other domains** must be able to POST to `/api/checkout` from the
visitor's browser. Browsers block cross-origin reads unless the server returns a matching
`Access-Control-Allow-Origin`, so the operator manages an allowlist of origins.

**Data:** `AllowedOrigin` (§9) — `origin` (normalized `scheme://host[:port]`, unique), `label`, `isActive`.

**Enforcement (`src/lib/cors.ts`, applied in `/api/checkout`):**
- `normalizeOrigin()` parses/normalizes an origin (http/https only; lowercased host; strips path/query/
  trailing slash); invalid input → rejected at the admin API.
- `/api/checkout` exports an **`OPTIONS`** preflight handler and echoes
  `Access-Control-Allow-Origin: <origin>` (+ `Methods`/`Headers`/`Max-Age`/`Vary: Origin`) **only** when
  the request `Origin` is the app's own origin **or** an active `AllowedOrigin`. Checked **live** against
  the DB on each request (no restart). A non-whitelisted cross-origin browser request gets no CORS
  headers (preflight → `403`), so the browser blocks it.
- **Same-origin / server-side callers** (no `Origin` header) are unaffected — this is purely about
  cross-origin **browser** access. Note: CORS is not an anti-abuse control (non-browser clients ignore
  it); `/api/checkout` remains public by design.

**Admin API (all `requireAdmin`):** `GET /api/admin/origins` (list), `POST /api/admin/origins`
(`{ origin, label? }` → normalize + create; `409` if duplicate, `422` if invalid),
`PATCH /api/admin/origins/{id}` (`{ isActive }` toggle), `DELETE /api/admin/origins/{id}`.

**UI:** the **Pengaturan** page (`/admin/(dashboard)/settings`) lists origins with add / activate-toggle /
delete (`src/components/admin/OriginManager.tsx`). The sidebar's Pengaturan item is now enabled.

**Landing-page integration:** POST JSON `{ productSlug, name, email, whatsapp, trackingId? }` to
`https://<app>/api/checkout`; on `200` redirect to `redirectUrl` (or open Snap with `snapToken`). The
landing page's origin must be on the allowlist for a browser POST to succeed.

### 20.10 Checkout rate limit (slice D9)
Throttles `/api/checkout` per client IP to curb spam, **configurable and fully disableable** by the
operator (since legitimate campaigns may burst).

**Data:** `RateLimitConfig` (§9) — a singleton row (`id = "default"`): `enabled`, `maxRequests`,
`windowSeconds`. Seeded by its migration (default 10 req / 60 s, enabled).

**Enforcement (`src/lib/rate-limit.ts`, applied in `/api/checkout` after CORS, before body parse):**
- Fixed-window, **per-IP**, in an **in-memory** Map (`evaluateBucket` is a pure, unit-tested core).
  Client IP comes from `X-Forwarded-For` (Caddy) via `clientIpFromHeaders`.
- Config is read from the DB and **cached 10 s** (`getRateLimitConfig`); the admin `PUT` clears the
  cache so changes apply immediately. `enabled = false` short-circuits → always allowed.
- Over the limit → `429` with a `Retry-After` header (CORS headers still attached).
- **Note/limitation:** the counter is in-memory, so it is per-container and resets on restart (fine for
  the single-container deploy). A shared store (e.g. Redis) would be needed if scaled to >1 instance.

**Admin API (`requireAdmin`):** `GET /api/admin/rate-limit` (current config),
`PUT /api/admin/rate-limit` (`{ enabled, maxRequests (1–10000), windowSeconds (1–3600) }`).

**UI:** the **Pengaturan** page gains a Rate Limit card (`RateLimitSettings.tsx`) — enable toggle +
max requests + window, with a Save button.

### 20.11 Program management (slice D10)
A login-gated page to **configure the sellable e-books** ("programs"). Each program is a `Product`
row (the system stays catalog-capable) extended with a **program label** and a **sales window**.
This is the real meaning of the **Program** sidebar item and the Leads Report dropdown — it is **not**
the deferred Challenge module (Active / Conv. Rate Active stay stubbed, §20.2).

**Data (`Product`, §9 — three new nullable columns, no breaking change):**
- `programName String?` — operator-facing program label (e.g. `Diet90`). Distinct from `name` (the
  e-book/product title shown to the buyer).
- `salesStartAt DateTime?` / `salesEndAt DateTime?` — the **sales period**. The operator picks dates;
  the API stores `salesStartAt` = **WIB 00:00:00** of the start date and `salesEndAt` = **WIB 23:59:59.999**
  of the end date (inclusive). `null` = unbounded on that side. Existing seeded products (both null)
  remain always-on-sale.

**Data (`ProductAttachment`, §9 — new model):** zero or more **extra private PDFs** per program,
delivered to the buyer **together with the main e-book** after purchase (e.g. the weight-loss program's
separate *to-do-list* PDF). `productId`, `filePath` (private, like the e-book), `fileName` (buyer-facing),
`sortOrder`. Stored in `EBOOK_FILES_DIR` exactly like the e-book — same privacy rules (invariant #4).

**Sales-window enforcement (`src/lib/programs.ts` — pure, unit-tested):**
- `isOnSale(product, now)` ⇒ `true` iff `isActive` **and** `now ≥ salesStartAt` (or null) **and**
  `now ≤ salesEndAt` (or null). `salesStatus(product, now)` ⇒ `'inactive' | 'scheduled' | 'open' |
  'closed'` for display.
- **When the period has ended (or not yet started), the e-book can no longer be bought:**
  - `src/app/[slug]/page.tsx` — if `!isOnSale`, render a "penjualan ditutup / belum dibuka" notice
    **instead of** the checkout form (the page still 200s; only inactive→404 as before).
  - `src/app/api/checkout/route.ts` — re-check `isOnSale` server-side after resolving the product;
    if closed, reject with **`403`** (`{ error: "Penjualan untuk produk ini sedang ditutup." }`) and
    do **not** create an order. CORS headers still attached. This is the authoritative gate (the page
    notice is just UX).

**PDF upload (`src/lib/files.ts`, extended):**
- Add/edit accepts PDFs via `multipart/form-data` (the **main e-book** + any number of **attachments**).
  `saveUploadedPdf()` validates **content-type = `application/pdf`** *and* the **`%PDF-` magic bytes**,
  and enforces a **max size of 32 MB per PDF** (`MAX_UPLOAD_BYTES`). Reject otherwise with `422`.
  **Note:** base64 inflates ~33%, so a 32 MB PDF ≈ ~43 MB to WAHA — confirm the provider's body-size
  limit allows it (§16 Q5), and Caddy must allow the upload (`request_body { max_size 40MB }`, §18).
- Each file is written into **`EBOOK_FILES_DIR`** under a generated, traversal-safe name (`<cuid>.pdf`)
  — **never under `public/`, never served statically, never handed to WAHA as a URL** (invariant #4 / #5).
  Write to a temp file then `rename` so a partial upload never becomes the live file. `Product.filePath`
  stores the e-book's relative name; `Product.fileName` is the buyer-facing name (defaults from the
  uploaded filename, editable). Each attachment becomes a `ProductAttachment` row the same way.
- On **edit with a replacement e-book PDF**, write the new file first, repoint `filePath`, then
  best-effort unlink the old one. **Removing an attachment** deletes its row and best-effort unlinks the
  file. Adding attachments creates new rows.

**Delivery of e-book + attachments (extends F4/F5 — multi-file, still exactly-once):**
- When an order reaches **PAID** and its `Delivery` is created, **snapshot** the buyer's entitlement
  into one **`DeliveryItem` per file**: `kind="ebook"` (sortOrder 0, from `Product.filePath/fileName`)
  plus one `kind="attachment"` per `ProductAttachment` (by `sortOrder`). Snapshotting at purchase means
  later attachment edits never change what an already-paid buyer is owed.
- `attemptDelivery` claims the `Delivery` (`PENDING/FAILED → PROCESSING`, as today), then sends **each
  `DeliveryItem` that is not yet `SENT`**, in `sortOrder` (e-book first). Each successful WAHA `sendFile`
  marks that item `SENT`+`sentAt`; a failure marks the item `FAILED` and records `lastError`. The
  `Delivery` becomes `SENT` (+`sentAt`) **only when all items are `SENT`**; otherwise it goes back to
  `FAILED` with the usual backoff and retries. **A retry re-sends only the not-yet-`SENT` items**, so no
  file is ever delivered twice (invariant #3 now reads per-file). The e-book message carries the friendly
  caption; attachments carry a short caption.
- WA metrics (§20.4) still count by `Delivery` terminal state (one delivery = one buyer), not per item.

**UI (`src/app/admin/(dashboard)/program/page.tsx` + `src/components/admin/ProgramManager.tsx`):**
- Lists programs in the reusable **`DataTable`** (TanStack), styled like the Leads Report:
  columns **id**, **product name** (`name`), **program name** (`programName`), **period**
  (`salesStartAt – salesEndAt`, WIB; "—" when unbounded), **price** (IDR), **status**
  (`salesStatus` badge: open / scheduled / closed / inactive), and **Aksi** (Edit). Sort/search/
  paginate + CSV/PDF export come for free from `DataTable`.
- An **"Tambah Program"** button opens a form **(modal/drawer overlaying the page)** with: program name, product (buyer)
  name, slug, price (IDR integer), optional description, sales start/end dates, a **main e-book PDF
  picker**, and an **Attachments** section — a multi-file PDF picker plus a list of the chosen/existing
  attachments each with a **remove (×)** control. **Edit** opens the same form pre-filled; the e-book
  PDF is optional on edit (keep existing if none chosen), existing attachments are listed with remove,
  and new ones can be added. Client validates required fields; the server is authoritative.
- Sidebar: the **Program** item becomes `ready: true` (route `/admin/program`, icon `🎯`) — the
  "soon" badge is removed.

**Leads Report Program dropdown goes live:**
- `LeadsReport.tsx` fetches `GET /api/admin/programs` to populate the dropdown (plus an "All
  programs / Semua program" option). Selecting one passes `&programId=<productId>` to
  `/api/admin/report`; the cards, table, and totals all reflect that program. "Semua program"
  clears the filter. Reset restores all-programs + default dates.
- `report.ts` helpers (`getDayMetrics`, `getReport`) take an optional `productId` and thread it into
  the `Order`/`Delivery` `where` clauses (§20.4).

**Forward link to the Challenge module (§15):** a "program" (this `Product` + window + attachments) is
the entity the **future Challenge** will reference — a `Contest`/challenge will point at a `programId`
(`productId`) and gate entry on a `PAID` `Order` for it. Keep `Product`/`ProductAttachment` clean and
queryable by `productId`; do **not** build the challenge now (Active / Conv. Rate Active stay stubbed).

**Acceptance criteria (D10):**
- [ ] `Product` migrated with `programName` / `salesStartAt` / `salesEndAt` (existing rows unaffected,
      always-on-sale). `lib/programs.ts` `isOnSale` / `salesStatus` unit-tested incl. WIB boundaries,
      null bounds, scheduled/closed/inactive cases.
- [ ] `/admin/program` lists programs in a `DataTable`; **Add** uploads a PDF and creates a program;
      **Edit** updates fields and optionally replaces the PDF. Inputs validated (Zod); non-PDF /
      oversized rejected `422`; duplicate slug `409`.
- [ ] Uploaded PDFs (e-book + attachments) land in `EBOOK_FILES_DIR` (never `public/`), traversal-safe
      names, atomic write.
- [ ] **Attachments:** a program can be created with N attachment PDFs; editing can add and remove them
      (removed files unlinked). On purchase, the buyer receives the **e-book + every attachment** over
      WhatsApp; `DeliveryItem` rows are snapshotted at PAID; a retry re-sends **only** the items not yet
      `SENT` (no file delivered twice). `Delivery` is `SENT` only when all items are `SENT`. Tests cover
      the multi-file claim/partial-failure/retry path.
- [ ] **After `salesEndAt`, the product cannot be bought:** the landing page hides the form and
      `/api/checkout` returns `403` without creating an order. Before `salesStartAt` behaves the same.
- [ ] The Leads Report **Program** dropdown is live and filters every metric (cards + table + totals)
      by the selected program; "Semua program" shows all. Active / Conv. Rate Active remain stubbed.
- [ ] `DELETE` refuses a program with orders (`409`); deactivation is the supported path. Build green,
      tests green, `tsc --noEmit` clean; migration + any lockfile change committed.

### 20.12 Dashboard UI consistency — shared Card system `[STABLE]`
The dashboard must look **consistent and aesthetic across every menu**. Cards on a page must be the
**same size** (width, padding, corner radius, shadow) regardless of their content — no per-component
ad-hoc card `<div>`s with their own widths (that produced the uneven Pengaturan cards this section fixes).

**Primitives (`src/components/admin/Card.tsx`) — use these everywhere:**
- **`Card`** — the one content-card shell: white background, `1px #e7ebf0` border, `12px` radius, a
  subtle shadow, and uniform padding (`1.15rem 1.35rem`). Optional header (`title` + `description` +
  `headerRight`) with a hairline divider above the body; `noBodyPadding` for full-bleed tables.
- **`CardStack`** — vertical stack with a consistent gap, constrained to **`CONTENT_MAX_WIDTH`** (single
  source of truth for page width) so all cards in it are identical width.
- **`PageHeader`** — the standard page title + subtitle (+ optional right slot) at the top of every page.
- The reusable **`DataTable`** shares the same shell styling (border/radius/shadow) so tables and cards
  match.

**Rules (apply to all current and future menus):**
1. Compose pages from `PageHeader` + `CardStack` + `Card` (and `DataTable` for tabular data). Do **not**
   hand-roll card containers or set per-card `maxWidth`.
2. Page width comes only from `CONTENT_MAX_WIDTH`; change it in one place if it ever needs to move.
3. Keep the existing responsive shell (§20.8, ≤768px drawer); cards are fluid within the content column.
4. KPI stat tiles (`KpiCard`) are a separate, intentionally smaller widget and are exempt from the
   content-card shell — but they stay uniform with each other.

Applied so far: **Pengaturan** (CORS + rate-limit cards now identical), **Program**, **Leads Report**.

---

### 20.13 WA Logs (slice D5) `[STABLE]`
A login-gated **WA Logs** page (`/admin/wa-logs`, sidebar 💬) — an operator audit trail of every
**outbound** WhatsApp send, so failures are visible and retriable in one place.

**Scope (decided 2026-06-22 — see open Q#10):**
- **In:** e-book + attachment **deliveries** (the transactional `sendFile` on PAID) and challenge
  **reminders** (`sendTextHumanized`), including the instant `after_purchase` message and the
  `proof_received` auto-ack. Categories: `ebook` · `attachment` · `reminder`.
- **Out:** inbound proof videos (already in `ChallengeSubmission` / the Active menu) and the operator
  **test-send** (`/api/admin/whatsapp/test`) — intentionally not logged.

**Data model — `WaMessageLog` (new table, §9):** an **immutable, FK-decoupled** audit row per send
(plain id columns, no foreign keys, so the log survives a delivery/participant delete). Fields:
`category`, `status` (`WaLogStatus` = `SENT|FAILED`), `chatId`, `toPhone`, `templateKey`, `fileName`,
`bodyPreview` (truncated caption/text), `wahaMessageId`, `error`, `orderId`, `deliveryId`,
`deliveryItemId`, `participantId`, `productId`, `createdAt`. Indexed on `createdAt`, `(category,status)`,
`productId`.

**Writing — `lib/wa-log.ts` `logWaSend(...)`, best-effort:** every write is wrapped so a logging
failure is swallowed (console-only) — **logging must never block or fail a send** (invariants #3/#14
are unaffected). Call sites:
- `lib/delivery.ts` — one log per `DeliveryItem` send, on success (`SENT`) and failure (`FAILED`).
- `lib/challenge-reminders.ts` `sendChallengeReminderOnce` — one log per reminder (covers cron +
  webhook `after_purchase` + `proof_received`); `productId` threaded from the call sites.
Pure helpers `buildPreview` (whitespace-collapse + truncate) and `phoneFromChatId` are unit-tested.

**API — `GET /api/admin/wa-logs`** (`requireAdmin`; cookie or bearer). Query filters: `status`,
`category`, `programId` (→ `productId`), `from`/`to` (`YYYY-MM-DD`, WIB-inclusive bounds), `q` (matches
`toPhone`/`chatId`/`wahaMessageId`/`fileName`/`templateKey`). Newest first, capped at 2000 rows
(the table paginates/searches client-side). Delivery rows are enriched with their `orderCode` via a
batched lookup.

**UI — `components/admin/WaLogs.tsx`:** `PageHeader` + a filter row (program / status / category /
date-from / date-to) + the shared `DataTable` (sortable, searchable, paginated; CSV + PDF export).
Columns: Waktu · Tujuan · Kategori · Status (badge) · Detail (file/template + body preview) · Order ·
Msg ID · Error · Aksi. **Resend** appears only on `FAILED` **delivery** rows (those carry a
`deliveryId`) and reuses `POST /api/admin/deliveries/{id}/resend`, then reloads.

**Backfill:** `npm run wa-logs:backfill` (`scripts/backfill-wa-logs.mjs`) seeds the table from existing
`DeliveryItem` (SENT/FAILED) + `ChallengeReminderLog`. Idempotent (skips rows already represented).
Records only the **final** per-row state that predated the table (pre-D5 retries weren't timestamped).

**Deploy:** run migration `20260622000000_add_wa_message_log`, then optionally `wa-logs:backfill`.

---

### 20.14 Leads list (slice D4 — Leads half) `[STABLE]`
A login-gated **Leads** page (`/admin/leads`, sidebar 👥) — a browsable log of **every checkout
submission**. Per §20.2, a **Lead = any `Order`, any status** (the Leads Report cards already count
leads; this is the row-level list behind them).

**Scope (decided 2026-06-22):** shows **all** orders (PENDING/PAID/FAILED/EXPIRED/CANCELLED/REFUNDED) —
the page has a status filter, and the separate **Purchase** menu (PAID-only) stays a later slice.
**No schema change** — reads the existing `Order` + `Customer` + `Delivery`. PII (email/WhatsApp) is
shown in **full** (operators need the real number to follow up a lead).

**API — `GET /api/admin/leads`** (`requireAdmin`; cookie or bearer). Filters: `status` (an `OrderStatus`),
`programId` (→ `productId`), `from`/`to` (`YYYY-MM-DD`, WIB-inclusive bounds), `q` (matches order code,
tracking id, customer name/email/WhatsApp). Newest first, capped at 5000 rows (table paginates/searches
client-side). Each row carries the order + customer + delivery summary (incl. `deliveryId` for Resend).

**UI — `components/admin/LeadsList.tsx`:** `PageHeader` + a filter row (program / status / date-from /
date-to) + the shared `DataTable` (sortable, searchable, paginated; CSV + PDF export). Columns: Waktu ·
Nama · WhatsApp · Email · Program/Produk · Jumlah (IDR) · Status (badge) · Tracking · Pengiriman ·
Aksi. A **Detail** modal shows the full order + delivery state; for an order that has a `Delivery` it
offers a **Resend** (with an optional corrected WhatsApp number) via `POST /api/admin/deliveries/{id}/resend`.

**Pure helpers — `lib/leads.ts`:** `formatIdr` (IDR integer formatting, invariant #8) and `leadStatusMeta`
(status → Indonesian label + badge tone), unit-tested, shared by the export and the UI.

**Deploy:** none beyond the standard image rebuild — no migration, env, cron, or volume.

### 20.15 User management (slice D6) `[STABLE]`
Admin-account management so the operator can grow/curate the dashboard's login accounts without the
`npm run admin:create` CLI. Lives as a **Pengguna (Admin)** card inside **Pengaturan** (`/admin/settings`,
below CORS + Rate Limit) — not a new sidebar item. **No schema change** — the existing `AdminUser`
(`username` unique, `name`, `passwordHash`, `isActive`, `lastLoginAt`) already covers it.

**Actions:** **Add** (username + name + password) · **Rename** · **Reset password** · **Activate /
Deactivate**. There is **no hard delete** (deactivate instead — preserves session/audit history and any
FK). Deactivating an account also **revokes its sessions** (`Session` rows deleted → forced logout).

**APIs** (all `requireAdmin`, cookie or bearer):
- `GET /api/admin/users` — list (`id`, `username`, `name`, `isActive`, `lastLoginAt`, `createdAt`) +
  the caller's own `currentUserId` (so the UI can disable self-deactivation). **Never returns `passwordHash`.**
- `POST /api/admin/users` — create `{ username, name, password }`. `username` unique → `409` on collision.
- `PATCH /api/admin/users/{id}` — partial `{ name?, password?, isActive? }` (rename / reset / (de)activate).

**Guards (anti-lockout):** a user may **not deactivate themselves**, and the **last active admin** may
not be deactivated (`422`). Passwords are scrypt-hashed via `lib/password.ts` and **never** sent to the
client or logged. New helper `currentAdminUser(req)` in `lib/auth.ts` resolves the cookie session's
`AdminUser` (bearer/machine callers resolve to `null` — no self-guard needed, they can act on anyone).

**Pure helpers — `lib/admin-users.ts`:** `createUserSchema` / `updateUserSchema` (zod: username
3–32 chars `[a-zA-Z0-9._-]`, name 1–80, password 8–200), `serializeAdminUser` (strips `passwordHash`),
and `deactivationBlock(target, currentUserId, activeCount)` → reason string | null. Unit-tested.

**UI — `components/admin/UserManager.tsx`:** a `Card` listing accounts (name · @username · status badge ·
last login) with inline **add** form and per-row **rename / reset password / (de)activate** controls; the
caller's own row and the last active admin have deactivation disabled.

**Deploy:** image rebuild only — no migration, env, cron, or volume.

> **D7 (Laporan export page) and the Purchase (PAID-only) page are intentionally NOT built** (owner,
> 2026-06-22): every table already exports CSV/PDF of its current view, and Leads' status filter (`Lunas`)
> covers the PAID-only need. Revisit only if the operator asks for a dedicated cross-metric export hub.

---

## 21. Challenge Module (slice D11) `[DRAFT]`

The reward challenge attached to a program. **Rules source of truth: `docs/challenge-rules.md`** (extracted
from the owner's `challenge-rules.docx`) — use its exact values/texts; the config UI is seeded with them.
This section is the build spec; where it and the rules doc agree, both hold; where this section adds
implementation detail (schema, statuses, APIs), this section governs.

### 21.1 Scope
**In D11 (build now):**
1. **Challenge Configuration** menu (`/admin/challenge`) — per-program config (timeline, video rules,
   rewards/winner tiers, WA templates + contact — all editable, seeded from the rules).
2. **User/Active** menu (`/admin/active`) — list + status of participants who have started; admin verifies
   proof videos and records weights; %-loss leaderboard.
3. **WAHA inbound capture** (`/api/webhooks/waha`) — receive proof videos, store them privately, attach to
   the participant.

**Deferred to D12 (do NOT build now):** the **outbound WhatsApp reminder automation** (the schedule +
templates in the rules doc §7/§8) and the **automatic phase/elimination cron** (auto-advance at day
30/60/90, auto-eliminate at H+15 / day 105). In D11, phase/overdue are **derived for display** and
status changes are **admin-driven** (plus the inbound webhook). The pre-start statuses (Pembelian,
Menunggu Bukti Awal, Gugur Awal) are a D12 concern — D11 surfaces a participant only once their initial
proof arrives.

### 21.2 Lifecycle (D11)
1. A customer completes a **PAID** order for a program whose `Challenge.isActive = true`.
2. They send their **initial proof** video to the business WhatsApp. WAHA forwards it to
   `/api/webhooks/waha`. The webhook matches the sender to a `Customer` → their eligible PAID `Order`,
   stores the video privately, and **creates a `ChallengeParticipant`** (status `PENDING_INITIAL_REVIEW`,
   `purchaseAt = order.paidAt`) with a `ChallengeSubmission(kind="initial")`. They now appear in User/Active.
3. The admin opens the row, **watches the video** (streamed from private storage), checks it against the
   rules (face + digital scale, full + timestamped, not AI/edited, within the 14-day window), enters the
   **initial weight (kg)**, and **accepts** → status `RUNNING`, `startAt = submission.receivedAt`
   (challenge day-1 per the rules). Or **rejects** (records `rejectedReason`; participant can resend).
4. While `RUNNING`, the participant's **current day** and **phase** are derived from `startAt` + today.
5. The **final proof** video arrives (same path) → a `ChallengeSubmission(kind="final")`, status
   `PENDING_FINAL_REVIEW`. Admin verifies, enters **final weight**, accepts → status `COMPLETED`,
   `finalWeightKg` set, `percentLoss` computed.
6. The admin may **drop** a participant at any time (status `DROPPED`, `dropReason` = `disqualified`
   for rule violations, or `eliminated_initial` / `eliminated_final` for missed deadlines — in D11 these
   are set manually; D12 automates the deadline ones).

### 21.3 Data model (see §9 for the exact Prisma)
- **`Challenge`** — 1:1 with `Product` (`productId @unique`, cascade delete). Config only. JSON fields:
  `phases` `[{ name, focus, startDay, endDay }]`, `winnerTiers` `[{ label, prize, count }]`,
  `messageTemplates` `{ triggerKey: text }` (for D12). Seeded from `docs/challenge-rules.md` defaults via
  `lib/challenge.ts` `defaultChallengeConfig()`.
- **`ChallengeParticipant`** — one per PAID `Order` (`orderId @unique`). Stores `status`, `purchaseAt`,
  `startAt`, `initialWeightKg`, `finalWeightKg`, `finalSubmittedAt`, `percentLoss`, `dropReason`, `notes`.
- **`ChallengeSubmission`** — one per inbound proof video (`kind` `"initial"|"final"`, `mediaPath`,
  `wahaMessageId @unique` for idempotency, `verifiedAt`, `rejectedReason`).

### 21.4 Status model & derived view (`src/lib/challenge.ts`, pure + unit-tested)
Stored `ParticipantStatus`: `PENDING_INITIAL_REVIEW`, `RUNNING`, `PENDING_FINAL_REVIEW`, `COMPLETED`,
`DROPPED`. Pure helpers (no DB):
- `dayOfChallenge(startAt, now)` → 1-based integer day (`null` if not started).
- `currentPhase(challenge, day)` → the phase object whose `[startDay, endDay]` contains `day`.
- `percentLoss(initialKg, finalKg)` → `(initial − final) / initial * 100` (rounded 2 dp; `null` if missing).
- `participantView(participant, challenge, now)` → `{ dayOfChallenge, phaseIndex, phaseName,
  displayStatus, group, percentLoss, finalOverdue }` where:
  - `group` ∈ `'active' | 'dropped' | 'completed' | 'pending'` — **active** = `RUNNING` or
    `PENDING_FINAL_REVIEW`; **dropped** = `DROPPED`; **completed** = `COMPLETED`; **pending** =
    `PENDING_INITIAL_REVIEW`.
  - `displayStatus` (Bahasa, maps to rules §8): `PENDING_INITIAL_REVIEW`→"Menunggu Verifikasi Bukti Awal";
    `RUNNING` with day≤30→"Challenge Berjalan — Fase 1", 31–60→"Fase 2", 61–90→"Fase 3", >90 (no final)→
    "Menunggu Bukti Akhir"; `PENDING_FINAL_REVIEW`→"Menunggu Verifikasi Bukti Akhir"; `COMPLETED`→"Selesai";
    `DROPPED`→"Gugur" (+ reason).
  - `finalOverdue` = `RUNNING` and `day > durationDays + finalProofWindowDays` (eligible for elimination;
    in D11 the admin acts on it — D12 automates).

### 21.5 Challenge Configuration menu (`/admin/challenge`, `ChallengeConfig.tsx`)
- A **program dropdown** (from `GET /api/admin/programs`). On select, `GET
  /api/admin/challenges/{productId}` returns that program's challenge config (or `404` → show "Buat
  challenge" with `defaultChallengeConfig()` pre-filled).
- A form (built from the §20.12 `Card`/`PageHeader` primitives) with **all** editable fields: enable
  toggle; timeline (start-window days, duration days, final-proof-window days, the 3 phases — name +
  focus + day range); video rules (max seconds, max size MB, format); rewards text + winner tiers
  (label/prize/count rows, add/remove); contact info; WA templates (a textarea per trigger key — stored
  for D12). **Save** → `PUT /api/admin/challenges/{productId}` (upsert by `productId`, `requireAdmin`,
  Zod-validated; JSON fields validated for shape).
- **Test-send (0.9.1):** the templates card has a **test recipient number** field and a **"Kirim tes"**
  button under each template; it substitutes `{{contact}}` → `contactInfo` and POSTs `{ whatsapp, text }`
  to `POST /api/admin/whatsapp/test` (`requireAdmin`), which normalizes the number and sends via
  `sendTextHumanized` (§12.2.1). Per-template status (Mengirim… / Terkirim ✓ / error).

### 21.6 WAHA inbound capture (`/api/webhooks/waha`)
- **Auth:** authenticate every call with `WAHA_WEBHOOK_SECRET` (provider's webhook auth — header/HMAC or
  a secret in the path; **exact mechanism is open question #14**, confirm with the provider). Reject
  unauthenticated calls `401`; always `200` quickly to valid ones so the provider doesn't retry-storm.
- **Idempotency:** dedupe on `wahaMessageId` (`@unique`) — a re-delivered event is a no-op.
- **WAHA contract (confirmed — https://waha.devlike.pro/docs):** subscribe the WAHA session to the
  **`message`** event (incoming only; not `message.any`). The POST body is
  `{ event:"message", session, payload, ... }`; the **`payload`** has `id` (WhatsApp message id),
  `from` (`"<digits>@c.us"`), `fromMe`, `body`, `timestamp`, `hasMedia`, and (when media was downloaded)
  **`media.url`** + `media.mimetype` (+ `media.filename` for documents). Ignore `payload.fromMe = true`.
- **Auth (HMAC, like the Midtrans pattern):** configure the WAHA webhook with `hmac.key =
  WAHA_WEBHOOK_SECRET`. Each call carries header **`X-Webhook-Hmac`** = `HMAC_SHA512(rawBody, secret)`
  hex (`X-Webhook-Hmac-Algorithm: sha512`). Verify it **constant-time over the raw body** (read
  `await req.text()` before parsing); reject mismatch `401`. (`X-Webhook-Request-Id` is the delivery id.)
- **Idempotency:** WAHA retries failed deliveries, so dedupe on **`payload.id`** stored as
  `ChallengeSubmission.wahaMessageId` (`@unique`); a duplicate is a no-op `200`.
- **Parse + match:** only process `hasMedia && media.mimetype` startsWith `"video/"`. Normalize
  `payload.from` → `Customer` by `whatsapp` → their eligible **PAID** `Order` for a program with
  `Challenge.isActive = true`. No match → log + `200` (ignore non-participants).
- **WhatsApp LID (privacy id) handling (added 0.11.2):** WhatsApp now often sends `payload.from` as a
  **`…@lid`** privacy identifier instead of `…@c.us`. A LID is **not** a phone number, so `parseJid()`
  classifies the sender and, for a LID, we resolve it via WAHA's **LIDs API** (`lib/waha.ts`
  `resolveLidToPhone` → `GET /api/{session}/lids/{lid}` → `{ lid, pn }`). If `pn` is non-null we match by
  phone as usual. If WAHA can't map it (`pn` null), we **fall back** to scanning candidate PAID buyers and
  comparing each one's `resolvePhoneToLid` (`GET /api/{session}/lids/pn/{number}`) to the inbound LID — the
  reliable direction for DMs. A non-`@c.us`/non-`@lid` sender (groups etc.) is ignored (`not-direct`). Both
  LIDs calls use `X-Api-Key` over https (invariant #5).
- **Media fetch + store:** GET `media.url` with header `X-Api-Key: WAHA_API_KEY` (the URL must be
  `https://` per invariant #5). Enforce a size cap (~`videoMaxSizeMb` + margin) and a `video/*` content
  type, then store under **`CHALLENGE_MEDIA_DIR`** with a generated traversal-safe name (reuse the
  `lib/files.ts` temp→rename pattern) — **private, never under `public/`, never served statically**
  (invariant #4 extends to proof videos). If `hasMedia` but no `media.url`, log (WAHA didn't download it).
- **Classify initial vs final by whether the challenge has started** (`participant.startAt`): not
  started → `kind="initial"` (so a re-sent initial proof after a rejection is still treated as initial);
  started (`RUNNING`) → `kind="final"` (status → `PENDING_FINAL_REVIEW`). Upsert the participant by
  `orderId` (no create race) and create the `ChallengeSubmission` idempotently (P2002 on `wahaMessageId`
  → no-op `200`). Always ack `200` fast.
- The webhook **never auto-verifies** — an admin always reviews (the rules require human judgment). It
  **does** auto-acknowledge receipt (added 0.11.3): after a video is stored it sends the editable
  `proof_received` template ("Menerima bukti video", before "Hari 1 (mulai)") via the humanized sequence
  (§12.2.1), idempotent per message (`ChallengeReminderLog` key `proof_received:<msgId>`), fire-and-forget,
  only when the video was actually stored, and skipped if the template is blank. No verdict is implied —
  it only confirms "received & under review".

### 21.7 User/Active menu (`/admin/active`, `ParticipantList.tsx`)
- A **program dropdown** + a **group filter** (Semua / Aktif / Selesai / Gugur / Menunggu verifikasi).
- A `DataTable` (§20.12 styling) of participants — since **D12 auto-creates on PAID**, this now includes
  pre-start buyers (`AWAITING_INITIAL` → "Menunggu Bukti Awal") as well as started ones — with
  columns: name, WhatsApp, **status** (`displayStatus` badge), **hari/fase** (derived), berat awal,
  berat akhir, **% turun** (sortable → leaderboard), tanggal mulai, aksi.
- Row actions (→ `PATCH /api/admin/participants/{id}`, `requireAdmin`):
  - **Lihat video** — opens `GET /api/admin/participants/{id}/proof/{kind}` (streams the private video to
    the admin only; auth-gated; never a public URL).
  - **Verifikasi bukti awal** — enter initial weight + accept → `RUNNING` (`startAt` = initial submission
    `receivedAt`), or reject (reason).
  - **Verifikasi bukti akhir** — enter final weight + accept → `COMPLETED` (compute `percentLoss`), or reject.
  - **Gugurkan / Diskualifikasi** — set `DROPPED` + `dropReason`.
  - **Catatan** — edit `notes`.
- `GET /api/admin/participants?programId=&group=` lists with the derived view fields computed server-side
  via `lib/challenge.ts`.

### 21.8 Challenge WhatsApp automation (slice D12) `[DRAFT]`
Automates the rules' reminder schedule (`docs/challenge-rules.md` §7/§8) and the two auto-eliminations.

**Auto-create participants on PAID (decided):** when an `Order` transitions to **PAID** for a program
whose `Challenge.isActive`, the Midtrans webhook upserts a `ChallengeParticipant` (status
**`AWAITING_INITIAL`** = "Menunggu Bukti Awal", `purchaseAt = paidAt`). They appear in User/Active
immediately and receive the start-window reminders. (Idempotent upsert by `orderId`.) When their initial
video later arrives, the inbound webhook moves `AWAITING_INITIAL → PENDING_INITIAL_REVIEW`.

**Instant `after_purchase` (decided):** right after that upsert, the webhook sends the `after_purchase`
instruction message **immediately** (fire-and-forget; the webhook still acks 200 fast) via the reusable
`sendChallengeReminderOnce()` — the same idempotent reserve-then-send used by the cron, keyed on
`ChallengeReminderLog`, so the hourly cron **never re-sends** it. The buyer gets the challenge
instructions in seconds, not up to an hour later. All other reminders (h7/h13/h14, day1/30/60/90, the
final-proof nudges) remain cron-driven.

**Scheduler (decided):** a cron-gated endpoint **`GET /api/cron/challenge-reminders`** (auth = `isCron`
/ `CRON_SECRET`, like `process-deliveries`), hit **hourly** by system cron. It scans participants in
`AWAITING_INITIAL` / `RUNNING`, computes due reminders + eliminations, sends, and logs.

**Reminder rules (`lib/challenge.ts` `computeDueReminders(...)`, pure + tested).** Each key fires once
(idempotent via `ChallengeReminderLog` `@@unique([participantId,key])`); a `>=` threshold means a missed
hour still catches up. Days are WIB calendar days.
- `AWAITING_INITIAL` (from `purchaseAt`): `after_purchase` (d≥0), `h7` (d≥7), `h13` (d≥13), `h14` (d≥14);
  at **d ≥ startWindowDays+1** → send `h15` **and transition `DROPPED` (`eliminated_initial`)**.
- `RUNNING` (from `startAt`, `day` = 1-based): `day1` (day≥1), `day30` (≥ phase1 end), `day60` (≥ phase2
  end), `day90` (≥ durationDays). If the **final proof isn't in yet** (`finalSubmittedAt` null):
  `day97` (≥ durationDays+7), `day103` (≥ +13), `day104` (≥ +14); at **day ≥ durationDays+finalProof
  WindowDays+1** → send `day105` **and transition `DROPPED` (`eliminated_final`)**.
- `final_received` is **event-based**, sent by the **verify-final admin action** (not the cron) right
  after `COMPLETED`.

**Sending (`sendChallengeReminderOnce()` in `lib/challenge-reminders.ts`).** One reusable helper for
both the cron worker and the webhook's instant `after_purchase`. Render the template (`{{contact}}` →
`Challenge.contactInfo`) and send via `sendTextHumanized` (§12.2.1). Reserve the slot first
(`ChallengeReminderLog` create; P2002 → already sent → `'skipped'`) **then** send, recording
`wahaMessageId` or `error` on the log. Reserving-before-sending favors **no double-send** (anti-spam)
over guaranteeing delivery; failures are visible on the log row.

**Rate / anti-spam pacing.** The worker is **strictly sequential** (no parallel sends). Each message
already carries the humanized typing delay (§12.2.1; caps ~6s for long templates), and the worker adds a
further **randomized 3–7s gap between every message** (`MIN_GAP_MS`/`MAX_GAP_MS`) — across recipients
too — so the system never approaches a per-second burst even if templates are short or a large cohort
comes due in the same hour. A big cohort simply makes the hourly run take longer (≈ one message per
8–13s); that's acceptable for a single WhatsApp sender.

**No phase status rows.** "Fase 1/2 Selesai" remain **derived** (§21.4) — the cron only sends the
day-30/60/90 messages; it does not change status except for the two eliminations.

**Out of scope (still deferred):** wiring the dashboard **Active** KPIs (open question #15) — left
stubbed; and any winner-announcement automation.

### 21.9 Security & invariants
- **Proof videos are private** (invariant #4 extends): stored under `CHALLENGE_MEDIA_DIR` outside the web
  root, traversal-safe names, atomic write; only ever streamed to an authenticated admin, never a public URL.
- `/api/webhooks/waha` is authenticated with `WAHA_WEBHOOK_SECRET`; `/api/admin/*` stays `requireAdmin`.
- All inputs Zod-validated; weights are positive numbers; one challenge per program; one participant per order.
- The challenge is **additive** — it must not change the buyer-facing checkout/delivery flow or any §1–§14 invariant.

### 21.10 Acceptance criteria (D11)
- [ ] Migration adds `Challenge`, `ChallengeParticipant`, `ChallengeSubmission`, `ParticipantStatus` (+
      relations). `lib/challenge.ts` pure helpers (`dayOfChallenge`, `currentPhase`, `percentLoss`,
      `participantView`, `defaultChallengeConfig`) unit-tested incl. phase boundaries & %-loss rounding.
- [ ] **Challenge Configuration**: pick a program → view/edit/save its challenge (all fields), enable
      toggle works; new programs get the rules defaults; `PUT` upserts by `productId`; Zod-validated.
- [ ] **WAHA inbound**: an authenticated webhook call carrying a video from a known buyer creates/updates
      the participant + a `ChallengeSubmission`, stores the video privately (never `public/`), dedupes by
      `wahaMessageId`, and ignores non-buyers; bad/unauth calls rejected.
- [ ] **User/Active**: lists started participants for a program with derived status/day/phase; admin can
      stream a proof video, verify initial (sets `RUNNING` + `startAt` + initial weight), verify final
      (sets `COMPLETED` + final weight + `percentLoss`), and drop with a reason; %-loss column sorts.
- [ ] Sidebar gains **Challenge** (`/admin/challenge`) and enables **Users / Active** (`/admin/active`).

**Acceptance criteria (D12 — automation, §21.8)**
- [ ] `AWAITING_INITIAL` enum + `ChallengeReminderLog` migrated. On **PAID** for a challenge-active
      program, a participant is auto-created (`AWAITING_INITIAL`); inbound initial video moves it to
      `PENDING_INITIAL_REVIEW`. `computeDueReminders` unit-tested (start-window + running-phase + the two
      eliminations + idempotency via sent-keys).
- [ ] `GET /api/cron/challenge-reminders` (cron-gated) sends each due reminder **once** (humanized
      sequence), logs it, and auto-`DROPPED`s at H+15 (no initial) / day-105 (no final). `final_received`
      is sent by the verify-final action. Build/tests/tsc green; migration + lockfile committed.

### 21.11 Assumptions baked in (confirm before coding)
1. A participant appears the moment their **initial proof video arrives** (status
   `PENDING_INITIAL_REVIEW`), before admin verification — so the admin has something to review.
2. **First** proof = initial, **next** proof (while `RUNNING`) = final.
3. Weights are **entered by the admin** from the verified video (the video shows the scale).
4. `CHALLENGE_MEDIA_DIR` is a new private volume (separate from `EBOOK_FILES_DIR`).
5. Dashboard `Active` KPIs stay **stubbed** in D11 (wired in D12).

## 22. External Landing Pages (slice D13) `[DRAFT]`

Three standalone marketing pages live in `landing-pages/` (`lp1.html`, `lp2.html`, `lp3.html`) and are
hosted on **other domains** (CDN / static host), outside this Next.js app. They drive paid orders into
the same checkout pipeline as the built-in `/[slug]` page — there is **no separate checkout backend**.

### 22.1 Flow
Form (name, WhatsApp, **email — required**) → `POST {CHECKOUT_API_BASE}/api/checkout` with
`{ productSlug, name, email, whatsapp, trackingId }` → app creates the PENDING order + Midtrans Snap →
returns `{ orderCode, snapToken, redirectUrl }` → page does `window.location.href = redirectUrl`. On
confirmed payment the existing webhook + delivery path sends the e-book (and challenge auto-create on
PAID still applies). The pages no longer use the old `wa.me` redirect.

### 22.2 Per-page configuration (operator)
Two constants at the top of each page's inline `<script>`:
- `CHECKOUT_API_BASE` — the app's public origin (`APP_BASE_URL`), no trailing slash.
- `PRODUCT_SLUG` — an active, on-sale product slug from admin → Program.

### 22.3 Cross-origin requirement
Each hosted page origin **must** be added to the CORS allowlist (Pengaturan → Origin yang diizinkan,
invariant #10 — never `*`). A missing origin = browser blocks the request, order never created.

### 22.4 Behaviour / error handling (client)
- `422` → shows joined field validation messages (e.g. invalid Indonesian WA number).
- `403` → sales window closed/not started ("Penjualan ditutup").
- `429` → rate-limited, try-again message.
- network/`5xx` → generic retry message. The submit button shows "Memproses..." and is disabled in flight.
- `?ref` / `?utm_source` / `?fbclid` query param → sent as `trackingId`, stored on the order.

### 22.5 Notes / invariants
- Email is **mandatory** on these pages because `Customer` (`@@unique([email, whatsapp])`) and Midtrans
  require it; do not revert to "opsional".
- Static assets only — not built or served by the app; reuse the existing `/api/checkout` contract, so
  no schema or server change was needed. Setup steps: `landing-pages/README.md`.

---

## 23. Email fallback delivery (slice D14) `[DRAFT]`

When WhatsApp delivery fails, the buyer's e-book (and every attachment) is **also** emailed to them as
a fallback, so a flaky WAHA send never leaves a paying customer empty-handed. The WhatsApp flow is
**unchanged** — same atomic claim, same backoff/retry, same exactly-once per file (invariant #3). Email
is purely additive and **best-effort**: it never blocks, delays, or fails a WhatsApp send, and a missing
email configuration makes the whole feature a silent no-op.

### 23.1 Trigger (decided 2026-06-22 — parallel)
Inside `attemptDelivery`, **after** the per-item WhatsApp loop, if **any** item failed on this pass the
system attempts the email fallback **immediately** (in parallel with WhatsApp, which is simultaneously
rescheduled for its next retry). The buyer therefore gets the e-book by email within seconds of the
first WhatsApp failure, while WhatsApp keeps retrying on its normal schedule. Accepted consequence: a
buyer may receive the file on **both** channels (e.g. WhatsApp later succeeds, or only an attachment had
failed) — completeness is preferred over avoiding a duplicate.

### 23.2 What is sent
**One email** with the **complete** file set (the e-book + every attachment, same snapshot as the
`DeliveryItem` rows), regardless of which individual item failed — the buyer gets a self-contained copy
in a single message. Files are read from the private `EBOOK_FILES_DIR` (invariant #4) and attached as
binary content (never a public URL). Indonesian subject/body addressed to the buyer by name, explaining
the e-book is sent by email because the WhatsApp delivery hit a problem.

### 23.3 Idempotency & retry
- One email per order. A `Delivery.emailFallbackSentAt` timestamp guards it; once set, no further email
  is attempted. Because `attemptDelivery` holds the `PROCESSING` claim, only one caller is ever in the
  fallback path at a time — no extra locking is needed.
- If the **email send itself** fails, `emailFallbackSentAt` stays null and `emailFallbackError` records
  the reason; the next delivery retry (cron) re-attempts the email too, until it succeeds. Email
  attempts are thus bounded by WhatsApp's `maxAttempts` window (no separate schedule).
- `emailFallbackAttempts` counts tries (audit only).

### 23.4 Provider — Gmail SMTP (decided 2026-06-22)
`lib/email.ts` wraps **`nodemailer`** over Gmail SMTP (`smtp.gmail.com:465`, secure). Auth = a Gmail
**App Password** (requires 2-Step Verification on the account; legacy "less secure apps" is gone). The
transport is built lazily from env. The provider is isolated behind `sendEbookEmail()` so it can later be
swapped for a transactional service (Resend/SES/Brevo/Postmark) without touching `delivery.ts`.

**Known Gmail limits (operator must be aware):** ~500 recipients/day (free Gmail), 25 MB max attachment
(our PDFs cap at 32 MB each — a large e-book may exceed Gmail's email limit even though WhatsApp accepted
it; such a send fails and is recorded in `emailFallbackError`), and the `From:` is locked to the Gmail
address. These are acceptable for a low-volume fallback; revisit if volume grows.

### 23.5 Configuration (env, all optional)
The feature is **off unless configured**. `isEmailConfigured()` is true only when enabled + creds set.
- `EMAIL_FALLBACK_ENABLED` — `true` to turn the fallback on (default off).
- `GMAIL_USER` — the sending Gmail address (also the SMTP username).
- `GMAIL_APP_PASSWORD` — the 16-char App Password (server-only secret, never logged/returned — inv. #6).
- `EMAIL_FROM` — optional `From:` header (e.g. `"Toko E-book" <you@gmail.com>`); defaults to `GMAIL_USER`.

### 23.6 Data model (see §9)
`Delivery` gains `emailFallbackSentAt DateTime?`, `emailFallbackError String?`,
`emailFallbackAttempts Int @default(0)`. Migration `20260623000000_add_email_fallback`. No new table.

### 23.7 Acceptance criteria
- [ ] On a WhatsApp delivery where at least one item fails, with email configured, exactly one email
      carrying the e-book + all attachments is sent to the buyer's address.
- [ ] The WhatsApp retry/backoff/exactly-once behaviour is byte-for-byte unchanged.
- [ ] The email is sent at most once per order across any number of retries (`emailFallbackSentAt` guard).
- [ ] If email is not configured (or `EMAIL_FALLBACK_ENABLED` is off), delivery behaves exactly as before
      and no email is attempted.
- [ ] An email-send failure is recorded (`emailFallbackError`) and never fails/blocks the WhatsApp send;
      it is retried by the cron until it succeeds (within the WhatsApp attempt window).
- [ ] Pure helpers (`isEmailConfigured` decision, `buildEbookEmail` subject/body) are unit-tested.

## 24. Switchable WhatsApp engine — WAHA ↔ Fonnte (slice D15) `[DRAFT]`

The WhatsApp channel is pluggable. The operator chooses **one** active provider for **all** outbound
WhatsApp (e-book/attachment delivery + every challenge reminder/ack + the operator test-send) and for
inbound challenge proof-video capture. Default and reference engine = **WAHA** (unchanged). New engine =
**Fonnte** (`https://fonnte.com`). Switching is a single setting in **Pengaturan**; no redeploy.

### 24.1 The engine abstraction (`lib/messaging.ts`)
A minimal interface keeps the rest of the app provider-agnostic:
```ts
interface WaEngine {
  name: 'waha' | 'fonnte';
  sendFile(p: { phone: string; mimeType; filename; base64Data; caption? }): Promise<{ id }>;
  sendText(p: { phone: string; text; messageId? }): Promise<{ id }>;
}
```
- `phone` is the **normalized `628…` digits** (`lib/phone.ts`); each adapter formats it (WAHA → `…@c.us`,
  Fonnte → bare). Callers no longer build the chatId.
- `getActiveEngineName()` reads the `MessagingConfig` singleton (cached 10s, cleared on PUT — same pattern
  as `RateLimitConfig`); `getWaEngine()` returns the matching adapter. Both async; all call-sites already are.
- `sendText` is the **humanized** path (anti-spam, §12.2.1): WAHA runs the sendSeen→typing→send sequence;
  Fonnte delegates to its server-side `typing`/`delay` params. `sendFile` is the transactional path (exempt).

### 24.2 WAHA adapter (`wahaEngine`, in `lib/waha.ts`)
Thin wrapper over the existing `sendFile` / `sendTextHumanized` (which keep their `chatId` signatures and
all current behaviour: priming, LID resolution, `[waha-send]` logging). **Zero wire change** vs. 0.15.0.

### 24.3 Fonnte adapter (`fonnteEngine`, in `lib/fonnte.ts`)
- One endpoint: `POST https://api.fonnte.com/send`. Auth header `Authorization: <FONNTE_TOKEN>` (no
  `Bearer` prefix). Throws a clear error if `FONNTE_TOKEN` is unset.
- **Text:** form-urlencoded `{ target, message, typing: true, delay }`. `target` = the bare `628…` number.
- **File:** `multipart/form-data` `{ target, file: <binary Blob>, filename, message: <caption>, typing }`.
  The file is the **binary** read from the private `EBOOK_FILES_DIR` — **never** the public `url` param
  (invariant #4 / #5). **Fonnte caps a file at 10 MB** (https://docs.fonnte.com/file-limitation/); a larger
  file fails the send (recorded + retried),
  and the §23 email fallback delivers the e-book instead.
- **Response:** `{ status: true, id: ["…"], detail, … }` on success; `{ status: false, reason }` on failure.
  The adapter throws on `status !== true` so `delivery.ts`/reminders treat it exactly like a WAHA failure.

### 24.4 Inbound (challenge proof videos) — engine-aware
The idempotency-critical core (dedupe on message id → match a PAID challenge order by WhatsApp number →
upsert the participant → download+store the private video → record the `ChallengeSubmission` → advance
status → `proof_received` ack) is extracted to **`lib/challenge-inbox.ts`** and shared by both webhooks.
- **WAHA** `/api/webhooks/waha` (unchanged contract, §21.6): HMAC-SHA512 `X-Webhook-Hmac`; sender may be a
  `…@lid` → resolved via the LIDs API; media downloaded with `X-Api-Key`. Keeps its LID wrapper, then calls
  the shared core.
- **Fonnte** `/api/webhooks/fonnte` (new): Fonnte POSTs **form fields** (`sender`, `message`, `name`, `url`,
  `filename`, `extension`); `sender` is a **plain phone number** (no LID) → `normalizeIndonesianPhone`;
  media is a **public `url`** downloaded with **no auth header**. **Fonnte provides no HMAC**, so the route
  authenticates with a **shared secret in the webhook URL** — `?token=…` constant-time-compared to
  `FONNTE_WEBHOOK_SECRET`, **fails closed** when the secret is unset (configure the Fonnte device webhook as
  `https://<host>/api/webhooks/fonnte?token=<FONNTE_WEBHOOK_SECRET>`). Idempotency: Fonnte does not
  guarantee a message id, so the key is the payload `id` if present else a SHA-256 of `sender|url|message`,
  stored in `ChallengeSubmission.wahaMessageId` (the existing unique column — reused as the generic
  provider-message id; not renamed to avoid a wide migration).

### 24.5 Configuration & data model
- **Engine selection** — `MessagingConfig` singleton (`id="default"`, `engine String @default("waha")`,
  `updatedAt`). Migration `20260624000000_add_messaging_config`. Chosen in **Pengaturan** via a new
  `MessagingEngineSettings` card → `GET`/`PUT /api/admin/messaging` (`requireAdmin`; PUT clears the cache).
  The GET also returns `fonnteConfigured`/`fonnteWebhookConfigured` booleans (derived from env) so the UI
  can warn when Fonnte is selected but its env is missing — **the token itself is never returned** (inv. #6).
- **Env (all optional, §8):** `FONNTE_TOKEN` (server-only device token), `FONNTE_WEBHOOK_SECRET` (inbound
  webhook shared secret). WAHA's env is untouched and still required (it is the default engine).

### 24.6 Invariants touched (reworded, engine-aware — not weakened)
- **#5** now reads "the **active outbound engine** sends over HTTPS only and never hands a private file to
  the provider as a URL" — WAHA `file.data` base64 / Fonnte multipart `file` binary; both HTTPS; neither
  uses a public file URL.
- **#13** inbound auth is **per engine**: WAHA = HMAC-SHA512; Fonnte = the URL shared-secret token (Fonnte
  exposes no HMAC). Both fail closed when their secret is unset; both stay idempotent on the stored message id.
- **#14** "humanized send": WAHA via the explicit sequence; Fonnte via its server-side `typing`/`delay`.

### 24.7 Acceptance criteria
- [ ] With `engine=waha`, every outbound send and the inbound webhook behave byte-for-byte as in 0.15.0.
- [ ] With `engine=fonnte` + `FONNTE_TOKEN` set, the e-book + attachments deliver via Fonnte (binary `file`,
      never a URL), challenge reminders/acks/test-send go via Fonnte with `typing` on, and inbound proof
      videos posted to `/api/webhooks/fonnte?token=…` are captured exactly once.
- [ ] Switching the engine in Pengaturan takes effect within the 10s config cache (immediately after PUT).
- [ ] `/api/webhooks/fonnte` rejects a missing/incorrect `token` (and any call when `FONNTE_WEBHOOK_SECRET`
      is unset) with no side effects; inbound is idempotent across duplicate deliveries.
- [ ] Selecting Fonnte without `FONNTE_TOKEN` surfaces a clear config warning in the UI and a clear send
      error (no silent partial send); the Fonnte token is never sent to the browser or stored in the DB.
- [ ] A Fonnte send failure (incl. the >10 MB cap) is recorded and retried exactly like a WAHA failure, and
      the §23 email fallback still fires.
- [ ] Pure helpers (Fonnte payload/response parsing, `MessagingConfig` engine resolution, inbound
      idempotency-key derivation) are unit-tested.

## 25. E-book as a protected download link (slice D16) `[DRAFT]`

The main e-book is delivered as a **protected download link** instead of a WhatsApp file attachment, so
delivery is identical on WAHA & Fonnte and is not blocked by Fonnte's 10 MB cap. **Attachment PDFs stay as
file attachments.** Full design + decisions: `docs/ebook-link-delivery-plan.md`.

### 25.1 Flow
On `PAID`, `attemptDelivery` sends the e-book `DeliveryItem` as a **humanized WhatsApp text** containing
`${APP_BASE_URL}/download/<token>` (rendered from the Program's editable `linkMessageTemplate`); attachments
are still sent via `engine.sendFile`. The buyer opens the link → a public page asks for their WhatsApp
number → `POST /api/download/<token>` normalizes it, **exact-matches** the order's registered number, and on
success **streams the e-book PDF** from the private `EBOOK_FILES_DIR`. Link is **permanent + unlimited
re-downloads** while the order is `PAID`.

### 25.2 Token & data model
- `Delivery.downloadToken String? @unique` — `randomBytes(16).toString('base64url')` (**22 chars, 128-bit**),
  generated when the delivery items are snapshotted. Short link, unguessable.
- `Product.linkMessageTemplate String?` — editable WhatsApp message (placeholders `{{name}}/{{product}}/
  {{link}}`); seeded default; blank ⇒ built-in default. Edited in the Program menu.
- Migration `20260624010000_add_ebook_download_link`.

### 25.3 Security (Invariant #4 reworded — not weakened)
The e-book may be served by the **tokenized, phone-gated** `/api/download/<token>` endpoint (and the admin
proof-video stream) — but still **never** under `public/`, never served statically, and **never handed to a
WA provider as a URL** (the WA message carries an app link, not a file URL). The token is the secret; the
phone gate is a second factor against casual sharing; `checkDownloadRateLimit` (per token+IP) blocks number
enumeration. HTTPS only; `Cache-Control: private, no-store`.

### 25.4 Email fallback
Unchanged (§23): on WhatsApp failure the buyer is still emailed the **actual PDF files** (e-book +
attachments). The link is the WhatsApp path only.

### 25.5 Acceptance criteria
- [ ] On `PAID`, the buyer receives a WhatsApp text with a `/download/<token>` link (WAHA & Fonnte);
      attachments still arrive as files.
- [ ] The correct registered number downloads the PDF; a wrong number is rejected and repeated attempts are
      rate-limited (`429`).
- [ ] The link works only while `PAID`, permanently and for unlimited re-downloads.
- [ ] The e-book is never a public/static URL nor a URL to the WA provider; the PDF streams only after a
      successful phone match.
- [ ] The link message comes from the Program's editable template (default when blank); placeholders render.
- [ ] Email fallback still attaches the real PDF files.
- [ ] Pure helpers (`renderLinkMessage`, token generation, download rate-limit, phone match) are unit-tested;
      `npm test` + `tsc` + `build` green.

## 26. Conversion postback to ad publisher (slice D17) `[DRAFT]`

On `PAID`, fire a server-to-server GET postback to a single ad-publisher URL so the publisher can attribute
the sale to its click. Full design + decisions: `docs/conversion-postback-plan.md`.

### 26.1 trxid = `Order.trackingId`
No new field/capture: the publisher click id is the existing `trackingId` (already captured from
`?ref`/`?utm_source`/`?fbclid` and stored on the order). An order without a `trackingId` is never posted back.

### 26.2 Configuration (`ConversionConfig` singleton + Pengaturan UI)
Singleton row (cached, like `RateLimitConfig`/`MessagingConfig`), edited via a new `ConversionPostbackSettings`
card → `GET`/`PUT /api/admin/conversion`:
- `enabled` (default false), `postbackUrl` (macro template). Validation: `https://…` and must contain `{trxid}`.

### 26.3 Macros
`{trxid}` (required) → `trackingId`; `{amount}` (optional) → `amountIdr`; `{orderid}` (optional) →
`orderCode`. URL-encoded; only macros present in the template are replaced (`renderPostbackUrl`, pure).

### 26.4 Sending & idempotency (`lib/conversion.ts`)
`sendConversionPostback(orderId)` is best-effort + idempotent: no-op unless enabled + `trackingId` present +
URL set + `conversionPostbackSentAt` null; GET the rendered URL; on 2xx set `conversionPostbackSentAt`, else
record `conversionPostbackError` + increment `conversionPostbackAttempts`. Fired fire-and-forget from the
Midtrans webhook after the `PAID` transition; **retried** by the `process-deliveries` cron. Never throws,
never blocks checkout/delivery.

### 26.5 Data model (migration `20260624020000_add_conversion_postback`)
`Order` gains `conversionPostbackSentAt DateTime?`, `conversionPostbackError String?`,
`conversionPostbackAttempts Int @default(0)`. New singleton `ConversionConfig { id, enabled, postbackUrl,
updatedAt }`. No new env.

### 26.6 Acceptance criteria
- [ ] On `PAID`, with the postback enabled + URL set, an order with a `trackingId` triggers exactly one GET
      to the rendered URL (`{trxid}` substituted; `{amount}`/`{orderid}` when present), recorded in
      `conversionPostbackSentAt`.
- [ ] No postback for an order without a `trackingId`, or when disabled / URL unset.
- [ ] A failed postback is recorded and retried by the cron until it succeeds (idempotent, once per order).
- [ ] Checkout/delivery are never blocked or failed by the postback.
- [ ] `postbackUrl` validation rejects a non-https URL or one missing `{trxid}`.
- [ ] Pure `renderPostbackUrl` is unit-tested.
