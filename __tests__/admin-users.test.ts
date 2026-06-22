import {
  createUserSchema,
  updateUserSchema,
  serializeAdminUser,
  deactivationBlock,
} from '@/lib/admin-users';
import type { AdminUser } from '@prisma/client';

describe('createUserSchema', () => {
  it('accepts a valid account', () => {
    const r = createUserSchema.safeParse({ username: 'operator2', name: 'Operator Dua', password: 'rahasia123' });
    expect(r.success).toBe(true);
  });

  it('rejects short username / bad chars / short password', () => {
    expect(createUserSchema.safeParse({ username: 'op', name: 'X', password: 'rahasia123' }).success).toBe(false);
    expect(createUserSchema.safeParse({ username: 'op rator', name: 'X', password: 'rahasia123' }).success).toBe(false);
    expect(createUserSchema.safeParse({ username: 'operator', name: 'X', password: 'short' }).success).toBe(false);
  });

  it('trims username and name', () => {
    const r = createUserSchema.safeParse({ username: '  operator2 ', name: '  Dua ', password: 'rahasia123' });
    expect(r.success && r.data.username).toBe('operator2');
    expect(r.success && r.data.name).toBe('Dua');
  });
});

describe('updateUserSchema', () => {
  it('accepts a single field', () => {
    expect(updateUserSchema.safeParse({ name: 'Baru' }).success).toBe(true);
    expect(updateUserSchema.safeParse({ isActive: false }).success).toBe(true);
    expect(updateUserSchema.safeParse({ password: 'rahasia123' }).success).toBe(true);
  });

  it('rejects an empty patch', () => {
    expect(updateUserSchema.safeParse({}).success).toBe(false);
  });
});

describe('serializeAdminUser', () => {
  it('strips the password hash and ISO-formats dates', () => {
    const u = {
      id: 'u1', username: 'op', name: 'Op', passwordHash: 'scrypt$x$y', isActive: true,
      lastLoginAt: new Date('2026-06-22T03:00:00.000Z'), createdAt: new Date('2026-06-01T00:00:00.000Z'),
      updatedAt: new Date('2026-06-01T00:00:00.000Z'),
    } as AdminUser;
    const s = serializeAdminUser(u);
    expect(s).not.toHaveProperty('passwordHash');
    expect(s.lastLoginAt).toBe('2026-06-22T03:00:00.000Z');
    expect(s.createdAt).toBe('2026-06-01T00:00:00.000Z');
  });

  it('keeps lastLoginAt null when never logged in', () => {
    const u = {
      id: 'u1', username: 'op', name: 'Op', passwordHash: 'h', isActive: false,
      lastLoginAt: null, createdAt: new Date('2026-06-01T00:00:00.000Z'), updatedAt: new Date(),
    } as AdminUser;
    expect(serializeAdminUser(u).lastLoginAt).toBeNull();
  });
});

describe('deactivationBlock', () => {
  it('blocks deactivating yourself', () => {
    expect(deactivationBlock('u1', 'u1', 5)).toMatch(/sendiri/);
  });

  it('blocks deactivating the last active admin', () => {
    expect(deactivationBlock('u2', 'u1', 1)).toMatch(/terakhir/);
  });

  it('allows deactivating another admin when others remain', () => {
    expect(deactivationBlock('u2', 'u1', 3)).toBeNull();
  });

  it('bearer caller (null current user) only blocked by last-admin rule', () => {
    expect(deactivationBlock('u2', null, 2)).toBeNull();
    expect(deactivationBlock('u2', null, 1)).toMatch(/terakhir/);
  });
});
