import { buildPreview, phoneFromChatId } from '@/lib/wa-log';

describe('buildPreview', () => {
  it('returns null for empty/blank input', () => {
    expect(buildPreview(null)).toBeNull();
    expect(buildPreview(undefined)).toBeNull();
    expect(buildPreview('')).toBeNull();
    expect(buildPreview('   \n  ')).toBeNull();
  });

  it('collapses whitespace/newlines into a single line', () => {
    expect(buildPreview('halo\n\n  dunia\tini')).toBe('halo dunia ini');
  });

  it('keeps short text intact', () => {
    expect(buildPreview('Terima kasih')).toBe('Terima kasih');
  });

  it('truncates long text with an ellipsis at the cap', () => {
    const out = buildPreview('a'.repeat(200), 10)!;
    expect(out.endsWith('…')).toBe(true);
    expect(out.length).toBe(10);
  });
});

describe('phoneFromChatId', () => {
  it('extracts digits from a @c.us chatId', () => {
    expect(phoneFromChatId('628123456789@c.us')).toBe('628123456789');
  });

  it('returns null for a privacy @lid id (not a phone number)', () => {
    expect(phoneFromChatId('123456789012345@lid')).toBeNull();
  });

  it('returns null for anything non-numeric', () => {
    expect(phoneFromChatId('group-123@g.us')).toBeNull();
  });
});
