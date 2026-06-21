#!/usr/bin/env node
/**
 * One-off backfill for the WA Logs audit table (slice D5, §20.13).
 *
 * Populates `WaMessageLog` from the existing rows that predate the table:
 *   - DeliveryItem (SENT/FAILED) → one log per file send (category "ebook"/"attachment")
 *   - ChallengeReminderLog       → one log per reminder    (category "reminder")
 *
 * Best-effort historical snapshot: only the FINAL per-row state was stored before this
 * table existed (not each retry), so the backfill records that final state. Idempotent —
 * re-running skips rows already represented (by deliveryItemId, or participantId+key).
 *
 * Usage: DATABASE_URL=... node scripts/backfill-wa-logs.mjs
 */
import { PrismaClient } from '@prisma/client';
import { PrismaPg } from '@prisma/adapter-pg';

const adapter = new PrismaPg({ connectionString: process.env.DATABASE_URL });
const prisma = new PrismaClient({ adapter });

const PREVIEW_MAX = 140;
const preview = (t) => {
  if (!t) return null;
  const flat = String(t).replace(/\s+/g, ' ').trim();
  if (!flat) return null;
  return flat.length > PREVIEW_MAX ? flat.slice(0, PREVIEW_MAX - 1).trimEnd() + '…' : flat;
};
const chatIdOf = (whatsapp) => (whatsapp ? `${whatsapp}@c.us` : '');

async function backfillDeliveries() {
  const items = await prisma.deliveryItem.findMany({
    where: { status: { in: ['SENT', 'FAILED'] } },
    include: { delivery: { include: { order: { include: { customer: true } } } } },
  });

  let inserted = 0;
  for (const it of items) {
    const exists = await prisma.waMessageLog.count({ where: { deliveryItemId: it.id } });
    if (exists > 0) continue;

    const order = it.delivery?.order;
    const customer = order?.customer;
    await prisma.waMessageLog.create({
      data: {
        category: it.kind === 'ebook' ? 'ebook' : 'attachment',
        status: it.status, // SENT | FAILED
        chatId: chatIdOf(customer?.whatsapp),
        toPhone: customer?.whatsapp ?? null,
        fileName: it.fileName,
        bodyPreview: null,
        wahaMessageId: it.wahaMessageId,
        error: it.lastError,
        orderId: order?.id ?? null,
        deliveryId: it.deliveryId,
        deliveryItemId: it.id,
        productId: order?.productId ?? null,
        createdAt: it.sentAt ?? it.updatedAt,
      },
    });
    inserted++;
  }
  return inserted;
}

async function backfillReminders() {
  const reminders = await prisma.challengeReminderLog.findMany({
    include: { participant: { include: { customer: true, challenge: true } } },
  });

  let inserted = 0;
  for (const r of reminders) {
    const exists = await prisma.waMessageLog.count({
      where: { category: 'reminder', participantId: r.participantId, templateKey: r.key },
    });
    if (exists > 0) continue;

    const customer = r.participant?.customer;
    await prisma.waMessageLog.create({
      data: {
        category: 'reminder',
        status: r.error ? 'FAILED' : 'SENT',
        chatId: chatIdOf(customer?.whatsapp),
        toPhone: customer?.whatsapp ?? null,
        templateKey: r.key,
        bodyPreview: preview(r.error),
        wahaMessageId: r.wahaMessageId,
        error: r.error,
        participantId: r.participantId,
        productId: r.participant?.challenge?.productId ?? null,
        createdAt: r.sentAt,
      },
    });
    inserted++;
  }
  return inserted;
}

async function main() {
  const deliveries = await backfillDeliveries();
  const reminders = await backfillReminders();
  console.log(`[backfill-wa-logs] inserted ${deliveries} delivery log(s), ${reminders} reminder log(s).`);
}

main()
  .catch((err) => {
    console.error('[backfill-wa-logs] failed:', err);
    process.exitCode = 1;
  })
  .finally(() => prisma.$disconnect());
