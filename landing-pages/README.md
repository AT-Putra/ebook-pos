# Landing Pages (externally hosted)

`lp1.html`, `lp2.html`, `lp3.html` are standalone marketing pages meant to be hosted at **other
locations / domains** (not inside this app). Each one now submits a real order to this app's
checkout API and forwards the buyer to the Midtrans payment page — no more `wa.me` redirect.

## Flow

Form (name, WhatsApp, email) → `POST {CHECKOUT_API_BASE}/api/checkout` with `{ productSlug, name,
email, whatsapp, trackingId }` → app creates the order + Midtrans Snap transaction → returns
`{ redirectUrl }` → the page redirects the buyer there to pay. On confirmed payment the app delivers
the e-book over WhatsApp exactly as it does for the built-in `/[slug]` checkout page.

## Configure before publishing (2 steps)

### 1. Edit the two constants at the top of each page's `<script>`

```js
const CHECKOUT_API_BASE = 'https://your-app-domain.com'; // this app's public origin, NO trailing slash
const PRODUCT_SLUG      = 'lose-weight-challenge-1st-edition'; // product slug from admin → Program
```

`CHECKOUT_API_BASE` must be the app's `APP_BASE_URL` (the origin that serves `/api/checkout`).
`PRODUCT_SLUG` must match an **active, on-sale** product in admin → Program.

### 2. Allow each landing-page origin (CORS)

Because the pages are hosted on different domains, the browser sends a cross-origin request. The
checkout API only answers origins on the allowlist (invariant #10 — never `*`). In the dashboard go
to **Pengaturan → Origin yang diizinkan (CORS)** and add the exact origin of each hosted page, e.g.
`https://lp1.example.com`, `https://promo.example.com`. Origin = scheme + host (+ port), no path.
If an origin is missing, the buyer's request is blocked by the browser and the order never reaches
the server.

## Notes

- **Email is required.** The app's `Customer` record (and Midtrans) require a valid email, so the
  email field on all three pages is now mandatory (was "opsional"). Don't revert that.
- **Sales window / sold out:** if the program's sales period has ended (or not started), the API
  returns `403` and the page shows "Penjualan untuk produk ini sedang ditutup."
- **Rate limit:** rapid repeat submits from one IP get `429`; the page shows a try-again message.
- **Tracking:** a `?ref=`, `?utm_source=`, or `?fbclid=` query param on the landing-page URL is sent
  as `trackingId` and stored on the order.
- These files are static — host them anywhere (CDN, static host, another web server). They are NOT
  served by this Next.js app and don't need a build step.
