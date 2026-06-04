# PROGRESS.md — Live Build State

> Updated at the end of every session (see PRD §19.2). Read this + `CLAUDE.md` + the PRD before
> writing any code. Trust the repo (`git log`, `git status`) over this file if they disagree, then
> fix this file.

| Field | Value |
|---|---|
| PRD version in sync with | 0.6.0 |
| Last updated | 2026-06-04 |
| Overall status | F7 done — F1 next |
| Repo working state | green (build passes, 11 tests pass) |

## How to run (fill in once scaffolded)
- Install: `npm install`
- Dev: `npm run dev`
- Test: `npm test`
- DB: `npx prisma migrate dev && npx prisma db seed`
- Local stack: `docker compose up -d --build`

## Feature checklist (tick when acceptance criteria in PRD §5 pass AND are verified)
- [x] Scaffold: Next.js + TS + Prisma + zod env validation + Dockerfile/compose/Caddyfile
- [x] F7 — Products + seed
- [ ] F1 — Checkout intake (form, tracking ID capture, validation)
- [ ] F2 — Order creation + Midtrans Snap transaction
- [ ] F3 — Midtrans webhook (signature verify, idempotent forward-only status, PaymentEvent log)
- [ ] F4 — WAHA base64 delivery (phone normalization, sendFile, exactly-once)
- [ ] F5 — Delivery retry / backoff (cron-style worker)
- [ ] F6 — Admin: list orders + manual resend (with corrected number)
- [ ] SLC polish pass (friendly WA message, thank-you page, error states, alerts)

## In progress
- F1 — Checkout intake (form + `POST /api/checkout` validation)

## Next up (after current)
1. F2 order + Midtrans Snap.
2. F3 webhook.
3. F4 WAHA delivery.

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

## Known issues / TODO
- (none)

## Open questions (block the noted slice until answered — mirror of PRD §16)
- [x] Single product or catalog? → **Single product for v1** (slug: `lose-weight-challenge-1st-edition`; price: IDR 75,000). Resolved 2026-06-04.
- [ ] Tracking-ID semantics: affiliate vs campaign? (reporting only — does not block any slice)
- [ ] Email fallback if WhatsApp delivery permanently fails? (affects F4/F5; tied to file-size limit)
- [ ] PII retention period (UU PDP).
- [ ] 3rd-party WAHA provider: max request body size (caps e-book size for base64), IP allowlist
      support, auth header. (Blocks F4 if a large file exceeds the limit.)
- [ ] Checkout failure policy: on Midtrans create failure, delete the PENDING order or mark FAILED?

## Session log
- 2026-06-03 — Project planned; PRD at v0.6.0; CLAUDE.md and PROGRESS.md created. No code yet.
- 2026-06-04 — Scaffold slice complete: Next.js 15 + TS, Prisma schema (§9 exact), zod env
  validation, Dockerfile (standalone), docker-compose.yml, Caddyfile, Jest test suite (5 tests green).
  Build passes. Committed as `feat(scaffold)`.
- 2026-06-04 — F7 complete: initial migration SQL generated (`prisma/migrations/20260604000000_init`),
  `prisma/seedData.ts` exports typed SEED_PRODUCTS (importable in tests), `prisma/seed.ts` upserts
  product on `npx prisma db seed`. 11 tests green. Committed as `feat(F7)`.
  Product: slug=`lose-weight-challenge-1st-edition`, price=IDR 75,000.
