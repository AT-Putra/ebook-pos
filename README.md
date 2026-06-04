# E-book Sales & WhatsApp Delivery System

Sells a single digital e-book and delivers it to the buyer over WhatsApp.

**Flow:** Landing/checkout form → Midtrans payment → on confirmed payment, e-book sent to buyer's WhatsApp via a 3rd-party WAHA service.

## Stack

- Next.js 15 (App Router) + TypeScript
- PostgreSQL + Prisma
- Midtrans Snap (payments)
- WAHA over HTTPS (WhatsApp delivery, base64 payload)
- Caddy (reverse proxy + TLS), Docker Compose, AlmaLinux 10

## Local Development

### Prerequisites

- Node.js 20+
- PostgreSQL (local or Docker)
- A WAHA provider account (3rd-party managed service)
- Midtrans sandbox account

### Setup

```bash
cp .env.example .env
# Fill in all values in .env

npm install          # also runs prisma generate
npx prisma migrate dev
npx prisma db seed
npm run dev
```

### Environment variables

See `.env.example` for all required variables. Critical notes:

- `WAHA_BASE_URL` **must** start with `https://` — the app refuses to start otherwise.
- `EBOOK_FILES_DIR` must be an absolute path outside the web root (e.g. `/data/ebooks`).
- `MIDTRANS_SERVER_KEY` / `MIDTRANS_CLIENT_KEY` — get from Midtrans dashboard.

### Testing

```bash
npm test
```

### Build

```bash
npm run build
```

## Docker Compose (production)

```bash
# 1. Copy and fill in environment variables
cp .env.example .env

# 2. Create e-book directory and upload your PDF
sudo mkdir -p /data/ebooks
sudo cp your-ebook.pdf /data/ebooks/lose-weight-challenge-1st-edition.pdf

# 3. Start services
docker compose up -d --build

# 4. Apply DB migrations and seed
docker compose exec app npx prisma migrate deploy
docker compose exec app npx prisma db seed
```

Point your domain DNS A record at the server — Caddy auto-provisions TLS.

Set the Midtrans webhook URL to `https://yourdomain.com/api/webhooks/midtrans`.

See `PRD-ebook-sales-system.md §18` for the full deployment runbook.

## API Endpoints

| Method | Path | Auth | Description |
|--------|------|------|-------------|
| GET | `/{slug}` | — | Checkout page |
| POST | `/api/checkout` | — | Create order + Snap token |
| POST | `/api/webhooks/midtrans` | Midtrans signature | Payment notification |
| GET | `/api/cron/process-deliveries` | `x-cron-secret` | Retry failed deliveries |
| GET | `/api/admin/orders` | `Authorization: Bearer <ADMIN_TOKEN>` | List orders |
| POST | `/api/admin/deliveries/{id}/resend` | `Authorization: Bearer <ADMIN_TOKEN>` | Manual re-send |

## Setting up the cron job

To retry failed deliveries, call the cron endpoint periodically:

```bash
# Every 5 minutes via system cron
*/5 * * * * curl -s -H "x-cron-secret: $CRON_SECRET" https://yourdomain.com/api/cron/process-deliveries
```

## Manual resend (operator)

```bash
# Resend to original number
curl -X POST \
  -H "Authorization: Bearer $ADMIN_TOKEN" \
  https://yourdomain.com/api/admin/deliveries/{id}/resend

# Resend with corrected WhatsApp number
curl -X POST \
  -H "Authorization: Bearer $ADMIN_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"whatsapp":"08567890123"}' \
  https://yourdomain.com/api/admin/deliveries/{id}/resend
```
