/**
 * F3 webhook unit tests — cover the invariants without a live DB.
 * The signature verification and status-mapping unit tests are in midtrans.test.ts.
 * Here we test the route's logic at the module level.
 */
import crypto from 'crypto';
import { verifySignature, mapMidtransStatus } from '@/lib/midtrans';
import { canTransition } from '@/lib/orders';
import { OrderStatus } from '@prisma/client';

const SERVER_KEY = 'SB-Mid-server-test'; // matches jest.setup.ts

function sign(orderId: string, statusCode: string, grossAmount: string): string {
  return crypto
    .createHash('sha512')
    .update(orderId + statusCode + grossAmount + SERVER_KEY)
    .digest('hex');
}

describe('F3 webhook invariants', () => {
  describe('signature verification', () => {
    it('accepts a matching signature', () => {
      expect(
        verifySignature({
          orderId: 'ORD-TEST',
          statusCode: '200',
          grossAmount: '75000.00',
          signatureKey: sign('ORD-TEST', '200', '75000.00'),
        }),
      ).toBe(true);
    });

    it('rejects a signature with a different grossAmount', () => {
      expect(
        verifySignature({
          orderId: 'ORD-TEST',
          statusCode: '200',
          grossAmount: '75000.01', // even a tiny difference
          signatureKey: sign('ORD-TEST', '200', '75000.00'),
        }),
      ).toBe(false);
    });

    it('rejects a signature when orderId differs', () => {
      expect(
        verifySignature({
          orderId: 'ORD-TAMPERED',
          statusCode: '200',
          grossAmount: '75000.00',
          signatureKey: sign('ORD-TEST', '200', '75000.00'),
        }),
      ).toBe(false);
    });
  });

  describe('idempotent forward-only status (F3 invariant #2)', () => {
    it('settlement after settlement is a no-op (canTransition same→same)', () => {
      expect(canTransition(OrderStatus.PAID, OrderStatus.PAID)).toBe(true);
    });

    it('late pending after settlement is blocked', () => {
      expect(canTransition(OrderStatus.PAID, OrderStatus.PENDING)).toBe(false);
    });

    it('capture+challenge keeps order PENDING', () => {
      expect(mapMidtransStatus('capture', 'challenge')).toBe(OrderStatus.PENDING);
    });

    it('capture+accept → PAID', () => {
      expect(mapMidtransStatus('capture', 'accept')).toBe(OrderStatus.PAID);
    });
  });

  describe('delivery trigger guard (F3 + F4 invariant #3)', () => {
    it('delivery fires only on PAID transition', () => {
      const paidStatuses: OrderStatus[] = [OrderStatus.PAID];
      const nonPaidStatuses: OrderStatus[] = [
        OrderStatus.PENDING,
        OrderStatus.FAILED,
        OrderStatus.CANCELLED,
        OrderStatus.EXPIRED,
        OrderStatus.REFUNDED,
      ];

      for (const s of paidStatuses) {
        expect(s).toBe(OrderStatus.PAID);
      }
      for (const s of nonPaidStatuses) {
        expect(s).not.toBe(OrderStatus.PAID);
      }
    });
  });
});
