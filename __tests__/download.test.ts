import {
  generateDownloadToken,
  buildDownloadLink,
  renderLinkMessage,
  DEFAULT_LINK_MESSAGE_TEMPLATE,
} from '@/lib/download';

describe('generateDownloadToken (D16, §25)', () => {
  it('produces a 22-char URL-safe base64url token (16 bytes / 128-bit)', () => {
    const t = generateDownloadToken();
    expect(t).toHaveLength(22);
    expect(t).toMatch(/^[A-Za-z0-9_-]+$/);
  });
  it('is unique across calls', () => {
    const set = new Set(Array.from({ length: 100 }, () => generateDownloadToken()));
    expect(set.size).toBe(100);
  });
});

describe('buildDownloadLink', () => {
  it('builds /download/<token>', () => {
    expect(buildDownloadLink('https://shop.example.com', 'ABC')).toBe('https://shop.example.com/download/ABC');
  });
  it('strips a trailing slash on the base url', () => {
    expect(buildDownloadLink('https://shop.example.com/', 'ABC')).toBe('https://shop.example.com/download/ABC');
  });
});

describe('renderLinkMessage', () => {
  const vars = { name: 'Budi', product: 'E-book Diet', link: 'https://x/download/T' };

  it('substitutes all placeholders (incl. repeats)', () => {
    const out = renderLinkMessage('Hi {{name}}, {{product}} → {{link}} ({{link}})', vars);
    expect(out).toBe('Hi Budi, E-book Diet → https://x/download/T (https://x/download/T)');
  });
  it('falls back to the default template when null', () => {
    const out = renderLinkMessage(null, vars);
    expect(out).toContain(vars.link);
    expect(out).toContain('Budi');
    expect(out).toContain('E-book Diet');
  });
  it('falls back to the default when blank/whitespace', () => {
    expect(renderLinkMessage('   ', vars)).toBe(renderLinkMessage(null, vars));
  });
  it('the default template carries the link placeholder', () => {
    expect(DEFAULT_LINK_MESSAGE_TEMPLATE).toContain('{{link}}');
  });
});
