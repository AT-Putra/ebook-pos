#!/usr/bin/env node
/**
 * Create or update an operator account.
 * Usage: npm run admin:create
 * Env (optional — will prompt if missing): ADMIN_USERNAME, ADMIN_NAME, ADMIN_PASSWORD
 */
import { createInterface } from 'node:readline/promises';
import { stdin as input, stdout as output } from 'node:process';
import { scrypt, randomBytes, timingSafeEqual } from 'node:crypto';
import { promisify } from 'node:util';
import { PrismaClient } from '@prisma/client';
import { PrismaPg } from '@prisma/adapter-pg';

const scryptAsync = promisify(scrypt);
const KEYLEN = 64;

async function hashPassword(password) {
  const salt = randomBytes(16).toString('hex');
  const hash = await scryptAsync(password, salt, KEYLEN);
  return `scrypt$${salt}$${hash.toString('hex')}`;
}

const adapter = new PrismaPg({ connectionString: process.env.DATABASE_URL });
const prisma = new PrismaClient({ adapter });

const rl = createInterface({ input, output });

async function prompt(question) {
  return (await rl.question(question)).trim();
}

async function main() {
  console.log('=== Create / update admin account ===\n');

  const username = process.env.ADMIN_USERNAME || await prompt('Username: ');
  const name     = process.env.ADMIN_NAME     || await prompt('Full name: ');
  const password = process.env.ADMIN_PASSWORD || await prompt('Password (hidden in terminal): ');
  rl.close();

  if (!username || !password) {
    console.error('Username and password are required.');
    process.exit(1);
  }

  const passwordHash = await hashPassword(password);

  const user = await prisma.adminUser.upsert({
    where: { username },
    create: { username, name: name || username, passwordHash },
    update: { name: name || undefined, passwordHash },
  });

  console.log(`\n✓ Account saved: ${user.username} (${user.name}) — id: ${user.id}`);
}

main()
  .catch(e => { console.error(e); process.exit(1); })
  .finally(() => prisma.$disconnect());
