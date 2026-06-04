# PROGRESS.md — Live Build State

> Updated at the end of every session (see PRD §19.2). Read this + `CLAUDE.md` + the PRD before
> writing any code. Trust the repo (`git log`, `git status`) over this file if they disagree, then
> fix this file.

| Field | Value |
|---|---|
| PRD version in sync with | 0.6.0 |
| Last updated | 2026-06-03 |
| Overall status | Not started — scaffolding next |
| Repo working state | n/a (no code yet) |

## How to run (fill in once scaffolded)
- Install: `npm install`
- Dev: `npm run dev`
- Test: `npm test`
- DB: `npx prisma migrate dev && npx prisma db seed`
- Local stack: `docker compose up -d --build`

## Feature checklist (tick when acceptance criteria in PRD §5 pass AND are verified)
- [ ] Scaffold: Next.js + TS + Prisma + zod env validation + Dockerfile/compose/Caddyfile
- [ ] F7 — Products + seed
- [ ] F1 — Checkout intake (form, tracking ID capture, validation)
- [ ] F2 — Order creation + Midtrans Snap transaction
- [ ] F3 — Midtrans webhook (signature verify, idempotent forward-only status, PaymentEvent log)
- [ ] F4 — WAHA base64 delivery (phone normalization, sendFile, exactly-once)
- [ ] F5 — Delivery retry / backoff (cron-style worker)
- [ ] F6 — Admin: list orders + manual resend (with corrected number)
- [ ] SLC polish pass (friendly WA message, thank-you page, error states, alerts)

## In progress
- (nothing yet) — NEXT: scaffold the project and commit the Prisma schema from PRD §9.

## Next up (after current)
1. Scaffold + schema + env validation, commit green.
2. F7 products/seed.
3. F1 checkout form.

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

## Known issues / TODO
- (none yet)

## Open questions (block the noted slice until answered — mirror of PRD §16)
- [ ] Single product or catalog for v1? (affects F1/F7)
- [ ] Tracking-ID semantics: affiliate vs campaign? (reporting only)
- [ ] Email fallback if WhatsApp delivery permanently fails? (affects F4/F5; tied to file-size limit)
- [ ] PII retention period (UU PDP).
- [ ] 3rd-party WAHA provider: max request body size (caps e-book size for base64), IP allowlist
      support, auth header. (Blocks F4 if a large file exceeds the limit.)
- [ ] Checkout failure policy: on Midtrans create failure, delete the PENDING order or mark FAILED?

## Session log
- 2026-06-03 — Project planned; PRD at v0.6.0; CLAUDE.md and PROGRESS.md created. No code yet.
