import { NextRequest, NextResponse } from 'next/server';
import { isCron } from '@/lib/auth';
import { processDueDeliveries } from '@/lib/delivery';
import { processPendingConversionPostbacks } from '@/lib/conversion';

export async function GET(req: NextRequest) {
  if (!isCron(req)) {
    return NextResponse.json({ error: 'Unauthorized.' }, { status: 401 });
  }

  const result = await processDueDeliveries();

  // Retry any conversion postbacks (D17, §26) that haven't gone out yet — best-effort.
  const conversions = await processPendingConversionPostbacks().catch(() => ({ processed: 0 }));

  return NextResponse.json({ ...result, conversions: conversions.processed });
}
