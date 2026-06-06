import path from 'path';
import fs from 'fs/promises';
import os from 'os';
import { saveUploadedPdf, deleteUploadedFile, UploadValidationError, MAX_UPLOAD_BYTES } from '@/lib/files';

/** Minimal stub of the web File API for saveUploadedPdf. */
function stubFile(bytes: Buffer, name = 'doc.pdf', type = 'application/pdf') {
  return {
    name,
    type,
    size: bytes.length,
    arrayBuffer: async () => bytes.buffer.slice(bytes.byteOffset, bytes.byteOffset + bytes.byteLength),
  };
}

const PDF = Buffer.concat([Buffer.from('%PDF-1.7\n'), Buffer.from('hello pdf body')]);

describe('saveUploadedPdf (D10 upload)', () => {
  let tmpDir: string;
  beforeAll(async () => {
    tmpDir = await fs.mkdtemp(path.join(os.tmpdir(), 'ebook-upload-'));
    process.env.EBOOK_FILES_DIR = tmpDir;
  });
  afterAll(async () => { await fs.rm(tmpDir, { recursive: true, force: true }); });

  it('writes a valid PDF under a random .pdf name and returns metadata', async () => {
    const saved = await saveUploadedPdf(stubFile(PDF, 'My Ebook.pdf'));
    expect(saved.filePath).toMatch(/^[a-f0-9]{32}\.pdf$/);
    expect(saved.mimeType).toBe('application/pdf');
    expect(saved.sizeBytes).toBe(PDF.length);
    const onDisk = await fs.readFile(path.join(tmpDir, saved.filePath));
    expect(onDisk.equals(PDF)).toBe(true);
  });

  it('rejects a non-PDF content-type', async () => {
    await expect(saveUploadedPdf(stubFile(PDF, 'x.pdf', 'image/png')))
      .rejects.toBeInstanceOf(UploadValidationError);
  });

  it('rejects a file without the %PDF- magic bytes', async () => {
    await expect(saveUploadedPdf(stubFile(Buffer.from('not a pdf at all'))))
      .rejects.toBeInstanceOf(UploadValidationError);
  });

  it('rejects an oversized file', async () => {
    const big = { ...stubFile(PDF), size: MAX_UPLOAD_BYTES + 1 };
    await expect(saveUploadedPdf(big)).rejects.toBeInstanceOf(UploadValidationError);
  });

  it('deleteUploadedFile removes the stored file and never throws on a missing one', async () => {
    const saved = await saveUploadedPdf(stubFile(PDF));
    await deleteUploadedFile(saved.filePath);
    await expect(fs.access(path.join(tmpDir, saved.filePath))).rejects.toThrow();
    await expect(deleteUploadedFile('does-not-exist.pdf')).resolves.toBeUndefined();
  });
});
