import { BACKOFF_MINUTES, buildDeliverySnapshot, allItemsSent } from '@/lib/delivery';
import { DeliveryStatus } from '@prisma/client';
import { readEbookAsBase64 } from '@/lib/files';
import path from 'path';
import fs from 'fs/promises';
import os from 'os';

describe('BACKOFF_MINUTES (F5 backoff schedule)', () => {
  it('has 5 entries matching default maxAttempts', () => {
    expect(BACKOFF_MINUTES).toHaveLength(5);
  });

  it('is strictly increasing', () => {
    for (let i = 1; i < BACKOFF_MINUTES.length; i++) {
      expect(BACKOFF_MINUTES[i]).toBeGreaterThan(BACKOFF_MINUTES[i - 1]);
    }
  });

  it('starts at 1 minute and ends at >= 60 minutes', () => {
    expect(BACKOFF_MINUTES[0]).toBe(1);
    expect(BACKOFF_MINUTES[BACKOFF_MINUTES.length - 1]).toBeGreaterThanOrEqual(60);
  });
});

describe('readEbookAsBase64 (F4 file safety)', () => {
  let tmpDir: string;

  beforeAll(async () => {
    tmpDir = await fs.mkdtemp(path.join(os.tmpdir(), 'ebook-test-'));
    // Override EBOOK_FILES_DIR to point at tmpDir for these tests.
    process.env.EBOOK_FILES_DIR = tmpDir;
  });

  afterAll(async () => {
    await fs.rm(tmpDir, { recursive: true, force: true });
  });

  it('reads a real file and returns base64', async () => {
    const content = 'hello ebook';
    await fs.writeFile(path.join(tmpDir, 'test.pdf'), content);
    const b64 = await readEbookAsBase64('test.pdf');
    expect(Buffer.from(b64, 'base64').toString()).toBe(content);
  });

  it('rejects a path with ".."', async () => {
    await expect(readEbookAsBase64('../etc/passwd')).rejects.toThrow();
  });

  it('rejects an absolute path', async () => {
    await expect(readEbookAsBase64('/etc/passwd')).rejects.toThrow();
  });
});

describe('buildDeliverySnapshot (D10 multi-file delivery)', () => {
  const product = { filePath: 'ebook.pdf', fileName: 'E-book.pdf' };

  it('puts the e-book first (sortOrder 0), then attachments re-indexed from 1', () => {
    const snap = buildDeliverySnapshot(product, [
      { filePath: 'b.pdf', fileName: 'B.pdf', sortOrder: 5 },
      { filePath: 'a.pdf', fileName: 'A.pdf', sortOrder: 2 },
    ]);
    expect(snap.map(s => [s.kind, s.fileName, s.sortOrder])).toEqual([
      ['ebook', 'E-book.pdf', 0],
      ['attachment', 'A.pdf', 1], // sortOrder 2 comes before 5
      ['attachment', 'B.pdf', 2],
    ]);
  });

  it('returns just the e-book when there are no attachments', () => {
    const snap = buildDeliverySnapshot(product, []);
    expect(snap).toHaveLength(1);
    expect(snap[0].kind).toBe('ebook');
  });
});

describe('allItemsSent', () => {
  it('is true only when every item is SENT', () => {
    expect(allItemsSent([{ status: DeliveryStatus.SENT }, { status: DeliveryStatus.SENT }])).toBe(true);
    expect(allItemsSent([{ status: DeliveryStatus.SENT }, { status: DeliveryStatus.FAILED }])).toBe(false);
    expect(allItemsSent([{ status: DeliveryStatus.PENDING }])).toBe(false);
  });

  it('is false for an empty list (nothing to deliver should not look "complete")', () => {
    expect(allItemsSent([])).toBe(false);
  });
});
