import { BACKOFF_MINUTES } from '@/lib/delivery';
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
