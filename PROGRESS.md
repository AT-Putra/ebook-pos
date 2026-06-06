# PROGRESS.md — Live Build State

> Updated at the end of every session (see PRD §19.2). Read this + `CLAUDE.md` + the PRD before
> writing any code. Trust the repo (`git log`, `git status`) over this file if they disagree, then
> fix this file.

| Field | Value |
|---|---|
| PRD version in sync with | 0.9.0 |
| Last updated | 2026-06-06 |
| Overall status | F1–F7 + dashboard D1–D3.1 + D8/D9 + D10 Program + Card UI deployed; **Challenge module (D11) specced — awaiting go-ahead to build** |
| Repo working state | green (build passes, 118 tests pass, tsc clean) |

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
- [ ] **D11 — Challenge module** (§21): `Challenge`/`ChallengeParticipant`/`ChallengeSubmission` + `ParticipantStatus`; **Challenge Configuration** menu (`/admin/challenge`, per-program config, seeded from `docs/challenge-rules.md`); **User/Active** menu (`/admin/active`, participant list + verify proofs + weights + %-loss); **WAHA inbound capture** (`/api/webhooks/waha`) → private `CHALLENGE_MEDIA_DIR`; `lib/challenge.ts` pure logic. *(specced; scope = 2 menus + capture only; awaiting go-ahead)*
- [ ] **D12 — Challenge WA automation** (§21.8, deferred): scheduled outbound reminders + auto phase/elimination cron + pre-start tracking + Active KPI wiring
- [ ] (later) D4 leads/purchase lists · D5 WA Logs (+`DeliveryAttempt`) · D6 user mgmt · D7 Laporan export page

## In progress
- **D11 Challenge module — SPECCED (PRD 0.9.0 §21), awaiting go-ahead to code.** Scope (confirmed with
  owner): **2 menus + WAHA inbound capture only**; outbound reminders + auto-transition cron are D12.
  Rules source of truth: `docs/challenge-rules.md`. Build plan:
  1. Schema + migration: `Challenge` (1:1 Product, config + JSON phases/winnerTiers/messageTemplates),
     `ChallengeParticipant` (per PAID order), `ChallengeSubmission` (inbound proof), `ParticipantStatus`
     enum; relations on Product/Customer/Order. Env: `WAHA_WEBHOOK_SECRET`, `CHALLENGE_MEDIA_DIR`.
  2. `src/lib/challenge.ts` — pure `dayOfChallenge`, `currentPhase`, `percentLoss`, `participantView`,
     `defaultChallengeConfig()` (seed from rules). Unit-test phase boundaries + %-loss rounding.
  3. Inbound webhook `POST /api/webhooks/waha` — auth via `WAHA_WEBHOOK_SECRET`, idempotent on
     `wahaMessageId`, match sender→Customer→PAID order→active Challenge, store video privately in
     `CHALLENGE_MEDIA_DIR` (reuse `lib/files.ts` pattern), create participant/submission (initial vs final).
  4. Admin API: `GET/PUT /api/admin/challenges/[productId]` (upsert config); `GET /api/admin/participants`
     (?programId &group), `PATCH /api/admin/participants/[id]` (verify initial/final + weight, drop, notes),
     `GET /api/admin/participants/[id]/proof/[kind]` (stream private video, requireAdmin).
  5. UI: `challenge/page.tsx` + `ChallengeConfig.tsx` (program dropdown → config form, §20.12 Card);
     `active/page.tsx` + `ParticipantList.tsx` (DataTable + verify/weight/drop actions + %-loss sort).
     Sidebar: add **Challenge** item; set **Users / Active** `ready: true`.
  6. Tests + tsc + build green; commit; push (pre-push hook). Update all 3 md "done" state.
- **Open before/while coding:** confirm WAHA provider's **inbound** webhook (media form: URL vs base64;
  auth mechanism → `WAHA_WEBHOOK_SECRET`; ~10 MB video limit) — open question #14.

## Next up
- Get owner go-ahead → build D11 per the plan above.
- Deploy will need: new migration (`prisma migrate deploy`), `CHALLENGE_MEDIA_DIR` volume mounted RW
  (like `/data/ebooks`), `WAHA_WEBHOOK_SECRET` in `.env`, and WAHA configured to POST inbound events to
  `https://<app>/api/webhooks/waha`.
- (D10 already deployed by owner: migrate deploy run + app brought up.)

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
- [ ] **WAHA inbound (D11):** does the provider POST inbound message events with **video media**? What
      form (download URL vs base64), what **auth** (→ `WAHA_WEBHOOK_SECRET`), and the inbound media size
      limit for ~10 MB videos? (PRD §16 Q14 — confirm before/while building `/api/webhooks/waha`.)
- [x] Checkout failure policy → **mark FAILED** (not delete). Audit trail preserved. Resolved 2026-06-04.

## Session log
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
