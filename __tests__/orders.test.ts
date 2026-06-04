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

  it('allows same status → same status (idempotent)', () => {
    expect(canTransition(OrderStatus.PAID, OrderStatus.PAID)).toBe(true);
    expect(canTransition(OrderStatus.PENDING, OrderStatus.PENDING)).toBe(true);
  });

  it('allows PAID → REFUNDED', () => {
    expect(canTransition(OrderStatus.PAID, OrderStatus.REFUNDED)).toBe(true);
  });

  it('blocks EXPIRED → PAID', () => {
    expect(canTransition(OrderStatus.EXPIRED, OrderStatus.PAID)).toBe(false);
  });
});
