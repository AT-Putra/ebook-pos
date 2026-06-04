import path from 'path';
import fs from 'fs/promises';
import { env } from './env';

/** Resolves and reads an e-book from the private EBOOK_FILES_DIR.
 *  filePath must be relative (no leading slash, no '..').
 *  Returns base64-encoded content. Throws on any path traversal attempt. */
export async function readEbookAsBase64(relativeFilePath: string): Promise<string> {
  if (relativeFilePath.startsWith('/') || relativeFilePath.includes('..')) {
    throw new Error(`Unsafe filePath rejected: "${relativeFilePath}"`);
  }

  const absPath = path.join(env.EBOOK_FILES_DIR, relativeFilePath);

  // Double-check the resolved path is still under EBOOK_FILES_DIR.
  const safeBase = path.resolve(env.EBOOK_FILES_DIR);
  const safeAbs = path.resolve(absPath);
  if (!safeAbs.startsWith(safeBase + path.sep) && safeAbs !== safeBase) {
    throw new Error(`Path traversal rejected: "${relativeFilePath}"`);
  }

  const buffer = await fs.readFile(safeAbs);
  return buffer.toString('base64');
}
