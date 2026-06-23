# Implementation Plan — S2S Conversion Postback to Ad Publisher (slice D17)

> Status: **BUILT** (2026-06-23, PRD 0.18.0 §26; pending VPS deploy). Decisions confirmed by the owner;
> folded into PRD §26 per docs-discipline.

## 1. Goal
When a customer pays (`PAID`), fire a **server-to-server conversion postback** (a GET "pixel") to the ad
publisher, passing back the publisher's click id (**`trxid`**) so the publisher can attribute the sale.

## 2. Owner decisions (confirmed 2026-06-23)
1. **One publisher** (single global postback URL).
2. **GET (pixel/URL)** postback.
3. **trxid = the existing `Order.trackingId`** — reuse what's already captured from `?ref` / `?utm_source` /
   `?fbclid`. **No new DB field, no new landing-page parameter, no checkout-contract change.**
4. Macros: **`{trxid}` is required** (template must contain it); **`{amount}` and `{orderid}` are optional**
   (single program for now).
5. Conversion event = **`PAID` only**.

## 3. Flow
1. Ad traffic arrives with `?ref=` / `?utm_source=` / `?fbclid=` → the landing page already sends it as
   `trackingId` (unchanged) → stored on `Order.trackingId`.
2. On the Midtrans webhook **PAID** transition, if the postback is **enabled**, the order has a non-empty
   **`trackingId`**, and a URL template is configured → fire a **GET** to the rendered URL,
   **fire-and-forget**, **idempotent once per order**. (Orders without a `trackingId` → no postback.)

## 4. Macros (URL template)
Operator stores a template, e.g. `https://publisher.example.com/cb?clickid={trxid}&payout={amount}`.
Substituted (URL-encoded) at send time:
- `{trxid}` (**required** in the template) → `Order.trackingId`
- `{amount}` (optional) → `Order.amountIdr` (integer IDR)
- `{orderid}` (optional) → `Order.orderCode`
A macro that isn't in the template is simply skipped (`renderPostbackUrl` only replaces what's present).

## 5. Configuration — `ConversionConfig` singleton + Pengaturan UI
Mirrors `RateLimitConfig`/`MessagingConfig` (singleton row, cached, edited in **Pengaturan** via a new
`ConversionPostbackSettings` card → `GET`/`PUT /api/admin/conversion`):
- `enabled Boolean` (default false — off until configured).
- `postbackUrl String?` (the macro template). Validation: must be `https://…` and contain `{trxid}`.
The URL is not a secret → fine to store in the DB / show in the UI.

## 6. Data model (migration `2026XXXX_add_conversion_postback`)
**No `Order.clickId`** — the trxid is `Order.trackingId` (already exists). Only add the postback audit
fields + the config singleton:
- `Order.conversionPostbackSentAt DateTime?` — idempotency guard (set once the GET returns 2xx).
- `Order.conversionPostbackError String?`, `Order.conversionPostbackAttempts Int @default(0)` — audit.
- New singleton `ConversionConfig { id="default", enabled, postbackUrl, updatedAt }`.

## 7. Sending (`lib/conversion.ts`)
- Pure `renderPostbackUrl(template, { trxid, amount, orderCode })` — URL-encodes values, replaces only the
  macros present. Unit-tested.
- `sendConversionPostback(orderId)` — idempotent + best-effort: loads order + config; no-op unless enabled,
  `trackingId` non-empty, URL set, and `conversionPostbackSentAt` is null; renders the URL; `fetch` GET
  (short timeout); on 2xx → set `conversionPostbackSentAt`; else record error + increment attempts. **Never
  throws** (same best-effort pattern as email fallback / WA log).
- **Trigger:** fire-and-forget from the Midtrans webhook right after the `PAID` transition. **Retry:** the
  existing `process-deliveries` cron also sweeps `PAID` orders with a `trackingId` +
  `conversionPostbackSentAt = null` and retries (no new cron). Idempotent throughout.

## 8. No landing-page / checkout change
`trackingId` is already captured and stored. Nothing to touch in `lp1/2/3.html`, `checkoutSchema`,
`/api/checkout`, or `createPendingOrder`.

## 9. Acceptance criteria
- [ ] On `PAID`, with the postback enabled + URL set, an order **with** a `trackingId` triggers exactly one
      GET to the rendered URL (`{trxid}` substituted; `{amount}`/`{orderid}` if present); recorded in
      `conversionPostbackSentAt`.
- [ ] No postback for an order without a `trackingId`, or when disabled / URL unset.
- [ ] A failed postback is recorded and retried by the cron until it succeeds (idempotent, once per order).
- [ ] Checkout/delivery are never blocked or failed by the postback.
- [ ] `postbackUrl` validation rejects a non-https URL or one missing `{trxid}`.
- [ ] Pure `renderPostbackUrl` is unit-tested; `npm test` + `tsc` + `build` green.

## 10. Deploy
New migration (`prisma migrate deploy`). No new env, no landing-page change. Operator enables + sets the URL
template in Pengaturan.
