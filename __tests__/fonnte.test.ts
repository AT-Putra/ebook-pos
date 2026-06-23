import {
  parseFonnteSendResponse,
  isFonnteVideo,
  fonnteInboundMessageId,
  parseFonnteInbound,
  parseFonnteBody,
  verifyFonnteWebhookToken,
} from '@/lib/fonnte';

describe('parseFonnteBody (webhook body parsing, §24.4)', () => {
  it('parses a JSON body (by content-type), coercing values to strings', () => {
    const out = parseFonnteBody('application/json', JSON.stringify({ sender: '628123', message: 'hi', extension: 'mp4', id: 99 }));
    expect(out).toEqual({ sender: '628123', message: 'hi', extension: 'mp4', id: '99' });
  });
  it('detects JSON even without a content-type (leading brace)', () => {
    expect(parseFonnteBody('', '{"sender":"628","url":"https://x/y.mp4"}')).toEqual({ sender: '628', url: 'https://x/y.mp4' });
  });
  it('parses an x-www-form-urlencoded body', () => {
    const out = parseFonnteBody('application/x-www-form-urlencoded', 'sender=628123&message=hello+world');
    expect(out).toEqual({ sender: '628123', message: 'hello world' });
  });
});

describe('parseFonnteSendResponse (Fonnte /send response, §24.3)', () => {
  it('returns the first id from a success response', () => {
    expect(parseFonnteSendResponse(true, 200, { status: true, id: ['80367170'] })).toEqual({ id: '80367170' });
  });

  it('accepts a scalar id', () => {
    expect(parseFonnteSendResponse(true, 200, { status: true, id: '123' })).toEqual({ id: '123' });
  });

  it('throws with the reason when status is false', () => {
    expect(() => parseFonnteSendResponse(true, 200, { status: false, reason: 'token invalid' })).toThrow('token invalid');
  });

  it('throws on a non-ok HTTP response', () => {
    expect(() => parseFonnteSendResponse(false, 500, null)).toThrow('Fonnte send error');
  });
});

describe('isFonnteVideo (inbound attachment classification, §24.4)', () => {
  it('detects a video by url extension', () => {
    expect(isFonnteVideo({ mediaUrl: 'https://x/y.mp4', filename: null, extension: null })).toBe(true);
  });
  it('detects a video by filename (case-insensitive)', () => {
    expect(isFonnteVideo({ mediaUrl: 'https://x/y', filename: 'proof.MOV', extension: null })).toBe(true);
  });
  it('detects a video by explicit extension field', () => {
    expect(isFonnteVideo({ mediaUrl: 'https://x/y', filename: null, extension: 'mp4' })).toBe(true);
  });
  it('is false without a media url', () => {
    expect(isFonnteVideo({ mediaUrl: null, filename: 'a.mp4', extension: 'mp4' })).toBe(false);
  });
  it('is false for a non-video attachment', () => {
    expect(isFonnteVideo({ mediaUrl: 'https://x/y.pdf', filename: null, extension: 'pdf' })).toBe(false);
  });
});

describe('fonnteInboundMessageId (idempotency key, §24.4)', () => {
  const base = { sender: '628123', message: 'hi', name: null, mediaUrl: 'https://x/y.mp4', filename: null, extension: 'mp4', providedId: null };

  it('uses the provided id when present', () => {
    expect(fonnteInboundMessageId({ ...base, providedId: 'abc123' })).toBe('abc123');
  });
  it('derives a stable hashed key otherwise', () => {
    const a = fonnteInboundMessageId(base);
    const b = fonnteInboundMessageId(base);
    expect(a).toBe(b);
    expect(a.startsWith('fonnte:')).toBe(true);
  });
  it('changes when the basis changes', () => {
    expect(fonnteInboundMessageId(base)).not.toBe(fonnteInboundMessageId({ ...base, mediaUrl: 'https://x/z.mp4' }));
  });
});

describe('parseFonnteInbound (form payload, §24.4)', () => {
  it('maps known fields and treats empty strings as null', () => {
    const r = parseFonnteInbound({ sender: '628123', message: '', url: 'https://x/y.mp4', filename: 'y.mp4', extension: 'mp4', name: 'Budi' });
    expect(r).toEqual({
      sender: '628123',
      message: null,
      name: 'Budi',
      mediaUrl: 'https://x/y.mp4',
      filename: 'y.mp4',
      extension: 'mp4',
      providedId: null,
    });
  });
});

describe('verifyFonnteWebhookToken (inbound auth, §24.4)', () => {
  it('accepts the matching secret', () => {
    expect(verifyFonnteWebhookToken('test-fonnte-webhook-secret')).toBe(true);
  });
  it('rejects a wrong token', () => {
    expect(verifyFonnteWebhookToken('nope')).toBe(false);
  });
  it('rejects a missing token', () => {
    expect(verifyFonnteWebhookToken(null)).toBe(false);
  });
});
