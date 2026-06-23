# Implementation Plan — Protected E-book Download Link (slice D16)

> Status: **BUILT** (2026-06-23, PRD 0.17.0 §25; pending VPS deploy). Decisions confirmed by the owner;
> implemented as the canonical spec below. Folded into PRD §25 per docs-discipline.

## 1. Goal & motivation
Deliver the **main e-book** as a **protected download link** instead of a WhatsApp file attachment, so
delivery is **identical on both engines** (WAHA & Fonnte) and is **not blocked by Fonnte's 10 MB cap**.
**Attachment PDFs stay as file attachments** (they are small). The buyer clicks the link, enters their
**registered WhatsApp number**, and — on an exact match for that order — the **e-book PDF downloads**.

## 2. Owner decisions (confirmed 2026-06-23)
1. **Link lifetime:** permanent while the order is `PAID`; **unlimited re-downloads** (no expiry, no counter).
2. **Phone gate:** the entered number must **exactly match** the order's registered WhatsApp (after `628…`
   normalization), **with per-(token+IP) rate-limiting** on attempts to prevent number enumeration.
3. **Email fallback (D14):** **unchanged** — on WhatsApp failure the email still attaches the **actual PDF
   file** (e-book + attachments). The link is the WhatsApp path only.
4. **Link message:** an **editable template per Program** (operator can change the wording), with a seeded
   default.

## 3. Scope
- IN: e-book item delivered as a link; new public download page + API; phone gate + rate-limit; editable
  per-Program link message; schema for token + template; docs.
- OUT (note as known limitation): an **attachment** larger than 10 MB still fails on Fonnte (attachments are
  assumed small; linkifying large attachments is a possible later slice). No change to the Midtrans/payment
  flow, the challenge module, or the engine switch.

## 4. Data model (new migration `2026XXXX_add_ebook_download_link`)
- **`Delivery.downloadToken String? @unique`** — unguessable token, **16 random bytes (128-bit) encoded
  `base64url` ⇒ 22 URL-safe chars** (`randomBytes(16).toString('base64url')`), generated when the delivery's
  items are snapshotted (one Delivery per order ⇒ one token per order). Identifies the e-book download.
  Nullable for legacy rows. Kept short on purpose so the link stays compact; 128-bit is unguessable.
- **`Product.linkMessageTemplate String?`** — editable WhatsApp message carrying the link. Placeholders:
  `{{name}}`, `{{product}}`, `{{link}}`. Seeded default (Indonesian, humanized). Nullable ⇒ falls back to a
  built-in default when blank.
- No change to `DeliveryItem`: the `kind='ebook'` row still exists; its `status=SENT` now means **the link
  message was sent** (not the file). `sortOrder 0` still marks it.

## 5. Delivery flow change (`lib/delivery.ts` `attemptDelivery`)
Single chokepoint (LSP-confirmed callers: Midtrans webhook, retry cron, admin resend — all via
`attemptDelivery`). In the per-item loop:
- **`kind === 'ebook'`** → build `link = ${APP_BASE_URL}/download/${delivery.downloadToken}`, render the
  product's `linkMessageTemplate` (or the default) with `{{name}}/{{product}}/{{link}}`, and send a
  **humanized text** via `engine.sendText(...)` (anti-spam §12.2.1 — it is now conversational). Mark the item
  `SENT` on success; log to `WaMessageLog` (category `ebook`, body = the message text).
- **`kind === 'attachment'`** → unchanged `engine.sendFile(...)`.
- Delivery rolls up to `SENT` only when every item is `SENT` (unchanged). Exactly-once still holds: the link
  message is sent at most once automatically; re-downloads happen on the download endpoint, independently.
- **Email fallback** path (`maybeSendEmailFallback`) is **untouched** — still attaches the real files.
- Token is generated in `ensureDeliveryItems` (or Delivery creation) so it exists before the first send.

## 6. Public download page + API (NOT under `/admin`; `proxy.ts` only guards `/admin/*`)
- **Page** `src/app/download/[token]/page.tsx` — minimal Indonesian UI: product name + a single
  WhatsApp-number input + a download button. Client component: `fetch` POST to the API; on `200` → download
  the returned PDF blob; on `403` → "Nomor tidak cocok dengan pesanan."; on `429` → "Terlalu banyak
  percobaan, coba lagi nanti."; on invalid token / order not `PAID` → "Link tidak valid atau pembayaran
  belum selesai."
- **API** `POST /api/download/[token]` — body `{ whatsapp }`:
  1. **Rate-limit** per `(token + client IP)` fixed window (≈5 / 5 min, new `checkDownloadRateLimit`,
     reusing `evaluateBucket`). `429 + Retry-After` when exceeded.
  2. Look up `Delivery` by `downloadToken` → its `Order` (+ customer + the e-book `DeliveryItem`). Reject if
     not found or `order.status !== PAID` (`404`/`403`).
  3. Normalize the submitted number (`normalizeIndonesianPhone`); **exact-compare** to
     `order.customer.whatsapp`. Mismatch → `403` (counts toward the rate-limit).
  4. On match → stream the e-book PDF from `EBOOK_FILES_DIR` (`readEbookAsBuffer(eItem.filePath)`), headers
     `Content-Type: application/pdf`, `Content-Disposition: attachment; filename="<fileName>"`,
     `Cache-Control: private, no-store`. (Permanent: no counter/expiry.)
- No login/session. The **token is the secret**; the phone gate is a second factor against casual sharing;
  the rate-limit blocks number enumeration.

## 7. Program UI (editable link message)
- `ProductManager`/`ProgramManager` add/edit modal gains a **"Pesan link e-book (WhatsApp)"** textarea
  (placeholders hint: `{{name}}`, `{{product}}`, `{{link}}`). Wired into `POST/PUT /api/admin/programs[/id]`
  + `program-serialize`. Pure `renderLinkMessage(template, {name, product, link})` (unit-tested).
- Seeded default (example):
  `Halo {{name}}! 🎉 Terima kasih sudah membeli *{{product}}*. Download e-book kamu di sini: {{link}} — kamu
  akan diminta memasukkan nomor WhatsApp ini untuk download.`

## 8. Invariants touched (reworded — not weakened)
- **#4 (private files):** the e-book may now be served by the **tokenized, phone-gated download endpoint**
  (`/api/download/[token]`) and the proof-video admin stream — but still **never** under `public/`, never
  served statically, and **never handed to a WA provider as a URL** (the WA message carries an app link, not
  a file URL). Attachments remain attachment-only.
- **#3 (exactly-once):** the e-book **link message** is sent at most once automatically (per item `SENT`);
  re-downloads via the endpoint are intentionally unlimited and separate from the one-time send.
- **#5/#14:** the e-book send is now a **humanized text** (was an exempt file send); attachments stay file
  sends. Engine-agnostic via `engine.sendText`/`engine.sendFile`.

## 9. Acceptance criteria
- [ ] On PAID, the buyer receives a WhatsApp **text with a download link** (both WAHA & Fonnte); attachments
      still arrive as files.
- [ ] Opening the link, entering the **correct** registered number downloads the e-book PDF; a **wrong**
      number is rejected and repeated attempts are rate-limited (`429`).
- [ ] The link works for an order only while `PAID`, **permanently and for unlimited re-downloads**.
- [ ] The e-book file is never exposed as a public/static URL nor sent to the WA provider as a URL; the PDF
      is streamed only after a successful phone match.
- [ ] The link message is taken from the Program's editable template (default used when blank); placeholders
      render correctly.
- [ ] Email fallback still attaches the real PDF files (unchanged).
- [ ] Pure helpers (`renderLinkMessage`, download rate-limit decision, phone match) are unit-tested;
      `npm test` + `tsc` + `build` green.

## 10. Deploy notes
- New migration (`prisma migrate deploy`). New env: none. The `/download/*` + `/api/download/*` routes are public
  (ensure not behind admin auth). Existing already-SENT deliveries keep their state; only new orders use the
  link. Seed/sync the default `linkMessageTemplate` for existing products (one-off update or via the Program
  UI).
```
