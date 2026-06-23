#!/usr/bin/env node
/**
 * Reset test data — DESTRUCTIVE. Deletes all lead/purchase + challenge-participant data and the stored
 * proof videos, while KEEPING configuration (products/programs, challenge config, admin accounts, settings).
 *
 * Safety: refuses to run unless CONFIRM_RESET=YES.
 * Usage (inside the app container):
 *   sudo docker compose exec -e CONFIRM_RESET=YES app node scripts/reset-test-data.mjs
 *
 * ALWAYS take a backup first:
 *   sudo docker compose exec -T postgres pg_dump -U postgres ebook > ~/backup-ebook-$(date +%F-%H%M).sql
 */
import { readdir, unlink, stat } from 'node:fs/promises';
import path from 'node:path';
import { PrismaClient } from '@prisma/client';
import { PrismaPg } from '@prisma/adapter-pg';

// Transactional tables produced by leads/purchases + challenge participation. Config tables
// (Product, ProductAttachment, Challenge, AdminUser, Session, AllowedOrigin, RateLimitConfig,
// MessagingConfig, ConversionConfig) are intentionally NOT listed and stay intact.
const TABLES = [
  'Customer',
  'Order',
  'PaymentEvent',
  'Delivery',
  'DeliveryItem',
  'ChallengeParticipant',
  'ChallengeReminderLog',
  'ChallengeSubmission',
  'WaMessageLog',
];

const MEDIA_DIR = process.env.CHALLENGE_MEDIA_DIR || '/data/challenge-media';

if (process.env.CONFIRM_RESET !== 'YES') {
  console.error('⚠️  reset-test-data — DESTRUCTIVE, refused.');
  console.error('');
  console.error('This will DELETE all rows from: ' + TABLES.join(', '));
  console.error('and all proof videos in: ' + MEDIA_DIR);
  console.error('KEEPS: Product, ProductAttachment, Challenge, AdminUser, Session, AllowedOrigin,');
  console.error('       RateLimitConfig, MessagingConfig, ConversionConfig, and e-book PDFs in EBOOK_FILES_DIR.');
  console.error('');
  console.error('Back up first, then re-run with CONFIRM_RESET=YES:');
  console.error('  sudo docker compose exec -e CONFIRM_RESET=YES app node scripts/reset-test-data.mjs');
  process.exit(1);
}

const adapter = new PrismaPg({ connectionString: process.env.DATABASE_URL });
const prisma = new PrismaClient({ adapter });

async function counts() {
  const out = {};
  for (const t of TABLES) {
    const rows = await prisma.$queryRawUnsafe(`SELECT count(*)::int AS c FROM "${t}"`);
    out[t] = Number(rows[0].c);
  }
  return out;
}

async function clearProofVideos() {
  let removed = 0;
  let entries;
  try {
    entries = await readdir(MEDIA_DIR);
  } catch (err) {
    console.warn(`(skip proof-video cleanup — cannot read ${MEDIA_DIR}: ${err.message})`);
    return 0;
  }
  for (const name of entries) {
    const p = path.join(MEDIA_DIR, name);
    const s = await stat(p).catch(() => null);
    if (s && s.isFile()) {
      await unlink(p).catch(() => {});
      removed++;
    }
  }
  return removed;
}

async function main() {
  console.log('Counts BEFORE:', await counts());

  const list = TABLES.map(t => `"${t}"`).join(',');
  await prisma.$executeRawUnsafe(`TRUNCATE ${list} RESTART IDENTITY CASCADE;`);
  console.log('✅ Tables truncated.');

  const removed = await clearProofVideos();
  console.log(`✅ Proof videos removed: ${removed} file(s) from ${MEDIA_DIR}.`);

  console.log('Counts AFTER:', await counts());
  console.log('Done. Config (products/challenge/admins/settings) and e-book PDFs were NOT touched.');
}

main()
  .catch(e => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
