import { z } from 'zod';
import type { AdminUser } from '@prisma/client';

/** Username: 3–32 chars, letters/digits/dot/underscore/hyphen. */
export const usernameSchema = z
  .string()
  .trim()
  .min(3, 'Username minimal 3 karakter.')
  .max(32, 'Username maksimal 32 karakter.')
  .regex(/^[a-zA-Z0-9._-]+$/, 'Username hanya boleh huruf, angka, titik, garis bawah, atau strip.');

export const nameSchema = z.string().trim().min(1, 'Nama wajib diisi.').max(80, 'Nama maksimal 80 karakter.');

export const passwordSchema = z
  .string()
  .min(8, 'Kata sandi minimal 8 karakter.')
  .max(200, 'Kata sandi maksimal 200 karakter.');

export const createUserSchema = z.object({
  username: usernameSchema,
  name: nameSchema,
  password: passwordSchema,
});

export const updateUserSchema = z
  .object({
    name: nameSchema.optional(),
    password: passwordSchema.optional(),
    isActive: z.boolean().optional(),
  })
  .refine(d => d.name !== undefined || d.password !== undefined || d.isActive !== undefined, {
    message: 'Tidak ada perubahan.',
  });

export type SerializedAdminUser = {
  id: string;
  username: string;
  name: string;
  isActive: boolean;
  lastLoginAt: string | null;
  createdAt: string;
};

/** Strip the password hash; never expose it to the client. */
export function serializeAdminUser(u: AdminUser): SerializedAdminUser {
  return {
    id: u.id,
    username: u.username,
    name: u.name,
    isActive: u.isActive,
    lastLoginAt: u.lastLoginAt ? u.lastLoginAt.toISOString() : null,
    createdAt: u.createdAt.toISOString(),
  };
}

/**
 * Anti-lockout guard. Returns an Indonesian reason string when deactivating the
 * target is NOT allowed, or null when it's fine. Only relevant for isActive=false.
 * - You cannot deactivate your own account (you'd lock yourself out mid-session).
 * - You cannot deactivate the last remaining active admin (no one could log in).
 */
export function deactivationBlock(
  targetId: string,
  currentUserId: string | null,
  activeAdminCount: number,
): string | null {
  if (currentUserId && targetId === currentUserId) {
    return 'Tidak bisa menonaktifkan akun Anda sendiri.';
  }
  if (activeAdminCount <= 1) {
    return 'Tidak bisa menonaktifkan admin aktif terakhir.';
  }
  return null;
}
