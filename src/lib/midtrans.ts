import crypto from 'crypto';
import { env } from './env';
import { OrderStatus } from '@prisma/client';

// Computed at call time (not module load) so env is not accessed before it's validated.
function snapBase(): string {
  return env.MIDTRANS_IS_PRODUCTION
    ? 'https://app.midtrans.com/snap/v1'
    : 'https://app.sandbox.midtrans.com/snap/v1';
}

function basicAuth(): string {
  return 'Basic ' + Buffer.from(env.MIDTRANS_SERVER_KEY + ':').toString('base64');
}

export type SnapTransactionParams = {
  orderId: string;
  grossAmount: number;
  productId: string;
  productName: string;
  customerName: string;
  customerEmail: string;
  customerPhone: string;
};

export type SnapResult = {
  token: string;
  redirect_url: string;
};

/** Creates a Midtrans Snap transaction and returns the token + redirect URL. */
export async function createSnapTransaction(p: SnapTransactionParams): Promise<SnapResult> {
  const body = {
    transaction_details: {
      order_id: p.orderId,
      gross_amount: p.grossAmount,
    },
    item_details: [
      {
        id: p.productId,
        price: p.grossAmount,
        quantity: 1,
        name: p.productName.slice(0, 50), // Midtrans caps item name at 50 chars
      },
    ],
    customer_details: {
      first_name: p.customerName,
      email: p.customerEmail,
      phone: p.customerPhone,
    },
    callbacks: {
      finish: `${env.APP_BASE_URL}/thank-you`,
    },
  };

  const res = await fetch(`${snapBase()}/transactions`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: basicAuth(),
    },
    body: JSON.stringify(body),
  });

  if (!res.ok) {
    const text = await res.text();
    throw new Error(`Midtrans Snap error (${res.status}): ${text}`);
  }

  return res.json() as Promise<SnapResult>;
}

/** Verifies the Midtrans webhook signature (INVARIANT — never skip). */
export function verifySignature(params: {
  orderId: string;
  statusCode: string;
  grossAmount: string; // exact string from payload
  signatureKey: string;
}): boolean {
  const expected = crypto
    .createHash('sha512')
    .update(params.orderId + params.statusCode + params.grossAmount + env.MIDTRANS_SERVER_KEY)
    .digest('hex');
  // Constant-time compare to avoid leaking signature bytes via timing.
  const a = Buffer.from(expected, 'hex');
  const b = Buffer.from(params.signatureKey, 'hex');
  if (a.length !== b.length) return false;
  return crypto.timingSafeEqual(a, b);
}

/** Maps Midtrans transaction_status + fraud_status → OrderStatus. */
export function mapMidtransStatus(
  transactionStatus: string,
  fraudStatus?: string | null,
): OrderStatus | null {
  switch (transactionStatus) {
    case 'capture':
      return fraudStatus === 'challenge' ? OrderStatus.PENDING : OrderStatus.PAID;
    case 'settlement':
      return OrderStatus.PAID;
    case 'pending':
      return OrderStatus.PENDING;
    case 'deny':
      return OrderStatus.FAILED;
    case 'cancel':
      return OrderStatus.CANCELLED;
    case 'expire':
      return OrderStatus.EXPIRED;
    case 'refund':
    case 'partial_refund':
      return OrderStatus.REFUNDED;
    default:
      return null; // unknown status — caller should log and ignore
  }
}
