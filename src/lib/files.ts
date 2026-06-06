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

/** Resolves a relative path under EBOOK_FILES_DIR, rejecting traversal attempts. */
function resolveSafePath(relativeFilePath: string): string {
  if (relativeFilePath.startsWith('/') || relativeFilePath.includes('..')) {
    throw new Error(`Unsafe filePath rejected: "${relativeFilePath}"`);
  }
  const absPath = path.join(env.EBOOK_FILES_DIR, relativeFilePath);
  const safeBase = path.resolve(env.EBOOK_FILES_DIR);
  const safeAbs = path.resolve(absPath);
  if (!safeAbs.startsWith(safeBase + path.sep) && safeAbs !== safeBase) {
    throw new Error(`Path traversal rejected: "${relativeFilePath}"`);
  }
  return safeAbs;
}

/** Resolves and reads an e-book/attachment from the private EBOOK_FILES_DIR.
 *  filePath must be relative (no leading slash, no '..').
 *  Returns base64-encoded content. Throws on any path traversal attempt. */
export async function readEbookAsBase64(relativeFilePath: string): Promise<string> {
  const safeAbs = resolveSafePath(relativeFilePath);
  const buffer = await fs.readFile(safeAbs);
  return buffer.toString('base64');
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
