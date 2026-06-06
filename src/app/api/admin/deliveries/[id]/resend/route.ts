import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { requireAdmin } from '@/lib/auth';
import { db } from '@/lib/db';
import { DeliveryStatus } from '@prisma/client';
import { normalizeIndonesianPhone, PhoneNormalizationError } from '@/lib/phone';
import { attemptDelivery } from '@/lib/delivery';

const resendBodySchema = z.object({
  whatsapp: z.string().optional(), // optional corrected WhatsApp number
});

type Props = {
  params: Promise<{ id: string }>;
};

export async function POST(req: NextRequest, { params }: Props) {
  if (!(await requireAdmin(req))) {
    return NextResponse.json({ error: 'Unauthorized.' }, { status: 401 });
  }

  const { id } = await params;

  const delivery = await db.delivery.findUnique({
    where: { id },
    include: { order: { include: { customer: true } } },
  });

  if (!delivery) {
    return NextResponse.json({ error: 'Delivery not found.' }, { status: 404 });
  }

  // Parse optional corrected number.
  let body: z.infer<typeof resendBodySchema> = {};
  try {
    body = resendBodySchema.parse(await req.json().catch(() => ({})));
  } catch {
    return NextResponse.json({ error: 'Invalid request body.' }, { status: 400 });
  }

  // If a corrected number is provided, validate and update the customer record.
  if (body.whatsapp) {
    let normalized: string;
    try {
      normalized = normalizeIndonesianPhone(body.whatsapp);
    } catch (err) {
      return NextResponse.json(
        { error: err instanceof PhoneNormalizationError ? err.message : 'Invalid WhatsApp number.' },
        { status: 422 },
      );
    }

    await db.customer.update({
      where: { id: delivery.order.customerId },
      data: { whatsapp: normalized },
    });
  }

  // Reset delivery (and every file item) to PENDING so the whole package is re-sent.
  // A manual operator resend is explicit — exactly-once applies to the automatic path.
  await db.delivery.update({
    where: { id },
    data: {
      status: DeliveryStatus.PENDING,
      nextRetryAt: null,
      lastError: null,
    },
  });
  await db.deliveryItem.updateMany({
    where: { deliveryId: id },
    data: { status: DeliveryStatus.PENDING, sentAt: null, lastError: null },
  });

  // Attempt immediately.
  await attemptDelivery(id);

  const updated = await db.delivery.findUniqueOrThrow({ where: { id } });
  return NextResponse.json({ delivery: updated });
}
