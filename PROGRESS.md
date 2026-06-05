# PROGRESS.md — Live Build State

> Updated at the end of every session (see PRD §19.2). Read this + `CLAUDE.md` + the PRD before
> writing any code. Trust the repo (`git log`, `git status`) over this file if they disagree, then
> fix this file.

| Field | Value |
|---|---|
| PRD version in sync with | 0.7.1 |
| Last updated | 2026-06-05 |
| Overall status | F1–F7 + dashboard D1–D3 built & deployed; building D3.1 (dashboard UX polish) |
| Repo working state | green (build passes, 82 tests pass) |

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
- [ ] (later) D4 leads/purchase lists · D5 WA Logs (+`DeliveryAttempt`) · D6 user mgmt · D7 Laporan export page

## In progress
- (nothing — D3.1 complete; deploy to VPS next)

## Next up
- Deploy D3.1 to VPS: `git pull && sudo docker compose up -d --build` (no migration needed — pure UI).
- Deployment finish (parallel ops task): upload e-book PDF, set Midtrans webhook + Finish Redirect URL,
  add the retry cron, run sandbox E2E, then switch Midtrans to production keys.

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

## Known issues / TODO
- (none)

## Open questions (block the noted slice until answered — mirror of PRD §16)
- [x] Single product or catalog? → **Single product for v1** (slug: `lose-weight-challenge-1st-edition`; price: IDR 75,000). Resolved 2026-06-04.
- [ ] Tracking-ID semantics: affiliate vs campaign? (reporting only — does not block any slice)
- [ ] Email fallback if WhatsApp delivery permanently fails? (affects F4/F5; tied to file-size limit)
- [ ] PII retention period (UU PDP).
- [ ] 3rd-party WAHA provider: max request body size (caps e-book size for base64), IP allowlist
      support, auth header. (Blocks F4 if a large file exceeds the limit.)
- [x] Checkout failure policy → **mark FAILED** (not delete). Audit trail preserved. Resolved 2026-06-04.

## Session log
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
