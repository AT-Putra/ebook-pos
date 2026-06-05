import { canTransition, generateOrderCode } from '@/lib/orders';
import { OrderStatus } from '@prisma/client';

describe('generateOrderCode', () => {
  it('matches format ORD-YYYYMMDD-XXXXXXXX', () => {
    const code = generateOrderCode();
    expect(code).toMatch(/^ORD-\d{8}-[A-Z0-9]{8}$/);
  });

  it('generates unique codes on repeated calls', () => {
    const codes = new Set(Array.from({ length: 100 }, generateOrderCode));
    expect(codes.size).toBe(100);
  });
});

describe('canTransition (forward-only status)', () => {
  it('allows PENDING → PAID', () => {
    expect(canTransition(OrderStatus.PENDING, OrderStatus.PAID)).toBe(true);
  });

  it('allows PENDING → FAILED', () => {
    expect(canTransition(OrderStatus.PENDING, OrderStatus.FAILED)).toBe(true);
  });

  it('blocks PAID → PENDING (late notification must be ignored)', () => {
    expect(canTransition(OrderStatus.PAID, OrderStatus.PENDING)).toBe(false);
  });

  it('treats same status → same status as a no-op (not a transition)', () => {
    expect(canTransition(OrderStatus.PAID, OrderStatus.PAID)).toBe(false);
    expect(canTransition(OrderStatus.PENDING, OrderStatus.PENDING)).toBe(false);
  });

  it('allows PAID → REFUNDED', () => {
    expect(canTransition(OrderStatus.PAID, OrderStatus.REFUNDED)).toBe(true);
  });

  it('blocks PAID being overwritten by a late failure notification', () => {
    expect(canTransition(OrderStatus.PAID, OrderStatus.EXPIRED)).toBe(false);
    expect(canTransition(OrderStatus.PAID, OrderStatus.FAILED)).toBe(false);
    expect(canTransition(OrderStatus.PAID, OrderStatus.CANCELLED)).toBe(false);
  });

  it('keeps terminal states terminal', () => {
    expect(canTransition(OrderStatus.EXPIRED, OrderStatus.PAID)).toBe(false);
    expect(canTransition(OrderStatus.FAILED, OrderStatus.PAID)).toBe(false);
    expect(canTransition(OrderStatus.REFUNDED, OrderStatus.PAID)).toBe(false);
  });
});
