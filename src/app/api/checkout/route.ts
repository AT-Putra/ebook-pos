import { NextRequest, NextResponse } from 'next/server';
import { checkoutSchema } from '@/lib/validation';

export async function POST(req: NextRequest) {
  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: 'Request body harus JSON.' }, { status: 400 });
  }

  const result = checkoutSchema.safeParse(body);
  if (!result.success) {
    const fields: Record<string, string[]> = {};
    for (const issue of result.error.issues) {
      const key = issue.path[0]?.toString() ?? '_';
      fields[key] = [...(fields[key] ?? []), issue.message];
    }
    return NextResponse.json({ error: 'Validasi gagal.', fields }, { status: 422 });
  }

  // F2 will complete this: look up product, create Order, call Midtrans Snap, return token.
  // For now, return 501 so F1 integration tests know the validation passed.
  return NextResponse.json(
    { error: 'Pembayaran belum dikonfigurasi (F2).' },
    { status: 501 },
  );
}
