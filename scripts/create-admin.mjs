#!/usr/bin/env node
/**
 * Create or update an operator account.
 * Usage: npm run admin:create
 * Env (optional — will prompt if missing): ADMIN_USERNAME, ADMIN_NAME, ADMIN_PASSWORD
 */
import { createInterface } from 'node:readline';
import { stdin as input, stdout as output } from 'node:process';
import { scrypt, randomBytes } from 'node:crypto';
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

const rl = createInterface({ input, output });

// Suppress echo while reading a hidden field (e.g. password).
let muted = false;
const realWrite = rl._writeToOutput.bind(rl);
rl._writeToOutput = str => {
  if (!muted) realWrite(str);
};

function ask(query, hide = false) {
  return new Promise(resolve => {
    muted = false;
    rl.question(query, answer => {
      if (hide) output.write('\n');
      muted = false;
      resolve(answer.trim());
    });
    muted = hide; // mute keystroke echo after the prompt itself is printed
  });
}

const adapter = new PrismaPg({ connectionString: process.env.DATABASE_URL });
const prisma = new PrismaClient({ adapter });

async function main() {
  console.log('=== Create / update admin account ===\n');

  const username = process.env.ADMIN_USERNAME || (await ask('Username: '));
  const name = process.env.ADMIN_NAME || (await ask('Full name: '));
  const password = process.env.ADMIN_PASSWORD || (await ask('Password: ', true));
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
