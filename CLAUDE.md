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
- `src/app/api/admin/*` — operator endpoints
- `src/lib/` — `db`, `env`, `validation`, `orders`, `midtrans`, `waha`, `files`, `phone`, `delivery`, `auth`
- `prisma/schema.prisma`, `prisma/seed.mjs`, `prisma.config.ts`

## NON-NEGOTIABLE INVARIANTS (do not violate)
1. **Midtrans webhook**: verify `signature_key == SHA512(order_id + status_code + gross_amount + SERVER_KEY)`
   using the EXACT `gross_amount` string from the payload. Reject mismatches. Log every notification.
2. **Idempotent + forward-only** order status updates. Duplicate/out-of-order notifications must not
   double-update or trigger a second delivery. A late `pending` after `settlement` is ignored.
3. **Exactly-once delivery**: one `Delivery` row per order (`orderId` unique). Never send the e-book
   twice automatically. Delivery fires only on transition to `PAID` with no existing `SENT` delivery.
4. **E-book is private**: stored under `EBOOK_FILES_DIR`, OUTSIDE the web root. NEVER under `public/`,
   never served statically, never given to WAHA as a URL.
5. **WAHA over HTTPS only**: `WAHA_BASE_URL` must start with `https://`; the app refuses to start /
   send otherwise. Send the file as base64 in `file.data` (never `file.url`). API key in `X-Api-Key`.
6. **No server key / secrets to the client.** Only the Snap token / redirect URL goes to the browser.
7. **Validate all input with zod.** Normalize Indonesian WhatsApp numbers to `62…@c.us`
   (`08…`→`62…`, `8…`→`62…`); reject invalid numbers at checkout.
8. **Currency is IDR**, integer amounts (no decimals).
9. **No customer login** in v1 — checkout is a plain form (name, email, WhatsApp, optional trackingId).

## Status mapping (Midtrans → OrderStatus)
`settlement`/`capture+accept` → PAID · `capture+challenge` → PENDING (no delivery) · `pending` → PENDING ·
`deny` → FAILED · `cancel` → CANCELLED · `expire` → EXPIRED · `refund`/`partial_refund` → REFUNDED.
Delivery happens ONLY on PAID.

## Build order (vertical slices — see PRD §19.3)
scaffold + schema + env → F7 products/seed → F1 checkout form → F2 order+Snap →
F3 webhook → F4 WAHA base64 delivery → F5 retry/backoff → F6 admin+resend → SLC polish.
Each slice: ends green (builds + tests pass), is committed, then PROGRESS.md is updated.

## Working rules
- Read files before editing; never assume prior content.
- Small diffs, one slice per commit. Commit messages reference the feature: `feat(F3): …`.
- Every finished feature gets at least one test. Run tests before and after each slice.
- A feature is "done" only when its PRD §5 acceptance criteria are ticked AND verified.
- If you make a design decision, record it in PROGRESS.md and fold it into the PRD (bump version).
- Don't introduce dependencies or version bumps without noting them in PROGRESS.md. Commit the lockfile.

## Deferred (do NOT build now)
Contest/challenge module. Keep `Customer`↔`Order` clean and queryable by `productId` + `status=PAID`
so it can be added later without schema churn.

## Open questions (resolve before the affected slice — see PRD §16)
Single product vs catalog · tracking-ID semantics · email fallback if WhatsApp permanently fails ·
PII retention period · 3rd-party WAHA provider limits (max request body size, IP allowlist, auth).
