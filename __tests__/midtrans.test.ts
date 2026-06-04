import crypto from 'crypto';
import { verifySignature, mapMidtransStatus } from '@/lib/midtrans';
import { OrderStatus } from '@prisma/client';

// The test env has MIDTRANS_SERVER_KEY = 'SB-Mid-server-test' (set in jest.setup.ts).
const SERVER_KEY = 'SB-Mid-server-test';

function makeSignature(orderId: string, statusCode: string, grossAmount: string): string {
  return crypto
    .createHash('sha512')
    .update(orderId + statusCode + grossAmount + SERVER_KEY)
    .digest('hex');
}

describe('verifySignature', () => {
  it('accepts a valid signature', () => {
    const sig = makeSignature('ORD-20260604-ABCD1234', '200', '75000.00');
    expect(
      verifySignature({
        orderId: 'ORD-20260604-ABCD1234',
        statusCode: '200',
        grossAmount: '75000.00',
        signatureKey: sig,
      }),
    ).toBe(true);
  });

  it('rejects a tampered signature', () => {
    const sig = makeSignature('ORD-20260604-ABCD1234', '200', '75000.00');
    expect(
      verifySignature({
        orderId: 'ORD-20260604-ABCD1234',
        statusCode: '200',
        grossAmount: '99999.00', // tampered amount
        signatureKey: sig,
      }),
    ).toBe(false);
  });

  it('uses the exact grossAmount string (e.g. "75000.00" not "75000")', () => {
    // "75000.00" and "75000" must produce different hashes
    const sig1 = makeSignature('ORD-X', '200', '75000.00');
    const sig2 = makeSignature('ORD-X', '200', '75000');
    expect(sig1).not.toBe(sig2);
  });
});

describe('mapMidtransStatus', () => {
  it.each([
    ['settlement', undefined, OrderStatus.PAID],
    ['capture', 'accept', OrderStatus.PAID],
    ['capture', 'challenge', OrderStatus.PENDING],
    ['pending', undefined, OrderStatus.PENDING],
    ['deny', undefined, OrderStatus.FAILED],
    ['cancel', undefined, OrderStatus.CANCELLED],
    ['expire', undefined, OrderStatus.EXPIRED],
    ['refund', undefined, OrderStatus.REFUNDED],
    ['partial_refund', undefined, OrderStatus.REFUNDED],
  ] as const)('maps %s/%s → %s', (txStatus, fraud, expected) => {
    expect(mapMidtransStatus(txStatus, fraud)).toBe(expected);
  });

  it('returns null for unknown transaction_status', () => {
    expect(mapMidtransStatus('unknown_status')).toBeNull();
  });
});
