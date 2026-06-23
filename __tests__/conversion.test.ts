import { renderPostbackUrl, validatePostbackUrl } from '@/lib/conversion';

describe('renderPostbackUrl (D17, §26)', () => {
  it('substitutes all macros, URL-encoding values', () => {
    const out = renderPostbackUrl('https://p.com/cb?clickid={trxid}&payout={amount}&o={orderid}', {
      trxid: 'abc 123&x',
      amount: 75000,
      orderCode: 'ORD-1',
    });
    expect(out).toBe('https://p.com/cb?clickid=abc%20123%26x&payout=75000&o=ORD-1');
  });

  it('only replaces macros present in the template ({amount}/{orderid} optional)', () => {
    expect(renderPostbackUrl('https://p.com/cb?c={trxid}', { trxid: 'T', amount: 1, orderCode: 'O' }))
      .toBe('https://p.com/cb?c=T');
  });

  it('replaces repeated macros', () => {
    expect(renderPostbackUrl('https://p.com/{trxid}/{trxid}', { trxid: 'T', amount: 1, orderCode: 'O' }))
      .toBe('https://p.com/T/T');
  });
});

describe('validatePostbackUrl', () => {
  it('accepts an https URL containing {trxid}', () => {
    expect(validatePostbackUrl('https://p.com/cb?c={trxid}')).toEqual({ ok: true });
  });
  it('rejects a non-https URL', () => {
    const r = validatePostbackUrl('http://p.com/cb?c={trxid}');
    expect(r.ok).toBe(false);
  });
  it('rejects a URL missing {trxid}', () => {
    const r = validatePostbackUrl('https://p.com/cb?c={amount}');
    expect(r.ok).toBe(false);
  });
});
