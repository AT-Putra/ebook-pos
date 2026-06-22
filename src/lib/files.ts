import path from 'path';
import fs from 'fs/promises';
import { randomBytes } from 'crypto';
import { env } from './env';

/** Max size for an uploaded PDF (e-book or attachment). Base64 inflates ~33%,
 *  so 32 MB is ~43 MB to WAHA — confirm the provider/Caddy allow it (PRD section 16 Q5 / 18). */
export const MAX_UPLOAD_BYTES = 32 * 1024 * 1024;

/** Thrown when an uploaded file fails validation (caller maps to HTTP 422). */
export class UploadValidationError extends Error {}

/** The subset of the web `File` API we need (so it's easy to test with a stub). */
export type UploadFile = {
  name: string;
  type: string;
  size: number;
  arrayBuffer(): Promise<ArrayBuffer>;
};

export type SavedFile = {
  filePath: string; // relative to EBOOK_FILES_DIR
  fileName: string; // sanitized original name (buyer-facing default)
  mimeType: string;
  sizeBytes: number;
};

/** Resolves a relative path under `baseDir`, rejecting traversal attempts. */
function resolveUnder(baseDir: string, relativeFilePath: string): string {
  if (relativeFilePath.startsWith('/') || relativeFilePath.includes('..')) {
    throw new Error(`Unsafe filePath rejected: "${relativeFilePath}"`);
  }
  const safeBase = path.resolve(baseDir);
  const safeAbs = path.resolve(path.join(baseDir, relativeFilePath));
  if (!safeAbs.startsWith(safeBase + path.sep) && safeAbs !== safeBase) {
    throw new Error(`Path traversal rejected: "${relativeFilePath}"`);
  }
  return safeAbs;
}

/** Resolves a relative path under EBOOK_FILES_DIR, rejecting traversal attempts. */
function resolveSafePath(relativeFilePath: string): string {
  return resolveUnder(env.EBOOK_FILES_DIR, relativeFilePath);
}

/** Resolves and reads an e-book/attachment from the private EBOOK_FILES_DIR.
 *  filePath must be relative (no leading slash, no '..').
 *  Returns base64-encoded content. Throws on any path traversal attempt. */
export async function readEbookAsBase64(relativeFilePath: string): Promise<string> {
  const safeAbs = resolveSafePath(relativeFilePath);
  const buffer = await fs.readFile(safeAbs);
  return buffer.toString('base64');
}

/** Resolves and reads an e-book/attachment from the private EBOOK_FILES_DIR as raw bytes.
 *  Used by the email fallback (D14) to attach files as binary content (never a URL). */
export async function readEbookAsBuffer(relativeFilePath: string): Promise<Buffer> {
  const safeAbs = resolveSafePath(relativeFilePath);
  return fs.readFile(safeAbs);
}

/** Keeps just the basename of an upload's name, stripped of control/separator chars.
 *  This is only the buyer-facing label; the stored file uses a random name. */
function sanitizeFileName(name: string): string {
  const base = path.basename(name)
    .split('')
    .filter(ch => {
      const code = ch.charCodeAt(0);
      return code >= 0x20 && ch !== '/' && ch !== '\\';
    })
    .join('')
    .trim();
  return base.length > 0 ? base.slice(0, 200) : 'document.pdf';
}

/**
 * Validates an uploaded PDF (content-type + %PDF magic bytes + size) and writes it
 * privately into EBOOK_FILES_DIR under a generated, traversal-safe name (`<rand>.pdf`).
 * Writes to a temp file then renames so a partial upload never becomes the live file.
 * NEVER writes under public/ and never exposes a URL (invariant #4).
 */
export async function saveUploadedPdf(file: UploadFile): Promise<SavedFile> {
  const limitMb = Math.round(MAX_UPLOAD_BYTES / (1024 * 1024));
  if (file.size > MAX_UPLOAD_BYTES) {
    throw new UploadValidationError(`Ukuran file melebihi batas ${limitMb} MB.`);
  }
  if (file.type && file.type !== 'application/pdf') {
    throw new UploadValidationError('File harus berupa PDF.');
  }

  const buffer = Buffer.from(await file.arrayBuffer());
  if (buffer.length > MAX_UPLOAD_BYTES) {
    throw new UploadValidationError(`Ukuran file melebihi batas ${limitMb} MB.`);
  }
  // Magic-byte check — a real PDF starts with "%PDF-".
  if (buffer.length < 5 || buffer.subarray(0, 5).toString('latin1') !== '%PDF-') {
    throw new UploadValidationError('File bukan PDF yang valid.');
  }

  await fs.mkdir(path.resolve(env.EBOOK_FILES_DIR), { recursive: true });

  const relativeName = `${randomBytes(16).toString('hex')}.pdf`;
  const finalAbs = resolveSafePath(relativeName);
  const tmpAbs = `${finalAbs}.tmp`;

  await fs.writeFile(tmpAbs, buffer);
  await fs.rename(tmpAbs, finalAbs);

  return {
    filePath: relativeName,
    fileName: sanitizeFileName(file.name),
    mimeType: 'application/pdf',
    sizeBytes: buffer.length,
  };
}

/** Best-effort delete of a stored file (e.g. when replacing/removing). Never throws. */
export async function deleteUploadedFile(relativeFilePath: string): Promise<void> {
  try {
    const safeAbs = resolveSafePath(relativeFilePath);
    await fs.unlink(safeAbs);
  } catch {
    // best-effort: a missing/locked file shouldn't fail the admin operation
  }
}

// ── Challenge proof videos — private, under CHALLENGE_MEDIA_DIR (§21) ────────

const EXT_BY_MIME: Record<string, string> = {
  'video/mp4': 'mp4',
  'video/quicktime': 'mov',
  'video/3gpp': '3gp',
  'video/webm': 'webm',
};

/** Writes an inbound proof video privately into CHALLENGE_MEDIA_DIR (random name, atomic).
 *  Returns the relative path stored on the submission. Never under public/. */
export async function saveChallengeMedia(buffer: Buffer, mimeType: string): Promise<string> {
  await fs.mkdir(path.resolve(env.CHALLENGE_MEDIA_DIR), { recursive: true });
  const ext = EXT_BY_MIME[mimeType] ?? 'mp4';
  const relativeName = `${randomBytes(16).toString('hex')}.${ext}`;
  const finalAbs = resolveUnder(env.CHALLENGE_MEDIA_DIR, relativeName);
  const tmpAbs = `${finalAbs}.tmp`;
  await fs.writeFile(tmpAbs, buffer);
  await fs.rename(tmpAbs, finalAbs);
  return relativeName;
}

/** Reads a stored proof video (for streaming to an authenticated admin only). */
export async function readChallengeMedia(relativeFilePath: string): Promise<Buffer> {
  const safeAbs = resolveUnder(env.CHALLENGE_MEDIA_DIR, relativeFilePath);
  return fs.readFile(safeAbs);
}
