import { canTransition, generateOrderCode, decideCheckoutAction, shouldSetTracking } from '@/lib/orders';
import { OrderStatus } from '@prisma/client';

type O = { status: OrderStatus; snapRedirectUrl: string | null };
const o = (status: OrderStatus, snapRedirectUrl: string | null = 'https://pay'): O => ({ status, snapRedirectUrl });

describe('decideCheckoutAction (checkout dedup, §27)', () => {
  it('no existing orders → new', () => {
    expect(decideCheckoutAction([])).toEqual({ kind: 'new' });
  });
  it('any PAID order → already_paid (PAID wins over a newer pending)', () => {
    const orders = [o(OrderStatus.PENDING), o(OrderStatus.PAID)];
    expect(decideCheckoutAction(orders)).toEqual({ kind: 'already_paid', order: orders[1] });
  });
  it('latest PENDING with a URL → continue', () => {
    const orders = [o(OrderStatus.PENDING, 'https://pay/x')];
    expect(decideCheckoutAction(orders).kind).toBe('continue');
  });
  it('latest PENDING without a URL → renew', () => {
    expect(decideCheckoutAction([o(OrderStatus.PENDING, null)]).kind).toBe('renew');
  });
  it('latest EXPIRED → renew', () => {
    expect(decideCheckoutAction([o(OrderStatus.EXPIRED, null)]).kind).toBe('renew');
  });
  it('latest FAILED/CANCELLED/REFUNDED → new', () => {
    expect(decideCheckoutAction([o(OrderStatus.FAILED)]).kind).toBe('new');
    expect(decideCheckoutAction([o(OrderStatus.CANCELLED)]).kind).toBe('new');
    expect(decideCheckoutAction([o(OrderStatus.REFUNDED)]).kind).toBe('new');
  });
});

describe('shouldSetTracking (§27)', () => {
  it('sets when existing is empty and incoming present', () => {
    expect(shouldSetTracking(null, 'ad123')).toBe(true);
    expect(shouldSetTracking('', 'ad123')).toBe(true);
    expect(shouldSetTracking('   ', 'ad123')).toBe(true);
  });
  it('does not overwrite an existing value', () => {
    expect(shouldSetTracking('old', 'new')).toBe(false);
  });
  it('does nothing without an incoming value', () => {
    expect(shouldSetTracking(null, undefined)).toBe(false);
    expect(shouldSetTracking(null, '  ')).toBe(false);
  });
});

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
